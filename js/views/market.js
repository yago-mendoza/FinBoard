/* ── Market View: Search, Compare, and Asset Detail ── */
const MarketView = (() => {

  let activeTab = 'search';
  let searchInput = '';
  let searchResults = [];
  let searchLoading = false;
  let searchDebounce = null;
  let detailSymbol = null;    // Yahoo ticker for non-portfolio detail
  let detailData = null;
  let detailHistory = null;
  let detailLoading = false;

  const SPECIAL_TABS = ['search', 'compare'];

  function render(container, params) {
    // Determine what to show: search, compare, or an asset symbol
    if (params && !SPECIAL_TABS.includes(params)) {
      // It's a symbol — render asset detail inside Market
      renderAssetDetail(container, params);
      return;
    }

    if (params && SPECIAL_TABS.includes(params)) {
      activeTab = params;
    }

    // Reset non-portfolio detail state when going back to tabs
    detailSymbol = null;
    detailData = null;
    detailHistory = null;

    container.innerHTML = `
      <div class="tabs">
        <button class="tab ${activeTab === 'search' ? 'active' : ''}" data-tab="search">Search</button>
        <button class="tab ${activeTab === 'compare' ? 'active' : ''}" data-tab="compare">Compare</button>
      </div>
      <div id="market-content"></div>
    `;

    container.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        activeTab = tab.dataset.tab;
        container.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        Charts.destroyAll();
        renderTab(document.getElementById('market-content'));
      });
    });

    renderTab(document.getElementById('market-content'));
  }

  function renderTab(el) {
    switch (activeTab) {
      case 'search': renderSearch(el); break;
      case 'compare': renderCompare(el); break;
    }
  }

  // ── Compare: Delegate to CompareView ──
  function renderCompare(el) {
    CompareView.render(el);
  }

  // ── Asset Detail (portfolio holding) — rendered inside Market ──
  function renderAssetDetail(container, symbol) {
    // Determine back target based on where user came from
    const prev = Router.getPrevious();
    let backLabel = 'Market';
    let backAction = `Router.navigate('market','search')`;

    if (prev.view === 'holdings') {
      backLabel = 'Holdings';
      backAction = `Router.navigate('holdings')`;
    } else if (prev.view === 'transactions') {
      backLabel = 'Transactions';
      backAction = `Router.navigate('transactions')`;
    } else if (prev.view === 'dashboard') {
      backLabel = 'Dashboard';
      backAction = `Router.navigate('dashboard')`;
    }

    // Check if this is a portfolio holding
    const holdings = AppState.get('holdings') || [];
    const isHolding = holdings.some(h => h.symbol === symbol);

    if (isHolding) {
      // Render a wrapper with back button, then delegate to AssetDetailView
      container.innerHTML = `<div id="market-asset-detail"></div>`;
      const wrapper = document.getElementById('market-asset-detail');
      AssetDetailView.render(wrapper, symbol, backLabel, backAction);
    } else {
      // Non-portfolio symbol — use market detail
      container.innerHTML = `<div id="market-content"></div>`;
      openMarketDetail(symbol, document.getElementById('market-content'));
    }
  }

  // ── Search: Yahoo Finance ticker search ──
  function renderSearch(el) {
    el.innerHTML = `
      <div class="market-search">
        <div class="market-search__bar">
          <svg class="market-search__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input type="text" class="input market-search__input" id="market-search-input"
                 placeholder="Search any ticker or company name..." value="${escapeHtml(searchInput)}" autocomplete="off">
        </div>
        <div id="market-search-results"></div>
      </div>
    `;

    const input = document.getElementById('market-search-input');
    if (input) {
      input.focus();
      input.addEventListener('input', () => {
        searchInput = input.value.trim();
        clearTimeout(searchDebounce);
        if (!searchInput) {
          searchResults = [];
          renderResults();
          return;
        }
        searchDebounce = setTimeout(() => doSearch(searchInput), 350);
      });
    }

    renderResults();
  }

  async function doSearch(query) {
    searchLoading = true;
    renderResults();

    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=12&newsCount=0&listsCount=0`;

    for (let pi = 0; pi < Config.CORS_PROXIES.length; pi++) {
      try {
        const proxyUrl = Config.CORS_PROXIES[pi](url);
        const resp = await fetch(proxyUrl, { signal: AbortSignal.timeout(8000) });
        if (!resp.ok) continue;
        const data = await resp.json();

        searchResults = (data.quotes || []).filter(q =>
          q.quoteType === 'EQUITY' || q.quoteType === 'ETF' || q.quoteType === 'CRYPTOCURRENCY' ||
          q.quoteType === 'MUTUALFUND' || q.quoteType === 'INDEX'
        );
        searchLoading = false;
        renderResults();
        return;
      } catch (e) {
        console.warn(`Search proxy ${pi} failed:`, e.message);
      }
    }

    searchResults = [];
    searchLoading = false;
    renderResults();
  }

  function renderResults() {
    const container = document.getElementById('market-search-results');
    if (!container) return;

    if (searchLoading) {
      container.innerHTML = `
        <div class="market-search__status">
          <div class="chart-loading-status__spinner"></div>
          <span>Searching...</span>
        </div>`;
      return;
    }

    if (!searchInput) {
      container.innerHTML = `
        <div class="market-search__empty">
          <div class="market-search__empty-icon">&#x1F50D;</div>
          <div class="market-search__empty-text">Search for any ticker, ETF, crypto, or company</div>
          <div class="market-search__empty-hint">e.g. AAPL, Bitcoin, S&P 500, Vanguard</div>
        </div>`;
      return;
    }

    if (searchResults.length === 0) {
      container.innerHTML = `
        <div class="market-search__empty">
          <div class="market-search__empty-text">No results for "${escapeHtml(searchInput)}"</div>
          <div class="market-search__empty-hint">Try a different search term</div>
        </div>`;
      return;
    }

    const holdings = AppState.get('holdings') || [];
    const holdingSymSet = new Set(holdings.map(h => h.symbol));

    container.innerHTML = `
      <div class="market-search__list">
        ${searchResults.map(q => {
          const typeLabel = getQuoteTypeLabel(q.quoteType);
          const exchange = q.exchDisp || q.exchange || '';
          const internalSym = Config.findInternalSymbol(q.symbol);
          const inPortfolio = internalSym && holdingSymSet.has(internalSym);
          return `
            <div class="market-search__item" data-symbol="${q.symbol}">
              <div class="market-search__item-main">
                <span class="market-search__item-symbol mono">${q.symbol}</span>
                <span class="market-search__item-name">${escapeHtml(q.shortname || q.longname || '')}</span>
                ${inPortfolio ? '<span class="badge badge--buy" style="font-size:9px;">In portfolio</span>' : ''}
              </div>
              <div class="market-search__item-meta">
                <span class="badge badge--${typeLabel.toLowerCase()}">${typeLabel}</span>
                <span class="market-search__item-exchange">${escapeHtml(exchange)}</span>
              </div>
            </div>`;
        }).join('')}
      </div>`;

    container.querySelectorAll('.market-search__item').forEach(item => {
      item.addEventListener('click', () => {
        const sym = item.dataset.symbol;
        const result = searchResults.find(q => q.symbol === sym);
        if (!result) return;

        // Check if this Yahoo ticker matches a portfolio holding
        const internalSym = Config.findInternalSymbol(sym);
        const isHolding = internalSym && holdingSymSet.has(internalSym);

        // Navigate within Market — symbol as param
        Router.navigate('market', isHolding ? internalSym : sym);
      });
    });
  }

  function getQuoteTypeLabel(type) {
    const map = { EQUITY: 'Stock', ETF: 'ETF', CRYPTOCURRENCY: 'Crypto', MUTUALFUND: 'Fund', INDEX: 'Index' };
    return map[type] || type;
  }

  // ── Non-portfolio market detail ──
  async function openMarketDetail(yahooSymbol, el) {
    detailSymbol = yahooSymbol;
    detailData = null;
    detailHistory = null;
    detailLoading = true;

    renderMarketDetail(el);

    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?range=1d&interval=1d`;
    const histUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?range=6mo&interval=1d`;

    const fetchOne = async (url) => {
      for (let pi = 0; pi < Config.CORS_PROXIES.length; pi++) {
        try {
          const resp = await fetch(Config.CORS_PROXIES[pi](url), { signal: AbortSignal.timeout(10000) });
          if (!resp.ok) continue;
          return await resp.json();
        } catch (e) { continue; }
      }
      return null;
    };

    const [quoteData, histData] = await Promise.all([fetchOne(chartUrl), fetchOne(histUrl)]);

    if (quoteData?.chart?.result?.[0]) {
      const meta = quoteData.chart.result[0].meta;
      detailData = {
        name: yahooSymbol,
        symbol: yahooSymbol,
        price: meta.regularMarketPrice,
        prevClose: meta.chartPreviousClose || meta.previousClose || meta.regularMarketPrice,
        currency: meta.currency || 'USD',
      };
      detailData.change = detailData.price - detailData.prevClose;
      detailData.changePct = detailData.prevClose > 0 ? (detailData.change / detailData.prevClose) * 100 : 0;
    }

    if (histData?.chart?.result?.[0]) {
      const result = histData.chart.result[0];
      const timestamps = result.timestamp || [];
      const closes = result.indicators?.quote?.[0]?.close || [];
      detailHistory = timestamps.map((ts, i) => ({
        date: new Date(ts * 1000).toISOString().slice(0, 10),
        close: closes[i],
      })).filter(p => p.close != null);
    }

    detailLoading = false;
    renderMarketDetail(el);
  }

  function renderMarketDetail(el) {
    if (!el) return;

    const backBtn = `<button class="btn btn--ghost btn--sm" id="market-back-btn" style="margin-bottom:var(--sp-4);">
      &larr; Back to search
    </button>`;

    if (detailLoading) {
      el.innerHTML = `
        ${backBtn}
        <div class="market-search__status" style="min-height:300px;">
          <div class="chart-loading-status__spinner"></div>
          <span>Loading ${escapeHtml(detailSymbol)}...</span>
        </div>`;
      bindMarketBackBtn();
      return;
    }

    if (!detailData) {
      el.innerHTML = `
        ${backBtn}
        <div class="market-search__empty">
          <div class="market-search__empty-text">Could not load data for ${escapeHtml(detailSymbol)}</div>
        </div>`;
      bindMarketBackBtn();
      return;
    }

    const d = detailData;
    const changeClass = d.change >= 0 ? 'positive' : 'negative';
    const changeSign = d.change >= 0 ? '+' : '';

    el.innerHTML = `
      ${backBtn}
      <div class="card market-detail">
        <div class="market-detail__header">
          <div>
            <h2 class="market-detail__symbol">${escapeHtml(d.symbol)}</h2>
            <div class="market-detail__name">${escapeHtml(d.name)}</div>
            <div class="market-detail__meta">
              <span>${escapeHtml(d.currency)}</span>
            </div>
          </div>
          <div class="market-detail__price">
            <div class="market-detail__price-current mono">${formatPrice(d.price, d.currency)}</div>
            <div class="market-detail__price-change ${changeClass} mono">
              ${changeSign}${formatPrice(d.change, d.currency)} (${changeSign}${d.changePct.toFixed(2)}%)
            </div>
          </div>
        </div>
        <div class="chart-canvas-container chart-canvas-container--md" id="market-detail-chart-area">
          ${detailHistory && detailHistory.length > 0 ? '<canvas id="market-detail-chart"></canvas>' : '<div class="market-search__empty"><div class="market-search__empty-text">No chart data available</div></div>'}
        </div>
      </div>
    `;

    bindMarketBackBtn();

    if (detailHistory && detailHistory.length > 0) {
      const labels = detailHistory.map(p => p.date);
      const values = detailHistory.map(p => p.close);
      const isUp = values[values.length - 1] >= values[0];
      const color = isUp ? '#3fb950' : '#f85149';

      Charts.create('market-detail-chart', {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: d.symbol,
            data: values,
            borderColor: color,
            backgroundColor: color + '1a',
            fill: true,
            tension: 0.2,
            pointRadius: 0,
            pointHoverRadius: 4,
            borderWidth: 2,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { intersect: false, mode: 'index' },
          scales: {
            x: { grid: { display: false }, ticks: { maxTicksLimit: 10 } },
            y: { ticks: { callback: v => formatPrice(v, d.currency) } },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => ` ${formatPrice(ctx.parsed.y, d.currency)}`,
              },
            },
          },
        },
      });
    }
  }

  function bindMarketBackBtn() {
    const btn = document.getElementById('market-back-btn');
    if (btn) {
      btn.addEventListener('click', () => {
        Router.navigate('market', 'search');
      });
    }
  }

  function formatPrice(value, currency) {
    if (value == null) return 'N/A';
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
    } catch {
      return '$' + Number(value).toFixed(2);
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  return { render };
})();
