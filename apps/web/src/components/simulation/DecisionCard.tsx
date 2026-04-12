"use client";

import type { SimulationDecision } from "@/types";

interface Props {
  decision: SimulationDecision;
}

const DECISION_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  BUY: { bg: "rgba(0, 214, 143, 0.15)", color: "#00d68f", label: "BUY" },
  SELL: { bg: "rgba(255, 77, 77, 0.15)", color: "#ff4d4d", label: "SELL" },
  HOLD: { bg: "rgba(161, 161, 170, 0.15)", color: "var(--text-tertiary)", label: "HOLD" },
};

export function DecisionCard({ decision }: Props) {
  const style = DECISION_STYLES[decision.decision] || DECISION_STYLES.HOLD;
  const confPct = Math.round(decision.confidence * 100);

  return (
    <div
      className="mx-3 mb-3 rounded-md p-3"
      style={{ background: style.bg, border: `1px solid ${style.color}44` }}
    >
      {/* Decision badge + confidence */}
      <div className="flex items-center gap-3 mb-2">
        <span
          className="rounded px-3 py-1 text-sm font-bold uppercase tracking-wider"
          style={{ background: style.color, color: "#000" }}
        >
          {style.label}
        </span>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[8px] font-semibold uppercase" style={{ color: "var(--text-muted)" }}>
              Confidence
            </span>
            <span className="text-[10px] font-bold font-mono" style={{ color: style.color }}>
              {confPct}%
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${confPct}%`, background: style.color }}
            />
          </div>
        </div>
      </div>

      {/* Reasoning */}
      <p className="text-[10px] leading-relaxed mb-2" style={{ color: "var(--text-secondary)" }}>
        {decision.reasoning}
      </p>

      {/* Price levels */}
      {(decision.suggestedEntry || decision.suggestedStop || decision.suggestedTarget) && (
        <div
          className="grid grid-cols-3 gap-2 rounded p-2 text-[9px] font-mono"
          style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)" }}
        >
          {decision.suggestedEntry != null && (
            <div>
              <div className="uppercase text-[7px] font-semibold" style={{ color: "var(--text-muted)" }}>Entry</div>
              <div style={{ color: "var(--text-primary)" }}>${decision.suggestedEntry.toFixed(2)}</div>
            </div>
          )}
          {decision.suggestedStop != null && (
            <div>
              <div className="uppercase text-[7px] font-semibold" style={{ color: "var(--text-muted)" }}>Stop</div>
              <div style={{ color: "#ff4d4d" }}>${decision.suggestedStop.toFixed(2)}</div>
            </div>
          )}
          {decision.suggestedTarget != null && (
            <div>
              <div className="uppercase text-[7px] font-semibold" style={{ color: "var(--text-muted)" }}>Target</div>
              <div style={{ color: "#00d68f" }}>${decision.suggestedTarget.toFixed(2)}</div>
            </div>
          )}
        </div>
      )}

      {/* Position size */}
      {decision.positionSizePct != null && decision.positionSizePct > 0 && (
        <div className="mt-1.5 text-[9px]" style={{ color: "var(--text-muted)" }}>
          Suggested position: <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>{decision.positionSizePct}%</span> of capital
        </div>
      )}
    </div>
  );
}
