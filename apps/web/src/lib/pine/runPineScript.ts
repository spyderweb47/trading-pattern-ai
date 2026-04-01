import { PineTS } from "pinets";
import { LocalProvider } from "./localProvider";
import type { OHLCBar } from "@/types";

export interface PineResult {
  /** Plot values keyed by plot name. Each is an array of (number | null) aligned to input bars */
  plots: Record<string, (number | null)[]>;
  /** Names of all plots in order */
  plotNames: string[];
  /** Errors if any */
  error?: string;
}

/**
 * Execute a Pine Script against local OHLC data using PineTS.
 *
 * Returns plot values that can be rendered as indicator lines on the chart.
 */
export async function runPineScript(
  pineCode: string,
  data: OHLCBar[],
  symbol = "LOCAL",
  timeframe = "D"
): Promise<PineResult> {
  if (!data || data.length === 0) {
    return { plots: {}, plotNames: [], error: "No data provided" };
  }

  try {
    // Create provider with our local data
    const provider = new LocalProvider();
    provider.loadData(data, symbol, timeframe);

    // Create PineTS instance with the local provider
    const pine = new PineTS(provider, symbol, timeframe, data.length);

    // Run the Pine Script
    const result = await pine.run(pineCode);

    // Extract plot data
    const plots: Record<string, (number | null)[]> = {};
    const plotNames: string[] = [];

    if (result && result.plots) {
      for (const [name, values] of Object.entries(result.plots)) {
        if (Array.isArray(values)) {
          plotNames.push(name);
          plots[name] = values.map((v: unknown) =>
            v === null || v === undefined || (typeof v === "number" && isNaN(v))
              ? null
              : Number(v)
          );
        }
      }
    }

    return { plots, plotNames };
  } catch (err) {
    return {
      plots: {},
      plotNames: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
