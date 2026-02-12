/* ── Yahoo Finance API with CORS proxy + caching ── */
const API = (() => {

  const CACHE_KEY = 'finboard_prices';

  function loadCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return {};
      return JSON.parse(raw);
    } catch { return {}; }
  }

  function saveCache(cache) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (e) { console.warn('Price cache save failed:', e); }
  }

  /**
   * Fetch a single quote from Yahoo Finance via CORS proxy.
   */
  async function fetchQuote(yahooTicker, proxyIdx = 0) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?range=1d&interval=1d`;
    const proxies = Config.CORS_PROXIES;

    if (proxyIdx >= proxies.length) {
      throw new Error(`All proxies failed for ${yahooTicker}`);
    }

    const proxyUrl = proxies[proxyIdx](url);

    try {
      const resp = await fetch(proxyUrl, { signal: AbortSignal.timeout(10000) });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();

      const result = data?.chart?.result?.[0];
      if (!result) throw new Error('No chart result');

      const meta = result.meta;
      const price = meta.regularMarketPrice;
      const prevClose = meta.chartPreviousClose || meta.previousClose || price;
      const change = price - prevClose;
      const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;

      return {
        price,
        change,
        changePct,
        currency: meta.currency || 'USD',
        ts: Date.now(),
      };
    } catch (e) {
      console.warn(`Proxy ${proxyIdx} failed for ${yahooTicker}:`, e.message);
      return fetchQuote(yahooTicker, proxyIdx + 1);
    }
  }

  /**
   * Fetch prices for an array of local symbols.
   * Uses cache (TTL from Config).
   * Returns { SYMBOL: { price, change, changePct, currency, ts } }
   */
  async function fetchPrices(symbols) {
    const cache = loadCache();
    const results = {};
    const toFetch = [];

    // Check cache
    for (const sym of symbols) {
      const cached = cache[sym];
      if (cached && (Date.now() - cached.ts) < Config.CACHE_TTL) {
        results[sym] = cached;
      } else {
        const yahoo = Config.getYahooTicker(sym);
        if (yahoo) {
          toFetch.push({ sym, yahoo });
        }
      }
    }

    if (toFetch.length === 0) return results;

    // Fetch in batches of 5 to avoid rate limits
    const BATCH_SIZE = 5;
    for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
      const batch = toFetch.slice(i, i + BATCH_SIZE);
      const promises = batch.map(async ({ sym, yahoo }) => {
        try {
          const quote = await fetchQuote(yahoo);
          results[sym] = quote;
          cache[sym] = quote;
        } catch (e) {
          console.warn(`Failed to fetch ${sym}:`, e.message);
        }
      });
      await Promise.allSettled(promises);

      // Small delay between batches
      if (i + BATCH_SIZE < toFetch.length) {
        await new Promise(r => setTimeout(r, 300));
      }
    }

    saveCache(cache);
    return results;
  }

  /**
   * Fetch historical price data for a single symbol.
   * Returns array of { date, close }.
   */
  async function fetchHistory(symbol, range = '1y') {
    const yahoo = Config.getYahooTicker(symbol);
    if (!yahoo) return [];

    const intervalMap = { '1mo': '1d', '3mo': '1d', '6mo': '1d', '1y': '1wk', '2y': '1wk', '5y': '1mo' };
    const interval = intervalMap[range] || '1wk';
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahoo}?range=${range}&interval=${interval}`;

    for (let pi = 0; pi < Config.CORS_PROXIES.length; pi++) {
      try {
        const proxyUrl = Config.CORS_PROXIES[pi](url);
        const resp = await fetch(proxyUrl, { signal: AbortSignal.timeout(15000) });
        if (!resp.ok) continue;
        const data = await resp.json();

        const result = data?.chart?.result?.[0];
        if (!result) continue;

        const timestamps = result.timestamp || [];
        const closes = result.indicators?.quote?.[0]?.close || [];

        return timestamps.map((ts, i) => ({
          date: new Date(ts * 1000).toISOString().slice(0, 10),
          close: closes[i],
        })).filter(p => p.close != null);
      } catch (e) {
        console.warn(`History proxy ${pi} failed for ${symbol}:`, e.message);
      }
    }

    return [];
  }

  /**
   * Fetch historical prices for multiple local symbols.
   * Returns { SYMBOL: [{ date, close }] }
   * Batches requests (5 at a time, 300ms between batches).
   * Optional onProgress(fetched, total) callback.
   */
  async function fetchAllHistories(symbols, range = '5y', onProgress) {
    const results = {};
    const toFetch = symbols.filter(sym => Config.getYahooTicker(sym));
    const total = toFetch.length;
    let fetched = 0;

    const BATCH_SIZE = 5;
    for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
      const batch = toFetch.slice(i, i + BATCH_SIZE);
      const promises = batch.map(async (sym) => {
        try {
          const history = await fetchHistory(sym, range);
          if (history.length > 0) results[sym] = history;
        } catch (e) {
          console.warn(`History fetch failed for ${sym}:`, e.message);
        }
        fetched++;
        if (onProgress) onProgress(fetched, total);
      });
      await Promise.allSettled(promises);

      if (i + BATCH_SIZE < toFetch.length) {
        await new Promise(r => setTimeout(r, 300));
      }
    }

    return results;
  }

  /** Clear price cache */
  function clearCache() {
    localStorage.removeItem(CACHE_KEY);
  }

  return { fetchPrices, fetchHistory, fetchAllHistories, clearCache };
})();
