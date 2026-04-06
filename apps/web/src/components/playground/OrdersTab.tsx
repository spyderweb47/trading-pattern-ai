"use client";

import { useStore } from "@/store/useStore";

export function OrdersTab() {
  const orders = useStore((s) => s.perpOrders);
  const cancelPerpOrder = useStore((s) => s.cancelPerpOrder);
  const removePerpOrder = useStore((s) => s.removePerpOrder);

  const pending = orders.filter((o) => o.status === "pending");

  if (pending.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs" style={{ color: "var(--text-tertiary)" }}>
        No open orders
      </div>
    );
  }

  return (
    <div className="overflow-auto h-full">
      <table className="w-full text-[10px]">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            <Th>Side</Th>
            <Th>Type</Th>
            <Th>Size</Th>
            <Th>Lev</Th>
            <Th>Limit</Th>
            <Th>TP</Th>
            <Th>SL</Th>
            <Th>Action</Th>
          </tr>
        </thead>
        <tbody>
          {pending.map((o) => (
            <tr key={o.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <td className="py-1.5 px-2">
                <span
                  className="inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold"
                  style={{
                    background: o.side === "long" ? "rgba(38,166,154,0.15)" : "rgba(239,83,80,0.15)",
                    color: o.side === "long" ? "var(--success)" : "var(--danger)",
                  }}
                >
                  {o.side.toUpperCase()}
                </span>
              </td>
              <td className="py-1.5 px-2 uppercase" style={{ color: "var(--text-tertiary)" }}>{o.type}</td>
              <td className="py-1.5 px-2 font-mono" style={{ color: "var(--text-secondary)" }}>${o.size.toFixed(0)}</td>
              <td className="py-1.5 px-2 font-mono" style={{ color: "var(--text-tertiary)" }}>{o.leverage}x</td>
              <td className="py-1.5 px-2 font-mono" style={{ color: "var(--text-secondary)" }}>
                {o.limitPrice != null ? `$${o.limitPrice.toFixed(2)}` : "—"}
              </td>
              <td className="py-1.5 px-2 font-mono" style={{ color: "var(--text-tertiary)" }}>
                {o.takeProfit != null ? `$${o.takeProfit.toFixed(2)}` : "—"}
              </td>
              <td className="py-1.5 px-2 font-mono" style={{ color: "var(--text-tertiary)" }}>
                {o.stopLoss != null ? `$${o.stopLoss.toFixed(2)}` : "—"}
              </td>
              <td className="py-1.5 px-2">
                <button
                  onClick={() => { cancelPerpOrder(o.id); removePerpOrder(o.id); }}
                  className="rounded px-2 py-0.5 text-[9px] font-semibold uppercase"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                >
                  Cancel
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      className="py-1.5 px-2 font-semibold uppercase text-left"
      style={{ color: "var(--text-muted)", fontSize: "8px" }}
    >
      {children}
    </th>
  );
}
