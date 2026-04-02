export interface OHLCBar {
  time: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface Dataset {
  id: string;
  name: string;
  metadata: {
    rows: number;
    startDate: string;
    endDate: string;
    symbol?: string;
    nativeTimeframe?: string;
    chartTimeframe?: string;
  };
}

export interface PatternMatch {
  id: string;
  name: string;
  startIndex: number;
  endIndex: number;
  startTime: string;
  endTime: string;
  direction: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  description?: string;
}

export interface Strategy {
  id: string;
  name: string;
  code: string;
  type: 'pattern' | 'indicator' | 'composite';
  parameters: Record<string, number | string | boolean>;
}

export interface Trade {
  id: string;
  entryTime: string;
  exitTime: string;
  entryPrice: number;
  exitPrice: number;
  direction: 'long' | 'short';
  quantity: number;
  pnl: number;
  pnlPercent: number;
  reason?: string;
  // Expanded fields for deep analysis
  entryIdx?: number;
  exitIdx?: number;
  maxAdverseExcursion?: number;
  maxFavorableExcursion?: number;
  holdingBars?: number;
  drawdownAtEntry?: number;
  entryReason?: string;
  exitReason?: string;
}

export interface StrategyConfig {
  entryCondition: string;
  exitCondition: string;
  takeProfit: { type: 'percentage' | 'fixed'; value: number };
  stopLoss: { type: 'percentage' | 'trailing'; value: number };
  maxDrawdown: number;
  seedAmount: number;
  specialInstructions: string;
}

export interface PortfolioMetrics {
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  totalReturn: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  avgHoldingBars: number;
  winStreak: number;
  loseStreak: number;
}

export interface StrategyResult {
  config: StrategyConfig;
  metrics: PortfolioMetrics;
  trades: Trade[];
  equity: number[];
  pnlPerTrade: number[];
  analysis: string;
  suggestions: string[];
}

export interface BacktestResult {
  strategyId: string;
  strategyName: string;
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  totalReturn: number;
  annualizedReturn: number;
  trades: Trade[];
  equityCurve: { time: string; value: number }[];
  // Extended
  metrics?: PortfolioMetrics;
  pnlPerTrade?: number[];
  analysis?: string;
  suggestions?: string[];
}

export interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: string;
  image?: string; // data URL for snapshot images
}

export interface IndicatorConfig {
  name: string;
  backendName: string;
  active: boolean;
  params: Record<string, number | string>;
  /** Custom JS script for user-created indicators */
  script?: string;
  /** Whether this is a custom (AI-generated) indicator */
  custom?: boolean;
  /** Color for chart line */
  color?: string;
}

export interface Script {
  id: string;
  name: string;
  code: string;
  type: 'pattern' | 'strategy' | 'indicator';
}

export interface CapturedPatternData {
  bars: OHLCBar[];
  timeRange: [number, number];
  priceRange: [number, number];
  indicators: Record<string, (number | null)[]>;
  priceChangePercent: number;
  volatility: number;
  volumeProfile: number[];
  trendAngle: number;
  patternShape: number[];
  // Extended mathematical fingerprint
  candleSequence?: { bodySize: number; upperWick: number; lowerWick: number; direction: number; totalRange: number; bodyRatio: number }[];
  normOpen?: number[];
  normHigh?: number[];
  normLow?: number[];
  triggerRatio?: number;
  triggerHeightRatio?: number;
  tradeHeightRatio?: number;
  heightShift?: number;
  triggerTrend?: number;
  tradeTrend?: number;
  indicatorMath?: Record<string, {
    slope: number;
    curvature: number;
    positionRelativeToPrice: string;
    normalizedValues: number[];
    crossesPrice: number;
    triggerSlope: number;
    tradeSlope: number;
  }>;
}
