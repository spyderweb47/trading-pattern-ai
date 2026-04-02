import type { Time } from "lightweight-charts";

export type DrawingType =
  | "trendline"
  | "horizontal_line"
  | "vertical_line"
  | "rectangle"
  | "fibonacci"
  | "long_position"
  | "short_position"
  | "pattern_select";

export interface AnchorPoint {
  time: Time;
  price: number;
}

export interface Drawing {
  id: string;
  type: DrawingType;
  /** Trendline: [start, end]. Position: [entry, tp, sl] stored as prices. */
  points: AnchorPoint[];
  /** For position tools: entry, tp, sl prices */
  entry?: number;
  tp?: number;
  sl?: number;
  /** Time range for position box width */
  timeStart?: Time;
  timeEnd?: Time;
  /** Fibonacci levels (default: 0, 0.236, 0.382, 0.5, 0.618, 0.786, 1) */
  fibLevels?: number[];
  selected: boolean;
}

export type DrawingPhase = "idle" | "placing_first" | "placing_second" | "done";
