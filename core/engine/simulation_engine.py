"""
Historical data replay / simulation engine.

Replays OHLC bars one at a time, invoking a user-supplied strategy function
on each bar. Tracks positions, PnL, and equity curve.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Dict, List, Optional

import numpy as np
import pandas as pd


class Direction(str, Enum):
    LONG = "long"
    SHORT = "short"


@dataclass
class Position:
    """An open trading position."""

    direction: Direction
    entry_price: float
    entry_idx: int
    entry_time: Any
    size: float = 1.0
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None


@dataclass
class ClosedTrade:
    """Record of a completed trade."""

    direction: str
    entry_price: float
    exit_price: float
    entry_idx: int
    exit_idx: int
    entry_time: Any
    exit_time: Any
    pnl: float
    size: float
    reason: str  # e.g. "signal", "stop_loss", "take_profit"


@dataclass
class SimulationResult:
    """Aggregated results from a simulation run."""

    trade_log: List[ClosedTrade]
    equity_curve: List[float]
    total_pnl: float
    total_trades: int
    bars_processed: int


# Type alias for the strategy callback.
# Signature: strategy_fn(bar_idx, bar, history_df, positions) -> list[Action]
# where Action is a dict like:
#   {"action": "buy"/"sell"/"close", "size": float, "sl": float, "tp": float}
StrategyFn = Callable[
    [int, pd.Series, pd.DataFrame, List[Position]],
    List[Dict[str, Any]],
]


class SimulationEngine:
    """
    Bar-by-bar replay engine for historical OHLC data.

    Parameters
    ----------
    df : pd.DataFrame
        OHLC data with columns: time, open, high, low, close, volume.
    initial_capital : float
        Starting equity.
    bars_per_tick : int
        Number of bars to advance per simulation step (speed control).
    """

    def __init__(
        self,
        df: pd.DataFrame,
        initial_capital: float = 10000.0,
        bars_per_tick: int = 1,
    ) -> None:
        self.df = df.copy().reset_index(drop=True)
        self.initial_capital = initial_capital
        self.bars_per_tick = max(1, bars_per_tick)

        # State.
        self.capital: float = initial_capital
        self.positions: List[Position] = []
        self.closed_trades: List[ClosedTrade] = []
        self.equity_curve: List[float] = [initial_capital]
        self._current_idx: int = 0

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def run(self, strategy_fn: StrategyFn) -> SimulationResult:
        """
        Run the full simulation from first bar to last.

        Parameters
        ----------
        strategy_fn : StrategyFn
            Called on each bar with (bar_idx, bar_series, history_df, positions).
            Should return a list of action dicts.

        Returns
        -------
        SimulationResult
        """
        self._reset()
        n = len(self.df)

        while self._current_idx < n:
            bar = self.df.iloc[self._current_idx]

            # Check stop-loss / take-profit on open positions.
            self._check_exits(bar)

            # Build the history window (all bars up to and including current).
            history = self.df.iloc[: self._current_idx + 1]

            # Get strategy actions.
            actions = strategy_fn(
                self._current_idx, bar, history, list(self.positions)
            )

            # Process actions.
            for action in actions:
                self._process_action(action, bar)

            # Record equity (capital + unrealised PnL).
            unrealised = self._unrealised_pnl(bar)
            self.equity_curve.append(self.capital + unrealised)

            self._current_idx += self.bars_per_tick

        # Force-close any remaining positions at last bar close.
        if self.positions:
            last_bar = self.df.iloc[-1]
            for pos in list(self.positions):
                self._close_position(pos, last_bar, reason="end_of_data")

        total_pnl = self.capital - self.initial_capital
        return SimulationResult(
            trade_log=list(self.closed_trades),
            equity_curve=list(self.equity_curve),
            total_pnl=total_pnl,
            total_trades=len(self.closed_trades),
            bars_processed=min(self._current_idx, len(self.df)),
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _reset(self) -> None:
        """Reset all state to initial values."""
        self.capital = self.initial_capital
        self.positions = []
        self.closed_trades = []
        self.equity_curve = [self.initial_capital]
        self._current_idx = 0

    def _process_action(self, action: Dict[str, Any], bar: pd.Series) -> None:
        """Execute a single strategy action."""
        act = action.get("action", "").lower()

        if act in ("buy", "long"):
            pos = Position(
                direction=Direction.LONG,
                entry_price=bar["close"],
                entry_idx=self._current_idx,
                entry_time=bar.get("time"),
                size=action.get("size", 1.0),
                stop_loss=action.get("sl"),
                take_profit=action.get("tp"),
            )
            self.positions.append(pos)

        elif act in ("sell", "short"):
            pos = Position(
                direction=Direction.SHORT,
                entry_price=bar["close"],
                entry_idx=self._current_idx,
                entry_time=bar.get("time"),
                size=action.get("size", 1.0),
                stop_loss=action.get("sl"),
                take_profit=action.get("tp"),
            )
            self.positions.append(pos)

        elif act == "close":
            # Close the oldest open position (FIFO).
            if self.positions:
                pos = self.positions[0]
                self._close_position(pos, bar, reason="signal")

    def _check_exits(self, bar: pd.Series) -> None:
        """Check and execute stop-loss / take-profit on all open positions."""
        to_close: list[tuple[Position, str]] = []

        for pos in self.positions:
            if pos.direction == Direction.LONG:
                if pos.stop_loss is not None and bar["low"] <= pos.stop_loss:
                    to_close.append((pos, "stop_loss"))
                elif pos.take_profit is not None and bar["high"] >= pos.take_profit:
                    to_close.append((pos, "take_profit"))
            else:  # SHORT
                if pos.stop_loss is not None and bar["high"] >= pos.stop_loss:
                    to_close.append((pos, "stop_loss"))
                elif pos.take_profit is not None and bar["low"] <= pos.take_profit:
                    to_close.append((pos, "take_profit"))

        for pos, reason in to_close:
            exit_price = (
                pos.stop_loss if reason == "stop_loss" else pos.take_profit
            )
            self._close_position(pos, bar, reason=reason, exit_price_override=exit_price)

    def _close_position(
        self,
        pos: Position,
        bar: pd.Series,
        reason: str,
        exit_price_override: Optional[float] = None,
    ) -> None:
        """Close a position and record the trade."""
        exit_price = exit_price_override if exit_price_override else bar["close"]

        if pos.direction == Direction.LONG:
            pnl = (exit_price - pos.entry_price) * pos.size
        else:
            pnl = (pos.entry_price - exit_price) * pos.size

        self.capital += pnl

        trade = ClosedTrade(
            direction=pos.direction.value,
            entry_price=pos.entry_price,
            exit_price=exit_price,
            entry_idx=pos.entry_idx,
            exit_idx=self._current_idx,
            entry_time=pos.entry_time,
            exit_time=bar.get("time"),
            pnl=pnl,
            size=pos.size,
            reason=reason,
        )
        self.closed_trades.append(trade)

        if pos in self.positions:
            self.positions.remove(pos)

    def _unrealised_pnl(self, bar: pd.Series) -> float:
        """Calculate total unrealised PnL for all open positions."""
        total = 0.0
        for pos in self.positions:
            if pos.direction == Direction.LONG:
                total += (bar["close"] - pos.entry_price) * pos.size
            else:
                total += (pos.entry_price - bar["close"]) * pos.size
        return total
