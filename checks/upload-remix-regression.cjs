// Run: node checks/upload-remix-regression.cjs
// Executes production upload / asset selection / REMIX functions with controlled
// FileReader and Image completion. Rendering and pixel filters are tested elsewhere.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../poster.js'), 'utf8');
function section(start, end) {
  const from = source.indexOf(start), to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `production source section exists: ${start}`);
  return source.slice(from, to);
}
const production = [
  section('  function addSecondaryImage(', '  function appendImages('),
  section('  function ensureKarinaMultiAssets(', '  function hasUserUploadedImages('),
  section('  function hasUserUploadedImages(', '  function applyDemo('),
  section('  function applyDemo(', '  const layoutTemplates ='),
  section('  function triggerMasterRemix(', '  function remixLayout('),
  section('  function handlePosterImageUpload(', "  backgroundInput?.addEventListener('change'")
].join('\n');

function inputElement() {
  const listeners = {};
  return { files: [], value: '', addEventListener: (name, fn) => { listeners[name] = fn; },
    change(files) { this.files = files; this.value = 'selected'; listeners.change(); } };
}
function harness() {
  const reads = [], images = [], requests = [], toasts = [];
  let sequence = 0, readSequence = 0, confirmCount = 0;
  const state = { image: null, imageName: '', mainImageId: '', main: { cutout: false }, assets: [], secondaries: [],
    frames: [], details: [], fragments: [], texts: [], layers: [], filters: {}, selected: null };
  const imageAssets = new Map(), input = inputElement(), multiInput = inputElement();
  class FileReaderStub {
    readAsDataURL(file) {
      this.result = `data:image/mock;name=${encodeURIComponent(file.name)};sequence=${++readSequence}`;
      reads.push({ reader: this, file }); requests.push({ type: 'file', name: file.name });
    }
  }
  class ImageStub {
    constructor() { this.complete = false; this.naturalWidth = 600; this.naturalHeight = 800; }
    set src(value) { this._src = value; images.push(this); requests.push({ type: 'image', src: value }); }
    get src() { return this._src; }
  }
  const context = vm.createContext({
    state, imageAssets, input, multiInput, FileReader: FileReaderStub, Image: ImageStub,
    document: { querySelector: () => null, querySelectorAll: () => [] },
    window: { confirm: () => { confirmCount++; return true; } }, console,
    emptyState: { classList: { add() {}, remove() {} } }, status: { textContent: '' },
    motion: { capture: () => null, play() {} }, requestAnimationFrame: fn => fn(),
    makeId: () => `uploaded-or-layer-${++sequence}`,
    cleanFilters: () => ({ bw: 0, brightness: 0, contrast: 0, saturation: 100, grain: 0 }),
    makeFrame: (number, options) => ({ id: `frame-${++sequence}`, number, ...options }),
    makeDetail: (frame, index, options) => ({ id: `detail-${++sequence}`, frameId: frame.id, ...options }),
    syncAllChildFramesOf() {}, renderImageTray() {}, renderInspector() {}, render() {},
    commit() {}, updateRemixCard() {}, markManuallyEdited() {}, fitWorkspace() {},
    toast: message => toasts.push(message), hasSecondaryImages: () => state.secondaries.length > 0,
    ensureMainLayer: () => {
      if (!state.layers.some(layer => layer.type === 'main')) state.layers.push({ type: 'main', id: 'main-image' });
    },
    layerIndex: (type, id) => state.layers.findIndex(layer => layer.type === type && layer.id === id),
    addLayer: (type, id, after = state.layers.length - 1) => state.layers.splice(after + 1, 0, { type, id })
  });
  vm.runInContext(`
    let remixBaseSnapshot = null, remixLastResultSnapshot = null;
    let lastRemixCopyName = '', lastRemixAnchorName = '', lastRemixFramePatternName = '', lastRemixBackgroundStyle = '';
    let history = [], historyIndex = -1, historyTimer = 0, zoomMode = 'fit';
    ${production}
  `, context, { filename: 'poster-upload-remix-production-excerpts.js' });
  function finishReads(reverse = false) {
    const queued = reads.splice(0); if (reverse) queued.reverse();
    queued.forEach(({ reader }) => reader.onload());
  }
  function finishImages(predicate = () => true, reverse = false) {
    const queued = images.filter(predicate), retained = images.filter(image => !predicate(image));
    images.splice(0, images.length, ...retained); if (reverse) queued.reverse();
    queued.forEach(image => { image.complete = true; image.onload?.(); });
  }
  function upload(names, options = {}) {
    const control = options.multi ? multiInput : input;
    control.change(names.map(name => ({ name })));
    finishReads(options.reverse);
    finishImages(image => image.src.startsWith('data:'), options.reverse);
  }
  return { state, context, imageAssets, input, multiInput, reads, images, requests, toasts,
    finishReads, finishImages, upload, index: () => vm.runInContext('currentMasterIndex', context),
    confirmCount: () => confirmCount };
}
function defaultTemplate02() {
  const h = harness();
  h.context.loadDemo02(false);
  assert.equal(h.images.length, 1, 'startup schedules the default demo image');
  h.finishImages();
  assert.equal(h.state.mainImageId, 'asset-model-techwear');
  assert.equal(h.context.hasUserUploadedImages(), false);
  assert.equal(h.index(), 1, 'active index agrees with default template 02');
  return h;
}
function assertUserMain(h, expected, name) {
  assert.equal(h.state.image, expected.image, `${name}: decoded uploaded image remains the main`);
  assert.equal(h.state.mainImageId, expected.id, `${name}: upload ID is retained`);
  assert.equal(h.state.imageName, name, `${name}: original filename is retained`);
  assert.equal(h.context.hasUserUploadedImages(), true, `${name}: detected by upload provenance`);
  assert.ok(h.state.assets.every(asset => !h.context.isDemoAsset(asset)), `${name}: demo assets do not return`);
  h.state.secondaries.forEach(card => assert.ok(h.state.assets.some(asset => asset.id === card.imageId), 'card references a retained upload'));
}

