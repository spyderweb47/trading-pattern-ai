"use client";

import { useState } from "react";
import { useStore } from "@/store/useStore";
import type { Trade } from "@/types";

export function TradeList() {
  const results = useStore((s) => s.backtestResults);
  const setChartFocus = useStore((s) => s.setChartFocus);
  const setPlottedTrades = useStore((s) => s.setPlottedTrades);
  const plottedTrades = useStore((s) => s.plottedTrades);
  const setHighlightedTradeId = useStore((s) => s.setHighlightedTradeId);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [plotAll, setPlotAll] = useState(false);

  if (!results || results.trades.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs" style={{ color: "var(--text-tertiary)" }}>
        {results ? "No trades executed" : "Run a strategy to see trades"}
      </div>
    );
  }

  const handlePlotAll = (checked: boolean) => {
    setPlotAll(checked);
    setPlottedTrades(checked ? results.trades : []);
  };

  const handleTradeClick = (trade: Trade) => {
    const wasExpanded = expandedId === trade.id;
    setExpandedId(wasExpanded ? null : trade.id);

    // Highlight this trade box (or clear highlight if collapsing)
    setHighlightedTradeId(wasExpanded ? null : trade.id);

    // Plot this trade on chart (or clear if collapsing)
    if (!plotAll) {
      setPlottedTrades(wasExpanded ? [] : [trade]);
    }

    // Zoom chart to trade
    if (!wasExpanded) {
      const startT = typeof trade.entryTime === "string" ? Number(trade.entryTime) : trade.entryTime;
      const endT = typeof trade.exitTime === "string" ? Number(trade.exitTime) : trade.exitTime;
      if (startT && endT) {
        const duration = endT - startT;
        const pad = Math.max(duration * 2, 86400 * 3);
        setChartFocus({ startTime: startT - pad, endTime: endT + pad });
      }
    }
  };

  return (
    <div className="overflow-auto h-full">
      {/* Header with Plot All toggle */}
      <div className="flex items-center justify-between px-3 py-1.5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <span className="text-[9px] font-semibold uppercase" style={{ color: "var(--text-muted)" }}>
          {results.trades.length} trades
        </span>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={plotAll}
            onChange={(e) => handlePlotAll(e.target.checked)}
            className="h-3 w-3 rounded"
          />
          <span className="text-[9px] font-medium" style={{ color: "var(--text-tertiary)" }}>Plot All on Chart</span>
        </label>
      </div>

      <table className="w-full text-[10px]">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            <Th>#</Th>
            <Th>Side</Th>
            <Th>Entry</Th>
            <Th>Exit</Th>
            <Th align="right">PnL</Th>
            <Th align="right">PnL%</Th>
            <Th align="right">Bars</Th>
            <Th>Reason</Th>
          </tr>
        </thead>
        <tbody>
          {results.trades.map((trade, i) => (
            <TradeRow
              key={trade.id}
              trade={trade}
              index={i + 1}
              expanded={expandedId === trade.id}
              onClick={() => handleTradeClick(trade)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TradeRow({ trade, index, expanded, onClick }: { trade: Trade; index: number; expanded: boolean; onClick: () => void }) {
  return (
    <>
      <tr
        onClick={onClick}
        className="cursor-pointer transition-colors"
        style={{ borderBottom: "1px solid var(--border-subtle)", background: expanded ? "var(--surface-2)" : "transparent" }}
        onMouseEnter={(e) => { if (!expanded) e.currentTarget.style.background = "var(--surface-2)"; }}
        onMouseLeave={(e) => { if (!expanded) e.currentTarget.style.background = "transparent"; }}
      >
        <td className="py-1.5 px-2" style={{ color: "var(--text-muted)" }}>{index}</td>
        <td className="py-1.5 px-2">
          <span
            className="inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold"
            style={{
              background: trade.direction === "long" ? "rgba(38,166,154,0.15)" : "rgba(239,83,80,0.15)",
              color: trade.direction === "long" ? "var(--success)" : "var(--danger)",
            }}
          >
            {trade.direction.toUpperCase()}
          </span>
        </td>
        <td className="py-1.5 px-2" style={{ color: "var(--text-secondary)" }}>${formatPrice(trade.entryPrice)}</td>
        <td className="py-1.5 px-2" style={{ color: "var(--text-secondary)" }}>${formatPrice(trade.exitPrice)}</td>
        <td className="py-1.5 px-2 text-right font-semibold" style={{ color: trade.pnl >= 0 ? "var(--success)" : "var(--danger)" }}>
          {trade.pnl >= 0 ? "+" : ""}{trade.pnl.toFixed(2)}
        </td>
        <td className="py-1.5 px-2 text-right" style={{ color: trade.pnlPercent >= 0 ? "var(--success)" : "var(--danger)" }}>
          {trade.pnlPercent >= 0 ? "+" : ""}{trade.pnlPercent.toFixed(2)}%
        </td>
        <td className="py-1.5 px-2 text-right" style={{ color: "var(--text-muted)" }}>{trade.holdingBars || "—"}</td>
        <td className="py-1.5 px-2" style={{ color: "var(--text-tertiary)" }}>{trade.reason || "—"}</td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={8} className="p-0">
            <div className="px-4 py-2 space-y-1" style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
              <div className="grid grid-cols-3 gap-2 text-[9px]">
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Entry Reason: </span>
                  <span style={{ color: "var(--text-secondary)" }}>{trade.entryReason || "Signal"}</span>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Exit Reason: </span>
                  <span style={{ color: "var(--text-secondary)" }}>{trade.exitReason || trade.reason || "Signal"}</span>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Drawdown at Entry: </span>
                  <span style={{ color: "var(--text-secondary)" }}>{trade.drawdownAtEntry?.toFixed(1) || "0"}%</span>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Max Adverse (MAE): </span>
                  <span style={{ color: "var(--danger)" }}>{trade.maxAdverseExcursion?.toFixed(2) || "0"}%</span>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Max Favorable (MFE): </span>
                  <span style={{ color: "var(--success)" }}>{trade.maxFavorableExcursion?.toFixed(2) || "0"}%</span>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Holding: </span>
                  <span style={{ color: "var(--text-secondary)" }}>{trade.holdingBars || "—"} bars</span>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function formatPrice(price: number): string {
  if (price >= 1000) return price.toFixed(0);
  if (price >= 1) return price.toFixed(2);
  if (price >= 0.01) return price.toFixed(4);
  return price.toFixed(6);
}

function Th({ children, align }: { children: React.ReactNode; align?: string }) {
  return (
    <th
      className={`py-1.5 px-2 font-semibold uppercase ${align === "right" ? "text-right" : "text-left"}`}
      style={{ color: "var(--text-muted)", fontSize: "8px" }}
    >
      {children}
    </th>
  );
}
