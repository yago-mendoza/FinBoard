/* ── Onboarding: Minimal wizard for first-time users ── */
const OnboardingView = (() => {

  let step = 0;
  let files = [];
  let result = null;
  let cash = {};
  let platforms = [];
  let addingPlatform = false;
  let warningsOpen = false;

  const STEPS = 7;

  function render(container, startStep) {
    step = startStep || 0;
    files = [];
    result = null;
    cash = {};
    platforms = [];
    addingPlatform = false;
    warningsOpen = false;

    const screen = document.getElementById('loader-screen');
    screen.innerHTML = '<div class="onb" id="onb"></div>';
    screen.classList.remove('hidden');
    renderStep();
  }

  function renderStep() {
    const root = document.getElementById('onb');
    if (!root) return;

    const pct = Math.round((step / (STEPS - 1)) * 100);
    const showFooter = step > 0 && step < STEPS - 1;

    root.innerHTML = `
      <div class="onb__bar"><div class="onb__bar-fill" style="width:${pct}%"></div></div>
      <div class="onb__scroll">
        <div class="onb__step" id="onb-step">${getStepHTML()}</div>
      </div>
      ${showFooter ? getFooter() : ''}
    `;

    requestAnimationFrame(() => {
      document.getElementById('onb-step')?.classList.add('entering');
    });
    bindStep();
  }

  function getStepHTML() {
    switch (step) {
      case 0: return stepWelcome();
      case 1: return stepCrypto();
      case 2: return stepFormat();
      case 3: return stepUpload();
      case 4: return stepValidation();
      case 5: return stepCash();
      case 6: return stepLaunch();
      default: return '';
    }
  }

  function getFooter() {
    const canNext = step === 3 ? files.length > 0
                  : step === 4 ? result?.canProceed
                  : true;
    const hideNext = step === 4 && result && !result.canProceed;

    return `
      <div class="onb__footer">
        <button class="btn btn--ghost btn--sm" id="onb-back">Back</button>
        ${!hideNext ? `
          <div class="onb__footer-right">
            ${step === 5 ? '<button class="btn btn--ghost btn--sm" id="onb-skip">Skip</button>' : ''}
            <button class="btn btn--primary" id="onb-next" ${canNext ? '' : 'disabled'}>Continue</button>
          </div>
        ` : ''}
      </div>
    `;
  }

  // ── Step 0: Welcome ──────────────────────────────

  function stepWelcome() {
    const saved = AppState.restore();
    return `
      <div class="onb__welcome">
        <h1 class="onb__brand">FinBoard</h1>
        <p class="onb__tagline">
          Track your investments across brokers.<br>
          Stocks, ETFs, crypto, funds &mdash; one dashboard,<br>
          100% in your browser.
        </p>
        <button class="btn btn--primary onb__cta" id="onb-start">Get started</button>
        <div class="onb__links">
          ${saved ? `<button class="onb__link" id="onb-restore">Restore session (${UI.relativeTime(saved.savedAt)})</button>` : ''}
          <button class="onb__link" id="onb-demo">Try with demo data</button>
        </div>
      </div>
    `;
  }

  // ── Step 1: Crypto ───────────────────────────────

  function stepCrypto() {
    const val = Settings.get('hasCrypto');
    return `
      <h2 class="onb__title">Do you hold crypto?</h2>
      <p class="onb__desc">You can change this anytime in settings.</p>
      <div class="onb__choices">
        <button class="onb__choice ${val ? 'selected' : ''}" data-val="yes">
          <strong>Yes</strong>
          <span>Stocks, ETFs and crypto</span>
        </button>
        <button class="onb__choice ${!val ? 'selected' : ''}" data-val="no">
          <strong>No</strong>
          <span>Stocks and ETFs only</span>
        </button>
      </div>
    `;
  }

  // ── Step 2: Format guide ─────────────────────────

  function stepFormat() {
    return `
      <h2 class="onb__title">Prepare your CSV</h2>
      <p class="onb__desc">Each line is one transaction, columns separated by <code>|</code></p>

      <div class="onb__ref">
        <div class="onb__ref-row"><span class="onb__ref-col">DATETIME</span><span>YY-MM-DD-HH-MM</span></div>
        <div class="onb__ref-row"><span class="onb__ref-col">TYPE</span><span>MKT &middot; ETF &middot; CRP &middot; RSC &middot; FUN</span></div>
        <div class="onb__ref-row"><span class="onb__ref-col">PLATFORM</span><span>Broker code (IBKR, ETOR, BINA&hellip;)</span></div>
        <div class="onb__ref-row"><span class="onb__ref-col">ACTION</span><span>buy or sel</span></div>
        <div class="onb__ref-row"><span class="onb__ref-col">SYMBOL</span><span>Ticker (AAPL, BTC, SPY&hellip;)</span></div>
        <div class="onb__ref-row"><span class="onb__ref-col">QUANTITY</span><span>Units (e.g. +4.0)</span></div>
        <div class="onb__ref-row"><span class="onb__ref-col">PRICE</span><span>Price per unit</span></div>
        <div class="onb__ref-row"><span class="onb__ref-col">BALANCE</span><span>Cash impact (negative = buy)</span></div>
      </div>

      <div class="onb__example">
        <code>23-02-10-09-30|MKT|ETOR|buy|AAPL|+4.0|152.30|-609.20</code>
      </div>

      <p class="onb__hint">No file ready? Ask an AI to convert your broker exports.</p>
      <button class="btn btn--ghost btn--sm" id="onb-copy-guide">Copy guide for AI assistant</button>
    `;
  }

  // ── Step 3: Upload ───────────────────────────────

  function stepUpload() {
    return `
      <h2 class="onb__title">Upload transactions</h2>
      <p class="onb__desc">Drop one or more .csv files. All asset types can go in the same file.</p>

      <div class="onb__drop" id="onb-drop">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.4">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
        </svg>
        <span>Drop CSV files here or click to browse</span>
        <input type="file" accept=".csv,.txt" multiple hidden id="onb-file-input">
      </div>

      ${files.length > 0 ? `
        <div class="onb__files">
          ${files.map((f, i) => `
            <div class="onb__file">
              <span class="onb__file-name">${f.name}</span>
              <span class="onb__file-size">${(f.size / 1024).toFixed(1)} KB</span>
              <button class="onb__file-rm" data-idx="${i}">&times;</button>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;
  }

  // ── Step 4: Validation ───────────────────────────

  function stepValidation() {
    if (!result) return '<p class="onb__desc">Checking&hellip;</p>';

    const { errors, warnings, summary, canProceed } = result;

    if (canProceed) {
      const parts = [];
      if (summary.platforms?.length) parts.push(`${summary.platforms.length} platform${summary.platforms.length > 1 ? 's' : ''}`);
      if (summary.symbols?.length) parts.push(`${summary.symbols.length} asset${summary.symbols.length > 1 ? 's' : ''}`);
      const meta = parts.join(' &middot; ');

      let warningsHTML = '';
      if (warnings.length > 0) {
        warningsHTML = `
          <button class="onb__toggle" id="onb-toggle-warn">
            ${warnings.length} warning${warnings.length > 1 ? 's' : ''} &mdash; ${warningsOpen ? 'hide' : 'show'}
          </button>
          ${warningsOpen ? `
            <div class="onb__issues">
              ${warnings.slice(0, 12).map(w => `
                <div class="onb__issue onb__issue--warn">
                  ${w.row > 0 ? `<span class="onb__issue-row">Row ${w.row}</span>` : ''}${w.msg}
                </div>
              `).join('')}
              ${warnings.length > 12 ? `<div class="onb__issue" style="color:var(--text-muted)">&hellip;and ${warnings.length - 12} more</div>` : ''}
            </div>
          ` : ''}
        `;
      }

      return `
        <div class="onb__result">
          <svg class="onb__result-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" stroke-width="2" stroke-linecap="round">
            <circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/>
          </svg>
          <h2 class="onb__title">${summary.totalRows} transactions validated</h2>
          <p class="onb__desc">${meta}</p>
        </div>
        ${warningsHTML}
      `;
    }

    // Errors — can't proceed
    return `
      <div class="onb__result">
        <svg class="onb__result-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" stroke-width="2" stroke-linecap="round">
          <circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>
        </svg>
        <h2 class="onb__title">${errors.length} error${errors.length > 1 ? 's' : ''} found</h2>
        <p class="onb__desc">Fix these in your CSV and re-upload.</p>
      </div>
      <div class="onb__issues">
        ${errors.slice(0, 15).map(e => `
          <div class="onb__issue onb__issue--err">
            ${e.row > 0 ? `<span class="onb__issue-row">Row ${e.row}</span>` : ''}${e.msg}
          </div>
        `).join('')}
        ${errors.length > 15 ? `<div class="onb__issue" style="color:var(--text-muted)">&hellip;and ${errors.length - 15} more</div>` : ''}
      </div>
    `;
  }

  // ── Step 5: Cash ─────────────────────────────────

  function stepCash() {
    if (result?.summary?.platforms) {
      platforms = [...new Set([...result.summary.platforms, ...platforms])];
    }
    const all = [...new Set([...platforms, ...Object.keys(cash)])];

    const rows = all.map(p => {
      const label = Config.getPlatformLabel(p);
      const display = label !== p ? `${label} <small>(${p})</small>` : p;
      return `
        <div class="onb__account">
          <span class="onb__account-name">${display}</span>
          <input type="number" class="input input--sm onb__account-input" data-platform="${p}"
            value="${cash[p] || ''}" placeholder="0.00" step="0.01" min="0">
        </div>
      `;
    }).join('');

    const addHTML = addingPlatform ? `
      <div class="onb__account-add">
        <input type="text" class="input input--sm" id="add-code" placeholder="Code (e.g. BBVA)" maxlength="6" style="max-width:100px">
        <span class="onb__account-preview" id="add-preview"></span>
        <button class="btn btn--primary btn--sm" id="add-confirm">Add</button>
        <button class="btn btn--ghost btn--sm" id="add-cancel">Cancel</button>
      </div>
    ` : '<button class="onb__link" id="onb-add-platform" style="margin-top:var(--sp-2)">+ Add an account</button>';

    return `
      <h2 class="onb__title">Cash balances</h2>
      <p class="onb__desc">Enter uninvested cash in your accounts. This is optional.</p>
      <div class="onb__accounts">
        ${rows || '<p style="color:var(--text-muted);font-size:var(--font-xs)">No platforms detected. Add one below.</p>'}
        ${addHTML}
      </div>
    `;
  }

  // ── Step 6: Launch ───────────────────────────────

  function stepLaunch() {
    return `
      <div class="onb__launch">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>
        <h2 class="onb__title">Ready</h2>
        <p class="onb__desc" style="margin-bottom:var(--sp-3)">Live prices will load once the dashboard opens.</p>
        <button class="btn btn--primary onb__cta" id="onb-launch">Launch dashboard</button>
      </div>
    `;
  }

  // ── Bind event handlers ──────────────────────────

  function bindStep() {
    document.getElementById('onb-back')?.addEventListener('click', () => { step--; renderStep(); });
    document.getElementById('onb-next')?.addEventListener('click', handleNext);
    document.getElementById('onb-skip')?.addEventListener('click', () => { step++; renderStep(); });
    document.getElementById('onb-launch')?.addEventListener('click', doLaunch);

    switch (step) {
      case 0: bindWelcome(); break;
      case 1: bindCrypto(); break;
      case 2: bindFormat(); break;
      case 3: bindUpload(); break;
      case 4: bindValidation(); break;
      case 5: bindCash(); break;
    }
  }

  function handleNext() {
    if (step === 3) { runValidation(); return; }
    step++;
    renderStep();
  }

  function bindWelcome() {
    document.getElementById('onb-start')?.addEventListener('click', () => { step = 1; renderStep(); });
    document.getElementById('onb-restore')?.addEventListener('click', () => {
      const saved = AppState.restore();
      if (saved?.transactions?.length) {
        const txs = saved.transactions.map(t => ({ ...t, dateObj: new Date(t.datetime) }));
        LoaderView.launchApp(txs, saved.cashBalances || {});
      }
    });
    document.getElementById('onb-demo')?.addEventListener('click', () => {
      LoaderView.launchApp(Parser.parseCSV(DemoData.getUnifiedCSV()), DemoData.getCashBalances());
    });
  }

  function bindCrypto() {
    document.querySelectorAll('.onb__choice').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.onb__choice').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        Settings.set('hasCrypto', card.dataset.val === 'yes');
      });
    });
  }

  function bindFormat() {
    document.getElementById('onb-copy-guide')?.addEventListener('click', (e) => {
      const btn = e.currentTarget;
      navigator.clipboard.writeText(getGuideText()).then(() => {
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Copy guide for AI assistant', 2000);
      }).catch(() => UI.toast('Failed to copy', 'error'));
    });
  }

  function bindUpload() {
    const zone = document.getElementById('onb-drop');
    const input = document.getElementById('onb-file-input');
    const root = document.getElementById('onb');
    if (!zone || !input) return;

    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('dragover');
      addFiles(e.dataTransfer.files);
    });
    input.addEventListener('change', () => { addFiles(input.files); input.value = ''; });

    // Full-screen drop: accept files dragged anywhere on the page
    if (root) {
      root.addEventListener('dragover', e => {
        e.preventDefault();
        zone.classList.add('dragover');
      });
      root.addEventListener('dragleave', e => {
        // Only remove highlight when leaving the root entirely
        if (!root.contains(e.relatedTarget)) zone.classList.remove('dragover');
      });
      root.addEventListener('drop', e => {
        e.preventDefault();
        zone.classList.remove('dragover');
        if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
      });
    }

    document.querySelectorAll('.onb__file-rm').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        files.splice(parseInt(btn.dataset.idx), 1);
        renderStep();
      });
    });
  }

  function bindValidation() {
    document.getElementById('onb-toggle-warn')?.addEventListener('click', () => {
      warningsOpen = !warningsOpen;
      renderStep();
    });
  }

  function bindCash() {
    document.querySelectorAll('.onb__account-input').forEach(input => {
      input.addEventListener('input', () => {
        const v = parseFloat(input.value);
        if (!isNaN(v) && v > 0) cash[input.dataset.platform] = v;
        else delete cash[input.dataset.platform];
      });
    });

    document.getElementById('onb-add-platform')?.addEventListener('click', () => {
      addingPlatform = true;
      renderStep();
    });

    const codeInput = document.getElementById('add-code');
    const preview = document.getElementById('add-preview');
    if (codeInput) {
      codeInput.focus();
      codeInput.addEventListener('input', () => {
        const code = codeInput.value.trim().toUpperCase();
        if (preview) {
          const label = code.length >= 2 ? Config.getPlatformLabel(code) : '';
          preview.textContent = label && label !== code ? label : (code.length >= 2 ? 'Custom' : '');
        }
      });
    }

    document.getElementById('add-confirm')?.addEventListener('click', () => {
      const code = document.getElementById('add-code')?.value.trim().toUpperCase();
      if (code?.length >= 2) {
        if (!platforms.includes(code)) platforms.push(code);
        addingPlatform = false;
        renderStep();
      }
    });

    document.getElementById('add-cancel')?.addEventListener('click', () => {
      addingPlatform = false;
      renderStep();
    });
  }

  // ── Utilities ────────────────────────────────────

  function addFiles(fileList) {
    for (const f of fileList) {
      if (!files.some(u => u.name === f.name && u.size === f.size)) {
        files.push(f);
      }
    }
    renderStep();
  }

  async function runValidation() {
    let allText = '';
    for (const f of files) {
      const text = await Parser.readFileText(f);
      if (allText) {
        const lines = text.trim().split(/\r?\n/);
        const hasHeader = lines[0].toLowerCase().includes('datetime') || lines[0].toLowerCase().includes('symbol');
        allText += '\n' + (hasHeader ? lines.slice(1).join('\n') : text);
      } else {
        allText = text;
      }
    }
    result = Validator.validateCSV(allText);
    Validator.categorizeResults(result, Settings.get('hasCrypto'));
    step = 4;
    renderStep();
  }

  async function doLaunch() {
    let rows = [];
    for (const f of files) {
      rows = rows.concat(await Parser.readFile(f));
    }
    rows.sort((a, b) => a.dateObj - b.dateObj);
    if (!rows.length) { UI.toast('No valid transactions', 'error'); return; }
    LoaderView.launchApp(rows, cash);
  }

  function getGuideText() {
    return `I need help converting my investment data into a CSV for FinBoard.

Format: pipe-delimited, 8 columns:
DATETIME|TYPE|PLATFORM|ACTION|SYMBOL|QUANTITY|PRICE|BALANCE

- DATETIME: YY-MM-DD-HH-MM (e.g. 23-02-10-09-30)
- TYPE: MKT (stocks), ETF, CRP (crypto), RSC (resources), FUN (funds)
- PLATFORM: Broker code (IBKR, ETOR, BINA, TDRP, etc.)
- ACTION: "buy" or "sel" (sell)
- SYMBOL: Ticker (AAPL, BTC, SPY...)
- QUANTITY: Units (+ prefix optional, e.g. +4.0)
- PRICE: Price per unit
- BALANCE: Cash impact (negative for buys, positive for sells)

Example:
DATETIME|TYPE|PLATFORM|ACTION|SYMBOL|QUANTITY|PRICE|BALANCE
23-02-10-09-30|MKT|ETOR|buy|AAPL|+4.0|152.30|-609.20
24-04-01-10-00|CRP|BINA|buy|BTC|+0.05|42000|-2100.00
24-06-15-14-00|MKT|IBKR|sel|MSFT|-2.0|420.50|+841.00

Here is my raw data — please convert each transaction:

[PASTE YOUR DATA HERE]`;
  }

  return { render };
})();