let passed = 0, failed = 0;
function test(name, run) {
  try { run(); passed++; console.log(`PASS: ${name}`); }
  catch (error) { failed++; console.error(`FAIL: ${name}\n  ${error.stack}`); }
}
for (const name of ['portrait.jpg', 'model-portrait.jpg', 'karina-mine.png', 'model-techwear.jpg', 'karina-close.jpg', 'demo.jpg']) {
  test(`default template 02 -> real upload '${name}' -> eight total REMIX clicks preserve the photo`, () => {
    const h = defaultTemplate02(), demoImage = h.state.image;
    h.upload([name]);
    assert.notEqual(h.state.image, demoImage, 'upload replaces the default photo');
    const uploaded = { id: h.state.mainImageId, image: h.state.image };
    assert.equal(h.imageAssets.get(uploaded.id).origin, 'upload', 'real decode callback marks provenance');
    assert.equal(h.state.assets.length, 1, 'demo asset is removed on first upload');
    assert.equal(h.input.value, '', 'file input clears after decode');
    assertUserMain(h, uploaded, name);
    const requests = h.requests.length;
    h.context.triggerMasterRemix();
    assert.equal(h.index(), 2, 'first click advances template 02 to template 03');
    assert.equal(h.state.backgroundStyle, 'blue-valentine');
    assert.equal(h.state.secondaries.length, 7);
    assert.equal(h.state.main.fit, 'contain');
    assert.ok(h.state.posterPaper);
    assertUserMain(h, uploaded, name);
    h.context.triggerMasterRemix();
    assert.equal(h.index(),3,'second click advances template 03 to template 04');
    assert.equal(h.state.texts[0].textStyle,'balloon');
    assert.equal(h.state.secondaries.length,3);
    assertUserMain(h,uploaded,name);
    h.context.triggerMasterRemix();
    assert.equal(h.index(),4,'third click advances to Photo Booth');
    assert.equal(h.state.secondaries.filter(s=>s.windowStyle==='photo-booth').length,1);
    assertUserMain(h,uploaded,name);
    h.context.triggerMasterRemix();
    assert.equal(h.index(),5,'fourth click advances to AirDrop Diary');
    assert.equal(h.state.secondaries.find(s=>s.id==='desktop-background').filters.blur,14);
    assertUserMain(h,uploaded,name);
    h.context.triggerMasterRemix();
    assert.equal(h.index(),6,'fifth click advances to After Hours Album');
    assert.equal(h.state.secondaries.length,3);assertUserMain(h,uploaded,name);
    h.context.triggerMasterRemix();assert.equal(h.index(),7,'sixth click advances to Electric Blue Archive');
    assert.equal(h.state.filters.bw,100);assertUserMain(h,uploaded,name);
    h.context.triggerMasterRemix();assert.equal(h.index(),0,'seventh click advances template 08 to template 01');
    assert.equal(h.state.posterPaper, null, 'template 01 removes the paper panel');
    assert.equal(h.state.backgroundStyle, 'electric-tiger');
    assert.equal(h.state.secondaries.length, 4, 'template 01 retains its four authored collage slots for a single uploaded photo');
    h.state.secondaries.forEach(card => assert.equal(card.imageId, uploaded.id, 'single-image collage cards retain the uploaded source'));
    assert.equal(h.state.details.length, 3, 'template 01 retains three independent primary detail samples');
    assert.equal(new Set(h.state.details.map(detail => detail.frameId)).size, 3, 'each detail is linked to its own sampling frame');
    h.state.frames.forEach(frame => assert.equal(frame.sourceId, 'main', 'single-image detail samples remain linked to the uploaded primary'));
    assertUserMain(h, uploaded, name);
    h.context.triggerMasterRemix();
    assert.equal(h.index(), 1, 'eighth click advances back to template 02');
    assert.equal(h.state.backgroundStyle, 'solid');
    assert.equal(h.state.details.length, 7);
    h.state.frames.forEach(frame => assert.equal(frame.sourceId, 'main', 'all single-image effect windows use the uploaded main'));
    assertUserMain(h, uploaded, name);
    assert.equal(h.requests.length, requests, 'user REMIX never schedules built-in image loading');
  });
}

