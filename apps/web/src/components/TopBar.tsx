"use client";

import { useStore, type Mode } from "@/store/useStore";

const modes: { key: Mode; label: string }[] = [
  { key: "pattern", label: "Pattern" },
  { key: "strategy", label: "Strategy" },
  { key: "backtest", label: "Backtest" },
];

export function TopBar() {
  const activeMode = useStore((s) => s.activeMode);
  const setMode = useStore((s) => s.setMode);

  return (
    <div className="flex items-center gap-4 border-b border-slate-200 bg-white px-4 py-2">
      <h1 className="text-sm font-bold tracking-tight text-slate-900 whitespace-nowrap">
        Trading Pattern AI
      </h1>
      <div className="flex rounded-lg border border-slate-200 p-0.5">
        {modes.map((mode) => (
          <button
            key={mode.key}
            onClick={() => setMode(mode.key)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              activeMode === mode.key
                ? "bg-slate-900 text-white"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {mode.label}
          </button>
        ))}
      </div>
    </div>
  );
}
