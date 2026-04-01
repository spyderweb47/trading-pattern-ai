"""
Event-driven backtesting engine.

Accepts a strategy configuration (entry/exit conditions, stop-loss,
take-profit) and processes OHLC bars sequentially. Supports long and
short positions.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional

import numpy as np
import pandas as pd

from core.backtesting.metrics import BacktestMetrics, calculate_metrics
from core.backtesting.trade_logger import TradeLogger, TradeRecord


@dataclass
class BacktestConfig:
    """
    Strategy configuration for backtesting.

    Attributes
    ----------
    entry_condition : callable
        (bar_idx, bar, history_df, indicators) -> "long" | "short" | None
    exit_condition : callable
        (bar_idx, bar, history_df, indicators, position) -> bool
    stop_loss_pct : float or None
        Stop-loss as a percentage from entry price (e.g. 0.02 = 2%).
    take_profit_pct : float or None
        Take-profit as a percentage from entry price.
    position_size : float
        Number of units per trade.
    max_open_positions : int
        Maximum simultaneous open positions.
    indicators : dict[str, Any]
        Pre-computed indicator series/DataFrames keyed by name.
    """

    entry_condition: Callable[..., Optional[str]]
    exit_condition: Callable[..., bool]
    stop_loss_pct: Optional[float] = None
    take_profit_pct: Optional[float] = None
    position_size: float = 1.0
    max_open_positions: int = 1
    indicators: Dict[str, Any] = field(default_factory=dict)


@dataclass
class OpenPosition:
    """Tracks an open position during backtesting."""

    direction: str          # "long" or "short"
    entry_price: float
    entry_idx: int
    entry_time: Any
    size: float
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None


@dataclass
class BacktestResult:
    """Complete backtesting results."""

    metrics: BacktestMetrics
    trade_log: List[Dict[str, Any]]
    equity_curve: List[float]
    total_bars: int


class BacktestEngine:
    """
    Event-driven backtest engine.

    Usage
    -----
    >>> config = BacktestConfig(entry_condition=my_entry, exit_condition=my_exit)
    >>> engine = BacktestEngine(df, initial_capital=10000)
    >>> result = engine.run(config)
    """

    def __init__(
        self,
        df: pd.DataFrame,
        initial_capital: float = 10000.0,
    ) -> None:
        self.df = df.copy().reset_index(drop=True)
        self.initial_capital = initial_capital

    def run(self, config: BacktestConfig) -> BacktestResult:
        """
        Execute the backtest.

        Parameters
        ----------
        config : BacktestConfig
            Strategy configuration with entry/exit logic.

        Returns
        -------
        BacktestResult
        """
        capital = self.initial_capital
        open_positions: List[OpenPosition] = []
        logger = TradeLogger()
        equity_curve: List[float] = [capital]

        n = len(self.df)

        for idx in range(n):
            bar = self.df.iloc[idx]
            history = self.df.iloc[: idx + 1]

            # --- Check exits on open positions ---
            positions_to_close: List[tuple[OpenPosition, str, float]] = []

            for pos in open_positions:
                # Stop-loss check.
                if pos.stop_loss is not None:
                    if pos.direction == "long" and bar["low"] <= pos.stop_loss:
                        positions_to_close.append((pos, "stop_loss", pos.stop_loss))
                        continue
                    if pos.direction == "short" and bar["high"] >= pos.stop_loss:
                        positions_to_close.append((pos, "stop_loss", pos.stop_loss))
                        continue

                # Take-profit check.
                if pos.take_profit is not None:
                    if pos.direction == "long" and bar["high"] >= pos.take_profit:
                        positions_to_close.append((pos, "take_profit", pos.take_profit))
                        continue
                    if pos.direction == "short" and bar["low"] <= pos.take_profit:
                        positions_to_close.append((pos, "take_profit", pos.take_profit))
                        continue

                # Strategy exit condition.
                should_exit = config.exit_condition(
                    idx, bar, history, config.indicators, pos
                )
                if should_exit:
                    positions_to_close.append((pos, "signal", bar["close"]))

            # Execute closes.
            for pos, reason, exit_price in positions_to_close:
                pnl = self._compute_pnl(pos, exit_price)
                capital += pnl
                logger.log(
                    entry_time=pos.entry_time,
                    exit_time=bar.get("time"),
                    entry_price=pos.entry_price,
                    exit_price=exit_price,
                    direction=pos.direction,
                    pnl=pnl,
                    size=pos.size,
                    reason=reason,
                )
                open_positions.remove(pos)

            # --- Check entry ---
            if len(open_positions) < config.max_open_positions:
                signal = config.entry_condition(
                    idx, bar, history, config.indicators
                )
                if signal in ("long", "short"):
                    entry_price = bar["close"]
                    sl = self._calc_stop(entry_price, signal, config.stop_loss_pct)
                    tp = self._calc_target(entry_price, signal, config.take_profit_pct)
                    open_positions.append(
                        OpenPosition(
                            direction=signal,
                            entry_price=entry_price,
                            entry_idx=idx,
                            entry_time=bar.get("time"),
                            size=config.position_size,
                            stop_loss=sl,
                            take_profit=tp,
                        )
                    )

            # Record equity (capital + unrealised PnL).
            unrealised = sum(
                self._compute_pnl(p, bar["close"]) for p in open_positions
            )
            equity_curve.append(capital + unrealised)

        # Force-close remaining positions at last close.
        if open_positions:
            last_bar = self.df.iloc[-1]
            for pos in list(open_positions):
                pnl = self._compute_pnl(pos, last_bar["close"])
                capital += pnl
                logger.log(
                    entry_time=pos.entry_time,
                    exit_time=last_bar.get("time"),
                    entry_price=pos.entry_price,
                    exit_price=last_bar["close"],
                    direction=pos.direction,
                    pnl=pnl,
                    size=pos.size,
                    reason="end_of_data",
                )

        # Compute metrics.
        trade_pnls = [t["pnl"] for t in logger.to_dicts()]
        metrics = calculate_metrics(trade_pnls, equity_curve)

        return BacktestResult(
            metrics=metrics,
            trade_log=logger.to_dicts(),
            equity_curve=equity_curve,
            total_bars=n,
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _compute_pnl(pos: OpenPosition, exit_price: float) -> float:
        if pos.direction == "long":
            return (exit_price - pos.entry_price) * pos.size
        return (pos.entry_price - exit_price) * pos.size

    @staticmethod
    def _calc_stop(
        entry: float, direction: str, pct: Optional[float]
    ) -> Optional[float]:
        if pct is None:
            return None
        if direction == "long":
            return entry * (1.0 - pct)
        return entry * (1.0 + pct)

    @staticmethod
    def _calc_target(
        entry: float, direction: str, pct: Optional[float]
    ) -> Optional[float]:
        if pct is None:
            return None
        if direction == "long":
            return entry * (1.0 + pct)
        return entry * (1.0 - pct)
