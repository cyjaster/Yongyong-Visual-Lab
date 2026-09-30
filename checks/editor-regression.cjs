// Run with: node checks/editor-regression.cjs (no dependencies).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../poster.js'), 'utf8');
const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const context = vm.createContext({ assert, setTimeout, clearTimeout });
vm.runInContext(`
  let state = { value: 0, main: { id: 'main-image' }, frames: [] };
  let history = [], historyIndex = -1, historyTimer = 0;
  const snapshot = () => JSON.stringify(state);
  const toast = () => {};
  const restore = (index) => { state = JSON.parse(history[index]); historyIndex = index; };
  ${section('  function commit(', '  function markManuallyEdited(')}
  ${section('  function undo()', '  function getCover()')}
  commit(); state.value = 1; commit(false); undo();
  assert.equal(state.value, 0, 'Immediate undo must preserve the pending edit for redo');
  redo(); assert.equal(state.value, 1);
  undo(); state.value = 2; commit(false); redo();
  assert.equal(state.value, 2, 'A new edit must invalidate the old redo branch');
  assert.equal(historyTimer, 0);
  const synced = [];
  const syncFrameAbsoluteFromParent = (frame) => synced.push(frame.id);
  ${section('  function syncAllChildFramesOf(', '  function renderImageTray(')}
  state.frames = [{id: 'a', sourceId: 'main'}, {id: 'b', sourceId: 'secondary'}];
  syncAllChildFramesOf('main-image'); assert.equal(synced.join(), 'a');
  ${source.split('\n').find(line => line.includes('const escapeHTML ='))}
  assert.equal(escapeHTML('<tag a="x">&'), '&lt;tag a=&quot;x&quot;&gt;&amp;');
  ${section('  const field =', '  const toggle =')}
  const input = field('标题', 'Title', 'content', 'a" autofocus="yes');
  assert.ok(input.includes('value="a&quot; autofocus=&quot;yes"'));
  const area = field('标题', 'Title', 'content', '</textarea><img>', 'textarea');
  assert.ok(area.includes('&lt;/textarea&gt;&lt;img&gt;'));
`, context);
console.log('PASS: pending undo/redo, redo branching, main-frame sync, safe text fields');

vm.runInNewContext(`
  const image = { naturalWidth: 1000, naturalHeight: 500 };
  const state = { image, main: { x: 0, y: 0, w: 1000, h: 500 }, secondaries: [] };
  const imageAssets = new Map();
  ${section('  function getCover()', '  function raster(')}
  ${section('  function rotatePoint(', '  function transformBox(')}
  const near = (a, b) => assert.ok(Math.abs(a-b) < 1e-8, a + ' != ' + b);
  const f = { x: 400, y: 200, w: 80, h: 20, rotation: 90 };
  let r = sourceRect(f); near(r.sw, 20); near(r.sh, 80);
  f.rotation = 45; r = sourceRect(f);
  near(r.sw, 100/Math.sqrt(2)); near(r.sh, 100/Math.sqrt(2));
  state.main.rotation = 90; f.rotation = 90; r = sourceRect(f);
  near(r.sw, 80); near(r.sh, 20);
  state.main.rotation = 0;
  state.secondaries.push({ id: 'secondary', imageId: 'photo', x: 0, y: 0, w: 100, h: 200 });
  imageAssets.set('photo', { image });
  r = sourceRect({ x: 0, y: 0, w: 100, h: 200, sourceId: 'secondary' });
  near(r.sx, 375); near(r.sy, 0); near(r.sw, 250); near(r.sh, 500);
  for (const x of [-9999, 9999]) {
    r = sourceRect({ x, y: x, w: 80, h: 20 });
    assert.ok(r.sx >= 0 && r.sy >= 0 && r.sw > 0 && r.sh > 0);
    assert.ok(r.sx+r.sw <= image.naturalWidth && r.sy+r.sh <= image.naturalHeight);
  }
  let draw;
  const raster = (w,h,paint) => { const target = { width: Math.round(w), height: Math.round(h) }; paint({ drawImage: (...args) => draw = args },target); return target; };
  const pixelEffects = () => {}, halftone = () => {}, surfaceTexture = () => {};
  ${section('  function filteredImage(', '  function detailOptions(')}
  for (const [w,h] of [[300,70],[70,300],[240,120],[137.3,221.7]]) {
    filteredImage(image, { sx: 20, sy: 40, sw: 240, sh: 120 }, w,h,{});
    const [,sx,sy,sw,sh] = draw;
    near(w/sw, h/sh);
    assert.ok(sx >= 20 && sy >= 40 && sx+sw <= 260+1e-8 && sy+sh <= 160+1e-8);
  }
  filteredImage(image, null, 1000,500,{});
  assert.equal(draw.length, 5, 'Main image keeps its existing uniform cover path');
`, { assert });
console.log('PASS: proportional image cards, fractional sizes, rotated frame sampling, secondary cover mapping, source bounds');

