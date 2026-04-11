import type {
  ISeriesPrimitive,
  SeriesAttachedParameter,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  PrimitiveHoveredItem,
  Time,
  IChartApi,
  ISeriesApi,
} from "lightweight-charts";
import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type {
  BoxBounds,
  PixelBox,
  DragHandle,
  DrawingPhase,
} from "./patternSelectorTypes";

// Topstep orange accent for the pattern box
const PATTERN_FILL = "rgba(255, 107, 0, 0.12)";
const PATTERN_BORDER = "rgba(255, 107, 0, 0.85)";
const HANDLE_SIZE = 5;
const EDGE_TOLERANCE = 6;

class PatternSelectorRenderer implements IPrimitivePaneRenderer {
  private _patternPx: PixelBox | null = null;

  update(patternPx: PixelBox | null) {
    this._patternPx = patternPx;
  }

  draw(target: CanvasRenderingTarget2D): void {
    target.useMediaCoordinateSpace(({ context: ctx }) => {
      if (this._patternPx) this._drawBox(ctx, this._patternPx);
    });
  }

  private _drawBox(ctx: CanvasRenderingContext2D, box: PixelBox) {
    const x = Math.min(box.x1, box.x2);
    const y = Math.min(box.y1, box.y2);
    const w = Math.abs(box.x2 - box.x1);
    const h = Math.abs(box.y2 - box.y1);

    // Fill
    ctx.fillStyle = PATTERN_FILL;
    ctx.fillRect(x, y, w, h);

    // Border
    ctx.strokeStyle = PATTERN_BORDER;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.strokeRect(x, y, w, h);

    // Label
    ctx.fillStyle = PATTERN_BORDER;
    ctx.font = "bold 9px 'Inter', sans-serif";
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillText("PATTERN", x + 4, y + 4);

    // Corner handles
    const hs = HANDLE_SIZE;
    ctx.fillStyle = PATTERN_BORDER;
    ctx.fillRect(x - hs / 2, y - hs / 2, hs, hs);
    ctx.fillRect(x + w - hs / 2, y - hs / 2, hs, hs);
    ctx.fillRect(x - hs / 2, y + h - hs / 2, hs, hs);
    ctx.fillRect(x + w - hs / 2, y + h - hs / 2, hs, hs);
  }
}

class PatternSelectorPaneView implements IPrimitivePaneView {
  _renderer = new PatternSelectorRenderer();

  update(patternPx: PixelBox | null) {
    this._renderer.update(patternPx);
  }

