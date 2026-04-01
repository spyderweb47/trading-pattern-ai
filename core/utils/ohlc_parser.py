"""
OHLC data parser with timestamp normalization and data validation.

Parses CSV data with columns: time, open, high, low, close, volume.
Supports multiple timestamp formats and validates OHLC integrity.
"""

from __future__ import annotations

import io
from typing import Optional, Union

import numpy as np
import pandas as pd


# Supported column name aliases (lowercase) mapped to canonical names.
COLUMN_ALIASES: dict[str, list[str]] = {
    "time": ["time", "timestamp", "unix_timestamp", "date", "datetime", "t"],
    "open": ["open", "o"],
    "high": ["high", "h"],
    "low": ["low", "l"],
    "close": ["close", "c"],
    "volume": ["volume", "vol", "v", "volume_usd", "volume_btc"],
}

# Common date format strings to try when pandas cannot auto-detect.
_DATE_FORMATS: list[str] = [
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%dT%H:%M:%SZ",
    "%Y-%m-%dT%H:%M:%S%z",
    "%Y/%m/%d %H:%M:%S",
    "%m/%d/%Y %H:%M:%S",
    "%d-%m-%Y %H:%M:%S",
    "%Y-%m-%d",
    "%m/%d/%Y",
    "%d/%m/%Y",
]


class OHLCParseError(Exception):
    """Raised when OHLC data cannot be parsed or validated."""


def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Map varied column names to canonical: time, open, high, low, close, volume."""
    col_lower = {c: c.strip().lower() for c in df.columns}
    rename_map: dict[str, str] = {}

    for canonical, aliases in COLUMN_ALIASES.items():
        for orig_col, lower_col in col_lower.items():
            if lower_col in aliases and canonical not in rename_map.values():
                rename_map[orig_col] = canonical
                break

    df = df.rename(columns=rename_map)

    required = {"time", "open", "high", "low", "close"}
    missing = required - set(df.columns)
    if missing:
        raise OHLCParseError(f"Missing required columns: {missing}")

    # Volume is optional; fill with 0 if absent.
    if "volume" not in df.columns:
        df["volume"] = 0

    return df[["time", "open", "high", "low", "close", "volume"]]


def _parse_timestamps(series: pd.Series) -> pd.DatetimeIndex:
    """
    Convert a series of timestamps to DatetimeIndex.

    Handles unix timestamps (int/float), ISO 8601, and common date strings.
    """
    sample = series.dropna().iloc[0] if len(series.dropna()) > 0 else None

    # Check for unix timestamps (numeric values).
    if pd.api.types.is_numeric_dtype(series) or (
        isinstance(sample, str) and sample.replace(".", "", 1).isdigit()
    ):
        numeric = pd.to_numeric(series, errors="coerce")
        # Heuristic: if values are > 1e12, they are milliseconds.
        if numeric.median() > 1e12:
            return pd.to_datetime(numeric, unit="ms", utc=True)
        return pd.to_datetime(numeric, unit="s", utc=True)

    # Try pandas auto-detection first.
    try:
        return pd.to_datetime(series, utc=True)
    except (ValueError, TypeError):
        pass

    # Try explicit formats.
    for fmt in _DATE_FORMATS:
        try:
            return pd.to_datetime(series, format=fmt, utc=True)
        except (ValueError, TypeError):
            continue

    raise OHLCParseError(
        "Unable to parse timestamps. Provide unix seconds, ISO 8601, or "
        "a common date format (YYYY-MM-DD HH:MM:SS)."
    )


def _validate_ohlc(df: pd.DataFrame, strict: bool = True) -> pd.DataFrame:
    """
    Validate OHLC data integrity.

    Checks:
    - No negative prices.
    - Volume >= 0.
    - OHLC relationship: low <= min(open, close) and max(open, close) <= high.

    Parameters
    ----------
    df : pd.DataFrame
        DataFrame with canonical OHLC columns.
    strict : bool
        If True, raise on violations. If False, drop invalid rows.

    Returns
    -------
    pd.DataFrame
        Validated (and possibly filtered) DataFrame.
    """
    price_cols = ["open", "high", "low", "close"]

    # Check for negative prices.
    neg_mask = (df[price_cols] < 0).any(axis=1)

    # Check volume >= 0.
    vol_mask = df["volume"] < 0

    # Check OHLC relationship: low <= open, close <= high.
    ohlc_mask = (
        (df["low"] > df["open"])
        | (df["low"] > df["close"])
        | (df["high"] < df["open"])
        | (df["high"] < df["close"])
    )

    invalid = neg_mask | vol_mask | ohlc_mask
    n_invalid = invalid.sum()

    if n_invalid > 0:
        if strict:
            # Build a descriptive error message.
            reasons = []
            if neg_mask.any():
                reasons.append(f"{neg_mask.sum()} rows with negative prices")
            if vol_mask.any():
                reasons.append(f"{vol_mask.sum()} rows with negative volume")
            if ohlc_mask.any():
                reasons.append(
                    f"{ohlc_mask.sum()} rows violating OHLC relationship "
                    "(low <= open,close <= high)"
                )
            raise OHLCParseError(
                f"Data validation failed: {'; '.join(reasons)}"
            )
        # Non-strict: drop invalid rows.
        df = df[~invalid].reset_index(drop=True)

    return df


def parse_ohlc_csv(
    source: Union[str, bytes, io.IOBase],
    strict: bool = True,
    sort: bool = True,
) -> pd.DataFrame:
    """
    Parse OHLC CSV data into a validated pandas DataFrame.

    Parameters
    ----------
    source : str | bytes | file-like
        File path, raw CSV bytes, or file-like object.
    strict : bool
        If True, raise on any data integrity violation.
        If False, silently drop invalid rows.
    sort : bool
        If True, sort by time ascending.

    Returns
    -------
    pd.DataFrame
        Columns: time (DatetimeIndex-compatible), open, high, low, close, volume.
        Index is integer-based; 'time' is a column with datetime64[ns, UTC].

    Raises
    ------
    OHLCParseError
        On missing columns, unparseable timestamps, or validation failures.
    """
    # Read CSV into raw DataFrame.
    try:
        if isinstance(source, bytes):
            df = pd.read_csv(io.BytesIO(source))
        elif isinstance(source, str):
            df = pd.read_csv(source)
        else:
            df = pd.read_csv(source)
    except Exception as exc:
        raise OHLCParseError(f"Failed to read CSV: {exc}") from exc

    if df.empty:
        raise OHLCParseError("CSV is empty")

    # Normalize column names.
    df = _normalize_columns(df)

    # Parse timestamps.
    df["time"] = _parse_timestamps(df["time"])

    # Cast price and volume columns to float64.
    for col in ["open", "high", "low", "close", "volume"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    # Drop rows where price data is entirely NaN.
    df = df.dropna(subset=["open", "high", "low", "close"]).reset_index(drop=True)
    df["volume"] = df["volume"].fillna(0)

    # Validate OHLC relationships and values.
    df = _validate_ohlc(df, strict=strict)

    # Sort by time if requested.
    if sort:
        df = df.sort_values("time").reset_index(drop=True)

    return df
