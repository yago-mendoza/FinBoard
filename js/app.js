/* ── FinBoard App Bootstrap ── */
const App = (() => {

  function init() {
    // Load settings
    Settings.load();

    // Init Chart.js dark theme
    Charts.initDefaults();

    // Register routes
    Router.register('dashboard', (c) => DashboardView.render(c));
    Router.register('holdings', (c) => HoldingsView.render(c));
    Router.register('transactions', (c) => TransactionsView.render(c));
    Router.register('analysis', (c, p) => AnalysisView.render(c, p));
    Router.register('market', (c, p) => MarketView.render(c, p));

    // Redirect legacy routes
    Router.register('timeline', () => Router.navigate('analysis', 'timeline'));
    Router.register('compare', () => Router.navigate('market', 'compare'));
    Router.register('asset-detail', (c, p) => { if (p) Router.navigate('market', p); else Router.navigate('market', 'search'); });

    // Event listeners for filter changes -> re-render
    EventBus.on('filters:changed', () => Router.refresh());

    // Sidebar toggle (mobile)
    document.getElementById('sidebar-toggle').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('open');
      document.getElementById('sidebar-overlay').style.display =
        document.getElementById('sidebar').classList.contains('open') ? 'block' : 'none';
    });

    document.getElementById('sidebar-overlay').addEventListener('click', () => {
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('sidebar-overlay').style.display = 'none';
    });

    // Close sidebar on nav click (mobile)
    document.querySelectorAll('.sidebar__link').forEach(link => {
      link.addEventListener('click', () => {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebar-overlay').style.display = 'none';
      });
    });

    // Refresh prices button
    document.getElementById('refresh-prices').addEventListener('click', () => {
      API.clearCache();
      fetchAndApplyPrices();
    });

    // Settings gear toggle
    document.getElementById('settings-toggle').addEventListener('click', () => {
      Settings.togglePanel();
    });

    // Settings overlay click to close
    document.getElementById('settings-overlay').addEventListener('click', () => {
      Settings.togglePanel();
    });

    // Export dropdown toggle
    document.getElementById('export-toggle').addEventListener('click', (e) => {
      e.stopPropagation();
      Export.toggleDropdown();
    });
    Export.bindDropdown();

    // Clear data button
    document.getElementById('clear-data').addEventListener('click', () => {
      if (confirm('Clear all data and return to start?')) {
        AppState.clearStorage();
        AppState.set('rawTransactions', []);
        AppState.set('holdings', []);
        AppState.set('livePrices', {});
        AppState.set('dataLoaded', false);
        document.getElementById('app-shell').classList.add('hidden');
        Charts.destroyAll();
        LoaderView.render(document.getElementById('content'));
      }
    });

    // Clear filters button
    document.getElementById('clear-filters').addEventListener('click', () => {
      AppState.clearFilters();
      buildFilters(); // Re-render chips
    });

    // Date filter inputs
    document.getElementById('filter-date-from').addEventListener('change', e => {
      AppState.setFilter('dateFrom', e.target.value || null);
    });
    document.getElementById('filter-date-to').addEventListener('change', e => {
      AppState.setFilter('dateTo', e.target.value || null);
    });

    // Ticker search
    initTickerSearch();

    // Show loader screen
    LoaderView.render(document.getElementById('content'));
  }

  function initTickerSearch() {
    const input = document.getElementById('ticker-search-input');
    const dropdown = document.getElementById('ticker-search-dropdown');
    let selectedIdx = -1;

    function getMatches(query) {
      const holdings = AppState.get('holdings');
      if (!holdings || !query) return [];
      const q = query.toUpperCase();
      return holdings.filter(h => h.symbol.toUpperCase().includes(q));
    }

    function renderDropdown(matches) {
      if (matches.length === 0) {
        dropdown.classList.remove('open');
        return;
      }
      selectedIdx = 0;
      dropdown.innerHTML = matches.map((h, i) =>
        `<div class="ticker-search__item ${i === 0 ? 'selected' : ''}" data-symbol="${h.symbol}">
          <span class="mono" style="font-weight:600;">${h.symbol}</span>
          ${UI.typeBadge(h.type)}
        </div>`
      ).join('');
      dropdown.classList.add('open');
    }

    function navigateTo(symbol) {
      if (!symbol) return;
      Router.navigate('market', symbol);
      input.value = '';
      dropdown.classList.remove('open');
      input.blur();
    }

    input.addEventListener('input', () => {
      const q = input.value.trim();
      if (!q) { dropdown.classList.remove('open'); return; }
      const matches = getMatches(q);
      renderDropdown(matches);
    });

    input.addEventListener('keydown', (e) => {
      const items = dropdown.querySelectorAll('.ticker-search__item');
      if (!items.length) {
        if (e.key === 'Escape') { input.value = ''; dropdown.classList.remove('open'); }
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        items[selectedIdx]?.classList.remove('selected');
        selectedIdx = (selectedIdx + 1) % items.length;
        items[selectedIdx]?.classList.add('selected');
        items[selectedIdx]?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        items[selectedIdx]?.classList.remove('selected');
        selectedIdx = (selectedIdx - 1 + items.length) % items.length;
        items[selectedIdx]?.classList.add('selected');
        items[selectedIdx]?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const sym = items[selectedIdx]?.dataset.symbol;
        navigateTo(sym);
      } else if (e.key === 'Escape') {
        input.value = '';
        dropdown.classList.remove('open');
      }
    });

    dropdown.addEventListener('mousedown', (e) => {
      e.preventDefault(); // Prevents input blur so click registers
      const item = e.target.closest('.ticker-search__item');
      if (item) navigateTo(item.dataset.symbol);
    });

    input.addEventListener('blur', () => {
      dropdown.classList.remove('open');
    });
  }

  function buildFilters() {
    const txs = AppState.get('rawTransactions');

    // Platforms
    const platforms = [...new Set(txs.map(t => t.platform))].sort();
    const platformContainer = document.getElementById('filter-platform');
    platformContainer.innerHTML = '';
    for (const p of platforms) {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = Config.getPlatformLabel(p);
      chip.dataset.value = p;
      const color = Config.getPlatformColor(p);
      chip.style.borderLeft = `3px solid ${color}`;
      chip.addEventListener('click', () => toggleChipFilter('platforms', p, chip));
      platformContainer.appendChild(chip);
    }

    // Types
    const types = [...new Set(txs.map(t => t.type))].sort();
    const typeContainer = document.getElementById('filter-type');
    typeContainer.innerHTML = '';
    for (const t of types) {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = Config.getTypeLabel(t);
      chip.dataset.value = t;
      const color = Config.getTypeColor(t);
      chip.style.borderLeft = `3px solid ${color}`;
      chip.addEventListener('click', () => toggleChipFilter('types', t, chip));
      typeContainer.appendChild(chip);
    }

    // Reset date inputs
    document.getElementById('filter-date-from').value = '';
    document.getElementById('filter-date-to').value = '';
  }

  function toggleChipFilter(filterKey, value, chipEl) {
    const current = AppState.getFilters()[filterKey];
    const idx = current.indexOf(value);

    if (idx >= 0) {
      current.splice(idx, 1);
      chipEl.classList.remove('active');
    } else {
      current.push(value);
      chipEl.classList.add('active');
    }

    AppState.setFilter(filterKey, current);
  }

  async function fetchAndApplyPrices() {
    const holdings = AppState.get('holdings');
    const symbols = holdings.filter(h => h.quantity > 0).map(h => h.symbol);

    if (symbols.length === 0) return;

    AppState.set('pricesLoading', true);
    const statusEl = document.getElementById('price-status');
    statusEl.textContent = 'Fetching prices...';

    // Show full-screen overlay
    const overlay = document.getElementById('price-overlay');
    const fill = document.getElementById('price-overlay-fill');
    const countEl = document.getElementById('price-overlay-count');
    if (overlay) overlay.style.display = 'flex';

    const total = symbols.filter(s => Config.getYahooTicker(s)).length;
    let fetched = 0;

    function updateProgress() {
      if (fill) fill.style.width = total > 0 ? `${(fetched / total) * 100}%` : '0%';
      if (countEl) countEl.textContent = `${fetched} / ${total}`;
    }
    updateProgress();

    try {
      const prices = await API.fetchPrices(symbols, (done, tot) => {
        fetched = done;
        updateProgress();
      });
      AppState.set('livePrices', prices);

      // Update holdings with prices
      const updated = Portfolio.applyPrices(holdings, prices);
      AppState.set('holdings', updated);

      const count = Object.keys(prices).length;
      statusEl.textContent = `${count}/${symbols.length} prices loaded`;

      // Re-render current view
      Router.refresh();
    } catch (e) {
      statusEl.textContent = 'Price fetch failed';
      console.error('Price fetch error:', e);
    } finally {
      AppState.set('pricesLoading', false);
      if (overlay) overlay.style.display = 'none';
    }
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { buildFilters, fetchAndApplyPrices };
})();
