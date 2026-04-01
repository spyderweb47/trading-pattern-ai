"""
Sandboxed execution engine for user-supplied pattern detection scripts.

Only numpy, pandas, math, and statistics are available inside the sandbox.
All dangerous builtins and modules (os, sys, subprocess, etc.) are blocked.
"""

from __future__ import annotations

import math
import statistics
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd


class PatternExecutionError(Exception):
    """Raised when a pattern script fails or is rejected."""


# Whitelisted builtins for the sandbox.
_SAFE_BUILTINS: dict[str, Any] = {
    "abs": abs,
    "all": all,
    "any": any,
    "bool": bool,
    "dict": dict,
    "enumerate": enumerate,
    "filter": filter,
    "float": float,
    "frozenset": frozenset,
    "int": int,
    "isinstance": isinstance,
    "len": len,
    "list": list,
    "map": map,
    "max": max,
    "min": min,
    "print": print,
    "range": range,
    "reversed": reversed,
    "round": round,
    "set": set,
    "slice": slice,
    "sorted": sorted,
    "str": str,
    "sum": sum,
    "tuple": tuple,
    "type": type,
    "zip": zip,
    "True": True,
    "False": False,
    "None": None,
}

# Modules the script is allowed to use.
_ALLOWED_MODULES: dict[str, Any] = {
    "np": np,
    "numpy": np,
    "pd": pd,
    "pandas": pd,
    "math": math,
    "statistics": statistics,
}

# Strings that should never appear in a pattern script.
_BLOCKED_TOKENS: list[str] = [
    "import os",
    "import sys",
    "import subprocess",
    "import importlib",
    "__import__",
    "importlib",
    "subprocess",
    "os.system",
    "os.popen",
    "eval(",
    "exec(",
    "compile(",
    "open(",
    "getattr(",
    "setattr(",
    "delattr(",
    "__builtins__",
    "__class__",
    "__subclasses__",
    "__globals__",
    "__code__",
]


def _check_script_safety(script: str) -> None:
    """
    Static analysis: reject scripts containing blocked tokens.

    This is a defense-in-depth measure on top of the restricted globals.
    """
    lower = script.lower()
    for token in _BLOCKED_TOKENS:
        if token.lower() in lower:
            raise PatternExecutionError(
                f"Script contains blocked token: '{token}'"
            )


def _build_sandbox_globals(df: pd.DataFrame) -> dict[str, Any]:
    """
    Construct the restricted global namespace for script execution.

    The script receives the OHLC DataFrame as ``df`` and a pre-allocated
    ``results`` list to which it should append match dicts.
    """
    sandbox: dict[str, Any] = {
        "__builtins__": _SAFE_BUILTINS,
        "df": df.copy(),
        "results": [],
    }
    sandbox.update(_ALLOWED_MODULES)
    return sandbox


def execute_pattern_script(
    script: str,
    df: pd.DataFrame,
    timeout_seconds: float = 10.0,
) -> List[Dict[str, Any]]:
    """
    Execute a pattern detection script in a sandboxed environment.

    The script should populate a ``results`` list with dicts containing:
        - start_idx (int): Start row index of the pattern.
        - end_idx (int): End row index of the pattern.
        - confidence (float): 0.0 to 1.0.
        - pattern_type (str): Name/label of the detected pattern.

    Parameters
    ----------
    script : str
        Python source code for pattern detection.
    df : pd.DataFrame
        OHLC data to analyse.
    timeout_seconds : float
        Not enforced in this implementation (would require threading);
        reserved for future use.

    Returns
    -------
    list[dict]
        Pattern matches found by the script.

    Raises
    ------
    PatternExecutionError
        On safety violations or runtime errors.
    """
    # Step 1: Static safety check.
    _check_script_safety(script)

    # Step 2: Build the restricted namespace.
    sandbox = _build_sandbox_globals(df)

    # Step 3: Execute.
    try:
        exec(script, sandbox)  # noqa: S102 – intentional sandboxed exec
    except Exception as exc:
        raise PatternExecutionError(
            f"Script execution failed: {type(exc).__name__}: {exc}"
        ) from exc

    # Step 4: Extract and validate results.
    raw_results = sandbox.get("results", [])
    if not isinstance(raw_results, list):
        raise PatternExecutionError(
            "'results' must be a list of dicts"
        )

    validated: List[Dict[str, Any]] = []
    for i, item in enumerate(raw_results):
        if not isinstance(item, dict):
            raise PatternExecutionError(
                f"results[{i}] is not a dict"
            )
        required_keys = {"start_idx", "end_idx", "confidence", "pattern_type"}
        missing = required_keys - set(item.keys())
        if missing:
            raise PatternExecutionError(
                f"results[{i}] missing keys: {missing}"
            )
        validated.append(
            {
                "start_idx": int(item["start_idx"]),
                "end_idx": int(item["end_idx"]),
                "confidence": float(item["confidence"]),
                "pattern_type": str(item["pattern_type"]),
                # Preserve any extra fields the script added.
                **{k: v for k, v in item.items() if k not in required_keys},
            }
        )

    return validated
