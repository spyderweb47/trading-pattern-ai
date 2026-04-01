"""
Support and resistance level detection.

Identifies pivot highs/lows, clusters nearby levels into zones, and
classifies them as global (full dataset) or local (within a window).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional

import numpy as np
import pandas as pd


@dataclass
class SRZone:
    """A support or resistance zone."""

    price_level: float       # Central price of the zone.
    strength: int            # Number of touches / pivots in the zone.
    zone_type: str           # "support", "resistance", or "both".
    scope: str               # "global" or "local".
    upper_bound: float       # Top of the zone band.
    lower_bound: float       # Bottom of the zone band.


def detect_pivots(
    df: pd.DataFrame,
    left_bars: int = 5,
    right_bars: int = 5,
) -> tuple[List[int], List[int]]:
    """
    Detect pivot highs and pivot lows.

    A pivot high at index i means df['high'][i] is the maximum of
    df['high'][i - left_bars : i + right_bars + 1].

    Parameters
    ----------
    df : pd.DataFrame
        OHLC data.
    left_bars : int
        Number of bars to the left of the pivot.
    right_bars : int
        Number of bars to the right of the pivot.

    Returns
    -------
    (pivot_high_indices, pivot_low_indices)
    """
    highs = df["high"].values
    lows = df["low"].values
    n = len(df)

    pivot_highs: List[int] = []
    pivot_lows: List[int] = []

    for i in range(left_bars, n - right_bars):
        # Pivot high: current high is the max in the window.
        window_high = highs[i - left_bars : i + right_bars + 1]
        if highs[i] == np.max(window_high):
            pivot_highs.append(i)

        # Pivot low: current low is the min in the window.
        window_low = lows[i - left_bars : i + right_bars + 1]
        if lows[i] == np.min(window_low):
            pivot_lows.append(i)

    return pivot_highs, pivot_lows


def cluster_levels(
    prices: List[float],
    threshold_pct: float = 0.5,
) -> List[tuple[float, int]]:
    """
    Cluster nearby price levels into zones using a percentage threshold.

    Parameters
    ----------
    prices : list[float]
        Raw pivot prices.
    threshold_pct : float
        Percentage distance within which prices are considered the same zone.

    Returns
    -------
    list[tuple[float, int]]
        Each entry is (zone_center, touch_count).
    """
    if not prices:
        return []

    sorted_prices = sorted(prices)
    clusters: List[List[float]] = [[sorted_prices[0]]]

    for price in sorted_prices[1:]:
        cluster_center = np.mean(clusters[-1])
        # If within threshold, add to current cluster.
        if abs(price - cluster_center) / cluster_center * 100 <= threshold_pct:
            clusters[-1].append(price)
        else:
            clusters.append([price])

    return [(float(np.mean(c)), len(c)) for c in clusters]


def find_support_resistance(
    df: pd.DataFrame,
    left_bars: int = 5,
    right_bars: int = 5,
    cluster_threshold_pct: float = 0.5,
    scope: str = "global",
) -> List[SRZone]:
    """
    Full pipeline: detect pivots, cluster into zones, classify S/R.

    Parameters
    ----------
    df : pd.DataFrame
        OHLC data.
    left_bars : int
        Left window for pivot detection.
    right_bars : int
        Right window for pivot detection.
    cluster_threshold_pct : float
        Clustering proximity threshold as percentage.
    scope : str
        "global" or "local" -- indicates dataset scope for metadata.

    Returns
    -------
    list[SRZone]
        Sorted by price_level ascending.
    """
    pivot_highs, pivot_lows = detect_pivots(df, left_bars, right_bars)

    high_prices = [df["high"].iloc[i] for i in pivot_highs]
    low_prices = [df["low"].iloc[i] for i in pivot_lows]

    # Cluster highs (resistance candidates) and lows (support candidates).
    resistance_clusters = cluster_levels(high_prices, cluster_threshold_pct)
    support_clusters = cluster_levels(low_prices, cluster_threshold_pct)

    # Merge overlapping support and resistance into "both" zones.
    zones: List[SRZone] = []

    # Build zone bands using the cluster threshold.
    def _make_zone(
        center: float, strength: int, ztype: str
    ) -> SRZone:
        half_band = center * cluster_threshold_pct / 100.0
        return SRZone(
            price_level=center,
            strength=strength,
            zone_type=ztype,
            scope=scope,
            upper_bound=center + half_band,
            lower_bound=center - half_band,
        )

    res_map = {c: s for c, s in resistance_clusters}
    sup_map = {c: s for c, s in support_clusters}

    # Check for overlapping zones between support and resistance.
    used_sup: set[float] = set()

    for r_center, r_strength in resistance_clusters:
        merged = False
        for s_center, s_strength in support_clusters:
            if s_center in used_sup:
                continue
            # Overlap if the distance is within the threshold.
            avg = (r_center + s_center) / 2.0
            if abs(r_center - s_center) / avg * 100 <= cluster_threshold_pct:
                zones.append(
                    _make_zone(avg, r_strength + s_strength, "both")
                )
                used_sup.add(s_center)
                merged = True
                break
        if not merged:
            zones.append(_make_zone(r_center, r_strength, "resistance"))

    for s_center, s_strength in support_clusters:
        if s_center not in used_sup:
            zones.append(_make_zone(s_center, s_strength, "support"))

    zones.sort(key=lambda z: z.price_level)
    return zones
