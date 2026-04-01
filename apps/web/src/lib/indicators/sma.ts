import type { OHLCBar } from "@/types";
import { rollingMean, closes } from "./mathUtils";

export function sma(
  data: OHLCBar[],
  params: Record<string, unknown>
): (number | null)[] {
  const period = Number(params.period) || 20;
  return rollingMean(closes(data), period);
}
