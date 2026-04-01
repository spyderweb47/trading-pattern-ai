import type { OHLCBar } from "@/types";
import { ewm, closes } from "./mathUtils";

export function rsi(
  data: OHLCBar[],
  params: Record<string, unknown>
): (number | null)[] {
  const period = Number(params.period) || 14;
  const close = closes(data);
  const n = close.length;
  const out: (number | null)[] = new Array(n).fill(null);

  if (n < 2) return out;

  // Compute deltas
  const gains: (number | null)[] = [null];
  const losses: (number | null)[] = [null];
  for (let i = 1; i < n; i++) {
    const d = close[i] - close[i - 1];
    gains.push(d > 0 ? d : 0);
    losses.push(d < 0 ? -d : 0);
  }

  // Wilder's smoothing: alpha = 1/period
  const alpha = 1 / period;
  const avgGain = ewm(gains, alpha, period);
  const avgLoss = ewm(losses, alpha, period);

  for (let i = 0; i < n; i++) {
    const ag = avgGain[i];
    const al = avgLoss[i];
    if (ag === null || al === null) continue;
    if (al === 0) {
      out[i] = 100;
    } else {
      out[i] = 100 - 100 / (1 + ag / al);
    }
  }

  return out;
}
