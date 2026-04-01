"use client";

import { useState } from "react";
import { useStore } from "@/store/useStore";

export function BacktestResults() {
  const results = useStore((s) => s.backtestResults);
  const [expandedTrade, setExpandedTrade] = useState<string | null>(null);

  if (!results) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-slate-400">
        Run a backtest to see results
      </div>
    );
  }

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
  ];

  return (
    <div className="h-full overflow-auto p-3">
      {/* Metrics grid */}
      <div className="grid grid-cols-6 gap-2 mb-3">
        {metrics.map((m) => (
          <div key={m.label} className="rounded border border-slate-200 p-2 bg-white">
            <div className="text-[10px] text-slate-400 uppercase">{m.label}</div>
            <div
              className={`text-sm font-semibold ${
                "positive" in m && m.positive
                  ? "text-green-600"
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

      {/* Trade log */}
      <div className="text-[10px] uppercase text-slate-400 mb-1 font-semibold">
        Trade Log
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-400">
            <th className="py-1 pr-2">Entry</th>
            <th className="py-1 pr-2">Exit</th>
            <th className="py-1 pr-2">Dir</th>
            <th className="py-1 pr-2">Entry $</th>
            <th className="py-1 pr-2">Exit $</th>
            <th className="py-1 pr-2 text-right">PnL</th>
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
                className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
              >
                <td className="py-1 pr-2 text-slate-500">{trade.entryTime}</td>
                <td className="py-1 pr-2 text-slate-500">{trade.exitTime}</td>
                <td className="py-1 pr-2">
                  <span
                    className={
                      trade.direction === "long"
                        ? "text-green-600"
                        : "text-red-500"
                    }
                  >
                    {trade.direction}
                  </span>
                </td>
                <td className="py-1 pr-2 text-slate-700">
                  {trade.entryPrice.toFixed(2)}
                </td>
                <td className="py-1 pr-2 text-slate-700">
                  {trade.exitPrice.toFixed(2)}
                </td>
                <td
                  className={`py-1 text-right font-medium ${
                    trade.pnl >= 0 ? "text-green-600" : "text-red-500"
                  }`}
                >
                  {trade.pnl >= 0 ? "+" : ""}
                  {trade.pnl.toFixed(2)}
                </td>
              </tr>
              {expandedTrade === trade.id && (
                <tr key={`${trade.id}-detail`}>
                  <td colSpan={6} className="bg-slate-50 px-3 py-2">
                    <div className="text-slate-500">
                      <span className="text-slate-400">PnL%:</span>{" "}
                      {trade.pnlPercent.toFixed(2)}%
                      {trade.reason && (
                        <>
                          {" | "}
                          <span className="text-slate-400">Reason:</span>{" "}
                          {trade.reason}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