  zOrder(): "top" {
    return "top";
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

export class PatternSelectorPrimitive implements ISeriesPrimitive<Time> {
  private _chart: IChartApi | null = null;
  private _series: ISeriesApi<"Candlestick"> | null = null;
  private _requestUpdate: (() => void) | null = null;
  private _paneView = new PatternSelectorPaneView();

  // Logical bounds
  private _patternBox: BoxBounds | null = null;

  // Pixel bounds (cached)
  private _patternPx: PixelBox | null = null;

  // Interaction state
  private _drawingPhase: DrawingPhase = "idle";
  private _anchorTime: Time | null = null;
  private _anchorPrice: number | null = null;
  private _dragHandle: DragHandle = null;
  private _dragStartX = 0;
  private _dragStartY = 0;
  private _dragOrigBox: BoxBounds | null = null;

  // Callbacks
  private _onChange: ((pattern: BoxBounds | null) => void) | null = null;

  setOnChange(fn: (pattern: BoxBounds | null) => void) {
    this._onChange = fn;
  }

  private _notifyChange() {
    this._onChange?.(this._patternBox);
  }

  attached(param: SeriesAttachedParameter<Time, "Candlestick">) {
    this._chart = param.chart as IChartApi;
    this._series = param.series as ISeriesApi<"Candlestick">;
    this._requestUpdate = param.requestUpdate;
  }

  detached() {
    this._chart = null;
    this._series = null;
    this._requestUpdate = null;
  }

  // --- Public API ---

  get patternBox() { return this._patternBox; }
  get drawingPhase() { return this._drawingPhase; }

  setDrawingPhase(phase: DrawingPhase) {
    this._drawingPhase = phase;
  }

  clear() {
    this._patternBox = null;
    this._patternPx = null;
    this._drawingPhase = "idle";
    this._paneView.update(null);
    this._requestUpdate?.();
    this._notifyChange();
  }

  // --- Coordinate helpers ---

  private _timeToX(t: Time): number | null {
    return this._chart?.timeScale().timeToCoordinate(t) ?? null;
  }

  private _priceToY(p: number): number | null {
    return this._series?.priceToCoordinate(p) ?? null;
  }

  private _xToTime(x: number): Time | null {
    return this._chart?.timeScale().coordinateToTime(x) ?? null;
  }

  private _yToPrice(y: number): number | null {
    return this._series?.coordinateToPrice(y) ?? null;
  }

  private _boundsToPixels(b: BoxBounds): PixelBox | null {
    const x1 = this._timeToX(b.startTime);
    const x2 = this._timeToX(b.endTime);
    const y1 = this._priceToY(b.topPrice);
    const y2 = this._priceToY(b.bottomPrice);
    if (x1 === null || x2 === null || y1 === null || y2 === null) return null;
    return { x1, y1, x2, y2 };
  }

  // --- Lifecycle ---

  updateAllViews() {
    this._patternPx = this._patternBox ? this._boundsToPixels(this._patternBox) : null;
    this._paneView.update(this._patternPx);
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this._paneView];
  }

  // --- Hit Testing ---

  hitTest(x: number, y: number): PrimitiveHoveredItem | null {
    if (this._drawingPhase !== "idle") return null;

    const handle = this._getHandle(x, y);
    if (!handle) return null;

    const cursorMap: Record<string, string> = {
      "pattern-body": "grab",
      "pattern-left": "ew-resize",
      "pattern-right": "ew-resize",
      "pattern-top": "ns-resize",
      "pattern-bottom": "ns-resize",
    };

    return {
      cursorStyle: cursorMap[handle] || "default",
      externalId: handle,
      zOrder: "top",
    };
  }

  private _getHandle(x: number, y: number): DragHandle {
    if (!this._patternPx) return null;
    return this._hitTestBox(x, y, this._patternPx);
  }

  private _hitTestBox(x: number, y: number, box: PixelBox): DragHandle {
    const bx = Math.min(box.x1, box.x2);
    const by = Math.min(box.y1, box.y2);
    const bw = Math.abs(box.x2 - box.x1);
    const bh = Math.abs(box.y2 - box.y1);
    const t = EDGE_TOLERANCE;

    // Edges
    if (Math.abs(x - bx) < t && y >= by - t && y <= by + bh + t) return "pattern-left";
    if (Math.abs(x - (bx + bw)) < t && y >= by - t && y <= by + bh + t) return "pattern-right";
    if (Math.abs(y - by) < t && x >= bx - t && x <= bx + bw + t) return "pattern-top";
    if (Math.abs(y - (by + bh)) < t && x >= bx - t && x <= bx + bw + t) return "pattern-bottom";

    // Body
    if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) return "pattern-body";

    return null;
  }

  // --- Mouse Interaction ---

  onMouseDown(x: number, y: number): boolean {
    if (this._drawingPhase === "pattern") {
      const time = this._xToTime(x);
      const price = this._yToPrice(y);
      if (time && price !== null) {
        this._anchorTime = time;
        this._anchorPrice = price;
        this._patternBox = {
          startTime: time,
          endTime: time,
          topPrice: price,
          bottomPrice: price,
        };
      }
      return true;
    }

    // Check for drag/resize when idle
    if (this._drawingPhase === "idle") {
      const handle = this._getHandle(x, y);
      if (handle) {
        this._dragHandle = handle;
        this._dragStartX = x;
        this._dragStartY = y;
        this._dragOrigBox = this._patternBox ? { ...this._patternBox } : null;
        return true;
      }
    }

    return false;
  }

