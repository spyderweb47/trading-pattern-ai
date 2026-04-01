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

const TRIGGER_FILL = "rgba(59, 130, 246, 0.12)";
const TRIGGER_BORDER = "rgba(59, 130, 246, 0.7)";
const TRADE_FILL = "rgba(34, 197, 94, 0.12)";
const TRADE_BORDER = "rgba(34, 197, 94, 0.7)";
const HANDLE_SIZE = 5;
const EDGE_TOLERANCE = 6;

class PatternSelectorRenderer implements IPrimitivePaneRenderer {
  private _triggerPx: PixelBox | null = null;
  private _tradePx: PixelBox | null = null;

  update(triggerPx: PixelBox | null, tradePx: PixelBox | null) {
    this._triggerPx = triggerPx;
    this._tradePx = tradePx;
  }

  draw(target: CanvasRenderingTarget2D): void {
    target.useMediaCoordinateSpace(({ context: ctx }) => {
      if (this._triggerPx) this._drawBox(ctx, this._triggerPx, TRIGGER_FILL, TRIGGER_BORDER, "TRIGGER");
      if (this._tradePx) this._drawBox(ctx, this._tradePx, TRADE_FILL, TRADE_BORDER, "TRADE");
    });
  }

  private _drawBox(
    ctx: CanvasRenderingContext2D,
    box: PixelBox,
    fill: string,
    border: string,
    label: string
  ) {
    const x = Math.min(box.x1, box.x2);
    const y = Math.min(box.y1, box.y2);
    const w = Math.abs(box.x2 - box.x1);
    const h = Math.abs(box.y2 - box.y1);

    // Fill
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);

    // Border
    ctx.strokeStyle = border;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.strokeRect(x, y, w, h);

    // Label
    ctx.fillStyle = border;
    ctx.font = "bold 9px 'Chakra Petch', sans-serif";
    ctx.textBaseline = "top";
    ctx.fillText(label, x + 4, y + 4);

    // Corner handles
    const hs = HANDLE_SIZE;
    ctx.fillStyle = border;
    // top-left, top-right, bottom-left, bottom-right
    ctx.fillRect(x - hs / 2, y - hs / 2, hs, hs);
    ctx.fillRect(x + w - hs / 2, y - hs / 2, hs, hs);
    ctx.fillRect(x - hs / 2, y + h - hs / 2, hs, hs);
    ctx.fillRect(x + w - hs / 2, y + h - hs / 2, hs, hs);

    // Entry / exit labels for trade box
    if (label === "TRADE") {
      ctx.font = "bold 8px 'Chakra Petch', sans-serif";
      ctx.fillStyle = TRADE_BORDER;
      const midY = y + h / 2;
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.fillText("ENTRY", x + 4, midY);
      ctx.textAlign = "right";
      ctx.fillText("EXIT", x + w - 4, midY);
      ctx.textAlign = "left";
    }
  }
}

class PatternSelectorPaneView implements IPrimitivePaneView {
  _renderer = new PatternSelectorRenderer();

