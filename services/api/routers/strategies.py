"""
Strategy generation router.

Converts a pattern detection script and user intent into a full
trading strategy using the StrategyAgent.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from core.agents.strategy_agent import StrategyAgent
from services.api.models import GenerateStrategyRequest, GenerateStrategyResponse

router = APIRouter(tags=["strategies"])

_strategy_agent = StrategyAgent()


@router.post("/generate-strategy", response_model=GenerateStrategyResponse)
async def generate_strategy(request: GenerateStrategyRequest) -> GenerateStrategyResponse:
    """
    Generate a trading strategy from a pattern script and trading intent.

    The StrategyAgent produces a strategy with entry/exit conditions,
    risk management parameters, and human-readable explanations.
    """
    try:
        result = _strategy_agent.generate(
            pattern_info=request.pattern_script,
            user_intent=request.intent,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Strategy generation failed: {exc}",
        )

    return GenerateStrategyResponse(
        script=result["script"],
        explanation=result["explanation"],
        parameters=result["parameters"],
        entry_rules=result.get("entry_rules", []),
        exit_rules=result.get("exit_rules", []),
    )
