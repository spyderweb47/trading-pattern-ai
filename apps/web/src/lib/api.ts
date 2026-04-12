import type {
  OHLCBar,
  PatternMatch,
  BacktestResult,
} from '@/types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

async function request<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`API error ${res.status}: ${error}`);
  }

  return res.json();
}

// Sync dataset to backend (lazy — only when pattern/backtest features need it)
export async function syncDatasetToBackend(
  datasetId: string,
  rawData: OHLCBar[],
  metadata: { rows: number; startDate: string; endDate: string; filename: string }
): Promise<void> {
  await request('/sync-dataset', {
    method: 'POST',
    body: JSON.stringify({ dataset_id: datasetId, data: rawData, metadata }),
  });
}

// Chat with trading agents
export interface ChatResponse {
  reply: string;
  script?: string | null;
  script_type?: "pattern" | "indicator" | null;
  data?: Record<string, unknown> | null;
}

export async function sendChat(
  message: string,
  mode: string,
  context?: Record<string, unknown>
): Promise<ChatResponse> {
  return request('/chat', {
    method: 'POST',
    body: JSON.stringify({ message, mode, context: context || {} }),
  });
}

// Social simulation debate
export interface DebateEntity {
  id: string;
  name: string;
  role: string;
  background: string;
  bias: string;
  personality: string;
}

export interface DebateMessage {
  id: string;
  round: number;
  entity_id: string;
  entity_name: string;
  entity_role: string;
  content: string;
  sentiment: number;
  price_prediction?: number | null;
  agreed_with: string[];
  disagreed_with: string[];
  is_chart_support: boolean;
}

export interface DebateSummary {
  consensus_direction: string;
  confidence: number;
  key_arguments: string[];
  dissenting_views: string[];
  price_targets: { low: number; mid: number; high: number };
  risk_factors: string[];
  recommendation: Record<string, unknown>;
}

export interface DebateResult {
  debate_id: string;
  asset_info: { asset_class: string; asset_name: string; description: string; price_drivers: string[] };
  entities: DebateEntity[];
  thread: DebateMessage[];
  total_rounds: number;
  summary: DebateSummary;
  bars_analyzed: number;
  symbol: string;
}

export async function runSimulationDebate(
  datasetId: string,
  barsCount: number = 100,
  context: string = '',
): Promise<DebateResult> {
  return request('/debate', {
    method: 'POST',
    body: JSON.stringify({ dataset_id: datasetId, bars_count: barsCount, context }),
  });
}

// Check if LLM is available
export async function getChatStatus(): Promise<{ llm_available: boolean; mode: string }> {
  return request('/chat/status');
}

// Generate pattern detection code from description
export async function generatePattern(
  description: string,
  datasetId?: string
): Promise<{ code: string; explanation: string }> {
  return request('/generate-pattern', {
    method: 'POST',
    body: JSON.stringify({ hypothesis: description, dataset_id: datasetId }),
  });
}

// Run pattern detection on dataset
export async function runPattern(
  code: string,
  datasetId: string
): Promise<{ matches: PatternMatch[] }> {
  return request('/run-pattern', {
    method: 'POST',
    body: JSON.stringify({ script: code, dataset_id: datasetId }),
  });
}

// Generate trading strategy from description
export async function generateStrategy(
  description: string,
  datasetId?: string
): Promise<{ code: string; explanation: string }> {
  return request('/generate-strategy', {
    method: 'POST',
    body: JSON.stringify({ pattern_script: description, intent: description, dataset_id: datasetId }),
  });
}

// Run backtest
export async function runBacktest(
  strategyCode: string,
  datasetId: string,
  params?: Record<string, unknown>
): Promise<BacktestResult> {
  return request('/run-backtest', {
    method: 'POST',
    body: JSON.stringify({
      strategy: { script: strategyCode },
      dataset_id: datasetId,
      params,
    }),
  });
}

// Analyze dataset
export async function analyze(
  datasetId: string,
  analyses: string[]
): Promise<{ dataset_id: string; results: Record<string, unknown> }> {
  return request('/analyze', {
    method: 'POST',
    body: JSON.stringify({ dataset_id: datasetId, analyses }),
  });
}
