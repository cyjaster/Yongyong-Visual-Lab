const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const source = read('poster.js'), html = read('index.html');
const viewport = {clientWidth: 680, clientHeight: 640, scrollLeft: 0, scrollTop: 0};
const canvasWrap = {style: {}}, zoomValue = {}, workspace = {hidden: false};
let resized, pending;
const context = vm.createContext({viewport, canvasWrap, zoomValue,
  $: () => workspace, getComputedStyle: () => ({paddingLeft:'12',paddingRight:'12',paddingTop:'20',paddingBottom:'20'}),
  requestAnimationFrame: fn => fn(), clearTimeout() {}, setTimeout: fn => {pending = fn; return 1;},
  ResizeObserver: class {constructor(fn) {resized = fn;} observe(node) {assert.equal(node, viewport);}}
});
vm.runInContext(`let zoom=1, zoomMode='fit', fitTimer=0; const W=900,H=1200;
  ${source.slice(source.indexOf('  function applyZoom('), source.indexOf('  function pruneAssetCaches('))}
  ${source.slice(source.indexOf('  new ResizeObserver('), source.indexOf('  window.addEventListener(\'visual-lab-mode-change', source.indexOf('  new ResizeObserver(')))}`, context);
const run = code => vm.runInContext(code, context);
run('fitWorkspace()');
assert.equal(zoomValue.textContent, '50%');
viewport.clientHeight = 460; resized(); pending();
assert.equal(zoomValue.textContent, '35%', 'Late toolbar layout refits to the smaller viewport');
assert.ok(parseFloat(canvasWrap.style.height) <= viewport.clientHeight - 40);
viewport.clientHeight = 180; resized(); pending();
assert.equal(zoomValue.textContent, '11%', 'FIT can go below the manual 20% floor on short screens');
run("applyZoom(.6, 'manual')"); viewport.clientHeight = 400; resized(); pending();
assert.equal(zoomValue.textContent, '60%', 'Resizing keeps explicit manual zoom');
run("applyZoom(.1, 'manual')");
assert.equal(zoomValue.textContent, '20%', 'Manual zoom retains its existing lower bound');
run('fitWorkspace()'); workspace.hidden = true; viewport.clientHeight = 700; resized(); pending();
assert.equal(zoomValue.textContent, '30%', 'A hidden editor is not resized');
const header = html.slice(html.indexOf('<header'), html.indexOf('</header>'));
for (const action of ['undo','redo','duplicate']) {
  assert.ok(header.includes(`data-poster-action="${action}"`));
  assert.equal((html.match(new RegExp(`data-poster-action="${action}"`, 'g')) || []).length, 1);
}
assert.ok(source.includes("querySelectorAll('.poster-tools, .poster-action-dock, .poster-header-history')"));
assert.ok(read('studio.css').includes('body.is-showcase .poster-header-history'));
console.log('Editor FIT regression passed: late layout, short viewport, manual zoom, hidden mode and header actions.');
