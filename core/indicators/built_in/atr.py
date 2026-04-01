"""Average True Range (ATR) indicator."""

from __future__ import annotations

from typing import Any, Dict

import numpy as np
import pandas as pd

from core.indicators.base_indicator import BaseIndicator


class ATR(BaseIndicator):
    """
    Average True Range.

    True Range = max(high - low, abs(high - prev_close), abs(low - prev_close)).
    ATR = Wilder's smoothed average of True Range over ``period`` bars.
    """

    _registry_name = "atr"

    def __init__(self, period: int = 14) -> None:
        self.period = period

    @property
    def name(self) -> str:
        return "atr"

    @property
    def params(self) -> Dict[str, Any]:
        return {"period": self.period}

    def calculate(self, df: pd.DataFrame) -> pd.Series:
        """Return the ATR series."""
        high = df["high"]
        low = df["low"]
        prev_close = df["close"].shift(1)

        tr1 = high - low
        tr2 = (high - prev_close).abs()
        tr3 = (low - prev_close).abs()

        true_range = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)

        # Wilder's smoothing (EMA with alpha = 1/period).
        atr = true_range.ewm(
            alpha=1.0 / self.period, min_periods=self.period, adjust=False
        ).mean()

        return atr
