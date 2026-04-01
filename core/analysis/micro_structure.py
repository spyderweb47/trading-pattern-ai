"""
Window-based micro-structure analysis.

For each data window: detect local trend, local support/resistance,
and local volatility. Aggregate into a per-window micro-structure report.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import pandas as pd

from core.analysis.support_resistance import SRZone, find_support_resistance
from core.analysis.trend_detection import TrendZone, detect_trends
from core.analysis.volatility_zones import VolatilityZone, detect_volatility_zones
from core.engine.timeframe_splitter import WindowChunk, split_fixed


@dataclass
class WindowAnalysis:
    """Micro-structure report for a single data window."""

    window_index: int
    start_idx: int
    end_idx: int
    start_time: Any
    end_time: Any
    bar_count: int

    # Local analyses.
    local_trend: List[TrendZone]
    local_sr_zones: List[SRZone]
    local_volatility: List[VolatilityZone]

    # Summary statistics.
    dominant_trend: str          # Most prevalent trend in the window.
    avg_volatility: float        # Mean normalized volatility.
    sr_zone_count: int           # Number of S/R zones detected.


def _dominant_trend(trends: List[TrendZone]) -> str:
    """Determine the dominant trend by bar count."""
    counts: Dict[str, int] = {"bullish": 0, "bearish": 0, "sideways": 0}
    for t in trends:
        bars = t.end_idx - t.start_idx + 1
        counts[t.trend_type] = counts.get(t.trend_type, 0) + bars
    return max(counts, key=lambda k: counts[k])


def _avg_volatility(vol_zones: List[VolatilityZone]) -> float:
    """Compute bar-weighted average volatility magnitude."""
    total_bars = 0
    weighted_sum = 0.0
    for vz in vol_zones:
        bars = vz.end_idx - vz.start_idx + 1
        weighted_sum += vz.magnitude * bars
        total_bars += bars
    return round(weighted_sum / max(total_bars, 1), 4)


def analyse_window(
    window: WindowChunk,
    trend_fast: int = 10,
    trend_slow: int = 25,
    sr_left: int = 3,
    sr_right: int = 3,
    atr_period: int = 10,
) -> WindowAnalysis:
    """
    Run micro-structure analysis on a single data window.

    Parameters
    ----------
    window : WindowChunk
        A data window from the timeframe splitter.
    trend_fast / trend_slow : int
        MA periods for trend detection (smaller for local windows).
    sr_left / sr_right : int
        Pivot detection parameters.
    atr_period : int
        ATR period for volatility analysis.

    Returns
    -------
    WindowAnalysis
    """
    df = window.data

    # Local trend detection.
    trends = detect_trends(
        df,
        fast_period=trend_fast,
        slow_period=trend_slow,
        structure_lookback=max(3, trend_fast // 2),
        min_zone_bars=2,
    )

    # Local support / resistance.
    sr_zones = find_support_resistance(
        df,
        left_bars=sr_left,
        right_bars=sr_right,
        scope="local",
    )

    # Local volatility.
    vol_zones = detect_volatility_zones(
        df,
        atr_period=atr_period,
        std_period=max(5, atr_period),
        min_zone_bars=2,
    )

    return WindowAnalysis(
        window_index=window.meta.index,
        start_idx=window.meta.start_row,
        end_idx=window.meta.end_row,
        start_time=window.meta.start_time,
        end_time=window.meta.end_time,
        bar_count=window.meta.size,
        local_trend=trends,
        local_sr_zones=sr_zones,
        local_volatility=vol_zones,
        dominant_trend=_dominant_trend(trends),
        avg_volatility=_avg_volatility(vol_zones),
        sr_zone_count=len(sr_zones),
    )


def analyse_micro_structure(
    df: pd.DataFrame,
    window_size: int = 50,
    overlap: int = 10,
    **kwargs: Any,
) -> List[WindowAnalysis]:
    """
    Run micro-structure analysis across the full dataset.

    Splits the data into overlapping windows and analyses each one.

    Parameters
    ----------
    df : pd.DataFrame
        Full OHLC dataset.
    window_size : int
        Number of bars per window.
    overlap : int
        Overlap between consecutive windows.
    **kwargs
        Additional keyword arguments forwarded to ``analyse_window``.

    Returns
    -------
    list[WindowAnalysis]
        One report per window, ordered by window index.
    """
    chunks = split_fixed(df, window_size=window_size, overlap=overlap)
    results: List[WindowAnalysis] = []

    for chunk in chunks:
        analysis = analyse_window(chunk, **kwargs)
        results.append(analysis)

    return results
