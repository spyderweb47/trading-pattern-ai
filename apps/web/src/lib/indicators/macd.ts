import type { OHLCBar } from "@/types";
import { ewm, closes } from "./mathUtils";

export function macd(
  data: OHLCBar[],
  params: Record<string, unknown>
): (number | null)[] {
  const fastPeriod = Number(params.fast_period) || 12;
  const slowPeriod = Number(params.slow_period) || 26;
  const close = closes(data);

  const fastAlpha = 2 / (fastPeriod + 1);
  const slowAlpha = 2 / (slowPeriod + 1);

  const fastEma = ewm(close, fastAlpha, fastPeriod);
  const slowEma = ewm(close, slowAlpha, slowPeriod);

  // MACD line = fast EMA - slow EMA
  const macdLine: (number | null)[] = new Array(close.length).fill(null);
  for (let i = 0; i < close.length; i++) {
    if (fastEma[i] !== null && slowEma[i] !== null) {
      macdLine[i] = fastEma[i]! - slowEma[i]!;
    }
  }

  // Return MACD line (matches backend which returns first column)
  return macdLine;
}
