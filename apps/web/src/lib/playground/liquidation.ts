import type { PositionSide } from "@/types";

export const MAINTENANCE_MARGIN_RATE = 0.005; // 0.5%
export const TAKER_FEE_RATE = 0.00045; // 0.045% (Hyperliquid-style)

export function computeLiquidationPrice(
  side: PositionSide,
  entryPrice: number,
  leverage: number
): number {
  // Long:  liq = entry × (1 - 1/lev + mmr)
  // Short: liq = entry × (1 + 1/lev - mmr)
  if (leverage <= 0) return 0;
  const invLev = 1 / leverage;
  if (side === "long") {
    return entryPrice * (1 - invLev + MAINTENANCE_MARGIN_RATE);
  }
  return entryPrice * (1 + invLev - MAINTENANCE_MARGIN_RATE);
}

export function computeUnrealizedPnl(
  side: PositionSide,
  entryPrice: number,
  currentPrice: number,
  size: number // USD notional
): { pnl: number; pnlPct: number } {
  if (entryPrice <= 0) return { pnl: 0, pnlPct: 0 };
  const direction = side === "long" ? 1 : -1;
  const priceChange = (currentPrice - entryPrice) / entryPrice;
  const pnlPct = direction * priceChange * 100;
  const pnl = direction * (currentPrice - entryPrice) * (size / entryPrice);
  return { pnl, pnlPct };
}

export function computeFees(size: number): number {
  // size is USD notional; taker fee on entry+exit
  return size * TAKER_FEE_RATE;
}

export function computeRequiredMargin(size: number, leverage: number): number {
  if (leverage <= 0) return size;
  return size / leverage;
}
