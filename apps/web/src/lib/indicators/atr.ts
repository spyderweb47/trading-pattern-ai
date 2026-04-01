import type { OHLCBar } from "@/types";
import { ewm } from "./mathUtils";

export function atr(
  data: OHLCBar[],
  params: Record<string, unknown>
): (number | null)[] {
  const period = Number(params.period) || 14;
  const n = data.length;
  const tr: (number | null)[] = new Array(n).fill(null);

  for (let i = 0; i < n; i++) {
    const hl = data[i].high - data[i].low;
    if (i === 0) {
      tr[i] = hl;
      continue;
    }
    const prevClose = data[i - 1].close;
    const hpc = Math.abs(data[i].high - prevClose);
    const lpc = Math.abs(data[i].low - prevClose);
    tr[i] = Math.max(hl, hpc, lpc);
  }

  // Wilder's smoothing: alpha = 1/period
  return ewm(tr, 1 / period, period);
}
