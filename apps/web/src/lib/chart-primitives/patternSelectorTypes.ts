import type { Time } from "lightweight-charts";

export interface BoxBounds {
  startTime: Time;
  endTime: Time;
  topPrice: number;
  bottomPrice: number;
}

export type DrawingPhase = "idle" | "trigger" | "trade";

export type DragHandle =
  | "trigger-body"
  | "trigger-left"
  | "trigger-right"
  | "trigger-top"
  | "trigger-bottom"
  | "trade-body"
  | "trade-right"
  | "trade-top"
  | "trade-bottom"
  | null;

export interface PatternSelectorState {
  triggerBox: BoxBounds | null;
  tradeBox: BoxBounds | null;
  drawingPhase: DrawingPhase;
}

export interface PixelBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
