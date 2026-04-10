"use client";

import { useStore } from "@/store/useStore";

interface TopBarProps {
  onToggleSidebar?: () => void;
  sidebarCollapsed?: boolean;
}

export function TopBar({ onToggleSidebar, sidebarCollapsed }: TopBarProps) {
  const darkMode = useStore((s) => s.darkMode);
  const toggleDarkMode = useStore((s) => s.toggleDarkMode);
  const appMode = useStore((s) => s.appMode);
  const setAppMode = useStore((s) => s.setAppMode);

  return (
    <div
      className="flex items-center gap-3 border-b px-4 h-11 shrink-0"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      {/* Brand lockup */}
      <div className="flex items-center gap-2 shrink-0">
        <div
          className="flex h-6 w-6 items-center justify-center rounded"
          style={{ background: "var(--accent)" }}
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 17l6-6 4 4 8-8" />
          </svg>
        </div>
        <h1
          className="text-[13px] font-bold tracking-tight whitespace-nowrap"
          style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}
        >
          VIBE <span style={{ color: "var(--accent)" }}>TRADE</span>
        </h1>
      </div>

      {/* Divider */}
      <div className="h-5 w-px shrink-0" style={{ background: "var(--border)" }} />

      {/* App Mode Segmented Control */}
      <div
        className="flex items-center rounded-md p-[3px] shrink-0"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
      >
        {(["building", "playground"] as const).map((m) => {
          const active = appMode === m;
          return (
            <button
              key={m}
              onClick={() => setAppMode(m)}
              className="rounded px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-all"
              style={{
                background: active ? "var(--accent)" : "transparent",
                color: active ? "#000" : "var(--text-tertiary)",
                letterSpacing: "0.08em",
              }}
            >
              {m}
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-w-0" />

      {/* Right cluster */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Dark/Light mode toggle */}
        <button
          onClick={toggleDarkMode}
          className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-[var(--surface-2)]"
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

        {/* Sidebar toggle */}
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-[var(--surface-2)]"
            style={{ color: sidebarCollapsed ? "var(--text-tertiary)" : "var(--accent)" }}
            title={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <line x1="15" y1="4" x2="15" y2="20" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
