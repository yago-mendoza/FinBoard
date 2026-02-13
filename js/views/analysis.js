/* ── Analysis View: Overview, Breakdown, Timeline, P&L ── */
const AnalysisView = (() => {

  let activeTab = 'overview';
  let selectedYear = 'all';

  function render(container, params) {
    // Support deep-linking: #analysis/timeline, #analysis/compare, etc.
    if (params) {
      const validTabs = ['overview', 'breakdown', 'timeline', 'pnl'];
      if (validTabs.includes(params)) {
        activeTab = params;
      }
    }

    container.innerHTML = `
      <div class="tabs">
        <button class="tab ${activeTab === 'overview' ? 'active' : ''}" data-tab="overview">Overview</button>
        <button class="tab ${activeTab === 'breakdown' ? 'active' : ''}" data-tab="breakdown">Breakdown</button>
        <button class="tab ${activeTab === 'timeline' ? 'active' : ''}" data-tab="timeline">Timeline</button>
        <button class="tab ${activeTab === 'pnl' ? 'active' : ''}" data-tab="pnl">P&L</button>
      </div>
      <div id="analysis-content"></div>
    `;

    // Tab click handlers
    container.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        activeTab = tab.dataset.tab;
        container.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        Charts.destroyAll();
        renderTab(document.getElementById('analysis-content'));
      });
    });

    renderTab(document.getElementById('analysis-content'));
  }

  function renderTab(el) {
    switch (activeTab) {
      case 'overview': renderOverview(el); break;
      case 'breakdown': renderBreakdown(el); break;
      case 'timeline': renderTimeline(el); break;
      case 'pnl': renderPnLDist(el); break;
    }
  }

  // ── Overview: Full Scoreboard (moved from Dashboard) ──
  function renderOverview(el) {
    const txs = AppState.filteredTransactions();
    const baseTxs = AppState.filteredTransactions({ skipTypeFilter: true });
    const holdings = Portfolio.computeHoldings(baseTxs);
    const typeFilter = AppState.getFilters().types;
    const typeFiltered = typeFilter.length > 0 ? holdings.filter(h => typeFilter.includes(h.type)) : holdings;
    const priced = Portfolio.applyPrices(typeFiltered, AppState.get('livePrices'));
    const kpi = Portfolio.computeKPIs(priced);
    const score = Portfolio.computeScoreboard(txs, priced);

    const cashHTML = renderCashKPIs(score, kpi);

    el.innerHTML = `
      <div class="widget">
        ${renderScoreboard(score, kpi, txs.length)}
      </div>
      ${cashHTML ? `<div class="widget" style="margin-top: var(--sp-4);">${cashHTML}</div>` : ''}
    `;

    setupScoreboardHover();
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

  function renderCashKPIs(score, kpi) {
    const cash = AppState.get('cashBalances');
    if (!cash || Object.keys(cash).length === 0) return '';

    const totalCash = Object.values(cash).reduce((s, v) => s + v, 0);
    const hasMarketValue = score.hasAnyPrice;
    const unpricedCost = score.costBasis - score.costBasisPriced;
    const displayMktValue = score.marketValue + unpricedCost;
    const totalPortfolio = hasMarketValue ? displayMktValue + totalCash : null;

    const platformList = Object.entries(cash)
      .sort((a, b) => b[1] - a[1])
      .map(([p, v]) => `<span class="cash-kpi__platform">${Config.getPlatformLabel(p)}: <span class="mono">${UI.currency(v)}</span></span>`)
      .join('');

    return `
      <div class="cash-kpis">
        <div class="cash-kpi">
          <div class="cash-kpi__label">Uninvested Cash</div>
          <div class="cash-kpi__value mono">${UI.currency(totalCash)}</div>
          <div class="cash-kpi__detail">${platformList}</div>
        </div>
        ${totalPortfolio != null ? `
        <div class="cash-kpi">
          <div class="cash-kpi__label">Total Portfolio</div>
          <div class="cash-kpi__value mono">${UI.currency(totalPortfolio)}</div>
          <div class="cash-kpi__detail">
            <span class="cash-kpi__platform">Market Value: <span class="mono">${UI.currency(displayMktValue)}</span></span>
            <span class="cash-kpi__platform">Cash: <span class="mono">${UI.currency(totalCash)}</span></span>
          </div>
        </div>` : ''}
      </div>
    `;
  }

  function renderScoreboard(score, kpi, txCount) {
    const proceeds = score.totalProceeds;
    const hasUnrealized = score.unrealizedPL != null;
    const unpricedCost = score.costBasis - score.costBasisPriced;
    const displayMktValue = score.marketValue + unpricedCost;

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

    const ZERO = 'flex:0 0 0;min-height:0;padding:0;overflow:hidden;';

    const hasSoldPortion = costOfSold > 0;

    const col1HTML = `
      <div class="scoreboard__blocks-seg" style="${fTopPad > 0 ? `flex:${fTopPad} 0 0;` : ZERO}"></div>
      <div class="scoreboard__blocks-seg${hasSoldPortion ? ' seg--merge-top' : ''}" data-group="deployed" style="${hasSoldPortion ? `flex:${costOfSold} 0 0;` : ZERO}background:var(--accent);"></div>
      <div class="scoreboard__blocks-seg${hasSoldPortion ? ' seg--merge-bot' : ''}" data-group="deployed" style="flex:${fCB} 0 0;background:var(--accent);">
        <span class="scoreboard__blocks-seg-name">Deployed</span>
        <span class="scoreboard__blocks-seg-val">${UI.currency(score.totalDeployed)}</span>
      </div>
      <div class="scoreboard__blocks-seg" style="${fBotPad > 0 ? `flex:${fBotPad} 0 0;` : ZERO}"></div>
    `;

    let col2HTML = '';

    if (fRealPL > 0) {
      const plClass = realGain ? 'scoreboard__seg--gain' : 'scoreboard__seg--loss';
      const plColor = realGain ? '#3fb950' : '#f85149';
      col2HTML += `<div class="scoreboard__blocks-seg ${plClass}" data-group="sold" style="flex:${fRealPL} 0 0;">
        <span class="scoreboard__blocks-seg-val" style="color:${plColor};">${UI.plSign(score.totalRealized)}${UI.currency(Math.abs(score.totalRealized))}</span>
      </div>`;
    } else {
      col2HTML += `<div class="scoreboard__blocks-seg" style="${ZERO}"></div>`;
    }

    const fSoldVis = realGain ? costOfSold : Math.max(1, costOfSold - fRealPL);
    col2HTML += `<div class="scoreboard__blocks-seg" data-group="sold" style="flex:${fSoldVis} 0 0;background:#484f58;">
      <span class="scoreboard__blocks-seg-name">Sold</span>
      <span class="scoreboard__blocks-seg-val">${UI.currency(costOfSold)}</span>
    </div>`;

    const fHoldVis = (!hasUnrealized || unrealGain) ? fCB : Math.max(1, fCB - fUnrealPL);
    col2HTML += `<div class="scoreboard__blocks-seg" data-group="open" style="flex:${fHoldVis} 0 0;background:rgba(88,166,255,0.5);">
      <span class="scoreboard__blocks-seg-name">Holding</span>
      <span class="scoreboard__blocks-seg-val">${UI.currency(score.costBasis)}</span>
    </div>`;

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

  // ── Breakdown: By Platform + By Type stacked ──
  function renderBreakdown(el) {
    const txs = AppState.filteredTransactions();
    const platforms = Portfolio.aggregateByPlatform(txs);
    const cash = AppState.get('cashBalances') || {};
    const hasCash = Object.keys(cash).length > 0;

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
      else types[t].value += h.totalCost;
      if (h.unrealized != null) types[t].unrealized = (types[t].unrealized || 0) + h.unrealized;
      types[t].realized += h.realized;
      types[t].count++;
    }
    const typeArr = Object.values(types).sort((a, b) => b.value - a.value);

    if (txs.length === 0 && typeArr.length === 0) {
      el.innerHTML = `
        <div class="chart-empty-state">
          <div class="chart-empty-state__icon">\u{1F4CA}</div>
          <div class="chart-empty-state__text">No transactions match current filters</div>
          <div class="chart-empty-state__hint">Try adjusting your platform, type, or date filters.</div>
        </div>`;
      return;
    }

    // By Platform section
    let platformHTML = '';
    if (txs.length > 0) {
      platformHTML = `
        <h3 class="section-title">By Platform</h3>
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
                    ${hasCash ? '<th class="right">Cash</th>' : ''}
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
                      ${hasCash ? `<td class="right mono">${cash[p.platform] != null ? UI.currency(cash[p.platform]) : '\u2014'}</td>` : ''}
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
    }

    // By Type section
    let typeHTML = '';
    if (typeArr.length > 0) {
      typeHTML = `
        <h3 class="section-title" style="margin-top: var(--sp-6);">By Type</h3>
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
    }

    el.innerHTML = platformHTML + typeHTML;

    // Render platform doughnut
    if (txs.length > 0) {
      const labels = platforms.map(p => Config.getPlatformLabel(p.platform));
      const values = platforms.map(p => p.invested);
      const colors = platforms.map(p => Config.getPlatformColor(p.platform));
      Charts.doughnut('chart-platform', labels, values, colors);
    }

    // Render type doughnut
    if (typeArr.length > 0) {
      Charts.doughnut('chart-type',
        typeArr.map(t => Config.getTypeLabel(t.type)),
        typeArr.map(t => t.value),
        typeArr.map(t => Config.getTypeColor(t.type))
      );
    }
  }

  // ── Timeline: Delegate to TimelineView + By Period ──
  function renderTimeline(el) {
    // Create two containers: one for the timeline view, one for by-period
    el.innerHTML = `
      <div id="analysis-timeline-section"></div>
      <div id="analysis-period-section" style="margin-top: var(--sp-6);"></div>
    `;

    // Delegate timeline rendering
    const timelineSection = document.getElementById('analysis-timeline-section');
    TimelineView.render(timelineSection);

    // Append By Period section below
    const periodSection = document.getElementById('analysis-period-section');
    renderByPeriod(periodSection);
  }

  function renderByPeriod(el) {
    const txs = AppState.filteredTransactions();
    const monthly = Portfolio.monthlyActivity(txs);

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

    const yearArr = selectedYear === 'all' ? allYearArr : allYearArr.filter(y => y.year === selectedYear);

    const yearBtns = ['all', ...availableYears].map(y =>
      `<button class="btn btn--ghost btn--sm ${selectedYear === y ? 'active' : ''}" data-period-year="${y}">${y === 'all' ? 'All' : y}</button>`
    ).join('');

    if (allYearArr.length === 0) {
      el.innerHTML = '';
      return;
    }

    el.innerHTML = `
      <h3 class="section-title">Yearly Investment Flow</h3>
      <div class="year-selector">${yearBtns}</div>
      <div class="chart-wrap">
        <div class="chart-wrap__header">
          <span class="chart-wrap__title">Yearly Flow</span>
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

    el.querySelectorAll('[data-period-year]').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedYear = btn.dataset.periodYear;
        Charts.destroyAll();
        renderTab(document.getElementById('analysis-content'));
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
