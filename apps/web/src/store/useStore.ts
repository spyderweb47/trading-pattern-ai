import { create } from 'zustand';
import type {
  OHLCBar,
  Dataset,
  PatternMatch,
  Script,
  Message,
  BacktestResult,
  IndicatorConfig,
  CapturedPatternData,
} from '@/types';
import type { Drawing, DrawingType } from '@/lib/chart-primitives/drawingTypes';
import { resampleToTimeframe } from '@/lib/csv/resampleOHLC';

export type Mode = 'pattern' | 'strategy';

interface AnalysisResults {
  summary?: string;
  metrics?: Record<string, number | string>;
  signals?: { time: string; type: string; price: number }[];
}

interface AppState {
  // Mode
  activeMode: Mode;
  setMode: (mode: Mode) => void;

  // Datasets
  datasets: Dataset[];
  activeDataset: string | null;
  datasetChartData: Record<string, OHLCBar[]>;
  datasetRawData: Record<string, OHLCBar[]>;
  syncedDatasets: Set<string>;
  addDataset: (dataset: Dataset, chartData: OHLCBar[], rawData: OHLCBar[]) => void;
  markSynced: (id: string) => void;
  setActiveDataset: (id: string | null) => void;

  // Scripts
  scripts: Script[];
  addScript: (script: Script) => void;
  removeScript: (id: string) => void;

  // Messages (per-mode)
  patternMessages: Message[];
  strategyMessages: Message[];
  messages: Message[]; // derived from active mode
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;

  // Backtest
  backtestResults: BacktestResult | null;
  setBacktestResults: (results: BacktestResult | null) => void;

  // Indicators
  indicators: IndicatorConfig[];
  toggleIndicator: (name: string) => void;
  updateIndicatorParams: (name: string, params: Record<string, number | string>) => void;
  removeIndicator: (name: string) => void;
  addCustomIndicator: (ind: IndicatorConfig) => void;

  // Chart data (derived from activeDataset)
  chartData: OHLCBar[];
  selectedTimeframe: string | null; // null = auto (fit to 6000 bars)
  setSelectedTimeframe: (tf: string | null) => void;

  // Pattern matches
  patternMatches: PatternMatch[];
  lastScriptResult: { ran: boolean; error?: string } | null;
  setPatternMatches: (matches: PatternMatch[]) => void;
  setLastScriptResult: (result: { ran: boolean; error?: string } | null) => void;

  // Analysis
  analysisResults: AnalysisResults | null;
  setAnalysisResults: (results: AnalysisResults | null) => void;

  // Pattern Selector
  patternSelectorActive: boolean;
  setPatternSelectorActive: (active: boolean) => void;
  capturedPattern: CapturedPatternData | null;
  setCapturedPattern: (data: CapturedPatternData | null) => void;

  // Pine drawings
  pineDrawings: any | null;
  pineDrawingsPlotData: Record<string, (number | null)[]> | null;
  setPineDrawings: (drawings: any | null, plotData?: Record<string, (number | null)[]>) => void;

  // Theme
  darkMode: boolean;
  toggleDarkMode: () => void;

  // Chat input prefill
  chatInputDraft: string;
  setChatInputDraft: (text: string) => void;

  // Strategy config
  strategyConfig: import('@/types').StrategyConfig | null;
  setStrategyConfig: (config: import('@/types').StrategyConfig | null) => void;

  // Chart focus — zoom to a specific time range
  chartFocus: { startTime: number; endTime: number } | null;
  setChartFocus: (focus: { startTime: number; endTime: number } | null) => void;

  // Drawing tools
  activeDrawingTool: DrawingType | null;
  setActiveDrawingTool: (tool: DrawingType | null) => void;
  drawings: Drawing[];
  setDrawings: (drawings: Drawing[]) => void;
  deleteSelectedDrawing: () => void;
}

