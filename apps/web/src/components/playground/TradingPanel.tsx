"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/store/useStore";
import {
  computeLiquidationPrice,
  computeRequiredMargin,
  computeFees,
} from "@/lib/playground/liquidation";
import { closePositionManual } from "@/lib/playground/replayEngine";
import type { PerpOrder, PositionSide, OrderType } from "@/types";

export function TradingPanel() {
  const activeId = useStore((s) => s.activeDataset);
  const chartData = useStore((s) => (activeId ? s.datasetChartData[activeId] : null));
  const idx = useStore((s) => s.playgroundReplay.currentBarIndex);
  const wallet = useStore((s) => s.demoWallet);
  const positions = useStore((s) => s.positions);
  const addPerpOrder = useStore((s) => s.addPerpOrder);
  const removePosition = useStore((s) => s.removePosition);
  const addClosedTrade = useStore((s) => s.addClosedTrade);
  const adjustWalletBalance = useStore((s) => s.adjustWalletBalance);
  const resetWallet = useStore((s) => s.resetWallet);

  const currentBar = chartData?.[idx];
  const currentPrice = currentBar?.close ?? 0;

  const [side, setSide] = useState<PositionSide>("long");
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [leverage, setLeverage] = useState(5);
  const [sizeUsd, setSizeUsd] = useState(1000);
  const [limitPrice, setLimitPrice] = useState<number | "">("");
  const [tp, setTp] = useState<number | "">("");
  const [sl, setSl] = useState<number | "">("");
  const [reduceOnly, setReduceOnly] = useState(false);

  const marginUsed = positions.reduce((acc, p) => acc + p.margin, 0);
  const unrealized = positions.reduce((acc, p) => acc + p.unrealizedPnl, 0);
  const equity = wallet.balance + unrealized;
  const freeMargin = Math.max(0, wallet.balance - marginUsed);

  const requiredMargin = computeRequiredMargin(sizeUsd, leverage);
  const fee = computeFees(sizeUsd);
  const estLiq = currentPrice > 0 ? computeLiquidationPrice(side, currentPrice, leverage) : 0;

  const canSubmit =
    currentPrice > 0 && sizeUsd > 0 && leverage > 0 && freeMargin >= requiredMargin + fee;

  const submit = () => {
    if (!canSubmit) return;
    const order: PerpOrder = {
      id: `ord-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: orderType,
      side,
      size: sizeUsd,
      leverage,
      limitPrice: orderType === "limit" ? Number(limitPrice) : undefined,
      takeProfit: tp === "" ? undefined : Number(tp),
      stopLoss: sl === "" ? undefined : Number(sl),
      reduceOnly,
      status: "pending",
      createdAtBarIdx: idx,
    };
    addPerpOrder(order);
  };

  const quickSize = (pct: number) => {
    const usd = Math.floor(freeMargin * leverage * pct);
    setSizeUsd(Math.max(1, usd));
  };

  const closePos = (posId: string) => {
    const pos = positions.find((p) => p.id === posId);
    if (!pos || !currentBar) return;
    const barTime = typeof currentBar.time === "string" ? Number(currentBar.time) : currentBar.time;
    const trade = closePositionManual(pos, currentPrice, barTime);
    addClosedTrade(trade);
    adjustWalletBalance(pos.margin + trade.pnl - trade.fees);
    removePosition(posId);
  };

  const sideColor = side === "long" ? "var(--success)" : "var(--danger)";

  return (
    <div className="flex flex-col gap-3 overflow-y-auto px-3 py-3">
      {/* Wallet Card */}
      <div
        className="rounded-md p-3"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Demo Wallet
          </span>
          <button
            onClick={() => resetWallet()}
            className="text-[9px] font-semibold uppercase"
            style={{ color: "var(--text-muted)" }}
          >
            Reset
          </button>
        </div>
        <div className="text-xl font-bold font-mono" style={{ color: "var(--text-primary)" }}>
          ${equity.toFixed(2)}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
          <Stat label="Balance" value={`$${wallet.balance.toFixed(2)}`} />
          <Stat
            label="uPnL"
            value={`${unrealized >= 0 ? "+" : ""}$${unrealized.toFixed(2)}`}
            color={unrealized >= 0 ? "var(--success)" : "var(--danger)"}
          />
          <Stat label="Margin" value={`$${marginUsed.toFixed(2)}`} />
          <Stat label="Free" value={`$${freeMargin.toFixed(2)}`} />
        </div>
      </div>

      {/* Order Form */}
      <div
        className="rounded-md p-3"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
      >
        {/* Side */}
        <div className="grid grid-cols-2 gap-1 mb-2 rounded overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <button
            onClick={() => setSide("long")}
            className="py-1.5 text-[10px] font-bold uppercase tracking-wide transition-colors"
            style={{
              background: side === "long" ? "var(--success)" : "transparent",
              color: side === "long" ? "#fff" : "var(--text-tertiary)",
            }}
          >
            Long
          </button>
          <button
            onClick={() => setSide("short")}
            className="py-1.5 text-[10px] font-bold uppercase tracking-wide transition-colors"
            style={{
              background: side === "short" ? "var(--danger)" : "transparent",
              color: side === "short" ? "#fff" : "var(--text-tertiary)",
            }}
          >
            Short
          </button>
        </div>

        {/* Type */}
        <div className="grid grid-cols-2 gap-1 mb-2 rounded overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {(["market", "limit"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setOrderType(t)}
              className="py-1 text-[9px] font-semibold uppercase transition-colors"
              style={{
                background: orderType === t ? "var(--accent)" : "transparent",
                color: orderType === t ? "#fff" : "var(--text-tertiary)",
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Leverage */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-semibold uppercase" style={{ color: "var(--text-muted)" }}>
              Leverage
            </span>
            <span className="text-[11px] font-bold font-mono" style={{ color: sideColor }}>
              {leverage}x
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={20}
            step={1}
            value={leverage}
            onChange={(e) => setLeverage(Number(e.target.value))}
            className="w-full h-1 cursor-pointer"
            style={{ accentColor: sideColor }}
          />
        </div>

        {/* Size */}
        <div className="mb-2">
          <label className="text-[9px] font-semibold uppercase mb-1 block" style={{ color: "var(--text-muted)" }}>
            Size (USD)
          </label>
          <input
            type="number"
            value={sizeUsd}
            onChange={(e) => setSizeUsd(Number(e.target.value))}
            className="w-full rounded px-2 py-1 text-[11px] font-mono"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          />
          <div className="flex gap-1 mt-1">
            {[0.25, 0.5, 0.75, 1].map((p) => (
              <button
                key={p}
                onClick={() => quickSize(p)}
                className="flex-1 rounded py-0.5 text-[9px] font-semibold"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-tertiary)" }}
              >
                {Math.round(p * 100)}%
              </button>
            ))}
          </div>
        </div>

        {/* Limit Price */}
        {orderType === "limit" && (
          <div className="mb-2">
            <label className="text-[9px] font-semibold uppercase mb-1 block" style={{ color: "var(--text-muted)" }}>
              Limit Price
            </label>
            <input
              type="number"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full rounded px-2 py-1 text-[11px] font-mono"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
          </div>
        )}

        {/* TP / SL */}
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <label className="text-[9px] font-semibold uppercase mb-1 block" style={{ color: "var(--text-muted)" }}>
              TP
            </label>
            <input
              type="number"
              value={tp}
              placeholder="opt."
              onChange={(e) => setTp(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full rounded px-2 py-1 text-[11px] font-mono"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
          </div>
          <div>
            <label className="text-[9px] font-semibold uppercase mb-1 block" style={{ color: "var(--text-muted)" }}>
              SL
            </label>
            <input
              type="number"
              value={sl}
              placeholder="opt."
              onChange={(e) => setSl(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full rounded px-2 py-1 text-[11px] font-mono"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
          </div>
        </div>

        {/* Reduce Only */}
        <label className="flex items-center gap-1.5 mb-2 cursor-pointer">
          <input
            type="checkbox"
            checked={reduceOnly}
            onChange={(e) => setReduceOnly(e.target.checked)}
            className="h-3 w-3"
          />
          <span className="text-[9px] font-semibold uppercase" style={{ color: "var(--text-tertiary)" }}>
            Reduce Only
          </span>
        </label>

        {/* Estimates */}
        <div
          className="rounded p-2 mb-2 text-[9px] space-y-0.5 font-mono"
          style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)" }}
        >
          <Row label="Mark" value={`$${currentPrice.toFixed(2)}`} />
          <Row label="Est. Liq" value={`$${estLiq.toFixed(2)}`} danger />
          <Row label="Margin Req." value={`$${requiredMargin.toFixed(2)}`} />
          <Row label="Fee" value={`$${fee.toFixed(2)}`} />
        </div>

        {/* Submit */}
        <button
          onClick={submit}
          disabled={!canSubmit}
          className="w-full rounded py-2 text-[11px] font-bold uppercase tracking-wide transition-opacity disabled:opacity-40"
          style={{ background: sideColor, color: "#fff" }}
        >
          {orderType === "market" ? `${side === "long" ? "Buy" : "Sell"} Market` : `Place ${side === "long" ? "Buy" : "Sell"} Limit`}
        </button>
      </div>

      {/* Inline Open Positions */}
      {positions.length > 0 && (
        <div
          className="rounded-md p-2"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
        >
          <div className="text-[9px] font-semibold uppercase mb-2" style={{ color: "var(--text-muted)" }}>
            Open ({positions.length})
          </div>
          <div className="space-y-1">
            {positions.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded p-1.5 text-[10px]"
                style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)" }}
              >
                <div>
                  <span
                    className="inline-block rounded px-1 py-0.5 text-[8px] font-bold uppercase mr-1"
                    style={{
                      background: p.side === "long" ? "rgba(38,166,154,0.2)" : "rgba(239,83,80,0.2)",
                      color: p.side === "long" ? "var(--success)" : "var(--danger)",
                    }}
                  >
                    {p.side} {p.leverage}x
                  </span>
                  <span className="font-mono text-[9px]" style={{ color: "var(--text-tertiary)" }}>
                    ${p.size.toFixed(0)}
                  </span>
                  <div
                    className="text-[9px] font-mono"
                    style={{ color: p.unrealizedPnl >= 0 ? "var(--success)" : "var(--danger)" }}
                  >
                    {p.unrealizedPnl >= 0 ? "+" : ""}${p.unrealizedPnl.toFixed(2)} ({p.unrealizedPnlPct.toFixed(2)}%)
                  </div>
                </div>
                <button
                  onClick={() => closePos(p.id)}
                  className="rounded px-2 py-1 text-[9px] font-semibold uppercase"
                  style={{ background: "var(--danger)", color: "#fff" }}
                >
                  Close
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="text-[8px] uppercase" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      <div className="font-mono font-semibold" style={{ color: color ?? "var(--text-primary)" }}>
        {value}
      </div>
    </div>
  );
}

function Row({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex justify-between">
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span style={{ color: danger ? "var(--danger)" : "var(--text-secondary)" }}>{value}</span>
    </div>
  );
}
