"""Relative Strength Index indicator."""

from __future__ import annotations

from typing import Any, Dict

import numpy as np
import pandas as pd

from core.indicators.base_indicator import BaseIndicator


class RSI(BaseIndicator):
    """
    Relative Strength Index (Wilder's smoothing method).

    RSI = 100 - 100 / (1 + RS)
    where RS = avg_gain / avg_loss over ``period`` bars.
    """

    _registry_name = "rsi"

    def __init__(self, period: int = 14, column: str = "close") -> None:
        self.period = period
        self.column = column

    @property
    def name(self) -> str:
        return "rsi"

    @property
    def params(self) -> Dict[str, Any]:
        return {"period": self.period, "column": self.column}

    def calculate(self, df: pd.DataFrame) -> pd.Series:
        """Return the RSI series (0-100)."""
        delta = df[self.column].diff()

        gain = delta.clip(lower=0)
        loss = (-delta).clip(lower=0)

        # Wilder's smoothing (equivalent to EMA with alpha = 1/period).
        avg_gain = gain.ewm(alpha=1.0 / self.period, min_periods=self.period, adjust=False).mean()
        avg_loss = loss.ewm(alpha=1.0 / self.period, min_periods=self.period, adjust=False).mean()

        rs = avg_gain / avg_loss.replace(0, np.nan)
        rsi = 100.0 - (100.0 / (1.0 + rs))

        return rsi
