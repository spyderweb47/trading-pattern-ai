"""
Pattern detection agent.

Converts a natural-language hypothesis into a JavaScript pattern detection
script that runs in the browser against OHLC data.

Uses OpenAI when available, falls back to keyword-matched example scripts.
"""

from __future__ import annotations

from typing import Any, Dict, List

from core.agents.llm_client import chat_completion, is_available as llm_available


# ---------------------------------------------------------------------------
# Prompt template for the LLM
# ---------------------------------------------------------------------------

PATTERN_SYSTEM_PROMPT = """You are a quantitative trading pattern detection engineer.

Given a natural-language hypothesis about a price pattern, generate a JavaScript
script that detects occurrences of that pattern in OHLC data.

## Environment
- The script receives an array called `data` where each element is an object:
  { time: number, open: number, high: number, low: number, close: number, volume: number }
- `data` is sorted by time ascending. `time` is a unix timestamp in seconds.
- The script MUST populate an array called `results` with objects, where each object
  has the keys: start_idx (number), end_idx (number), confidence (number 0-1),
  pattern_type (string).
- You have access to: Math.min, Math.max, Math.abs, Math.round, Math.sqrt, Math.floor, Math.ceil.
- Do NOT use import, require, fetch, XMLHttpRequest, eval, Function, or any DOM APIs.
- Do NOT use async/await or Promises.

## CRITICAL RULES
1. Always initialize: const results = [];
2. Use array index access: data[i].close, data[i].open, etc.
3. Use for loops: for (let i = 0; i < data.length; i++) { ... }
4. Include a confidence score (0.0 to 1.0) based on pattern quality.
5. Handle edge cases: check data.length >= minimum required bars.
6. Keep the script concise — under 50 lines of logic.
7. Use helper variables for readability: const closes = data.map(d => d.close);
8. End the script with: return results;

## Output format
Return ONLY the JavaScript code. No markdown fences, no explanations outside comments."""


# ---------------------------------------------------------------------------
# Example scripts (JavaScript)
# ---------------------------------------------------------------------------

EXAMPLE_DOUBLE_BOTTOM = '''// Double Bottom Pattern Detection
// Looks for two troughs at approximately the same level separated by a peak.
const results = [];
const window = 20;
const tolerance = 0.02;
const n = data.length;

if (n >= window * 2) {
  const lows = data.map(d => d.low);
  const highs = data.map(d => d.high);

  for (let i = window; i < n - window; i++) {
    let leftMin = lows[i - window], leftIdx = i - window;
    for (let j = i - window + 1; j < i; j++) {
      if (lows[j] < leftMin) { leftMin = lows[j]; leftIdx = j; }
    }
    let rightMin = lows[i], rightIdx = i;
    for (let j = i + 1; j < i + window && j < n; j++) {
      if (lows[j] < rightMin) { rightMin = lows[j]; rightIdx = j; }
    }
    if (leftMin === 0) continue;
    const diffPct = Math.abs(leftMin - rightMin) / leftMin;
    if (diffPct <= tolerance) {
      let midHigh = highs[leftIdx];
      for (let j = leftIdx + 1; j <= rightIdx; j++) {
        if (highs[j] > midHigh) midHigh = highs[j];
      }
      if (midHigh > leftMin * (1 + tolerance * 2)) {
        const confidence = Math.max(0, 1 - diffPct / tolerance);
        results.push({
          start_idx: leftIdx, end_idx: rightIdx,
          confidence: Math.round(confidence * 1000) / 1000,
          pattern_type: "double_bottom"
        });
      }
    }
  }
}
return results;'''

EXAMPLE_BULLISH_ENGULFING = '''// Bullish Engulfing Pattern Detection
// A bearish candle followed by a larger bullish candle that engulfs it.
const results = [];

for (let i = 1; i < data.length; i++) {
  const prev = data[i - 1];
  const curr = data[i];
  const prevBearish = prev.close < prev.open;
  const currBullish = curr.close > curr.open;

  if (prevBearish && currBullish) {
    const engulfs = curr.open <= prev.close && curr.close >= prev.open;
    if (engulfs) {
      const prevBody = Math.abs(prev.open - prev.close);
      const currBody = Math.abs(curr.close - curr.open);
      const ratio = prevBody > 0 ? currBody / prevBody : 1;
      const confidence = Math.min(1, ratio / 2);
      results.push({
        start_idx: i - 1, end_idx: i,
        confidence: Math.round(confidence * 1000) / 1000,
        pattern_type: "bullish_engulfing"
      });
    }
  }
}
return results;'''

