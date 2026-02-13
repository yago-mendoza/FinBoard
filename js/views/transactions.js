/* ── Transactions View: Browsable table with filters ── */
const TransactionsView = (() => {

  let localFilters = { symbol: '', action: '' };

  function render(container) {
    const allTxs = AppState.filteredTransactions();

    container.innerHTML = `
      <div class="kpi-grid">
        <div class="card kpi">
          <div class="kpi__label">Total Transactions</div>
          <div class="kpi__value" id="tx-count">${allTxs.length}</div>
        </div>
        <div class="card kpi">
          <div class="kpi__label">Total Bought</div>
          <div class="kpi__value" id="tx-bought">${UI.currency(allTxs.filter(t => t.action === 'buy').reduce((s, t) => s + Math.abs(t.balance), 0))}</div>
        </div>
        <div class="card kpi">
          <div class="kpi__label">Total Sold</div>
          <div class="kpi__value" id="tx-sold">${UI.currency(allTxs.filter(t => t.action === 'sel').reduce((s, t) => s + Math.abs(t.balance), 0))}</div>
        </div>
        <div class="card kpi">
          <div class="kpi__label">Unique Symbols</div>
          <div class="kpi__value" id="tx-symbols">${new Set(allTxs.map(t => t.symbol)).size}</div>
        </div>
      </div>

      <div style="display:flex; gap:var(--sp-3); margin-bottom:var(--sp-4); flex-wrap:wrap; align-items:center;">
        <input type="text" class="input input--sm" id="tx-filter-symbol" placeholder="Filter symbol..." style="max-width:160px" value="${localFilters.symbol}">
        <select class="input input--sm" id="tx-filter-action" style="max-width:120px">
          <option value="">All Actions</option>
          <option value="buy" ${localFilters.action === 'buy' ? 'selected' : ''}>Buy</option>
          <option value="sel" ${localFilters.action === 'sel' ? 'selected' : ''}>Sell</option>
        </select>
        <span style="color:var(--text-muted); font-size:var(--font-xs);" id="tx-filtered-count"></span>
      </div>

      <div class="table-wrap" style="max-height: calc(100vh - 320px); overflow-y: auto;">
        <table class="table" id="tx-table">
          <thead>
            <tr>
              <th data-sort="date">Date</th>
              <th data-sort="symbol">Symbol</th>
              <th data-sort="action">Action</th>
              <th data-sort="type">Type</th>
              <th data-sort="platform">Platform</th>
              <th data-sort="quantity" class="right">Qty</th>
              <th data-sort="price" class="right">Price</th>
              <th data-sort="balance" class="right">Amount</th>
            </tr>
          </thead>
          <tbody id="tx-tbody"></tbody>
        </table>
      </div>
    `;

    // Initial render
    applyLocalFilters(allTxs);

    // Filter listeners
    document.getElementById('tx-filter-symbol').addEventListener('input', e => {
      localFilters.symbol = e.target.value;
      applyLocalFilters(allTxs);
    });

    document.getElementById('tx-filter-action').addEventListener('change', e => {
      localFilters.action = e.target.value;
      applyLocalFilters(allTxs);
    });
  }

  function applyLocalFilters(allTxs) {
    let filtered = allTxs;

    if (localFilters.symbol) {
      const q = localFilters.symbol.toUpperCase();
      filtered = filtered.filter(t => t.symbol.includes(q));
    }
    if (localFilters.action) {
      filtered = filtered.filter(t => t.action === localFilters.action);
    }

    const tbody = document.getElementById('tx-tbody');
    tbody.innerHTML = '';

    // Show newest first
    const sorted = [...filtered].reverse();
    sorted.forEach(tx => tbody.appendChild(renderRow(tx)));

    const countEl = document.getElementById('tx-filtered-count');
    if (countEl) {
      countEl.textContent = filtered.length < allTxs.length
        ? `Showing ${filtered.length} of ${allTxs.length}`
        : '';
    }

    // Re-apply sortable
    UI.sortable(document.getElementById('tx-table'), sorted, renderRow);
  }

  function renderRow(tx) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="mono">${UI.dateShort(tx.date)}</td>
      <td class="mono clickable" onclick="Router.navigate('market','${tx.symbol}')">${Config.getDisplayName(tx.symbol)}</td>
      <td>${UI.actionBadge(tx.action)}</td>
      <td>${UI.typeBadge(tx.type)}</td>
      <td style="font-size:var(--font-xs)">${Config.getPlatformLabel(tx.platform)}</td>
      <td class="right mono">${UI.qty(Math.abs(tx.quantity))}</td>
      <td class="right mono">${UI.currency(tx.price)}</td>
      <td class="right mono ${tx.action === 'buy' ? 'negative' : 'positive'}">${UI.currency(tx.balance)}</td>
    `;
    return tr;
  }

  return { render };
})();
