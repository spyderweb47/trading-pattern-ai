import type { OHLCBar } from "@/types";
import { sma } from "./sma";
import { ema } from "./ema";
import { rsi } from "./rsi";
import { macd } from "./macd";
import { bollinger } from "./bollinger";
import { atr } from "./atr";
import { vwap } from "./vwap";

type IndicatorFn = (data: OHLCBar[], params: Record<string, unknown>) => (number | null)[];

const registry: Record<string, IndicatorFn> = {
  sma,
  ema,
  rsi,
  macd,
  bollinger,
  atr,
  vwap,
};

export function calculateIndicatorLocal(
  data: OHLCBar[],
  indicator: string,
  params: Record<string, unknown>
): (number | null)[] {
  const fn = registry[indicator.toLowerCase()];
  if (!fn) throw new Error(`Unknown indicator: ${indicator}`);
  return fn(data, params);
}
