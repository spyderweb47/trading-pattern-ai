"""
Data loader for OHLC datasets.

Loads CSV from file paths or raw bytes, delegates parsing to ohlc_parser,
and maintains a simple in-memory cache keyed by source identifier.
"""

from __future__ import annotations

import hashlib
import io
from dataclasses import dataclass, field
from typing import Any, Optional, Union

import pandas as pd

from core.utils.ohlc_parser import parse_ohlc_csv
from core.utils.time_utils import estimate_timeframe, get_time_range


@dataclass
class DatasetMeta:
    """Metadata describing a loaded OHLC dataset."""

    rows: int
    columns: list[str]
    time_start: pd.Timestamp
    time_end: pd.Timestamp
    estimated_timeframe: Optional[str]
    source_key: str


class DataLoader:
    """
    Load and cache OHLC datasets.

    Attributes
    ----------
    _cache : dict[str, tuple[pd.DataFrame, DatasetMeta]]
        In-memory cache mapping a source key to (DataFrame, metadata).
    """

    def __init__(self) -> None:
        self._cache: dict[str, tuple[pd.DataFrame, DatasetMeta]] = {}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def load_csv(
        self,
        source: Union[str, bytes, io.IOBase],
        strict: bool = True,
        cache: bool = True,
    ) -> tuple[pd.DataFrame, DatasetMeta]:
        """
        Load OHLC data from a CSV source.

        Parameters
        ----------
        source : str | bytes | file-like
            File path (str), raw CSV content (bytes), or a file-like object.
        strict : bool
            Passed to the parser; if True, invalid rows raise an error.
        cache : bool
            If True, cache the result so repeated loads are instant.

        Returns
        -------
        (pd.DataFrame, DatasetMeta)
        """
        key = self._source_key(source)

        # Return from cache if available.
        if cache and key in self._cache:
            return self._cache[key]

        df = parse_ohlc_csv(source, strict=strict)
        meta = self._build_meta(df, key)

        if cache:
            self._cache[key] = (df, meta)

        return df, meta

    def get_cached(self, key: str) -> Optional[tuple[pd.DataFrame, DatasetMeta]]:
        """Retrieve a cached dataset by its source key, or None."""
        return self._cache.get(key)

    def clear_cache(self) -> None:
        """Remove all cached datasets."""
        self._cache.clear()

    def list_cached(self) -> list[str]:
        """Return the source keys of all cached datasets."""
        return list(self._cache.keys())

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _source_key(source: Union[str, bytes, io.IOBase]) -> str:
        """Derive a stable cache key from the source."""
        if isinstance(source, str):
            # Use file path as key.
            return source
        if isinstance(source, bytes):
            # Hash the bytes content.
            return f"bytes:{hashlib.md5(source).hexdigest()}"
        # For file-like objects, hash whatever we can read, then reset.
        content = source.read()
        if isinstance(content, str):
            content = content.encode()
        source.seek(0)
        return f"stream:{hashlib.md5(content).hexdigest()}"

    @staticmethod
    def _build_meta(df: pd.DataFrame, source_key: str) -> DatasetMeta:
        """Build metadata from a parsed DataFrame."""
        tr = get_time_range(df)
        return DatasetMeta(
            rows=len(df),
            columns=list(df.columns),
            time_start=tr["start"],
            time_end=tr["end"],
            estimated_timeframe=estimate_timeframe(df),
            source_key=source_key,
        )
