"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type Time,
  type ISeriesMarkersPluginApi,
  ColorType,
} from "lightweight-charts";
import type { OHLCBar, PatternMatch } from "@/types";
import { useStore } from "@/store/useStore";
import { calculateIndicatorLocal } from "@/lib/indicators";
import { PatternSelectorPrimitive } from "@/lib/chart-primitives/PatternSelectorPrimitive";
import type { DrawingPhase } from "@/lib/chart-primitives/patternSelectorTypes";
import { PatternSelectorToolbar } from "./PatternSelectorToolbar";

interface ChartProps {
  data: OHLCBar[];
  patternMatches?: PatternMatch[];
  supportResistance?: { price: number; type: "support" | "resistance" }[];
}

const INDICATOR_COLORS: Record<string, string> = {
  SMA: "#f59e0b",
  EMA: "#8b5cf6",
  RSI: "#06b6d4",
  MACD: "#ec4899",
  "Bollinger Bands": "#6366f1",
  ATR: "#14b8a6",
  VWAP: "#f97316",
};

export function Chart({
  data,
  patternMatches = [],
  supportResistance = [],
}: ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const indicatorSeriesRef = useRef<Map<string, ISeriesApi<"Line">>>(new Map());
  const patternPrimitiveRef = useRef<PatternSelectorPrimitive | null>(null);

  const indicators = useStore((s) => s.indicators);
  const setCapturedPattern = useStore((s) => s.setCapturedPattern);
  const chartFocus = useStore((s) => s.chartFocus);
  const setChartFocus = useStore((s) => s.setChartFocus);
  const setChatInputDraft = useStore((s) => s.setChatInputDraft);

  const [drawingPhase, setDrawingPhase] = useState<DrawingPhase>("idle");
  const [hasSelection, setHasSelection] = useState(false);

  // Create chart
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#64748b",
        fontFamily: "'Chakra Petch', sans-serif",
      },
      grid: {
        vertLines: { color: "#f1f5f9" },
        horzLines: { color: "#f1f5f9" },
      },
      crosshair: {
        vertLine: { color: "#94a3b8", labelBackgroundColor: "#475569" },
        horzLine: { color: "#94a3b8", labelBackgroundColor: "#475569" },
      },
      timeScale: {
        borderColor: "#e2e8f0",
        timeVisible: true,
      },
      rightPriceScale: {
        borderColor: "#e2e8f0",
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#16a34a",
      borderDownColor: "#dc2626",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    // Pattern selector primitive
    const primitive = new PatternSelectorPrimitive();
    primitive.setOnChange((trigger, trade) => {
      setHasSelection(!!(trigger && trade));
      setDrawingPhase(primitive.drawingPhase);
    });
    series.attachPrimitive(primitive);
    patternPrimitiveRef.current = primitive;

    chartRef.current = chart;
    seriesRef.current = series;

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    const ro = new ResizeObserver(handleResize);
    ro.observe(containerRef.current);
    window.addEventListener("resize", handleResize);
    handleResize();

    // Mouse handlers for pattern selector
    const el = containerRef.current;

    const onMouseDown = (e: MouseEvent) => {
      if (!primitive) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (primitive.onMouseDown(x, y)) {
        e.preventDefault();
        e.stopPropagation();
        el.setPointerCapture(e.pointerId || 0);
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!primitive) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      primitive.onMouseMove(x, y);
    };

    const onMouseUp = (e: MouseEvent) => {
      if (!primitive) return;
      if (primitive.onMouseUp()) {
        setDrawingPhase(primitive.drawingPhase);
        setHasSelection(!!(primitive.triggerBox && primitive.tradeBox));
        el.releasePointerCapture(e.pointerId || 0);
      }
    };

    el.addEventListener("pointerdown", onMouseDown);
    el.addEventListener("pointermove", onMouseMove);
    el.addEventListener("pointerup", onMouseUp);

    return () => {
      el.removeEventListener("pointerdown", onMouseDown);
      el.removeEventListener("pointermove", onMouseMove);
      el.removeEventListener("pointerup", onMouseUp);
      ro.disconnect();
      window.removeEventListener("resize", handleResize);
      if (markersRef.current) {
        markersRef.current.detach();
        markersRef.current = null;
      }
      series.detachPrimitive(primitive);
      patternPrimitiveRef.current = null;
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      indicatorSeriesRef.current.clear();
    };
  }, []);

  // Update data
  useEffect(() => {
    if (!seriesRef.current || data.length === 0) return;

    const candleData: CandlestickData<Time>[] = data.map((bar) => ({
      time: bar.time as Time,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
    }));

    seriesRef.current.setData(candleData);
    chartRef.current?.timeScale().fitContent();

    if (!markersRef.current && seriesRef.current) {
      markersRef.current = createSeriesMarkers(seriesRef.current, []);
    }
  }, [data]);

  // Update pattern markers
  useEffect(() => {
    if (!markersRef.current || data.length === 0) return;

    if (patternMatches.length === 0) {
      markersRef.current.setMarkers([]);
      return;
    }

    // Build a set of valid chart bar times for snapping
    const chartTimes = data.map((b) => b.time as number);

    // Snap a raw timestamp to the nearest chart bar time
    const snapToChart = (rawTime: number): number | null => {
      let best = chartTimes[0];
      let bestDist = Math.abs(rawTime - best);
      for (const t of chartTimes) {
        const d = Math.abs(rawTime - t);
        if (d < bestDist) {
          bestDist = d;
          best = t;
        }
      }
      return best;
    };

    // Deduplicate markers by snapped time (keep highest confidence per time)
    const byTime = new Map<number, (typeof patternMatches)[0]>();
    for (const match of patternMatches) {
      const rawTime = typeof match.startTime === "string" ? Number(match.startTime) : match.startTime as number;
      const snapped = snapToChart(rawTime);
      if (snapped === null) continue;
      const existing = byTime.get(snapped);
      if (!existing || match.confidence > existing.confidence) {
        byTime.set(snapped, match);
      }
    }

    const markerData = Array.from(byTime.entries())
      .sort(([a], [b]) => a - b)
      .map(([time, match]) => ({
        time: time as unknown as Time,
        position: (match.direction === "bullish" ? "belowBar" : "aboveBar") as
          | "belowBar"
          | "aboveBar",
        color: match.direction === "bullish" ? "#22c55e" : "#ef4444",
        shape: (match.direction === "bullish" ? "arrowUp" : "arrowDown") as
          | "arrowUp"
          | "arrowDown",
        text: match.name,
      }));

    markersRef.current.setMarkers(markerData);
  }, [patternMatches, data]);

  // Update S/R lines
  useEffect(() => {
    if (!seriesRef.current) return;

    supportResistance.forEach((level) => {
      seriesRef.current?.createPriceLine({
        price: level.price,
        color: level.type === "support" ? "#22c55e" : "#ef4444",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: level.type === "support" ? "S" : "R",
      });
    });
  }, [supportResistance]);

  // Handle indicator overlays
  useEffect(() => {
    if (!chartRef.current || data.length === 0) return;

    const chart = chartRef.current;
    const existingSeries = indicatorSeriesRef.current;

    indicators.forEach((ind) => {
      const key = ind.name;

      if (ind.active && !existingSeries.has(key)) {
        try {
          const parsedParams = Object.fromEntries(
            Object.entries(ind.params).map(([k, v]) => [
              k,
              typeof v === "string" ? (isNaN(Number(v)) ? v : Number(v)) : v,
            ])
          );

          const values = calculateIndicatorLocal(data, ind.backendName, parsedParams);

          const lineSeries = chart.addSeries(LineSeries, {
            color: INDICATOR_COLORS[key] || "#8b5cf6",
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
          });

          const lineData: { time: Time; value: number }[] = [];
          for (let i = 0; i < values.length && i < data.length; i++) {
            const v = values[i];
            if (v !== null && v !== undefined && data[i]) {
              lineData.push({ time: data[i].time as Time, value: v });
            }
          }

          lineSeries.setData(lineData);
          existingSeries.set(key, lineSeries);
        } catch {
          // Silently fail
        }
      } else if (!ind.active && existingSeries.has(key)) {
        const series = existingSeries.get(key)!;
        chart.removeSeries(series);
        existingSeries.delete(key);
      }
    });
  }, [indicators, data]);

  // Zoom chart to focused time range (from clicking a pattern row)
  useEffect(() => {
    if (!chartFocus || !chartRef.current) return;
    const ts = chartRef.current.timeScale();
    ts.setVisibleRange({
      from: chartFocus.startTime as unknown as Time,
      to: chartFocus.endTime as unknown as Time,
    });
    // Clear the focus so clicking the same row again works
    setChartFocus(null);
  }, [chartFocus, setChartFocus]);

  // --- Pattern Selector handlers ---

  const handleStartDrawing = useCallback(() => {
    const p = patternPrimitiveRef.current;
    if (!p) return;
    p.clear();
    p.setDrawingPhase("trigger");
    setDrawingPhase("trigger");
    setHasSelection(false);
    // Disable crosshair during drawing
    chartRef.current?.applyOptions({
      crosshair: { vertLine: { visible: false }, horzLine: { visible: false } },
    });
  }, []);

  const handleClear = useCallback(() => {
    const p = patternPrimitiveRef.current;
    if (!p) return;
    p.clear();
    setDrawingPhase("idle");
    setHasSelection(false);
    setCapturedPattern(null);
    // Re-enable crosshair
    chartRef.current?.applyOptions({
      crosshair: { vertLine: { visible: true }, horzLine: { visible: true } },
    });
  }, [setCapturedPattern]);

  const handleSendToChat = useCallback(() => {
    const p = patternPrimitiveRef.current;
    if (!p || !p.triggerBox || !p.tradeBox) return;

    const tb = p.triggerBox;
    const tr = p.tradeBox;

    // Extract bars within trigger and trade ranges
    const triggerBars = data.filter(
      (b) => (b.time as number) >= (tb.startTime as number) && (b.time as number) <= (tb.endTime as number)
    );
    const tradeBars = data.filter(
      (b) => (b.time as number) >= (tr.startTime as number) && (b.time as number) <= (tr.endTime as number)
    );

    const entryPrice = (tr.topPrice + tr.bottomPrice) / 2;
    const exitPrice = tradeBars.length > 0 ? tradeBars[tradeBars.length - 1].close : entryPrice;
    const direction = exitPrice >= entryPrice ? "long" : "short";

    const captured = {
      triggerBars,
      tradeBars,
      entryPrice: Math.round(entryPrice * 100) / 100,
      exitPrice: Math.round(exitPrice * 100) / 100,
      direction: direction as "long" | "short",
      triggerTimeRange: [tb.startTime as number, tb.endTime as number] as [number, number],
      tradeTimeRange: [tr.startTime as number, tr.endTime as number] as [number, number],
      priceRange: [Math.min(tb.bottomPrice, tr.bottomPrice), Math.max(tb.topPrice, tr.topPrice)] as [number, number],
    };

    setCapturedPattern(captured);

    // Prefill chat input — user can edit before sending
    const startDate = new Date((tb.startTime as number) * 1000).toLocaleDateString();
    const endDate = new Date((tb.endTime as number) * 1000).toLocaleDateString();
    const draft = `Analyze this pattern: Trigger ${triggerBars.length} bars (${startDate}-${endDate}), ${direction.toUpperCase()} entry ~$${captured.entryPrice} exit ~$${captured.exitPrice}`;
    setChatInputDraft(draft);

    // Re-enable crosshair
    chartRef.current?.applyOptions({
      crosshair: { vertLine: { visible: true }, horzLine: { visible: true } },
    });
  }, [data, setCapturedPattern, setChatInputDraft]);

  // Re-enable crosshair when drawing finishes
  useEffect(() => {
    if (drawingPhase === "idle" && hasSelection) {
      chartRef.current?.applyOptions({
        crosshair: { vertLine: { visible: true }, horzLine: { visible: true } },
      });
    }
  }, [drawingPhase, hasSelection]);

  return (
    <div className="relative h-full w-full rounded-lg border border-slate-200 bg-white">
      <div ref={containerRef} className="absolute inset-0" />

      {data.length > 0 && (
        <PatternSelectorToolbar
          drawingPhase={drawingPhase}
          hasSelection={hasSelection}
          onStartDrawing={handleStartDrawing}
          onClear={handleClear}
          onSendToChat={handleSendToChat}
        />
      )}

      {data.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-sm text-slate-400">Upload a CSV dataset to begin</p>
        </div>
      )}
    </div>
  );
}
