"""
Thread-safe in-memory data store for datasets, scripts, and results.

Uses a threading.Lock to ensure safe concurrent access from multiple
request handlers.
"""

from __future__ import annotations

import threading
from typing import Any, Dict, List, Optional

import pandas as pd


class DataStore:
    """
    Singleton-style in-memory store for the trading platform API.

    Stores:
    - datasets: Parsed OHLC DataFrames keyed by dataset_id (UUID string).
    - scripts: Generated pattern/strategy scripts keyed by script_id.
    - results: Backtest and simulation results keyed by result_id.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._datasets: Dict[str, Dict[str, Any]] = {}
        self._scripts: Dict[str, Dict[str, Any]] = {}
        self._results: Dict[str, Dict[str, Any]] = {}

    # ------------------------------------------------------------------
    # Datasets
    # ------------------------------------------------------------------

    def save_dataset(self, dataset_id: str, df: pd.DataFrame, metadata: Dict[str, Any]) -> None:
        """Store a parsed OHLC DataFrame with its metadata."""
        with self._lock:
            self._datasets[dataset_id] = {
                "df": df,
                "metadata": metadata,
            }

    def get_dataset(self, dataset_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve a dataset entry by ID. Returns None if not found."""
        with self._lock:
            return self._datasets.get(dataset_id)

    def get_dataframe(self, dataset_id: str) -> Optional[pd.DataFrame]:
        """Retrieve just the DataFrame for a dataset. Returns None if not found."""
        with self._lock:
            entry = self._datasets.get(dataset_id)
            if entry is None:
                return None
            return entry["df"]

    def list_datasets(self) -> List[str]:
        """Return all stored dataset IDs."""
        with self._lock:
            return list(self._datasets.keys())

    def delete_dataset(self, dataset_id: str) -> bool:
        """Delete a dataset. Returns True if it existed."""
        with self._lock:
            return self._datasets.pop(dataset_id, None) is not None

    # ------------------------------------------------------------------
    # Scripts
    # ------------------------------------------------------------------

    def save_script(self, script_id: str, data: Dict[str, Any]) -> None:
        """Store a generated script."""
        with self._lock:
            self._scripts[script_id] = data

    def get_script(self, script_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve a script by ID."""
        with self._lock:
            return self._scripts.get(script_id)

    # ------------------------------------------------------------------
    # Results
    # ------------------------------------------------------------------

    def save_result(self, result_id: str, data: Dict[str, Any]) -> None:
        """Store a backtest or simulation result."""
        with self._lock:
            self._results[result_id] = data

    def get_result(self, result_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve a result by ID."""
        with self._lock:
            return self._results.get(result_id)


# Module-level singleton instance.
store = DataStore()
