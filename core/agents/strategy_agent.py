"""
Strategy agent — conversational strategy builder.

Guides users through building a trading strategy step-by-step:
entry conditions → exit conditions → risk management → complete script.

Generates JavaScript strategy scripts that run in the browser.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from core.agents.llm_client import chat_completion, is_available as llm_available


STRATEGY_SYSTEM_PROMPT = """You are an expert trading strategy builder AI assistant.

You help users build trading strategies step-by-step through conversation.
You are proactive — you ask clarifying questions and suggest improvements.

## Conversation Flow
Based on the current strategy_state, guide the user:

1. **needs_entry**: Ask about entry conditions. What signals trigger a trade?
   - Suggest common approaches: MA crossover, RSI oversold, breakout, etc.
   - Ask: long only, short only, or both?

2. **needs_exit**: Entry is defined. Now ask about exit conditions.
   - Suggest: opposite signal, time-based, trailing stop, target hit
   - Ask: what invalidates the trade?

3. **needs_risk**: Entry + exit defined. Ask about risk management.
   - Suggest stop-loss (1-5%), take-profit (2-10%), position sizing
   - Warn about risk/reward ratio

4. **complete**: All defined. Generate the full strategy script.

## Response Format
Always return a JSON object (no markdown fences):
{
  "reply": "Your conversational message to the user",
  "strategy_state": "needs_entry|needs_exit|needs_risk|complete",
  "entry_rules": ["rule 1", "rule 2"],
  "exit_rules": ["rule 1", "rule 2"],
  "stop_loss": null or number (percentage, e.g. 2.0),
  "take_profit": null or number (percentage, e.g. 5.0),
  "script": null or "full JavaScript code"
}

## Script Format (only when state is "complete")
The JavaScript strategy script:
- Receives `data` array: [{time, open, high, low, close, volume}, ...]
- Receives `config` object: {stopLoss, takeProfit, positionSize}
- Must return: {trades: [...], signals: [...], equity: [...]}
- Each trade: {type:'long'|'short', entryIdx, exitIdx, entryPrice, exitPrice, pnl, pnlPercent, reason}
- Each signal: {idx, type:'entry_long'|'entry_short'|'exit', price}
- equity: array of portfolio value at each bar (start at 10000)
- Include helper functions (SMA, EMA, RSI) inline
- Use simple for loops: for (let i = 0; i < data.length; i++)

## Rules
- Be concise: 2-4 sentences per reply
- Always suggest concrete examples
- If user is vague, suggest specific values
- Do NOT use import/require/fetch in scripts
"""


STRATEGY_GENERATE_PROMPT = """Generate a complete JavaScript trading strategy script.

Entry rules: {entry_rules}
Exit rules: {exit_rules}
Stop loss: {stop_loss}%
Take profit: {take_profit}%

The script receives `data` (OHLC array) and `config` ({{stopLoss, takeProfit}}).
Include inline SMA/EMA/RSI helpers as needed.
Track trades, signals, and equity (start 10000).
Return {{ trades, signals, equity }}.

