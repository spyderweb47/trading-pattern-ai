"use client";

import { useState } from "react";
import { useStore } from "@/store/useStore";
import { FileUpload } from "./FileUpload";

function Section({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-slate-100">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-600"
      >
        {title}
        <svg
          className={`h-3 w-3 transition-transform ${open ? "rotate-0" : "-rotate-90"}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

export function LeftSidebar() {
  const datasets = useStore((s) => s.datasets);
  const activeDataset = useStore((s) => s.activeDataset);
  const setActiveDataset = useStore((s) => s.setActiveDataset);
  const scripts = useStore((s) => s.scripts);
  const indicators = useStore((s) => s.indicators);
  const toggleIndicator = useStore((s) => s.toggleIndicator);
  const [showUpload, setShowUpload] = useState(false);

  return (
    <div className="flex w-60 flex-col border-r border-slate-200 bg-slate-50">
      {/* Header */}
      <div className="border-b border-slate-200 px-3 py-3">
        <h1 className="text-sm font-bold tracking-tight text-slate-900">
          Trading Pattern AI
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Datasets */}
        <Section title="Datasets">
          {datasets.length === 0 ? (
            <p className="text-xs text-slate-400">No datasets loaded</p>
          ) : (
            <ul className="space-y-1">
              {datasets.map((ds) => (
                <li key={ds.id}>
                  <button
                    onClick={() => setActiveDataset(ds.id)}
                    className={`w-full rounded px-2 py-1.5 text-left text-xs transition-colors ${
                      activeDataset === ds.id
                        ? "bg-slate-200 text-slate-900"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <div className="font-medium">{ds.name}</div>
                    <div className="text-slate-400">
                      {ds.metadata.rows.toLocaleString()} bars
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="mt-2 w-full rounded border border-dashed border-slate-300 px-2 py-1.5 text-xs text-slate-400 hover:border-slate-400 hover:text-slate-600"
          >
            + Upload CSV
          </button>
          {showUpload && (
            <div className="mt-2">
              <FileUpload />
            </div>
          )}
        </Section>

        {/* Scripts */}
        <Section title="Scripts">
          {scripts.length === 0 ? (
            <p className="text-xs text-slate-400">No saved scripts</p>
          ) : (
            <ul className="space-y-1">
              {scripts.map((script) => (
                <li key={script.id}>
                  <button className="w-full rounded px-2 py-1 text-left text-xs text-slate-600 hover:bg-slate-100">
                    <div className="font-medium">{script.name}</div>
                    <div className="text-slate-400">{script.type}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Indicators */}
        <Section title="Indicators">
          <ul className="space-y-1.5">
            {indicators.map((ind) => (
              <li key={ind.name} className="flex items-center gap-2">
                <button
                  onClick={() => toggleIndicator(ind.name)}
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                    ind.active
                      ? "border-slate-900 bg-slate-900"
                      : "border-slate-300 bg-white"
                  }`}
                >
                  {ind.active && (
                    <svg
                      className="h-3 w-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </button>
                <span className="text-xs text-slate-600">{ind.name}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}
