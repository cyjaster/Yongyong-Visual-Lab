const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

// 1. Verify CSS rules in studio.css
const css = fs.readFileSync(path.join(__dirname, '../studio.css'), 'utf8');
assert.ok(css.includes('body.is-showcase .poster-tools'), 'Showcase hides poster tools sidebar');
assert.ok(css.includes('body.is-showcase .poster-inspector'), 'Showcase hides poster inspector sidebar');
assert.ok(css.includes('body.is-showcase .poster-action-dock'), 'Showcase hides the actual editing toolbar');
assert.ok(css.includes('.poster-workspace:not([hidden])') && css.includes('.workspace:not([hidden])'), 'Showcase layout only applies to the selected workspace');
assert.ok(css.includes('@keyframes showcase-card-sway'), '3D card sway animation keyframes defined');
assert.ok(css.includes('.showcase-floating-dock'), 'Floating showcase action dock defined');
assert.ok(css.includes('body[data-ambient="off"].is-showcase'), 'Motion off freezes 3D sway animation');
assert.ok(css.includes('prefers-reduced-motion'), 'Reduced motion query freezes animation');

// 2. Verify HTML structure in index.html
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
for (const asset of ['studio.css', 'mode-switcher.js', 'poster-motion.js', 'sidebar-motion.js', 'poster.js']) {
  assert.ok(html.includes(asset + '?v=20261013-showcase-fix'), 'Updated cache version: ' + asset);
}
assert.ok(html.includes('id="showcaseEnterButton"'), 'Topbar has showcase enter button');
assert.ok(html.includes('id="showcaseBackButton"'), 'Topbar has showcase back button');
assert.ok(html.includes('id="posterShowcaseBackButton"'), 'Poster toolbar has showcase back button');
assert.ok(html.includes('id="showcaseFloatingDock"'), 'App shell includes showcase floating dock');
assert.ok(html.includes('href="#showcase"'), 'Brand logo points to showcase entrance');

// 3. Verify event guards in poster.js, poster-motion.js, and sidebar-motion.js
const posterJs = fs.readFileSync(path.join(__dirname, '../poster.js'), 'utf8');
assert.ok(posterJs.includes("document.body?.classList?.contains?.('is-showcase')"), 'poster.js guards canvas pointerdown and shortcuts in showcase');

const motionJs = fs.readFileSync(path.join(__dirname, '../poster-motion.js'), 'utf8');
assert.ok(motionJs.includes("document.body?.classList?.contains?.('is-showcase')"), 'poster-motion.js ignores showcase interactions from pausing ambient flow');

const sidebarJs = fs.readFileSync(path.join(__dirname, '../sidebar-motion.js'), 'utf8');
assert.ok(sidebarJs.includes("document.body?.classList?.contains?.('is-showcase') ? 'DOUBLE CLICK · 进入编辑' : 'STIR · 拨动水银'"), 'Reticle label prompts double-click in showcase');

// 4. Test mode-switcher.js state machine in VM context
const switcherJs = fs.readFileSync(path.join(__dirname, '../mode-switcher.js'), 'utf8');

