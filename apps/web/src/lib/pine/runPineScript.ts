import { PineTS } from "pinets";
import { LocalProvider } from "./localProvider";
import { extractPineDrawings, type PineDrawings } from "./pineDrawings";
import type { OHLCBar } from "@/types";

export interface PineResult {
  /** Plot values keyed by plot name. Each is an array of (number | null) aligned to input bars */
  plots: Record<string, (number | null)[]>;
  /** Names of all plots in order */
  plotNames: string[];
  /** Drawing objects (boxes, lines, labels) from the Pine Script */
  drawings: PineDrawings;
  /** Errors if any */
  error?: string;
}

// Internal plot names used by PineTS for drawing objects — not actual indicator plots
const INTERNAL_PLOTS = new Set([
  "__labels__",
  "__lines__",
  "__boxes__",
  "__linefills__",
  "__polylines__",
  "__tables__",
]);

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
    return { plots: {}, plotNames: [], drawings: { boxes: [], lines: [], labels: [] }, error: "No data provided" };
  }

  try {
    // Create provider with our local data
    const provider = new LocalProvider();
    provider.loadData(data, symbol, timeframe);

    // Create PineTS instance with the local provider
    const pine = new PineTS(provider, symbol, timeframe, data.length);

    // Run the Pine Script — returns a Context object
    const ctx = await pine.run(pineCode);

    // Extract plot data from Context
    const plots: Record<string, (number | null)[]> = {};
    const plotNames: string[] = [];

    if (ctx && ctx.plots) {
      for (const [name, plotObj] of Object.entries(ctx.plots)) {
        // Skip internal drawing plots
        if (INTERNAL_PLOTS.has(name)) continue;

        const obj = plotObj as any;

        // PineTS plots are objects with a .data array of { time, value, options }
        if (obj && obj.data && Array.isArray(obj.data)) {
          plotNames.push(name);
          plots[name] = obj.data.map((d: any) =>
            d.value === null || d.value === undefined || (typeof d.value === "number" && isNaN(d.value))
              ? null
              : Number(d.value)
          );
        }
      }
    }

    // Extract drawing objects (boxes, lines, labels)
    const drawings = ctx?.plots ? extractPineDrawings(ctx.plots) : { boxes: [], lines: [], labels: [] };

    return { plots, plotNames, drawings };
  } catch (err) {
    return {
      plots: {},
      plotNames: [],
      drawings: { boxes: [], lines: [], labels: [] },
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
