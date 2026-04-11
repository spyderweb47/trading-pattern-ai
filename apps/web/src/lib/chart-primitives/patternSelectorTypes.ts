import type { Time } from "lightweight-charts";

export interface BoxBounds {
  startTime: Time;
  endTime: Time;
  topPrice: number;
  bottomPrice: number;
}

export type DrawingPhase = "idle" | "pattern";

export type DragHandle =
  | "pattern-body"
  | "pattern-left"
  | "pattern-right"
  | "pattern-top"
  | "pattern-bottom"
  | null;

export interface PatternSelectorState {
  patternBox: BoxBounds | null;
  drawingPhase: DrawingPhase;
}

export interface PixelBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
