"""
Analysis router.

Runs one or more analyses on a stored dataset: support/resistance,
trend detection, volatility zones, and micro-structure analysis.
"""

from __future__ import annotations

from dataclasses import asdict
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException

from core.analysis.support_resistance import find_support_resistance
from core.analysis.trend_detection import detect_trends
from core.analysis.volatility_zones import detect_volatility_zones
from core.analysis.micro_structure import analyse_micro_structure
from services.api.models import AnalyzeRequest, AnalyzeResponse
from services.api.store import store

router = APIRouter(tags=["analysis"])

VALID_ANALYSES = {"support_resistance", "trend", "volatility", "micro_structure"}


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(request: AnalyzeRequest) -> AnalyzeResponse:
    """
    Run one or more analyses on a stored dataset.

    Supported analysis types:
    - support_resistance: Detect support and resistance zones.
    - trend: Detect bullish, bearish, and sideways trend phases.
    - volatility: Detect high/low volatility regimes and spikes.
    - micro_structure: Window-based combined micro-structure analysis.
    """
    df = store.get_dataframe(request.dataset_id)
    if df is None:
        raise HTTPException(status_code=404, detail=f"Dataset '{request.dataset_id}' not found.")

    # Validate requested analyses.
    invalid = set(request.analyses) - VALID_ANALYSES
    if invalid:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid analysis types: {invalid}. Valid options: {sorted(VALID_ANALYSES)}",
        )

    results: Dict[str, Any] = {}

    try:
        if "support_resistance" in request.analyses:
            sr_zones = find_support_resistance(df)
            results["support_resistance"] = [asdict(z) for z in sr_zones]

        if "trend" in request.analyses:
            trends = detect_trends(df)
            results["trend"] = [asdict(t) for t in trends]

        if "volatility" in request.analyses:
            vol_zones = detect_volatility_zones(df)
            results["volatility"] = [asdict(v) for v in vol_zones]

        if "micro_structure" in request.analyses:
            micro = analyse_micro_structure(df)
            results["micro_structure"] = _serialize_micro_structure(micro)

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {exc}",
        )

    return AnalyzeResponse(
        dataset_id=request.dataset_id,
        results=results,
    )


def _serialize_micro_structure(windows: list) -> List[Dict[str, Any]]:
    """Convert WindowAnalysis dataclass instances to JSON-safe dicts."""
    serialized = []
    for w in windows:
        entry = {
            "window_index": w.window_index,
            "start_idx": w.start_idx,
            "end_idx": w.end_idx,
            "start_time": str(w.start_time) if w.start_time is not None else None,
            "end_time": str(w.end_time) if w.end_time is not None else None,
            "bar_count": w.bar_count,
            "dominant_trend": w.dominant_trend,
            "avg_volatility": w.avg_volatility,
            "sr_zone_count": w.sr_zone_count,
            "local_trend": [asdict(t) for t in w.local_trend],
            "local_sr_zones": [asdict(z) for z in w.local_sr_zones],
            "local_volatility": [asdict(v) for v in w.local_volatility],
        }
        serialized.append(entry)
    return serialized
