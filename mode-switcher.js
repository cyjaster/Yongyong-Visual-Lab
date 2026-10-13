// Shell & routing controller. Manages Showcase presentation vs Edit modes on the static page.
(() => {
  const shell = document.querySelector('.app-shell');
  const filterWorkspace = document.querySelector('.workspace');
  const posterWorkspace = document.querySelector('#posterWorkspace');
  const tabs = [...document.querySelectorAll('.mode-tab')];

  let currentMode = 'poster';
  let currentView = 'showcase';

  function applyState({ mode, view }, updateHistory = true) {
    if (mode) currentMode = mode === 'filter' ? 'filter' : 'poster';
    if (view) currentView = view === 'edit' ? 'edit' : 'showcase';

    const isPoster = currentMode === 'poster';
    const isShowcase = currentView === 'showcase';

    // Toggle showcase classes
    document.body.classList.toggle('is-showcase', isShowcase);
    shell.classList.toggle('is-showcase', isShowcase);
    shell.classList.toggle('poster-active', isPoster);

    // Toggle workspaces
    filterWorkspace.hidden = isPoster;
    posterWorkspace.hidden = !isPoster;
    filterWorkspace.style.display = isPoster ? 'none' : (isShowcase ? 'flex' : '');
    posterWorkspace.style.display = isPoster ? (isShowcase ? 'flex' : 'grid') : 'none';

    // Update mode tabs
    tabs.forEach((tab) => {
      const active = tab.dataset.mode === currentMode;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-pressed', String(active));
    });

    // Save preferences
    try {
      localStorage.setItem('visual-lab-mode', currentMode);
      if (updateHistory) {
        const targetHash = isShowcase ? '#showcase' : (isPoster ? '#poster' : '#filter');
        if (window.location.hash !== targetHash) {
          if (history.pushState) history.pushState(null, '', targetHash);
          else window.location.hash = targetHash;
        }
      }
    } catch (_) {}

    // Adapt poster workspace bounds
    if (isPoster && typeof window.posterFitWorkspace === 'function') {
      requestAnimationFrame(() => {
        window.posterFitWorkspace();
      });
    }

    // Broadcast events
    window.dispatchEvent(new CustomEvent('visual-lab-mode-change', { detail: { mode: currentMode, view: currentView } }));
    window.dispatchEvent(new CustomEvent('visual-lab-view-change', { detail: { mode: currentMode, view: currentView } }));
  }

  function setMode(mode) {
    applyState({ mode, view: currentView }, true);
  }

  function setView(view) {
    applyState({ mode: currentMode, view }, true);
  }

  function enterEdit() {
    applyState({ mode: currentMode, view: 'edit' }, true);
  }

  function returnShowcase() {
    applyState({ mode: currentMode, view: 'showcase' }, true);
  }

  function syncFromHash() {
    const rawHash = (window.location.hash || '').toLowerCase();
    if (rawHash === '#poster') {
      applyState({ mode: 'poster', view: 'edit' }, false);
    } else if (rawHash === '#filter') {
      applyState({ mode: 'filter', view: 'edit' }, false);
    } else {
      const saved = localStorage.getItem('visual-lab-mode') || 'poster';
      applyState({ mode: saved, view: 'showcase' }, false);
    }
  }

  // Tab click listeners
  tabs.forEach((tab) => tab.addEventListener('click', () => {
    setMode(tab.dataset.mode);
  }));

  // Showcase entry & return button listeners
  document.getElementById('showcaseEnterButton')?.addEventListener('click', enterEdit);
  document.getElementById('showcaseDockAction')?.addEventListener('click', enterEdit);
  document.getElementById('showcaseBackButton')?.addEventListener('click', returnShowcase);
  document.getElementById('posterShowcaseBackButton')?.addEventListener('click', returnShowcase);

  // Brand click returns to showcase
  document.querySelector('.brand')?.addEventListener('click', (e) => {
    e.preventDefault();
    returnShowcase();
  });

  // Double-click on card triggers edit entry
  document.querySelector('#posterCanvasWrap')?.addEventListener('dblclick', () => {
    if (currentView === 'showcase') enterEdit();
  });
  document.querySelector('.canvas-frame')?.addEventListener('dblclick', () => {
    if (currentView === 'showcase') enterEdit();
  });

  // Keyboard Enter in showcase triggers edit entry
  document.addEventListener('keydown', (e) => {
    if (currentView === 'showcase' && e.key === 'Enter' && !e.target?.closest?.('button, a, input, select, textarea, [contenteditable]')) {
      e.preventDefault();
      enterEdit();
    }
  });

  // Listen to custom event for programmatic edit entry
  window.addEventListener('visual-lab-enter-edit', enterEdit);
  window.addEventListener('visual-lab-return-showcase', returnShowcase);

  // Browser navigation history support
  window.addEventListener('popstate', syncFromHash);
  window.addEventListener('hashchange', syncFromHash);

  // A fresh visit always starts in showcase; edit hashes only select the artwork mode.
  const initHash = (window.location.hash || '').toLowerCase();
  const saved = localStorage.getItem('visual-lab-mode') || 'poster';
  const initialMode = initHash === '#poster' ? 'poster' : initHash === '#filter' ? 'filter' : saved;
  history.replaceState(null, '', '#showcase');
  applyState({ mode: initialMode, view: 'showcase' }, false);

  // Public API
  window.visualLab = {
    setMode,
    setView,
    enterEdit,
    returnShowcase,
    getMode: () => currentMode,
    getView: () => currentView
  };
})();
