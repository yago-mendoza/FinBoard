/* ── Loader View: Router for first-time vs returning users ── */
const LoaderView = (() => {

  function render(container) {
    const screen = document.getElementById('loader-screen');
    screen.innerHTML = '';
    screen.classList.remove('hidden');

    const saved = AppState.restore();

    if (saved && saved.transactions.length > 0) {
      // Returning user -> quick restore screen
      renderReturning(screen, saved);
    } else {
      // First-time user -> onboarding wizard
      OnboardingView.render(container);
    }
  }

  function renderReturning(screen, saved) {
    screen.innerHTML = `
      <div class="loader-container">
        <div class="loader-header">
          <h1>FinBoard</h1>
          <p>Welcome back</p>
        </div>

        <div class="loader-actions">
          <button class="btn btn--primary" id="btn-restore">
            Restore session (${UI.relativeTime(saved.savedAt)}, ${saved.transactions.length} transactions)
          </button>
          <button class="btn btn--ghost" id="btn-new-session">Start new session</button>
          <button class="btn btn--ghost" id="btn-demo">Load demo data</button>
        </div>
      </div>
    `;

    // Restore button
    document.getElementById('btn-restore').addEventListener('click', () => {
      const txs = saved.transactions.map(t => ({ ...t, dateObj: new Date(t.datetime) }));
      launchApp(txs, saved.cashBalances || {});
    });

    // New session -> onboarding, skip welcome (step 0) since user already chose
    document.getElementById('btn-new-session').addEventListener('click', () => {
      OnboardingView.render(null, 1);
    });

    // Demo button
    document.getElementById('btn-demo').addEventListener('click', () => {
      const csvText = DemoData.getUnifiedCSV();
      const rows = Parser.parseCSV(csvText);
      const demoCash = DemoData.getCashBalances();
      launchApp(rows, demoCash);
    });
  }

  function launchApp(transactions, cashBalances) {
    // Adjust pre-split quantities/prices (idempotent on restore)
    transactions = Portfolio.applySplits(transactions);
    AppState.set('rawTransactions', transactions);
    AppState.set('cashBalances', cashBalances || {});
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

    // Fetch prices in background (if enabled in settings)
    if (Settings.get('autoRefreshPrices') !== false) {
      App.fetchAndApplyPrices();
    }

    UI.toast(`Loaded ${transactions.length} transactions`, 'success');
  }

  return { render, launchApp };
})();
