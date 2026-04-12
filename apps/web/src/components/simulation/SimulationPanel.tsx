"use client";

import { useRef } from "react";
import { useStore } from "@/store/useStore";
import { DecisionCard } from "./DecisionCard";

export function SimulationPanel() {
  const activeDataset = useStore((s) => s.activeDataset);
  const debate = useStore((s) => s.currentDebate);
  const loading = useStore((s) => s.simulationLoading);
  const runDebate = useStore((s) => s.runDebate);
  const resetSimulation = useStore((s) => s.resetSimulation);
  const report = useStore((s) => s.simulationReport);
  const setReport = useStore((s) => s.setSimulationReport);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setReport(text);
  };

  const statusLabel: Record<string, string> = {
    idle: "Ready",
    classifying: "Classifying asset...",
    generating_entities: "Generating personas...",
    discussing: `Discussion — Round ${debate?.currentRound || 0}/${debate?.totalRounds || 5}`,
    summarizing: "Summarizing debate...",
    complete: "Complete",
    error: "Error",
  };

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
            Multi-Agent Debate
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

      {/* Report Upload */}
      <div className="px-3 py-2 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="text-[9px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>
          Research Report (optional)
        </div>
        {report ? (
          <div className="flex items-center gap-2">
            <div
              className="flex-1 rounded px-2 py-1.5 text-[10px] line-clamp-2"
              style={{ background: "var(--surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
            >
              {report.slice(0, 120)}...
            </div>
            <button
              onClick={() => setReport("")}
              className="text-[9px] font-semibold px-1.5 py-1 rounded"
              style={{ color: "var(--danger)" }}
            >
              Remove
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full rounded py-2 text-[10px] font-semibold border-dashed border-2 transition-colors hover:border-[var(--accent)]"
            style={{ borderColor: "var(--border)", color: "var(--text-tertiary)", background: "var(--surface-2)" }}
          >
            Upload Report (.txt, .md, .pdf)
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.md,.csv,.pdf"
          onChange={handleFileUpload}
          className="hidden"
        />
        <p className="text-[8px] mt-1" style={{ color: "var(--text-muted)" }}>
          Agents will use this report to create specialized analysis personas.
        </p>
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

      {/* Status + Entity List */}
      <div className="flex-1 overflow-y-auto py-1">
        {!debate && !loading && (
          <div className="flex items-center justify-center h-full text-[10px]" style={{ color: "var(--text-tertiary)" }}>
            <div className="text-center space-y-2 px-6">
              <div className="text-2xl">🏛</div>
              <p>Run a simulation to see 20-30 AI entities debate.</p>
              <p className="text-[9px]" style={{ color: "var(--text-muted)" }}>
                Upload a report for specialized personas, or run with just OHLC data.
              </p>
            </div>
          </div>
        )}

        {debate && (
          <>
            {/* Status bar */}
            <div className="mx-3 my-1.5 rounded px-2.5 py-1.5 text-[10px] font-semibold"
              style={{
                background: debate.status === "complete" ? "rgba(0,214,143,0.1)" : "rgba(255,107,0,0.1)",
                color: debate.status === "complete" ? "#00d68f" : debate.status === "error" ? "#ff4d4d" : "#ff6b00",
                border: `1px solid ${debate.status === "complete" ? "#00d68f33" : "#ff6b0033"}`,
              }}
            >
              {statusLabel[debate.status] || debate.status}
              {debate.assetName && debate.assetName !== debate.symbol && (
                <span className="ml-2 font-normal" style={{ color: "var(--text-tertiary)" }}>
                  {debate.assetName} ({debate.assetClass})
                </span>
              )}
            </div>

            {/* Entity grid */}
            {debate.entities.length > 0 && (
              <div className="mx-3 my-1.5">
                <div className="text-[8px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
                  Entities ({debate.entities.length})
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {debate.entities.map((e) => {
                    const msgs = debate.thread.filter((m) => m.entityId === e.id);
                    const biasColor = e.bias?.includes("bull") ? "#00d68f" : e.bias?.includes("bear") ? "#ff4d4d" : "#71717a";
                    return (
                      <div key={e.id} className="rounded px-1.5 py-1 text-[8px]"
                        style={{ background: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}>
                        <div className="font-bold truncate" style={{ color: "var(--text-primary)" }}>{e.name}</div>
                        <div className="truncate" style={{ color: "var(--text-tertiary)" }}>{e.role}</div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: biasColor }} />
                          <span style={{ color: biasColor }}>{e.bias?.replace("_", " ")}</span>
                          {msgs.length > 0 && <span className="ml-auto font-mono" style={{ color: "var(--text-muted)" }}>{msgs.length}x</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Summary Card (sticky bottom) */}
      {debate?.summary && (
        <div className="shrink-0">
          <DecisionCard summary={debate.summary} />
        </div>
      )}

      {/* Error state */}
      {debate?.status === "error" && (
        <div className="mx-3 mb-3 rounded-md p-3 text-[10px]" style={{ background: "rgba(255,77,77,0.1)", color: "#ff4d4d", border: "1px solid rgba(255,77,77,0.3)" }}>
          {debate.error || "Unknown error"}
        </div>
      )}
    </div>
  );
}
