"""
Volatility zone detection.

Identifies high and low volatility periods using ATR-based and
standard-deviation methods. Detects sudden spikes and drops.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List

import numpy as np
import pandas as pd


@dataclass
class VolatilityZone:
    """A contiguous period with a distinct volatility regime."""

    start_idx: int
    end_idx: int
    vol_type: str       # "high", "low", "spike", "drop"
    magnitude: float    # Normalized magnitude relative to baseline.


def _compute_atr(
    df: pd.DataFrame,
    period: int = 14,
) -> pd.Series:
    """Compute Average True Range."""
    high = df["high"]
    low = df["low"]
    prev_close = df["close"].shift(1)

    tr = pd.concat(
        [
            high - low,
            (high - prev_close).abs(),
            (low - prev_close).abs(),
        ],
        axis=1,
    ).max(axis=1)

    return tr.ewm(alpha=1.0 / period, min_periods=period, adjust=False).mean()


def _compute_rolling_std(
    df: pd.DataFrame,
    period: int = 20,
    column: str = "close",
) -> pd.Series:
    """Compute rolling standard deviation of returns."""
    returns = df[column].pct_change()
    return returns.rolling(window=period, min_periods=period).std()


def detect_volatility_zones(
    df: pd.DataFrame,
    atr_period: int = 14,
    std_period: int = 20,
    high_threshold: float = 1.5,
    low_threshold: float = 0.5,
    spike_threshold: float = 2.5,
    min_zone_bars: int = 3,
) -> List[VolatilityZone]:
    """
    Detect volatility regimes and anomalies.

    Method
    ------
    1. Compute ATR and rolling std of returns.
    2. Normalize both to their own rolling median (baseline).
    3. Average the two normalized measures.
    4. Classify each bar as high / low / normal volatility.
    5. Detect sudden spikes (single-bar or short bursts).
    6. Group consecutive bars into zones.

    Parameters
    ----------
    df : pd.DataFrame
        OHLC data.
    atr_period : int
        ATR calculation period.
    std_period : int
        Rolling standard deviation period.
    high_threshold : float
        Multiple of baseline above which volatility is "high".
    low_threshold : float
        Multiple of baseline below which volatility is "low".
    spike_threshold : float
        Multiple of baseline indicating a sudden spike.
    min_zone_bars : int
        Minimum bars to form a zone; shorter stretches are merged.

    Returns
    -------
    list[VolatilityZone]
    """
    if len(df) < max(atr_period, std_period) + 20:
        return [
            VolatilityZone(
                start_idx=0,
                end_idx=len(df) - 1,
                vol_type="low",
                magnitude=1.0,
            )
        ]

    atr = _compute_atr(df, atr_period)
    rstd = _compute_rolling_std(df, std_period)

    # Normalize to rolling median as baseline.
    baseline_window = max(atr_period, std_period) * 4
    atr_median = atr.rolling(baseline_window, min_periods=1).median()
    std_median = rstd.rolling(baseline_window, min_periods=1).median()

    atr_norm = atr / atr_median.replace(0, np.nan)
    std_norm = rstd / std_median.replace(0, np.nan)

    # Combined volatility measure (average of both normalized).
    vol_measure = (atr_norm.fillna(1.0) + std_norm.fillna(1.0)) / 2.0

    # Classify each bar.
    labels = pd.Series("normal", index=df.index)
    labels[vol_measure >= spike_threshold] = "spike"
    labels[(vol_measure >= high_threshold) & (vol_measure < spike_threshold)] = "high"
    labels[vol_measure <= low_threshold] = "low"

    # Detect drops: sharp decrease in volatility (vol_measure drops by > 50%
    # compared to previous bar).
    vol_change = vol_measure.pct_change()
    labels[(vol_change < -0.5) & (labels == "low")] = "drop"

    # Group into contiguous zones.
    zones: List[VolatilityZone] = []
    current_label = labels.iloc[0]
    start_idx = 0

    for i in range(1, len(labels)):
        if labels.iloc[i] != current_label:
            avg_mag = float(vol_measure.iloc[start_idx:i].mean())
            zones.append(
                VolatilityZone(
                    start_idx=start_idx,
                    end_idx=i - 1,
                    vol_type=current_label,
                    magnitude=round(avg_mag, 4),
                )
            )
            current_label = labels.iloc[i]
            start_idx = i

    # Final zone.
    avg_mag = float(vol_measure.iloc[start_idx:].mean())
    zones.append(
        VolatilityZone(
            start_idx=start_idx,
            end_idx=len(df) - 1,
            vol_type=current_label,
            magnitude=round(avg_mag, 4),
        )
    )

    # Merge very short "normal" zones into neighbours.
    merged: List[VolatilityZone] = []
    for zone in zones:
        zone_len = zone.end_idx - zone.start_idx + 1
        if merged and zone.vol_type == "normal" and zone_len < min_zone_bars:
            merged[-1] = VolatilityZone(
                start_idx=merged[-1].start_idx,
                end_idx=zone.end_idx,
                vol_type=merged[-1].vol_type,
                magnitude=merged[-1].magnitude,
            )
        else:
            merged.append(zone)

    return merged
