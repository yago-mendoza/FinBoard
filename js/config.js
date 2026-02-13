/* ── FinBoard Configuration ── */
const Config = (() => {
  // ISIN → { yahoo ticker, display name }
  const ISIN_MAP = {
    IE00BZCQB185: { yahoo: 'QDV5.DE',             name: 'iShares MSCI India' },
    LU1681038243: { yahoo: '6AQQ.DE',             name: 'Amundi Nasdaq-100' },
    IE000NDWFGA5: { yahoo: 'URNU.DE',             name: 'Global X Uranium' },
    IE00BF16M727: { yahoo: 'CIBR.L',              name: 'FT Cybersecurity' },
    IE00BGV5VN51: { yahoo: 'XAIX.DE',             name: 'Xtrackers AI & Big Data' },
    LU1681048804: { yahoo: 'AUM5.DE',             name: 'Amundi S&P 500' },
    LU1681045370: { yahoo: 'AMEM.DE',             name: 'Amundi Emerging Mkts' },
    IE00B03HD191: { yahoo: 'IE00B03HD191.IR',     name: 'Vanguard Global Stock' },
    IE0005YK6564: { yahoo: 'U3O8.DE',             name: 'Sprott Uranium Miners' },
    IE000J80JTL1: { yahoo: 'GRID.DE',             name: 'FT Smart Grid Infra' },
    IE00B8HGT870: { yahoo: '3GOL.L',              name: 'WT Gold 3x Leveraged' },
  };

  const TICKER_MAP = {
    // Crypto -> Yahoo Finance format
    BTC: 'BTC-USD', ETH: 'ETH-USD', SOL: 'SOL-USD', ADA: 'ADA-USD',
    DOT: 'DOT-USD', MANA: 'MANA-USD', KDA: 'KDA-USD', EGLD: 'EGLD-USD',
    IMX: 'IMX-USD', SYS: 'SYS-USD', VET: 'VET-USD', ROSE: 'ROSE-USD',
    KAS: 'KAS-USD', FET: 'FET-USD', APT: 'APT-USD', SUI: 'SUI-USD',

    // US Stocks
    AAPL: 'AAPL', MSFT: 'MSFT', NVDA: 'NVDA', TSLA: 'TSLA',
    GOOG: 'GOOG', META: 'META', AMZN: 'AMZN', NFLX: 'NFLX',
    BRKB: 'BRK-B', KO: 'KO', CAT: 'CAT', DE: 'DE',
    MA: 'MA', V: 'V', PLTR: 'PLTR', COIN: 'COIN',
    MU: 'MU', ANET: 'ANET', EQIX: 'EQIX', TSM: 'TSM',
    ASML: 'ASML', ADBE: 'ADBE', ADB: 'ADBE', SHECY: 'SHECY',
    WM: 'WM', UBER: 'UBER', SU: 'SU.PA',

    // Non-US
    ABBN: 'ABBN.SW',

    // Example portfolio tickers
    PYPL: 'PYPL', DIS: 'DIS', BA: 'BA', CSCO: 'CSCO', NKE: 'NKE',
    SBUX: 'SBUX', PFE: 'PFE', BAC: 'BAC', JPM: 'JPM', XOM: 'XOM',
    PEP: 'PEP', MCD: 'MCD', AMD: 'AMD', INTC: 'INTC', CRM: 'CRM',
    ABNB: 'ABNB', SNAP: 'SNAP', RBLX: 'RBLX', ROKU: 'ROKU', SPOT: 'SPOT',
    SPY: 'SPY', QQQ: 'QQQ', ARKK: 'ARKK', GLD: 'GLD',
    XRP: 'XRP-USD', DOGE: 'DOGE-USD', AVAX: 'AVAX-USD', LINK: 'LINK-USD',
    ATOM: 'ATOM-USD', UNI: 'UNI-USD', NEAR: 'NEAR-USD', ALGO: 'ALGO-USD',
    ICP: 'ICP-USD', AAVE: 'AAVE-USD',
  };

  // Merge ISINs into TICKER_MAP automatically
  for (const [isin, info] of Object.entries(ISIN_MAP)) {
    TICKER_MAP[isin] = info.yahoo;
  }

  const SYMBOL_COLORS = {
    // Tech
    MSFT: '#00A4EF', TSLA: '#E31937', NVDA: '#76B900', AAPL: '#A8A8A8',
    META: '#0081FB', GOOG: '#4285F4', AMZN: '#FF9900', PLTR: '#1D1D1D',
    NFLX: '#E50914', COIN: '#1652F0', MU: '#00539B', ANET: '#0066CC',
    EQIX: '#FF6600', TSM: '#FF0000', ASML: '#FF6600', ADB: '#FA0F00',
    ADBE: '#FA0F00', SHECY: '#0070AD', WM: '#00703C', UBER: '#000000',
    // Finance & Consumer
    MA: '#FF5F00', BRKB: '#3B2F7F', KO: '#F40009', CAT: '#FFCD11',
    DE: '#367C2B', ABBN: '#FF000F', V: '#1A1F71',
    // Crypto
    BTC: '#F7931A', ETH: '#627EEA', SOL: '#9945FF', ADA: '#0033AD',
    DOT: '#E6007A', MANA: '#FFB93E', KDA: '#EA4026', EGLD: '#23F7DD',
    IMX: '#5C6BC0', SYS: '#0082C6', VET: '#15BDFF', ROSE: '#26A17B',
    KAS: '#118A8A', FET: '#1D2838', APT: '#2DD8A3', SUI: '#4FA8F5',
  };

  const TYPE_COLORS = {
    MKT: '#58a6ff', ETF: '#8b949e', CRP: '#f0883e', RSC: '#d29922', FUN: '#a371f7',
  };

  const TYPE_LABELS = {
    MKT: 'Stocks', ETF: 'ETFs', CRP: 'Crypto', RSC: 'Resources', FUN: 'Funds',
  };

  const PLATFORM_LABELS = {
    TDRP: 'Trade Republic', MYNV: 'MyInvestor', IBKR: 'Interactive Brokers',
    BINA: 'Binance', LDGR: 'Ledger', KRKN: 'Kraken', OASI: 'Oasis',
    ETOR: 'eToro', DGRO: 'Degiro', T212: 'Trading 212',
    COBS: 'Coinbase', KUCN: 'KuCoin', MTMK: 'MetaMask',
    BBVA: 'BBVA',
  };

  const PLATFORM_COLORS = {
    TDRP: '#58a6ff', MYNV: '#3fb950', IBKR: '#f85149',
    BINA: '#f0883e', LDGR: '#a371f7', KRKN: '#79c0ff', OASI: '#d29922',
    ETOR: '#4CAF50', DGRO: '#FF5722', T212: '#00BCD4',
    COBS: '#0052FF', KUCN: '#23AF91', MTMK: '#F6851B',
    BBVA: '#004481',
  };

  const VALID_TYPES = ['MKT', 'ETF', 'CRP', 'RSC', 'FUN'];
  const VALID_ACTIONS = ['buy', 'sel'];

  // Stock splits: { date: effective date (YYYY-MM-DD), ratio: new shares per old share }
  // Transactions BEFORE this date get qty *= ratio, price /= ratio (balance unchanged)
  const SPLITS = {
    NVDA: [{ date: '2024-06-10', ratio: 10 }],
    ANET: [{ date: '2024-12-03', ratio: 4 }],
  };

  const CORS_PROXIES = [
    url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  ];

  const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

  // Build reverse map: Yahoo ticker → internal symbol
  const REVERSE_MAP = {};
  for (const [sym, yahoo] of Object.entries(TICKER_MAP)) {
    REVERSE_MAP[yahoo.toUpperCase()] = sym;
  }

  function getYahooTicker(symbol) {
    return TICKER_MAP[symbol] || null;
  }

  /** Find internal symbol from a Yahoo Finance ticker (e.g. 'BTC-USD' → 'BTC') */
  function findInternalSymbol(yahooTicker) {
    if (!yahooTicker) return null;
    return REVERSE_MAP[yahooTicker.toUpperCase()] || null;
  }

  /** Short display name: "Amundi Nasdaq-100" for ISINs, "AAPL" for tickers */
  function getDisplayName(symbol) {
    const entry = ISIN_MAP[symbol];
    return entry ? entry.name : symbol;
  }

  /** Full label: "Amundi Nasdaq-100 (LU1681038243)" for ISINs, "AAPL" for tickers */
  function getDisplayLabel(symbol) {
    const entry = ISIN_MAP[symbol];
    return entry ? `${entry.name} (${symbol})` : symbol;
  }

  function getSymbolColor(symbol) {
    if (SYMBOL_COLORS[symbol]) return SYMBOL_COLORS[symbol];
    // Generate a deterministic unique color from the symbol string
    let hash = 0;
    for (let i = 0; i < symbol.length; i++) {
      hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = ((hash % 360) + 360) % 360;
    // HSL(h, 65%, 55%) → hex
    const s = 0.65, l = 0.55;
    const a = s * Math.min(l, 1 - l);
    const f = n => {
      const k = (n + h / 30) % 12;
      const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * c).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }

  function getTypeColor(type) {
    return TYPE_COLORS[type] || '#8b949e';
  }

  function getTypeLabel(type) {
    return TYPE_LABELS[type] || type;
  }

  function getPlatformLabel(code) {
    return PLATFORM_LABELS[code] || code;
  }

  function getPlatformColor(code) {
    return PLATFORM_COLORS[code] || '#8b949e';
  }

  return {
    TICKER_MAP, ISIN_MAP, SPLITS, SYMBOL_COLORS, TYPE_COLORS, TYPE_LABELS, PLATFORM_LABELS, PLATFORM_COLORS,
    CORS_PROXIES, CACHE_TTL, VALID_TYPES, VALID_ACTIONS,
    getYahooTicker, findInternalSymbol, getDisplayName, getDisplayLabel,
    getSymbolColor, getTypeColor, getTypeLabel, getPlatformLabel, getPlatformColor,
  };
})();
