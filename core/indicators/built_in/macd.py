"""Moving Average Convergence Divergence (MACD) indicator."""

from __future__ import annotations

from typing import Any, Dict

import pandas as pd

from core.indicators.base_indicator import BaseIndicator


class MACD(BaseIndicator):
    """
    MACD.

    MACD line   = EMA(fast) - EMA(slow).
    Signal line = EMA(MACD line, signal_period).
    Histogram   = MACD line - Signal line.
    """

    _registry_name = "macd"

    def __init__(
        self,
        fast_period: int = 12,
        slow_period: int = 26,
        signal_period: int = 9,
        column: str = "close",
    ) -> None:
        self.fast_period = fast_period
        self.slow_period = slow_period
        self.signal_period = signal_period
        self.column = column

    @property
    def name(self) -> str:
        return "macd"

    @property
    def params(self) -> Dict[str, Any]:
        return {
            "fast_period": self.fast_period,
            "slow_period": self.slow_period,
            "signal_period": self.signal_period,
            "column": self.column,
        }

    def calculate(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Return a DataFrame with columns: macd_line, macd_signal, macd_histogram.
        """
        fast_ema = df[self.column].ewm(span=self.fast_period, adjust=False).mean()
        slow_ema = df[self.column].ewm(span=self.slow_period, adjust=False).mean()

        macd_line = fast_ema - slow_ema
        signal = macd_line.ewm(span=self.signal_period, adjust=False).mean()
        histogram = macd_line - signal

        return pd.DataFrame(
            {
                "macd_line": macd_line,
                "macd_signal": signal,
                "macd_histogram": histogram,
            },
            index=df.index,
        )
