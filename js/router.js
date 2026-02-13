/* ── Hash-based Router ── */
const Router = (() => {

  const routes = {};    // { 'dashboard': renderFn, ... }
  let currentView = null;
  let currentParams = null;
  let previousView = null;
  let previousParams = null;

  function register(name, renderFn) {
    routes[name] = renderFn;
  }

  function parseHash() {
    const hash = window.location.hash.slice(1) || 'dashboard';
    const parts = hash.split('/');
    const view = parts[0];
    const params = parts.slice(1).join('/');
    return { view, params };
  }

  function navigate(view, params = '') {
    const hash = params ? `${view}/${params}` : view;
    window.location.hash = hash;
  }

  function handleRoute() {
    const { view, params } = parseHash();

    if (!routes[view]) {
      console.warn('Unknown route:', view);
      navigate('dashboard');
      return;
    }

    previousView = currentView;
    previousParams = currentParams;
    currentView = view;
    currentParams = params;

    // Update sidebar active state
    document.querySelectorAll('.sidebar__link').forEach(link => {
      const linkView = link.dataset.view;
      link.classList.toggle('active',
        linkView === view ||
        (view === 'compare' && linkView === 'market')
      );
    });

    // Update breadcrumb
    const breadcrumb = document.getElementById('breadcrumb');
    const SPECIAL_MARKET = ['search', 'compare'];
    if (view === 'market' && params && !SPECIAL_MARKET.includes(params)) {
      // Asset detail within Market
      const displayName = Config.getDisplayName(params);
      breadcrumb.textContent = `Market / ${displayName}`;
    } else if (view === 'market' && params) {
      const subLabel = params.charAt(0).toUpperCase() + params.slice(1);
      breadcrumb.textContent = `Market / ${subLabel}`;
    } else if (view === 'market') {
      breadcrumb.textContent = 'Market / Search';
    } else if (view === 'analysis' && params) {
      const subLabel = params === 'pnl' ? 'P&L' : params.charAt(0).toUpperCase() + params.slice(1);
      breadcrumb.textContent = `Analysis / ${subLabel}`;
    } else {
      breadcrumb.textContent = view.charAt(0).toUpperCase() + view.slice(1);
    }

    // Destroy all charts before re-rendering
    Charts.destroyAll();

    // Render view
    const content = document.getElementById('content');
    routes[view](content, params);
  }

  /** Re-render current view (e.g., after filter change) */
  function refresh() {
    if (currentView && routes[currentView]) {
      Charts.destroyAll();
      const content = document.getElementById('content');
      routes[currentView](content, currentParams);
    }
  }

  function start() {
    window.addEventListener('hashchange', handleRoute);
    handleRoute();
  }

  function getCurrent() {
    return { view: currentView, params: currentParams };
  }

  function getPrevious() {
    return { view: previousView, params: previousParams };
  }

  return { register, navigate, start, refresh, getCurrent, getPrevious };
})();