  onMouseMove(x: number, y: number): boolean {
    if (this._drawingPhase === "pattern" && this._anchorTime && this._anchorPrice !== null) {
      const time = this._xToTime(x);
      const price = this._yToPrice(y);
      if (time && price !== null) {
        this._patternBox = {
          startTime: (this._anchorTime as number) < (time as number) ? this._anchorTime : time,
          endTime: (this._anchorTime as number) < (time as number) ? time : this._anchorTime,
          topPrice: Math.max(this._anchorPrice, price),
          bottomPrice: Math.min(this._anchorPrice, price),
        };
        this.updateAllViews();
        this._requestUpdate?.();
      }
      return true;
    }

    // Drag/resize
    if (this._dragHandle && this._dragOrigBox) {
      const dx = x - this._dragStartX;
      const dy = y - this._dragStartY;
      this._applyDrag(dx, dy);
      this.updateAllViews();
      this._requestUpdate?.();
      return true;
    }

    return false;
  }

  onMouseUp(): boolean {
    if (this._drawingPhase === "pattern" && this._patternBox) {
      this._drawingPhase = "idle";
      this._anchorTime = null;
      this._anchorPrice = null;
      this._notifyChange();
      return true;
    }

    if (this._dragHandle) {
      this._dragHandle = null;
      this._dragOrigBox = null;
      this._notifyChange();
      return true;
    }

    return false;
  }

  private _applyDrag(dx: number, dy: number) {
    if (!this._dragHandle || !this._dragOrigBox || !this._patternBox) return;

    const orig = this._dragOrigBox;
    const handle = this._dragHandle;

    const pricePerPx = this._estimatePricePerPixel();
    const dPrice = -dy * pricePerPx;

    if (handle === "pattern-body") {
      const timeShift = this._estimateTimeShift(dx);
      this._patternBox = {
        startTime: this._shiftTime(orig.startTime, timeShift),
        endTime: this._shiftTime(orig.endTime, timeShift),
        topPrice: orig.topPrice + dPrice,
        bottomPrice: orig.bottomPrice + dPrice,
      };
    } else if (handle === "pattern-left") {
      const timeShift = this._estimateTimeShift(dx);
      this._patternBox = {
        ...this._patternBox,
        startTime: this._shiftTime(orig.startTime, timeShift),
      };
    } else if (handle === "pattern-right") {
      const timeShift = this._estimateTimeShift(dx);
      this._patternBox = {
        ...this._patternBox,
        endTime: this._shiftTime(orig.endTime, timeShift),
      };
    } else if (handle === "pattern-top") {
      this._patternBox = { ...this._patternBox, topPrice: orig.topPrice + dPrice };
    } else if (handle === "pattern-bottom") {
      this._patternBox = { ...this._patternBox, bottomPrice: orig.bottomPrice + dPrice };
    }
  }

  private _estimatePricePerPixel(): number {
    if (!this._series) return 1;
    const p1 = this._series.coordinateToPrice(0);
    const p2 = this._series.coordinateToPrice(100);
    if (p1 === null || p2 === null) return 1;
    return Math.abs(p1 - p2) / 100;
  }

  private _estimateTimeShift(dx: number): number {
    if (!this._chart) return 0;
    const ts = this._chart.timeScale();
    const t1 = ts.coordinateToTime(0);
    const t2 = ts.coordinateToTime(100);
    if (!t1 || !t2) return 0;
    const secPer100px = (t2 as number) - (t1 as number);
    return (dx / 100) * secPer100px;
  }

  private _shiftTime(t: Time, shift: number): Time {
    return ((t as number) + Math.round(shift)) as unknown as Time;
  }
}