test('slot resolver preserves current main and all sources in a mixed demo/upload scene', () => {
  const h = defaultTemplate02(), userImage = { naturalWidth: 800, naturalHeight: 600, src: 'user-source' };
  h.imageAssets.set('upload-mixed', { id: 'upload-mixed', name: 'model-techwear.jpg', image: userImage, origin: 'upload' });
  h.imageAssets.set('marked-demo', { id: 'marked-demo', name: 'arbitrary-name.jpg', image: h.state.image, origin: 'demo' });
  h.state.assets.push({ id: 'marked-demo', name: 'arbitrary-name.jpg' }, { id: 'upload-mixed', name: 'model-techwear.jpg' });
  const slots = h.context.resolveSlotAssetIds(null, false);
  assert.equal(slots.isUserMode, true);
  assert.equal(h.state.mainImageId, 'asset-model-techwear', 'REMIX must not choose a different main automatically');
  assert.deepEqual(Array.from(h.state.assets, asset => asset.id), ['asset-model-techwear','marked-demo','upload-mixed']);
  assert.equal(h.state.image,h.imageAssets.get('asset-model-techwear').image);
  assert.deepEqual(['slot0Id','slot1Id','slot2Id','slot3Id'].map(key=>slots[key]),['marked-demo','upload-mixed','marked-demo','upload-mixed']);
});

test('both REMIX cycles retain current demo photos without loading other demo sources', () => {
  const h = defaultTemplate02(), main = h.state.image, id = h.state.mainImageId;
  const pool = JSON.stringify(h.state.assets), requests = h.requests.length;
  for (const cycle of [h.context.triggerMasterRemix,h.context.cycleLayoutRemix]) {
    for (let i=0;i<8;i++) {
      cycle();
      assert.equal(h.state.image,main);assert.equal(h.state.mainImageId,id);
      assert.equal(JSON.stringify(h.state.assets),pool);
      assert.equal(h.context.hasUserUploadedImages(),false,'Keeping a demo does not relabel its provenance');
      assert.ok(h.state.secondaries.every(card=>h.state.assets.some(asset=>asset.id===card.imageId)));
    }
  }
  assert.equal(h.requests.length,requests,'Only explicit demo loading may request new built-in photos');
});

test('late startup loadDemo02(false) completion cannot overwrite an upload; explicit loadDemo02(true) still resets', () => {
  const h = harness();
  h.context.loadDemo02(false);
  assert.equal(h.images.length, 1, 'default decode is pending');
  h.state.main.cutout = true;
  h.upload(['model-techwear.jpg']);
  assert.equal(h.state.main.cutout, false, 'first upload clears the previous main cutout flag');
  const uploaded = { id: h.state.mainImageId, image: h.state.image };
  assertUserMain(h, uploaded, 'model-techwear.jpg');
  const before = JSON.stringify({ assets: h.state.assets, layers: h.state.layers, texts: h.state.texts });
  h.finishImages(image => !image.src.startsWith('data:'));
  assertUserMain(h, uploaded, 'model-techwear.jpg');
  assert.equal(JSON.stringify({ assets: h.state.assets, layers: h.state.layers, texts: h.state.texts }), before, 'late startup callback leaves the uploaded scene intact');
  h.context.loadDemo02(true);
  assert.equal(h.state.mainImageId, 'asset-model-techwear', 'explicit demo command may replace uploaded main');
  assert.notEqual(h.state.image, uploaded.image);
  assert.equal(h.context.hasUserUploadedImages(), false);
  assert.equal(h.index(), 1);
});

