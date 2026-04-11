import type {
  ISeriesPrimitive,
  SeriesAttachedParameter,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  Time,
  IChartApi,
  ISeriesApi,
} from "lightweight-charts";
import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type { PatternMatch, OHLCBar } from "@/types";

interface HighlightBox {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  label: string;
  confidence: number;
  direction: "bullish" | "bearish" | "neutral";
}

const BULLISH_FILL = "rgba(34, 197, 94, 0.10)";
const BULLISH_BORDER = "rgba(34, 197, 94, 0.55)";
const BEARISH_FILL = "rgba(239, 68, 68, 0.10)";
const BEARISH_BORDER = "rgba(239, 68, 68, 0.55)";
const NEUTRAL_FILL = "rgba(255, 107, 0, 0.10)";
const NEUTRAL_BORDER = "rgba(255, 107, 0, 0.55)";

class HighlightRenderer implements IPrimitivePaneRenderer {
  private _boxes: HighlightBox[] = [];

  update(boxes: HighlightBox[]) { this._boxes = boxes; }

  drawBackground(target: CanvasRenderingTarget2D): void {
    target.useMediaCoordinateSpace(({ context: ctx }) => {
      for (const box of this._boxes) {
        const x1 = Math.min(box.x1, box.x2);
        const x2 = Math.max(box.x1, box.x2);
        const y1 = Math.min(box.y1, box.y2);
        const y2 = Math.max(box.y1, box.y2);
        const w = x2 - x1;
        const h = y2 - y1;
        if (w < 4 || h < 4) continue;

        const dir = box.direction;
        const fill = dir === "bullish" ? BULLISH_FILL : dir === "bearish" ? BEARISH_FILL : NEUTRAL_FILL;
        const border = dir === "bullish" ? BULLISH_BORDER : dir === "bearish" ? BEARISH_BORDER : NEUTRAL_BORDER;

        // Single pattern box
        ctx.fillStyle = fill;
        ctx.fillRect(x1, y1, w, h);
        ctx.strokeStyle = border;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([]);
        ctx.strokeRect(x1, y1, w, h);

        // Label with confidence
        ctx.font = "bold 9px 'Inter', sans-serif";
        ctx.textBaseline = "top";
        ctx.textAlign = "left";
        ctx.fillStyle = border;
        const pct = Math.round(box.confidence * 100);
        if (w > 40) {
          ctx.fillText(`PATTERN ${pct}%`, x1 + 4, y1 + 4);
        }

        // Direction arrow at bottom-right
        ctx.font = "bold 11px 'Inter', sans-serif";
        ctx.textBaseline = "bottom";
        ctx.textAlign = "right";
        const arrow = dir === "bullish" ? "\u25B2" : dir === "bearish" ? "\u25BC" : "\u25C6";
        ctx.fillText(arrow, x2 - 4, y2 - 4);
      }
    });
  }

  draw(): void {}
}

class HighlightPaneView implements IPrimitivePaneView {
  _renderer = new HighlightRenderer();
  update(boxes: HighlightBox[]) { this._renderer.update(boxes); }
  zOrder(): "bottom" { return "bottom"; }
  renderer(): IPrimitivePaneRenderer { return this._renderer; }
}

export class PatternHighlightPrimitive implements ISeriesPrimitive<Time> {
  private _chart: IChartApi | null = null;
  private _series: ISeriesApi<"Candlestick"> | null = null;
  private _requestUpdate: (() => void) | null = null;
  private _paneView = new HighlightPaneView();
  private _matches: PatternMatch[] = [];
  private _data: OHLCBar[] = [];

  attached(param: SeriesAttachedParameter<Time, "Candlestick">) {
    this._chart = param.chart as IChartApi;
    this._series = param.series as ISeriesApi<"Candlestick">;
    this._requestUpdate = param.requestUpdate;
  }

  detached() { this._chart = null; this._series = null; this._requestUpdate = null; }

  setMatches(matches: PatternMatch[], data: OHLCBar[]) {
    this._matches = matches;
    this._data = data;
    this.updateAllViews();
    this._requestUpdate?.();
  }

  clear() {
    this._matches = [];
    this._paneView.update([]);
    this._requestUpdate?.();
  }

  updateAllViews() {
    if (!this._chart || !this._series || this._data.length === 0) {
      this._paneView.update([]);
      return;
    }

    const ts = this._chart.timeScale();
    const series = this._series;
    const boxes: HighlightBox[] = [];

    for (const m of this._matches) {
      const startT = typeof m.startTime === "string" ? Number(m.startTime) : (m.startTime as unknown as number);
      const endT = typeof m.endTime === "string" ? Number(m.endTime) : (m.endTime as unknown as number);

      let minPrice = Infinity, maxPrice = -Infinity, barCount = 0;
      for (const bar of this._data) {
        const t = bar.time as number;
        if (t >= startT && t <= endT) {
          if (bar.low < minPrice) minPrice = bar.low;
          if (bar.high > maxPrice) maxPrice = bar.high;
          barCount++;
        }
      }
      // Allow single-bar patterns (hammer, doji, engulfing)
      if (minPrice === Infinity || barCount < 1) continue;

      // Pad the price box so the label doesn't collide with wicks; at least
      // 0.2% of mid-price when the bar range is near zero (identical OHLC)
      const midPrice = (maxPrice + minPrice) / 2;
      const rawSpan = maxPrice - minPrice;
      const pad = Math.max(rawSpan * 0.12, Math.abs(midPrice) * 0.002);
      minPrice -= pad;
      maxPrice += pad;

      const snap = (raw: number): Time | null => {
        let best: number | null = null, bestD = Infinity;
        for (const bar of this._data) {
          const d = Math.abs((bar.time as number) - raw);
          if (d < bestD) { bestD = d; best = bar.time as number; }
        }
        return best as unknown as Time;
      };

      const t1 = snap(startT);
      const t2 = snap(endT);
      if (!t1 || !t2) continue;

      const x1 = ts.timeToCoordinate(t1);
      const x2 = ts.timeToCoordinate(t2);
      const y1 = series.priceToCoordinate(maxPrice);
      const y2 = series.priceToCoordinate(minPrice);
      if (x1 == null || x2 == null || y1 == null || y2 == null) continue;

      boxes.push({ x1, x2, y1, y2, label: m.name, confidence: m.confidence, direction: m.direction });
    }

    this._paneView.update(boxes);
  }

  paneViews(): readonly IPrimitivePaneView[] { return [this._paneView]; }
}
