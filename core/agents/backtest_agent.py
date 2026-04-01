"""
Backtest configuration and interpretation agent.

Takes a strategy and dataset metadata, configures the backtest,
and interprets results with actionable suggestions.

Uses OpenAI when available, falls back to heuristic-based analysis.
"""

from __future__ import annotations

from typing import Any, Dict, List

from core.agents.llm_client import chat_completion, is_available as llm_available


# ---------------------------------------------------------------------------
# Prompt templates
# ---------------------------------------------------------------------------

BACKTEST_CONFIG_SYSTEM_PROMPT = """You are a quantitative trading analyst.

Given a strategy description and dataset metadata, recommend optimal backtest
configuration parameters. Be concise and practical.

Respond with a brief paragraph covering:
- Recommended initial capital and position sizing
- Stop-loss and take-profit recommendations
- Any warnings about the dataset or strategy

Keep it to 3-4 sentences."""

BACKTEST_INTERPRET_SYSTEM_PROMPT = """You are a quantitative trading analyst.

Given backtest results and metrics, provide:
1. A concise interpretation of the performance (2-3 sentences)
2. 3-5 specific, actionable suggestions for improvement

Focus on: win rate, risk-adjusted returns, drawdown, and profit factor.
Be direct and practical. No generic advice."""


# ---------------------------------------------------------------------------
# Agent
# ---------------------------------------------------------------------------

class BacktestAgent:
    """
    Agent that configures backtests and interprets their results.

    Uses OpenAI when OPENAI_API_KEY is set, otherwise uses heuristic analysis.
    """

    def __init__(self, model: str = "gpt-4o-mini") -> None:
        self.model = model

    def configure(
        self,
        strategy_description: str,
        dataset_meta: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Generate recommended backtest configuration."""
        rows = dataset_meta.get("rows", 1000)
        initial_capital = 100000.0 if rows > 10000 else 10000.0

        config = {
            "initial_capital": initial_capital,
            "position_size": 1.0,
            "max_open_positions": 1,
            "stop_loss_pct": 0.02,
            "take_profit_pct": 0.04,
            "commission_pct": 0.001,
        }

        if llm_available():
            explanation = chat_completion(
                system_prompt=BACKTEST_CONFIG_SYSTEM_PROMPT,
                user_message=(
                    f"Strategy: {strategy_description}\n"
                    f"Dataset: {rows} bars, "
                    f"{dataset_meta.get('timeframe', 'unknown')} timeframe, "
                    f"{dataset_meta.get('time_start', '?')} to "
                    f"{dataset_meta.get('time_end', '?')}"
                ),
                model=self.model,
                temperature=0.3,
                max_tokens=300,
            )
        else:
            timeframe = dataset_meta.get("timeframe", "1h")
            explanation = (
                f"Recommended config for {timeframe} dataset with {rows} bars. "
                f"Starting capital ${initial_capital:,.0f} with 2% stop-loss "
                f"and 4% take-profit (2:1 reward-to-risk ratio)."
            )

        return {
            "config": config,
            "explanation": explanation,
            "suggestions": [
                "Start with a single position to validate strategy logic.",
                "Use a 2:1 reward-to-risk ratio as baseline.",
                "Run on out-of-sample data after initial tuning.",
            ],
        }

    def interpret(
        self,
        strategy_description: str,
        dataset_meta: Dict[str, Any],
        backtest_results: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Interpret backtest results and provide suggestions."""
        metrics = backtest_results.get("metrics", {})

        if llm_available():
            return self._interpret_with_llm(
                strategy_description, dataset_meta, metrics
            )
        return self._interpret_heuristic(metrics)

    def _interpret_with_llm(
        self,
        strategy_description: str,
        dataset_meta: Dict[str, Any],
        metrics: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Interpret results using OpenAI."""
        response = chat_completion(
            system_prompt=BACKTEST_INTERPRET_SYSTEM_PROMPT,
            user_message=(
                f"Strategy: {strategy_description}\n\n"
                f"Metrics:\n{_format_metrics(metrics)}"
            ),
            model=self.model,
            temperature=0.3,
            max_tokens=500,
        )

        # Split response into explanation and suggestions.
        lines = response.strip().split("\n")
        explanation_lines = []
        suggestions = []
        in_suggestions = False

        for line in lines:
            stripped = line.strip()
            if stripped.startswith(("-", "*", "•")) or (
                stripped and stripped[0].isdigit() and "." in stripped[:3]
            ):
                in_suggestions = True
                # Remove bullet/number prefix.
                clean = stripped.lstrip("-*•0123456789. ")
                if clean:
                    suggestions.append(clean)
            elif not in_suggestions:
                if stripped:
                    explanation_lines.append(stripped)

        return {
            "config": {},
            "explanation": " ".join(explanation_lines) or response,
            "suggestions": suggestions or ["Review the full metrics for details."],
        }

    @staticmethod
    def _interpret_heuristic(metrics: Dict[str, Any]) -> Dict[str, Any]:
        """Heuristic-based interpretation without LLM."""
        suggestions: List[str] = []
        parts: List[str] = []

        total_pnl = metrics.get("total_pnl", 0)
        win_rate = metrics.get("win_rate", 0)
        sharpe = metrics.get("sharpe_ratio", 0)
        max_dd_pct = metrics.get("max_drawdown_pct", 0)
        profit_factor = metrics.get("profit_factor", 0)

        if total_pnl > 0:
            parts.append(f"Profitable strategy (PnL: {total_pnl:.2f}).")
        else:
            parts.append(f"Unprofitable (PnL: {total_pnl:.2f}).")
            suggestions.append("Review entry conditions for better timing.")

        if win_rate < 0.4:
            suggestions.append(f"Low win rate ({win_rate:.1%}). Tighten entry filters.")
        elif win_rate > 0.6:
            parts.append(f"Strong win rate: {win_rate:.1%}.")

        if sharpe < 0.5:
            suggestions.append("Sharpe < 0.5: poor risk-adjusted returns.")
        elif sharpe > 1.5:
            parts.append(f"Excellent Sharpe ratio: {sharpe:.2f}.")

        if max_dd_pct > 0.2:
            suggestions.append(
                f"Max drawdown {max_dd_pct:.1%} is high. Tighten stops."
            )

        if profit_factor < 1.0:
            suggestions.append("Profit factor < 1. Reassess exit strategy.")

        if not suggestions:
            suggestions.append("Looks solid. Validate on out-of-sample data.")

        return {
            "config": {},
            "explanation": " ".join(parts),
            "suggestions": suggestions,
        }


def _format_metrics(metrics: Dict[str, Any]) -> str:
    """Format metrics dict into a readable string."""
    lines = []
    for k, v in metrics.items():
        if isinstance(v, float):
            lines.append(f"  {k}: {v:.4f}")
        else:
            lines.append(f"  {k}: {v}")
    return "\n".join(lines)
