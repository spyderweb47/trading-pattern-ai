"""
Time utilities for OHLC data: timeframe conversion, resampling, and slicing.

Supported timeframe labels: 1m, 5m, 15m, 1h, 4h, 1d.
"""

from __future__ import annotations

from typing import Optional, Union

import numpy as np
import pandas as pd


# Map human-readable timeframe labels to pandas offset aliases.
TIMEFRAME_MAP: dict[str, str] = {
    "1m": "1min",
    "5m": "5min",
    "15m": "15min",
    "1h": "1h",
    "4h": "4h",
    "1d": "1D",
}

# Timeframe ordering from smallest to largest (in minutes).
TIMEFRAME_MINUTES: dict[str, int] = {
    "1m": 1,
    "5m": 5,
    "15m": 15,
    "1h": 60,
    "4h": 240,
    "1d": 1440,
}


def validate_timeframe(tf: str) -> str:
    """
    Validate and return a supported timeframe string.

    Raises ValueError if the timeframe is not recognized.
    """
    tf = tf.strip().lower()
    if tf not in TIMEFRAME_MAP:
        raise ValueError(
            f"Unsupported timeframe '{tf}'. "
            f"Supported: {list(TIMEFRAME_MAP.keys())}"
        )
    return tf


def timeframe_to_minutes(tf: str) -> int:
    """Return the number of minutes represented by a timeframe label."""
    tf = validate_timeframe(tf)
    return TIMEFRAME_MINUTES[tf]


def can_resample(source_tf: str, target_tf: str) -> bool:
    """
    Check whether resampling from source_tf to target_tf is valid.

    Resampling is only valid when going from a smaller to a larger timeframe,
    and the target period is an exact multiple of the source period.
    """
    src_min = timeframe_to_minutes(source_tf)
    tgt_min = timeframe_to_minutes(target_tf)
    return tgt_min > src_min and tgt_min % src_min == 0


def resample_ohlc(
    df: pd.DataFrame,
    target_tf: str,
    time_col: str = "time",
) -> pd.DataFrame:
    """
    Resample OHLC data to a higher (larger) timeframe.

    Parameters
    ----------
    df : pd.DataFrame
        Must contain columns: time, open, high, low, close, volume.
    target_tf : str
        Target timeframe label (e.g. '1h', '4h', '1d').
    time_col : str
        Name of the datetime column.

    Returns
    -------
    pd.DataFrame
        Resampled OHLC DataFrame with the same column structure.
    """
    target_tf = validate_timeframe(target_tf)
    offset = TIMEFRAME_MAP[target_tf]

    # Ensure the time column is datetime.
    temp = df.copy()
    temp[time_col] = pd.to_datetime(temp[time_col])
    temp = temp.set_index(time_col).sort_index()

    resampled = (
        temp.resample(offset)
        .agg(
            {
                "open": "first",
                "high": "max",
                "low": "min",
                "close": "last",
                "volume": "sum",
            }
        )
        .dropna(subset=["open"])
    )

    resampled = resampled.reset_index().rename(columns={"index": time_col})
    # If the column got renamed to the offset string, fix it.
    if time_col not in resampled.columns and resampled.columns[0] != time_col:
        resampled = resampled.rename(columns={resampled.columns[0]: time_col})

    return resampled.reset_index(drop=True)


def slice_time_range(
    df: pd.DataFrame,
    start: Optional[Union[str, pd.Timestamp]] = None,
    end: Optional[Union[str, pd.Timestamp]] = None,
    time_col: str = "time",
) -> pd.DataFrame:
    """
    Slice a DataFrame to include only rows within [start, end].

    Parameters
    ----------
    df : pd.DataFrame
        Must contain a datetime-compatible column specified by time_col.
    start : str or Timestamp, optional
        Inclusive lower bound.
    end : str or Timestamp, optional
        Inclusive upper bound.
    time_col : str
        Name of the datetime column.

    Returns
    -------
    pd.DataFrame
        Filtered subset.
    """
    temp = df.copy()
    temp[time_col] = pd.to_datetime(temp[time_col])

    mask = pd.Series(True, index=temp.index)

    if start is not None:
        start_ts = pd.Timestamp(start)
        # Make timezone-aware if the column is tz-aware.
        if temp[time_col].dt.tz is not None and start_ts.tzinfo is None:
            start_ts = start_ts.tz_localize(temp[time_col].dt.tz)
        mask &= temp[time_col] >= start_ts

    if end is not None:
        end_ts = pd.Timestamp(end)
        if temp[time_col].dt.tz is not None and end_ts.tzinfo is None:
            end_ts = end_ts.tz_localize(temp[time_col].dt.tz)
        mask &= temp[time_col] <= end_ts

    return temp[mask].reset_index(drop=True)


def get_time_range(
    df: pd.DataFrame,
    time_col: str = "time",
) -> dict[str, pd.Timestamp]:
    """Return the start and end timestamps of the dataset."""
    times = pd.to_datetime(df[time_col])
    return {"start": times.min(), "end": times.max()}


def estimate_timeframe(
    df: pd.DataFrame,
    time_col: str = "time",
) -> Optional[str]:
    """
    Estimate the base timeframe of an OHLC dataset by looking at the median
    interval between consecutive bars.

    Returns the closest matching timeframe label, or None if no match.
    """
    times = pd.to_datetime(df[time_col]).sort_values()
    if len(times) < 2:
        return None

    median_delta = times.diff().dropna().median()
    median_minutes = median_delta.total_seconds() / 60.0

    # Find the closest known timeframe.
    best_tf: Optional[str] = None
    best_diff = float("inf")
    for tf, mins in TIMEFRAME_MINUTES.items():
        diff = abs(median_minutes - mins)
        if diff < best_diff:
            best_diff = diff
            best_tf = tf

    # Only return if reasonably close (within 50% tolerance).
    if best_tf and best_diff <= TIMEFRAME_MINUTES[best_tf] * 0.5:
        return best_tf
    return None
