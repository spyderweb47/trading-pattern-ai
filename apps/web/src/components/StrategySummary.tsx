"use client";

import { useState } from "react";
import { useStore } from "@/store/useStore";

export function StrategySummary() {
  const draft = useStore((s) => s.strategyDraft);
  const updateDraft = useStore((s) => s.updateStrategyDraft);
  const clearDraft = useStore((s) => s.clearStrategyDraft);
  const [editingSL, setEditingSL] = useState(false);
  const [editingTP, setEditingTP] = useState(false);

  if (!draft || (draft.entryRules.length === 0 && !draft.script)) return null;

  const stateLabel: Record<string, string> = {
    needs_entry: "Defining entry...",
    needs_exit: "Defining exit...",
    needs_risk: "Setting risk...",
    complete: "Ready to backtest",
  };

  return (
    <div className="border-b border-slate-100 px-3 py-2 bg-slate-50/50">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Strategy
        </span>
        <div className="flex items-center gap-2">
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
            draft.state === "complete"
              ? "bg-emerald-100 text-emerald-600"
              : "bg-amber-100 text-amber-600"
          }`}>
            {stateLabel[draft.state] || draft.state}
          </span>
          <button
            onClick={clearDraft}
            className="text-slate-300 hover:text-red-400 text-xs"
          >
            &times;
          </button>
        </div>
      </div>

      {draft.entryRules.length > 0 && (
        <div className="mb-1">
          <span className="text-[9px] text-slate-400 uppercase">Entry: </span>
          <span className="text-[10px] text-slate-600">{draft.entryRules.join(", ")}</span>
        </div>
      )}

      {draft.exitRules.length > 0 && (
        <div className="mb-1">
          <span className="text-[9px] text-slate-400 uppercase">Exit: </span>
          <span className="text-[10px] text-slate-600">{draft.exitRules.join(", ")}</span>
        </div>
      )}

      <div className="flex gap-3 text-[10px]">
        {/* Stop Loss */}
        <div className="flex items-center gap-1">
          <span className="text-red-400 font-medium">SL:</span>
          {editingSL ? (
            <input
              type="number"
              defaultValue={draft.stopLoss ?? 2}
              onBlur={(e) => {
                updateDraft({ stopLoss: parseFloat(e.target.value) || null });
                setEditingSL(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              className="w-10 rounded border border-slate-200 px-1 py-0 text-[10px] outline-none"
              autoFocus
            />
          ) : (
            <button
              onClick={() => setEditingSL(true)}
              className="text-slate-600 hover:text-slate-900"
            >
              {draft.stopLoss ? `${draft.stopLoss}%` : "—"}
            </button>
          )}
        </div>

        {/* Take Profit */}
        <div className="flex items-center gap-1">
          <span className="text-emerald-500 font-medium">TP:</span>
          {editingTP ? (
            <input
              type="number"
              defaultValue={draft.takeProfit ?? 5}
              onBlur={(e) => {
                updateDraft({ takeProfit: parseFloat(e.target.value) || null });
                setEditingTP(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              className="w-10 rounded border border-slate-200 px-1 py-0 text-[10px] outline-none"
              autoFocus
            />
          ) : (
            <button
              onClick={() => setEditingTP(true)}
              className="text-slate-600 hover:text-slate-900"
            >
              {draft.takeProfit ? `${draft.takeProfit}%` : "—"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
