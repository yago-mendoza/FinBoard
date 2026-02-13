/* ── Holdings View: Sortable positions table with live prices ── */
const HoldingsView = (() => {

  const DUST_THRESHOLD = 0.001;

  function render(container) {
    const txs = AppState.filteredTransactions();
    // Compute holdings without type filter so sell txs aren't excluded
    const baseTxs = AppState.filteredTransactions({ skipTypeFilter: true });
    const holdings = Portfolio.computeHoldings(baseTxs);
    const typeFilter = AppState.getFilters().types;
    const typeFiltered = typeFilter.length > 0 ? holdings.filter(h => typeFilter.includes(h.type)) : holdings;
    const priced = Portfolio.applyPrices(typeFiltered, AppState.get('livePrices'));
    const active = priced.filter(h => h.quantity >= DUST_THRESHOLD).sort((a, b) => (b.marketValue || b.totalCost) - (a.marketValue || a.totalCost));
    const closed = priced.filter(h => h.quantity < DUST_THRESHOLD);

    const kpi = Portfolio.computeKPIs(priced);

    // Realized P&L breakdown
    const closedRealizedPL = closed.reduce((s, h) => s + h.realized, 0);
    const activeRealizedPL = active.reduce((s, h) => s + h.realized, 0);
    const totalRealizedPL = closedRealizedPL + activeRealizedPL;

    container.innerHTML = `
      <div class="kpi-grid">
        <div class="card kpi">
          <div class="kpi__label">Open Positions</div>
          <div class="kpi__value">${active.length}</div>
        </div>
        <div class="card kpi">
          <div class="kpi__label">Market Value ${kpi.positionsPriced < kpi.positionsTotal ? UI.helpBtn('market-value-estimate') : ''}</div>
          <div class="kpi__value">${kpi.positionsPriced > 0 ? UI.currency(kpi.totalValue) : '<span style="color:var(--text-muted);">N/A</span>'}</div>
          ${kpi.positionsPriced < kpi.positionsTotal ? `<div class="kpi__detail"><span>${kpi.positionsPriced}/${kpi.positionsTotal} priced</span></div>` : ''}
        </div>
        <div class="card kpi">
          <div class="kpi__label">Unrealized P&L</div>
          ${kpi.totalUnrealized != null
            ? `<div class="kpi__value ${UI.plClass(kpi.totalUnrealized)}">${UI.plSign(kpi.totalUnrealized)}${UI.currency(kpi.totalUnrealized)}</div>`
            : `<div class="kpi__value" style="color:var(--text-muted);">N/A</div>`}
        </div>
        <div class="card kpi">
          <div class="kpi__label">Total Realized P&L ${UI.helpBtn('realized-breakdown')}</div>
          <div class="kpi__value ${UI.plClass(totalRealizedPL)}">${UI.plSign(totalRealizedPL)}${UI.currency(totalRealizedPL)}</div>
          <div class="kpi__detail">
            <span>From sells on open: <span class="${UI.plClass(activeRealizedPL)}">${UI.plSign(activeRealizedPL)}${UI.currency(activeRealizedPL)}</span></span>
            <span>From closed: <span class="${UI.plClass(closedRealizedPL)}">${UI.plSign(closedRealizedPL)}${UI.currency(closedRealizedPL)}</span></span>
          </div>
        </div>
      </div>

      <h2 class="section-title" style="display:flex; align-items:center; gap:var(--sp-2);">
        Active Positions
        ${UI.helpBtn('holdings')}
      </h2>
      <div class="table-wrap">
        <table class="table" id="holdings-table">
          <thead>
            <tr>
              <th data-sort="symbol">Symbol</th>
              <th data-sort="type">Type</th>
              <th data-sort="quantity" class="right">Qty</th>
              <th data-sort="avgCost" class="right">Avg Cost</th>
              <th data-sort="totalCost" class="right">Total Cost</th>
              <th data-sort="currentPrice" class="right">Price</th>
              <th data-sort="marketValue" class="right">Mkt Value</th>
              <th data-sort="unrealized" class="right">Unrealized</th>
              <th data-sort="unrealizedPct" class="right">%</th>
              <th data-sort="realized" class="right">Realized</th>
            </tr>
          </thead>
          <tbody id="holdings-tbody"></tbody>
        </table>
      </div>

      ${closed.length > 0 && Settings.get('closedPositions') !== false ? `
        <div class="kpi-grid" style="margin-top: var(--sp-6);">
          <div class="card kpi">
            <div class="kpi__label">Closed Positions</div>
            <div class="kpi__value">${closed.length}</div>
          </div>
          <div class="card kpi">
            <div class="kpi__label">Realized P&L (Closed)</div>
            <div class="kpi__value ${UI.plClass(closedRealizedPL)}">${UI.plSign(closedRealizedPL)}${UI.currency(closedRealizedPL)}</div>
          </div>
        </div>

        <h2 class="section-title" style="margin-top: var(--sp-4);">Closed Positions</h2>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Type</th>
                <th class="right">Invested</th>
                <th class="right">Proceeds</th>
                <th class="right">Realized P&L</th>
                <th class="right">Txns</th>
              </tr>
            </thead>
            <tbody>
              ${closed.map(h => {
                const symTxs = Portfolio.symbolTransactions(txs, h.symbol);
                const invested = symTxs.filter(t => t.action === 'buy').reduce((s, t) => s + Math.abs(t.balance), 0);
                const proceeds = symTxs.filter(t => t.action === 'sel').reduce((s, t) => s + Math.abs(t.balance), 0);
                return `
                <tr style="opacity: 0.7;">
                  <td class="mono clickable" onclick="Router.navigate('market','${h.symbol}')">${Config.getDisplayName(h.symbol)}</td>
                  <td>${UI.typeBadge(h.type)}</td>
                  <td class="right mono">${UI.currency(invested)}</td>
                  <td class="right mono">${UI.currency(proceeds)}</td>
                  <td class="right mono ${UI.plClass(h.realized)}">${UI.plSign(h.realized)}${UI.currency(h.realized)}</td>
                  <td class="right mono">${h.transactions}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}
    `;

    // Populate table
    const tbody = document.getElementById('holdings-tbody');
    active.forEach(h => tbody.appendChild(renderRow(h)));

    // Make sortable
    UI.sortable(document.getElementById('holdings-table'), active, renderRow);
  }

  function renderRow(h) {
    const tr = document.createElement('tr');
    const priceChange = AppState.get('livePrices')[h.symbol];
    const changeInfo = priceChange ? ` (${priceChange.changePct >= 0 ? '+' : ''}${priceChange.changePct.toFixed(2)}%)` : '';

    tr.innerHTML = `
      <td class="mono clickable" onclick="Router.navigate('market','${h.symbol}')">${Config.getDisplayName(h.symbol)}</td>
      <td>${UI.typeBadge(h.type)}</td>
      <td class="right mono">${UI.qty(h.quantity)}</td>
      <td class="right mono">${UI.currency(h.avgCost)}</td>
      <td class="right mono">${UI.currency(h.totalCost)}</td>
      <td class="right mono">${h.currentPrice != null ? UI.currency(h.currentPrice) + `<span class="${UI.plClass(priceChange?.changePct)}" style="font-size:var(--font-xs)">${changeInfo}</span>` : '<span style="color:var(--text-muted)">\u2014</span>'}</td>
      <td class="right mono">${h.marketValue != null ? UI.currency(h.marketValue) : '\u2014'}</td>
      <td class="right mono ${UI.plClass(h.unrealized)}">${h.unrealized != null ? UI.plSign(h.unrealized) + UI.currency(h.unrealized) : '\u2014'}</td>
      <td class="right mono ${UI.plClass(h.unrealizedPct)}">${h.unrealizedPct != null ? UI.pct(h.unrealizedPct) : '\u2014'}</td>
      <td class="right mono ${UI.plClass(h.realized)}">${h.realized !== 0 ? UI.plSign(h.realized) + UI.currency(h.realized) : '<span style="color:var(--text-muted)">\u2014</span>'}</td>
    `;
    return tr;
  }

  return { render };
})();
