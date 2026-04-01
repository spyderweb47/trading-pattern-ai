"""
Backtesting router.

Runs a strategy against historical data using the core BacktestEngine
and returns performance metrics, trade log, and equity curve.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException

from core.backtesting.engine import BacktestConfig, BacktestEngine
from services.api.models import (
    BacktestMetricsResponse,
    RunBacktestRequest,
    RunBacktestResponse,
    TradeLogEntry,
)
from services.api.store import store

router = APIRouter(tags=["backtest"])


@router.post("/run-backtest", response_model=RunBacktestResponse)
async def run_backtest(request: RunBacktestRequest) -> RunBacktestResponse:
    """
    Run a backtest of a strategy against a stored dataset.

    The strategy script must define `entry_condition` and `exit_condition`
    functions. Results include metrics, a full trade log, and an equity curve.
    """
    df = store.get_dataframe(request.dataset_id)
    if df is None:
        raise HTTPException(status_code=404, detail=f"Dataset '{request.dataset_id}' not found.")

    # Execute the strategy script to extract entry_condition and exit_condition.
    strategy = request.strategy
    try:
        entry_fn, exit_fn = _compile_strategy(strategy.script)
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Failed to compile strategy script: {exc}",
        )

    config = BacktestConfig(
        entry_condition=entry_fn,
        exit_condition=exit_fn,
        stop_loss_pct=strategy.stop_loss_pct,
        take_profit_pct=strategy.take_profit_pct,
        position_size=strategy.position_size,
    )

    try:
        engine = BacktestEngine(df, initial_capital=strategy.initial_capital)
        result = engine.run(config)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Backtest execution failed: {exc}",
        )

    # Convert metrics dataclass to response model.
    metrics = BacktestMetricsResponse(
        total_pnl=result.metrics.total_pnl,
        total_trades=result.metrics.total_trades,
        winning_trades=result.metrics.winning_trades,
        losing_trades=result.metrics.losing_trades,
        win_rate=result.metrics.win_rate,
        max_drawdown=result.metrics.max_drawdown,
        max_drawdown_pct=result.metrics.max_drawdown_pct,
        sharpe_ratio=result.metrics.sharpe_ratio,
        profit_factor=result.metrics.profit_factor if result.metrics.profit_factor != float("inf") else 9999.99,
        avg_win=result.metrics.avg_win,
        avg_loss=result.metrics.avg_loss,
        max_consecutive_wins=result.metrics.max_consecutive_wins,
        max_consecutive_losses=result.metrics.max_consecutive_losses,
        expectancy=result.metrics.expectancy,
    )

    trade_log = [
        TradeLogEntry(
            entry_time=str(t.get("entry_time")) if t.get("entry_time") is not None else None,
            exit_time=str(t.get("exit_time")) if t.get("exit_time") is not None else None,
            entry_price=t["entry_price"],
            exit_price=t["exit_price"],
            direction=t["direction"],
            pnl=t["pnl"],
            size=t["size"],
            reason=t["reason"],
        )
        for t in result.trade_log
    ]

    return RunBacktestResponse(
        metrics=metrics,
        trade_log=trade_log,
        equity_curve=result.equity_curve,
        total_bars=result.total_bars,
    )


def _compile_strategy(script: str):
    """
    Execute a strategy script and extract entry_condition and exit_condition
    functions from its namespace.

    Raises ValueError if the required functions are not defined.
    """
    namespace: Dict[str, Any] = {}
    exec(script, namespace)  # noqa: S102

    entry_fn = namespace.get("entry_condition")
    exit_fn = namespace.get("exit_condition")

    if entry_fn is None or not callable(entry_fn):
        raise ValueError(
            "Strategy script must define a callable 'entry_condition' function."
        )
    if exit_fn is None or not callable(exit_fn):
        raise ValueError(
            "Strategy script must define a callable 'exit_condition' function."
        )

    return entry_fn, exit_fn
