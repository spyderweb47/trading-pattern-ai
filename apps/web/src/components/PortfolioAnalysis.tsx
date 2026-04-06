"use client";

import { useStore } from "@/store/useStore";

export function PortfolioAnalysis() {
  const results = useStore((s) => s.backtestResults);

  if (!results) {
    return (
      <div className="flex h-full items-center justify-center text-xs" style={{ color: "var(--text-tertiary)" }}>
        Run a strategy to see portfolio analysis
      </div>
    );
  }

  const m = results.metrics;
  const equity = results.equityCurve;
  const pnls = results.pnlPerTrade || [];

  // Mini equity sparkline using canvas-like div bars
  const eqValues = equity.map((e) => e.value);
  const eqMin = Math.min(...eqValues);
  const eqMax = Math.max(...eqValues);
  const eqRange = eqMax - eqMin || 1;

  return (
    <div className="p-3 overflow-auto h-full">
      {/* Metrics Grid */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        <MetricCard label="Total Trades" value={m?.totalTrades ?? results.totalTrades} />
        <MetricCard label="Win Rate" value={`${((m?.winRate ?? results.winRate) * 100).toFixed(1)}%`} color={((m?.winRate ?? results.winRate) > 0.5) ? "var(--success)" : "var(--danger)"} />
        <MetricCard label="Profit Factor" value={m?.profitFactor ?? results.profitFactor} />
        <MetricCard label="Sharpe Ratio" value={m?.sharpeRatio ?? results.sharpeRatio} />
        <MetricCard label="Max Drawdown" value={`${((m?.maxDrawdown ?? results.maxDrawdown) * 100).toFixed(1)}%`} color="var(--danger)" />
        <MetricCard label="Total Return" value={`${((m?.totalReturn ?? results.totalReturn) * 100).toFixed(1)}%`} color={((m?.totalReturn ?? results.totalReturn) > 0) ? "var(--success)" : "var(--danger)"} />
        <MetricCard label="Avg Win" value={`$${m?.avgWin?.toFixed(0) ?? "—"}`} color="var(--success)" />
        <MetricCard label="Avg Loss" value={`$${Math.abs(m?.avgLoss || 0).toFixed(0)}`} color="var(--danger)" />
        <MetricCard label="Largest Win" value={`$${m?.largestWin?.toFixed(0) ?? "—"}`} color="var(--success)" />
        <MetricCard label="Largest Loss" value={`$${Math.abs(m?.largestLoss || 0).toFixed(0)}`} color="var(--danger)" />
        <MetricCard label="Win Streak" value={m?.winStreak ?? "—"} />
        <MetricCard label="Lose Streak" value={m?.loseStreak ?? "—"} />
      </div>

      {/* Equity Curve Sparkline */}
      <div className="mb-3">
        <div className="text-[9px] font-semibold uppercase mb-1" style={{ color: "var(--text-tertiary)" }}>Equity Curve</div>
        <div className="flex items-end gap-px h-16 rounded overflow-hidden" style={{ background: "var(--surface)" }}>
          {eqValues.length > 0 && eqValues.filter((_, i) => i % Math.max(1, Math.floor(eqValues.length / 200)) === 0).map((v, i) => {
            const h = ((v - eqMin) / eqRange) * 100;
            const isUp = i > 0 && v >= (eqValues[Math.max(0, i - 1)] || v);
            return (
              <div
                key={i}
                className="flex-1 min-w-[1px]"
                style={{
                  height: `${Math.max(2, h)}%`,
                  background: isUp ? "var(--success)" : "var(--danger)",
                  opacity: 0.7,
                }}
              />
            );
          })}
        </div>
        <div className="flex justify-between text-[8px] mt-0.5" style={{ color: "var(--text-muted)" }}>
          <span>${eqValues[0]?.toFixed(0)}</span>
          <span>${eqValues[eqValues.length - 1]?.toFixed(0)}</span>
        </div>
      </div>

      {/* Portfolio Value — large display */}
      {eqValues.length > 0 && (
        <div className="mb-3 text-center">
          {(() => {
              const finalVal = eqValues[eqValues.length - 1];
              const startVal = eqValues[0];
              const change = finalVal - startVal;
              const changePct = startVal > 0 ? (change / startVal) * 100 : 0;
              return (
                <>
                  <div className="text-[24px] font-bold" style={{ color: "var(--text-primary)" }}>
                    {"$"}{finalVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                  <div className="text-[12px] font-medium" style={{ color: change >= 0 ? "var(--success)" : "var(--danger)" }}>
                    {change >= 0 ? "+" : ""}{"$"}{Math.abs(change).toLocaleString(undefined, { maximumFractionDigits: 0 })} ({changePct >= 0 ? "+" : ""}{changePct.toFixed(1)}%)
                  </div>
                </>
              );
          })()}
        </div>
      )}

      {/* Analysis */}
      {results.analysis && (
        <div className="mt-3 p-2 rounded text-[11px] leading-relaxed" style={{ background: "var(--surface)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}>
          <div className="text-[9px] font-semibold uppercase mb-1" style={{ color: "var(--accent)" }}>AI Analysis</div>
          {results.analysis}
        </div>
      )}

      {/* Suggestions */}
      {results.suggestions && results.suggestions.length > 0 && (
        <div className="mt-2">
          <div className="text-[9px] font-semibold uppercase mb-1" style={{ color: "var(--text-tertiary)" }}>Suggestions</div>
          <ul className="space-y-1">
            {results.suggestions.map((s, i) => (
              <li key={i} className="text-[10px] flex gap-1.5" style={{ color: "var(--text-secondary)" }}>
                <span style={{ color: "var(--accent)" }}>-</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded p-1.5" style={{ border: "1px solid var(--border-subtle)" }}>
      <div className="text-[8px] uppercase" style={{ color: "var(--text-muted)" }}>{label}</div>
      <div className="text-[12px] font-semibold" style={{ color: color || "var(--text-primary)" }}>
        {value}
      </div>
    </div>
  );
}
