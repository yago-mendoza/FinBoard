/* ── Drag Manager: reorder .widget elements via HTML5 drag & drop ── */
const DragManager = (() => {

  const STORAGE_KEY = 'finboard_layout';
  let container = null;
  let draggedEl = null;

  function init(containerSelector) {
    container = document.querySelector(containerSelector);
    if (!container) return;

    // Disable drag on mobile
    if (window.innerWidth < 768) return;

    const widgets = container.querySelectorAll('.widget');
    widgets.forEach(widget => {
      const handle = widget.querySelector('.widget__drag-handle');
      if (!handle) return;

      handle.setAttribute('draggable', 'true');

      handle.addEventListener('dragstart', (e) => {
        draggedEl = widget;
        widget.classList.add('widget--dragging');
        e.dataTransfer.effectAllowed = 'move';
        // Required for Firefox
        e.dataTransfer.setData('text/plain', widget.dataset.widgetId || '');
      });

      handle.addEventListener('dragend', () => {
        if (draggedEl) draggedEl.classList.remove('widget--dragging');
        draggedEl = null;
        container.querySelectorAll('.widget--drag-over').forEach(w => w.classList.remove('widget--drag-over'));
        saveLayout();
      });

      widget.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (widget !== draggedEl) {
          widget.classList.add('widget--drag-over');
        }
      });

      widget.addEventListener('dragleave', () => {
        widget.classList.remove('widget--drag-over');
      });

      widget.addEventListener('drop', (e) => {
        e.preventDefault();
        widget.classList.remove('widget--drag-over');
        if (!draggedEl || draggedEl === widget) return;

        // Determine insert position
        const allWidgets = [...container.querySelectorAll('.widget')];
        const draggedIdx = allWidgets.indexOf(draggedEl);
        const targetIdx = allWidgets.indexOf(widget);

        if (draggedIdx < targetIdx) {
          widget.after(draggedEl);
        } else {
          widget.before(draggedEl);
        }
      });
    });

    // Apply saved layout
    const saved = loadLayout();
    if (saved) applyLayout(saved);
  }

  function saveLayout() {
    if (!container) return;
    const widgets = container.querySelectorAll('.widget');
    const order = [...widgets].map(w => w.dataset.widgetId).filter(Boolean);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
    } catch (e) {
      console.warn('Layout save failed:', e);
    }
  }

  function loadLayout() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function applyLayout(order) {
    if (!container || !order || !order.length) return;

    const widgets = new Map();
    container.querySelectorAll('.widget').forEach(w => {
      if (w.dataset.widgetId) widgets.set(w.dataset.widgetId, w);
    });

    // Reorder DOM
    for (const id of order) {
      const widget = widgets.get(id);
      if (widget) container.appendChild(widget);
    }

    // Append any widgets not in saved layout (new ones)
    widgets.forEach((widget, id) => {
      if (!order.includes(id)) container.appendChild(widget);
    });
  }

  function resetLayout() {
    localStorage.removeItem(STORAGE_KEY);
  }

  /** Apply saved layout to a container selector without enabling drag */
  function applyLayoutTo(selector) {
    container = document.querySelector(selector);
    const saved = loadLayout();
    if (saved) applyLayout(saved);
  }

  return { init, saveLayout, loadLayout, applyLayout, applyLayoutTo, resetLayout };
})();
