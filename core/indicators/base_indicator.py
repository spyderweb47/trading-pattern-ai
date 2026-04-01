"""
Abstract base class for technical indicators with a registry pattern.

All indicators must extend BaseIndicator and implement calculate().
The IndicatorRegistry auto-discovers registered indicators.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Type, Union

import pandas as pd


class IndicatorRegistry:
    """
    Registry for discovering and instantiating indicators by name.

    Indicators register themselves by subclassing BaseIndicator;
    the __init_subclass__ hook handles auto-registration.
    """

    _registry: Dict[str, Type["BaseIndicator"]] = {}

    @classmethod
    def register(cls, name: str, indicator_cls: Type["BaseIndicator"]) -> None:
        """Register an indicator class under a given name."""
        cls._registry[name.lower()] = indicator_cls

    @classmethod
    def get(cls, name: str) -> Optional[Type["BaseIndicator"]]:
        """Look up an indicator class by name (case-insensitive)."""
        return cls._registry.get(name.lower())

    @classmethod
    def list_all(cls) -> List[str]:
        """Return sorted names of all registered indicators."""
        return sorted(cls._registry.keys())

    @classmethod
    def create(cls, name: str, **params: Any) -> "BaseIndicator":
        """Instantiate an indicator by name with the given parameters."""
        indicator_cls = cls.get(name)
        if indicator_cls is None:
            raise KeyError(
                f"Unknown indicator '{name}'. "
                f"Available: {cls.list_all()}"
            )
        return indicator_cls(**params)


class BaseIndicator(ABC):
    """
    Abstract base class that all indicators must extend.

    Subclasses must implement:
        - name (property): short identifier string.
        - params (property): dict of current parameter values.
        - calculate(df): compute the indicator on OHLC data.

    Auto-registration happens via __init_subclass__ so that any concrete
    subclass is automatically added to IndicatorRegistry.
    """

    def __init_subclass__(cls, **kwargs: Any) -> None:
        """Auto-register concrete subclasses in the indicator registry."""
        super().__init_subclass__(**kwargs)
        # Only register non-abstract classes.
        if not getattr(cls, "__abstractmethods__", None):
            # Use the class-level `name` property default or class name.
            indicator_name = getattr(cls, "_registry_name", cls.__name__.lower())
            IndicatorRegistry.register(indicator_name, cls)

    @property
    @abstractmethod
    def name(self) -> str:
        """Short unique name for this indicator (e.g. 'sma', 'rsi')."""
        ...

    @property
    @abstractmethod
    def params(self) -> Dict[str, Any]:
        """Current parameter values as a dict."""
        ...

    @abstractmethod
    def calculate(self, df: pd.DataFrame) -> Union[pd.Series, pd.DataFrame]:
        """
        Compute the indicator values.

        Parameters
        ----------
        df : pd.DataFrame
            OHLC data with at least: open, high, low, close, volume.

        Returns
        -------
        pd.Series or pd.DataFrame
            The computed indicator value(s), indexed to match the input.
        """
        ...

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}({self.params})"