  update(triggerPx: PixelBox | null, tradePx: PixelBox | null) {
    this._renderer.update(triggerPx, tradePx);
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
  private _triggerBox: BoxBounds | null = null;
  private _tradeBox: BoxBounds | null = null;

  // Pixel bounds (cached)
  private _triggerPx: PixelBox | null = null;
  private _tradePx: PixelBox | null = null;

  // Interaction state
  private _drawingPhase: DrawingPhase = "idle";
  private _anchorTime: Time | null = null;
  private _anchorPrice: number | null = null;
  private _dragHandle: DragHandle = null;
  private _dragStartX = 0;
  private _dragStartY = 0;
  private _dragOrigBox: BoxBounds | null = null;

  // Callbacks
  private _onChange: ((trigger: BoxBounds | null, trade: BoxBounds | null) => void) | null = null;

  setOnChange(fn: (trigger: BoxBounds | null, trade: BoxBounds | null) => void) {
    this._onChange = fn;
  }

  private _notifyChange() {
    this._onChange?.(this._triggerBox, this._tradeBox);
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

  get triggerBox() { return this._triggerBox; }
  get tradeBox() { return this._tradeBox; }
  get drawingPhase() { return this._drawingPhase; }

  setDrawingPhase(phase: DrawingPhase) {
    this._drawingPhase = phase;
  }

  clear() {
    this._triggerBox = null;
    this._tradeBox = null;
    this._triggerPx = null;
    this._tradePx = null;
    this._drawingPhase = "idle";
    this._paneView.update(null, null);
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
    this._triggerPx = this._triggerBox ? this._boundsToPixels(this._triggerBox) : null;
    this._tradePx = this._tradeBox ? this._boundsToPixels(this._tradeBox) : null;
    this._paneView.update(this._triggerPx, this._tradePx);
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
      "trigger-body": "grab",
      "trigger-left": "ew-resize",
      "trigger-right": "ew-resize",
      "trigger-top": "ns-resize",
      "trigger-bottom": "ns-resize",
      "trade-body": "grab",
      "trade-right": "ew-resize",
      "trade-top": "ns-resize",
      "trade-bottom": "ns-resize",
    };

    return {
      cursorStyle: cursorMap[handle] || "default",
      externalId: handle,
      zOrder: "top",
    };
  }

  private _getHandle(x: number, y: number): DragHandle {
    // Check trade box first (drawn on top)
    if (this._tradePx) {
      const h = this._hitTestBox(x, y, this._tradePx, "trade");
      if (h) return h;
    }
    if (this._triggerPx) {
      const h = this._hitTestBox(x, y, this._triggerPx, "trigger");
      if (h) return h;
    }
    return null;
  }

  private _hitTestBox(
    x: number,
    y: number,
    box: PixelBox,
    prefix: "trigger" | "trade"
  ): DragHandle {
    const bx = Math.min(box.x1, box.x2);
    const by = Math.min(box.y1, box.y2);
    const bw = Math.abs(box.x2 - box.x1);
    const bh = Math.abs(box.y2 - box.y1);
    const t = EDGE_TOLERANCE;

    // Edges
    if (prefix === "trigger" && Math.abs(x - bx) < t && y >= by - t && y <= by + bh + t)
      return "trigger-left";
    if (prefix === "trigger" && Math.abs(x - (bx + bw)) < t && y >= by - t && y <= by + bh + t)
      return "trigger-right";
    if (prefix === "trade" && Math.abs(x - (bx + bw)) < t && y >= by - t && y <= by + bh + t)
      return "trade-right";
    if (Math.abs(y - by) < t && x >= bx - t && x <= bx + bw + t)
      return `${prefix}-top` as DragHandle;
    if (Math.abs(y - (by + bh)) < t && x >= bx - t && x <= bx + bw + t)
      return `${prefix}-bottom` as DragHandle;

    // Body
    if (x >= bx && x <= bx + bw && y >= by && y <= by + bh)
      return `${prefix}-body` as DragHandle;

    return null;
  }

  // --- Mouse Interaction ---

  onMouseDown(x: number, y: number): boolean {
    if (this._drawingPhase === "trigger") {
      const time = this._xToTime(x);
      const price = this._yToPrice(y);
      if (time && price !== null) {
        this._anchorTime = time;
        this._anchorPrice = price;
        this._triggerBox = {
          startTime: time,
          endTime: time,
          topPrice: price,
          bottomPrice: price,
        };
      }
      return true;
    }

    if (this._drawingPhase === "trade" && this._triggerBox) {
      const price = this._yToPrice(y);
      if (price !== null) {
        this._anchorPrice = price;
        this._tradeBox = {
          startTime: this._triggerBox.endTime,
          endTime: this._triggerBox.endTime,
          topPrice: price,
          bottomPrice: price,
        };
      }
      return true;
    }

    // Check for drag/resize
    if (this._drawingPhase === "idle") {
      const handle = this._getHandle(x, y);
      if (handle) {
        this._dragHandle = handle;
        this._dragStartX = x;
        this._dragStartY = y;
        const isT = handle.startsWith("trigger");
        this._dragOrigBox = isT
          ? this._triggerBox ? { ...this._triggerBox } : null
          : this._tradeBox ? { ...this._tradeBox } : null;
        return true;
      }
    }

    return false;
  }

  onMouseMove(x: number, y: number): boolean {
    if (this._drawingPhase === "trigger" && this._anchorTime && this._anchorPrice !== null) {
      const time = this._xToTime(x);
      const price = this._yToPrice(y);
      if (time && price !== null) {
        this._triggerBox = {
          startTime: this._anchorTime < time ? this._anchorTime : time,
          endTime: this._anchorTime < time ? time : this._anchorTime,
          topPrice: Math.max(this._anchorPrice, price),
          bottomPrice: Math.min(this._anchorPrice, price),
        };
        this.updateAllViews();
        this._requestUpdate?.();
      }
      return true;
    }

    if (this._drawingPhase === "trade" && this._tradeBox && this._anchorPrice !== null) {
      const time = this._xToTime(x);
      const price = this._yToPrice(y);
      if (time && price !== null && this._triggerBox) {
        const endTime = time > this._triggerBox.endTime ? time : this._triggerBox.endTime;
        this._tradeBox = {
          startTime: this._triggerBox.endTime,
          endTime,
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
    if (this._drawingPhase === "trigger" && this._triggerBox) {
      this._drawingPhase = "trade";
      this._anchorTime = null;
      this._anchorPrice = null;
      this._notifyChange();
      return true;
    }

    if (this._drawingPhase === "trade" && this._tradeBox) {
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
    if (!this._dragHandle || !this._dragOrigBox) return;

    const orig = this._dragOrigBox;
    const handle = this._dragHandle;

    // Convert pixel deltas to time/price deltas approximately
    const pricePerPx = this._estimatePricePerPixel();
    const dPrice = -dy * pricePerPx; // negative because y increases downward

    if (handle === "trigger-body" && this._triggerBox) {
      const timeShift = this._estimateTimeShift(dx);
      this._triggerBox = {
        startTime: this._shiftTime(orig.startTime, timeShift),
        endTime: this._shiftTime(orig.endTime, timeShift),
        topPrice: orig.topPrice + dPrice,
        bottomPrice: orig.bottomPrice + dPrice,
      };
      // Move trade box too
      if (this._tradeBox) {
        this._tradeBox = {
          ...this._tradeBox,
          startTime: this._triggerBox.endTime,
        };
      }
    } else if (handle === "trade-body" && this._tradeBox) {
      const timeShift = this._estimateTimeShift(dx);
      this._tradeBox = {
        startTime: orig.startTime, // locked to trigger
        endTime: this._shiftTime(orig.endTime, timeShift),
        topPrice: orig.topPrice + dPrice,
        bottomPrice: orig.bottomPrice + dPrice,
      };
    } else if (handle === "trigger-right" && this._triggerBox) {
      const timeShift = this._estimateTimeShift(dx);
      this._triggerBox = {
        ...this._triggerBox,
        endTime: this._shiftTime(orig.endTime, timeShift),
      };
      if (this._tradeBox) {
        this._tradeBox = { ...this._tradeBox, startTime: this._triggerBox.endTime };
      }
    } else if (handle === "trigger-left" && this._triggerBox) {
      const timeShift = this._estimateTimeShift(dx);
      this._triggerBox = {
        ...this._triggerBox,
        startTime: this._shiftTime(orig.startTime, timeShift),
      };
    } else if (handle === "trade-right" && this._tradeBox) {
      const timeShift = this._estimateTimeShift(dx);
      this._tradeBox = {
        ...this._tradeBox,
        endTime: this._shiftTime(orig.endTime, timeShift),
      };
    } else if (handle.endsWith("-top")) {
      const box = handle.startsWith("trigger") ? this._triggerBox : this._tradeBox;
      if (box) {
        (handle.startsWith("trigger") ? this._triggerBox : this._tradeBox)!.topPrice = orig.topPrice + dPrice;
      }
    } else if (handle.endsWith("-bottom")) {
      const box = handle.startsWith("trigger") ? this._triggerBox : this._tradeBox;
      if (box) {
        (handle.startsWith("trigger") ? this._triggerBox : this._tradeBox)!.bottomPrice = orig.bottomPrice + dPrice;
      }
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
