import type { OHLCBar } from "@/types";

export function vwap(
  data: OHLCBar[],
  params: Record<string, unknown>
): (number | null)[] {
  const resetPeriod = params.reset_period as string | null;
  const n = data.length;
  const out: (number | null)[] = new Array(n).fill(null);

  let cumTpVol = 0;
  let cumVol = 0;
  let lastBucket = -1;

  for (let i = 0; i < n; i++) {
    const bar = data[i];
    const time = typeof bar.time === "number" ? bar.time : new Date(bar.time).getTime() / 1000;
    const tp = (bar.high + bar.low + bar.close) / 3;
    const vol = bar.volume ?? 0;

    // Reset at day boundary if reset_period is set
    if (resetPeriod) {
      const bucket = Math.floor(time / 86400);
      if (bucket !== lastBucket) {
        cumTpVol = 0;
        cumVol = 0;
        lastBucket = bucket;
      }
    }

    cumTpVol += tp * vol;
    cumVol += vol;
    out[i] = cumVol > 0 ? cumTpVol / cumVol : null;
  }

  return out;
}
