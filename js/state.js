/* ── AppState Singleton + EventBus ── */
const EventBus = (() => {
  const listeners = {};

  function on(event, fn) {
    (listeners[event] = listeners[event] || []).push(fn);
    return () => off(event, fn);
  }

  function off(event, fn) {
    if (!listeners[event]) return;
    listeners[event] = listeners[event].filter(f => f !== fn);
  }

  function emit(event, data) {
    (listeners[event] || []).forEach(fn => {
      try { fn(data); } catch (e) { console.error(`EventBus [${event}]:`, e); }
    });
  }

  return { on, off, emit };
})();

const AppState = (() => {
  const state = {
    rawTransactions: [],   // Parsed CSV rows (merged stock + crypto)
    holdings: [],          // Computed current positions
    cashBalances: {},      // { PLATFORM: cashAmount } from liquidity CSV
    livePrices: {},        // { SYMBOL: { price, change, changePct, ts } }
    filters: {
      platforms: [],       // Active platform filters (empty = all)
      types: [],           // Active type filters
      dateFrom: null,
      dateTo: null,
    },
    dataLoaded: false,
    pricesLoading: false,
  };

  function get(key) {
    return key ? state[key] : { ...state };
  }

  function set(key, value) {
    state[key] = value;
    EventBus.emit('state:' + key, value);
    EventBus.emit('state:changed', { key, value });
  }

  function setFilter(filterKey, value) {
    state.filters[filterKey] = value;
    EventBus.emit('filters:changed', state.filters);
  }

  /** Set multiple filter keys at once, emitting only one event */
  function setFilters(obj) {
    for (const [key, value] of Object.entries(obj)) {
      state.filters[key] = value;
    }
    EventBus.emit('filters:changed', state.filters);
  }

  function getFilters() {
    return {
      platforms: [...state.filters.platforms],
      types: [...state.filters.types],
      dateFrom: state.filters.dateFrom,
      dateTo: state.filters.dateTo,
    };
  }

  function clearFilters() {
    state.filters = { platforms: [], types: [], dateFrom: null, dateTo: null };
    EventBus.emit('filters:changed', state.filters);
  }

  /** Return transactions matching current filters.
   *  opts.skipTypeFilter: if true, don't filter by type (used for holdings computation) */
  function filteredTransactions(opts) {
    let txs = state.rawTransactions;
    const f = state.filters;

    if (f.platforms.length > 0) {
      txs = txs.filter(t => f.platforms.includes(t.platform));
    }
    if (!(opts && opts.skipTypeFilter) && f.types.length > 0) {
      txs = txs.filter(t => f.types.includes(t.type));
    }
    if (f.dateFrom) {
      txs = txs.filter(t => t.date >= f.dateFrom);
    }
    if (f.dateTo) {
      const to = new Date(f.dateTo);
      to.setDate(to.getDate() + 1);
      txs = txs.filter(t => t.date < to.toISOString().slice(0, 10));
    }
    return txs;
  }

  /** Save transactions to localStorage */
  function persist() {
    try {
      localStorage.setItem('finboard_transactions', JSON.stringify(state.rawTransactions));
      localStorage.setItem('finboard_cash', JSON.stringify(state.cashBalances));
      localStorage.setItem('finboard_ts', Date.now().toString());
      localStorage.setItem('finboard_version', '2');
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }

  /** Load transactions from localStorage */
  function restore() {
    try {
      const data = localStorage.getItem('finboard_transactions');
      if (data) {
        const ts = localStorage.getItem('finboard_ts');
        const cashData = localStorage.getItem('finboard_cash');
        return {
          transactions: JSON.parse(data),
          cashBalances: cashData ? JSON.parse(cashData) : {},
          savedAt: Number(ts),
        };
      }
    } catch (e) {
      console.warn('LocalStorage restore failed:', e);
    }
    return null;
  }

  function clearStorage() {
    localStorage.removeItem('finboard_transactions');
    localStorage.removeItem('finboard_cash');
    localStorage.removeItem('finboard_ts');
    localStorage.removeItem('finboard_prices');
    localStorage.removeItem('finboard_settings');
    localStorage.removeItem('finboard_layout');
    localStorage.removeItem('finboard_version');
  }

  return {
    get, set, setFilter, setFilters, getFilters, clearFilters,
    filteredTransactions, persist, restore, clearStorage,
  };
})();
