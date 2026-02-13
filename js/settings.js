/* ── Settings Module ── */
const Settings = (() => {

  const STORAGE_KEY = 'finboard_settings';

  const DEFAULTS = {
    hasCrypto: true,
    theme: 'dark',
    dashboardLayout: null,
    autoRefreshPrices: true,
    closedPositions: true,
  };

  let current = null;

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      current = raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
    } catch (e) {
      console.warn('Settings load failed:', e);
      current = { ...DEFAULTS };
    }
    return current;
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch (e) {
      console.warn('Settings save failed:', e);
    }
  }

  function get(key) {
    if (!current) load();
    return key ? current[key] : { ...current };
  }

  function set(key, value) {
    if (!current) load();
    current[key] = value;
    save();
    EventBus.emit('settings:changed', { key, value });
  }

  function reset() {
    current = { ...DEFAULTS };
    save();
    EventBus.emit('settings:reset');
  }

  function resetAllData() {
    AppState.clearStorage();
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('finboard_layout');
    current = { ...DEFAULTS };
  }

  // ── Cash balances helpers ──
  function getCashPlatforms() {
    const cash = AppState.get('cashBalances') || {};
    const txs = AppState.get('rawTransactions') || [];
    const txPlatforms = [...new Set(txs.map(t => t.platform))];
    const cashPlatforms = Object.keys(cash);
    return [...new Set([...txPlatforms, ...cashPlatforms])].sort();
  }

  function renderCashEditor() {
    const cash = AppState.get('cashBalances') || {};
    const platforms = getCashPlatforms();

    if (platforms.length === 0) {
      return `<p style="font-size:var(--font-xs); color:var(--text-muted);">No platforms found. Load transactions first.</p>`;
    }

    return platforms.map(p => {
      const label = Config.getPlatformLabel(p);
      const display = label !== p ? `${label} <small style="color:var(--text-muted);">(${p})</small>` : p;
      return `
        <div class="settings-cash-row">
          <span class="settings-cash-label">${display}</span>
          <input type="number" class="input input--sm settings-cash-input" data-platform="${p}"
            value="${cash[p] || ''}" placeholder="0.00" step="0.01" min="0">
        </div>
      `;
    }).join('') + `
      <div class="settings-cash-add">
        <input type="text" class="input input--sm" id="settings-add-platform" placeholder="Code (e.g. BBVA)" maxlength="6" style="max-width:110px;">
        <button class="btn btn--ghost btn--sm" id="settings-add-platform-btn">Add</button>
      </div>
    `;
  }

  function renderPanel() {
    const s = get();
    return `
      <div class="settings-panel__header">
        <h2 class="settings-panel__title">Settings</h2>
        <button class="btn btn--icon settings-panel__close" id="settings-close">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
            <path d="M4.5 4.5l9 9M13.5 4.5l-9 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>
          </svg>
        </button>
      </div>

      <div class="settings-panel__body">
        <div class="settings-group">
          <div class="settings-group__header">
            <span class="settings-group__label">Crypto portfolio</span>
            <label class="toggle-switch">
              <input type="checkbox" id="setting-crypto" ${s.hasCrypto ? 'checked' : ''}>
              <span class="toggle-switch__slider"></span>
            </label>
          </div>
          <p class="settings-group__desc">Include cryptocurrency assets. Disable if you only track stocks and ETFs.</p>
        </div>

        <div class="settings-group">
          <div class="settings-group__header">
            <span class="settings-group__label">Auto-refresh prices</span>
            <label class="toggle-switch">
              <input type="checkbox" id="setting-auto-refresh" ${s.autoRefreshPrices ? 'checked' : ''}>
              <span class="toggle-switch__slider"></span>
            </label>
          </div>
          <p class="settings-group__desc">Automatically fetch live prices when the dashboard loads.</p>
        </div>

        <div class="settings-group">
          <div class="settings-group__header">
            <span class="settings-group__label">Show closed positions</span>
            <label class="toggle-switch">
              <input type="checkbox" id="setting-closed" ${s.closedPositions ? 'checked' : ''}>
              <span class="toggle-switch__slider"></span>
            </label>
          </div>
          <p class="settings-group__desc">Show fully sold positions in the holdings table.</p>
        </div>

        <div class="settings-divider"></div>

        <div class="settings-group">
          <span class="settings-group__label">Cash balances</span>
          <p class="settings-group__desc">Uninvested cash in your broker accounts. Shown on the dashboard as a separate KPI.</p>
          <div class="settings-cash-editor" id="settings-cash-editor">
            ${renderCashEditor()}
          </div>
        </div>

        <div class="settings-divider"></div>

        <div class="settings-group">
          <span class="settings-group__label">Dashboard layout</span>
          <p class="settings-group__desc">Reset widget positions to default order.</p>
          <button class="btn btn--ghost btn--sm" id="setting-reset-layout">Reset layout</button>
        </div>

        <div class="settings-divider"></div>

        <div class="settings-group settings-group--danger">
          <span class="settings-group__label">Danger zone</span>
          <p class="settings-group__desc">Clear all saved data, settings, and return to onboarding.</p>
          <button class="btn btn--danger btn--sm" id="setting-reset-all">Reset all data</button>
        </div>
      </div>
    `;
  }

  function bindPanel() {
    const closeBtn = document.getElementById('settings-close');
    if (closeBtn) closeBtn.addEventListener('click', togglePanel);

    const cryptoToggle = document.getElementById('setting-crypto');
    if (cryptoToggle) {
      cryptoToggle.addEventListener('change', (e) => {
        set('hasCrypto', e.target.checked);
        UI.toast(e.target.checked ? 'Crypto enabled' : 'Crypto disabled', 'success');
      });
    }

    const autoRefreshToggle = document.getElementById('setting-auto-refresh');
    if (autoRefreshToggle) {
      autoRefreshToggle.addEventListener('change', (e) => {
        set('autoRefreshPrices', e.target.checked);
      });
    }

    const closedToggle = document.getElementById('setting-closed');
    if (closedToggle) {
      closedToggle.addEventListener('change', (e) => {
        set('closedPositions', e.target.checked);
        Router.refresh();
      });
    }

    // Cash editor
    document.querySelectorAll('.settings-cash-input').forEach(input => {
      input.addEventListener('change', () => {
        const cash = AppState.get('cashBalances') || {};
        const val = parseFloat(input.value);
        if (!isNaN(val) && val > 0) {
          cash[input.dataset.platform] = val;
        } else {
          delete cash[input.dataset.platform];
        }
        AppState.set('cashBalances', cash);
        AppState.persist();
        Router.refresh();
      });
    });

    // Add platform in cash editor
    document.getElementById('settings-add-platform-btn')?.addEventListener('click', () => {
      const input = document.getElementById('settings-add-platform');
      const code = input?.value.trim().toUpperCase();
      if (code && code.length >= 2) {
        const cash = AppState.get('cashBalances') || {};
        if (!cash[code]) cash[code] = 0;
        AppState.set('cashBalances', cash);
        // Re-render the cash editor section
        const editor = document.getElementById('settings-cash-editor');
        if (editor) {
          editor.innerHTML = renderCashEditor();
          bindCashEditor();
        }
      }
    });

    const resetLayoutBtn = document.getElementById('setting-reset-layout');
    if (resetLayoutBtn) {
      resetLayoutBtn.addEventListener('click', () => {
        localStorage.removeItem('finboard_layout');
        set('dashboardLayout', null);
        if (typeof DragManager !== 'undefined') DragManager.resetLayout();
        UI.toast('Layout reset to default', 'success');
      });
    }

    const resetAllBtn = document.getElementById('setting-reset-all');
    if (resetAllBtn) {
      resetAllBtn.addEventListener('click', () => {
        if (confirm('This will delete ALL your data and settings. Are you sure?')) {
          resetAllData();
          window.location.reload();
        }
      });
    }
  }

  function bindCashEditor() {
    document.querySelectorAll('.settings-cash-input').forEach(input => {
      input.addEventListener('change', () => {
        const cash = AppState.get('cashBalances') || {};
        const val = parseFloat(input.value);
        if (!isNaN(val) && val > 0) {
          cash[input.dataset.platform] = val;
        } else {
          delete cash[input.dataset.platform];
        }
        AppState.set('cashBalances', cash);
        AppState.persist();
        Router.refresh();
      });
    });

    document.getElementById('settings-add-platform-btn')?.addEventListener('click', () => {
      const input = document.getElementById('settings-add-platform');
      const code = input?.value.trim().toUpperCase();
      if (code && code.length >= 2) {
        const cash = AppState.get('cashBalances') || {};
        if (!cash[code]) cash[code] = 0;
        AppState.set('cashBalances', cash);
        const editor = document.getElementById('settings-cash-editor');
        if (editor) {
          editor.innerHTML = renderCashEditor();
          bindCashEditor();
        }
      }
    });
  }

  function togglePanel() {
    const panel = document.getElementById('settings-panel');
    const overlay = document.getElementById('settings-overlay');
    if (!panel) return;

    const isOpen = panel.classList.contains('open');
    if (isOpen) {
      panel.classList.remove('open');
      if (overlay) overlay.classList.remove('open');
    } else {
      panel.innerHTML = renderPanel();
      panel.classList.add('open');
      if (overlay) overlay.classList.add('open');
      bindPanel();
    }
  }

  return { load, save, get, set, reset, resetAllData, renderPanel, bindPanel, togglePanel };
})();
