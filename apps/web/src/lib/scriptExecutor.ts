import type { OHLCBar, PatternMatch } from "@/types";

interface RawMatch {
  start_idx: number;
  end_idx: number;
  confidence: number;
  pattern_type: string;
}

/**
 * Execute a JavaScript pattern detection script against OHLC data.
 *
 * The script receives `data` (OHLCBar[]) and must return an array of
 * { start_idx, end_idx, confidence, pattern_type } objects.
 *
 * Uses a Blob Worker to avoid CSP restrictions on eval/new Function.
 */
export async function executePatternScript(
  script: string,
  data: OHLCBar[]
): Promise<PatternMatch[]> {
  // Safety checks
  const blocked = [
    "import ", "require(", "fetch(", "XMLHttpRequest",
    "eval(", "document.", "window.", "globalThis",
    "process.", "localStorage", "sessionStorage",
  ];
  for (const token of blocked) {
    if (script.includes(token)) {
      throw new Error(`Script contains blocked token: "${token}"`);
    }
  }

  let body = script.trim();
  if (!body.includes("return results")) {
    body += "\nreturn results;";
  }

  // Execute in a blob-based web worker to bypass CSP
  const rawResults = await runInWorker(body, data);

  if (!Array.isArray(rawResults)) {
    throw new Error("Script must return an array of results");
  }

  // Convert raw matches to PatternMatch type
  return rawResults.map((m: RawMatch) => {
    const si = Math.max(0, Math.min(m.start_idx, data.length - 1));
    const ei = Math.max(0, Math.min(m.end_idx, data.length - 1));

    const ptype = m.pattern_type || "unknown";
    const lower = ptype.toLowerCase();
    let direction: "bullish" | "bearish" | "neutral" = "neutral";
    if (["bullish", "bottom", "breakout", "buy", "engulfing"].some((k) => lower.includes(k))) {
      direction = "bullish";
    } else if (["bearish", "top", "breakdown", "sell"].some((k) => lower.includes(k))) {
      direction = "bearish";
    }

    return {
      id: crypto.randomUUID(),
      name: ptype.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      startIndex: si,
      endIndex: ei,
      startTime: String(data[si].time),
      endTime: String(data[ei].time),
      direction,
      confidence: m.confidence,
    };
  });
}

function runInWorker(scriptBody: string, data: OHLCBar[]): Promise<RawMatch[]> {
  return new Promise((resolve, reject) => {
    const workerCode = `
      self.onmessage = function(e) {
        try {
          const data = e.data;
          const fn = new Function("data", "Math", ${JSON.stringify(scriptBody)});
          const results = fn(data, Math);
          self.postMessage({ ok: true, results });
        } catch (err) {
          self.postMessage({ ok: false, error: err.message || String(err) });
        }
      };
    `;

    const blob = new Blob([workerCode], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);

    const timeout = setTimeout(() => {
      worker.terminate();
      URL.revokeObjectURL(url);
      reject(new Error("Script execution timed out (10s)"));
    }, 10000);

    worker.onmessage = (e) => {
      clearTimeout(timeout);
      worker.terminate();
      URL.revokeObjectURL(url);
      if (e.data.ok) {
        resolve(e.data.results);
      } else {
        reject(new Error(`Script execution failed: ${e.data.error}`));
      }
    };

    worker.onerror = (e) => {
      clearTimeout(timeout);
      worker.terminate();
      URL.revokeObjectURL(url);
      reject(new Error(`Worker error: ${e.message}`));
    };

    worker.postMessage(data);
  });
}