vm.runInNewContext(`
  const mainImage = { naturalWidth: 600, naturalHeight: 800 };
  const state = { image: mainImage, imageName:'user.jpg', mainImageId:'main', assets:[{id:'main',name:'user.jpg'}],
    main:{id:'main-image'}, secondaries:[], frames:[{id:'frame',sourceId:'main'}], details:[{id:'detail',frameId:'frame'}],
    fragments:[], texts:[{id:'title',content:'USER TITLE'}], layers:[{type:'main',id:'main-image'}], selected:null };
  const imageAssets = new Map([['main',{image:mainImage}]]);
  const imageTray = {innerHTML:''}, trayCount = {textContent:''};
  const hasSecondaryImages = () => state.secondaries.length > 0;
  const renderInspector = () => {}, render = () => {}, updateRemixCard = () => {}, markManuallyEdited = () => {}, toast = () => {};
  const emptyState = {classList:{add:()=>{}}}, status = {};
  let id = 0, history = [], historyIndex = -1, historyTimer = 0;
  const makeId = () => 'card-' + ++id, cleanFilters = () => ({});
  const setSelected = (type,item) => state.selected = item ? {type,id:item.id} : null;
  const layerIndex = (type,id) => state.layers.findIndex(l=>l.type===type && l.id===id);
  const addLayer = (type,id,after=state.layers.length-1) => state.layers.splice(after+1,0,{type,id});
  const ensureMainLayer = () => { if (!state.layers.some(l=>l.type==='main')) state.layers.push({type:'main',id:'main-image'}); };
  const frameById = id => state.frames.find(f=>f.id===id);
  const snapshot = () => { const {image,...rest} = state; return JSON.stringify(rest); };
  ${source.split('\n').find(line => line.includes('const escapeHTML ='))}
  ${section('  function commit(', '  function markManuallyEdited(')}
  ${section('  function renderImageTray()', '  function setMainImage(')}
  ${section('  function addSecondaryImage(', '  function getCover()')}
  commit(); renderImageTray();
  assert.equal(trayCount.textContent,'1 IMAGES');
  assert.equal(hasSecondaryImages(),false);
  const existing = JSON.stringify([state.frames,state.details,state.texts,state.main]);
  appendImages(['a','b'].map(id=>({id,name:id+'.jpg',image:{naturalWidth:800,naturalHeight:600}})));
  assert.equal(state.image,mainImage,'Adding photos must not replace even the demo or current main');
  assert.equal(JSON.stringify([state.frames,state.details,state.texts,state.main]),existing);
  assert.equal(trayCount.textContent,'3 IMAGES'); assert.ok(hasSecondaryImages());
  assert.equal(history.length,2,'One upload batch is one undo step');
  undo(); assert.equal(state.secondaries.length,0); assert.equal(trayCount.textContent,'1 IMAGES');
  redo(); assert.equal(state.secondaries.length,2); assert.ok(imageAssets.has('a'));
  deleteAsset('a'); deleteAsset('b');
  assert.equal(hasSecondaryImages(),false); assert.equal(trayCount.textContent,'1 IMAGES');
  assert.equal(state.details.length,1); assert.equal(state.texts[0].content,'USER TITLE');
  undo(); assert.equal(state.secondaries.length,1); assert.ok(imageAssets.has('b'),'Deleted pixels remain available for undo');
  assert.ok(imageTray.innerHTML.includes('b.jpg'));
  state.image=null; state.mainImageId=''; state.assets=[]; state.secondaries=[]; state.layers=[];
  appendImages([{id:'first',name:'first.jpg',image:mainImage},{id:'next',name:'next.jpg',image:mainImage}]);
  assert.equal(state.mainImageId,'first'); assert.equal(state.secondaries.length,1);
  undo(); assert.equal(state.image,null,'Undo first upload must restore an empty poster');
  redo(); assert.equal(state.mainImageId,'first'); assert.equal(state.image,mainImage);
`, {assert,setTimeout,clearTimeout});
assert.ok(!source.includes('state.mode'), 'Image count, not a saved mode, determines remix behavior');
console.log('PASS: unified image flow, non-destructive batch add, empty poster, image counts, one-step undo/redo, deletion undo');
