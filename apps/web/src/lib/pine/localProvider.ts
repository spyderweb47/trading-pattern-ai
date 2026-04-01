import { BaseProvider } from "pinets";
import type { Kline, ISymbolInfo } from "pinets";
import type { OHLCBar } from "@/types";

/**
 * Custom PineTS provider that serves our locally-loaded OHLC data
 * instead of fetching from an external API.
 */
export class LocalProvider extends BaseProvider {
  private _data: Kline[] = [];
  private _symbol = "LOCAL";
  private _timeframe = "1D";

  constructor() {
    super({ requiresApiKey: false, providerName: "Local" });
  }

  /** Load OHLC bars from our store into the provider */
  loadData(bars: OHLCBar[], symbol?: string, timeframe?: string) {
    this._symbol = symbol || "LOCAL";
    this._timeframe = timeframe || "1D";

    this._data = bars.map((bar) => {
      const t = (bar.time as number) * 1000; // PineTS uses milliseconds
      return {
        openTime: t,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume ?? 0,
        closeTime: t + 60000, // approximate
        quoteAssetVolume: 0,
        numberOfTrades: 0,
        takerBuyBaseAssetVolume: 0,
        takerBuyQuoteAssetVolume: 0,
        ignore: 0,
      };
    });
  }

  protected getSupportedTimeframes(): Set<string> {
    return new Set(["1", "3", "5", "15", "30", "45", "60", "120", "180", "240", "D", "W", "M"]);
  }

  protected async _getMarketDataNative(
    _tickerId: string,
    _timeframe: string,
    limit?: number,
  ): Promise<Kline[]> {
    if (limit && limit < this._data.length) {
      return this._data.slice(-limit);
    }
    return this._data;
  }

  async getSymbolInfo(_tickerId: string): Promise<ISymbolInfo> {
    return {
      current_contract: "",
      description: this._symbol,
      isin: "",
      main_tickerid: this._symbol,
      prefix: "",
      root: this._symbol,
      ticker: this._symbol,
      tickerid: this._symbol,
      type: "crypto",
      basecurrency: "USD",
      country: "",
      currency: "USD",
      timezone: "Etc/UTC",
      employees: 0,
      industry: "",
      sector: "",
      shareholders: 0,
      shares_outstanding_float: 0,
      shares_outstanding_total: 0,
      expiration_date: 0,
      session: "24x7",
      volumetype: "",
      mincontract: 0,
      minmove: 1,
      mintick: 0.01,
      pointvalue: 1,
      pricescale: 100,
      recommendations_buy: 0,
      recommendations_buy_strong: 0,
      recommendations_date: 0,
      recommendations_hold: 0,
      recommendations_sell: 0,
      recommendations_sell_strong: 0,
      recommendations_total: 0,
      target_price_average: 0,
      target_price_date: 0,
      target_price_estimates: 0,
      target_price_high: 0,
      target_price_low: 0,
      target_price_median: 0,
    };
  }
}
