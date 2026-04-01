"""
Trend phase detection: bullish, bearish, sideways.

Uses a combination of moving-average crossovers and price structure
(higher highs / higher lows vs lower highs / lower lows) to identify
trend phases across the dataset.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional

import numpy as np
import pandas as pd


@dataclass
class TrendZone:
    """A contiguous period sharing the same trend direction."""

    start_idx: int
    end_idx: int
    trend_type: str    # "bullish", "bearish", "sideways"
    strength: float    # 0.0 to 1.0 confidence measure.


def _ma_crossover_signal(
    df: pd.DataFrame,
    fast_period: int = 20,
    slow_period: int = 50,
) -> pd.Series:
    """
    Compute a per-bar MA crossover signal.

    Returns +1 when fast MA > slow MA, -1 when fast < slow, 0 otherwise.
    """
    fast = df["close"].rolling(fast_period, min_periods=fast_period).mean()
    slow = df["close"].rolling(slow_period, min_periods=slow_period).mean()

    signal = pd.Series(0, index=df.index, dtype=int)
    signal[fast > slow] = 1
    signal[fast < slow] = -1
    return signal


def _price_structure_signal(
    df: pd.DataFrame,
    lookback: int = 10,
) -> pd.Series:
    """
    Compute a per-bar price structure signal based on higher highs/lows
    and lower highs/lows.

    Returns +1 for bullish structure, -1 for bearish, 0 for neutral.
    """
    highs = df["high"]
    lows = df["low"]

    # Rolling max/min to detect structure.
    rolling_hh = highs.rolling(lookback, min_periods=lookback).max()
    rolling_ll = lows.rolling(lookback, min_periods=lookback).min()

    # Shifted versions to compare structure changes.
    prev_hh = rolling_hh.shift(lookback)
    prev_ll = rolling_ll.shift(lookback)

    signal = pd.Series(0, index=df.index, dtype=int)

    # Higher high + higher low = bullish.
    bullish = (rolling_hh > prev_hh) & (rolling_ll > prev_ll)
    # Lower high + lower low = bearish.
    bearish = (rolling_hh < prev_hh) & (rolling_ll < prev_ll)

    signal[bullish] = 1
    signal[bearish] = -1
    return signal


def detect_trends(
    df: pd.DataFrame,
    fast_period: int = 20,
    slow_period: int = 50,
    structure_lookback: int = 10,
    min_zone_bars: int = 5,
) -> List[TrendZone]:
    """
    Identify trend phases across the dataset.

    Combines MA crossover signals with price structure signals. The
    composite signal determines the trend direction; strength reflects
    how strongly the two signals agree.

    Parameters
    ----------
    df : pd.DataFrame
        OHLC data.
    fast_period : int
        Fast MA period.
    slow_period : int
        Slow MA period.
    structure_lookback : int
        Lookback window for price structure analysis.
    min_zone_bars : int
        Minimum number of consecutive bars to form a zone.

    Returns
    -------
    list[TrendZone]
    """
    if len(df) < slow_period + structure_lookback:
        # Not enough data; return the whole range as sideways.
        return [
            TrendZone(
                start_idx=0,
                end_idx=len(df) - 1,
                trend_type="sideways",
                strength=0.0,
            )
        ]

    ma_sig = _ma_crossover_signal(df, fast_period, slow_period)
    ps_sig = _price_structure_signal(df, structure_lookback)

    # Composite: sum of the two signals (-2 to +2).
    composite = ma_sig + ps_sig

    # Map composite to trend labels.
    def _label(val: int) -> str:
        if val >= 1:
            return "bullish"
        if val <= -1:
            return "bearish"
        return "sideways"

    labels = composite.apply(_label)

    # Group consecutive bars with the same label into zones.
    zones: List[TrendZone] = []
    current_label = labels.iloc[0]
    start_idx = 0

    for i in range(1, len(labels)):
        if labels.iloc[i] != current_label:
            # Compute strength: proportion of bars with max agreement.
            zone_composite = composite.iloc[start_idx:i]
            if current_label == "bullish":
                strength = float((zone_composite == 2).sum()) / len(zone_composite)
            elif current_label == "bearish":
                strength = float((zone_composite == -2).sum()) / len(zone_composite)
            else:
                strength = float((zone_composite == 0).sum()) / len(zone_composite)

            zones.append(
                TrendZone(
                    start_idx=start_idx,
                    end_idx=i - 1,
                    trend_type=current_label,
                    strength=round(strength, 4),
                )
            )
            current_label = labels.iloc[i]
            start_idx = i

    # Final zone.
    zone_composite = composite.iloc[start_idx:]
    if current_label == "bullish":
        strength = float((zone_composite == 2).sum()) / max(len(zone_composite), 1)
    elif current_label == "bearish":
        strength = float((zone_composite == -2).sum()) / max(len(zone_composite), 1)
    else:
        strength = float((zone_composite == 0).sum()) / max(len(zone_composite), 1)

    zones.append(
        TrendZone(
            start_idx=start_idx,
            end_idx=len(df) - 1,
            trend_type=current_label,
            strength=round(strength, 4),
        )
    )

    # Merge very short zones (< min_zone_bars) into their neighbours.
    merged: List[TrendZone] = []
    for zone in zones:
        zone_len = zone.end_idx - zone.start_idx + 1
        if merged and zone_len < min_zone_bars:
            # Absorb into previous zone.
            merged[-1] = TrendZone(
                start_idx=merged[-1].start_idx,
                end_idx=zone.end_idx,
                trend_type=merged[-1].trend_type,
                strength=merged[-1].strength,
            )
        else:
            merged.append(zone)

    return merged
