/* ── Chart.js Wrapper with Dark Theme ── */
const Charts = (() => {

  // Global Chart.js defaults for dark theme
  function initDefaults() {
    const defaults = Chart.defaults;
    defaults.color = '#8b949e';
    defaults.borderColor = '#21262d';
    defaults.font.family = "'Inter', sans-serif";
    defaults.font.size = 11;
    defaults.plugins.legend.labels.boxWidth = 12;
    defaults.plugins.legend.labels.padding = 16;
    defaults.plugins.tooltip.backgroundColor = '#161b22';
    defaults.plugins.tooltip.borderColor = '#30363d';
    defaults.plugins.tooltip.borderWidth = 1;
    defaults.plugins.tooltip.titleColor = '#e6edf3';
    defaults.plugins.tooltip.bodyColor = '#8b949e';
    defaults.plugins.tooltip.padding = 10;
    defaults.plugins.tooltip.cornerRadius = 6;
    defaults.plugins.tooltip.titleFont.weight = '600';
    defaults.animation = false;
    defaults.scale.grid.color = '#21262d';
    defaults.scale.ticks.color = '#484f58';
  }

  // Store chart instances for cleanup
  const instances = {};

  function destroy(id) {
    if (instances[id]) {
      instances[id].destroy();
      delete instances[id];
    }
  }

  function destroyAll() {
    for (const id of Object.keys(instances)) {
      destroy(id);
    }
  }

  /**
   * Create or update a chart.
   * @param {string} canvasId - Canvas element ID
   * @param {object} config - Chart.js config
   * @returns {Chart} instance
   */
  function create(canvasId, config) {
    destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      console.warn('Canvas not found:', canvasId);
      return null;
    }
    const chart = new Chart(canvas.getContext('2d'), config);
    instances[canvasId] = chart;
    return chart;
  }

  // ── Preset chart configs ──

  function doughnut(canvasId, labels, values, colors) {
    return create(canvasId, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderColor: '#0d1117',
          borderWidth: 2,
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'right',
            labels: { padding: 12, usePointStyle: true, pointStyleWidth: 10 },
          },
          tooltip: {
            callbacks: {
              label: ctx => {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const pct = ((ctx.parsed / total) * 100).toFixed(1);
                return ` ${ctx.label}: ${UI.currency(ctx.parsed)} (${pct}%)`;
              },
            },
          },
        },
      },
    });
  }

  function line(canvasId, labels, datasets, opts = {}) {
    return create(canvasId, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        scales: {
          x: {
            grid: { display: false },
            ticks: { maxTicksLimit: opts.maxTicks || 12 },
          },
          y: {
            ticks: {
              callback: v => UI.currencyCompact(v),
            },
          },
        },
        plugins: {
          legend: { display: datasets.length > 1 },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: ${UI.currency(ctx.parsed.y)}`,
            },
          },
          ...(opts.annotations ? { annotation: { annotations: opts.annotations } } : {}),
        },
      },
    });
  }

  function bar(canvasId, labels, datasets, opts = {}) {
    return create(canvasId, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        scales: {
          x: {
            grid: { display: false },
            stacked: opts.stacked || false,
          },
          y: {
            stacked: opts.stacked || false,
            ticks: {
              callback: v => UI.currencyCompact(v),
            },
          },
        },
        plugins: {
          legend: { display: datasets.length > 1 },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: ${UI.currency(ctx.parsed.y)}`,
            },
          },
        },
      },
    });
  }

  function area(canvasId, labels, data, opts = {}) {
    return line(canvasId, labels, [{
      label: opts.label || 'Value',
      data,
      borderColor: opts.color || '#58a6ff',
      backgroundColor: (opts.color || '#58a6ff') + '20',
      fill: true,
      tension: 0.3,
      pointRadius: 0,
      pointHoverRadius: 4,
      borderWidth: 2,
    }], opts);
  }

  return { initDefaults, create, destroy, destroyAll, doughnut, line, bar, area };
})();
