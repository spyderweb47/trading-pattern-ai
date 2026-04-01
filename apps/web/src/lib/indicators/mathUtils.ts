import type { OHLCBar } from "@/types";

/** Exponential weighted mean (adjust=false). */
export function ewm(
  values: (number | null)[],
  alpha: number,
  minPeriods: number
): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  let prev: number | null = null;
  let count = 0;

  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v === null || isNaN(v)) {
      out[i] = null;
      continue;
    }
    count++;
    if (prev === null) {
      prev = v;
    } else {
      prev = alpha * v + (1 - alpha) * prev;
    }
    out[i] = count >= minPeriods ? prev : null;
  }
  return out;
}

/** Simple rolling mean. */
export function rollingMean(
  values: number[],
  period: number
): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/** Simple rolling standard deviation (population). */
export function rollingStd(
  values: number[],
  period: number
): (number | null)[] {
  const means = rollingMean(values, period);
  const out: (number | null)[] = new Array(values.length).fill(null);

  for (let i = period - 1; i < values.length; i++) {
    const mean = means[i]!;
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const d = values[j] - mean;
      sumSq += d * d;
    }
    // ddof=1 to match pandas default
    out[i] = Math.sqrt(sumSq / (period - 1));
  }
  return out;
}

/** Extract close prices as number array. */
export function closes(data: OHLCBar[]): number[] {
  return data.map((b) => b.close);
}
