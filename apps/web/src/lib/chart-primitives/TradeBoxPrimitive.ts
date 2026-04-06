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
import type { Trade, OHLCBar } from "@/types";

interface TradeBox {
  x1: number;
  x2: number;
  yEntry: number;
  yExit: number;
  yTp: number | null;
  ySl: number | null;
  isWin: boolean;
  isLong: boolean;
  label: string;
  pnlLabel: string;
  isHighlighted: boolean;
}

const WIN_FILL = "rgba(38, 166, 154, 0.12)";
const WIN_BORDER = "rgba(38, 166, 154, 0.6)";
const LOSE_FILL = "rgba(239, 83, 80, 0.12)";
const LOSE_BORDER = "rgba(239, 83, 80, 0.6)";
const WIN_FILL_HL = "rgba(38, 166, 154, 0.25)";
const WIN_BORDER_HL = "rgba(38, 166, 154, 0.9)";
const LOSE_FILL_HL = "rgba(239, 83, 80, 0.25)";
const LOSE_BORDER_HL = "rgba(239, 83, 80, 0.9)";
const ENTRY_COLOR = "rgba(255, 255, 255, 0.7)";
const EXIT_COLOR = "rgba(255, 255, 255, 0.5)";

class TradeBoxRenderer implements IPrimitivePaneRenderer {
  private _boxes: TradeBox[] = [];

  update(boxes: TradeBox[]) {
    this._boxes = boxes;
  }

  drawBackground(target: CanvasRenderingTarget2D): void {
    target.useMediaCoordinateSpace(({ context: ctx }) => {
      for (const box of this._boxes) {
        const x1 = Math.min(box.x1, box.x2);
        const x2 = Math.max(box.x1, box.x2);
        const y1 = Math.min(box.yEntry, box.yExit);
        const y2 = Math.max(box.yEntry, box.yExit);
        const w = x2 - x1;
        const h = y2 - y1;
        if (w < 2) continue;

        const hl = box.isHighlighted;
        const fill = box.isWin ? (hl ? WIN_FILL_HL : WIN_FILL) : (hl ? LOSE_FILL_HL : LOSE_FILL);
        const border = box.isWin ? (hl ? WIN_BORDER_HL : WIN_BORDER) : (hl ? LOSE_BORDER_HL : LOSE_BORDER);

        // Main trade box
        ctx.fillStyle = fill;
        ctx.fillRect(x1, y1, w, Math.max(h, 2));

        ctx.strokeStyle = border;
        ctx.lineWidth = hl ? 2 : 1;
        ctx.setLineDash([]);
        ctx.strokeRect(x1, y1, w, Math.max(h, 2));

        // Entry marker — solid line at entry price
        ctx.strokeStyle = ENTRY_COLOR;
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(x1, box.yEntry);
        ctx.lineTo(x2, box.yEntry);
        ctx.stroke();

        // Exit marker — dashed line at exit price
        ctx.strokeStyle = EXIT_COLOR;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(x1, box.yExit);
        ctx.lineTo(x2, box.yExit);
        ctx.stroke();
        ctx.setLineDash([]);

        // Direction + PnL label (top-left of box)
        const labelY = y1;
        ctx.font = `bold ${hl ? 10 : 9}px 'Chakra Petch', monospace`;
        ctx.textBaseline = "bottom";
        ctx.textAlign = "left";

        // Background pill for label
        const text = `${box.label} ${box.pnlLabel}`;
        const textW = ctx.measureText(text).width;
        const pillH = hl ? 14 : 12;
        const pillY = labelY - pillH - 2;
        ctx.fillStyle = box.isWin ? "rgba(38, 166, 154, 0.85)" : "rgba(239, 83, 80, 0.85)";
        ctx.beginPath();
        ctx.roundRect(x1, pillY, textW + 8, pillH, 3);
        ctx.fill();

        ctx.fillStyle = "#fff";
        ctx.fillText(text, x1 + 4, labelY - 3);

        // Entry/Exit price labels
        if (w > 50) {
          ctx.font = "8px monospace";
          ctx.textBaseline = "middle";
          ctx.textAlign = "right";
          ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
          ctx.fillText("ENTRY", x2 - 3, box.yEntry);
          ctx.fillText("EXIT", x2 - 3, box.yExit);
        }

        // Arrow showing direction
        const midX = (x1 + x2) / 2;
        const arrowY1 = box.yEntry;
        const arrowY2 = box.yExit;
        ctx.strokeStyle = border;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(midX, arrowY1);
        ctx.lineTo(midX, arrowY2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Arrowhead at exit
        const arrowDir = arrowY2 > arrowY1 ? 1 : -1;
        ctx.fillStyle = border;
        ctx.beginPath();
        ctx.moveTo(midX - 4, arrowY2 - arrowDir * 6);
        ctx.lineTo(midX + 4, arrowY2 - arrowDir * 6);
        ctx.lineTo(midX, arrowY2);
        ctx.closePath();
        ctx.fill();
      }
    });
  }

  draw(): void {}
}

class TradeBoxPaneView implements IPrimitivePaneView {
  _renderer = new TradeBoxRenderer();
  update(boxes: TradeBox[]) { this._renderer.update(boxes); }
  zOrder(): "bottom" { return "bottom"; }
  renderer(): IPrimitivePaneRenderer { return this._renderer; }
}

export class TradeBoxPrimitive implements ISeriesPrimitive<Time> {
  private _chart: IChartApi | null = null;
  private _series: ISeriesApi<"Candlestick"> | null = null;
  private _requestUpdate: (() => void) | null = null;
  private _paneView = new TradeBoxPaneView();
  private _trades: Trade[] = [];
  private _data: OHLCBar[] = [];
  private _highlightedId: string | null = null;

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

