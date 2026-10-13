// Run: node checks/default-demo-regression.cjs
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.join(__dirname, '..'), source = fs.readFileSync(path.join(root, 'poster.js'), 'utf8');
const section = (a, b) => source.slice(source.indexOf(a), source.indexOf(b, source.indexOf(a)));
const init = section('  async function initializePoster()', '  function getImageSourceInfo(');
const pink = section('  async function preparePinkDesktop(', '  function pinkDesktopReady(');
function startup(load) {
  const state = { main: {}, value: 'initial' }, demos = [], statuses = [], restored = [], loaded = [];
  const record = { version: 1, scene: { main: {}, filters: {}, mainImageId: 'saved', assets: [], secondaries: [], fragments: [], frames: [], details: [], texts: [], layers: [] }, assets: [{ id: 'saved', src: 'data:image/png;base64,saved' }], exportResolution: [1200, 1600] };
  const context = { state, history: [], snapshot: () => JSON.stringify(state), draftReady: false, draftDirty: false,
    window: { PosterDraft: { load: () => load(record) } }, imageAssets: new Map(), backgroundAssets: new Map(),
    loadDraftImage: async src => { loaded.push(src); return { src }; },
    loadDemoDesktop: async (...args) => demos.push(args), draftStatus: msg => statuses.push(msg), toast() {}, console: { warn() {} }, scheduleDraftSave() {},
    $: () => ({ options: [{ value: '1200x1600' }], dispatchEvent() {} }), Event: class {}, restore: index => restored.push(index) };
  vm.runInNewContext(init, context);
  return { context, demos, loaded, restored, statuses, state };
}
(async () => {
  const empty = startup(() => null); await empty.context.initializePoster(); assert.deepEqual(empty.demos, [[4, false]]); assert.equal(empty.context.draftReady, true);
  const saved = startup(record => record); await saved.context.initializePoster(); assert.equal(saved.demos.length, 0); assert.deepEqual(saved.restored, [0]); assert.equal(saved.loaded.length, 1); assert.equal(saved.context.history.length, 1); assert.equal(saved.context.draftDirty, false);
  let release; const race = startup(() => new Promise(resolve => release = resolve)); const pending = race.context.initializePoster(); race.state.value = 'new upload'; release(null); await pending; assert.equal(race.demos.length, 0);
  const failure = startup(() => { throw Error('Storage blocked'); }); await failure.context.initializePoster(); assert.deepEqual(failure.demos, [[4, false]]); assert.ok(failure.statuses.includes('恢复失败，旧草稿保留'));
  for (const userMode of [false, true]) {
    let models = 0, cached = 0, applied = 0;
    const image = { complete: true }, state = { image: userMode ? image : null, mainImageId: 'user' };
    const imageAssets = new Map([['user', { image }], ...['hero', 'portrait', 'camera'].map(key => ['asset-pink-' + key, { image }])]);
    const context = { state, imageAssets, snapshot: () => JSON.stringify(state), toast() {}, console,
      loadDraftImage: async src => { assert.equal(src, 'assets/demo-pink-hero.png'); cached++; return image; },
      window: { posterCutout: { removeBackground: async original => { assert.equal(original, image); models++; return image; } } } };
    vm.runInNewContext(pink, context); await context.preparePinkDesktop(() => applied++, false);
    assert.equal(applied, 1); assert.equal(models, userMode ? 1 : 0); assert.equal(cached, userMode ? 0 : 1);
  }
  let releaseCutout, applied = 0; const state = { image: null };
  const context = { state, imageAssets: new Map(['hero', 'portrait', 'camera'].map(key => ['asset-pink-' + key, { image: { complete: true } }])),
    snapshot: () => JSON.stringify(state), toast() {}, console,
    loadDraftImage: () => new Promise(resolve => releaseCutout = resolve) };
  vm.runInNewContext(pink, context); const pendingCutout = context.preparePinkDesktop(() => applied++); state.image = { uploaded: true }; releaseCutout({}); await pendingCutout; assert.equal(applied, 0);
  assert.ok(fs.existsSync(path.join(root, 'assets/demo-pink-hero.png')));
  assert.ok(fs.readFileSync(path.join(root, 'index.html'), 'utf8').includes('poster.js?v=20261013-default-demo05'));
  console.log('PASS: demo 05 for empty storage, saved artwork preserved, startup upload races, and demo-only cached cutout');
})().catch(error => { console.error(error); process.exitCode = 1; });
