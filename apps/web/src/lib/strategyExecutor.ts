import type { OHLCBar, BacktestResult, Trade } from "@/types";

interface StrategyConfig {
  stopLoss: number;
  takeProfit: number;
}

interface RawStrategyResult {
  trades: Array<{
    type: "long" | "short";
    entryIdx: number;
    exitIdx: number;
    entryPrice: number;
    exitPrice: number;
    pnl: number;
    pnlPercent: number;
    reason: string;
  }>;
  signals: Array<{
    idx: number;
    type: "entry_long" | "entry_short" | "exit";
    price: number;
  }>;
  equity: number[];
}

/**
 * Execute a JavaScript strategy script against OHLC data in a Web Worker.
 * Returns backtest results ready for the store.
 */
export async function executeStrategy(
  script: string,
  data: OHLCBar[],
  config: StrategyConfig
): Promise<BacktestResult> {
  const raw = await runStrategyInWorker(script, data, config);

  // Convert to BacktestResult
  const trades: Trade[] = raw.trades.map((t, i) => ({
    id: `trade-${i}`,
    entryTime: String(data[t.entryIdx]?.time || ""),
    exitTime: String(data[t.exitIdx]?.time || ""),
    entryPrice: t.entryPrice,
    exitPrice: t.exitPrice,
    direction: t.type,
    quantity: 1,
    pnl: t.pnl,
    pnlPercent: t.pnlPercent,
    reason: t.reason,
  }));

  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl <= 0);
  const winRate = trades.length > 0 ? wins.length / trades.length : 0;
  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  // Max drawdown from equity curve
  let maxDD = 0;
  let peak = raw.equity[0] || 10000;
  for (const eq of raw.equity) {
    if (eq > peak) peak = eq;
    const dd = (peak - eq) / peak;
    if (dd > maxDD) maxDD = dd;
  }

  const totalReturn = raw.equity.length > 0
    ? (raw.equity[raw.equity.length - 1] - 10000) / 10000
    : 0;

  // Simple Sharpe approximation
  const returns: number[] = [];
  for (let i = 1; i < raw.equity.length; i++) {
    returns.push((raw.equity[i] - raw.equity[i - 1]) / raw.equity[i - 1]);
  }
  const avgReturn = returns.length > 0 ? returns.reduce((s, r) => s + r, 0) / returns.length : 0;
  const stdReturn = returns.length > 1
    ? Math.sqrt(returns.reduce((s, r) => s + (r - avgReturn) ** 2, 0) / (returns.length - 1))
    : 0;
  const sharpe = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252) : 0;

  return {
    strategyId: "live",
    strategyName: "Strategy",
    totalTrades: trades.length,
    winRate,
    profitFactor: Math.round(profitFactor * 100) / 100,
    sharpeRatio: Math.round(sharpe * 100) / 100,
    maxDrawdown: Math.round(maxDD * 10000) / 10000,
    totalReturn: Math.round(totalReturn * 10000) / 10000,
    annualizedReturn: 0,
    trades,
    equityCurve: raw.equity.map((v, i) => ({
      time: String(data[Math.min(i + 21, data.length - 1)]?.time || ""),
      value: Math.round(v * 100) / 100,
    })),
  };
}

function runStrategyInWorker(
  script: string,
  data: OHLCBar[],
  config: StrategyConfig
): Promise<RawStrategyResult> {
  return new Promise((resolve, reject) => {
    let body = script.trim();
    if (!body.includes("return {") && !body.includes("return{")) {
      body += "\nreturn { trades, signals, equity };";
    }

    const workerCode = `
      self.onmessage = function(e) {
        try {
          var data = e.data.data;
          var config = e.data.config;
          var script = e.data.script;
          var fn = new Function("data", "config", "Math", script);
          var result = fn(data, config, Math);
          self.postMessage({ ok: true, result: result });
        } catch (err) {
          self.postMessage({ ok: false, error: (err.message || String(err)) });
        }
      };
    `;

    const blob = new Blob([workerCode], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);

    const timeout = setTimeout(() => {
      worker.terminate();
      URL.revokeObjectURL(url);
      reject(new Error("Strategy execution timed out (30s)"));
    }, 30000);

    worker.onmessage = (e) => {
      clearTimeout(timeout);
      worker.terminate();
      URL.revokeObjectURL(url);
      if (e.data.ok) {
        resolve(e.data.result);
      } else {
        reject(new Error(`Strategy failed: ${e.data.error}`));
      }
    };

    worker.onerror = (e) => {
      clearTimeout(timeout);
      worker.terminate();
      URL.revokeObjectURL(url);
      reject(new Error(`Worker error: ${e.message}`));
    };

    worker.postMessage({ data, config, script: body });
  });
}
