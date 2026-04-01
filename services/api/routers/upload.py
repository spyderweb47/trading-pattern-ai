"""
File upload / dataset sync router.

Handles CSV file uploads (legacy) and JSON dataset sync from the
frontend, which now handles CSV parsing and resampling locally.
"""

from __future__ import annotations

import uuid
from typing import Any, Dict, List, Optional

import pandas as pd
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from core.utils.ohlc_parser import OHLCParseError, parse_ohlc_csv
from services.api.store import store

router = APIRouter(tags=["upload"])


class SyncDatasetRequest(BaseModel):
    dataset_id: str
    data: List[Dict[str, Any]]
    metadata: Dict[str, Any]


@router.post("/sync-dataset")
async def sync_dataset(req: SyncDatasetRequest) -> dict:
    """
    Receive pre-parsed OHLC data from the frontend and store it
    so pattern detection and backtesting can use it.
    """
    if not req.data:
        raise HTTPException(status_code=400, detail="No data provided")

    df = pd.DataFrame(req.data)

    # Ensure time column is datetime
    if "time" in df.columns:
        if pd.api.types.is_numeric_dtype(df["time"]):
            df["time"] = pd.to_datetime(df["time"], unit="s", utc=True)

    for col in ["open", "high", "low", "close"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    if "volume" in df.columns:
        df["volume"] = pd.to_numeric(df["volume"], errors="coerce").fillna(0)
    else:
        df["volume"] = 0

    store.save_dataset(req.dataset_id, df, req.metadata)

    return {"status": "ok", "dataset_id": req.dataset_id, "rows": len(df)}

# Target number of bars to send to the frontend chart.
TARGET_CHART_BARS = 6000

# Resample timeframes ordered by size — pick the smallest that
# brings the dataset under TARGET_CHART_BARS.
_RESAMPLE_TIMEFRAMES = [
    ("5min", "5min"),
    ("15min", "15min"),
    ("30min", "30min"),
    ("1h", "1h"),
    ("2h", "2h"),
    ("4h", "4h"),
    ("12h", "12h"),
    ("1d", "1D"),
    ("1w", "1W"),
]


def _resample_ohlc(df: pd.DataFrame, target_bars: int) -> pd.DataFrame:
    """
    Resample OHLC data to a higher timeframe so it fits within target_bars.

    Uses proper OHLC aggregation: first open, max high, min low, last close,
    sum volume — just like a real exchange candle aggregation.
    """
    if len(df) <= target_bars:
        return df

    # Ensure time is the index for resampling.
    resampled = df.set_index("time")

    for label, rule in _RESAMPLE_TIMEFRAMES:
        result = resampled.resample(rule).agg({
            "open": "first",
            "high": "max",
            "low": "min",
            "close": "last",
            "volume": "sum",
        }).dropna(subset=["open"])

        if len(result) <= target_bars:
            result = result.reset_index()
            return result

    # Fallback: use the largest timeframe even if still over target.
    result = resampled.resample("1W").agg({
        "open": "first",
        "high": "max",
        "low": "min",
        "close": "last",
        "volume": "sum",
    }).dropna(subset=["open"]).reset_index()
    return result


@router.post("/upload")
async def upload_csv(file: UploadFile = File(...)) -> JSONResponse:
    """
    Upload a CSV file containing OHLC data.

    The file is parsed and validated. On success, returns dataset metadata
    and OHLC bar data for charting (resampled to a higher timeframe if needed).
    """
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Only CSV files are accepted. Please upload a .csv file.",
        )

    try:
        contents = await file.read()
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to read uploaded file: {exc}",
        )

    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        df = parse_ohlc_csv(contents, strict=False)
    except OHLCParseError as exc:
        raise HTTPException(status_code=422, detail=f"CSV parse error: {exc}")
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Unexpected error parsing CSV: {exc}",
        )

    dataset_id = str(uuid.uuid4())
    time_start = str(df["time"].iloc[0])
    time_end = str(df["time"].iloc[-1])

    metadata = {
        "rows": len(df),
        "columns": list(df.columns),
        "time_range_start": time_start,
        "time_range_end": time_end,
        "filename": file.filename,
    }

    store.save_dataset(dataset_id, df, metadata)

    # Resample for chart display if too many bars.
    chart_df = _resample_ohlc(df, TARGET_CHART_BARS)

    # Build OHLC data as plain dicts with unix timestamps.
    times = (chart_df["time"].astype("int64") // 10**9).tolist()
    ohlc_data = [
        {
            "time": int(times[i]),
            "open": round(float(chart_df["open"].iloc[i]), 2),
            "high": round(float(chart_df["high"].iloc[i]), 2),
            "low": round(float(chart_df["low"].iloc[i]), 2),
            "close": round(float(chart_df["close"].iloc[i]), 2),
            "volume": round(float(chart_df["volume"].iloc[i]), 2),
        }
        for i in range(len(chart_df))
    ]

    return JSONResponse(content={
        "dataset": {
            "id": dataset_id,
            "name": file.filename or "untitled",
            "metadata": {
                "rows": len(df),
                "startDate": time_start,
                "endDate": time_end,
            },
        },
        "data": ohlc_data,
    })