export const useStore = create<AppState>((set) => ({
  // Mode
  activeMode: 'pattern',
  setMode: (mode) => set((state) => ({
    activeMode: mode,
    messages: mode === 'strategy' ? state.strategyMessages : state.patternMessages,
  })),

  // Datasets
  datasets: [],
  activeDataset: null,
  datasetChartData: {},
  datasetRawData: {},
  syncedDatasets: new Set(),
  addDataset: (dataset, chartData, rawData) =>
    set((state) => ({
      datasets: [...state.datasets, dataset],
      datasetChartData: { ...state.datasetChartData, [dataset.id]: chartData },
      datasetRawData: { ...state.datasetRawData, [dataset.id]: rawData },
      activeDataset: dataset.id,
      chartData,
    })),
  markSynced: (id) =>
    set((state) => ({
      syncedDatasets: new Set([...state.syncedDatasets, id]),
    })),
  setActiveDataset: (id) =>
    set((state) => ({
      activeDataset: id,
      chartData: id ? state.datasetChartData[id] || [] : [],
      patternMatches: [],
    })),

  // Scripts
  scripts: [],
  addScript: (script) =>
    set((state) => ({ scripts: [...state.scripts, script] })),
  removeScript: (id) =>
    set((state) => ({ scripts: state.scripts.filter((s) => s.id !== id) })),

  // Messages
  patternMessages: [],
  strategyMessages: [],
  messages: [],
  addMessage: (message) =>
    set((state) => {
      const newMsg = { ...message, id: crypto.randomUUID(), timestamp: new Date().toISOString() };
      const isStrategy = state.activeMode === 'strategy';
      const patternMessages = isStrategy ? state.patternMessages : [...state.patternMessages, newMsg];
      const strategyMessages = isStrategy ? [...state.strategyMessages, newMsg] : state.strategyMessages;
      return {
        patternMessages,
        strategyMessages,
        messages: isStrategy ? strategyMessages : patternMessages,
      };
    }),

  // Backtest
  backtestResults: null,
  setBacktestResults: (results) => set({ backtestResults: results }),

  // Indicators — params must match backend __init__ signatures exactly
  indicators: [
    { name: 'SMA', backendName: 'sma', active: false, params: { period: '20' } },
    { name: 'EMA', backendName: 'ema', active: false, params: { period: '20' } },
    { name: 'RSI', backendName: 'rsi', active: false, params: { period: '14' } },
    { name: 'MACD', backendName: 'macd', active: false, params: { fast_period: '12', slow_period: '26', signal_period: '9' } },
    { name: 'Bollinger Bands', backendName: 'bollinger', active: false, params: { period: '20', num_std: '2' } },
    { name: 'ATR', backendName: 'atr', active: false, params: { period: '14' } },
    { name: 'VWAP', backendName: 'vwap', active: false, params: { reset_period: '1D' } },
  ] as IndicatorConfig[],
  toggleIndicator: (name) =>
    set((state) => {
      const target = state.indicators.find((i) => i.name === name);
      const isPine = target?.script?.startsWith("__PINE__") || target?._precomputed;
      const turningOff = target?.active;
      return {
        indicators: state.indicators.map((ind) =>
          ind.name === name ? { ...ind, active: !ind.active } : ind
        ),
        // Clear Pine drawings when a Pine indicator is toggled off
        ...(isPine && turningOff ? { pineDrawings: null, pineDrawingsPlotData: null } : {}),
      };
    }),
  updateIndicatorParams: (name, params) =>
    set((state) => ({
      indicators: state.indicators.map((ind) =>
        ind.name === name ? { ...ind, params, active: false } : ind
      ),
    })),
  removeIndicator: (name) =>
    set((state) => {
      const target = state.indicators.find((i) => i.name === name);
      const isPine = target?.script?.startsWith("__PINE__") || (target as any)?._precomputed;
      return {
        indicators: state.indicators.filter((ind) => ind.name !== name),
        // Clear Pine drawings when a Pine indicator is removed
        ...(isPine ? { pineDrawings: null, pineDrawingsPlotData: null } : {}),
      };
    }),
  addCustomIndicator: (ind) =>
    set((state) => {
      // Prevent duplicates — replace if same name exists
      const filtered = state.indicators.filter((i) => i.name !== ind.name);
      return { indicators: [...filtered, ind] };
    }),

  // Chart data
  chartData: [],
  selectedTimeframe: null,
  setSelectedTimeframe: (tf) =>
    set((state) => {
      const id = state.activeDataset;
      if (!id) return {};
      const raw = state.datasetRawData[id];
      if (!raw || raw.length === 0) return {};
      if (tf === null) {
        // Auto mode — use the pre-resampled chart data
        return { selectedTimeframe: null, chartData: state.datasetChartData[id] || [] };
      }
      const resampled = resampleToTimeframe(raw, tf);
      return { selectedTimeframe: tf, chartData: resampled };
    }),

  // Pattern matches
  patternMatches: [],
  lastScriptResult: null,
  setPatternMatches: (matches) => set({ patternMatches: matches }),
  setLastScriptResult: (result) => set({ lastScriptResult: result }),

  // Analysis
  analysisResults: null,
  setAnalysisResults: (results) => set({ analysisResults: results }),

  // Pattern Selector
  patternSelectorActive: false,
  setPatternSelectorActive: (active) => set({ patternSelectorActive: active }),
  capturedPattern: null,
  setCapturedPattern: (data) => set({ capturedPattern: data }),

  // Pine drawings
  pineDrawings: null,
  pineDrawingsPlotData: null,
  setPineDrawings: (drawings, plotData) => set({ pineDrawings: drawings, pineDrawingsPlotData: plotData || null }),

  // Theme
  darkMode: true,
  toggleDarkMode: () =>
    set((state) => {
      const next = !state.darkMode;
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', next);
        // Force lightweight-charts to update with new theme (requires chart recreate)
      }
      return { darkMode: next };
    }),

  // Chat input prefill
  chatInputDraft: '',
  setChatInputDraft: (text) => set({ chatInputDraft: text }),

  // Strategy config
  strategyConfig: null,
  setStrategyConfig: (config) => set({ strategyConfig: config }),

  // Chart focus
  chartFocus: null,
  setChartFocus: (focus) => set({ chartFocus: focus }),

  // Drawing tools
  activeDrawingTool: null,
  setActiveDrawingTool: (tool) => set({ activeDrawingTool: tool }),
  drawings: [],
  setDrawings: (drawings) => set({ drawings }),
  deleteSelectedDrawing: () =>
    set((state) => ({
      drawings: state.drawings.filter((d) => !d.selected),
    })),
}));
