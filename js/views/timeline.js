/* ── Timeline View: Capital chart + Activity heatmap + Monthly table ── */
const TimelineView = (() => {

  function render(container) {
    const txs = AppState.filteredTransactions();
    const timeline = Portfolio.capitalTimeline(txs);
    const monthly = Portfolio.monthlyActivity(txs);

    // Build heatmap data: year x month grid with type amounts
    const heatmapData = buildHeatmap(txs);

    container.innerHTML = `
      <div class="chart-wrap">
        <div class="chart-wrap__header">
          <span class="chart-wrap__title">Cumulative Capital + Buy/Sell Activity</span>
          ${UI.helpBtn('capital-timeline')}
        </div>
        <div class="chart-canvas-container chart-canvas-container--lg" id="timeline-chart-container">
          <canvas id="chart-timeline"></canvas>
        </div>
      </div>

      <div class="grid-2" style="margin-top: var(--sp-4);">
        <div class="card">
          <div class="card__header">
            <span class="card__title">Activity Heatmap</span>
            ${UI.helpBtn('heatmap')}
          </div>
          <div id="heatmap-container">${renderHeatmap(heatmapData)}</div>
        </div>

        <div class="card">
          <div class="card__header">
            <span class="card__title">Monthly Summary</span>
            ${UI.helpBtn('monthly-summary')}
          </div>
          <div class="table-wrap" style="max-height: 400px; overflow-y: auto; border: none;">
            <table class="table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th class="right">Buys</th>
                  <th class="right">Sells</th>
                  <th class="right">Net Flow</th>
                </tr>
              </thead>
              <tbody>
                ${monthly.length === 0 ? '<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">No transactions in this period</td></tr>' :
                  [...monthly].reverse().map(m => `
                  <tr>
                    <td class="mono">${m.month}</td>
                    <td class="right mono negative">${UI.currency(m.buyAmount)}</td>
                    <td class="right mono positive">${m.sellAmount > 0 ? UI.currency(m.sellAmount) : '\u2014'}</td>
                    <td class="right mono ${UI.plClass(m.sellAmount - m.buyAmount)}">${UI.currency(m.sellAmount - m.buyAmount)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    renderTimelineChart(timeline, monthly);
    attachHeatmapHandlers();
  }

  function renderTimelineChart(timeline, monthly) {
    const chartContainer = document.getElementById('timeline-chart-container');
    if (timeline.length === 0 || monthly.length === 0) {
      if (chartContainer) {
        chartContainer.innerHTML = `
          <div class="chart-empty-state">
            <div class="chart-empty-state__icon">\u{1F4C9}</div>
            <div class="chart-empty-state__text">No transactions in this period</div>
            <div class="chart-empty-state__hint">Try adjusting your date filters or clearing all filters.</div>
          </div>`;
      }
      return;
    }

    // Ensure canvas exists
    if (!document.getElementById('chart-timeline')) {
      chartContainer.innerHTML = '<canvas id="chart-timeline"></canvas>';
    }

    const months = monthly.map(m => m.month);
    const cumData = {};
    let cum = 0;
    for (const m of monthly) {
      cum += m.buyAmount - m.sellAmount;
      cumData[m.month] = cum;
    }

    Charts.create('chart-timeline', {
      type: 'bar',
      data: {
        labels: months,
        datasets: [
          {
            type: 'line',
            label: 'Cumulative Invested',
            data: months.map(m => cumData[m]),
            borderColor: '#58a6ff',
            backgroundColor: 'rgba(88,166,255,0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 2,
            borderWidth: 2,
            yAxisID: 'y',
            order: 0,
          },
          {
            label: 'Buy Amount',
            data: monthly.map(m => m.buyAmount),
            backgroundColor: 'rgba(63,185,80,0.6)',
            borderRadius: 3,
            yAxisID: 'y1',
            order: 1,
          },
          {
            label: 'Sell Amount',
            data: monthly.map(m => -m.sellAmount),
            backgroundColor: 'rgba(248,81,73,0.6)',
            borderRadius: 3,
            yAxisID: 'y1',
            order: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        scales: {
          x: { grid: { display: false } },
          y: {
            position: 'left',
            ticks: { callback: v => UI.currencyCompact(v) },
          },
          y1: {
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: { callback: v => UI.currencyCompact(Math.abs(v)) },
          },
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: ctx => {
                const val = ctx.parsed.y;
                return ` ${ctx.dataset.label}: ${UI.currency(Math.abs(val))}`;
              },
            },
          },
        },
      },
    });
  }

  function buildHeatmap(txs) {
    // Group by YYYY-MM: count + amount per type
    const counts = {};
    const typeAmounts = {}; // { "2024-01": { MKT: 500, CRP: 200, ... } }

    for (const tx of txs) {
      const key = tx.date.slice(0, 7);
      counts[key] = (counts[key] || 0) + 1;

      if (!typeAmounts[key]) typeAmounts[key] = {};
      const amt = Math.abs(tx.balance);
      typeAmounts[key][tx.type] = (typeAmounts[key][tx.type] || 0) + amt;
    }

    // Find year range
    const dates = txs.map(t => t.date);
    if (dates.length === 0) return { years: [], counts, typeAmounts };
    const minYear = parseInt(dates[0].slice(0, 4));
    const maxYear = parseInt(dates[dates.length - 1].slice(0, 4));
    const years = [];
    for (let y = minYear; y <= maxYear; y++) years.push(y);

    return { years, counts, typeAmounts };
  }

  function renderHeatmap(data) {
    if (data.years.length === 0) return '<div class="empty-state"><div class="empty-state__text">No data</div></div>';

    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const maxCount = Math.max(...Object.values(data.counts), 1);
    const typeOrder = ['MKT', 'ETF', 'CRP', 'RSC', 'FUN'];

    let html = `<div class="heatmap-labels">${monthLabels.map(m => `<span>${m}</span>`).join('')}</div>`;

    for (const year of data.years) {
      html += `<div class="heatmap-year-label" data-year="${year}">${year}</div>`;
      html += '<div class="heatmap-grid">';
      for (let m = 1; m <= 12; m++) {
        const key = `${year}-${String(m).padStart(2, '0')}`;
        const count = data.counts[key] || 0;
        const level = count === 0 ? '' : count <= maxCount * 0.25 ? 'l1' : count <= maxCount * 0.5 ? 'l2' : count <= maxCount * 0.75 ? 'l3' : 'l4';

        // Build type proportion bar
        let typeBar = '';
        const amounts = data.typeAmounts[key];
        if (amounts) {
          const total = Object.values(amounts).reduce((s, v) => s + v, 0);
          if (total > 0) {
            typeBar = '<div class="heatmap-type-bar">';
            for (const t of typeOrder) {
              if (amounts[t]) {
                const pct = (amounts[t] / total) * 100;
                typeBar += `<div class="heatmap-type-bar__seg" style="width:${pct}%;background:${Config.getTypeColor(t)};" title="${t}: ${Math.round(pct)}%"></div>`;
              }
            }
            typeBar += '</div>';
          }
        }

        html += `<div class="heatmap-cell heatmap-cell--clickable ${level}" data-month="${key}" title="${key}: ${count} txs">${count || ''}${typeBar}</div>`;
      }
      html += '</div>';
    }

    return html;
  }

  function attachHeatmapHandlers() {
    // Click on month cells
    document.querySelectorAll('.heatmap-cell--clickable').forEach(cell => {
      cell.addEventListener('click', (e) => {
        e.stopPropagation();
        const monthKey = cell.dataset.month;
        if (!monthKey) return;

        const [y, m] = monthKey.split('-');
        const dateFrom = `${y}-${m}-01`;
        const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
        const dateTo = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;

        // Update sidebar date inputs BEFORE triggering refresh
        const fromInput = document.getElementById('filter-date-from');
        const toInput = document.getElementById('filter-date-to');
        if (fromInput) fromInput.value = dateFrom;
        if (toInput) toInput.value = dateTo;

        // Batch both filters → single refresh
        AppState.setFilters({ dateFrom, dateTo });
      });
    });

    // Click on year labels
    document.querySelectorAll('.heatmap-year-label').forEach(label => {
      label.addEventListener('click', (e) => {
        e.stopPropagation();
        const year = label.dataset.year;
        if (!year) return;

        const dateFrom = `${year}-01-01`;
        const dateTo = `${year}-12-31`;

        const fromInput = document.getElementById('filter-date-from');
        const toInput = document.getElementById('filter-date-to');
        if (fromInput) fromInput.value = dateFrom;
        if (toInput) toInput.value = dateTo;

        AppState.setFilters({ dateFrom, dateTo });
      });
    });
  }

  return { render };
})();
