/* ── Dashboard View: Scoreboard + KPIs + Allocation + Timeline ── */
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

    container.innerHTML = `
      ${renderScoreboard(score, kpi, txs.length)}

      ${unpriced.length > 0 ? renderUnpricedDisclaimer(unpriced) : ''}

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

      <div class="chart-wrap" style="margin-top: var(--sp-4);">
        <div class="chart-wrap__header">
          <span class="chart-wrap__title">Portfolio Over Time</span>
          <span id="portfolio-chart-loading" class="chart-loading-status" style="display:none;">
            <span class="chart-loading-status__spinner"></span>
            <span id="portfolio-chart-loading-text">Loading portfolio value...</span>
          </span>
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
    `;

    // Scoreboard hover interactivity
    setupScoreboardHover();

    // Render charts
    renderAllocationType(allocType);
    renderAllocationSymbol(allocSymbol);
    renderCapitalTimeline(timeline);

    // Async: load portfolio value line
    loadPortfolioValueLine(txs);
  }

  function setupScoreboardHover() {
    const sb = document.querySelector('.scoreboard');
    if (!sb) return;

    const items = sb.querySelectorAll('[data-group]');

    items.forEach(el => {
      el.addEventListener('mouseenter', () => {
        const g = el.dataset.group;
        sb.classList.add('sb-active');

        if (g === 'total') {
          // Highlight deployed bar + P&L segments + total stat
          sb.querySelectorAll('[data-group="deployed"]')
            .forEach(e => e.classList.add('sb-hl'));
          sb.querySelectorAll('.scoreboard__seg--gain, .scoreboard__seg--loss')
            .forEach(e => e.classList.add('sb-hl'));
          el.classList.add('sb-hl');
        } else {
          sb.querySelectorAll(`[data-group="${g}"]`)
            .forEach(e => e.classList.add('sb-hl'));
        }
      });

      el.addEventListener('mouseleave', () => {
        sb.classList.remove('sb-active');
        items.forEach(e => e.classList.remove('sb-hl'));
      });
    });
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

  function renderScoreboard(score, kpi, txCount) {
    const proceeds = score.totalProceeds;
    const hasUnrealized = score.unrealizedPL != null;
    const unpricedCost = score.costBasis - score.costBasisPriced;
    const displayMktValue = score.marketValue + unpricedCost;

    // Visual cost of sold (ensures Sold + Holding = Deployed in the diagram)
    const costOfSold = Math.max(0, score.totalDeployed - score.costBasis);
    const realizedPct = costOfSold > 0 ? (score.totalRealized / costOfSold) * 100 : 0;
    const unrealizedPct = hasUnrealized && score.costBasisPriced > 0
      ? (score.unrealizedPL / score.costBasisPriced) * 100 : null;
    const fCB = Math.max(1, score.costBasis);
    const fDeployed = costOfSold + fCB;

    const realGain = score.totalRealized >= 0;
    const fRealPL = Math.min(fDeployed * 0.3, Math.abs(score.totalRealized));

    const unrealGain = hasUnrealized ? score.unrealizedPL >= 0 : false;
    const fUnrealPL = hasUnrealized
      ? Math.min(fDeployed * 0.3, Math.abs(score.unrealizedPL)) : 0;

    const fTopPad = realGain ? fRealPL : 0;
    const fBotPad = (hasUnrealized && unrealGain) ? fUnrealPL : 0;

    // Guide line positions — calc() accounts for the 3 × 2px gaps in the flex container.
    // Each guide's bottom = ratio × (100% − 6px) + gapOffset, where gapOffset counts
    // how many gaps sit below that guide line.
    const totalF = fTopPad + fDeployed + fBotPad;
    const GAP_TOTAL = 6; // 3 gaps × 2px
    const rCB  = totalF > 0 ? (fBotPad + fCB) / totalF : 0;
    const rDep = totalF > 0 ? (fBotPad + fDeployed) / totalF : 0;
    // guideCB: top of the CB segment (1 gap below it → +2px)
    const guideCBCalc = `calc(${(rCB * 100).toFixed(2)}% + ${(2 - rCB * GAP_TOTAL).toFixed(2)}px)`;
    // guideDeployed: top of the sold-deployed segment (2 gaps below → +4px).
    // When costOfSold=0 the sold half collapses, so both guides coincide.
    const guideDeployedCalc = costOfSold > 0
      ? `calc(${(rDep * 100).toFixed(2)}% + ${(4 - rDep * GAP_TOTAL).toFixed(2)}px)`
      : guideCBCalc;

    // Collapse style for zero-height items
    const ZERO = 'flex:0 0 0;min-height:0;padding:0;overflow:hidden;';

    // ── Column 1: Always 4 items to match Column 2 ──
    // Split Deployed into sold-portion + hold-portion so gap count matches.
    // box-shadow on the top half bridges the 2px gap so they look like one block.
    const hasSoldPortion = costOfSold > 0;
    const mergeTop = hasSoldPortion
      ? 'border-radius:3px 3px 0 0;box-shadow:0 2px 0 0 var(--accent);position:relative;z-index:1;' : '';
    const mergeBot = hasSoldPortion ? 'border-radius:0 0 3px 3px;' : '';

    const col1HTML = `
      <div class="scoreboard__blocks-seg" style="${fTopPad > 0 ? `flex:${fTopPad} 0 0;` : ZERO}"></div>
      <div class="scoreboard__blocks-seg" data-group="deployed" style="${hasSoldPortion ? `flex:${costOfSold} 0 0;` : ZERO}background:var(--accent);${mergeTop}"></div>
      <div class="scoreboard__blocks-seg" data-group="deployed" style="flex:${fCB} 0 0;background:var(--accent);${mergeBot}">
        <span class="scoreboard__blocks-seg-name">Deployed</span>
        <span class="scoreboard__blocks-seg-val">${UI.currency(score.totalDeployed)}</span>
      </div>
      <div class="scoreboard__blocks-seg" style="${fBotPad > 0 ? `flex:${fBotPad} 0 0;` : ZERO}"></div>
    `;

    // ── Column 2: Always 4 items ──
    let col2HTML = '';

    // Item 1: Top P&L (or empty placeholder)
    if (fRealPL > 0) {
      const plClass = realGain ? 'scoreboard__seg--gain' : 'scoreboard__seg--loss';
      const plColor = realGain ? '#3fb950' : '#f85149';
      col2HTML += `<div class="scoreboard__blocks-seg ${plClass}" data-group="sold" style="flex:${fRealPL} 0 0;">
        <span class="scoreboard__blocks-seg-val" style="color:${plColor};">${UI.plSign(score.totalRealized)}${UI.currency(Math.abs(score.totalRealized))}</span>
      </div>`;
    } else {
      col2HTML += `<div class="scoreboard__blocks-seg" style="${ZERO}"></div>`;
    }

    // Item 2: Sold block
    const fSoldVis = realGain ? costOfSold : Math.max(1, costOfSold - fRealPL);
    col2HTML += `<div class="scoreboard__blocks-seg" data-group="sold" style="flex:${fSoldVis} 0 0;background:#484f58;">
      <span class="scoreboard__blocks-seg-name">Sold</span>
      <span class="scoreboard__blocks-seg-val">${UI.currency(costOfSold)}</span>
    </div>`;

    // Item 3: Holding block
    const fHoldVis = (!hasUnrealized || unrealGain) ? fCB : Math.max(1, fCB - fUnrealPL);
    col2HTML += `<div class="scoreboard__blocks-seg" data-group="open" style="flex:${fHoldVis} 0 0;background:rgba(88,166,255,0.5);">
      <span class="scoreboard__blocks-seg-name">Holding</span>
      <span class="scoreboard__blocks-seg-val">${UI.currency(score.costBasis)}</span>
    </div>`;

    // Item 4: Bottom P&L (or empty placeholder)
    if (hasUnrealized && fUnrealPL > 0) {
      const plClass = unrealGain ? 'scoreboard__seg--gain' : 'scoreboard__seg--loss';
      const plColor = unrealGain ? '#3fb950' : '#f85149';
      col2HTML += `<div class="scoreboard__blocks-seg ${plClass}" data-group="open" style="flex:${fUnrealPL} 0 0;">
        <span class="scoreboard__blocks-seg-val" style="color:${plColor};">${UI.plSign(score.unrealizedPL)}${UI.currency(Math.abs(score.unrealizedPL))}</span>
      </div>`;
    } else {
      col2HTML += `<div class="scoreboard__blocks-seg" style="${ZERO}"></div>`;
    }

    return `
      <div class="scoreboard">
        <div class="scoreboard__header">
          <span class="scoreboard__title">Investment Scoreboard</span>
          ${UI.helpBtn('scoreboard')}
          <span class="scoreboard__meta">
            ${kpi.positionsTotal} positions (${kpi.positionsPriced} priced) ${UI.helpBtn('positions-priced')}
            &middot; ${txCount} transactions
          </span>
        </div>

        <div class="scoreboard__body">
          <div class="scoreboard__visual">
            <div class="scoreboard__blocks-area">
              <div class="scoreboard__blocks-stack">${col1HTML}</div>
              <div class="scoreboard__blocks-stack">${col2HTML}</div>
            </div>
            <div class="scoreboard__col-labels">
              <span>Deployed</span>
              <span>Breakdown</span>
            </div>
          </div>

          <div class="scoreboard__stats">
            <div class="scoreboard__stat-deployed" data-group="deployed">
              <div class="scoreboard__stat-row">
                <span>Total Deployed</span>
                <span class="mono">${UI.currency(score.totalDeployed)}</span>
              </div>
            </div>

            <div class="scoreboard__stat-group" data-group="sold">
              <div class="scoreboard__stat-head">Sold positions</div>
              <div class="scoreboard__stat-row">
                <span>Cost</span>
                <span class="mono">${UI.currency(costOfSold)}</span>
              </div>
              <div class="scoreboard__stat-row">
                <span>Proceeds</span>
                <span class="mono">${UI.currency(proceeds)}</span>
              </div>
              <div class="scoreboard__stat-row scoreboard__stat-row--hl">
                <span>Realized P&L</span>
                <span class="mono ${UI.plClass(score.totalRealized)}">${UI.currency(score.totalRealized)} <small>(${UI.pct(realizedPct)})</small></span>
              </div>
            </div>

            <div class="scoreboard__stat-group" data-group="open">
              <div class="scoreboard__stat-head">Open positions</div>
              <div class="scoreboard__stat-row">
                <span>Cost basis</span>
                <span class="mono">${UI.currency(score.costBasis)}</span>
              </div>
              <div class="scoreboard__stat-row">
                <span>Mkt Value${unpricedCost > 0 && score.hasAnyPrice ? '*' : ''}</span>
                <span class="mono">${score.hasAnyPrice ? UI.currency(displayMktValue) : '<span style="color:var(--text-muted);">N/A</span>'}</span>
              </div>
              <div class="scoreboard__stat-row scoreboard__stat-row--hl">
                <span>Unrealized P&L</span>
                ${hasUnrealized
                  ? `<span class="mono ${UI.plClass(score.unrealizedPL)}">${UI.currency(score.unrealizedPL)} <small>(${UI.pct(unrealizedPct)})</small></span>`
                  : `<span style="color:var(--text-muted);">N/A</span>`}
              </div>
            </div>

            <div class="scoreboard__stat-total" data-group="total">
              <div class="scoreboard__stat-row">
                <span>Total P&L</span>
                ${hasUnrealized
                  ? `<span class="mono ${UI.plClass(score.totalPL)}" style="font-weight:700;">${UI.currency(score.totalPL)}</span>`
                  : `<span class="mono ${UI.plClass(score.totalRealized)}" style="font-weight:700;">${UI.currency(score.totalRealized)}</span>`}
              </div>
              <div class="scoreboard__stat-row">
                <span>Return</span>
                ${hasUnrealized
                  ? `<span class="mono ${UI.plClass(score.returnPct)}" style="font-weight:700;">${UI.pct(score.returnPct)}</span>`
                  : `<span style="color:var(--text-muted);">Realized only</span>`}
              </div>
            </div>
          </div>
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

    const loadingEl = document.getElementById('portfolio-chart-loading');
    const loadingTextEl = document.getElementById('portfolio-chart-loading-text');
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
        if (loadingEl) loadingEl.style.display = '';
        priceHistories = await API.fetchAllHistories(pricedSymbols, '5y', (fetched, total) => {
          if (loadingTextEl) loadingTextEl.textContent = `Loading prices... ${fetched}/${total}`;
        });
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

      // Show legend, hide loading
      if (legendEl) legendEl.style.display = '';
      if (loadingEl) loadingEl.style.display = 'none';

    } catch (e) {
      console.warn('Portfolio value timeline failed:', e);
      // Graceful degradation: invested-only chart remains
      if (loadingEl) loadingEl.style.display = 'none';
    }
  }

  return { render };
})();
