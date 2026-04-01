"""
OpenAI LLM client for agent interactions.

Provides a unified interface for calling OpenAI chat completions.
Supports configurable model, temperature, and system prompts.
"""

from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Optional

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None  # type: ignore


# Default model to use for all agents.
DEFAULT_MODEL = "gpt-4o-mini"


def get_client() -> "OpenAI":
    """Create an OpenAI client using the OPENAI_API_KEY env variable."""
    if OpenAI is None:
        raise RuntimeError(
            "openai package is not installed. Run: pip install openai"
        )
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "OPENAI_API_KEY environment variable is not set. "
            "Set it before starting the server."
        )
    return OpenAI(api_key=api_key)


def chat_completion(
    system_prompt: str,
    user_message: str,
    model: str = DEFAULT_MODEL,
    temperature: float = 0.3,
    max_tokens: int = 4096,
) -> str:
    """
    Send a chat completion request to OpenAI.

    Parameters
    ----------
    system_prompt : str
        System message setting the agent's role and constraints.
    user_message : str
        The user's input/hypothesis/intent.
    model : str
        OpenAI model name (default: gpt-4o-mini).
    temperature : float
        Sampling temperature (lower = more deterministic).
    max_tokens : int
        Maximum tokens in the response.

    Returns
    -------
    str
        The assistant's response text.
    """
    client = get_client()
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return response.choices[0].message.content or ""


def chat_completion_json(
    system_prompt: str,
    user_message: str,
    model: str = DEFAULT_MODEL,
    temperature: float = 0.3,
    max_tokens: int = 4096,
) -> Dict[str, Any]:
    """
    Send a chat completion request and parse the response as JSON.

    Falls back to returning {"raw": response_text} if JSON parsing fails.
    """
    text = chat_completion(
        system_prompt=system_prompt,
        user_message=user_message,
        model=model,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    # Strip markdown code fences if present.
    cleaned = text.strip()
    if cleaned.startswith("```"):
        # Remove opening fence (```json or ```)
        first_newline = cleaned.index("\n") if "\n" in cleaned else len(cleaned)
        cleaned = cleaned[first_newline + 1:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return {"raw": text}


def is_available() -> bool:
    """Check if OpenAI API is configured and available."""
    if OpenAI is None:
        return False
    return bool(os.environ.get("OPENAI_API_KEY"))
