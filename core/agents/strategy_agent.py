"""
Strategy agent.

Converts a detected pattern and user intent into a complete trading strategy
with entry rules, exit rules, and risk parameters.

Uses OpenAI when available, falls back to example strategies.
"""

from __future__ import annotations

from typing import Any, Dict, List

from core.agents.llm_client import chat_completion, chat_completion_json, is_available as llm_available


# ---------------------------------------------------------------------------
# Prompt templates
# ---------------------------------------------------------------------------

STRATEGY_SYSTEM_PROMPT = """You are a quantitative trading strategist.

Given a pattern detection script or description and the user's trading intent,
generate a complete trading strategy as Python code.

## Requirements
1. Define `entry_condition(bar_idx, bar, history, indicators)` that returns
   'long', 'short', or None.
2. Define `exit_condition(bar_idx, bar, history, indicators, position)` that
   returns True to close a position, False otherwise.
3. `history` is a pandas DataFrame with columns: time, open, high, low, close, volume
   (all bars up to and including the current bar).
4. `bar` is the current row as a pandas Series.
5. `indicators` is a dict (can be empty).
6. `position` is a dict with keys: direction, entry_price, entry_idx.
7. Include risk management parameters as module-level variables.
8. Use only numpy, pandas, math, statistics.
9. Do NOT import anything.

## Output
Return ONLY the Python script. No markdown fences."""

STRATEGY_EXPLAIN_PROMPT = """You are a trading analyst. Given this strategy script,
provide a JSON response with:
- explanation: 2-3 sentence description of the strategy
- entry_rules: list of entry rule descriptions (strings)
- exit_rules: list of exit rule descriptions (strings)

Return valid JSON only, no markdown fences."""


# ---------------------------------------------------------------------------
# Example strategy
# ---------------------------------------------------------------------------

EXAMPLE_MA_CROSSOVER_STRATEGY = '''# Moving Average Crossover Strategy with RSI Filter
# Entry (long): Fast EMA crosses above slow EMA AND RSI < 70.
# Exit (long): Fast EMA crosses below slow EMA OR RSI > 80.

fast_period = 12
slow_period = 26
rsi_period = 14
rsi_overbought = 70
rsi_exit = 80
stop_loss_pct = 0.02
take_profit_pct = 0.04

def entry_condition(bar_idx, bar, history, indicators):
    """Return 'long', 'short', or None."""
    if bar_idx < slow_period:
        return None

    fast_ema = history["close"].ewm(span=fast_period, adjust=False).mean()
    slow_ema = history["close"].ewm(span=slow_period, adjust=False).mean()

    curr_above = fast_ema.iloc[-1] > slow_ema.iloc[-1]
    prev_above = fast_ema.iloc[-2] > slow_ema.iloc[-2] if len(fast_ema) > 1 else False

    delta = history["close"].diff()
    gain = delta.clip(lower=0).ewm(alpha=1/rsi_period, adjust=False).mean()
    loss = (-delta).clip(lower=0).ewm(alpha=1/rsi_period, adjust=False).mean()
    rs = gain / loss.replace(0, float("nan"))
    rsi = 100 - 100 / (1 + rs)
    current_rsi = rsi.iloc[-1] if not rsi.empty else 50

    if curr_above and not prev_above and current_rsi < rsi_overbought:
        return "long"
    return None

def exit_condition(bar_idx, bar, history, indicators, position):
    """Return True to close the position."""
    if bar_idx < slow_period:
        return False

    fast_ema = history["close"].ewm(span=fast_period, adjust=False).mean()
    slow_ema = history["close"].ewm(span=slow_period, adjust=False).mean()
    curr_below = fast_ema.iloc[-1] < slow_ema.iloc[-1]

    delta = history["close"].diff()
    gain = delta.clip(lower=0).ewm(alpha=1/rsi_period, adjust=False).mean()
    loss = (-delta).clip(lower=0).ewm(alpha=1/rsi_period, adjust=False).mean()
    rs = gain / loss.replace(0, float("nan"))
    rsi = 100 - 100 / (1 + rs)
    current_rsi = rsi.iloc[-1] if not rsi.empty else 50

    if curr_below or current_rsi > rsi_exit:
        return True
    return False
'''


