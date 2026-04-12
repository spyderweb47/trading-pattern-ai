"use client";

import { useStore } from "@/store/useStore";
import { DAGFlowchart } from "./DAGFlowchart";
import { AgentCard } from "./AgentCard";
import { DecisionCard } from "./DecisionCard";
import type { AgentRole } from "@/types";

const AGENT_ORDER: AgentRole[] = ["bull", "bear", "risk", "pm"];

export function SimulationPanel() {
  const activeDataset = useStore((s) => s.activeDataset);
  const debate = useStore((s) => s.currentDebate);
  const loading = useStore((s) => s.simulationLoading);
  const runDebate = useStore((s) => s.runDebate);
  const resetSimulation = useStore((s) => s.resetSimulation);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex-1 min-w-0">
          <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--accent)", opacity: 0.6 }}>
            Simulation
          </div>
          <div className="text-[11px] font-semibold" style={{ color: "var(--text-primary)" }}>
            Committee Debate
          </div>
        </div>
        {debate && debate.status === "complete" && (
          <button
            onClick={resetSimulation}
            className="rounded px-2 py-1 text-[9px] font-semibold uppercase"
            style={{ background: "var(--surface-2)", color: "var(--text-tertiary)", border: "1px solid var(--border)" }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Run Button */}
      <div className="px-3 py-2.5 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
        <button
          onClick={runDebate}
          disabled={!activeDataset || loading}
          className="w-full rounded py-2 text-[11px] font-bold uppercase tracking-wide transition-opacity disabled:opacity-40"
          style={{ background: "var(--accent)", color: "#000" }}
        >
          {loading ? "Analyzing..." : debate?.status === "complete" ? "Run Again" : "Run Committee Debate"}
        </button>
        {!activeDataset && (
          <p className="text-[9px] mt-1 text-center" style={{ color: "var(--text-muted)" }}>
            Load a dataset first
          </p>
        )}
      </div>

      {/* DAG Visualization */}
      <DAGFlowchart debate={debate} />

      {/* Agent Cards (scrollable) */}
      <div className="flex-1 overflow-y-auto py-1">
        {!debate && !loading && (
          <div className="flex items-center justify-center h-full text-[10px]" style={{ color: "var(--text-tertiary)" }}>
            <div className="text-center space-y-2 px-6">
              <div className="text-2xl">🏛</div>
              <p>Run a committee debate to get a multi-agent trade recommendation.</p>
              <p className="text-[9px]" style={{ color: "var(--text-muted)" }}>
                4 AI agents (Bull, Bear, Risk, PM) will analyze your data and debate whether to BUY, SELL, or HOLD.
              </p>
            </div>
          </div>
        )}

        {debate && AGENT_ORDER.map((role) => (
          <AgentCard key={role} result={debate.agents[role]} />
        ))}
      </div>

      {/* Decision Card (sticky bottom) */}
      {debate?.decision && (
        <div className="shrink-0">
          <DecisionCard decision={debate.decision} />
        </div>
      )}

      {/* Error state */}
      {debate?.status === "error" && (
        <div className="mx-3 mb-3 rounded-md p-3 text-[10px]" style={{ background: "rgba(255,77,77,0.1)", color: "#ff4d4d", border: "1px solid rgba(255,77,77,0.3)" }}>
          Debate failed: {debate.error || "Unknown error"}
        </div>
      )}
    </div>
  );
}
