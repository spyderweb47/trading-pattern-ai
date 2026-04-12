"""
DAG-based debate orchestrator for the 4-agent trading committee.

Execution order:
  [Bull] ──┐
           ├──→ [Risk] ──→ [PM] ──→ Final Decision
  [Bear] ──┘

Bull and Bear run in parallel. Risk sees both. PM sees all three.
"""

from __future__ import annotations

import asyncio
from typing import Any, Dict

from core.agents.simulation_agents import (
    BullAnalyst,
    BearAnalyst,
    RiskOfficer,
    PortfolioManager,
    format_ohlc_for_prompt,
)


class DebateOrchestrator:
    """Runs the 4-agent committee debate in DAG order."""

    def __init__(self) -> None:
        self.bull = BullAnalyst()
        self.bear = BearAnalyst()
        self.risk = RiskOfficer()
        self.pm = PortfolioManager()

    async def run(self, bars: list[dict], symbol: str) -> Dict[str, Any]:
        """Execute the full debate DAG. Returns all agent results + PM decision."""
        market_data = format_ohlc_for_prompt(bars, symbol)

        # Layer 1: Bull and Bear in parallel
        bull_result, bear_result = await asyncio.gather(
            asyncio.to_thread(self.bull.analyze, market_data),
            asyncio.to_thread(self.bear.analyze, market_data),
        )

        # Layer 2: Risk Officer (sees Bull + Bear arguments)
        prior_for_risk = {
            "bull": bull_result.get("argument", ""),
            "bear": bear_result.get("argument", ""),
        }
        risk_result = await asyncio.to_thread(
            self.risk.analyze, market_data, prior_for_risk
        )

        # Layer 3: Portfolio Manager (sees all three)
        prior_for_pm = {
            "bull": bull_result.get("argument", ""),
            "bear": bear_result.get("argument", ""),
            "risk": risk_result.get("argument", ""),
        }
        pm_result = await asyncio.to_thread(
            self.pm.analyze, market_data, prior_for_pm
        )

        return {
            "bull": {
                "role": "bull",
                "label": "Bull Analyst",
                "argument": bull_result.get("argument", ""),
                "key_points": bull_result.get("key_points", []),
                "sentiment": float(bull_result.get("sentiment", 0)),
                "signals": bull_result.get("signals", []),
            },
            "bear": {
                "role": "bear",
                "label": "Bear Analyst",
                "argument": bear_result.get("argument", ""),
                "key_points": bear_result.get("key_points", []),
                "sentiment": float(bear_result.get("sentiment", 0)),
                "signals": bear_result.get("signals", []),
            },
            "risk": {
                "role": "risk",
                "label": "Risk Officer",
                "argument": risk_result.get("argument", ""),
                "key_points": risk_result.get("key_points", []),
                "sentiment": float(risk_result.get("sentiment", 0)),
                "signals": risk_result.get("signals", []),
            },
            "pm": {
                "role": "pm",
                "label": "Portfolio Manager",
                "argument": pm_result.get("reasoning", pm_result.get("argument", "")),
                "key_points": pm_result.get("key_points", []),
                "sentiment": 0.0,
                "signals": [],
            },
            "decision": {
                "decision": pm_result.get("decision", "HOLD"),
                "confidence": float(pm_result.get("confidence", 0.5)),
                "reasoning": pm_result.get("reasoning", ""),
                "suggested_entry": pm_result.get("suggested_entry"),
                "suggested_stop": pm_result.get("suggested_stop"),
                "suggested_target": pm_result.get("suggested_target"),
                "position_size_pct": pm_result.get("position_size_pct"),
            },
        }
