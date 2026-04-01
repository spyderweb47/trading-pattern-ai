"use client";

import { useState } from "react";
import { useStore, type Mode } from "@/store/useStore";

const PANEL_TABS: Record<Mode, string[]> = {
  pattern: ["Pattern Analysis"],
  strategy: ["Strategy Report"],
  backtest: ["Trade History", "Report"],
};

export function BottomPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const activeMode = useStore((s) => s.activeMode);
  const backtestResults = useStore((s) => s.backtestResults);
  const patternMatches = useStore((s) => s.patternMatches);
  const [expandedTrade, setExpandedTrade] = useState<string | null>(null);

  const tabs = PANEL_TABS[activeMode];

  return (
    <div
      className={`flex flex-col shrink-0 ${
        collapsed ? "h-8" : "h-64"
      }`}
      style={{ borderTop: "1px solid var(--border)", background: "var(--surface)" }}
    >
      {/* Tab bar + collapse toggle */}
      <div className="flex h-8 shrink-0 items-center px-1" style={{ borderBottom: "1px solid var(--border-subtle)", background: "var(--surface-2)" }}>
        {tabs.map((tab, i) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(i);
              if (collapsed) {
                setCollapsed(false);
                requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
              }
            }}
            className={`px-3 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
              activeTab === i && !collapsed
                ? "text-slate-900"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            {tab}
          </button>
        ))}

        <div className="flex-1" />

        {/* Collapse / expand */}
        <button
          onClick={() => {
            setCollapsed(!collapsed);
            // Trigger resize so the chart recalculates its dimensions
            requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
          }}
          className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:text-slate-600"
        >
          <svg
            className={`h-3.5 w-3.5 transition-transform ${collapsed ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Content */}
      {!collapsed && (
        <div className="flex-1 overflow-auto">
          {activeMode === "backtest" && <BacktestContent tab={activeTab} results={backtestResults} expandedTrade={expandedTrade} setExpandedTrade={setExpandedTrade} />}
          {activeMode === "pattern" && <PatternContent matches={patternMatches} />}
          {activeMode === "strategy" && <StrategyContent />}
        </div>
      )}
    </div>
  );
}

/* ─── Backtest ─── */

