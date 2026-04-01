"""Simple Moving Average indicator."""

from __future__ import annotations

from typing import Any, Dict

import pandas as pd

from core.indicators.base_indicator import BaseIndicator


class SMA(BaseIndicator):
    """
    Simple Moving Average.

    Computes the unweighted mean of the last ``period`` closing prices.
    """

    _registry_name = "sma"

    def __init__(self, period: int = 20, column: str = "close") -> None:
        self.period = period
        self.column = column

    @property
    def name(self) -> str:
        return "sma"

    @property
    def params(self) -> Dict[str, Any]:
        return {"period": self.period, "column": self.column}

    def calculate(self, df: pd.DataFrame) -> pd.Series:
        """Return the SMA series."""
        return df[self.column].rolling(window=self.period, min_periods=self.period).mean()
