"use client";

import { useStore } from "@/store/useStore";

const REASON_STYLES: Record<string, { label: string; bg: string; color: string }> = {
  manual: { label: "MANUAL", bg: "rgba(100,116,139,0.2)", color: "var(--text-secondary)" },
  tp: { label: "TP", bg: "rgba(38,166,154,0.2)", color: "var(--success)" },
  sl: { label: "SL", bg: "rgba(239,83,80,0.2)", color: "var(--danger)" },
  liquidation: { label: "LIQ", bg: "rgba(239,83,80,0.4)", color: "#fff" },
};

export function TradeHistoryTab() {
  const trades = useStore((s) => s.closedTrades);

  if (trades.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs" style={{ color: "var(--text-tertiary)" }}>
        No trades yet
      </div>
    );
  }

  const sorted = [...trades].sort((a, b) => b.exitTime - a.exitTime);

  return (
    <div className="overflow-auto h-full">
      <table className="w-full text-[10px]">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            <Th>Time</Th>
            <Th>Side</Th>
            <Th>Lev</Th>
            <Th>Size</Th>
            <Th>Entry</Th>
            <Th>Exit</Th>
            <Th align="right">PnL</Th>
            <Th align="right">%</Th>
            <Th align="right">Fees</Th>
            <Th>Reason</Th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) => {
            const rs = REASON_STYLES[t.exitReason] ?? REASON_STYLES.manual;
            const d = new Date(t.exitTime * 1000).toISOString().slice(5, 16).replace("T", " ");
            return (
              <tr key={t.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <td className="py-1.5 px-2 font-mono text-[9px]" style={{ color: "var(--text-muted)" }}>{d}</td>
                <td className="py-1.5 px-2">
                  <span
                    className="inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold"
                    style={{
                      background: t.side === "long" ? "rgba(38,166,154,0.15)" : "rgba(239,83,80,0.15)",
                      color: t.side === "long" ? "var(--success)" : "var(--danger)",
                    }}
                  >
                    {t.side.toUpperCase()}
                  </span>
                </td>
                <td className="py-1.5 px-2 font-mono" style={{ color: "var(--text-tertiary)" }}>{t.leverage}x</td>
                <td className="py-1.5 px-2 font-mono" style={{ color: "var(--text-secondary)" }}>${t.size.toFixed(0)}</td>
                <td className="py-1.5 px-2 font-mono" style={{ color: "var(--text-secondary)" }}>${t.entryPrice.toFixed(2)}</td>
                <td className="py-1.5 px-2 font-mono" style={{ color: "var(--text-secondary)" }}>${t.exitPrice.toFixed(2)}</td>
                <td
                  className="py-1.5 px-2 text-right font-mono font-semibold"
                  style={{ color: t.pnl >= 0 ? "var(--success)" : "var(--danger)" }}
                >
                  {t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}
                </td>
                <td
                  className="py-1.5 px-2 text-right font-mono"
                  style={{ color: t.pnlPct >= 0 ? "var(--success)" : "var(--danger)" }}
                >
                  {t.pnlPct >= 0 ? "+" : ""}{t.pnlPct.toFixed(2)}%
                </td>
                <td className="py-1.5 px-2 text-right font-mono text-[9px]" style={{ color: "var(--text-muted)" }}>
                  ${t.fees.toFixed(2)}
                </td>
                <td className="py-1.5 px-2">
                  <span
                    className="inline-block rounded px-1.5 py-0.5 text-[8px] font-bold"
                    style={{ background: rs.bg, color: rs.color }}
                  >
                    {rs.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: string }) {
  return (
    <th
      className={`py-1.5 px-2 font-semibold uppercase ${align === "right" ? "text-right" : "text-left"}`}
      style={{ color: "var(--text-muted)", fontSize: "8px" }}
    >
      {children}
    </th>
  );
}
