import type { OHLCBar, BacktestResult, Trade, PortfolioMetrics, StrategyConfig } from "@/types";

/**
 * Execute a JavaScript strategy script against OHLC data in a Web Worker.
 * Returns comprehensive backtest results with expanded metrics.
 */
export async function executeStrategy(
  script: string,
  data: OHLCBar[],
  config: StrategyConfig
): Promise<BacktestResult> {
  const workerConfig = {
    stopLoss: config.stopLoss.value,
    takeProfit: config.takeProfit.value,
    maxDrawdown: config.maxDrawdown,
    seedAmount: config.seedAmount,
  };

  const raw = await runStrategyInWorker(script, data, workerConfig);

  // Normalize equity
  const rawEq = raw.equity;
  const equityArr: number[] = Array.isArray(rawEq)
    ? rawEq
    : typeof rawEq === "number"
      ? [rawEq]
      : [config.seedAmount];

  // Normalize trades
  const rawTrades = Array.isArray(raw.trades) ? raw.trades : [];
  const trades: Trade[] = rawTrades
    .filter((t: any) => t.entryPrice != null && t.exitPrice != null)
    .map((t: any, i: number) => {
      const entryPrice = t.entryPrice || 0;
      const exitPrice = t.exitPrice || 0;
      const dir = t.type || t.direction || "long";
      const isLong = dir === "long";
      const pnl = t.pnl ?? (isLong ? exitPrice - entryPrice : entryPrice - exitPrice);
      const pnlPct = t.pnlPercent ?? t.pnlPct ?? (entryPrice !== 0 ? (pnl / entryPrice) * 100 : 0);
      const entryIdx = t.entryIdx ?? t.index ?? t.entryIndex ?? 0;
      const exitIdx = t.exitIdx ?? t.exitIndex ?? entryIdx + 1;

      return {
        id: `trade-${i}`,
        entryTime: String(data[Math.min(entryIdx, data.length - 1)]?.time || ""),
        exitTime: String(data[Math.min(exitIdx, data.length - 1)]?.time || ""),
        entryPrice,
        exitPrice,
        direction: isLong ? "long" as const : "short" as const,
        quantity: 1,
        pnl: Math.round(pnl * 100) / 100,
        pnlPercent: Math.round(pnlPct * 100) / 100,
        reason: t.reason || "",
        entryIdx,
        exitIdx,
        maxAdverseExcursion: t.maxAdverseExcursion ?? 0,
        maxFavorableExcursion: t.maxFavorableExcursion ?? 0,
        holdingBars: t.holdingBars ?? (exitIdx - entryIdx),
        drawdownAtEntry: 0,
        entryReason: t.entryReason || "",
        exitReason: t.exitReason || "",
      };
    });

  // Compute expanded metrics
  const metrics = computeMetrics(trades, equityArr, config.seedAmount);
  const pnlPerTrade = trades.map((t) => t.pnl);

  // Compute drawdown at entry for each trade
  let peak = config.seedAmount;
  for (const trade of trades) {
    const eqAtEntry = equityArr[Math.min(trade.entryIdx || 0, equityArr.length - 1)] || config.seedAmount;
    if (eqAtEntry > peak) peak = eqAtEntry;
    trade.drawdownAtEntry = peak > 0 ? Math.round(((peak - eqAtEntry) / peak) * 10000) / 100 : 0;
  }

  return {
    strategyId: "live",
    strategyName: "Strategy",
    totalTrades: trades.length,
    winRate: metrics.winRate,
    profitFactor: metrics.profitFactor,
    sharpeRatio: metrics.sharpeRatio,
    maxDrawdown: metrics.maxDrawdown,
    totalReturn: metrics.totalReturn,
    annualizedReturn: 0,
    trades,
    equityCurve: equityArr.map((v, i) => ({
      time: String(data[Math.min(i, data.length - 1)]?.time || ""),
      value: Math.round(v * 100) / 100,
    })),
    metrics,
    pnlPerTrade,
  };
}

function computeMetrics(trades: Trade[], equity: number[], seed: number): PortfolioMetrics {
  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl <= 0);
  const winRate = trades.length > 0 ? wins.length / trades.length : 0;
  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;

  // Max drawdown
  let maxDD = 0, peak = equity[0] || seed;
  for (const eq of equity) {
    if (eq > peak) peak = eq;
    const dd = (peak - eq) / peak;
    if (dd > maxDD) maxDD = dd;
  }

  const totalReturn = equity.length > 0 ? (equity[equity.length - 1] - seed) / seed : 0;

  // Sharpe
  const returns: number[] = [];
  for (let i = 1; i < equity.length; i++) {
    if (equity[i - 1] > 0) returns.push((equity[i] - equity[i - 1]) / equity[i - 1]);
  }
  const avgReturn = returns.length > 0 ? returns.reduce((s, r) => s + r, 0) / returns.length : 0;
  const stdReturn = returns.length > 1
    ? Math.sqrt(returns.reduce((s, r) => s + (r - avgReturn) ** 2, 0) / (returns.length - 1))
    : 0;
  const sharpe = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252) : 0;

  // Avg/largest win/loss
  const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
  const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;
  const largestWin = wins.length > 0 ? Math.max(...wins.map((t) => t.pnl)) : 0;
  const largestLoss = losses.length > 0 ? Math.min(...losses.map((t) => t.pnl)) : 0;

  // Holding bars
  const avgHolding = trades.length > 0
    ? trades.reduce((s, t) => s + (t.holdingBars || 0), 0) / trades.length
    : 0;

  // Win/lose streaks
  let winStreak = 0, loseStreak = 0, curWin = 0, curLose = 0;
  for (const t of trades) {
    if (t.pnl > 0) { curWin++; curLose = 0; winStreak = Math.max(winStreak, curWin); }
    else { curLose++; curWin = 0; loseStreak = Math.max(loseStreak, curLose); }
  }

  return {
    totalTrades: trades.length,
    winRate: Math.round(winRate * 10000) / 10000,
    profitFactor: Math.round(profitFactor * 100) / 100,
    sharpeRatio: Math.round(sharpe * 100) / 100,
    maxDrawdown: Math.round(maxDD * 10000) / 10000,
    totalReturn: Math.round(totalReturn * 10000) / 10000,
    avgWin: Math.round(avgWin * 100) / 100,
    avgLoss: Math.round(avgLoss * 100) / 100,
    largestWin: Math.round(largestWin * 100) / 100,
    largestLoss: Math.round(largestLoss * 100) / 100,
    avgHoldingBars: Math.round(avgHolding),
    winStreak,
    loseStreak,
  };
}

function runStrategyInWorker(
  script: string,
  data: OHLCBar[],
  config: Record<string, number>
): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = script.trim();

    // Detect function-wrapped scripts
    const funcMatch = body.match(/^function\s+(\w+)\s*\(\s*data\s*,\s*config\s*\)/);
    const arrowMatch = body.match(/^const\s+(\w+)\s*=\s*\(\s*data\s*,\s*config\s*\)\s*=>/);
    if (funcMatch) body += `\nreturn ${funcMatch[1]}(data, config);`;
    else if (arrowMatch) body += `\nreturn ${arrowMatch[1]}(data, config);`;
    else if (!body.includes("return {") && !body.includes("return{") && !body.includes("return ")) {
      body += "\nreturn { trades: trades || [], equity: equity || [] };";
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
      if (e.data.ok) resolve(e.data.result);
      else reject(new Error(`Strategy failed: ${e.data.error}`));
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
