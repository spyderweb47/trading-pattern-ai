"use client";

import { useMemo } from "react";
import { useStore } from "@/store/useStore";

export function WalletTab() {
  const wallet = useStore((s) => s.demoWallet);
  const positions = useStore((s) => s.positions);
  const closedTrades = useStore((s) => s.closedTrades);
  const equityHistory = useStore((s) => s.walletEquityHistory);
  const resetWallet = useStore((s) => s.resetWallet);

  const marginUsed = positions.reduce((a, p) => a + p.margin, 0);
  const unrealized = positions.reduce((a, p) => a + p.unrealizedPnl, 0);
  const equity = wallet.balance + unrealized;
  const totalPnl = equity - wallet.initialBalance;
  const totalPnlPct = wallet.initialBalance > 0 ? (totalPnl / wallet.initialBalance) * 100 : 0;

  const wins = closedTrades.filter((t) => t.pnl > 0).length;
  const losses = closedTrades.filter((t) => t.pnl <= 0).length;
  const winRate = closedTrades.length > 0 ? (wins / closedTrades.length) * 100 : 0;
  const realizedPnl = closedTrades.reduce((a, t) => a + t.pnl, 0);
  const totalFees = closedTrades.reduce((a, t) => a + t.fees, 0);

  const sparklinePath = useMemo(() => {
    if (equityHistory.length < 2) return "";
    const values = equityHistory.map((e) => e.equity);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const w = 400, h = 60;
    return values
      .map((v, i) => {
        const x = (i / (values.length - 1)) * w;
        const y = h - ((v - min) / range) * h;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [equityHistory]);

  const equityColor = equity >= wallet.initialBalance ? "var(--success)" : "var(--danger)";

  return (
    <div className="overflow-auto h-full p-3 space-y-3">
      {/* Big Equity Display */}
      <div
        className="rounded-md p-4"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Account Equity
          </span>
          <button
            onClick={() => resetWallet()}
            className="text-[9px] font-semibold uppercase rounded px-2 py-1"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          >
            Reset to $10,000
          </button>
        </div>
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-bold font-mono" style={{ color: "var(--text-primary)" }}>
            ${equity.toFixed(2)}
          </span>
          <span className="text-sm font-mono font-semibold" style={{ color: equityColor }}>
            {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)} ({totalPnl >= 0 ? "+" : ""}{totalPnlPct.toFixed(2)}%)
          </span>
        </div>
      </div>

      {/* Equity Curve Sparkline */}
      {equityHistory.length > 1 && (
        <div
          className="rounded-md p-3"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
        >
          <div className="text-[9px] font-semibold uppercase mb-2" style={{ color: "var(--text-muted)" }}>
            Equity Curve
          </div>
          <svg viewBox="0 0 400 60" className="w-full h-14">
            <path d={sparklinePath} fill="none" stroke={equityColor} strokeWidth={1.5} />
          </svg>
        </div>
      )}

      {/* Metrics Grid */}
      <div
        className="rounded-md p-3"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
      >
        <div className="text-[9px] font-semibold uppercase mb-2" style={{ color: "var(--text-muted)" }}>
          Stats
        </div>
        <div className="grid grid-cols-3 gap-3 text-[10px]">
          <Stat label="Balance" value={`$${wallet.balance.toFixed(2)}`} />
          <Stat label="Margin Used" value={`$${marginUsed.toFixed(2)}`} />
          <Stat
            label="uPnL"
            value={`${unrealized >= 0 ? "+" : ""}$${unrealized.toFixed(2)}`}
            color={unrealized >= 0 ? "var(--success)" : "var(--danger)"}
          />
          <Stat
            label="Realized PnL"
            value={`${realizedPnl >= 0 ? "+" : ""}$${realizedPnl.toFixed(2)}`}
            color={realizedPnl >= 0 ? "var(--success)" : "var(--danger)"}
          />
          <Stat label="Total Fees" value={`$${totalFees.toFixed(2)}`} />
          <Stat label="Trades" value={`${closedTrades.length}`} />
          <Stat label="Wins" value={`${wins}`} color="var(--success)" />
          <Stat label="Losses" value={`${losses}`} color="var(--danger)" />
          <Stat label="Win Rate" value={`${winRate.toFixed(1)}%`} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="text-[8px] uppercase mb-0.5" style={{ color: "var(--text-muted)" }}>{label}</div>
      <div className="font-mono font-semibold" style={{ color: color ?? "var(--text-primary)" }}>{value}</div>
    </div>
  );
}