function BacktestContent({
  tab,
  results,
  expandedTrade,
  setExpandedTrade,
}: {
  tab: number;
  results: ReturnType<typeof useStore.getState>["backtestResults"];
  expandedTrade: string | null;
  setExpandedTrade: (id: string | null) => void;
}) {
  if (!results) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-slate-400">
        Run a backtest to see results
      </div>
    );
  }

  if (tab === 1) {
    // Report tab
    const metrics = [
      { label: "Total Trades", value: results.totalTrades },
      { label: "Win Rate", value: `${(results.winRate * 100).toFixed(1)}%` },
      { label: "Profit Factor", value: results.profitFactor.toFixed(2) },
      { label: "Sharpe Ratio", value: results.sharpeRatio.toFixed(2) },
      {
        label: "Max Drawdown",
        value: `${(results.maxDrawdown * 100).toFixed(1)}%`,
        negative: true,
      },
      {
        label: "Total Return",
        value: `${(results.totalReturn * 100).toFixed(1)}%`,
        positive: results.totalReturn > 0,
      },
      {
        label: "Annualized Return",
        value: `${(results.annualizedReturn * 100).toFixed(1)}%`,
        positive: results.annualizedReturn > 0,
      },
    ];

    return (
      <div className="p-3">
        <div className="grid grid-cols-4 gap-2">
          {metrics.map((m) => (
            <div key={m.label} className="rounded border border-slate-100 p-2">
              <div className="text-[10px] text-slate-400 uppercase">{m.label}</div>
              <div
                className={`text-sm font-semibold ${
                  "positive" in m && m.positive
                    ? "text-emerald-600"
                    : "negative" in m && m.negative
                      ? "text-red-500"
                      : "text-slate-800"
                }`}
              >
                {m.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Trade History tab (default)
  return (
    <div className="p-3">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-200 text-left text-[10px] uppercase text-slate-400">
            <th className="py-1.5 pr-3 font-semibold">Entry Time</th>
            <th className="py-1.5 pr-3 font-semibold">Exit Time</th>
            <th className="py-1.5 pr-3 font-semibold">Side</th>
            <th className="py-1.5 pr-3 font-semibold">Entry</th>
            <th className="py-1.5 pr-3 font-semibold">Exit</th>
            <th className="py-1.5 pr-3 font-semibold">Qty</th>
            <th className="py-1.5 pr-3 text-right font-semibold">PnL</th>
            <th className="py-1.5 text-right font-semibold">PnL %</th>
          </tr>
        </thead>
        <tbody>
          {results.trades.map((trade) => (
            <>
              <tr
                key={trade.id}
                onClick={() =>
                  setExpandedTrade(expandedTrade === trade.id ? null : trade.id)
                }
                className="cursor-pointer border-b border-slate-50 hover:bg-slate-50/50"
              >
                <td className="py-1.5 pr-3 text-slate-500">{trade.entryTime}</td>
                <td className="py-1.5 pr-3 text-slate-500">{trade.exitTime}</td>
                <td className="py-1.5 pr-3">
                  <span
                    className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      trade.direction === "long"
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-red-50 text-red-500"
                    }`}
                  >
                    {trade.direction.toUpperCase()}
                  </span>
                </td>
                <td className="py-1.5 pr-3 text-slate-700 font-medium">
                  {trade.entryPrice.toFixed(2)}
                </td>
                <td className="py-1.5 pr-3 text-slate-700 font-medium">
                  {trade.exitPrice.toFixed(2)}
                </td>
                <td className="py-1.5 pr-3 text-slate-500">
                  {trade.quantity}
                </td>
                <td
                  className={`py-1.5 pr-3 text-right font-semibold ${
                    trade.pnl >= 0 ? "text-emerald-600" : "text-red-500"
                  }`}
                >
                  {trade.pnl >= 0 ? "+" : ""}
                  {trade.pnl.toFixed(2)}
                </td>
                <td
                  className={`py-1.5 text-right ${
                    trade.pnlPercent >= 0 ? "text-emerald-600" : "text-red-500"
                  }`}
                >
                  {trade.pnlPercent >= 0 ? "+" : ""}
                  {trade.pnlPercent.toFixed(2)}%
                </td>
              </tr>
              {expandedTrade === trade.id && trade.reason && (
                <tr key={`${trade.id}-detail`}>
                  <td colSpan={8} className="bg-slate-50/50 px-3 py-2 text-slate-500">
                    <span className="text-slate-400">Reason:</span> {trade.reason}
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
      {results.trades.length === 0 && (
        <div className="py-6 text-center text-xs text-slate-400">No trades recorded</div>
      )}
    </div>
  );
}

/* ─── Pattern Analysis ─── */

function PatternContent({ matches }: { matches: ReturnType<typeof useStore.getState>["patternMatches"] }) {
  const setChartFocus = useStore((s) => s.setChartFocus);
  const chartData = useStore((s) => s.chartData);

  if (matches.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-slate-400">
        Run pattern detection to see analysis
      </div>
    );
  }

  const handleRowClick = (m: (typeof matches)[0]) => {
    const startT = typeof m.startTime === "string" ? Number(m.startTime) : m.startTime as number;
    const endT = typeof m.endTime === "string" ? Number(m.endTime) : m.endTime as number;
    const duration = endT - startT;
    // Add padding: 3x the pattern duration on each side for context
    const pad = Math.max(duration * 3, 86400 * 5); // at least 5 days
    setChartFocus({ startTime: startT - pad, endTime: endT + pad });
  };

  const bullish = matches.filter((m) => m.direction === "bullish").length;
  const bearish = matches.filter((m) => m.direction === "bearish").length;
  const neutral = matches.filter((m) => m.direction === "neutral").length;
  const avgConfidence = matches.reduce((s, m) => s + m.confidence, 0) / matches.length;

  return (
    <div className="p-3">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        <div className="rounded border border-slate-100 p-2">
          <div className="text-[10px] text-slate-400 uppercase">Total</div>
          <div className="text-sm font-semibold text-slate-800">{matches.length}</div>
        </div>
        <div className="rounded border border-slate-100 p-2">
          <div className="text-[10px] text-slate-400 uppercase">Bullish</div>
          <div className="text-sm font-semibold text-emerald-600">{bullish}</div>
        </div>
        <div className="rounded border border-slate-100 p-2">
          <div className="text-[10px] text-slate-400 uppercase">Bearish</div>
          <div className="text-sm font-semibold text-red-500">{bearish}</div>
        </div>
        <div className="rounded border border-slate-100 p-2">
          <div className="text-[10px] text-slate-400 uppercase">Avg Confidence</div>
          <div className="text-sm font-semibold text-slate-800">{(avgConfidence * 100).toFixed(1)}%</div>
        </div>
      </div>

      {/* Match list */}
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-200 text-left text-[10px] uppercase text-slate-400">
            <th className="py-1.5 pr-3 font-semibold">Pattern</th>
            <th className="py-1.5 pr-3 font-semibold">Direction</th>
            <th className="py-1.5 pr-3 font-semibold">Start</th>
            <th className="py-1.5 pr-3 font-semibold">End</th>
            <th className="py-1.5 text-right font-semibold">Confidence</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((m) => (
            <tr
              key={m.id}
              onClick={() => handleRowClick(m)}
              className="border-b border-slate-50 hover:bg-blue-50/50 cursor-pointer transition-colors"
            >
              <td className="py-1.5 pr-3 font-medium text-slate-700">{m.name}</td>
              <td className="py-1.5 pr-3">
                <span
                  className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    m.direction === "bullish"
                      ? "bg-emerald-50 text-emerald-600"
                      : m.direction === "bearish"
                        ? "bg-red-50 text-red-500"
                        : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {m.direction.toUpperCase()}
                </span>
              </td>
              <td className="py-1.5 pr-3 text-slate-500">{m.startTime}</td>
              <td className="py-1.5 pr-3 text-slate-500">{m.endTime}</td>
              <td className="py-1.5 text-right text-slate-700">{(m.confidence * 100).toFixed(0)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Strategy Report ─── */

function StrategyContent() {
  const analysisResults = useStore((s) => s.analysisResults);

  if (!analysisResults) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-slate-400">
        Run strategy analysis to see report
      </div>
    );
  }

  return (
    <div className="p-3">
      {analysisResults.summary && (
        <p className="text-xs text-slate-600 mb-3">{analysisResults.summary}</p>
      )}

      {analysisResults.metrics && (
        <div className="grid grid-cols-4 gap-2 mb-3">
          {Object.entries(analysisResults.metrics).map(([key, val]) => (
            <div key={key} className="rounded border border-slate-100 p-2">
              <div className="text-[10px] text-slate-400 uppercase">{key.replace(/_/g, " ")}</div>
              <div className="text-sm font-semibold text-slate-800">{val}</div>
            </div>
          ))}
        </div>
      )}

      {analysisResults.signals && analysisResults.signals.length > 0 && (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-left text-[10px] uppercase text-slate-400">
              <th className="py-1.5 pr-3 font-semibold">Time</th>
              <th className="py-1.5 pr-3 font-semibold">Signal</th>
              <th className="py-1.5 text-right font-semibold">Price</th>
            </tr>
          </thead>
          <tbody>
            {analysisResults.signals.map((s, i) => (
              <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                <td className="py-1.5 pr-3 text-slate-500">{s.time}</td>
                <td className="py-1.5 pr-3">
                  <span
                    className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      s.type === "buy"
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-red-50 text-red-500"
                    }`}
                  >
                    {s.type.toUpperCase()}
                  </span>
                </td>
                <td className="py-1.5 text-right text-slate-700 font-medium">{s.price.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
