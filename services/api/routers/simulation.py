"""
Simulation router.

Runs a bar-by-bar replay simulation using the core SimulationEngine.
"""

from __future__ import annotations

from dataclasses import asdict
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException

from core.engine.simulation_engine import SimulationEngine
from services.api.models import SimulateRequest, SimulateResponse
from services.api.store import store

router = APIRouter(tags=["simulation"])


@router.post("/simulate", response_model=SimulateResponse)
async def simulate(request: SimulateRequest) -> SimulateResponse:
    """
    Run a bar-by-bar simulation of a strategy against a stored dataset.

    The strategy script must define a `strategy_fn` function with the
    signature: strategy_fn(bar_idx, bar, history_df, positions) -> list[dict].
    The speed parameter controls how many bars to advance per tick.
    """
    df = store.get_dataframe(request.dataset_id)
    if df is None:
        raise HTTPException(status_code=404, detail=f"Dataset '{request.dataset_id}' not found.")

    strategy = request.strategy

    try:
        strategy_fn = _compile_simulation_strategy(strategy.script)
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Failed to compile simulation strategy: {exc}",
        )

    try:
        engine = SimulationEngine(
            df=df,
            initial_capital=strategy.initial_capital,
            bars_per_tick=request.speed,
        )
        result = engine.run(strategy_fn)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Simulation failed: {exc}",
        )

    # Convert ClosedTrade dataclass instances to dicts.
    trade_log: List[Dict[str, Any]] = []
    for trade in result.trade_log:
        trade_dict = asdict(trade)
        # Convert non-serializable time values to strings.
        if trade_dict.get("entry_time") is not None:
            trade_dict["entry_time"] = str(trade_dict["entry_time"])
        if trade_dict.get("exit_time") is not None:
            trade_dict["exit_time"] = str(trade_dict["exit_time"])
        trade_log.append(trade_dict)

    return SimulateResponse(
        total_pnl=result.total_pnl,
        total_trades=result.total_trades,
        bars_processed=result.bars_processed,
        equity_curve=result.equity_curve,
        trade_log=trade_log,
    )


def _compile_simulation_strategy(script: str):
    """
    Execute a strategy script and extract the strategy_fn function.

    The function must accept (bar_idx, bar, history_df, positions) and
    return a list of action dicts.

    Falls back to wrapping entry_condition/exit_condition if strategy_fn
    is not defined directly.
    """
    namespace: Dict[str, Any] = {}
    exec(script, namespace)  # noqa: S102

    # Prefer an explicitly defined strategy_fn.
    if "strategy_fn" in namespace and callable(namespace["strategy_fn"]):
        return namespace["strategy_fn"]

    # Fall back to wrapping entry_condition / exit_condition.
    entry_fn = namespace.get("entry_condition")
    exit_fn = namespace.get("exit_condition")

    if entry_fn is None or exit_fn is None:
        raise ValueError(
            "Strategy script must define either 'strategy_fn' or both "
            "'entry_condition' and 'exit_condition'."
        )

    def _wrapped_strategy(bar_idx, bar, history_df, positions):
        """Adapter that converts entry/exit condition functions into action dicts."""
        actions = []

        # Check exits on existing positions.
        for pos in positions:
            should_exit = exit_fn(bar_idx, bar, history_df, {}, pos)
            if should_exit:
                actions.append({"action": "close"})
                break  # Close one at a time (FIFO).

        # Check entry if no positions (simplified single-position logic).
        if not positions:
            signal = entry_fn(bar_idx, bar, history_df, {})
            if signal == "long":
                actions.append({"action": "buy", "size": 1.0})
            elif signal == "short":
                actions.append({"action": "sell", "size": 1.0})

        return actions

    return _wrapped_strategy
