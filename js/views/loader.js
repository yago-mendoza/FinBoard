/* ── Loader View: CSV drop zones + restore session ── */
const LoaderView = (() => {

  let stockFile = null;
  let cryptoFile = null;

  function render(container) {
    const screen = document.getElementById('loader-screen');
    screen.innerHTML = '';
    screen.classList.remove('hidden');

    const saved = AppState.restore();

    screen.innerHTML = `
      <div class="loader-container">
        <div class="loader-header">
          <h1>FinBoard</h1>
          <p>Financial Portfolio Dashboard</p>
        </div>

        <div class="loader-zones">
          <div class="dropzone" id="drop-stock">
            <div class="dropzone__icon">&#128200;</div>
            <div class="dropzone__label">Stock Register</div>
            <div class="dropzone__sub">Drop register_stock.csv here</div>
            <input type="file" accept=".csv" hidden id="file-stock">
          </div>
          <div class="dropzone" id="drop-crypto">
            <div class="dropzone__icon">&#9851;</div>
            <div class="dropzone__label">Crypto Register</div>
            <div class="dropzone__sub">Drop register_crypto.csv here</div>
            <input type="file" accept=".csv" hidden id="file-crypto">
          </div>
        </div>

        <div class="loader-actions">
          <button class="btn btn--primary" id="btn-launch" disabled>Launch Dashboard</button>
          <button class="btn btn--ghost" id="btn-demo">Load demo data</button>
          ${saved ? `
            <button class="btn btn--ghost" id="btn-restore">
              Restore previous session (${UI.relativeTime(saved.savedAt)}, ${saved.transactions.length} transactions)
            </button>
          ` : ''}
        </div>
      </div>
    `;

    // Drop zone handlers
    setupDropzone('drop-stock', 'file-stock', file => {
      stockFile = file;
      updateLaunchBtn();
    });
    setupDropzone('drop-crypto', 'file-crypto', file => {
      cryptoFile = file;
      updateLaunchBtn();
    });

    // Launch button
    document.getElementById('btn-launch').addEventListener('click', async () => {
      try {
        const stockRows = stockFile ? await Parser.readFile(stockFile) : [];
        const cryptoRows = cryptoFile ? await Parser.readFile(cryptoFile) : [];
        const merged = Parser.merge(stockRows, cryptoRows);

        if (merged.length === 0) {
          UI.toast('No valid transactions found in CSV files', 'error');
          return;
        }

        launchApp(merged);
      } catch (e) {
        UI.toast('Error parsing CSV: ' + e.message, 'error');
      }
    });

    // Demo button
    document.getElementById('btn-demo').addEventListener('click', () => {
      const stockRows = Parser.parseCSV(DemoData.getStockCSV());
      const cryptoRows = Parser.parseCSV(DemoData.getCryptoCSV());
      const merged = Parser.merge(stockRows, cryptoRows);

      if (merged.length === 0) {
        UI.toast('No demo data found', 'error');
        return;
      }

      launchApp(merged);
    });

    // Restore button
    const restoreBtn = document.getElementById('btn-restore');
    if (restoreBtn) {
      restoreBtn.addEventListener('click', () => {
        const saved = AppState.restore();
        if (saved && saved.transactions.length > 0) {
          // Reconstruct dateObj from stored data
          const txs = saved.transactions.map(t => ({
            ...t,
            dateObj: new Date(t.datetime),
          }));
          launchApp(txs);
        }
      });
    }
  }

  function setupDropzone(zoneId, inputId, onFile) {
    const zone = document.getElementById(zoneId);
    const input = document.getElementById(inputId);

    zone.addEventListener('click', () => input.click());

    zone.addEventListener('dragover', e => {
      e.preventDefault();
      zone.classList.add('dragover');
    });

    zone.addEventListener('dragleave', () => {
      zone.classList.remove('dragover');
    });

    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file) markLoaded(zone, file, onFile);
    });

    input.addEventListener('change', () => {
      const file = input.files[0];
      if (file) markLoaded(zone, file, onFile);
    });
  }

  function markLoaded(zone, file, onFile) {
    zone.classList.add('loaded');
    zone.querySelector('.dropzone__sub').textContent = file.name;
    onFile(file);
  }

  function updateLaunchBtn() {
    const btn = document.getElementById('btn-launch');
    btn.disabled = !(stockFile || cryptoFile);
  }

  function launchApp(transactions) {
    // Adjust pre-split quantities/prices (idempotent on restore)
    transactions = Portfolio.applySplits(transactions);
    AppState.set('rawTransactions', transactions);
    AppState.set('dataLoaded', true);
    AppState.persist();

    // Compute holdings
    const holdings = Portfolio.computeHoldings(transactions);
    AppState.set('holdings', holdings);

    // Hide loader, show app shell
    document.getElementById('loader-screen').classList.add('hidden');
    document.getElementById('app-shell').classList.remove('hidden');

    // Build sidebar filters
    App.buildFilters();

    // Start router
    Router.navigate('dashboard');
    Router.start();

    // Fetch prices in background
    App.fetchAndApplyPrices();

    UI.toast(`Loaded ${transactions.length} transactions`, 'success');
  }

  return { render };
})();
