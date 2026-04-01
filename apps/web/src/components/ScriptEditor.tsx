"use client";

interface ScriptEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function ScriptEditor({ value, onChange }: ScriptEditorProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Script Editor
        </span>
        <span className="text-[10px] text-slate-300">JavaScript</span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        className="flex-1 resize-none bg-slate-50 p-3 font-mono text-xs text-slate-700 outline-none placeholder-slate-300"
        placeholder="// Generated script will appear here..."
      />
    </div>
  );
}
