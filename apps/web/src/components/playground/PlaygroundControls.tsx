"use client";

import { useStore } from "@/store/useStore";

const SPEEDS = [0.5, 1, 2, 5, 10, 1000] as const;
const SPEED_LABELS: Record<number, string> = { 0.5: "0.5x", 1: "1x", 2: "2x", 5: "5x", 10: "10x", 1000: "Max" };

export function PlaygroundControls() {
  const replay = useStore((s) => s.playgroundReplay);
  const setPlaying = useStore((s) => s.setReplayPlaying);
  const setSpeed = useStore((s) => s.setReplaySpeed);
  const setBarIndex = useStore((s) => s.setReplayBarIndex);
  const resetReplay = useStore((s) => s.resetReplay);
  const resetWallet = useStore((s) => s.resetWallet);
  const clearWalletEquityHistory = useStore((s) => s.clearWalletEquityHistory);
  const activeId = useStore((s) => s.activeDataset);
  const chartData = useStore((s) => (activeId ? s.datasetChartData[activeId] : null));

  const total = replay.totalBars;
  const idx = replay.currentBarIndex;
  const currentBar = chartData && chartData[idx];
  const timeStr = currentBar
    ? new Date((typeof currentBar.time === "string" ? Number(currentBar.time) : currentBar.time) * 1000)
        .toISOString()
        .slice(0, 16)
        .replace("T", " ")
    : "—";

  const handleStep = () => {
    if (idx < total - 1) setBarIndex(idx + 1);
  };

  const handleRestart = () => {
    resetReplay();
    resetWallet();
    clearWalletEquityHistory();
  };

  if (total === 0) {
    return (
      <div
        className="flex items-center gap-3 border-b px-3 py-1.5 text-[10px]"
        style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-muted)" }}
      >
        Load a dataset to begin replay.
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-3 border-b px-3 py-1.5"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      {/* Play/Pause */}
      <button
        onClick={() => setPlaying(!replay.isPlaying)}
        className="flex h-6 w-6 items-center justify-center rounded transition-colors"
        style={{
          background: replay.isPlaying ? "var(--danger)" : "var(--success)",
          color: "#fff",
        }}
        title={replay.isPlaying ? "Pause" : "Play"}
      >
        {replay.isPlaying ? (
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="5" width="4" height="14" />
            <rect x="14" y="5" width="4" height="14" />
          </svg>
        ) : (
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Step Forward */}
      <button
        onClick={handleStep}
        disabled={replay.isPlaying || idx >= total - 1}
        className="flex h-6 w-6 items-center justify-center rounded border transition-colors disabled:opacity-40"
        style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        title="Step forward"
      >
        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
        </svg>
      </button>

      {/* Restart */}
      <button
        onClick={handleRestart}
        className="flex h-6 items-center rounded border px-2 text-[10px] font-semibold uppercase tracking-wide transition-colors"
        style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        title="Restart replay + reset wallet"
      >
        Reset
      </button>

      {/* Speed Selector */}
      <div className="flex items-center gap-1">
        <span className="text-[9px] font-semibold uppercase" style={{ color: "var(--text-muted)" }}>
          Speed
        </span>
        <div className="flex rounded overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {SPEEDS.map((s) => {
            const active = replay.speed === s;
            return (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className="px-1.5 py-0.5 text-[9px] font-semibold transition-colors"
                style={{
                  background: active ? "var(--accent)" : "transparent",
                  color: active ? "#fff" : "var(--text-tertiary)",
                }}
              >
                {SPEED_LABELS[s]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrubber */}
      <div className="flex flex-1 items-center gap-2">
        <span className="text-[9px] font-mono" style={{ color: "var(--text-muted)" }}>
          {idx}/{total - 1}
        </span>
        <input
          type="range"
          min={0}
          max={Math.max(0, total - 1)}
          value={idx}
          onChange={(e) => setBarIndex(Number(e.target.value))}
          className="flex-1 h-1 cursor-pointer"
          style={{ accentColor: "var(--accent)" }}
        />
      </div>

      {/* Current Time */}
      <span className="text-[10px] font-mono" style={{ color: "var(--text-secondary)" }}>
        {timeStr}
      </span>
    </div>
  );
}
