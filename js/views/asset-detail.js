/* ── Asset Detail View: Deep-dive into a single symbol ── */
const AssetDetailView = (() => {

  /**
   * Pick the smallest chart range that covers the full holding period.
   * Standard heuristic: first transaction date → today.
   */
  function pickDefaultRange(symTxs) {
    if (symTxs.length === 0) return '1y';

    const earliest = symTxs.reduce((min, t) => t.date < min ? t.date : min, symTxs[0].date);
    const diffMs = Date.now() - new Date(earliest).getTime();
    const months = diffMs / (30.44 * 24 * 60 * 60 * 1000);

    if (months <= 1) return '1mo';
    if (months <= 3) return '3mo';
    if (months <= 6) return '6mo';
    if (months <= 12) return '1y';
    if (months <= 24) return '2y';
    return '5y';
  }

  function render(container, symbol) {
    if (!symbol) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state__text">No symbol specified</div></div>';
      return;
    }

    const txs = AppState.filteredTransactions();
    const symTxs = Portfolio.symbolTransactions(txs, symbol);
    const holding = Portfolio.symbolHolding(txs, symbol);
    const priceData = AppState.get('livePrices')[symbol];

    if (!holding) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state__text">No transactions found for ${symbol}</div></div>`;
      return;
    }

    // Apply price
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

    const totalBought = symTxs.filter(t => t.action === 'buy').reduce((s, t) => s + Math.abs(t.balance), 0);
    const totalSold = symTxs.filter(t => t.action === 'sel').reduce((s, t) => s + Math.abs(t.balance), 0);

    const isClosed = h.quantity < 0.001;
    const defaultRange = pickDefaultRange(symTxs);

    const priceDiff = h.currentPrice != null ? h.currentPrice - h.avgCost : null;
    const priceDiffPct = h.avgCost > 0 && priceDiff != null ? (priceDiff / h.avgCost) * 100 : null;

    const hasYahoo = !!Config.getYahooTicker(symbol);

    container.innerHTML = `
      <div style="display:flex; align-items:center; gap:var(--sp-3); margin-bottom:var(--sp-4);">
        <button class="btn btn--ghost btn--sm" onclick="Router.navigate('holdings')">&larr; Holdings</button>
        <h1 style="font-size:var(--font-xl); font-weight:700; display:flex; align-items:center; gap:var(--sp-2);">
          <span style="width:12px; height:12px; border-radius:50%; background:${Config.getSymbolColor(symbol)}; display:inline-block;"></span>
          ${Config.getDisplayLabel(symbol)}
        </h1>
        ${UI.typeBadge(h.type)}
        <span style="color:var(--text-secondary); font-size:var(--font-sm);">${h.platforms.join(', ')}</span>
        ${hasYahoo && !isClosed ? `<button class="btn btn--ghost btn--sm" id="btn-compare-asset" style="margin-left:auto;">Compare</button>` : ''}
      </div>
      ${isClosed ? '<div class="position-closed-banner">Position Closed</div>' : ''}

      <!-- Asset hero: price + position + P&L in one glance -->
      <div class="asset-hero">
        <div class="asset-hero__price">
          <div class="asset-hero__current">${h.currentPrice != null ? UI.currency(h.currentPrice) : '—'}</div>
          ${priceData ? `<span class="asset-hero__change ${UI.plClass(priceData.changePct)}">${priceData.changePct >= 0 ? '+' : ''}${priceData.changePct.toFixed(2)}% today</span>` : ''}
          <div class="asset-hero__avg">Avg cost <span class="mono">${UI.currency(h.avgCost)}</span>
            ${priceDiff != null ? `<span class="${UI.plClass(priceDiff)}" style="margin-left:var(--sp-2);">${UI.plSign(priceDiff)}${UI.currency(Math.abs(priceDiff))} (${UI.plSign(priceDiffPct)}${Math.abs(priceDiffPct).toFixed(1)}%)</span>` : ''}
          </div>
        </div>

        <div class="asset-hero__cols">
          <div class="asset-hero__col">
            <span class="asset-hero__label">Quantity</span>
            <span class="asset-hero__val mono">${UI.qty(h.quantity)}</span>
          </div>
          <div class="asset-hero__sep"></div>
          <div class="asset-hero__col">
            <span class="asset-hero__label">Invested</span>
            <span class="asset-hero__val mono">${UI.currency(totalBought)}</span>
          </div>
          <div class="asset-hero__sep"></div>
          <div class="asset-hero__col">
            <span class="asset-hero__label">Sold</span>
            <span class="asset-hero__val mono">${totalSold > 0 ? UI.currency(totalSold) : '—'}</span>
          </div>
          <div class="asset-hero__sep"></div>
          <div class="asset-hero__col">
            <span class="asset-hero__label">Mkt Value</span>
            <span class="asset-hero__val mono">${h.marketValue != null ? UI.currency(h.marketValue) : '—'}</span>
          </div>
        </div>

        <div class="asset-hero__pnl">
          <div class="asset-hero__pnl-item">
            <span class="asset-hero__label">Unrealized</span>
            ${h.unrealized != null
              ? `<span class="asset-hero__pnl-val ${UI.plClass(h.unrealized)}">${UI.plSign(h.unrealized)}${UI.currency(Math.abs(h.unrealized))}</span>
                 <span class="asset-hero__pnl-pct ${UI.plClass(h.unrealizedPct)}">${UI.pct(h.unrealizedPct)}</span>`
              : `<span class="asset-hero__pnl-val" style="color:var(--text-muted);">N/A</span>`}
          </div>
          <div class="asset-hero__pnl-item">
            <span class="asset-hero__label">Realized</span>
            <span class="asset-hero__pnl-val ${UI.plClass(h.realized)}">${UI.plSign(h.realized)}${UI.currency(Math.abs(h.realized))}</span>
          </div>
        </div>
      </div>

      <div class="chart-wrap" style="margin-bottom: var(--sp-4);">
        <div class="chart-wrap__header">
          <span class="chart-wrap__title">Price History</span>
          <div id="price-chart-range" style="display:flex; gap:var(--sp-1);">
            ${['1mo', '3mo', '6mo', '1y', '2y', '5y'].map(r => `
              <button class="btn btn--ghost btn--sm range-btn ${r === defaultRange ? 'active' : ''}" data-range="${r}">${r}</button>
            `).join('')}
          </div>
        </div>
        <div class="chart-canvas-container chart-canvas-container--md">
          <canvas id="chart-price-history"></canvas>
        </div>
        <div id="price-chart-loading" class="chart-loading" style="display:none;"></div>
      </div>

      <h2 class="section-title">Transaction History</h2>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Action</th>
              <th>Platform</th>
              <th class="right">Qty</th>
              <th class="right">Price</th>
              <th class="right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${[...symTxs].reverse().map(tx => `
              <tr>
                <td class="mono">${UI.dateShort(tx.date)}</td>
                <td>${UI.actionBadge(tx.action)}</td>
                <td style="font-size:var(--font-xs)">${Config.getPlatformLabel(tx.platform)}</td>
                <td class="right mono">${UI.qty(Math.abs(tx.quantity))}</td>
                <td class="right mono">${UI.currency(tx.price)}</td>
                <td class="right mono ${tx.action === 'buy' ? 'negative' : 'positive'}">${UI.currency(tx.balance)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    // Load price history
    loadPriceChart(symbol, defaultRange, symTxs, h.avgCost);

    // Range buttons
    document.querySelectorAll('.range-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadPriceChart(symbol, btn.dataset.range, symTxs, h.avgCost);
      });
    });

    // Compare button
    const compareBtn = document.getElementById('btn-compare-asset');
    if (compareBtn) {
      compareBtn.addEventListener('click', () => {
        CompareView.preselect(symbol);
        Router.navigate('compare');
      });
    }
  }

  async function loadPriceChart(symbol, range, transactions, avgCost) {
    const loading = document.getElementById('price-chart-loading');
    if (loading) loading.style.display = 'flex';

    try {
      const history = await API.fetchHistory(symbol, range);

      if (loading) loading.style.display = 'none';

      if (history.length === 0) {
        const canvas = document.getElementById('chart-price-history');
        if (canvas) {
          Charts.destroy('chart-price-history');
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#484f58';
          ctx.font = '13px Inter';
          ctx.textAlign = 'center';
          ctx.fillText('No price data available', canvas.width / 2, canvas.height / 2);
        }
        return;
      }

      const labels = history.map(p => p.date);
      const data = history.map(p => p.close);

      // Map transactions to closest chart dates
      // Tolerance scales with data interval: daily→7d, weekly→14d, monthly→35d
      const gap = labels.length >= 2 ? Math.abs(new Date(labels[1]) - new Date(labels[0])) : 86400000;
      const tolerance = Math.max(gap * 2.5, 7 * 86400000);
      const txMapped = [];
      for (const tx of transactions) {
        const closest = labels.reduce((prev, curr) =>
          Math.abs(new Date(curr) - new Date(tx.date)) < Math.abs(new Date(prev) - new Date(tx.date)) ? curr : prev
        );
        const idx = labels.indexOf(closest);
        if (idx >= 0 && Math.abs(new Date(closest) - new Date(tx.date)) < tolerance) {
          txMapped.push({ tx, label: closest, idx, price: data[idx] });
        }
      }

      // Annotations: vertical lines + dots at price intersection
      const annotations = {};
      for (const m of txMapped) {
        const color = m.tx.action === 'buy' ? '#3fb950' : '#f85149';
        // Vertical line spanning full chart height
        annotations[`line-${m.tx.datetime}`] = {
          type: 'line',
          xMin: m.label,
          xMax: m.label,
          borderColor: color + '40',
          borderWidth: 1,
          borderDash: [4, 3],
        };
        // Dot where line meets price
        annotations[`dot-${m.tx.datetime}`] = {
          type: 'point',
          xValue: m.label,
          yValue: m.price,
          backgroundColor: color,
          borderColor: color,
          radius: 4,
          borderWidth: 1,
        };
      }

      // Avg cost horizontal dashed line
      if (avgCost > 0) {
        annotations['avg-cost'] = {
          type: 'line',
          yMin: avgCost,
          yMax: avgCost,
          borderColor: '#e6edf3',
          borderWidth: 1,
          borderDash: [6, 4],
          label: {
            display: true,
            content: `Avg ${UI.currency(avgCost)}`,
            position: 'start',
            backgroundColor: 'transparent',
            color: '#e6edf3',
            font: { size: 10, weight: '600' },
            padding: { top: 0, bottom: 2, left: 0, right: 0 },
            yAdjust: -8,
          },
        };
      }

      // Volume-style bar data: transaction amounts at each label
      const barData = new Array(labels.length).fill(null);
      const barColors = new Array(labels.length).fill('transparent');
      for (const m of txMapped) {
        const amt = Math.abs(m.tx.balance);
        // Stack if multiple txs on same date
        barData[m.idx] = (barData[m.idx] || 0) + amt;
        barColors[m.idx] = m.tx.action === 'buy' ? 'rgba(63,185,80,0.6)' : 'rgba(248,81,73,0.6)';
      }

      Charts.create('chart-price-history', {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: symbol + ' Price',
              data,
              borderColor: Config.getSymbolColor(symbol),
              backgroundColor: Config.getSymbolColor(symbol) + '15',
              fill: true,
              tension: 0.2,
              pointRadius: 0,
              pointHoverRadius: 4,
              borderWidth: 2,
              yAxisID: 'y',
            },
            {
              type: 'bar',
              label: 'Transaction',
              data: barData,
              backgroundColor: barColors,
              borderRadius: 2,
              yAxisID: 'yVol',
              barPercentage: 0.4,
              order: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { intersect: false, mode: 'index' },
          scales: {
            x: { grid: { display: false }, ticks: { maxTicksLimit: 10 } },
            y: {
              position: 'left',
              ticks: { callback: v => UI.currency(v) },
              grid: { color: '#21262d' },
            },
            yVol: {
              position: 'right',
              grid: { display: false },
              ticks: { display: false },
              // Take up bottom ~20% of chart
              max: Math.max(...barData.filter(v => v != null)) * 5 || 1,
              min: 0,
              display: false,
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => {
                  if (ctx.dataset.yAxisID === 'yVol') {
                    return ctx.parsed.y ? ` Trade: ${UI.currency(ctx.parsed.y)}` : null;
                  }
                  return ` ${UI.currency(ctx.parsed.y)}`;
                },
              },
              filter: ctx => ctx.parsed.y != null,
            },
            annotation: { annotations },
          },
        },
      });
    } catch (e) {
      if (loading) loading.style.display = 'none';
      console.error('Price chart error:', e);
    }
  }

  return { render };
})();
