"use client";

import type { SimulationDebate, AgentRole, AgentStatus } from "@/types";

interface Props {
  debate: SimulationDebate | null;
}

const NODES: { id: AgentRole; label: string; x: number; y: number }[] = [
  { id: "bull", label: "BULL", x: 60, y: 40 },
  { id: "bear", label: "BEAR", x: 60, y: 120 },
  { id: "risk", label: "RISK", x: 210, y: 80 },
  { id: "pm", label: "PM", x: 350, y: 80 },
];

const EDGES: [AgentRole, AgentRole][] = [
  ["bull", "risk"],
  ["bear", "risk"],
  ["risk", "pm"],
];

function statusColor(s: AgentStatus): string {
  switch (s) {
    case "done": return "#00d68f";
    case "running": return "var(--accent)";
    case "error": return "#ff4d4d";
    default: return "var(--surface-3, #222228)";
  }
}

function statusTextColor(s: AgentStatus): string {
  return s === "done" || s === "running" ? "#000" : "var(--text-tertiary)";
}

export function DAGFlowchart({ debate }: Props) {
  const getStatus = (role: AgentRole): AgentStatus => {
    if (!debate || debate.status === "idle") return "pending";
    return debate.agents[role]?.status ?? "pending";
  };

  return (
    <div className="px-3 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
      <div className="text-[9px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>
        Committee DAG
      </div>
      <svg viewBox="0 0 410 160" className="w-full" style={{ maxHeight: 120 }}>
        {/* Arrowhead marker */}
        <defs>
          <marker id="dag-arrow" viewBox="0 0 10 10" refX="10" refY="5"
            markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--text-muted)" />
          </marker>
        </defs>

        {/* Edges */}
        {EDGES.map(([from, to]) => {
          const f = NODES.find((n) => n.id === from)!;
          const t = NODES.find((n) => n.id === to)!;
          return (
            <line
              key={`${from}-${to}`}
              x1={f.x + 24} y1={f.y}
              x2={t.x - 24} y2={t.y}
              stroke="var(--text-muted)"
              strokeWidth={1.5}
              strokeDasharray={getStatus(to) === "pending" ? "4 3" : ""}
              markerEnd="url(#dag-arrow)"
              opacity={getStatus(from) === "done" ? 0.8 : 0.3}
            />
          );
        })}

        {/* Nodes */}
        {NODES.map((node) => {
          const status = getStatus(node.id);
          const fill = statusColor(status);
          return (
            <g key={node.id}>
              <circle
                cx={node.x} cy={node.y} r={22}
                fill={fill}
                stroke={status === "running" ? "var(--accent)" : "var(--border)"}
                strokeWidth={status === "running" ? 2.5 : 1.5}
                className={status === "running" ? "animate-pulse" : ""}
              />
              <text
                x={node.x} y={node.y + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={9}
                fontWeight={700}
                fontFamily="Inter, sans-serif"
                fill={statusTextColor(status)}
                letterSpacing="0.05em"
              >
                {node.label}
              </text>
              {/* Status dot */}
              {status === "done" && (
                <text x={node.x} y={node.y + 34} textAnchor="middle" fontSize={10}>
                  ✓
                </text>
              )}
              {status === "error" && (
                <text x={node.x} y={node.y + 34} textAnchor="middle" fontSize={10} fill="#ff4d4d">
                  ✕
                </text>
              )}
            </g>
          );
        })}

        {/* Decision arrow from PM */}
        <line x1={372} y1={80} x2={400} y2={80} stroke="var(--text-muted)" strokeWidth={1.5} markerEnd="url(#dag-arrow)" opacity={getStatus("pm") === "done" ? 0.8 : 0.3} />
      </svg>
    </div>
  );
}
