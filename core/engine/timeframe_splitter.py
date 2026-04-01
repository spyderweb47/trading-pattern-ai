"""
Split OHLC DataFrames into fixed-size or rolling windows with optional overlap.

Each chunk carries metadata: start time, end time, and sequential index.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional

import pandas as pd


@dataclass
class WindowMeta:
    """Metadata for a single data window."""

    index: int
    start_time: pd.Timestamp
    end_time: pd.Timestamp
    start_row: int
    end_row: int
    size: int


@dataclass
class WindowChunk:
    """A DataFrame window together with its metadata."""

    data: pd.DataFrame
    meta: WindowMeta


def split_fixed(
    df: pd.DataFrame,
    window_size: int,
    overlap: int = 0,
    time_col: str = "time",
) -> List[WindowChunk]:
    """
    Split a DataFrame into fixed-size, non-rolling windows.

    Parameters
    ----------
    df : pd.DataFrame
        OHLC data sorted by time.
    window_size : int
        Number of rows per window.
    overlap : int
        Number of overlapping rows between consecutive windows.
        Must be in [0, window_size).
    time_col : str
        Name of the datetime column.

    Returns
    -------
    list[WindowChunk]
        Ordered list of window chunks.
    """
    if window_size < 1:
        raise ValueError("window_size must be >= 1")
    if overlap < 0 or overlap >= window_size:
        raise ValueError("overlap must be in [0, window_size)")

    step = window_size - overlap
    chunks: List[WindowChunk] = []
    n = len(df)
    idx = 0
    window_idx = 0

    while idx + window_size <= n:
        window_df = df.iloc[idx : idx + window_size].reset_index(drop=True)
        times = pd.to_datetime(window_df[time_col])
        meta = WindowMeta(
            index=window_idx,
            start_time=times.iloc[0],
            end_time=times.iloc[-1],
            start_row=idx,
            end_row=idx + window_size - 1,
            size=window_size,
        )
        chunks.append(WindowChunk(data=window_df, meta=meta))
        idx += step
        window_idx += 1

    return chunks


def split_rolling(
    df: pd.DataFrame,
    window_size: int,
    time_col: str = "time",
) -> List[WindowChunk]:
    """
    Generate rolling (sliding) windows where each window advances by 1 row.

    This is equivalent to split_fixed with overlap = window_size - 1.

    Parameters
    ----------
    df : pd.DataFrame
        OHLC data sorted by time.
    window_size : int
        Number of rows per window.
    time_col : str
        Name of the datetime column.

    Returns
    -------
    list[WindowChunk]
    """
    return split_fixed(df, window_size, overlap=window_size - 1, time_col=time_col)


def split_by_time(
    df: pd.DataFrame,
    freq: str,
    time_col: str = "time",
) -> List[WindowChunk]:
    """
    Split data into windows based on a time frequency (e.g. '1D', '1W').

    Parameters
    ----------
    df : pd.DataFrame
        OHLC data with a datetime column.
    freq : str
        Pandas offset alias for grouping (e.g. '1D', '1W', '1ME').
    time_col : str
        Name of the datetime column.

    Returns
    -------
    list[WindowChunk]
    """
    temp = df.copy()
    temp[time_col] = pd.to_datetime(temp[time_col])
    temp = temp.sort_values(time_col).reset_index(drop=True)

    # Use Grouper to split by time periods.
    temp["_group"] = temp[time_col].dt.to_period(freq)
    chunks: List[WindowChunk] = []

    for window_idx, (_, group_df) in enumerate(temp.groupby("_group")):
        group_df = group_df.drop(columns=["_group"]).reset_index(drop=True)
        if group_df.empty:
            continue
        times = pd.to_datetime(group_df[time_col])
        meta = WindowMeta(
            index=window_idx,
            start_time=times.iloc[0],
            end_time=times.iloc[-1],
            start_row=group_df.index[0],
            end_row=group_df.index[-1],
            size=len(group_df),
        )
        chunks.append(WindowChunk(data=group_df, meta=meta))

    return chunks
