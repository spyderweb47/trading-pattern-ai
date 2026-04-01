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
  const darkMode = useStore((s) => s.darkMode);
  const toggleDarkMode = useStore((s) => s.toggleDarkMode);

  return (
    <div className="flex items-center gap-4 border-b px-4 py-2" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <h1 className="text-sm font-bold tracking-tight whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
        Trading Pattern AI
      </h1>
      <div className="flex rounded-lg p-0.5" style={{ border: "1px solid var(--border)" }}>
        {modes.map((mode) => (
          <button
            key={mode.key}
            onClick={() => setMode(mode.key)}
            className={`rounded-md px-4 py-1.5 text-[13px] font-medium transition-colors ${
              activeMode === mode.key
                ? "text-white"
                : "hover:opacity-80"
            }`}
            style={{
              background: activeMode === mode.key ? "var(--accent)" : "transparent",
              color: activeMode === mode.key ? "#fff" : "var(--text-secondary)",
            }}
          >
            {mode.label}
          </button>
        ))}
      </div>

      <div className="flex-1" />

      {/* Dark/Light mode toggle */}
      <button
        onClick={toggleDarkMode}
        className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:opacity-80"
        style={{ color: "var(--text-tertiary)" }}
        title={darkMode ? "Light mode" : "Dark mode"}
      >
        {darkMode ? (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="5" />
            <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.73 12.73l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
        ) : (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
          </svg>
        )}
      </button>
    </div>
  );
}
