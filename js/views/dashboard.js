/* ── Dashboard View: KPI Strip + Allocation + Timeline ── */
const DashboardView = (() => {

  function render(container) {
    const txs = AppState.filteredTransactions();
    // Compute holdings without type filter so sell txs aren't excluded
    const baseTxs = AppState.filteredTransactions({ skipTypeFilter: true });
    const holdings = Portfolio.computeHoldings(baseTxs);
    const typeFilter = AppState.getFilters().types;
    const typeFiltered = typeFilter.length > 0 ? holdings.filter(h => typeFilter.includes(h.type)) : holdings;
    const priced = Portfolio.applyPrices(typeFiltered, AppState.get('livePrices'));
    const kpi = Portfolio.computeKPIs(priced);
    const allocType = Portfolio.allocationByType(priced);
    const allocSymbol = Portfolio.allocationBySymbol(priced);
    const timeline = Portfolio.capitalTimeline(txs);
    const score = Portfolio.computeScoreboard(txs, priced);
    const unpriced = Portfolio.getUnpricedPositions(priced);

    container.innerHTML = `<div class="dashboard-grid" id="dashboard-grid">
      <div class="widget" data-widget-id="kpi-strip">
        ${renderKPIStrip(score, kpi, txs.length)}
      </div>

      ${unpriced.length > 0 ? `<div class="widget" data-widget-id="unpriced">${renderUnpricedDisclaimer(unpriced)}</div>` : ''}

      <div class="widget" data-widget-id="timeline">
        <div class="chart-wrap">
          <div class="chart-wrap__header">
            <span class="chart-wrap__title">Portfolio Over Time</span>
            ${UI.helpBtn('capital-timeline')}
            <div id="portfolio-chart-legend" class="chart-legend-inline" style="display:none;">
              <span class="chart-legend-inline__item">
                <span class="chart-legend-inline__swatch" style="background:#58a6ff;"></span>
                Invested
              </span>
              <span class="chart-legend-inline__item">
                <span class="chart-legend-inline__swatch" style="background:#3fb950;"></span>
                Portfolio Value
              </span>
            </div>
          </div>
          <div class="chart-canvas-container chart-canvas-container--md" id="dashboard-capital-container">
            <canvas id="chart-capital-timeline"></canvas>
          </div>
        </div>
      </div>

      <div class="widget" data-widget-id="allocations">
        <div class="grid-2">
          <div class="chart-wrap">
            <div class="chart-wrap__header">
              <span class="chart-wrap__title">Allocation by Type</span>
              ${UI.helpBtn('alloc-type')}
            </div>
            <div class="chart-canvas-container chart-canvas-container--doughnut">
              <canvas id="chart-alloc-type"></canvas>
            </div>
          </div>
          <div class="chart-wrap">
            <div class="chart-wrap__header">
              <span class="chart-wrap__title">Allocation by Asset</span>
              ${UI.helpBtn('alloc-symbol')}
            </div>
            <div class="chart-canvas-container chart-canvas-container--doughnut">
              <canvas id="chart-alloc-symbol"></canvas>
            </div>
          </div>
        </div>
      </div>
    </div>`;

    // Render charts
    renderAllocationType(allocType);
    renderAllocationSymbol(allocSymbol);
    renderCapitalTimeline(timeline);

    // Apply saved layout order (if any)
    DragManager.applyLayoutTo('#dashboard-grid');

    // Async: load portfolio value line
    loadPortfolioValueLine(txs);
  }

  function renderKPIStrip(score, kpi, txCount) {
    const hasUnrealized = score.unrealizedPL != null;
    const unpricedCost = score.costBasis - score.costBasisPriced;
    const displayMktValue = score.marketValue + unpricedCost;

    const totalPL = hasUnrealized ? score.totalPL : score.totalRealized;
    const totalPLLabel = hasUnrealized ? 'Total P&L' : 'Realized P&L';
    const returnStr = hasUnrealized ? UI.pct(score.returnPct) : null;

    // Cash total (if available)
    const cash = AppState.get('cashBalances');
    const totalCash = cash ? Object.values(cash).reduce((s, v) => s + v, 0) : 0;
    const hasCash = totalCash > 0;
    const hasMarketValue = score.hasAnyPrice;
    const totalPortfolio = (hasCash && hasMarketValue) ? displayMktValue + totalCash : null;

    let kpis = '';

    kpis += kpiItem('Deployed', UI.currency(score.totalDeployed));
    kpis += `<span class="dashboard-kpi__sep"></span>`;

    if (hasMarketValue) {
      kpis += kpiItem('Mkt Value', UI.currency(displayMktValue));
      kpis += `<span class="dashboard-kpi__sep"></span>`;
    }

    if (hasUnrealized) {
      kpis += kpiItem('Unrealized', UI.plSign(score.unrealizedPL) + UI.currency(Math.abs(score.unrealizedPL)), UI.plClass(score.unrealizedPL));
      kpis += `<span class="dashboard-kpi__sep"></span>`;
    }

    kpis += kpiItem('Realized', UI.plSign(score.totalRealized) + UI.currency(Math.abs(score.totalRealized)), UI.plClass(score.totalRealized));
    kpis += `<span class="dashboard-kpi__sep"></span>`;

    // Total P&L (hero)
    kpis += kpiItem(totalPLLabel, UI.plSign(totalPL) + UI.currency(Math.abs(totalPL)), UI.plClass(totalPL), true);

    if (returnStr) {
      kpis += `<span class="dashboard-kpi__sep"></span>`;
      kpis += kpiItem('Return', returnStr, UI.plClass(score.returnPct));
    }

    if (hasCash) {
      kpis += `<span class="dashboard-kpi__sep"></span>`;
      kpis += kpiItem('Cash', UI.currency(totalCash));
    }

    if (totalPortfolio != null) {
      kpis += `<span class="dashboard-kpi__sep"></span>`;
      kpis += kpiItem('Total Portfolio', UI.currency(totalPortfolio));
    }

    // Meta row
    const meta = `<div class="dashboard-kpi-meta">
      <span>${kpi.positionsTotal} positions &middot; ${txCount} transactions</span>
      <a class="dashboard-kpi-meta__link" href="#analysis/overview">Detailed view &rarr;</a>
    </div>`;

    return `<div class="dashboard-kpi-strip">${kpis}${meta}</div>`;
  }

  function kpiItem(label, value, colorClass, hero) {
    const heroClass = hero ? ' dashboard-kpi--hero' : '';
    const cls = colorClass ? ` ${colorClass}` : '';
    return `<div class="dashboard-kpi${heroClass}">
      <span class="dashboard-kpi__label">${label}</span>
      <span class="dashboard-kpi__value${cls}">${value}</span>
    </div>`;
  }

  function renderUnpricedDisclaimer(unpriced) {
    const totalCost = unpriced.reduce((s, p) => s + p.totalCost, 0);
    const symbols = unpriced.map(p => Config.getDisplayName(p.symbol)).join(', ');
    return `
      <div class="unpriced-disclaimer">
        <div class="unpriced-disclaimer__icon">!</div>
        <div class="unpriced-disclaimer__body">
          <div class="unpriced-disclaimer__title">${unpriced.length} position${unpriced.length > 1 ? 's' : ''} without live prices</div>
          <div class="unpriced-disclaimer__text">
            <span class="unpriced-disclaimer__symbols">${symbols}</span>
            <span class="unpriced-disclaimer__cost">${UI.currency(totalCost)} at cost basis</span>
          </div>
          <div class="unpriced-disclaimer__note">Market Value, Unrealized P&L, and allocation charts only reflect priced positions.</div>
        </div>
      </div>
    `;
  }

  function renderAllocationType(alloc) {
    const types = Object.keys(alloc);
    const values = Object.values(alloc);
    if (types.length === 0) return;
    const labels = types.map(t => Config.getTypeLabel(t));
    const colors = types.map(t => Config.getTypeColor(t));
    Charts.doughnut('chart-alloc-type', labels, values, colors);
  }

  function renderAllocationSymbol(alloc) {
    // Sort by value, top 10 + "Other"
    const entries = Object.entries(alloc).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) return;
    const top = entries.slice(0, 10);
    const other = entries.slice(10).reduce((sum, [, v]) => sum + v, 0);
    if (other > 0) top.push(['Other', other]);

    const symbols = top.map(([k]) => k);
    const labels = symbols.map(s => s === 'Other' ? 'Other' : Config.getDisplayName(s));
    const values = top.map(([, v]) => v);
    const colors = symbols.map(s => s === 'Other' ? '#484f58' : Config.getSymbolColor(s));
    Charts.doughnut('chart-alloc-symbol', labels, values, colors);
  }

  // Store the current chart instance ID for updating
  let capitalChartInstance = null;

  // Cache fetched price histories so they survive navigation.
  // Keyed by raw transaction count — invalidates only when new data is loaded.
  let cachedPriceHistories = null;
  let cachedTxCount = -1;

  function renderCapitalTimeline(timeline) {
    const container = document.getElementById('dashboard-capital-container');
    if (!container) return;

    if (timeline.length === 0) {
      container.innerHTML = `
        <div class="chart-empty-state">
          <div class="chart-empty-state__icon">\u{1F4C8}</div>
          <div class="chart-empty-state__text">No transactions in this period</div>
          <div class="chart-empty-state__hint">Try adjusting your date filters.</div>
        </div>`;
      return;
    }

    // Ensure canvas exists
    if (!document.getElementById('chart-capital-timeline')) {
      container.innerHTML = '<canvas id="chart-capital-timeline"></canvas>';
    }

    const labels = timeline.map(p => p.date);
    const data = timeline.map(p => p.cumulative);

    capitalChartInstance = Charts.create('chart-capital-timeline', {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Capital Invested',
          data,
          borderColor: '#58a6ff',
          backgroundColor: 'rgba(88,166,255,0.12)',
          fill: true,
          tension: 0.3,
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
          x: {
            grid: { display: false },
            ticks: { maxTicksLimit: 12 },
          },
          y: {
            ticks: { callback: v => UI.currencyCompact(v) },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: ${UI.currency(ctx.parsed.y)}`,
            },
          },
        },
      },
    });
  }

  async function loadPortfolioValueLine(transactions) {
    if (!transactions.length) return;

    const legendEl = document.getElementById('portfolio-chart-legend');

    // Use ALL raw transactions (unfiltered) to determine which symbols need histories.
    // This way we fetch once for the full portfolio and reuse across filter changes.
    const rawTxs = AppState.get('rawTransactions');
    const rawCount = rawTxs.length;
    const allSymbols = [...new Set(rawTxs.map(tx => tx.symbol))];
    const pricedSymbols = allSymbols.filter(s => Config.getYahooTicker(s));

    if (pricedSymbols.length === 0) return;

    try {
      let priceHistories;

      if (cachedPriceHistories && cachedTxCount === rawCount) {
        // Cache hit — skip network entirely
        priceHistories = cachedPriceHistories;
      } else {
        // Cache miss — fetch all histories (the slow part)
        priceHistories = await API.fetchAllHistories(pricedSymbols, '5y');
        cachedPriceHistories = priceHistories;
        cachedTxCount = rawCount;
      }

      // Check that the chart container still exists (user may have navigated away)
      if (!document.getElementById('dashboard-capital-container')) return;

      // Recompute the value timeline with the CURRENT filtered transactions (instant CPU work)
      const valueTimeline = Portfolio.portfolioValueTimeline(transactions, priceHistories);

      if (valueTimeline.length === 0) return;

      // Get the existing chart instance
      const chart = capitalChartInstance;
      if (!chart) return;

      // Build the portfolio value dataset aligned to the chart's existing labels
      const chartLabels = chart.data.labels;

      // Build a date->value lookup from the value timeline
      const valueLookup = {};
      for (const p of valueTimeline) {
        valueLookup[p.date] = p.value;
      }

      // Create a unified date grid (union of chart labels + value timeline dates)
      const allDates = [...new Set([...chartLabels, ...valueTimeline.map(p => p.date)])].sort();

      // Rebuild invested data aligned to the unified grid (forward-fill from capital timeline)
      const capTimeline = Portfolio.capitalTimeline(transactions);
      const capitalLookup = {};
      for (const p of capTimeline) capitalLookup[p.date] = p.cumulative;

      let lastInvested = 0;
      let lastValue = null;
      const unifiedInvested = [];
      const unifiedValue = [];

      for (const date of allDates) {
        if (capitalLookup[date] != null) lastInvested = capitalLookup[date];
        unifiedInvested.push(lastInvested);

        if (valueLookup[date] != null) lastValue = valueLookup[date];
        unifiedValue.push(lastValue);
      }

      // Update chart with unified data
      chart.data.labels = allDates;
      chart.data.datasets[0].data = unifiedInvested;

      // Add portfolio value dataset
      chart.data.datasets.push({
        label: 'Portfolio Value',
        data: unifiedValue,
        borderColor: '#3fb950',
        backgroundColor: 'rgba(63,185,80,0.08)',
        fill: false,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 2,
        spanGaps: true,
      });

      // Update tooltip to show P&L
      chart.options.plugins.tooltip.callbacks.label = (ctx) => {
        const label = ctx.dataset.label;
        const val = ctx.parsed.y;
        if (val == null) return null;
        return ` ${label}: ${UI.currency(val)}`;
      };
      chart.options.plugins.tooltip.callbacks.afterBody = (tooltipItems) => {
        const investedItem = tooltipItems.find(i => i.datasetIndex === 0);
        const valueItem = tooltipItems.find(i => i.datasetIndex === 1);
        if (investedItem && valueItem && valueItem.parsed.y != null) {
          const pl = valueItem.parsed.y - investedItem.parsed.y;
          const sign = pl >= 0 ? '+' : '-';
          return ` P&L: ${sign}${UI.currency(Math.abs(pl))}`;
        }
        return '';
      };

      chart.update();

      // Show legend
      if (legendEl) legendEl.style.display = '';

    } catch (e) {
      console.warn('Portfolio value timeline failed:', e);
    }
  }

  return { render };
})();
