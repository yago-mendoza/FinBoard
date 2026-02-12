/* ── Compare Assets View: Overlay price charts for multiple holdings ── */
const CompareView = (() => {

  // Persistent state across navigations
  let selectedSymbols = [];
  let activeRange = '1y';
  let mode = 'pct';          // 'pct' = % change, 'price' = absolute
  let searchQuery = '';
  const historyCache = {};    // 'BTC|1y' → [{date, close}]
  const MAX_SELECTED = 8;

  // Type display order
  const TYPE_ORDER = ['MKT', 'ETF', 'CRP', 'RSC', 'FUN'];

  /**
   * Ensure a hex color is visible against a dark background.
   * Lightens colors whose perceived luminance is too low.
   */
  function ensureVisibleColor(hex) {
    if (!hex || hex.length < 7) return hex;
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (lum >= 60) return hex;
    // Blend toward white
    const t = 0.5;
    r = Math.round(r + (255 - r) * t);
    g = Math.round(g + (255 - g) * t);
    b = Math.round(b + (255 - b) * t);
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  }

  function render(container) {
    const holdings = AppState.get('holdings') || [];
    const active = holdings.filter(h => h.quantity > 0);

    // Clean up stale selections (asset may have been sold)
    const activeSymbols = new Set(active.map(h => h.symbol));
    selectedSymbols = selectedSymbols.filter(s => activeSymbols.has(s));

    container.innerHTML = `
      <h1 class="view-title">Compare Assets</h1>

      <div class="card compare-selector">
        <div class="compare-selector__search">
          <input type="text" class="input input--sm" id="compare-search"
                 placeholder="Filter assets..." value="${searchQuery}">
          <span class="compare-selector__count" id="compare-count">
            ${selectedSymbols.length}/${MAX_SELECTED} selected
          </span>
        </div>
        <div class="compare-selector__chips" id="compare-chips"></div>
      </div>

      <div class="card" style="margin-top:var(--sp-4);">
        <div class="chart-wrap__header">
          <div id="compare-range" style="display:flex; gap:var(--sp-1);">
            ${['1mo', '3mo', '6mo', '1y', '2y', '5y'].map(r => `
              <button class="btn btn--ghost btn--sm range-btn ${r === activeRange ? 'active' : ''}" data-range="${r}">${r}</button>
            `).join('')}
          </div>
          <div style="display:flex; gap:var(--sp-1);">
            <button class="btn btn--ghost btn--sm compare-mode-btn ${mode === 'pct' ? 'active' : ''}" data-mode="pct">% Change</button>
            <button class="btn btn--ghost btn--sm compare-mode-btn ${mode === 'price' ? 'active' : ''}" data-mode="price">Price</button>
          </div>
        </div>
        <div class="chart-canvas-container chart-canvas-container--md" id="compare-chart-area">
          <canvas id="chart-compare"></canvas>
        </div>
        <div id="compare-loading" class="chart-loading" style="display:none;"></div>
        <div id="compare-empty" class="chart-empty-state" style="display:none;">
          <div class="chart-empty-state__icon">&#x1f4c8;</div>
          <div class="chart-empty-state__text" id="compare-empty-text"></div>
          <div class="chart-empty-state__hint" id="compare-empty-hint"></div>
        </div>
      </div>
    `;

    renderChips(active);
    bindEvents(active);
    updateChartOrEmpty();
  }

  function renderChips(active) {
    const container = document.getElementById('compare-chips');
    if (!container) return;

    const query = searchQuery.toLowerCase();
    const atLimit = selectedSymbols.length >= MAX_SELECTED;
    const remaining = MAX_SELECTED - selectedSymbols.length;

    // Group by type, filtering by search query
    const groups = {};
    for (const h of active) {
      if (!Config.getYahooTicker(h.symbol)) continue; // skip unpriced
      const name = Config.getDisplayName(h.symbol).toLowerCase();
      if (query && !h.symbol.toLowerCase().includes(query) && !name.includes(query)) continue;
      if (!groups[h.type]) groups[h.type] = [];
      groups[h.type].push(h);
    }

    container.innerHTML = TYPE_ORDER
      .filter(type => groups[type]?.length > 0)
      .map(type => {
        const items = groups[type];
        const selectedInGroup = items.filter(h => selectedSymbols.includes(h.symbol)).length;
        const allSelected = selectedInGroup === items.length;
        const noneSelected = selectedInGroup === 0;
        const typeColor = Config.getTypeColor(type);

        return `
          <div class="compare-category">
            <div class="compare-category__header">
              <span class="compare-category__title" style="border-left:3px solid ${typeColor}; padding-left:var(--sp-2);">
                ${Config.getTypeLabel(type)}
                <small>${selectedInGroup}/${items.length}</small>
              </span>
              <button class="btn btn--ghost btn--sm compare-select-all"
                      data-type="${type}" ${!allSelected && atLimit ? 'disabled' : ''}>
                ${allSelected ? 'Deselect all' : noneSelected ? 'Select all' : 'Deselect all'}
              </button>
            </div>
            <div class="compare-category__chips">
              ${items.map(h => {
                const sel = selectedSymbols.includes(h.symbol);
                const disabled = !sel && atLimit;
                const color = ensureVisibleColor(Config.getSymbolColor(h.symbol));
                const name = Config.getDisplayName(h.symbol);
                return `<button class="compare-chip ${sel ? 'compare-chip--selected' : ''}"
                                data-symbol="${h.symbol}" ${disabled ? 'disabled' : ''}>
                  <span class="compare-chip__dot" style="background:${color};"></span>
                  ${name}
                </button>`;
              }).join('')}
            </div>
          </div>`;
      }).join('');
  }

  function bindEvents(active) {
    // Search input
    const search = document.getElementById('compare-search');
    if (search) {
      search.addEventListener('input', () => {
        searchQuery = search.value.trim();
        renderChips(active);
        bindChipClicks(active);
      });
    }

    bindChipClicks(active);

    // Range buttons
    document.querySelectorAll('#compare-range .range-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#compare-range .range-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeRange = btn.dataset.range;
        loadCompareChart();
      });
    });

    // Mode buttons
    document.querySelectorAll('.compare-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.compare-mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        mode = btn.dataset.mode;
        loadCompareChart();
      });
    });
  }

  function bindChipClicks(active) {
    // Individual chip toggles
    document.querySelectorAll('.compare-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const sym = chip.dataset.symbol;
        const idx = selectedSymbols.indexOf(sym);
        if (idx >= 0) {
          selectedSymbols.splice(idx, 1);
        } else if (selectedSymbols.length < MAX_SELECTED) {
          selectedSymbols.push(sym);
        }
        renderChips(active);
        bindChipClicks(active);
        updateCount();
        updateChartOrEmpty();
      });
    });

    // "Select all" / "Deselect all" per category
    document.querySelectorAll('.compare-select-all').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        const priceable = active.filter(h => h.type === type && Config.getYahooTicker(h.symbol));

        // Apply search filter if active
        const query = searchQuery.toLowerCase();
        const filtered = query
          ? priceable.filter(h => {
              const name = Config.getDisplayName(h.symbol).toLowerCase();
              return h.symbol.toLowerCase().includes(query) || name.includes(query);
            })
          : priceable;

        const symsInGroup = filtered.map(h => h.symbol);
        const selectedInGroup = symsInGroup.filter(s => selectedSymbols.includes(s));
        const hasAny = selectedInGroup.length > 0;

        if (hasAny) {
          // Deselect all in this group
          selectedSymbols = selectedSymbols.filter(s => !symsInGroup.includes(s));
        } else {
          // Select all in this group (respecting limit)
          const remaining = MAX_SELECTED - selectedSymbols.length;
          const toAdd = symsInGroup
            .filter(s => !selectedSymbols.includes(s))
            .slice(0, remaining);
          selectedSymbols.push(...toAdd);
        }

        renderChips(active);
        bindChipClicks(active);
        updateCount();
        updateChartOrEmpty();
      });
    });
  }

  function updateCount() {
    const el = document.getElementById('compare-count');
    if (el) el.textContent = `${selectedSymbols.length}/${MAX_SELECTED} selected`;
  }

  function updateChartOrEmpty() {
    if (selectedSymbols.length < 2) {
      showEmpty();
    } else {
      hideEmpty();
      loadCompareChart();
    }
  }

  function showEmpty() {
    const empty = document.getElementById('compare-empty');
    const text = document.getElementById('compare-empty-text');
    const hint = document.getElementById('compare-empty-hint');
    if (!empty) return;

    Charts.destroy('chart-compare');

    const canvasEl = document.getElementById('chart-compare');
    if (canvasEl) canvasEl.style.display = 'none';
    empty.style.display = 'flex';

    if (selectedSymbols.length === 0) {
      text.textContent = 'Select 2 or more assets to compare';
      hint.textContent = 'Click chips or use "Select all" per category';
    } else {
      text.textContent = 'Select at least one more asset';
      hint.textContent = `${selectedSymbols.length} selected — need at least 2`;
    }
  }

  function hideEmpty() {
    const empty = document.getElementById('compare-empty');
    const canvasEl = document.getElementById('chart-compare');
    if (empty) empty.style.display = 'none';
    if (canvasEl) canvasEl.style.display = 'block';
  }

  async function loadCompareChart() {
    if (selectedSymbols.length < 2) return;

    const loading = document.getElementById('compare-loading');
    if (loading) loading.style.display = 'flex';

    try {
      const results = await Promise.allSettled(
        selectedSymbols.map(async sym => {
          const key = `${sym}|${activeRange}`;
          if (historyCache[key]) return { symbol: sym, data: historyCache[key] };
          const data = await API.fetchHistory(sym, activeRange);
          historyCache[key] = data;
          return { symbol: sym, data };
        })
      );

      if (loading) loading.style.display = 'none';

      const series = results
        .filter(r => r.status === 'fulfilled' && r.value.data.length > 0)
        .map(r => r.value);

      if (series.length === 0) {
        showNoData();
        return;
      }

      const aligned = alignDates(series);

      const datasets = aligned.map(s => {
        const color = ensureVisibleColor(Config.getSymbolColor(s.symbol));
        let data;
        if (mode === 'pct') {
          const base = s.values.find(v => v != null);
          data = s.values.map(v => (v != null && base) ? ((v - base) / base) * 100 : null);
        } else {
          data = s.values;
        }
        return {
          label: Config.getDisplayName(s.symbol),
          data,
          borderColor: color,
          backgroundColor: color,
          fill: false,
          tension: 0.2,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2,
          spanGaps: true,
        };
      });

      Charts.create('chart-compare', {
        type: 'line',
        data: { labels: aligned[0].dates, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { intersect: false, mode: 'index' },
          scales: {
            x: {
              grid: { display: false },
              ticks: { maxTicksLimit: 12 },
            },
            y: {
              ticks: {
                callback: mode === 'pct'
                  ? v => (v >= 0 ? '+' : '') + v.toFixed(0) + '%'
                  : v => UI.currencyCompact(v),
              },
            },
          },
          plugins: {
            legend: { display: true },
            tooltip: {
              callbacks: {
                label: ctx => {
                  if (mode === 'pct') {
                    const v = ctx.parsed.y;
                    return ` ${ctx.dataset.label}: ${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
                  }
                  return ` ${ctx.dataset.label}: ${UI.currency(ctx.parsed.y)}`;
                },
              },
            },
          },
        },
      });

    } catch (e) {
      if (loading) loading.style.display = 'none';
      console.error('Compare chart error:', e);
    }
  }

  function showNoData() {
    const empty = document.getElementById('compare-empty');
    const text = document.getElementById('compare-empty-text');
    const hint = document.getElementById('compare-empty-hint');
    const canvasEl = document.getElementById('chart-compare');

    Charts.destroy('chart-compare');
    if (canvasEl) canvasEl.style.display = 'none';
    if (empty) {
      empty.style.display = 'flex';
      text.textContent = 'No price data available for selected assets';
      hint.textContent = 'Try a different time range or selection';
    }
  }

  function alignDates(series) {
    const lookups = series.map(s => {
      const map = {};
      for (const pt of s.data) map[pt.date] = pt.close;
      return { symbol: s.symbol, map, dates: s.data.map(p => p.date) };
    });

    const firstDates = lookups.map(l => l.dates[0]);
    const latestFirst = [...firstDates].sort().pop();

    const dateSet = new Set();
    for (const l of lookups) {
      for (const d of l.dates) {
        if (d >= latestFirst) dateSet.add(d);
      }
    }
    const allDates = [...dateSet].sort();

    return lookups.map(l => {
      const values = [];
      // Pre-seed with the latest price before the alignment start date,
      // so series that began earlier don't start with null
      let lastKnown = null;
      for (const d of l.dates) {
        if (d >= latestFirst) break;
        lastKnown = l.map[d];
      }
      for (const d of allDates) {
        if (l.map[d] != null) lastKnown = l.map[d];
        values.push(lastKnown);
      }
      return { symbol: l.symbol, dates: allDates, values };
    });
  }

  /** Pre-select a symbol and navigate to compare view */
  function preselect(symbol) {
    if (!selectedSymbols.includes(symbol)) {
      selectedSymbols.push(symbol);
    }
  }

  return { render, preselect };
})();