function createMockEnvironment(initialHash = '') {
  const store = {};
  const elementMock = (tag = 'div') => ({
    tagName: tag.toUpperCase(),
    classList: {
      values: new Set(),
      add(...names) { names.forEach(n => this.values.add(n)); },
      remove(...names) { names.forEach(n => this.values.delete(n)); },
      toggle(name, val) { if (val) this.values.add(name); else this.values.delete(name); },
      contains(name) { return this.values.has(name); }
    },
    hidden: false,
    style: {},
    dataset: {},
    setAttribute() {},
    getAttribute() { return null; },
    addEventListener(type, handler) { this.listeners = this.listeners || {}; this.listeners[type] = handler; },
    click() { if (this.listeners && this.listeners.click) this.listeners.click({ preventDefault() {} }); },
    dblclick() { if (this.listeners && this.listeners.dblclick) this.listeners.dblclick({ preventDefault() {} }); }
  });

  const shell = elementMock('div');
  const filterWorkspace = elementMock('main');
  const posterWorkspace = elementMock('main');
  const tabFilter = elementMock('button'); tabFilter.dataset.mode = 'filter';
  const tabPoster = elementMock('button'); tabPoster.dataset.mode = 'poster';
  const enterBtn = elementMock('button');
  const dockBtn = elementMock('button');
  const backBtn = elementMock('button');
  const posterBackBtn = elementMock('button');
  const brand = elementMock('a');
  const posterCanvasWrap = elementMock('div');
  const canvasFrame = elementMock('div');

  const body = {
    classList: {
      values: new Set(),
      add(...names) { names.forEach(n => this.values.add(n)); },
      remove(...names) { names.forEach(n => this.values.delete(n)); },
      toggle(name, val) { if (val) this.values.add(name); else this.values.delete(name); },
      contains(name) { return this.values.has(name); }
    }
  };

  const docListeners = {};
  const winListeners = {};
  let fitWorkspaceCalled = 0;

  const doc = {
    body,
    querySelector(sel) {
      if (sel === '.app-shell') return shell;
      if (sel === '.workspace') return filterWorkspace;
      if (sel === '#posterWorkspace') return posterWorkspace;
      if (sel === '.brand') return brand;
      if (sel === '#posterCanvasWrap') return posterCanvasWrap;
      if (sel === '.canvas-frame') return canvasFrame;
      return null;
    },
    querySelectorAll(sel) {
      if (sel === '.mode-tab') return [tabFilter, tabPoster];
      return [];
    },
    getElementById(id) {
      if (id === 'showcaseEnterButton') return enterBtn;
      if (id === 'showcaseDockAction') return dockBtn;
      if (id === 'showcaseBackButton') return backBtn;
      if (id === 'posterShowcaseBackButton') return posterBackBtn;
      return null;
    },
    addEventListener(type, handler) { docListeners[type] = handler; }
  };

  const win = {
    location: { hash: initialHash },
    history: {
      pushState(state, title, url) { win.location.hash = url; },
      replaceState(state, title, url) { win.location.hash = url; }
    },
    localStorage: {
      getItem(k) { return store[k] || null; },
      setItem(k, v) { store[k] = String(v); }
    },
    posterFitWorkspace() { fitWorkspaceCalled++; },
    addEventListener(type, handler) { winListeners[type] = handler; },
    dispatchEvent() {},
    requestAnimationFrame(fn) { fn(); }
  };

  const ctx = vm.createContext({
    document: doc,
    window: win,
    history: win.history,
    localStorage: win.localStorage,
    CustomEvent: class { constructor(name, detail) { this.name = name; this.detail = detail; } },
    requestAnimationFrame: win.requestAnimationFrame
  });

  vm.runInContext(switcherJs, ctx);

  return {
    shell, body, filterWorkspace, posterWorkspace, enterBtn, dockBtn, backBtn, posterBackBtn,
    brand, posterCanvasWrap, canvasFrame, docListeners, winListeners, win,
    getFitWorkspaceCalls: () => fitWorkspaceCalled
  };
}

// Case A: Root entry defaults to showcase view
{
  const env = createMockEnvironment('');
  assert.ok(env.body.classList.contains('is-showcase'), 'Root entrance activates is-showcase class on body');
  assert.ok(env.shell.classList.contains('is-showcase'), 'Root entrance activates is-showcase class on shell');
  assert.equal(env.win.visualLab.getView(), 'showcase', 'visualLab.getView() returns showcase');
  assert.equal(env.posterWorkspace.style.display, 'flex', 'Poster workspace uses flex showcase layout');

  // Trigger enterEdit via button
  env.enterBtn.click();
  assert.equal(env.win.visualLab.getView(), 'edit', 'Clicking enterBtn switches view to edit');
  assert.ok(!env.body.classList.contains('is-showcase'), 'Body is-showcase removed in edit view');
  assert.equal(env.win.location.hash, '#poster', 'Hash updated to #poster');

  // Trigger returnShowcase via back button
  env.backBtn.click();
  assert.equal(env.win.visualLab.getView(), 'showcase', 'Clicking backBtn returns to showcase');
  assert.ok(env.body.classList.contains('is-showcase'), 'Body is-showcase restored');
  assert.equal(env.win.location.hash, '#showcase', 'Hash updated to #showcase');

  // Trigger enterEdit via double click on canvas wrap
  env.posterCanvasWrap.dblclick();
  assert.equal(env.win.visualLab.getView(), 'edit', 'Double-click enters edit view');

  // Trigger returnShowcase via brand click
  env.brand.click();
  assert.equal(env.win.visualLab.getView(), 'showcase', 'Brand click returns to showcase');

  // Trigger enterEdit via keyboard Enter
  env.docListeners.keydown({ key: 'Enter', preventDefault() {} });
  assert.equal(env.win.visualLab.getView(), 'edit', 'Enter key enters edit view');
}

// Case B: Direct deep-link to #poster opens editor
{
  const env = createMockEnvironment('#poster');
  assert.equal(env.win.visualLab.getView(), 'edit', '#poster hash enters edit view directly');
  assert.equal(env.win.visualLab.getMode(), 'poster', 'Mode is poster');
  assert.ok(!env.body.classList.contains('is-showcase'), 'is-showcase is false');
}

// Case C: Direct deep-link to #filter opens Filter editor
{
  const env = createMockEnvironment('#filter');
  assert.equal(env.win.visualLab.getView(), 'edit', '#filter hash enters edit view directly');
  assert.equal(env.win.visualLab.getMode(), 'filter', 'Mode is filter');
  assert.ok(!env.body.classList.contains('is-showcase'), 'is-showcase is false');
}

console.log('PASS: showcase-regression.cjs - state machine, routing, buttons, dblclick, keydown, and CSS animation assertions');