EXAMPLE_VOLUME_BREAKOUT = '''// Volume Breakout Pattern Detection
// Price breaks above resistance on significantly above-average volume.
const results = [];
const lookback = 20;
const volMultiplier = 2.0;
const n = data.length;

if (n >= lookback + 1) {
  for (let i = lookback; i < n; i++) {
    let resistance = data[i - lookback].high;
    let volSum = 0;
    for (let j = i - lookback; j < i; j++) {
      if (data[j].high > resistance) resistance = data[j].high;
      volSum += data[j].volume;
    }
    const avgVol = volSum / lookback;
    if (data[i].close > resistance && avgVol > 0) {
      const volRatio = data[i].volume / avgVol;
      if (volRatio >= volMultiplier) {
        const confidence = Math.min(1, volRatio / (volMultiplier * 2));
        results.push({
          start_idx: i - lookback, end_idx: i,
          confidence: Math.round(confidence * 1000) / 1000,
          pattern_type: "volume_breakout"
        });
      }
    }
  }
}
return results;'''

EXAMPLE_SCRIPTS: Dict[str, str] = {
    "double_bottom": EXAMPLE_DOUBLE_BOTTOM,
    "bullish_engulfing": EXAMPLE_BULLISH_ENGULFING,
    "volume_breakout": EXAMPLE_VOLUME_BREAKOUT,
}


# ---------------------------------------------------------------------------
# Agent
# ---------------------------------------------------------------------------

class PatternAgent:
    """
    Agent that translates a natural-language hypothesis into a runnable
    JavaScript pattern detection script.
    """

    def __init__(self, model: str = "gpt-4o-mini") -> None:
        self.model = model

    def generate(self, hypothesis: str) -> Dict[str, Any]:
        if llm_available():
            return self._generate_with_llm(hypothesis)
        return self._generate_mock(hypothesis)

    def _generate_with_llm(self, hypothesis: str) -> Dict[str, Any]:
        script = chat_completion(
            system_prompt=PATTERN_SYSTEM_PROMPT,
            user_message=hypothesis,
            model=self.model,
            temperature=0.3,
        )

        script = _strip_code_fences(script)

        explanation = chat_completion(
            system_prompt=(
                "You are a trading analyst. Explain the following JavaScript pattern "
                "detection script in 2-3 sentences. What does it look for "
                "and how does it work?"
            ),
            user_message=script,
            model=self.model,
            temperature=0.3,
            max_tokens=300,
        )

        return {
            "script": script,
            "explanation": explanation,
            "parameters": self._extract_parameters(script),
            "indicators_used": self._extract_indicators(script),
        }

    def _generate_mock(self, hypothesis: str) -> Dict[str, Any]:
        script, pattern_name = self._match_example(hypothesis)
        return {
            "script": script,
            "explanation": (
                f"Generated JavaScript pattern detection for: '{hypothesis}'. "
                f"Uses the '{pattern_name}' template. "
                f"The script scans OHLC data and returns matches."
            ),
            "parameters": self._extract_parameters(script),
            "indicators_used": self._extract_indicators(script),
        }

    @staticmethod
    def _match_example(hypothesis: str) -> tuple[str, str]:
        h = hypothesis.lower()
        if any(kw in h for kw in ["double bottom", "two troughs", "w pattern"]):
            return EXAMPLE_DOUBLE_BOTTOM, "double_bottom"
        if any(kw in h for kw in ["engulfing", "bullish candle", "candle pattern"]):
            return EXAMPLE_BULLISH_ENGULFING, "bullish_engulfing"
        if any(kw in h for kw in ["volume", "breakout", "spike"]):
            return EXAMPLE_VOLUME_BREAKOUT, "volume_breakout"
        return EXAMPLE_BULLISH_ENGULFING, "bullish_engulfing"

    @staticmethod
    def _extract_parameters(script: str) -> Dict[str, Any]:
        import re
        params: Dict[str, Any] = {}
        for match in re.finditer(r'const\s+(\w+)\s*=\s*(\d+\.?\d*)', script):
            name, value = match.group(1), match.group(2)
            if name not in ("results", "n", "i", "j"):
                params[name] = float(value) if "." in value else int(value)
        return params

    @staticmethod
    def _extract_indicators(script: str) -> List[str]:
        known = ["sma", "ema", "rsi", "macd", "bollinger", "atr", "vwap"]
        lower = script.lower()
        return [ind for ind in known if ind in lower]


def _strip_code_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        first_nl = text.index("\n") if "\n" in text else len(text)
        text = text[first_nl + 1:]
        if text.endswith("```"):
            text = text[:-3]
    return text.strip()
