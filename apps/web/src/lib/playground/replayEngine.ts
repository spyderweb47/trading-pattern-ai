import type { OHLCBar, Position, PerpOrder, PlaygroundTrade, ExitReason } from "@/types";
import {
  computeLiquidationPrice,
  computeUnrealizedPnl,
  computeFees,
  computeRequiredMargin,
} from "./liquidation";

export interface EngineState {
  positions: Position[];
  orders: PerpOrder[];
  balance: number;
}

export interface EngineUpdate {
  positions: Position[];
  orders: PerpOrder[];
  balance: number;
  closedTrades: PlaygroundTrade[];
}

interface CloseCtx {
  reason: ExitReason;
  price: number;
  barIdx: number;
  barTime: number;
}

/**
 * Process one bar — runs matching for all orders/positions.
 * Mutations are returned as a new snapshot (pure function).
 */
export function processBar(
  state: EngineState,
  bar: OHLCBar,
  barIdx: number
): EngineUpdate {
  let { balance } = state;
  let positions = [...state.positions];
  let orders = [...state.orders];
  const closedTrades: PlaygroundTrade[] = [];
  const barTime = typeof bar.time === "string" ? Number(bar.time) : bar.time;

  // --- 1. Fill pending market orders at bar.open ---
  for (let i = 0; i < orders.length; i++) {
    const o = orders[i];
    if (o.status !== "pending") continue;
    if (o.type !== "market") continue;
    const fill = openPositionFromOrder(o, bar.open, barIdx, barTime);
    const marginNeeded = computeRequiredMargin(o.size, o.leverage);
    const fee = computeFees(o.size);
    if (balance < marginNeeded + fee) {
      orders[i] = { ...o, status: "cancelled" };
      continue;
    }
    balance -= fee;
    positions.push(fill);
    orders[i] = { ...o, status: "filled" };
  }

  // --- 2. Fill pending limit orders if price crossed ---
  for (let i = 0; i < orders.length; i++) {
    const o = orders[i];
    if (o.status !== "pending") continue;
    if (o.type !== "limit" || o.limitPrice == null) continue;
    const limit = o.limitPrice;
    if (bar.low <= limit && limit <= bar.high) {
      const marginNeeded = computeRequiredMargin(o.size, o.leverage);
      const fee = computeFees(o.size);
      if (balance < marginNeeded + fee) {
        orders[i] = { ...o, status: "cancelled" };
        continue;
      }
      balance -= fee;
      positions.push(openPositionFromOrder(o, limit, barIdx, barTime));
      orders[i] = { ...o, status: "filled" };
    }
  }

  // --- 3. Check TP/SL/Liquidation on each open position ---
  const remainingPositions: Position[] = [];
  for (const pos of positions) {
    const ctx = checkPositionTriggers(pos, bar);
    if (ctx) {
      const trade = closePosition(pos, ctx, barTime);
      closedTrades.push(trade);
      balance += pos.margin + trade.pnl; // return margin + realized PnL
      balance -= trade.fees; // exit fee
      continue;
    }
    // Update unrealized PnL on remaining positions using bar.close
    const { pnl, pnlPct } = computeUnrealizedPnl(pos.side, pos.entryPrice, bar.close, pos.size);
    remainingPositions.push({ ...pos, unrealizedPnl: pnl, unrealizedPnlPct: pnlPct });
  }

  return {
    positions: remainingPositions,
    orders,
    balance,
    closedTrades,
  };
}

function openPositionFromOrder(
  o: PerpOrder,
  fillPrice: number,
  barIdx: number,
  barTime: number
): Position {
  const liquidationPrice = computeLiquidationPrice(o.side, fillPrice, o.leverage);
  const margin = computeRequiredMargin(o.size, o.leverage);
  return {
    id: `pos-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    side: o.side,
    size: o.size,
    leverage: o.leverage,
    entryPrice: fillPrice,
    margin,
    liquidationPrice,
    takeProfit: o.takeProfit,
    stopLoss: o.stopLoss,
    openedAtBarIdx: barIdx,
    openedAtTime: barTime,
    unrealizedPnl: 0,
    unrealizedPnlPct: 0,
  };
}

function checkPositionTriggers(pos: Position, bar: OHLCBar): CloseCtx | null {
  const isLong = pos.side === "long";
  // Liquidation (check first — most critical)
  if (isLong && bar.low <= pos.liquidationPrice) {
    return { reason: "liquidation", price: pos.liquidationPrice, barIdx: 0, barTime: 0 };
  }
  if (!isLong && bar.high >= pos.liquidationPrice) {
    return { reason: "liquidation", price: pos.liquidationPrice, barIdx: 0, barTime: 0 };
  }
  // Stop loss (check before TP for worst-case realism)
  if (pos.stopLoss != null) {
    if (isLong && bar.low <= pos.stopLoss) {
      return { reason: "sl", price: pos.stopLoss, barIdx: 0, barTime: 0 };
    }
    if (!isLong && bar.high >= pos.stopLoss) {
      return { reason: "sl", price: pos.stopLoss, barIdx: 0, barTime: 0 };
    }
  }
  // Take profit
  if (pos.takeProfit != null) {
    if (isLong && bar.high >= pos.takeProfit) {
      return { reason: "tp", price: pos.takeProfit, barIdx: 0, barTime: 0 };
    }
    if (!isLong && bar.low <= pos.takeProfit) {
      return { reason: "tp", price: pos.takeProfit, barIdx: 0, barTime: 0 };
    }
  }
  return null;
}

export function closePosition(pos: Position, ctx: CloseCtx, barTime: number): PlaygroundTrade {
  const { pnl, pnlPct } = computeUnrealizedPnl(pos.side, pos.entryPrice, ctx.price, pos.size);
  const exitFee = computeFees(pos.size);
  // Liquidation loses the full margin
  const finalPnl = ctx.reason === "liquidation" ? -pos.margin : pnl;
  return {
    id: `trade-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    side: pos.side,
    size: pos.size,
    leverage: pos.leverage,
    entryPrice: pos.entryPrice,
    exitPrice: ctx.price,
    entryTime: pos.openedAtTime,
    exitTime: barTime,
    pnl: finalPnl,
    pnlPct,
    fees: exitFee,
    exitReason: ctx.reason,
  };
}

/** Close a position manually at given price (e.g., user clicks Close). */
export function closePositionManual(
  pos: Position,
  currentPrice: number,
  barTime: number
): PlaygroundTrade {
  return closePosition(
    pos,
    { reason: "manual", price: currentPrice, barIdx: 0, barTime },
    barTime
  );
}

/** Recompute unrealized PnL for all positions based on current price. */
export function recomputeUnrealized(positions: Position[], currentPrice: number): Position[] {
  return positions.map((p) => {
    const { pnl, pnlPct } = computeUnrealizedPnl(p.side, p.entryPrice, currentPrice, p.size);
    return { ...p, unrealizedPnl: pnl, unrealizedPnlPct: pnlPct };
  });
}