test('late loadDemo(false) callbacks cannot overwrite a user upload either', () => {
  const h = defaultTemplate02();
  h.context.loadDemo(false);
  assert.equal(h.images.length, 4, 'Karina demo asset decodes are pending');
  h.upload(['karina-close.jpg']);
  const uploaded = { id: h.state.mainImageId, image: h.state.image };
  h.finishImages(image => !image.src.startsWith('data:'));
  assertUserMain(h, uploaded, 'karina-close.jpg');
  assert.equal(h.index(), 1, 'late demo 01 startup does not change the active template');
});

test('multi-input out-of-order reads/decodes retain file order and every upload through eight REMIX clicks', () => {
  const h = defaultTemplate02(), names = ['model-a.jpg', 'karina-b.jpg', 'demo.jpg'];
  h.upload(names, { multi: true, reverse: true });
  const uploaded = { id: h.state.mainImageId, image: h.state.image };
  assert.equal(h.state.imageName, names[0], 'first selected file is primary even when completion reverses');
  assert.deepEqual(Array.from(h.state.assets, asset => asset.name), names);
  const ids = new Set(h.state.assets.map(asset => asset.id));
  assert.equal(h.multiInput.value, '');
  for (let click = 0; click < 8; click++) {
    h.context.triggerMasterRemix();
    assertUserMain(h, uploaded, names[0]);
    assert.equal(h.state.assets.length, names.length);
    assert.deepEqual(new Set(h.state.assets.map(asset => asset.id)), ids, 'all decoded uploads are retained');
    h.state.secondaries.forEach(card => assert.ok(ids.has(card.imageId), 'slots only sample uploaded assets'));
  }
});

test('a later upload appends after the first user photo, and an explicit confirmed demo reset remains available', () => {
  const h = defaultTemplate02();
  h.upload(['model-first.jpg']);
  const first = { id: h.state.mainImageId, image: h.state.image };
  h.upload(['karina-next.jpg']);
  assertUserMain(h, first, 'model-first.jpg');
  assert.equal(h.state.assets.length, 2);
  assert.equal(h.state.secondaries.length, 1);
  assert.equal(h.imageAssets.get(h.state.secondaries[0].imageId).name, 'karina-next.jpg');
  h.context.loadDemo02(true);
  assert.equal(h.confirmCount(), 1, 'explicit reset keeps the existing confirmation when secondary cards exist');
  assert.equal(h.state.mainImageId, 'asset-model-techwear');
  assert.equal(h.state.assets.length, 1);
  assert.equal(h.context.hasUserUploadedImages(), false);
});

test('template 03 distributes six support uploads and preserves the seventh main through a full cycle', () => {
  const h = defaultTemplate02();
  const names = ['main.jpg', 'one.jpg', 'two.jpg', 'three.jpg', 'four.jpg', 'five.jpg', 'six.jpg'];
  h.upload(names, { multi: true, reverse: true });
  const main = { id: h.state.mainImageId, image: h.state.image };
  const pool = JSON.stringify(h.state.assets);
  h.context.triggerMasterRemix();
  assert.equal(h.index(), 2);
  assert.equal(new Set(h.state.secondaries.map(card => card.imageId)).size, 7, 'each upload appears in a slot');
  assert.equal(h.state.main.fit, 'contain', 'foreground preserves the full photo');
  assert.ok(h.state.layers.findIndex(layer => layer.type === 'main') > 0, 'main overlaps the photograph grid');
  for (let click = 0; click < 8; click++) {
    h.context.triggerMasterRemix();
    assert.equal(JSON.stringify(h.state.assets), pool);
    assertUserMain(h, main, names[0]);
  }
  assert.equal(h.index(), 2);
});

console.log(`\nUpload/REMIX regression: ${passed} passed, ${failed} failed.`);
if (failed) process.exitCode = 1;
