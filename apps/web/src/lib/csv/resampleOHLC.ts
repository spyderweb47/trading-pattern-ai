import type { OHLCBar } from "@/types";

const TARGET_CHART_BARS = 6000;

// Bucket sizes in seconds, ordered smallest to largest
const TIMEFRAMES: [string, number][] = [
  ["1min", 60],
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

/** Detect the native timeframe of OHLC data by looking at the median gap between bars */
export function detectTimeframe(data: OHLCBar[]): { label: string; seconds: number } {
  if (data.length < 2) return { label: "unknown", seconds: 0 };

  // Sample gaps from first 100 bars
  const gaps: number[] = [];
  const sampleSize = Math.min(100, data.length - 1);
  for (let i = 0; i < sampleSize; i++) {
    const gap = Math.abs((data[i + 1].time as number) - (data[i].time as number));
    if (gap > 0) gaps.push(gap);
  }
  if (gaps.length === 0) return { label: "unknown", seconds: 0 };

  // Use median gap (robust to missing bars)
  gaps.sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)];

  // Match to closest known timeframe
  let bestLabel = "custom";
  let bestDiff = Infinity;
  let bestSec = median;
  for (const [label, sec] of TIMEFRAMES) {
    const diff = Math.abs(median - sec);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestLabel = label;
      bestSec = sec;
    }
  }

  // Only match if within 20% tolerance
  if (bestDiff / bestSec > 0.2) {
    // Format custom timeframe
    if (median < 60) return { label: `${median}s`, seconds: median };
    if (median < 3600) return { label: `${Math.round(median / 60)}min`, seconds: median };
    if (median < 86400) return { label: `${Math.round(median / 3600)}h`, seconds: median };
    return { label: `${Math.round(median / 86400)}D`, seconds: median };
  }

  return { label: bestLabel, seconds: bestSec };
}

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

/** Resample raw data to a specific timeframe label. Returns raw data if native matches. */
export function resampleToTimeframe(data: OHLCBar[], timeframeLabel: string): OHLCBar[] {
  const entry = TIMEFRAMES.find(([label]) => label === timeframeLabel);
  if (!entry) return data;
  const [, seconds] = entry;

  // Check if data is already at this timeframe (no resampling needed)
  const native = detectTimeframe(data);
  if (Math.abs(native.seconds - seconds) / seconds < 0.2) return data;

  // Only resample UP (aggregate), not down
  if (native.seconds > seconds) return data;

  return aggregateBuckets(data, seconds);
}

/** Available timeframe labels for the UI */
export const AVAILABLE_TIMEFRAMES = TIMEFRAMES.map(([label]) => label);

export interface ResampleResult {
  data: OHLCBar[];
  /** The timeframe the chart data was resampled to (or native if no resampling needed) */
  chartTimeframe: string;
}

export function resampleOHLC(
  data: OHLCBar[],
  targetBars: number = TARGET_CHART_BARS
): ResampleResult {
  const native = detectTimeframe(data);

  if (data.length <= targetBars) {
    return { data, chartTimeframe: native.label };
  }

  for (const [label, seconds] of TIMEFRAMES) {
    const result = aggregateBuckets(data, seconds);
    if (result.length <= targetBars) {
      return { data: result, chartTimeframe: label };
    }
  }

  // Fallback: use 1W even if over target
  return { data: aggregateBuckets(data, 604800), chartTimeframe: "1W" };
}
