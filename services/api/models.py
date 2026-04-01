"""
Pydantic models for all API request and response bodies.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------

class OHLCBarResponse(BaseModel):
    """Single OHLC bar for chart rendering."""
    time: Any  # Unix timestamp (int) or date string
    open: float
    high: float
    low: float
    close: float
    volume: Optional[float] = 0

class DatasetMetadata(BaseModel):
    """Dataset metadata."""
    rows: int
    startDate: str
    endDate: str

class DatasetResponse(BaseModel):
    """Dataset info."""
    id: str
    name: str
    metadata: DatasetMetadata

class UploadResponse(BaseModel):
    """Response after successfully uploading and parsing a CSV file."""
    dataset: DatasetResponse
    data: List[OHLCBarResponse]


# ---------------------------------------------------------------------------
# Patterns
# ---------------------------------------------------------------------------

class GeneratePatternRequest(BaseModel):
    """Request to generate a pattern detection script from a hypothesis."""
    hypothesis: str = Field(..., min_length=1, description="Natural-language pattern hypothesis")
    dataset_id: str = Field(..., description="UUID of the uploaded dataset")


class GeneratePatternResponse(BaseModel):
    """Response containing the generated pattern detection script."""
    script: str
    explanation: str
    parameters: Dict[str, Any]
    indicators_used: List[str] = []


class RunPatternRequest(BaseModel):
    """Request to execute a pattern detection script against a dataset."""
    script: str = Field(..., min_length=1, description="Python pattern detection script")
    dataset_id: str = Field(..., description="UUID of the uploaded dataset")
    timeframe: str = Field(default="full", description="Timeframe filter (e.g. '1h', '4h', 'full')")


class PatternMatch(BaseModel):
    """A single pattern match found in the data."""
    start_idx: int
    end_idx: int
    confidence: float
    pattern_type: str


class RunPatternResponse(BaseModel):
    """Response containing pattern matches."""
    matches: List[PatternMatch]
    total_matches: int
    dataset_id: str


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

class GenerateStrategyRequest(BaseModel):
    """Request to generate a trading strategy from a pattern script and intent."""
    pattern_script: str = Field(..., min_length=1, description="Pattern detection script")
    intent: str = Field(..., min_length=1, description="Trading intent or goal")


class GenerateStrategyResponse(BaseModel):
    """Response containing the generated strategy."""
    script: str
    explanation: str
    parameters: Dict[str, Any]
    entry_rules: List[str] = []
    exit_rules: List[str] = []


# ---------------------------------------------------------------------------
# Backtest
# ---------------------------------------------------------------------------

class StrategyConfig(BaseModel):
    """Strategy configuration for backtesting."""
    script: str = Field(..., description="Strategy script with entry/exit conditions")
    stop_loss_pct: Optional[float] = Field(None, description="Stop-loss percentage (e.g. 0.02 for 2%)")
    take_profit_pct: Optional[float] = Field(None, description="Take-profit percentage")
    position_size: float = Field(default=1.0, description="Position size per trade")
    initial_capital: float = Field(default=10000.0, description="Starting capital")


class RunBacktestRequest(BaseModel):
    """Request to run a backtest."""
    strategy: StrategyConfig
    dataset_id: str = Field(..., description="UUID of the uploaded dataset")


class BacktestMetricsResponse(BaseModel):
    """Backtest performance metrics."""
    total_pnl: float
    total_trades: int
    winning_trades: int
    losing_trades: int
    win_rate: float
    max_drawdown: float
    max_drawdown_pct: float
    sharpe_ratio: float
    profit_factor: float
    avg_win: float
    avg_loss: float
    max_consecutive_wins: int
    max_consecutive_losses: int
    expectancy: float


class TradeLogEntry(BaseModel):
    """A single trade in the backtest log."""
    entry_time: Optional[str] = None
    exit_time: Optional[str] = None
    entry_price: float
    exit_price: float
    direction: str
    pnl: float
    size: float
    reason: str


class RunBacktestResponse(BaseModel):
    """Response from a backtest run."""
    metrics: BacktestMetricsResponse
    trade_log: List[TradeLogEntry]
    equity_curve: List[float]
    total_bars: int


# ---------------------------------------------------------------------------
# Simulation
# ---------------------------------------------------------------------------

class SimulateRequest(BaseModel):
    """Request to run a bar-by-bar simulation."""
    strategy: StrategyConfig
    dataset_id: str = Field(..., description="UUID of the uploaded dataset")
    speed: int = Field(default=1, ge=1, le=100, description="Bars per tick (simulation speed)")


class SimulateResponse(BaseModel):
    """Response from a simulation run."""
    total_pnl: float
    total_trades: int
    bars_processed: int
    equity_curve: List[float]
    trade_log: List[Dict[str, Any]]


# ---------------------------------------------------------------------------
# Analysis
# ---------------------------------------------------------------------------

class AnalyzeRequest(BaseModel):
    """Request to run one or more analyses on a dataset."""
    dataset_id: str = Field(..., description="UUID of the uploaded dataset")
    analyses: List[str] = Field(
        ...,
        min_length=1,
        description="Analyses to run: 'support_resistance', 'trend', 'volatility', 'micro_structure'",
    )


class AnalyzeResponse(BaseModel):
    """Combined analysis results."""
    dataset_id: str
    results: Dict[str, Any]


# ---------------------------------------------------------------------------
# Indicators
# ---------------------------------------------------------------------------

class IndicatorInfo(BaseModel):
    """Information about an available indicator."""
    name: str
    description: str = ""


class ListIndicatorsResponse(BaseModel):
    """List of all available indicators."""
    indicators: List[IndicatorInfo]


class CalculateIndicatorRequest(BaseModel):
    """Request to calculate a technical indicator."""
    dataset_id: str = Field(..., description="UUID of the uploaded dataset")
    indicator: str = Field(..., min_length=1, description="Indicator name (e.g. 'sma', 'rsi')")
    params: Dict[str, Any] = Field(default_factory=dict, description="Indicator parameters")


class CalculateIndicatorResponse(BaseModel):
    """Response containing calculated indicator values."""
    indicator: str
    params: Dict[str, Any]
    values: List[Optional[float]]
    length: int
