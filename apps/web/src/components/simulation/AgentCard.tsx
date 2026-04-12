"use client";

import { useState } from "react";
import type { AgentResult } from "@/types";

interface Props {
  result: AgentResult;
}

const ROLE_ICONS: Record<string, string> = {
  bull: "📈",
  bear: "📉",
  risk: "🛡",
  pm: "👔",
};

const ROLE_COLORS: Record<string, { bg: string; border: string }> = {
  bull: { bg: "rgba(0, 214, 143, 0.1)", border: "rgba(0, 214, 143, 0.4)" },
  bear: { bg: "rgba(255, 77, 77, 0.1)", border: "rgba(255, 77, 77, 0.4)" },
  risk: { bg: "rgba(255, 176, 32, 0.1)", border: "rgba(255, 176, 32, 0.4)" },
  pm: { bg: "rgba(255, 107, 0, 0.1)", border: "rgba(255, 107, 0, 0.4)" },
};

function sentimentBadge(sentiment: number) {
  const abs = Math.abs(sentiment);
  const label = abs > 0.6 ? "Strong" : abs > 0.3 ? "Moderate" : "Neutral";
  const color = sentiment > 0.1 ? "#00d68f" : sentiment < -0.1 ? "#ff4d4d" : "var(--text-tertiary)";
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[8px] font-bold uppercase"
      style={{ background: `${color}22`, color }}
    >
      {label} {sentiment > 0 ? "+" : ""}{(sentiment * 100).toFixed(0)}%
    </span>
  );
}

export function AgentCard({ result }: Props) {
  const [expanded, setExpanded] = useState(result.status === "done");
  const colors = ROLE_COLORS[result.role] || ROLE_COLORS.pm;
  const icon = ROLE_ICONS[result.role] || "🤖";

  if (result.status === "pending") {
    return (
      <div
        className="mx-3 my-1.5 rounded-md p-2.5 opacity-40"
        style={{ background: "var(--surface-2)", border: `1px solid var(--border)` }}
      >
        <div className="flex items-center gap-2 text-[10px]" style={{ color: "var(--text-tertiary)" }}>
          <span>{icon}</span>
          <span className="font-semibold uppercase tracking-wide">{result.label}</span>
          <span className="ml-auto text-[8px]">Waiting...</span>
        </div>
      </div>
    );
  }

  if (result.status === "running") {
    return (
      <div
        className="mx-3 my-1.5 rounded-md p-2.5 animate-pulse"
        style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
      >
        <div className="flex items-center gap-2 text-[10px]" style={{ color: "var(--text-secondary)" }}>
          <span>{icon}</span>
          <span className="font-semibold uppercase tracking-wide">{result.label}</span>
          <span className="ml-auto text-[8px]" style={{ color: "var(--accent)" }}>Analyzing...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="mx-3 my-1.5 rounded-md overflow-hidden transition-all"
      style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 p-2.5 text-left"
      >
        <span className="text-sm">{icon}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
          {result.label}
        </span>
        {sentimentBadge(result.sentiment)}
        <svg
          className={`ml-auto h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          style={{ color: "var(--text-tertiary)" }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Body */}
      {expanded && (
        <div className="px-2.5 pb-2.5 space-y-2">
          {/* Argument */}
          <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {result.argument}
          </p>

          {/* Key Points */}
          {result.keyPoints.length > 0 && (
            <ul className="space-y-0.5">
              {result.keyPoints.map((p, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[10px]" style={{ color: "var(--text-secondary)" }}>
                  <span style={{ color: "var(--accent)" }}>•</span>
                  {p}
                </li>
              ))}
            </ul>
          )}

          {/* Signal Chips */}
          {result.signals.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {result.signals.map((s, i) => (
                <span
                  key={i}
                  className="rounded px-1.5 py-0.5 text-[8px] font-semibold"
                  style={{ background: "var(--surface-2)", color: "var(--text-tertiary)", border: "1px solid var(--border)" }}
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
