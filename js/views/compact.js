/* ── Compact View: Command Center - everything on one screen ── */
const CompactView = (() => {

  function render(container) {
    const txs = AppState.filteredTransactions();
    const baseTxs = AppState.filteredTransactions({ skipTypeFilter: true });
    const holdings = Portfolio.computeHoldings(baseTxs);
    const typeFilter = AppState.getFilters().types;
    const typeFiltered = typeFilter.length > 0 ? holdings.filter(h => typeFilter.includes(h.type)) : holdings;
    const priced = Portfolio.applyPrices(typeFiltered, AppState.get('livePrices'));
    const kpi = Portfolio.computeKPIs(priced);
    const score = Portfolio.computeScoreboard(txs, priced);
    const allocType = Portfolio.allocationByType(priced);
    const allocSymbol = Portfolio.allocationBySymbol(priced);
    const timeline = Portfolio.capitalTimeline(txs);
    const cash = AppState.get('cashBalances');
    const totalCash = cash ? Object.values(cash).reduce((s, v) => s + v, 0) : 0;

    // Top 15 holdings sorted by market value
    const activeHoldings = priced
      .filter(h => h.quantity > 0.001)
      .sort((a, b) => (b.marketValue || b.totalCost) - (a.marketValue || a.totalCost))
      .slice(0, 15);

    const unpricedCost = score.costBasis - score.costBasisPriced;
    const displayMktValue = score.marketValue + unpricedCost;
    const hasUnrealized = score.unrealizedPL != null;

    container.innerHTML = `
      <div class="compact">
        <div class="compact__header">
          <span class="compact__title">Command Center</span>
          ${UI.helpBtn('compact-view')}
        </div>

        <div class="compact__kpi-strip">
          <div class="compact__kpi">
            <span class="compact__kpi-label">Deployed</span>
            <span class="compact__kpi-value">${UI.currencyCompact(score.totalDeployed)}</span>
          </div>
          <div class="compact__kpi">
            <span class="compact__kpi-label">Mkt Value</span>
            <span class="compact__kpi-value">${score.hasAnyPrice ? UI.currencyCompact(displayMktValue) : 'N/A'}</span>
          </div>
          <div class="compact__kpi">
            <span class="compact__kpi-label">Unrealized</span>
            <span class="compact__kpi-value ${hasUnrealized ? UI.plClass(score.unrealizedPL) : ''}">${hasUnrealized ? UI.currencyCompact(score.unrealizedPL) : 'N/A'}</span>
          </div>
          <div class="compact__kpi">
            <span class="compact__kpi-label">Realized</span>
            <span class="compact__kpi-value ${UI.plClass(score.totalRealized)}">${UI.currencyCompact(score.totalRealized)}</span>
          </div>
          <div class="compact__kpi">
            <span class="compact__kpi-label">Total P&L</span>
            <span class="compact__kpi-value ${hasUnrealized ? UI.plClass(score.totalPL) : UI.plClass(score.totalRealized)}">${hasUnrealized ? UI.currencyCompact(score.totalPL) : UI.currencyCompact(score.totalRealized)}</span>
          </div>
          <div class="compact__kpi">
            <span class="compact__kpi-label">Return</span>
            <span class="compact__kpi-value ${hasUnrealized ? UI.plClass(score.returnPct) : ''}">${hasUnrealized ? UI.pct(score.returnPct) : '---'}</span>
          </div>
          <div class="compact__kpi">
            <span class="compact__kpi-label">Positions</span>
            <span class="compact__kpi-value">${kpi.positionsTotal}</span>
          </div>
          <div class="compact__kpi">
            <span class="compact__kpi-label">Cash</span>
            <span class="compact__kpi-value">${totalCash > 0 ? UI.currencyCompact(totalCash) : '---'}</span>
          </div>
        </div>

        <div class="compact__grid">
          <div class="compact__cell">
            <div class="compact__cell-title">Type Allocation</div>
            <div class="compact__chart-container">
              <canvas id="compact-alloc-type"></canvas>
            </div>
          </div>
          <div class="compact__cell">
            <div class="compact__cell-title">Asset Allocation</div>
            <div class="compact__chart-container">
              <canvas id="compact-alloc-symbol"></canvas>
            </div>
          </div>
          <div class="compact__cell">
            <div class="compact__cell-title">Capital Timeline</div>
            <div class="compact__chart-container">
              <canvas id="compact-timeline"></canvas>
            </div>
          </div>
          <div class="compact__cell compact__cell--table">
            <div class="compact__cell-title">Top ${activeHoldings.length} Holdings</div>
            <div class="compact__table-wrap">
              <table class="compact__table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th class="right">Value</th>
                    <th class="right">P&L</th>
                    <th class="right">%</th>
                  </tr>
                </thead>
                <tbody>
                  ${activeHoldings.map(h => {
                    const val = h.marketValue || h.totalCost;
                    const pl = h.unrealized != null ? h.unrealized : null;
                    const pct = h.unrealizedPct != null ? h.unrealizedPct : null;
                    return `<tr>
                      <td class="compact__symbol clickable" data-symbol="${h.symbol}">${Config.getDisplayName(h.symbol)}</td>
                      <td class="right mono">${UI.currencyCompact(val)}</td>
                      <td class="right mono ${pl != null ? UI.plClass(pl) : ''}">${pl != null ? UI.currencyCompact(pl) : '---'}</td>
                      <td class="right mono ${pct != null ? UI.plClass(pct) : ''}">${pct != null ? UI.pct(pct) : '---'}</td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;

    // Render mini charts
    renderMiniAllocType(allocType);
    renderMiniAllocSymbol(allocSymbol);
    renderMiniTimeline(timeline);

    // Table click handlers
    container.querySelectorAll('.compact__symbol').forEach(el => {
      el.addEventListener('click', () => Router.navigate('market', el.dataset.symbol));
    });
  }

  function renderMiniAllocType(alloc) {
    const types = Object.keys(alloc);
    const values = Object.values(alloc);
    if (types.length === 0) return;
    const labels = types.map(t => Config.getTypeLabel(t));
    const colors = types.map(t => Config.getTypeColor(t));

    Charts.create('compact-alloc-type', {
      type: 'doughnut',
      data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 0 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: { legend: { display: false }, tooltip: { enabled: true } },
      },
    });
  }

  function renderMiniAllocSymbol(alloc) {
    const entries = Object.entries(alloc).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) return;
    const top = entries.slice(0, 8);
    const other = entries.slice(8).reduce((sum, [, v]) => sum + v, 0);
    if (other > 0) top.push(['Other', other]);

    const symbols = top.map(([k]) => k);
    const labels = symbols.map(s => s === 'Other' ? 'Other' : Config.getDisplayName(s));
    const values = top.map(([, v]) => v);
    const colors = symbols.map(s => s === 'Other' ? '#484f58' : Config.getSymbolColor(s));

    Charts.create('compact-alloc-symbol', {
      type: 'doughnut',
      data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 0 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: { legend: { display: false }, tooltip: { enabled: true } },
      },
    });
  }

  function renderMiniTimeline(timeline) {
    if (timeline.length === 0) return;
    const labels = timeline.map(p => p.date);
    const data = timeline.map(p => p.cumulative);

    Charts.create('compact-timeline', {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data,
          borderColor: '#58a6ff',
          backgroundColor: 'rgba(88,166,255,0.12)',
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 1.5,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        scales: {
          x: { display: false },
          y: {
            display: true,
            ticks: { maxTicksLimit: 3, callback: v => UI.currencyCompact(v), font: { size: 9 } },
            grid: { color: 'rgba(139,148,158,0.1)' },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => UI.currency(ctx.parsed.y) } },
        },
      },
    });
  }

  return { render };
})();
