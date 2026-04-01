import type { OHLCBar } from "@/types";
import { rollingMean, rollingStd, closes } from "./mathUtils";

export function bollinger(
  data: OHLCBar[],
  params: Record<string, unknown>
): (number | null)[] {
  const period = Number(params.period) || 20;
  const numStd = Number(params.num_std) || 2;
  const close = closes(data);

  // Return middle band (matches backend which returns first column = bb_middle)
  return rollingMean(close, period);
}
