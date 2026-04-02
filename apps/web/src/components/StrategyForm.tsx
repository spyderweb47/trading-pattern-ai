"use client";

import { useState } from "react";
import type { StrategyConfig } from "@/types";

interface Props {
  onSubmit: (config: StrategyConfig) => void;
  loading: boolean;
  initialConfig?: Partial<StrategyConfig>;
}

const DEFAULT_CONFIG: StrategyConfig = {
  entryCondition: "",
  exitCondition: "",
  takeProfit: { type: "percentage", value: 5 },
  stopLoss: { type: "percentage", value: 2 },
  maxDrawdown: 20,
  seedAmount: 10000,
  specialInstructions: "",
};

export function StrategyForm({ onSubmit, loading, initialConfig }: Props) {
  const [config, setConfig] = useState<StrategyConfig>({
    ...DEFAULT_CONFIG,
    ...initialConfig,
  });
  const [expanded, setExpanded] = useState(true);

  const isValid = config.entryCondition.trim() && config.exitCondition.trim();

  const update = (partial: Partial<StrategyConfig>) =>
    setConfig((prev) => ({ ...prev, ...partial }));

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--surface-2)" }}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-3 py-2"
        style={{ background: "var(--surface-2)" }}
      >
        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--accent)" }}>
          Strategy Builder
        </span>
        <svg
          className={`h-3 w-3 transition-transform ${expanded ? "" : "-rotate-90"}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          style={{ color: "var(--text-muted)" }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2.5">
          {/* Entry Condition */}
          <Field label="Entry Condition" required>
            <textarea
              value={config.entryCondition}
              onChange={(e) => update({ entryCondition: e.target.value })}
              placeholder="e.g., RSI < 30 and price crosses above SMA 20"
              rows={2}
              className="w-full rounded px-2 py-1.5 text-[11px] resize-none outline-none"
              style={{ background: "var(--surface)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
            />
          </Field>

          {/* Exit Condition */}
          <Field label="Exit Condition" required>
            <textarea
              value={config.exitCondition}
              onChange={(e) => update({ exitCondition: e.target.value })}
              placeholder="e.g., RSI > 70 or opposite signal"
              rows={2}
              className="w-full rounded px-2 py-1.5 text-[11px] resize-none outline-none"
              style={{ background: "var(--surface)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
            />
          </Field>

          {/* TP / SL row */}
          <div className="flex gap-2">
            <Field label="Take Profit" required className="flex-1">
              <div className="flex gap-1">
                <input
                  type="number"
                  value={config.takeProfit.value}
                  onChange={(e) => update({ takeProfit: { ...config.takeProfit, value: parseFloat(e.target.value) || 0 } })}
                  className="flex-1 rounded px-2 py-1 text-[11px] outline-none w-16"
                  style={{ background: "var(--surface)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                />
                <select
                  value={config.takeProfit.type}
                  onChange={(e) => update({ takeProfit: { ...config.takeProfit, type: e.target.value as "percentage" | "fixed" } })}
                  className="rounded px-1 py-1 text-[10px] outline-none"
                  style={{ background: "var(--surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                >
                  <option value="percentage">%</option>
                  <option value="fixed">$</option>
                </select>
              </div>
            </Field>

            <Field label="Stop Loss" required className="flex-1">
              <div className="flex gap-1">
                <input
                  type="number"
                  value={config.stopLoss.value}
                  onChange={(e) => update({ stopLoss: { ...config.stopLoss, value: parseFloat(e.target.value) || 0 } })}
                  className="flex-1 rounded px-2 py-1 text-[11px] outline-none w-16"
                  style={{ background: "var(--surface)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                />
                <select
                  value={config.stopLoss.type}
                  onChange={(e) => update({ stopLoss: { ...config.stopLoss, type: e.target.value as "percentage" | "trailing" } })}
                  className="rounded px-1 py-1 text-[10px] outline-none"
                  style={{ background: "var(--surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                >
                  <option value="percentage">%</option>
                  <option value="trailing">Trail</option>
                </select>
              </div>
            </Field>
          </div>

          {/* Max Drawdown / Seed row */}
          <div className="flex gap-2">
            <Field label="Max Drawdown %" required className="flex-1">
              <input
                type="number"
                value={config.maxDrawdown}
                onChange={(e) => update({ maxDrawdown: parseFloat(e.target.value) || 0 })}
                className="w-full rounded px-2 py-1 text-[11px] outline-none"
                style={{ background: "var(--surface)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              />
            </Field>

            <Field label="Seed Amount $" required className="flex-1">
              <input
                type="number"
                value={config.seedAmount}
                onChange={(e) => update({ seedAmount: parseFloat(e.target.value) || 10000 })}
                className="w-full rounded px-2 py-1 text-[11px] outline-none"
                style={{ background: "var(--surface)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              />
            </Field>
          </div>

          {/* Special Instructions */}
          <Field label="Special Instructions" className="opacity-80">
            <textarea
              value={config.specialInstructions}
              onChange={(e) => update({ specialInstructions: e.target.value })}
              placeholder="Optional: time filters, position sizing rules, etc."
              rows={2}
              className="w-full rounded px-2 py-1.5 text-[11px] resize-none outline-none"
              style={{ background: "var(--surface)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
            />
          </Field>

          {/* Submit */}
          <button
            onClick={() => isValid && onSubmit(config)}
            disabled={!isValid || loading}
            className="w-full rounded py-2 text-[11px] font-semibold transition-colors disabled:opacity-40"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            {loading ? "Generating & Running..." : "Generate & Run Strategy"}
          </button>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="text-[9px] font-semibold uppercase tracking-wider mb-0.5 block" style={{ color: "var(--text-tertiary)" }}>
        {label}
        {required && <span style={{ color: "var(--danger)" }}> *</span>}
      </label>
      {children}
    </div>
  );
}
