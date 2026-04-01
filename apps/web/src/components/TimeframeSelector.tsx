"use client";

import { useStore } from "@/store/useStore";
import { AVAILABLE_TIMEFRAMES, detectTimeframe } from "@/lib/csv/resampleOHLC";

export function TimeframeSelector() {
  const activeDataset = useStore((s) => s.activeDataset);
  const datasets = useStore((s) => s.datasets);
  const datasetRawData = useStore((s) => s.datasetRawData);
  const selectedTimeframe = useStore((s) => s.selectedTimeframe);
  const setSelectedTimeframe = useStore((s) => s.setSelectedTimeframe);

  const ds = datasets.find((d) => d.id === activeDataset);
  if (!ds || !activeDataset) return null;

  const nativeLabel = ds.metadata.nativeTimeframe || "?";
  const rawData = datasetRawData[activeDataset];
  const nativeSec = rawData ? detectTimeframe(rawData).seconds : 0;

  // Filter timeframes: only show ones >= native timeframe
  const available = AVAILABLE_TIMEFRAMES.filter((tf) => {
    const entry = [
      ["1min", 60], ["5min", 300], ["15min", 900], ["30min", 1800],
      ["1h", 3600], ["2h", 7200], ["4h", 14400], ["12h", 43200],
      ["1D", 86400], ["1W", 604800],
    ].find(([l]) => l === tf);
    if (!entry) return false;
    return (entry[1] as number) >= nativeSec * 0.8; // allow native + bigger
  });

  // Current active timeframe
  const active = selectedTimeframe || ds.metadata.chartTimeframe || "auto";

  return (
    <div className="flex items-center gap-0.5 px-2 py-1" style={{ borderBottom: "1px solid var(--border-subtle)", background: "var(--surface)" }}>
      {/* Auto button */}
      <button
        onClick={() => setSelectedTimeframe(null)}
        className="rounded px-2 py-0.5 text-[10px] font-medium transition-colors"
        style={{
          background: selectedTimeframe === null ? "var(--accent)" : "transparent",
          color: selectedTimeframe === null ? "#fff" : "var(--text-tertiary)",
        }}
      >
        Auto
      </button>

      <div className="w-px h-3 mx-0.5" style={{ background: "var(--border)" }} />

      {available.map((tf) => (
        <button
          key={tf}
          onClick={() => setSelectedTimeframe(tf)}
          className="rounded px-2 py-0.5 text-[10px] font-medium transition-colors"
          style={{
            background: selectedTimeframe === tf ? "var(--accent)" : "transparent",
            color: selectedTimeframe === tf ? "#fff" : tf === nativeLabel ? "var(--text-primary)" : "var(--text-tertiary)",
            fontWeight: tf === nativeLabel ? 600 : 500,
          }}
        >
          {tf}
        </button>
      ))}
    </div>
  );
}