# ---------------------------------------------------------------------------
# Agent
# ---------------------------------------------------------------------------

class StrategyAgent:
    """
    Agent that converts a pattern + user intent into a trading strategy.

    Uses OpenAI when OPENAI_API_KEY is set, otherwise returns example strategy.
    """

    def __init__(self, model: str = "gpt-4o-mini") -> None:
        self.model = model

    def generate(
        self,
        pattern_info: str,
        user_intent: str,
    ) -> Dict[str, Any]:
        """
        Generate a trading strategy from pattern info and user intent.

        Returns dict with: script, explanation, parameters, entry_rules, exit_rules.
        """
        if llm_available():
            return self._generate_with_llm(pattern_info, user_intent)
        return self._generate_mock(pattern_info, user_intent)

    def _generate_with_llm(
        self, pattern_info: str, user_intent: str
    ) -> Dict[str, Any]:
        """Generate strategy using OpenAI."""
        user_msg = (
            f"## Pattern\n{pattern_info}\n\n"
            f"## Intent\n{user_intent}"
        )

        script = chat_completion(
            system_prompt=STRATEGY_SYSTEM_PROMPT,
            user_message=user_msg,
            model=self.model,
            temperature=0.3,
        )
        script = _strip_code_fences(script)

        # Get structured explanation.
        meta = chat_completion_json(
            system_prompt=STRATEGY_EXPLAIN_PROMPT,
            user_message=script,
            model=self.model,
            temperature=0.2,
            max_tokens=500,
        )

        return {
            "script": script,
            "explanation": meta.get("explanation", "Strategy generated by AI."),
            "parameters": self._extract_parameters(script),
            "entry_rules": meta.get("entry_rules", []),
            "exit_rules": meta.get("exit_rules", []),
        }

    def _generate_mock(
        self, pattern_info: str, user_intent: str
    ) -> Dict[str, Any]:
        """Fallback: return the example MA crossover strategy."""
        return {
            "script": EXAMPLE_MA_CROSSOVER_STRATEGY,
            "explanation": (
                f"Strategy for pattern: '{pattern_info}' with intent: "
                f"'{user_intent}'. Uses dual EMA crossover with RSI filter. "
                "Includes 2% stop-loss and 4% take-profit."
            ),
            "parameters": {
                "fast_period": 12,
                "slow_period": 26,
                "rsi_period": 14,
                "rsi_overbought": 70,
                "rsi_exit": 80,
                "stop_loss_pct": 0.02,
                "take_profit_pct": 0.04,
            },
            "entry_rules": [
                "Fast EMA (12) crosses above slow EMA (26)",
                "RSI (14) is below 70 (not overbought)",
            ],
            "exit_rules": [
                "Fast EMA crosses below slow EMA",
                "RSI rises above 80",
                "Stop-loss at 2% below entry",
                "Take-profit at 4% above entry",
            ],
        }

    @staticmethod
    def _extract_parameters(script: str) -> Dict[str, Any]:
        """Extract tunable parameters from script."""
        params: Dict[str, Any] = {}
        for line in script.splitlines():
            s = line.strip()
            if "=" in s and not s.startswith("#") and "==" not in s and "def " not in s:
                parts = s.split("=", 1)
                name = parts[0].strip()
                value = parts[1].strip().split("#")[0].strip()
                if name.isidentifier() and name not in ("results", "df"):
                    try:
                        params[name] = float(value) if "." in value else int(value)
                    except ValueError:
                        pass
        return params


def _strip_code_fences(text: str) -> str:
    """Remove markdown code fences from LLM output."""
    text = text.strip()
    if text.startswith("```"):
        first_nl = text.index("\n") if "\n" in text else len(text)
        text = text[first_nl + 1:]
        if text.endswith("```"):
            text = text[:-3]
    return text.strip()
