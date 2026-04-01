"use client";

import { useState } from "react";

export function SimulationControls() {
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [currentBar, setCurrentBar] = useState(0);
  const [totalBars] = useState(0);
  const [pnl] = useState(0);

  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-white">
      {/* Play/Pause */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setIsRunning(!isRunning)}
          className="flex h-8 w-8 items-center justify-center rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
        >
          {isRunning ? (
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          )}
        </button>

        {/* Speed */}
        <div className="flex items-center gap-1">
          {[1, 2, 5, 10].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`rounded px-2 py-1 text-[10px] font-medium transition-colors ${
                speed === s
                  ? "bg-slate-900 text-white"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Progress */}
      <div className="flex-1">
        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
          <span>
            Bar {currentBar} / {totalBars}
          </span>
          <span>
            {totalBars > 0 ? ((currentBar / totalBars) * 100).toFixed(0) : 0}%
          </span>
        </div>
        <div className="h-1 rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-slate-900 transition-all"
            style={{
              width: `${totalBars > 0 ? (currentBar / totalBars) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      {/* Live PnL */}
      <div className="text-right">
        <div className="text-[10px] text-slate-400 uppercase">PnL</div>
        <div
          className={`text-sm font-semibold ${
            pnl >= 0 ? "text-green-600" : "text-red-500"
          }`}
        >
          {pnl >= 0 ? "+" : ""}
          {pnl.toFixed(2)}
        </div>
      </div>
    </div>
  );
}
