"use client";

import type { SimulationSummary } from "@/types";

interface Props {
  summary: SimulationSummary;
}

export function DecisionCard({ summary }: Props) {
  const dir = summary.consensusDirection;
  const color = dir === "BULLISH" ? "#00d68f" : dir === "BEARISH" ? "#ff4d4d" : "var(--text-tertiary)";
  const confPct = Math.round(summary.confidence * 100);
  const rec = summary.recommendation;

  return (
    <div
      className="mx-3 mb-3 rounded-md p-3 space-y-2"
      style={{ background: `${color}10`, border: `1px solid ${color}33` }}
    >
      {/* Header: direction + confidence */}
      <div className="flex items-center gap-3">
        <span className="rounded px-3 py-1 text-sm font-bold uppercase tracking-wider" style={{ background: color, color: "#000" }}>
          {dir}
        </span>
        <div className="flex-1">
          <div className="flex justify-between mb-0.5">
            <span className="text-[8px] font-semibold uppercase" style={{ color: "var(--text-muted)" }}>Confidence</span>
            <span className="text-[10px] font-bold font-mono" style={{ color }}>{confPct}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${confPct}%`, background: color }} />
          </div>
        </div>
      </div>

      {/* Key arguments */}
      {summary.keyArguments.length > 0 && (
        <div>
          <div className="text-[8px] font-bold uppercase mb-1" style={{ color: "var(--text-muted)" }}>Key Arguments</div>
          <ul className="space-y-0.5">
            {summary.keyArguments.slice(0, 5).map((a, i) => (
              <li key={i} className="flex items-start gap-1 text-[9px]" style={{ color: "var(--text-secondary)" }}>
                <span style={{ color }}>•</span>{a}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Dissenting views */}
      {summary.dissentingViews.length > 0 && (
        <div>
          <div className="text-[8px] font-bold uppercase mb-1" style={{ color: "var(--text-muted)" }}>Dissenting Views</div>
          <ul className="space-y-0.5">
            {summary.dissentingViews.map((d, i) => (
              <li key={i} className="text-[9px]" style={{ color: "#ff4d4d" }}>⚡ {d}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Price targets + recommendation */}
      <div className="grid grid-cols-2 gap-2">
        {summary.priceTargets && (
          <div className="rounded p-2" style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
            <div className="text-[7px] font-bold uppercase" style={{ color: "var(--text-muted)" }}>Price Targets</div>
            <div className="flex justify-between mt-1 text-[9px] font-mono">
              <span style={{ color: "#ff4d4d" }}>${summary.priceTargets.low?.toLocaleString() || "—"}</span>
              <span style={{ color: "#ff6b00" }}>${summary.priceTargets.mid?.toLocaleString() || "—"}</span>
              <span style={{ color: "#00d68f" }}>${summary.priceTargets.high?.toLocaleString() || "—"}</span>
            </div>
            <div className="flex justify-between text-[7px]" style={{ color: "var(--text-muted)" }}>
              <span>Bear</span><span>Base</span><span>Bull</span>
            </div>
          </div>
        )}
        {rec && (
          <div className="rounded p-2" style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
            <div className="text-[7px] font-bold uppercase" style={{ color: "var(--text-muted)" }}>Recommendation</div>
            <div className="text-[10px] font-bold mt-1" style={{ color }}>{rec.action}</div>
            <div className="text-[8px] font-mono mt-0.5 space-y-0.5" style={{ color: "var(--text-tertiary)" }}>
              {rec.entry != null && <div>Entry: ${rec.entry.toLocaleString()}</div>}
              {rec.stop != null && <div>Stop: <span style={{ color: "#ff4d4d" }}>${rec.stop.toLocaleString()}</span></div>}
              {rec.target != null && <div>Target: <span style={{ color: "#00d68f" }}>${rec.target.toLocaleString()}</span></div>}
            </div>
          </div>
        )}
      </div>

      {/* Risk factors */}
      {summary.riskFactors.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {summary.riskFactors.map((r, i) => (
            <span key={i} className="rounded px-1.5 py-0.5 text-[7px] font-semibold"
              style={{ background: "rgba(255,77,77,0.1)", color: "#ff4d4d", border: "1px solid rgba(255,77,77,0.2)" }}>
              {r}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
