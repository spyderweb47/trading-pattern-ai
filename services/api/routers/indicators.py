"""
Indicators router.

Lists available technical indicators and computes them on demand
against stored datasets.
"""

from __future__ import annotations

import math
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException

from core.indicators.base_indicator import IndicatorRegistry
import core.indicators.built_in  # noqa: F401 -- triggers auto-registration
from services.api.models import (
    CalculateIndicatorRequest,
    CalculateIndicatorResponse,
    IndicatorInfo,
    ListIndicatorsResponse,
)
from services.api.store import store

router = APIRouter(tags=["indicators"])


@router.get("/indicators", response_model=ListIndicatorsResponse)
async def list_indicators() -> ListIndicatorsResponse:
    """
    List all available technical indicators.

    Returns the name of each registered indicator. Indicators are
    auto-registered when their modules are imported.
    """
    names = IndicatorRegistry.list_all()
    indicators = [IndicatorInfo(name=name) for name in names]
    return ListIndicatorsResponse(indicators=indicators)


@router.post("/calculate-indicator", response_model=CalculateIndicatorResponse)
async def calculate_indicator(request: CalculateIndicatorRequest) -> CalculateIndicatorResponse:
    """
    Calculate a technical indicator on a stored dataset.

    The indicator is looked up by name in the IndicatorRegistry,
    instantiated with the provided parameters, and calculated against
    the dataset's OHLC data.
    """
    df = store.get_dataframe(request.dataset_id)
    if df is None:
        raise HTTPException(status_code=404, detail=f"Dataset '{request.dataset_id}' not found.")

    try:
        indicator = IndicatorRegistry.create(request.indicator, **request.params)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except TypeError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid parameters for indicator '{request.indicator}': {exc}",
        )

    try:
        result = indicator.calculate(df)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Indicator calculation failed: {exc}",
        )

    # Convert result to a list of floats. Handle both Series and DataFrame.
    import pandas as pd

    if isinstance(result, pd.DataFrame):
        # For multi-column indicators (e.g. Bollinger Bands, MACD),
        # return the first column.
        values_series = result.iloc[:, 0]
    else:
        values_series = result

    values: List[Optional[float]] = []
    for v in values_series:
        if v is None or (isinstance(v, float) and (math.isnan(v) or math.isinf(v))):
            values.append(None)
        else:
            values.append(float(v))

    return CalculateIndicatorResponse(
        indicator=request.indicator,
        params=indicator.params,
        values=values,
        length=len(values),
    )
