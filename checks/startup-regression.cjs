// Run: node checks/startup-regression.cjs
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const scripts = [...html.matchAll(/<script\s+src="([^"]+)"([^>]*)>/g)];
assert.ok(scripts.length > 10 && scripts.every(([, , attributes]) => /\bdefer\b/.test(attributes)), 'Scripts download in parallel and execute in order');
assert.ok(!html.includes('assets/demo-collage-data.js'), 'Base64 photo bundle does not block startup');
assert.ok(html.includes('app.js?v=20261013-startup'), 'Filter loader cache version updated');
assert.ok(html.includes('<main class="workspace" hidden>') && !html.includes('id="posterWorkspace" hidden'), 'Initial HTML already presents the poster');
assert.ok(scripts.findIndex(([, src]) => src.startsWith('app.js')) < scripts.findIndex(([, src]) => src.startsWith('mode-switcher.js')), 'Filter listener is ready before initial route event');
const bundled = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'assets/demo-collage-data.js'), 'utf8'), bundled);
for (const key of ['close', 'hands', 'crouch', 'sky']) {
  const original = Buffer.from(bundled.window['KARINA_' + key.toUpperCase() + '_DATA'].split(',')[1], 'base64');
  assert.ok(original.equals(fs.readFileSync(path.join(root, 'assets/karina-' + key + '.jpg'))), 'Separate image bytes unchanged: ' + key);
}
assert.ok(Buffer.from(bundled.window.MODEL_TECHWEAR_DATA.split(',')[1], 'base64').equals(fs.readFileSync(path.join(root, 'assets/model-techwear.jpg'))));

function harness(existingImage = null) {
  const images = [], listeners = new Map();
  const state = { image: existingImage };
  const classes = new Set(['is-empty']);
  const ui = { dropZone: { classList: { add: c => classes.add(c), remove: c => classes.delete(c) } }, imageStatus: { textContent: '' } };
  let renders = 0;
  const context = { state, ui, renderPreview: () => renders++, Image: class { constructor() { images.push(this); } },
    window: { addEventListener: (type, fn) => listeners.set(type, fn), removeEventListener: type => listeners.delete(type) } };
  const start = app.indexOf('function createDemoImage()');
  const end = app.indexOf('// RENDER:', start);
  vm.runInNewContext(app.slice(start, end) + app.slice(app.lastIndexOf("window.addEventListener('visual-lab-mode-change'")), context);
  return { images, state, ui, classes, get renders() { return renders; }, mode: mode => listeners.get('visual-lab-mode-change')?.({ detail: { mode } }) };
}
const h = harness();
h.mode('poster'); h.mode('poster'); assert.equal(h.images.length, 0, 'Hidden Filter Lab downloads no preset');
h.mode('filter'); h.mode('poster'); h.mode('filter'); assert.equal(h.images.length, 1, 'First Filter visit requests the preset once');
assert.equal(h.images[0].src, 'assets/demo-karina.jpg');
h.images[0].naturalWidth = 800; h.images[0].naturalHeight = 1000; h.images[0].onload();
assert.equal(h.state.image, h.images[0]); assert.equal(h.renders, 1); assert.ok(!h.classes.has('is-empty'));
const uploaded = { uploaded: true };
const race = harness(); race.mode('filter'); race.state.image = uploaded; race.ui.imageStatus.textContent = '用户照片';
race.images[0].onload(); race.images[0].onerror(); assert.equal(race.state.image, uploaded); assert.equal(race.ui.imageStatus.textContent, '用户照片'); assert.equal(race.renders, 0);
const alreadyUploaded = harness(uploaded); alreadyUploaded.mode('filter'); assert.equal(alreadyUploaded.images.length, 0);
const failure = harness(); failure.mode('filter'); failure.images[0].onerror(); assert.match(failure.ui.imageStatus.textContent, /请上传照片/);
console.log('PASS: lean startup, unchanged demo bytes, on-demand Filter preset, and upload race protection');
