"""Bollinger Bands indicator."""

from __future__ import annotations

from typing import Any, Dict

import pandas as pd

from core.indicators.base_indicator import BaseIndicator


class BollingerBands(BaseIndicator):
    """
    Bollinger Bands.

    Middle band = SMA(period).
    Upper band  = middle + num_std * rolling std.
    Lower band  = middle - num_std * rolling std.
    """

    _registry_name = "bollinger"

    def __init__(
        self,
        period: int = 20,
        num_std: float = 2.0,
        column: str = "close",
    ) -> None:
        self.period = period
        self.num_std = num_std
        self.column = column

    @property
    def name(self) -> str:
        return "bollinger"

    @property
    def params(self) -> Dict[str, Any]:
        return {
            "period": self.period,
            "num_std": self.num_std,
            "column": self.column,
        }

    def calculate(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Return a DataFrame with columns: bb_middle, bb_upper, bb_lower, bb_width.
        """
        rolling = df[self.column].rolling(window=self.period, min_periods=self.period)
        middle = rolling.mean()
        std = rolling.std()

        upper = middle + self.num_std * std
        lower = middle - self.num_std * std
        # Bandwidth = (upper - lower) / middle.
        width = (upper - lower) / middle

        return pd.DataFrame(
            {
                "bb_middle": middle,
                "bb_upper": upper,
                "bb_lower": lower,
                "bb_width": width,
            },
            index=df.index,
        )
