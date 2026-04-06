"use client";

import { useStore } from "@/store/useStore";
import { closePositionManual } from "@/lib/playground/replayEngine";

export function PositionsTab() {
  const positions = useStore((s) => s.positions);
  const activeId = useStore((s) => s.activeDataset);
  const chartData = useStore((s) => (activeId ? s.datasetChartData[activeId] : null));
  const idx = useStore((s) => s.playgroundReplay.currentBarIndex);
  const removePosition = useStore((s) => s.removePosition);
  const addClosedTrade = useStore((s) => s.addClosedTrade);
  const adjustWalletBalance = useStore((s) => s.adjustWalletBalance);
  const updatePosition = useStore((s) => s.updatePosition);

  const bar = chartData?.[idx];
  const currentPrice = bar?.close ?? 0;

  const closePos = (posId: string) => {
    const pos = positions.find((p) => p.id === posId);
    if (!pos || !bar) return;
    const barTime = typeof bar.time === "string" ? Number(bar.time) : bar.time;
    const trade = closePositionManual(pos, currentPrice, barTime);
    addClosedTrade(trade);
    adjustWalletBalance(pos.margin + trade.pnl - trade.fees);
    removePosition(posId);
  };

  if (positions.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs" style={{ color: "var(--text-tertiary)" }}>
        No open positions
      </div>
    );
  }

  return (
    <div className="overflow-auto h-full">
      <table className="w-full text-[10px]">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            <Th>Side</Th>
            <Th>Size</Th>
            <Th>Lev</Th>
            <Th>Entry</Th>
            <Th>Mark</Th>
            <Th>Liq</Th>
            <Th>TP</Th>
            <Th>SL</Th>
            <Th align="right">uPnL</Th>
            <Th align="right">%</Th>
            <Th>Action</Th>
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => (
            <tr key={p.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <td className="py-1.5 px-2">
                <span
                  className="inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold"
                  style={{
                    background: p.side === "long" ? "rgba(38,166,154,0.15)" : "rgba(239,83,80,0.15)",
                    color: p.side === "long" ? "var(--success)" : "var(--danger)",
                  }}
                >
                  {p.side.toUpperCase()}
                </span>
              </td>
              <td className="py-1.5 px-2 font-mono" style={{ color: "var(--text-secondary)" }}>${p.size.toFixed(0)}</td>
              <td className="py-1.5 px-2 font-mono" style={{ color: "var(--text-tertiary)" }}>{p.leverage}x</td>
              <td className="py-1.5 px-2 font-mono" style={{ color: "var(--text-secondary)" }}>${p.entryPrice.toFixed(2)}</td>
              <td className="py-1.5 px-2 font-mono" style={{ color: "var(--text-secondary)" }}>${currentPrice.toFixed(2)}</td>
              <td className="py-1.5 px-2 font-mono" style={{ color: "var(--danger)" }}>${p.liquidationPrice.toFixed(2)}</td>
              <td className="py-1.5 px-2">
                <input
                  type="number"
                  value={p.takeProfit ?? ""}
                  placeholder="—"
                  onChange={(e) => updatePosition(p.id, { takeProfit: e.target.value === "" ? undefined : Number(e.target.value) })}
                  className="w-16 rounded px-1 py-0.5 text-[9px] font-mono"
                  style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
                />
              </td>
              <td className="py-1.5 px-2">
                <input
                  type="number"
                  value={p.stopLoss ?? ""}
                  placeholder="—"
                  onChange={(e) => updatePosition(p.id, { stopLoss: e.target.value === "" ? undefined : Number(e.target.value) })}
                  className="w-16 rounded px-1 py-0.5 text-[9px] font-mono"
                  style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
                />
              </td>
              <td
                className="py-1.5 px-2 font-semibold font-mono text-right"
                style={{ color: p.unrealizedPnl >= 0 ? "var(--success)" : "var(--danger)" }}
              >
                {p.unrealizedPnl >= 0 ? "+" : ""}${p.unrealizedPnl.toFixed(2)}
              </td>
              <td
                className="py-1.5 px-2 font-mono text-right"
                style={{ color: p.unrealizedPnlPct >= 0 ? "var(--success)" : "var(--danger)" }}
              >
                {p.unrealizedPnlPct >= 0 ? "+" : ""}{p.unrealizedPnlPct.toFixed(2)}%
              </td>
              <td className="py-1.5 px-2">
                <button
                  onClick={() => closePos(p.id)}
                  className="rounded px-2 py-0.5 text-[9px] font-semibold uppercase"
                  style={{ background: "var(--danger)", color: "#fff" }}
                >
                  Close
                </button>
              </td>
            </tr>
          ))}
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
