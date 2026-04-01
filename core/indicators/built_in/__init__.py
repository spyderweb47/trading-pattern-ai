"""
Built-in technical indicators.

Importing this package auto-registers all built-in indicators
with the IndicatorRegistry.
"""

from core.indicators.built_in.sma import SMA
from core.indicators.built_in.ema import EMA
from core.indicators.built_in.rsi import RSI
from core.indicators.built_in.bollinger import BollingerBands
from core.indicators.built_in.macd import MACD
from core.indicators.built_in.atr import ATR
from core.indicators.built_in.vwap import VWAP

__all__ = ["SMA", "EMA", "RSI", "BollingerBands", "MACD", "ATR", "VWAP"]
