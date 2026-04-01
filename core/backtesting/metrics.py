"""
Backtesting performance metrics.

Calculates: total PnL, win rate, max drawdown, Sharpe ratio, profit factor,
average win/loss, max consecutive wins/losses, and expectancy.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Any

import numpy as np
import pandas as pd


@dataclass
class BacktestMetrics:
    """Container for all computed backtest metrics."""

    total_pnl: float
    total_trades: int
    winning_trades: int
    losing_trades: int
    win_rate: float              # 0.0 to 1.0
    max_drawdown: float          # Absolute drawdown value.
    max_drawdown_pct: float      # Drawdown as percentage of peak equity.
    sharpe_ratio: float
    profit_factor: float         # gross_profit / gross_loss (inf if no losses).
    avg_win: float
    avg_loss: float
    max_consecutive_wins: int
    max_consecutive_losses: int
    expectancy: float            # (win_rate * avg_win) - ((1 - win_rate) * |avg_loss|)


def calculate_metrics(
    trade_pnls: List[float],
    equity_curve: List[float],
    risk_free_rate: float = 0.0,
) -> BacktestMetrics:
    """
    Compute comprehensive backtest performance metrics.

    Parameters
    ----------
    trade_pnls : list[float]
        PnL of each closed trade (positive = win, negative = loss).
    equity_curve : list[float]
        Equity value at each bar (including starting capital).
    risk_free_rate : float
        Annualised risk-free rate for Sharpe calculation (default 0).

    Returns
    -------
    BacktestMetrics
    """
    pnls = np.array(trade_pnls, dtype=float)
    equity = np.array(equity_curve, dtype=float)
    total_trades = len(pnls)

    # Basic PnL stats.
    total_pnl = float(pnls.sum()) if total_trades > 0 else 0.0
    wins = pnls[pnls > 0]
    losses = pnls[pnls < 0]
    winning_trades = len(wins)
    losing_trades = len(losses)
    win_rate = winning_trades / total_trades if total_trades > 0 else 0.0

    avg_win = float(wins.mean()) if len(wins) > 0 else 0.0
    avg_loss = float(losses.mean()) if len(losses) > 0 else 0.0

    # Profit factor: gross profit / gross loss.
    gross_profit = float(wins.sum()) if len(wins) > 0 else 0.0
    gross_loss = float(abs(losses.sum())) if len(losses) > 0 else 0.0
    profit_factor = (
        gross_profit / gross_loss if gross_loss > 0 else float("inf")
    )

    # Expectancy: (win_rate * avg_win) - (loss_rate * |avg_loss|).
    expectancy = (win_rate * avg_win) - ((1.0 - win_rate) * abs(avg_loss))

    # Max consecutive wins / losses.
    max_con_wins = _max_consecutive(pnls, positive=True)
    max_con_losses = _max_consecutive(pnls, positive=False)

    # Drawdown from equity curve.
    max_dd, max_dd_pct = _max_drawdown(equity)

    # Sharpe ratio (annualised assuming daily returns).
    sharpe = _sharpe_ratio(equity, risk_free_rate)

    return BacktestMetrics(
        total_pnl=round(total_pnl, 4),
        total_trades=total_trades,
        winning_trades=winning_trades,
        losing_trades=losing_trades,
        win_rate=round(win_rate, 4),
        max_drawdown=round(max_dd, 4),
        max_drawdown_pct=round(max_dd_pct, 4),
        sharpe_ratio=round(sharpe, 4),
        profit_factor=round(profit_factor, 4) if profit_factor != float("inf") else float("inf"),
        avg_win=round(avg_win, 4),
        avg_loss=round(avg_loss, 4),
        max_consecutive_wins=max_con_wins,
        max_consecutive_losses=max_con_losses,
        expectancy=round(expectancy, 4),
    )


def _max_consecutive(pnls: np.ndarray, positive: bool) -> int:
    """Count the longest streak of winning (positive=True) or losing trades."""
    if len(pnls) == 0:
        return 0

    max_streak = 0
    current = 0

    for pnl in pnls:
        if (positive and pnl > 0) or (not positive and pnl < 0):
            current += 1
            max_streak = max(max_streak, current)
        else:
            current = 0

    return max_streak


def _max_drawdown(equity: np.ndarray) -> tuple[float, float]:
    """
    Compute maximum drawdown (absolute) and max drawdown percentage.

    Returns (max_drawdown_abs, max_drawdown_pct).
    """
    if len(equity) < 2:
        return 0.0, 0.0

    peak = equity[0]
    max_dd = 0.0
    max_dd_pct = 0.0

    for val in equity[1:]:
        if val > peak:
            peak = val
        dd = peak - val
        dd_pct = dd / peak if peak > 0 else 0.0
        if dd > max_dd:
            max_dd = dd
        if dd_pct > max_dd_pct:
            max_dd_pct = dd_pct

    return max_dd, max_dd_pct


def _sharpe_ratio(
    equity: np.ndarray,
    risk_free_rate: float = 0.0,
    periods_per_year: int = 252,
) -> float:
    """
    Annualised Sharpe ratio from an equity curve.

    Assumes each equity point is one trading period apart.
    """
    if len(equity) < 2:
        return 0.0

    returns = np.diff(equity) / equity[:-1]
    excess = returns - risk_free_rate / periods_per_year

    if np.std(excess) == 0:
        return 0.0

    return float(np.mean(excess) / np.std(excess) * np.sqrt(periods_per_year))
