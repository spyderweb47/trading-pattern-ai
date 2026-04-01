"use client";

import type { DrawingPhase } from "@/lib/chart-primitives/patternSelectorTypes";

interface Props {
  drawingPhase: DrawingPhase;
  hasSelection: boolean;
  onStartDrawing: () => void;
  onClear: () => void;
  onSendToChat: () => void;
}

const phaseText: Record<DrawingPhase, string> = {
  idle: "",
  trigger: "Click and drag to draw trigger box",
  trade: "Now drag to draw the trade box",
};

export function PatternSelectorToolbar({
  drawingPhase,
  hasSelection,
  onStartDrawing,
  onClear,
  onSendToChat,
}: Props) {
  return (
    <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5">
      {drawingPhase === "idle" && !hasSelection && (
        <button
          onClick={onStartDrawing}
          className="rounded bg-white/90 border border-slate-200 px-2.5 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 shadow-sm backdrop-blur-sm"
        >
          Draw Pattern
        </button>
      )}

      {drawingPhase !== "idle" && (
        <div className="rounded bg-blue-50/90 border border-blue-200 px-2.5 py-1 text-[10px] font-medium text-blue-600 shadow-sm backdrop-blur-sm">
          {phaseText[drawingPhase]}
        </div>
      )}

      {hasSelection && drawingPhase === "idle" && (
        <>
          <button
            onClick={onSendToChat}
            className="rounded bg-slate-900 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-slate-800 shadow-sm"
          >
            Send to Agent
          </button>
          <button
            onClick={onClear}
            className="rounded bg-white/90 border border-slate-200 px-2.5 py-1 text-[10px] font-semibold text-slate-400 hover:text-red-500 shadow-sm backdrop-blur-sm"
          >
            Clear
          </button>
        </>
      )}
    </div>
  );
}
