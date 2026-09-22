// Small shell controller. The two modes remain on the same static page.
(() => {
  const shell = document.querySelector('.app-shell');
  const filterWorkspace = document.querySelector('.workspace');
  const posterWorkspace = document.querySelector('#posterWorkspace');
  const tabs = [...document.querySelectorAll('.mode-tab')];

  function setMode(mode) {
    const isPoster = mode === 'poster';
    filterWorkspace.hidden = isPoster;
    posterWorkspace.hidden = !isPoster;
    // Explicit inline display is a defensive fallback for browsers whose
    // author styles override the native [hidden] rule on grid containers.
    filterWorkspace.style.display = isPoster ? 'none' : '';
    posterWorkspace.style.display = isPoster ? 'grid' : 'none';
    shell.classList.toggle('poster-active', isPoster);
    tabs.forEach((tab) => {
      const active = tab.dataset.mode === mode;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-pressed', String(active));
    });
    window.dispatchEvent(new CustomEvent('visual-lab-mode-change', { detail: { mode } }));
  }

  tabs.forEach((tab) => tab.addEventListener('click', () => setMode(tab.dataset.mode)));
  setMode('filter');
})();
