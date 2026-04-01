import type { OHLCBar } from "@/types";
import { ewm, closes } from "./mathUtils";

export function ema(
  data: OHLCBar[],
  params: Record<string, unknown>
): (number | null)[] {
  const period = Number(params.period) || 20;
  const alpha = 2 / (period + 1);
  const values = closes(data);
  return ewm(values, alpha, period);
}
