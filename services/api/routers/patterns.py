"""
Pattern detection router.

Provides endpoints to generate pattern detection scripts from hypotheses
and to execute those scripts against uploaded datasets.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from core.agents.pattern_agent import PatternAgent
from core.engine.pattern_executor import PatternExecutionError, execute_pattern_script
from services.api.models import (
    GeneratePatternRequest,
    GeneratePatternResponse,
    PatternMatch,
    RunPatternRequest,
    RunPatternResponse,
)
from services.api.store import store

router = APIRouter(tags=["patterns"])

_pattern_agent = PatternAgent()


@router.post("/generate-pattern", response_model=GeneratePatternResponse)
async def generate_pattern(request: GeneratePatternRequest) -> GeneratePatternResponse:
    """
    Generate a pattern detection script from a natural-language hypothesis.

    Requires a valid dataset_id to confirm the dataset exists. Uses the
    PatternAgent to produce an executable Python script.
    """
    df = store.get_dataframe(request.dataset_id)
    if df is None:
        raise HTTPException(status_code=404, detail=f"Dataset '{request.dataset_id}' not found.")

    try:
        result = _pattern_agent.generate(request.hypothesis)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Pattern generation failed: {exc}",
        )

    return GeneratePatternResponse(
        script=result["script"],
        explanation=result["explanation"],
        parameters=result["parameters"],
        indicators_used=result.get("indicators_used", []),
    )


@router.post("/run-pattern")
async def run_pattern(request: RunPatternRequest):
    """
    Execute a pattern detection script against a dataset.

    The script runs in a sandboxed environment with access to numpy,
    pandas, math, and statistics. It populates a `results` list with
    pattern matches.
    """
    df = store.get_dataframe(request.dataset_id)
    if df is None:
        raise HTTPException(status_code=404, detail=f"Dataset '{request.dataset_id}' not found.")

    # Apply timeframe filtering if specified and not "full".
    target_df = df
    if request.timeframe and request.timeframe.lower() != "full":
        target_df = _filter_by_timeframe(df, request.timeframe)

    try:
        raw_matches = execute_pattern_script(request.script, target_df)
    except PatternExecutionError as exc:
        raise HTTPException(status_code=422, detail=f"Pattern execution error: {exc}")
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error during pattern execution: {exc}",
        )

    # Enrich matches with time data and unique IDs for frontend consumption
    import uuid

    enriched = []
    for m in raw_matches:
        si = m["start_idx"]
        ei = m["end_idx"]
        ptype = m["pattern_type"]

        # Get time values from the dataframe
        start_time = ""
        end_time = ""
        if si < len(target_df):
            t = target_df.iloc[si]["time"]
            start_time = str(int(t.timestamp())) if hasattr(t, "timestamp") else str(t)
        if ei < len(target_df):
            t = target_df.iloc[ei]["time"]
            end_time = str(int(t.timestamp())) if hasattr(t, "timestamp") else str(t)

        # Infer direction from pattern type
        direction = "neutral"
        lower_type = ptype.lower()
        if any(kw in lower_type for kw in ["bullish", "bottom", "breakout", "buy"]):
            direction = "bullish"
        elif any(kw in lower_type for kw in ["bearish", "top", "breakdown", "sell"]):
            direction = "bearish"

        enriched.append({
            "id": str(uuid.uuid4()),
            "name": ptype.replace("_", " ").title(),
            "startIndex": si,
            "endIndex": ei,
            "startTime": start_time,
            "endTime": end_time,
            "direction": direction,
            "confidence": m["confidence"],
        })

    return {"matches": enriched}


def _filter_by_timeframe(df, timeframe: str):
    """
    Filter or resample the DataFrame based on a timeframe string.

    Supported formats: '1h', '4h', '1d', etc. Falls back to returning
    the full DataFrame if the timeframe is not parseable.
    """
    try:
        if "time" in df.columns:
            resampled = (
                df.set_index("time")
                .resample(timeframe)
                .agg({
                    "open": "first",
                    "high": "max",
                    "low": "min",
                    "close": "last",
                    "volume": "sum",
                })
                .dropna()
                .reset_index()
            )
            return resampled
    except Exception:
        pass
    return df
