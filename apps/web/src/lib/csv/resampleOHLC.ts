import type { OHLCBar } from "@/types";

const TARGET_CHART_BARS = 6000;

// Bucket sizes in seconds, ordered smallest to largest
const TIMEFRAMES: [string, number][] = [
  ["5min", 300],
  ["15min", 900],
  ["30min", 1800],
  ["1h", 3600],
  ["2h", 7200],
  ["4h", 14400],
  ["12h", 43200],
  ["1D", 86400],
  ["1W", 604800],
];

function aggregateBuckets(
  data: OHLCBar[],
  bucketSeconds: number
): OHLCBar[] {
  const buckets = new Map<
    number,
    { open: number; high: number; low: number; close: number; volume: number; time: number }
  >();

  for (const bar of data) {
    const t = bar.time as number;
    const bucket = Math.floor(t / bucketSeconds) * bucketSeconds;

    const existing = buckets.get(bucket);
    if (!existing) {
      buckets.set(bucket, {
        time: bucket,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume ?? 0,
      });
    } else {
      existing.high = Math.max(existing.high, bar.high);
      existing.low = Math.min(existing.low, bar.low);
      existing.close = bar.close; // last close
      existing.volume += bar.volume ?? 0;
    }
  }

  // Sort by time
  return Array.from(buckets.values()).sort((a, b) => a.time - b.time);
}

export function resampleOHLC(
  data: OHLCBar[],
  targetBars: number = TARGET_CHART_BARS
): OHLCBar[] {
  if (data.length <= targetBars) return data;

  for (const [, seconds] of TIMEFRAMES) {
    const result = aggregateBuckets(data, seconds);
    if (result.length <= targetBars) return result;
  }

  // Fallback: use 1W even if over target
  return aggregateBuckets(data, 604800);
}
