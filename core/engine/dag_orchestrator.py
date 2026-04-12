"""
6-stage social simulation orchestrator.

Pipeline:
  1. AssetClassifier → classify the asset
  2. ChartSupportAgent → prepare multi-timeframe data
  3. EntityGenerator → create 20-30 personas
  4. Multi-round discussion (5 rounds, 6-8 entities per round, parallel)
  5. ChartSupportAgent → inject data when requested mid-debate
  6. SummaryAgent → produce final report

Each round's speakers see the FULL thread so far (shared context).
"""

from __future__ import annotations

import asyncio
import uuid
from typing import Any, Dict, List

from core.agents.simulation_agents import (
    AssetClassifier,
    ChartSupportAgent,
    EntityGenerator,
    DiscussionAgent,
    SummaryAgent,
)


class DebateOrchestrator:
    """Runs the full social simulation pipeline."""

    ROUNDS = 5
    SPEAKERS_PER_ROUND = 7

    def __init__(self) -> None:
        self.classifier = AssetClassifier()
        self.chart_support = ChartSupportAgent()
        self.entity_gen = EntityGenerator()
        self.summary_agent = SummaryAgent()

    async def run(
        self,
        bars: list[dict],
        symbol: str,
        report_text: str = "",
    ) -> Dict[str, Any]:
        """Execute the full 6-stage pipeline."""

        # --- Stage 1: Classify the asset ---
        price_range = (
            min(b["low"] for b in bars) if bars else 0,
            max(b["high"] for b in bars) if bars else 0,
        )
        asset_info = await asyncio.to_thread(
            self.classifier.classify, symbol, price_range, len(bars)
        )

        # --- Stage 2: Prepare multi-timeframe data ---
        summaries = self.chart_support.prepare_multi_timeframe(bars, symbol)
        main_summary = summaries.get("daily", summaries.get("raw", "No data"))

        # --- Stage 3: Generate entities ---
        entities = await asyncio.to_thread(
            self.entity_gen.generate, asset_info, main_summary, report_text
        )

        # --- Stage 4 + 5: Multi-round discussion ---
        thread: List[Dict[str, Any]] = []
        thread_text = ""
        all_entities = list(entities)
        n_entities = len(all_entities)

        for round_num in range(1, self.ROUNDS + 1):
            # Pick speakers for this round (round-robin)
            start_idx = ((round_num - 1) * self.SPEAKERS_PER_ROUND) % n_entities
            speaker_indices = []
            for j in range(self.SPEAKERS_PER_ROUND):
                speaker_indices.append((start_idx + j) % n_entities)
            speakers = [all_entities[i] for i in speaker_indices]

            # All speakers in this round run in parallel
            agents = [DiscussionAgent(e, asset_info) for e in speakers]
            results = await asyncio.gather(
                *[asyncio.to_thread(a.speak, main_summary, thread_text, report_text[:800]) for a in agents]
            )

            # Append to thread
            for entity, result in zip(speakers, results):
                msg = {
                    "id": str(uuid.uuid4()),
                    "round": round_num,
                    "entity_id": entity["id"],
                    "entity_name": entity["name"],
                    "entity_role": entity["role"],
                    "content": result.get("content", ""),
                    "sentiment": float(result.get("sentiment", 0)),
                    "price_prediction": result.get("price_prediction"),
                    "agreed_with": result.get("agreed_with", []),
                    "disagreed_with": result.get("disagreed_with", []),
                    "is_chart_support": False,
                    "data_request": result.get("data_request"),
                }
                thread.append(msg)

            # Update thread text for next round
            thread_text = self._build_thread_text(thread)

            # --- Stage 5: Check for data requests in this round ---
            for msg in thread:
                if msg["round"] == round_num and msg.get("data_request"):
                    injected = self.chart_support.handle_data_request(
                        msg["data_request"], bars, symbol
                    )
                    if injected:
                        chart_msg = {
                            "id": str(uuid.uuid4()),
                            "round": round_num,
                            "entity_id": "chart_support",
                            "entity_name": "Chart Support",
                            "entity_role": "Data Agent",
                            "content": f"[Data for {msg['entity_name']}]\n{injected}",
                            "sentiment": 0,
                            "price_prediction": None,
                            "agreed_with": [],
                            "disagreed_with": [],
                            "is_chart_support": True,
                            "data_request": None,
                        }
                        thread.append(chart_msg)
                        thread_text = self._build_thread_text(thread)

        # --- Stage 6: Summary ---
        summary = await asyncio.to_thread(
            self.summary_agent.summarize, thread_text, asset_info
        )

        return {
            "asset_info": asset_info,
            "entities": all_entities,
            "thread": thread,
            "total_rounds": self.ROUNDS,
            "summary": summary,
        }

    def _build_thread_text(self, thread: List[Dict]) -> str:
        """Build a compact text representation of the discussion for LLM context."""
        lines = []
        current_round = 0
        for msg in thread:
            if msg["round"] != current_round:
                current_round = msg["round"]
                lines.append(f"\n--- Round {current_round} ---")
            prefix = f"[{msg['entity_name']} ({msg['entity_role']})]"
            if msg.get("is_chart_support"):
                prefix = "[Chart Support]"
            lines.append(f"{prefix}: {msg['content']}")
        return "\n".join(lines)
