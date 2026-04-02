"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { TopBar } from "@/components/TopBar";
import { RightSidebar } from "@/components/RightSidebar";
import { BottomPanel } from "@/components/BottomPanel";
import { Chart } from "@/components/Chart";
import { DrawingToolbar } from "@/components/DrawingToolbar";
import { TimeframeSelector } from "@/components/TimeframeSelector";
import { useStore } from "@/store/useStore";

export default function Home() {
  const chartData = useStore((s) => s.chartData);
  const patternMatches = useStore((s) => s.patternMatches);
  const rootRef = useRef<HTMLDivElement>(null);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const sidebarDrag = useRef({ active: false, startX: 0, startW: 0 });

  const onSidebarResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    sidebarDrag.current = { active: true, startX: e.clientX, startW: sidebarWidth };

    const onMove = (ev: MouseEvent) => {
      if (!sidebarDrag.current.active) return;
      const dx = sidebarDrag.current.startX - ev.clientX;
      const newW = Math.max(240, Math.min(600, sidebarDrag.current.startW + dx));
      setSidebarWidth(newW);
      window.dispatchEvent(new Event("resize"));
    };
    const onUp = () => {
      sidebarDrag.current.active = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [sidebarWidth]);

  // Prevent browser from scrolling the overflow-hidden container
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    el.scrollTop = 0;
    el.scrollLeft = 0;
    const handler = () => { el.scrollTop = 0; el.scrollLeft = 0; };
    el.addEventListener("scroll", handler);
    return () => el.removeEventListener("scroll", handler);
  }, []);

  return (
    <div ref={rootRef} className="flex h-screen overflow-hidden" style={{ background: "var(--bg)" }}>
      {/* Center Content */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top Bar */}
        <TopBar />

        {/* Timeframe selector */}
        <TimeframeSelector />

        {/* Chart Area with Drawing Toolbar */}
        <div className="flex flex-1 min-h-0">
          <DrawingToolbar />
          <div className="flex-1 min-h-0">
            <Chart data={chartData} patternMatches={patternMatches} />
          </div>
        </div>

        {/* Bottom Panel - collapsible, contextual by mode */}
        <BottomPanel />
      </div>

      {/* Right Sidebar with resize handle */}
      <div className="flex shrink-0" style={{ width: sidebarWidth }}>
        <div
          onMouseDown={onSidebarResizeStart}
          className="w-1 cursor-ew-resize hover:bg-[var(--accent)] transition-colors shrink-0"
        />
        <div className="flex-1 min-w-0">
          <RightSidebar />
        </div>
      </div>
    </div>
  );
}