  setTrades(trades: Trade[], data: OHLCBar[]) {
    this._trades = trades;
    this._data = data;
    this.updateAllViews();
    this._requestUpdate?.();
  }

  setHighlighted(tradeId: string | null) {
    this._highlightedId = tradeId;
    this.updateAllViews();
    this._requestUpdate?.();
  }

  clear() {
    this._trades = [];
    this._highlightedId = null;
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
    const boxes: TradeBox[] = [];

    for (const trade of this._trades) {
      const entryT = typeof trade.entryTime === "string" ? Number(trade.entryTime) : trade.entryTime;
      const exitT = typeof trade.exitTime === "string" ? Number(trade.exitTime) : trade.exitTime;

      // Snap to nearest bar times
      const t1 = this._snapToBar(entryT);
      const t2 = this._snapToBar(exitT);
      if (!t1 || !t2) continue;

      const x1 = ts.timeToCoordinate(t1 as unknown as Time);
      const x2 = ts.timeToCoordinate(t2 as unknown as Time);
      const yEntry = series.priceToCoordinate(trade.entryPrice);
      const yExit = series.priceToCoordinate(trade.exitPrice);
      if (x1 == null || x2 == null || yEntry == null || yExit == null) continue;

      const isWin = trade.pnl >= 0;
      const isLong = trade.direction === "long";
      const pnlSign = isWin ? "+" : "";
      const pnlLabel = `${pnlSign}${trade.pnlPercent.toFixed(1)}%`;
      const label = isLong ? "LONG" : "SHORT";

      boxes.push({
        x1,
        x2,
        yEntry,
        yExit,
        yTp: null,
        ySl: null,
        isWin,
        isLong,
        label,
        pnlLabel,
        isHighlighted: trade.id === this._highlightedId,
      });
    }

    this._paneView.update(boxes);
  }

  private _snapToBar(timestamp: number): number | null {
    let best: number | null = null;
    let bestD = Infinity;
    for (const bar of this._data) {
      const t = typeof bar.time === "string" ? Number(bar.time) : (bar.time as number);
      const d = Math.abs(t - timestamp);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this._paneView];
  }
}
