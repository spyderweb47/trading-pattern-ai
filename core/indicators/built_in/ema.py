"""Exponential Moving Average indicator."""

from __future__ import annotations

from typing import Any, Dict

import pandas as pd

from core.indicators.base_indicator import BaseIndicator


class EMA(BaseIndicator):
    """
    Exponential Moving Average.

    Uses a span-based decay factor: alpha = 2 / (period + 1).
    """

    _registry_name = "ema"

    def __init__(self, period: int = 20, column: str = "close") -> None:
        self.period = period
        self.column = column

    @property
    def name(self) -> str:
        return "ema"

    @property
    def params(self) -> Dict[str, Any]:
        return {"period": self.period, "column": self.column}

    def calculate(self, df: pd.DataFrame) -> pd.Series:
        """Return the EMA series."""
        return df[self.column].ewm(span=self.period, adjust=False).mean()
