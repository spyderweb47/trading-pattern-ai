"""Volume Weighted Average Price (VWAP) indicator."""

from __future__ import annotations

from typing import Any, Dict

import numpy as np
import pandas as pd

from core.indicators.base_indicator import BaseIndicator


class VWAP(BaseIndicator):
    """
    Volume Weighted Average Price.

    VWAP = cumulative(typical_price * volume) / cumulative(volume).

    By default resets daily. Set ``reset_period`` to None for a
    session-wide (non-resetting) VWAP.
    """

    _registry_name = "vwap"

    def __init__(self, reset_period: str | None = "1D") -> None:
        self.reset_period = reset_period

    @property
    def name(self) -> str:
        return "vwap"

    @property
    def params(self) -> Dict[str, Any]:
        return {"reset_period": self.reset_period}

    def calculate(self, df: pd.DataFrame) -> pd.Series:
        """Return the VWAP series."""
        typical_price = (df["high"] + df["low"] + df["close"]) / 3.0
        tp_vol = typical_price * df["volume"]

        if self.reset_period is None:
            # Non-resetting cumulative VWAP.
            cum_tp_vol = tp_vol.cumsum()
            cum_vol = df["volume"].cumsum()
            vwap = cum_tp_vol / cum_vol.replace(0, np.nan)
        else:
            # Group by reset period and compute cumulative within each group.
            times = pd.to_datetime(df["time"])
            groups = times.dt.to_period(self.reset_period)
            cum_tp_vol = tp_vol.groupby(groups).cumsum()
            cum_vol = df["volume"].groupby(groups).cumsum()
            vwap = cum_tp_vol / cum_vol.replace(0, np.nan)

        return vwap
