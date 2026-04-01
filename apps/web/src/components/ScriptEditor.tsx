"use client";

interface ScriptEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function ScriptEditor({ value, onChange }: ScriptEditorProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-1.5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
          Script Editor
        </span>
        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>JavaScript</span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        className="flex-1 resize-none p-3 font-mono text-[11px] leading-relaxed outline-none"
        style={{
          background: "var(--surface-2)",
          color: "var(--text-primary)",
        }}
        placeholder="// Generated script will appear here..."
      />
    </div>
  );
}
