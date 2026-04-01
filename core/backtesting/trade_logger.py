"""
Trade logger: records individual trades and exports them.

Each trade captures: entry/exit times and prices, direction, PnL, and reason.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import pandas as pd


@dataclass
class TradeRecord:
    """A single completed trade record."""

    entry_time: Any
    exit_time: Any
    entry_price: float
    exit_price: float
    direction: str          # "long" or "short"
    pnl: float
    size: float
    reason: str             # e.g. "signal", "stop_loss", "take_profit"
    metadata: Dict[str, Any] = field(default_factory=dict)


class TradeLogger:
    """
    Collects trade records and provides export utilities.
    """

    def __init__(self) -> None:
        self._trades: List[TradeRecord] = []

    def log(
        self,
        entry_time: Any,
        exit_time: Any,
        entry_price: float,
        exit_price: float,
        direction: str,
        pnl: float,
        size: float = 1.0,
        reason: str = "signal",
        **metadata: Any,
    ) -> None:
        """Record a completed trade."""
        self._trades.append(
            TradeRecord(
                entry_time=entry_time,
                exit_time=exit_time,
                entry_price=entry_price,
                exit_price=exit_price,
                direction=direction,
                pnl=pnl,
                size=size,
                reason=reason,
                metadata=metadata,
            )
        )

    def to_dicts(self) -> List[Dict[str, Any]]:
        """Export all trades as a list of plain dicts."""
        return [
            {
                "entry_time": t.entry_time,
                "exit_time": t.exit_time,
                "entry_price": t.entry_price,
                "exit_price": t.exit_price,
                "direction": t.direction,
                "pnl": t.pnl,
                "size": t.size,
                "reason": t.reason,
                **t.metadata,
            }
            for t in self._trades
        ]

    def to_dataframe(self) -> pd.DataFrame:
        """Export all trades as a pandas DataFrame."""
        if not self._trades:
            return pd.DataFrame(
                columns=[
                    "entry_time", "exit_time", "entry_price",
                    "exit_price", "direction", "pnl", "size", "reason",
                ]
            )
        return pd.DataFrame(self.to_dicts())

    @property
    def trade_count(self) -> int:
        return len(self._trades)

    @property
    def trades(self) -> List[TradeRecord]:
        return list(self._trades)

    def clear(self) -> None:
        """Remove all recorded trades."""
        self._trades.clear()
