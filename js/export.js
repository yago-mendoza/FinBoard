/* ── Export Module: copy portfolio data to clipboard ── */
const Export = (() => {

  function toClipboard(text) {
    return navigator.clipboard.writeText(text).then(() => {
      UI.toast('Copied to clipboard', 'success');
      closeDropdown();
    }).catch(() => {
      UI.toast('Failed to copy to clipboard', 'error');
    });
  }

  function today() {
    return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function fmt(v) {
    if (v == null || isNaN(v)) return '—';
    return '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fmtPL(v) {
    if (v == null || isNaN(v)) return '—';
    const sign = v >= 0 ? '+' : '-';
    return sign + '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fmtPct(v) {
    if (v == null || isNaN(v)) return '—';
    return (v >= 0 ? '+' : '') + v.toFixed(1) + '%';
  }

  function fmtQty(v) {
    if (v == null) return '0';
    if (Math.abs(v) >= 1) return v % 1 === 0 ? v.toFixed(0) : v.toFixed(2);
    return v.toFixed(6);
  }

  function soldQtyBySymbol(txs) {
    const result = {};
    for (const tx of txs) {
      if (tx.action === 'sel') {
        result[tx.symbol] = (result[tx.symbol] || 0) + Math.abs(tx.quantity);
      }
    }
    return result;
  }

  // ── Copy portfolio overview (human-readable) ──
  function copyPortfolioOverview() {
    const txs = AppState.get('rawTransactions');
    const holdings = Portfolio.computeHoldings(txs);
    const priced = Portfolio.applyPrices(holdings, AppState.get('livePrices'));
    const score = Portfolio.computeScoreboard(txs, priced);
    const cash = AppState.get('cashBalances');
    const sold = soldQtyBySymbol(txs);

    const open = priced.filter(h => h.quantity > 0.001)
      .sort((a, b) => (b.marketValue || b.totalCost) - (a.marketValue || a.totalCost));
    const closed = priced.filter(h => h.quantity <= 0.001);

    let t = `FinBoard portfolio — ${today()}\n\n`;

    t += `Positions: ${open.length} open`;
    if (closed.length > 0) t += `, ${closed.length} closed`;
    t += '\n';
    t += `Deployed: ${fmt(score.totalDeployed)}\n`;
    if (score.hasAnyPrice) {
      const uc = score.costBasis - score.costBasisPriced;
      t += `Market value: ${fmt(score.marketValue + uc)}\n`;
    }
    if (score.unrealizedPL != null) t += `Unrealized: ${fmtPL(score.unrealizedPL)}\n`;
    t += `Realized: ${fmtPL(score.totalRealized)}\n`;
    if (score.unrealizedPL != null) {
      t += `Total P&L: ${fmtPL(score.totalPL)} (${fmtPct(score.returnPct)})\n`;
    }

    if (open.length > 0) {
      t += '\nOpen positions:\n';
      for (const h of open) {
        const name = Config.getDisplayName(h.symbol);
        const type = Config.getTypeLabel(h.type);
        const plats = h.platforms.join(', ');
        let line = `  ${name} · ${type} · ${plats} · ${fmtQty(h.quantity)} · avg ${fmt(h.avgCost)}`;
        if (h.marketValue != null) {
          line += ` · value ${fmt(h.marketValue)} · ${fmtPL(h.unrealized)} (${fmtPct(h.unrealizedPct)})`;
        } else {
          line += ` · invested ${fmt(h.totalCost)}`;
        }
        const sq = sold[h.symbol];
        if (sq && sq > 0) line += ` · sold ${fmtQty(sq)} hist.`;
        if (h.realized && h.realized !== 0) line += ` · realized ${fmtPL(h.realized)}`;
        t += line + '\n';
      }
    }

    if (closed.length > 0) {
      t += '\nClosed positions:\n';
      for (const h of closed) {
        const name = Config.getDisplayName(h.symbol);
        const sq = sold[h.symbol] || 0;
        t += `  ${name} · sold ${fmtQty(sq)} · realized ${fmtPL(h.realized)}\n`;
      }
    }

    if (cash && Object.keys(cash).length > 0) {
      const entries = Object.entries(cash).sort((a, b) => b[1] - a[1]);
      const total = entries.reduce((s, [, v]) => s + v, 0);
      const parts = entries.map(([p, v]) => `${Config.getPlatformLabel(p)}: ${fmt(v)}`);
      t += `\nCash: ${fmt(total)} (${parts.join(', ')})\n`;
    }

    return toClipboard(t.trim());
  }

  // ── Copy all holdings as tab-separated table ──
  function copyAllHoldings() {
    const txs = AppState.get('rawTransactions');
    const holdings = Portfolio.computeHoldings(txs);
    const priced = Portfolio.applyPrices(holdings, AppState.get('livePrices'));
    const sold = soldQtyBySymbol(txs);

    const headers = ['Symbol', 'Type', 'Platform', 'Qty', 'Avg cost', 'Invested', 'Price', 'Value', 'Unrealized', '%', 'Sold qty', 'Realized', 'Status'];
    let t = headers.join('\t') + '\n';

    const sorted = [...priced].sort((a, b) => (b.marketValue || b.totalCost) - (a.marketValue || a.totalCost));

    for (const h of sorted) {
      const status = h.quantity > 0.001 ? 'Open' : 'Closed';
      const sq = sold[h.symbol] || 0;
      const row = [
        Config.getDisplayName(h.symbol),
        h.type,
        h.platforms.join('/'),
        fmtQty(h.quantity),
        h.avgCost.toFixed(2),
        h.totalCost.toFixed(2),
        h.currentPrice != null ? h.currentPrice.toFixed(2) : '',
        h.marketValue != null ? h.marketValue.toFixed(2) : '',
        h.unrealized != null ? h.unrealized.toFixed(2) : '',
        h.unrealizedPct != null ? h.unrealizedPct.toFixed(1) + '%' : '',
        fmtQty(sq),
        h.realized ? h.realized.toFixed(2) : '0',
        status,
      ];
      t += row.join('\t') + '\n';
    }

    return toClipboard(t.trim());
  }

  // ── Copy full transaction history ──
  function copyTransactionHistory() {
    const txs = AppState.get('rawTransactions');
    const headers = ['Date', 'Type', 'Platform', 'Action', 'Symbol', 'Qty', 'Price', 'Amount'];
    let t = headers.join('\t') + '\n';

    const sorted = [...txs].sort((a, b) => a.dateObj - b.dateObj);
    for (const tx of sorted) {
      const row = [
        tx.date,
        tx.type,
        tx.platform,
        tx.action === 'buy' ? 'Buy' : 'Sell',
        tx.symbol,
        fmtQty(tx.quantity),
        tx.price.toFixed(2),
        tx.balance.toFixed(2),
      ];
      t += row.join('\t') + '\n';
    }

    return toClipboard(t.trim());
  }

  // ── Copy single asset detail ──
  function copyAssetDetail(symbol) {
    if (!symbol) return;

    const txs = AppState.get('rawTransactions');
    const symTxs = Portfolio.symbolTransactions(txs, symbol);
    const holding = Portfolio.symbolHolding(txs, symbol);
    if (!holding) {
      UI.toast('Asset not found', 'error');
      return;
    }

    const priceData = AppState.get('livePrices')[symbol];
    let h = holding;
    if (priceData && h.quantity > 0) {
      h = {
        ...h,
        currentPrice: priceData.price,
        marketValue: priceData.price * h.quantity,
        unrealized: (priceData.price * h.quantity) - h.totalCost,
        unrealizedPct: h.totalCost > 0 ? (((priceData.price * h.quantity) - h.totalCost) / h.totalCost) * 100 : 0,
      };
    }

    const buys = symTxs.filter(tx => tx.action === 'buy');
    const sells = symTxs.filter(tx => tx.action === 'sel');
    const totalBought = buys.reduce((s, tx) => s + Math.abs(tx.balance), 0);
    const totalSoldAmt = sells.reduce((s, tx) => s + Math.abs(tx.balance), 0);
    const soldQty = sells.reduce((s, tx) => s + Math.abs(tx.quantity), 0);
    const isClosed = h.quantity < 0.001;

    const name = Config.getDisplayLabel(symbol);
    const type = Config.getTypeLabel(h.type);

    let t = `${name} — ${type}\n`;
    t += `Status: ${isClosed ? 'Closed' : 'Open'} · Platforms: ${h.platforms.join(', ')}\n\n`;

    if (!isClosed) {
      t += `Quantity: ${fmtQty(h.quantity)} · Avg cost: ${fmt(h.avgCost)} · Invested: ${fmt(h.totalCost)}\n`;
      if (h.currentPrice != null) {
        t += `Price: ${fmt(h.currentPrice)} · Value: ${fmt(h.marketValue)}\n`;
        t += `Unrealized: ${fmtPL(h.unrealized)} (${fmtPct(h.unrealizedPct)})\n`;
      }
    }

    t += `Total bought: ${fmt(totalBought)} (${buys.length} transactions)\n`;
    if (sells.length > 0) {
      t += `Total sold: ${fmtQty(soldQty)} units for ${fmt(totalSoldAmt)} (${sells.length} transactions)\n`;
    }
    t += `Realized P&L: ${fmtPL(h.realized)}\n`;

    if (symTxs.length > 0) {
      t += `\nFirst: ${symTxs[0].date} · Last: ${symTxs[symTxs.length - 1].date}\n`;
    }

    return toClipboard(t.trim());
  }

  // ── Dropdown UI ──
  function toggleDropdown() {
    const menu = document.getElementById('export-menu');
    if (!menu) return;
    menu.classList.toggle('open');
  }

  function closeDropdown() {
    const menu = document.getElementById('export-menu');
    if (menu) menu.classList.remove('open');
  }

  function bindDropdown() {
    document.getElementById('export-overview')?.addEventListener('click', copyPortfolioOverview);
    document.getElementById('export-holdings')?.addEventListener('click', copyAllHoldings);
    document.getElementById('export-history')?.addEventListener('click', copyTransactionHistory);

    const symbolInput = document.getElementById('export-symbol-input');
    if (symbolInput) {
      symbolInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const sym = symbolInput.value.trim().toUpperCase();
          if (sym) {
            copyAssetDetail(sym);
            symbolInput.value = '';
          }
        }
      });
    }

    // Close on outside click
    document.addEventListener('click', (e) => {
      const dropdown = document.getElementById('export-dropdown');
      if (dropdown && !dropdown.contains(e.target)) {
        closeDropdown();
      }
    });
  }

  return { copyPortfolioOverview, copyAllHoldings, copyTransactionHistory, copyAssetDetail, toggleDropdown, closeDropdown, bindDropdown };
})();
