/* ── UI Helpers: Formatters, DOM, Toasts ── */
const UI = (() => {

  // ── Formatters ──

  function currency(value, decimals = 2) {
    if (value == null || isNaN(value)) return '—';
    const sign = value < 0 ? '-' : '';
    return sign + '$' + Math.abs(value).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  function currencyCompact(value) {
    if (value == null || isNaN(value)) return '—';
    const abs = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    if (abs >= 1_000_000) return sign + '$' + (abs / 1_000_000).toFixed(1) + 'M';
    if (abs >= 1_000) return sign + '$' + (abs / 1_000).toFixed(1) + 'K';
    return currency(value);
  }

  function pct(value, decimals = 2) {
    if (value == null || isNaN(value)) return '—';
    const sign = value > 0 ? '+' : '';
    return sign + value.toFixed(decimals) + '%';
  }

  function qty(value) {
    if (value == null) return '—';
    if (Math.abs(value) >= 1) return value.toLocaleString('en-US', { maximumFractionDigits: 4 });
    return value.toFixed(6);
  }

  function date(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  }

  function dateShort(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: '2-digit',
    });
  }

  function relativeTime(ts) {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  // ── DOM Helpers ──

  function el(tag, attrs = {}, children = []) {
    const element = document.createElement(tag);
    for (const [key, val] of Object.entries(attrs)) {
      if (key === 'className') element.className = val;
      else if (key === 'textContent') element.textContent = val;
      else if (key === 'innerHTML') element.innerHTML = val;
      else if (key.startsWith('on')) element.addEventListener(key.slice(2).toLowerCase(), val);
      else if (key === 'dataset') Object.assign(element.dataset, val);
      else if (key === 'style' && typeof val === 'object') Object.assign(element.style, val);
      else element.setAttribute(key, val);
    }
    for (const child of [].concat(children)) {
      if (typeof child === 'string') element.appendChild(document.createTextNode(child));
      else if (child) element.appendChild(child);
    }
    return element;
  }

  function clear(container) {
    container.innerHTML = '';
  }

  function $(selector) {
    return document.querySelector(selector);
  }

  function $$(selector) {
    return [...document.querySelectorAll(selector)];
  }

  // ── Badges ──

  function actionBadge(action) {
    const isBuy = action === 'buy';
    return `<span class="badge badge--${isBuy ? 'buy' : 'sell'}">${isBuy ? 'BUY' : 'SELL'}</span>`;
  }

  function typeBadge(type) {
    const label = typeof Config !== 'undefined' && Config.getTypeLabel ? Config.getTypeLabel(type) : type;
    return `<span class="badge badge--${type.toLowerCase()}" title="${label}">${type}</span>`;
  }

  // ── PnL coloring ──

  function plClass(value) {
    if (value > 0) return 'positive';
    if (value < 0) return 'negative';
    return '';
  }

  function plSign(value) {
    return value > 0 ? '+' : '';
  }

  // ── Toasts ──

  function toast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const t = el('div', {
      className: `toast toast--${type}`,
      textContent: message,
    });
    container.appendChild(t);
    setTimeout(() => { t.remove(); }, 4000);
  }

  // ── Help Popup ──

  function helpPopup(sectionKey) {
    const info = typeof HelpTexts !== 'undefined' ? HelpTexts.get(sectionKey) : { title: sectionKey, content: '' };
    // Remove existing popup
    const existing = document.getElementById('help-popup');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'help-popup';
    overlay.className = 'help-popup-overlay';
    overlay.innerHTML = `
      <div class="help-popup">
        <div class="help-popup__title">${info.title}</div>
        <div class="help-popup__body">${info.content}</div>
        <div class="help-popup__hint">Click anywhere or press Esc to close</div>
      </div>
    `;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.addEventListener('click', close);
    const onKey = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } };
    document.addEventListener('keydown', onKey);
  }

  function helpBtn(sectionKey) {
    return `<button class="help-btn" onclick="UI.helpPopup('${sectionKey}')" title="Help">?</button>`;
  }

  // ── Sort helper ──

  function sortable(tableEl, data, renderRow) {
    const headers = tableEl.querySelectorAll('th[data-sort]');
    let currentSort = null;
    let ascending = true;

    headers.forEach(th => {
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        if (currentSort === key) {
          ascending = !ascending;
        } else {
          currentSort = key;
          ascending = true;
        }

        headers.forEach(h => h.classList.remove('sorted-asc', 'sorted-desc'));
        th.classList.add(ascending ? 'sorted-asc' : 'sorted-desc');

        data.sort((a, b) => {
          let va = a[key], vb = b[key];
          if (va == null) return 1;
          if (vb == null) return -1;
          if (typeof va === 'string') {
            va = va.toLowerCase();
            vb = (vb || '').toLowerCase();
          }
          if (va < vb) return ascending ? -1 : 1;
          if (va > vb) return ascending ? 1 : -1;
          return 0;
        });

        const tbody = tableEl.querySelector('tbody');
        tbody.innerHTML = '';
        data.forEach(item => tbody.appendChild(renderRow(item)));
      });
    });
  }

  return {
    currency, currencyCompact, pct, qty, date, dateShort, relativeTime,
    el, clear, $, $$,
    actionBadge, typeBadge, plClass, plSign,
    toast, helpPopup, helpBtn, sortable,
  };
})();