Return ONLY JavaScript code. No markdown fences."""


class StrategyAgent:
    def __init__(self, model: str = "gpt-4o-mini") -> None:
        self.model = model

    def generate(
        self,
        message: str,
        strategy_state: str = "needs_entry",
        entry_rules: Optional[List[str]] = None,
        exit_rules: Optional[List[str]] = None,
        stop_loss: Optional[float] = None,
        take_profit: Optional[float] = None,
        current_script: Optional[str] = None,
    ) -> Dict[str, Any]:
        if llm_available():
            return self._generate_with_llm(
                message, strategy_state, entry_rules or [],
                exit_rules or [], stop_loss, take_profit, current_script
            )
        return self._generate_mock(message, strategy_state)

    def _generate_with_llm(
        self,
        message: str,
        strategy_state: str,
        entry_rules: List[str],
        exit_rules: List[str],
        stop_loss: Optional[float],
        take_profit: Optional[float],
        current_script: Optional[str],
    ) -> Dict[str, Any]:
        parts = [f"Current strategy_state: {strategy_state}"]
        if entry_rules:
            parts.append(f"Entry rules: {entry_rules}")
        if exit_rules:
            parts.append(f"Exit rules: {exit_rules}")
        if stop_loss is not None:
            parts.append(f"Stop loss: {stop_loss}%")
        if take_profit is not None:
            parts.append(f"Take profit: {take_profit}%")
        if current_script:
            parts.append("User has an existing script and wants to modify it.")
        parts.append(f"\nUser: {message}")

        response_text = chat_completion(
            system_prompt=STRATEGY_SYSTEM_PROMPT,
            user_message="\n".join(parts),
            model=self.model,
            temperature=0.3,
        )

        # Parse JSON response
        try:
            cleaned = response_text.strip()
            if cleaned.startswith("```"):
                nl = cleaned.index("\n") if "\n" in cleaned else len(cleaned)
                cleaned = cleaned[nl + 1:]
                if cleaned.endswith("```"):
                    cleaned = cleaned[:-3]
                cleaned = cleaned.strip()
            result = json.loads(cleaned)
        except json.JSONDecodeError:
            result = {
                "reply": response_text,
                "strategy_state": strategy_state,
                "entry_rules": entry_rules,
                "exit_rules": exit_rules,
                "stop_loss": stop_loss,
                "take_profit": take_profit,
                "script": None,
            }

        # If complete but no script, generate one
        if result.get("strategy_state") == "complete" and not result.get("script"):
            result["script"] = self._generate_script(
                result.get("entry_rules", entry_rules),
                result.get("exit_rules", exit_rules),
                result.get("stop_loss", stop_loss),
                result.get("take_profit", take_profit),
            )

        return result

    def _generate_script(self, entry_rules, exit_rules, stop_loss, take_profit):
        prompt = STRATEGY_GENERATE_PROMPT.format(
            entry_rules=", ".join(entry_rules) if entry_rules else "Not specified",
            exit_rules=", ".join(exit_rules) if exit_rules else "Opposite of entry",
            stop_loss=stop_loss or 2,
            take_profit=take_profit or 5,
        )
        script = chat_completion(
            system_prompt=prompt,
            user_message="Generate the strategy script now.",
            model=self.model,
            temperature=0.2,
        )
        script = script.strip()
        if script.startswith("```"):
            nl = script.index("\n") if "\n" in script else len(script)
            script = script[nl + 1:]
            if script.endswith("```"):
                script = script[:-3]
        return script.strip()

    def _generate_mock(self, message: str, strategy_state: str) -> Dict[str, Any]:
        mocks = {
            "needs_entry": {
                "reply": "Let's build your strategy! What entry signal do you want? For example: 'Buy when RSI drops below 30' or 'Enter long when 9 EMA crosses above 21 EMA'.",
                "strategy_state": "needs_entry",
            },
            "needs_exit": {
                "reply": "Good entry rules! When should we exit? Options: opposite signal, fixed target, trailing stop, or time-based.",
                "strategy_state": "needs_exit",
            },
            "needs_risk": {
                "reply": "Almost there! I suggest: Stop-loss at 2%, Take-profit at 5% (2.5:1 reward/risk). Want to adjust?",
                "strategy_state": "needs_risk",
                "stop_loss": 2.0,
                "take_profit": 5.0,
            },
            "complete": {
                "reply": "Strategy complete! EMA crossover with RSI filter. Click 'Run Backtest' to test it.",
                "strategy_state": "complete",
                "entry_rules": ["9 EMA crosses above 21 EMA"],
                "exit_rules": ["9 EMA crosses below 21 EMA"],
                "stop_loss": 2.0,
                "take_profit": 5.0,
                "script": MOCK_STRATEGY_SCRIPT,
            },
        }
        base = mocks.get(strategy_state, mocks["needs_entry"])
        base.setdefault("entry_rules", [])
        base.setdefault("exit_rules", [])
        base.setdefault("stop_loss", None)
        base.setdefault("take_profit", None)
        base.setdefault("script", None)
        return base


MOCK_STRATEGY_SCRIPT = """// EMA Crossover Strategy
const trades = [];
const signals = [];
const equity = [];
let capital = 10000;
let position = null;
const slPct = config.stopLoss / 100;
const tpPct = config.takeProfit / 100;

function ema(closes, period) {
  const k = 2 / (period + 1);
  const r = [closes[0]];
  for (let i = 1; i < closes.length; i++) r.push(closes[i] * k + r[i-1] * (1-k));
  return r;
}

const closes = data.map(d => d.close);
const ema9 = ema(closes, 9);
const ema21 = ema(closes, 21);

for (let i = 21; i < data.length; i++) {
  if (position) {
    const pnl = position.type === 'long'
      ? (data[i].close - position.ep) / position.ep
      : (position.ep - data[i].close) / position.ep;
    let exit = false, reason = '';
    if (pnl <= -slPct) { exit = true; reason = 'stop_loss'; }
    else if (pnl >= tpPct) { exit = true; reason = 'take_profit'; }
    else if (position.type === 'long' && ema9[i] < ema21[i] && ema9[i-1] >= ema21[i-1]) { exit = true; reason = 'signal'; }
    else if (position.type === 'short' && ema9[i] > ema21[i] && ema9[i-1] <= ema21[i-1]) { exit = true; reason = 'signal'; }
    if (exit) {
      const p = capital * pnl;
      capital += p;
      trades.push({ type: position.type, entryIdx: position.ei, exitIdx: i, entryPrice: position.ep, exitPrice: data[i].close, pnl: Math.round(p*100)/100, pnlPercent: Math.round(pnl*10000)/100, reason });
      signals.push({ idx: i, type: 'exit', price: data[i].close });
      position = null;
    }
  }
  if (!position) {
    if (ema9[i] > ema21[i] && ema9[i-1] <= ema21[i-1]) {
      position = { type: 'long', ei: i, ep: data[i].close };
      signals.push({ idx: i, type: 'entry_long', price: data[i].close });
    } else if (ema9[i] < ema21[i] && ema9[i-1] >= ema21[i-1]) {
      position = { type: 'short', ei: i, ep: data[i].close };
      signals.push({ idx: i, type: 'entry_short', price: data[i].close });
    }
  }
  equity.push(capital + (position ? capital * ((position.type === 'long' ? (data[i].close - position.ep) / position.ep : (position.ep - data[i].close) / position.ep)) : 0));
}
return { trades, signals, equity };"""
