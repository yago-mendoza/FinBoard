/* ── Analysis View: Aggregations by platform, type, period ── */
const AnalysisView = (() => {

  let activeTab = 'platform';
  let selectedYear = 'all';

  function render(container) {
    container.innerHTML = `
      <div class="tabs">
        <button class="tab ${activeTab === 'platform' ? 'active' : ''}" data-tab="platform">By Platform</button>
        <button class="tab ${activeTab === 'type' ? 'active' : ''}" data-tab="type">By Type</button>
        <button class="tab ${activeTab === 'period' ? 'active' : ''}" data-tab="period">By Period</button>
        <button class="tab ${activeTab === 'pnl' ? 'active' : ''}" data-tab="pnl">P&L Distribution</button>
      </div>
      <div id="analysis-content"></div>
    `;

    // Tab click handlers
    container.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        activeTab = tab.dataset.tab;
        container.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        renderTab(document.getElementById('analysis-content'));
      });
    });

    renderTab(document.getElementById('analysis-content'));
  }

  function renderTab(el) {
    Charts.destroyAll();
    switch (activeTab) {
      case 'platform': renderByPlatform(el); break;
      case 'type': renderByType(el); break;
      case 'period': renderByPeriod(el); break;
      case 'pnl': renderPnLDist(el); break;
    }
  }

  // ── By Platform ──
  function renderByPlatform(el) {
    const txs = AppState.filteredTransactions();
    const platforms = Portfolio.aggregateByPlatform(txs);

    if (txs.length === 0) {
      el.innerHTML = `
        <div class="chart-empty-state">
          <div class="chart-empty-state__icon">\u{1F4CA}</div>
          <div class="chart-empty-state__text">No transactions match current filters</div>
          <div class="chart-empty-state__hint">Try adjusting your platform, type, or date filters.</div>
        </div>`;
      return;
    }

    el.innerHTML = `
      <div class="grid-2">
        <div class="chart-wrap">
          <div class="chart-wrap__header">
            <span class="chart-wrap__title">Invested by Platform</span>
            ${UI.helpBtn('by-platform')}
          </div>
          <div class="chart-canvas-container chart-canvas-container--doughnut">
            <canvas id="chart-platform"></canvas>
          </div>
        </div>
        <div class="card">
          <div class="table-wrap" style="border:none;">
            <table class="table">
              <thead>
                <tr>
                  <th>Platform</th>
                  <th class="right">Invested</th>
                  <th class="right">Proceeds</th>
                  <th class="right">Net</th>
                  <th class="right">Txs</th>
                  <th class="right">Assets</th>
                </tr>
              </thead>
              <tbody>
                ${platforms.sort((a, b) => b.invested - a.invested).map(p => `
                  <tr>
                    <td>${Config.getPlatformLabel(p.platform)}</td>
                    <td class="right mono">${UI.currency(p.invested)}</td>
                    <td class="right mono">${UI.currency(p.proceeds)}</td>
                    <td class="right mono">${UI.currency(p.net)}</td>
                    <td class="right mono">${p.txCount}</td>
                    <td class="right mono">${p.symbols.length}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    const labels = platforms.map(p => Config.getPlatformLabel(p.platform));
    const values = platforms.map(p => p.invested);
    const colors = platforms.map(p => Config.getPlatformColor(p.platform));
    Charts.doughnut('chart-platform', labels, values, colors);
  }

  // ── By Type ──
  function renderByType(el) {
    const baseTxs = AppState.filteredTransactions({ skipTypeFilter: true });
    const holdings = Portfolio.computeHoldings(baseTxs);
    const typeFilter = AppState.getFilters().types;
    const typeFiltered = typeFilter.length > 0 ? holdings.filter(h => typeFilter.includes(h.type)) : holdings;
    const priced = Portfolio.applyPrices(typeFiltered, AppState.get('livePrices'));

    // Group by type
    const types = {};
    for (const h of priced) {
      if (h.quantity <= 0) continue;
      const t = h.type;
      if (!types[t]) types[t] = { type: t, invested: 0, value: 0, unrealized: null, realized: 0, count: 0 };
      types[t].invested += h.totalCost;
      if (h.marketValue != null) types[t].value += h.marketValue;
      else types[t].value += h.totalCost; // fallback for table only, chart uses allocationByType
      if (h.unrealized != null) types[t].unrealized = (types[t].unrealized || 0) + h.unrealized;
      types[t].realized += h.realized;
      types[t].count++;
    }
    const typeArr = Object.values(types).sort((a, b) => b.value - a.value);

    if (typeArr.length === 0) {
      el.innerHTML = `
        <div class="chart-empty-state">
          <div class="chart-empty-state__icon">\u{1F4CA}</div>
          <div class="chart-empty-state__text">No active positions match current filters</div>
          <div class="chart-empty-state__hint">Try adjusting your filters or clearing them.</div>
        </div>`;
      return;
    }

    el.innerHTML = `
      <div class="grid-2">
        <div class="chart-wrap">
          <div class="chart-wrap__header">
            <span class="chart-wrap__title">Value by Type</span>
            ${UI.helpBtn('by-type')}
          </div>
          <div class="chart-canvas-container chart-canvas-container--doughnut">
            <canvas id="chart-type"></canvas>
          </div>
        </div>
        <div class="card">
          <div class="table-wrap" style="border:none;">
            <table class="table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th class="right">Positions</th>
                  <th>Invested</th>
                  <th class="right">Value</th>
                  <th class="right">Unrealized</th>
                  <th class="right">Realized</th>
                </tr>
              </thead>
              <tbody>
                ${typeArr.map(t => `
                  <tr>
                    <td>${UI.typeBadge(t.type)}</td>
                    <td class="right mono">${t.count}</td>
                    <td class="right mono">${UI.currency(t.invested)}</td>
                    <td class="right mono">${UI.currency(t.value)}</td>
                    <td class="right mono ${t.unrealized != null ? UI.plClass(t.unrealized) : ''}">${t.unrealized != null ? UI.plSign(t.unrealized) + UI.currency(t.unrealized) : '<span style="color:var(--text-muted);">N/A</span>'}</td>
                    <td class="right mono ${UI.plClass(t.realized)}">${UI.plSign(t.realized)}${UI.currency(t.realized)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    Charts.doughnut('chart-type',
      typeArr.map(t => Config.getTypeLabel(t.type)),
      typeArr.map(t => t.value),
      typeArr.map(t => Config.getTypeColor(t.type))
    );
  }

  // ── By Period ──
  function renderByPeriod(el) {
    const txs = AppState.filteredTransactions();
    const monthly = Portfolio.monthlyActivity(txs);

    // Yearly aggregation
    const yearly = {};
    for (const m of monthly) {
      const year = m.month.slice(0, 4);
      if (!yearly[year]) yearly[year] = { year, buys: 0, sells: 0, buyAmount: 0, sellAmount: 0, txCount: 0 };
      yearly[year].buys += m.buys;
      yearly[year].sells += m.sells;
      yearly[year].buyAmount += m.buyAmount;
      yearly[year].sellAmount += m.sellAmount;
      yearly[year].txCount += m.txCount;
    }
    const allYearArr = Object.values(yearly).sort((a, b) => a.year.localeCompare(b.year));
    const availableYears = allYearArr.map(y => y.year);

    // Filter by selected year
    const yearArr = selectedYear === 'all' ? allYearArr : allYearArr.filter(y => y.year === selectedYear);

    // Build year selector
    const yearBtns = ['all', ...availableYears].map(y =>
      `<button class="btn btn--ghost btn--sm ${selectedYear === y ? 'active' : ''}" data-period-year="${y}">${y === 'all' ? 'All' : y}</button>`
    ).join('');

    if (allYearArr.length === 0) {
      el.innerHTML = `
        <div class="chart-empty-state">
          <div class="chart-empty-state__icon">\u{1F4C5}</div>
          <div class="chart-empty-state__text">No transaction data for the selected period</div>
          <div class="chart-empty-state__hint">Try changing the date range or clearing your filters.</div>
        </div>`;
      return;
    }

    el.innerHTML = `
      <div class="year-selector">${yearBtns}</div>
      <div class="chart-wrap">
        <div class="chart-wrap__header">
          <span class="chart-wrap__title">Yearly Investment Flow</span>
          ${UI.helpBtn('by-period')}
        </div>
        <div class="chart-canvas-container chart-canvas-container--md" id="yearly-chart-container">
          ${yearArr.length > 0 ? '<canvas id="chart-yearly"></canvas>' : ''}
        </div>
      </div>
      <div class="card" style="margin-top: var(--sp-4);">
        <div class="table-wrap" style="border:none;">
          <table class="table">
            <thead>
              <tr>
                <th>Year</th>
                <th class="right">Transactions</th>
                <th class="right">Buy Amount</th>
                <th class="right">Sell Amount</th>
                <th class="right">Net Invested</th>
              </tr>
            </thead>
            <tbody>
              ${yearArr.length === 0 ? `<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">No data for ${selectedYear}</td></tr>` :
                yearArr.map(y => `
                <tr>
                  <td class="mono">${y.year}</td>
                  <td class="right mono">${y.txCount}</td>
                  <td class="right mono negative">${UI.currency(y.buyAmount)}</td>
                  <td class="right mono positive">${y.sellAmount > 0 ? UI.currency(y.sellAmount) : '\u2014'}</td>
                  <td class="right mono">${UI.currency(y.buyAmount - y.sellAmount)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Year selector handlers
    el.querySelectorAll('[data-period-year]').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedYear = btn.dataset.periodYear;
        renderTab(el);
      });
    });

    if (yearArr.length > 0) {
      Charts.bar('chart-yearly',
        yearArr.map(y => y.year),
        [
          { label: 'Bought', data: yearArr.map(y => y.buyAmount), backgroundColor: 'rgba(63,185,80,0.6)', borderRadius: 4 },
          { label: 'Sold', data: yearArr.map(y => y.sellAmount), backgroundColor: 'rgba(248,81,73,0.6)', borderRadius: 4 },
        ]
      );
    }
  }

  // ── P&L Distribution ──
  function renderPnLDist(el) {
    const baseTxs = AppState.filteredTransactions({ skipTypeFilter: true });
    const holdings = Portfolio.computeHoldings(baseTxs);
    const typeFilter = AppState.getFilters().types;
    const typeFiltered = typeFilter.length > 0 ? holdings.filter(h => typeFilter.includes(h.type)) : holdings;
    const priced = Portfolio.applyPrices(typeFiltered, AppState.get('livePrices'));
    const active = priced.filter(h => h.quantity > 0 && h.unrealized != null)
      .sort((a, b) => b.unrealized - a.unrealized);

    const pricesLoading = AppState.get('pricesLoading');
    const livePrices = AppState.get('livePrices');
    const hasPrices = Object.keys(livePrices).length > 0;

    el.innerHTML = `
      <div class="chart-wrap">
        <div class="chart-wrap__header">
          <span class="chart-wrap__title">Unrealized P&L by Asset (Butterfly)</span>
          ${UI.helpBtn('pnl-dist')}
        </div>
        <div class="chart-canvas-container chart-canvas-container--lg" id="pnl-chart-container">
          <canvas id="chart-pnl-butterfly"></canvas>
        </div>
      </div>
    `;

    if (active.length === 0) {
      const container = document.getElementById('pnl-chart-container');
      if (container) {
        let msg, hint;
        if (pricesLoading) {
          msg = 'Waiting for live prices\u2026';
          hint = 'Prices are currently being fetched. This chart will update automatically.';
        } else if (!hasPrices) {
          msg = 'Live prices not loaded';
          hint = 'Click the refresh button (\u21BB) in the top bar to fetch current prices.';
        } else if (txs.length === 0) {
          msg = 'No transactions match current filters';
          hint = 'Try adjusting your filters or clearing them.';
        } else {
          msg = 'No active positions with price data';
          hint = 'This chart shows unrealized P&L for open positions with live prices.';
        }
        container.innerHTML = `
          <div class="chart-empty-state">
            <div class="chart-empty-state__icon">\u{1F98B}</div>
            <div class="chart-empty-state__text">${msg}</div>
            <div class="chart-empty-state__hint">${hint}</div>
          </div>`;
      }
      return;
    }

    Charts.create('chart-pnl-butterfly', {
      type: 'bar',
      data: {
        labels: active.map(h => Config.getDisplayName(h.symbol)),
        datasets: [{
          label: 'Unrealized P&L',
          data: active.map(h => h.unrealized),
          backgroundColor: active.map(h => h.unrealized >= 0 ? 'rgba(63,185,80,0.7)' : 'rgba(248,81,73,0.7)'),
          borderRadius: 4,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { callback: v => UI.currencyCompact(v) } },
          y: { grid: { display: false } },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${UI.currency(ctx.parsed.x)} (${UI.pct(active[ctx.dataIndex].unrealizedPct)})`,
            },
          },
        },
      },
    });
  }

  return { render };
})();
