// Run with: node checks/editor-regression.cjs (no dependencies).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../poster.js'), 'utf8');
const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const context = vm.createContext({ assert, setTimeout, clearTimeout });
vm.runInContext(`
  let state = { value: 0, main: { id: 'main-image' }, frames: [] };
  let history = [], historyIndex = -1, historyTimer = 0, historyTransactionDepth = 0;
  const snapshot = () => JSON.stringify(state);
  const toast = () => {};
  const restore = (index) => { state = JSON.parse(history[index]); historyIndex = index; };
  const pruneAssetCaches = () => {};
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
  const photo = {}; const imageAssets = new Map([['photo', {image:photo}]]);
  let state = {image:photo,mainImageId:'photo',value:0,exportResolution:[1200,1600]};
  let history = [], historyIndex = -1, historyTimer = 0, historyTransactionDepth = 0;
  let currentMasterIndex = -1, currentLayoutIndex = 0, currentFilterIndex = 0;
  const toast = () => {}, renderImageTray = () => {}, renderInspector = () => {}, render = () => {}, updateRemixCard = () => {};
  const updateMasterRemixControls = () => {};
  const pruneAssetCaches = () => {};
  ${section('  function snapshot()', '  function markManuallyEdited(')}
  ${section('  function restore(index)', '  function getCover()')}
  commit(); state.value=1; commit(); state.exportResolution=[1800,2400];
  undo(); assert.equal(state.value,0); assert.equal(state.exportResolution.join(),'1800,2400');
  redo(); assert.equal(state.value,1); assert.equal(state.exportResolution.join(),'1800,2400');
  state.exportResolution=[1200,1600]; undo();
  assert.equal(state.exportResolution.join(),'1200,1600','Editing history must not silently change the chosen PNG size');
  assert.equal(JSON.parse(snapshot()).exportResolution,undefined);
`, {assert,setTimeout,clearTimeout});
console.log('PASS: selected PNG dimensions remain stable across editing undo/redo');

vm.runInNewContext(`
  const W=900, H=1200, canvasWrap={style:{}}, zoomValue={};
  const viewport={clientWidth:424,clientHeight:578,scrollLeft:0,scrollTop:0};
  const $=()=>({hidden:false}); let zoom=1, zoomMode='fit';
  const requestAnimationFrame=fn=>fn();
  const getComputedStyle=()=>({paddingLeft:'10px',paddingRight:'10px',paddingTop:'10px',paddingBottom:'10px'});
  ${section('  function applyZoom(', '  function snapshot(')}
  fitWorkspace();
  assert.equal(zoom,.44);
  assert.ok(parseFloat(canvasWrap.style.width)+20<=viewport.clientWidth);
  assert.ok(parseFloat(canvasWrap.style.height)+20<=viewport.clientHeight);
  viewport.clientWidth=720; viewport.clientHeight=578; fitWorkspace();
  assert.equal(zoom,.46); assert.equal(zoomValue.textContent,'46%');
  applyZoom(.467,'manual'); assert.equal(zoom,.47,'Manual zoom still rounds normally');
`, {assert});
console.log('PASS: FIT uses actual panel padding, never rounds beyond available space');

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
  const windowCard=state.secondaries[0];windowCard.windowFrame=true;windowCard.zoom=2;windowCard.panX=9999;
  r=sourceRect({x:0,y:22,w:100,h:178,sourceId:'secondary'});
  near(r.sx,0);near(r.sy,125);near(r.sw,100/.712);near(r.sh,250);
  windowCard.windowFrame=false;windowCard.zoom=1;windowCard.panX=0;
  for (const x of [-9999, 9999]) {
    r = sourceRect({ x, y: x, w: 80, h: 20 });
    assert.ok(r.sx >= 0 && r.sy >= 0 && r.sw > 0 && r.sh > 0);
    assert.ok(r.sx+r.sw <= image.naturalWidth && r.sy+r.sh <= image.naturalHeight);
  }
  let draw;
  const raster = (w,h,paint) => { const target = { width: Math.round(w), height: Math.round(h) }; paint({ drawImage: (...args) => draw = args },target); return target; };
  const pixelEffects = () => {}, halftone = () => {}, surfaceTexture = () => {};
  const renderScale = 1;
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
  let id = 0, history = [], historyIndex = -1, historyTimer = 0, historyTransactionDepth = 0;
  let currentMasterIndex = -1, currentLayoutIndex = 0, currentFilterIndex = 0;
  const updateMasterRemixControls = () => {};
  const makeId = () => 'card-' + ++id, cleanFilters = () => ({});
  const setSelected = (type,item) => state.selected = item ? {type,id:item.id} : null;
  const layerIndex = (type,id) => state.layers.findIndex(l=>l.type===type && l.id===id);
  const addLayer = (type,id,after=state.layers.length-1) => state.layers.splice(after+1,0,{type,id});
  const ensureMainLayer = () => { if (!state.layers.some(l=>l.type==='main')) state.layers.push({type:'main',id:'main-image'}); };
  const frameById = id => state.frames.find(f=>f.id===id);
  const snapshot = () => { const {image,...rest} = state; return JSON.stringify(rest); };
  ${source.split('\n').find(line => line.includes('const escapeHTML ='))}
  const pruneAssetCaches = () => {};
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

vm.runInNewContext(`
  const photos=Array.from({length:7},(_,idx)=>({id:'upload-'+idx,
    name:idx===6?'model-techwear.jpg':'upload-'+idx+'.jpg', origin:'upload',
    image:{naturalWidth:600,naturalHeight:800,src:'photo-'+idx}}));
  const imageAssets=new Map(photos.map(photo=>[photo.id,photo]));
  const main=photos[0];
  const state={image:main.image,imageName:main.name,mainImageId:main.id,assets:photos.map(({id,name})=>({id,name})),
    main:{id:'main-image'},secondaries:[],frames:[],details:[],fragments:[],texts:[],layers:[],filters:{},selected:null};
  const imageTray={innerHTML:''},trayCount={textContent:''};
  const motion={capture:()=>null,play:()=>{}},emptyState={classList:{add:()=>{}}},status={};
  const render=()=>{},renderInspector=()=>{},updateRemixCard=()=>{},updateMasterRemixControls=()=>{},markManuallyEdited=()=>{},toast=()=>{};
  const syncAllChildFramesOf=()=>{},syncFrameRelativeToParent=()=>{},fitWorkspace=()=>{},requestAnimationFrame=fn=>fn();
  let sequence=0,history=[],historyIndex=-1,historyTimer=0,historyTransactionDepth=0;
  let currentMasterIndex=-1,currentLayoutIndex=0,currentFilterIndex=0,zoomMode='fit';
  let remixBaseSnapshot=null,remixLastResultSnapshot=null,lastRemixCopyName='',lastRemixAnchorName='',lastRemixFramePatternName='';
  const makeId=()=> 'layer-'+ ++sequence;
  const frameById=id=>state.frames.find(frame=>frame.id===id);
  const makeFrame=(number,options)=>({id:makeId(),number,...options});
  const makeDetail=(frame,idx,options)=>({id:makeId(),frameId:frame.id,...options});
  const addLayer=(type,id)=>state.layers.push({type,id});
  const ensureMainLayer=()=>{if(!state.layers.some(layer=>layer.type==='main'))addLayer('main','main-image');};
  const setSelected=(type,item)=>{state.selected=item?{type,id:item.id}:null;};
  ${source.split('\n').find(line => line.includes('const escapeHTML ='))}
  ${source.split('\n').find(line => line.includes('const cleanFilters ='))}
  const pruneAssetCaches = () => {};
  ${section('  function snapshot()', '  function markManuallyEdited(')}
  ${section('  function renderImageTray()', '  function addSecondaryImage(')}
  ${section('  function deleteAsset(', '  function getCover()')}
  ${section('  function hasUserUploadedImages()', '  function applyFilterTemplate01(')}
  const layoutRemixList = [{},{}];
  ${section('  function resolveSlotAssetIds(', '  const layoutRemixList =')}
  applyLayoutTemplate01(null,false,false);
  renderImageTray();
  const countItems=()=> (imageTray.innerHTML.match(/class="poster-tray-item/g)||[]).length;
  assert.equal(state.assets.length,7); assert.equal(state.secondaries.length,4);
  assert.equal(countItems(),7,'All seven uploads remain accessible after a four-card template applies');
  assert.equal(trayCount.textContent,'7 IMAGES');
  assert.ok(imageTray.innerHTML.includes('素材 · 未分配'));
  const geometry=()=>JSON.stringify(state.secondaries.map(card=>[card.id,card.imageId,card.x,card.y,card.w,card.h]));
  const cardsBefore=geometry(), poolBefore=JSON.stringify(state.assets);
  const unused=photos[6], unusedDelete=photos[5];
  assert.ok(!state.secondaries.some(card=>card.imageId===unused.id));
  setMainImage(unused.id);
  assert.equal(state.mainImageId,unused.id); assert.equal(state.image,unused.image);
  assert.equal(geometry(),cardsBefore,'Promoting unused photo does not add or rearrange template card slots');
  assert.equal(JSON.stringify(state.assets),poolBefore);assert.equal(countItems(),7);
  assert.equal(isDemoAsset({id:unused.id}),false,'User-controlled demo-like filename never changes upload provenance');
  undo(); assert.equal(state.mainImageId,main.id); assert.equal(state.image,main.image);assert.equal(geometry(),cardsBefore);
  redo(); assert.equal(state.mainImageId,unused.id); assert.equal(state.image,unused.image);assert.equal(countItems(),7);
  deleteAsset(unusedDelete.id);
  assert.equal(state.assets.length,6);assert.equal(countItems(),6);assert.equal(geometry(),cardsBefore);
  assert.equal(state.mainImageId,unused.id);
  undo(); assert.equal(state.assets.length,7);assert.equal(countItems(),7);assert.equal(JSON.stringify(state.assets),poolBefore);
  assert.equal(imageAssets.get(unusedDelete.id).image,unusedDelete.image,'Deleted unused pixels remain available for undo');
  redo(); assert.equal(countItems(),6);undo();
  state.assets=[{id:main.id,name:main.name}];state.mainImageId=main.id;state.image=main.image;
  state.secondaries=Array.from({length:4},(_,idx)=>({id:'repeat-'+idx,imageId:main.id}));
  renderImageTray();assert.equal(countItems(),1);assert.equal(trayCount.textContent,'1 IMAGES','Repeated scene cards count as one upload');
  const demo={id:'asset-model-techwear',name:'model-techwear.jpg',image:main.image,origin:'demo'};
  imageAssets.set(demo.id,demo);state.assets=[{id:demo.id,name:demo.name}];state.mainImageId=demo.id;state.secondaries=[];
  renderImageTray();assert.equal(countItems(),1);assert.equal(trayCount.textContent,'1 IMAGES');assert.equal(isDemoAsset(demo),true);
`,{assert,setTimeout,clearTimeout,window:{},document:{querySelectorAll:()=>[]}});
console.log('PASS: seven-photo library visibility, unused-photo promotion/deletion history, authored card count, and upload provenance');

const masterControls = {'#posterMasterRemixSub':{}, '#posterMasterRemixTag':{}, '#posterMasterRemixToplineText':{}};

vm.runInNewContext(`
  const state = { image:{}, mainImageId:'current-photo', scene:'A', style:'a', exportResolution:[1200,1600] };
  const status = {};
  const imageAssets = new Map([['current-photo',{image:state.image}]]);
  let history = [], historyIndex = -1, historyTimer = 0;
  const toast = () => {}, renderImageTray = () => {}, renderInspector = () => {}, render = () => {}, updateRemixCard = () => {};
  const hasUserUploadedImages = () => true;
  const layoutRemixList = ['A','B','C'].map((scene,idx) => ({id:'layout-0'+(idx+1),apply:()=>{ state.scene=scene; commit(); }}));
  const filterRemixList = ['a','b','c'].map(style => ({apply:()=>{ state.style=style; commit(); }}));
  const masterRemixList = ['A','B','C'].map((shortZh,idx) => ({layoutIdx:idx,filterIdx:idx,shortZh,nameZh:shortZh}));
  const pruneAssetCaches = () => {};
  ${section('  function snapshot()', '  function markManuallyEdited(')}
  ${section('  function restore(index)', '  function getCover()')}
  ${section('  let currentLayoutIndex =', '  function applyTemplate01(')}
  const layoutTemplates = [{id:'template-01-richman'},{id:'template-02-ps7'},{id:'template-03-test'}];
  ${section('  function applyLayoutTemplate(', '  function triggerMasterRemix(')}
  currentMasterIndex=0; commit();
  applyMasterRemixByIndex(1,null);
  assert.equal(history.length,2,'One total REMIX must create exactly one composed history step');
  assert.equal(state.scene,'B'); assert.equal(state.style,'b');
  undo();
  assert.equal(state.scene,'A'); assert.equal(state.style,'a');
  assert.equal(currentMasterIndex,0); assert.equal(currentLayoutIndex,0); assert.equal(currentFilterIndex,0);
  assert.equal(controls['#posterMasterRemixTag'].textContent,'[1/3] ↻','Undo restores the visible active group');
  redo();
  assert.equal(state.scene,'B'); assert.equal(state.style,'b'); assert.equal(currentMasterIndex,1);
  assert.equal(controls['#posterMasterRemixToplineText'].textContent,'[2/3] B');
  undo(); cycleMasterRemix();
  assert.equal(currentMasterIndex,1,'Next REMIX follows the restored cursor, rather than skipping or repeating a group');
  cycleMasterRemix(); assert.equal(currentMasterIndex,2); assert.equal(state.scene,'C');
  cycleMasterRemix(); assert.equal(currentMasterIndex,0); assert.equal(state.scene,'A');
  state.style='adjusted'; commit(false);
  applyMasterRemixByIndex(1,null); undo();
  assert.equal(state.style,'adjusted','Pending inspector adjustments remain the full preceding state');
  history.push(JSON.stringify({scene:'legacy',style:'legacy',mainImageId:''}));
  restore(history.length-1);
  assert.equal(currentMasterIndex,-1,'Legacy snapshots without cursor metadata fall back safely');
  assert.equal(state.exportResolution.join(),'1200,1600');
  assert.equal(applyLayoutTemplate('template-02-ps7'),true); assert.equal(state.scene,'B');
  assert.equal(applyLayoutTemplate('template-01-richman'),true); assert.equal(state.scene,'A');
  assert.equal(applyLayoutTemplate('layout-02'),true); assert.equal(state.scene,'B');
  assert.equal(applyLayoutTemplate('layout-01'),true); assert.equal(state.scene,'A');
  const beforeUnknown = snapshot(), beforeUnknownHistory = history.length;
  assert.equal(applyLayoutTemplate('missing-template'),false);
  assert.equal(snapshot(),beforeUnknown,'Unknown explicit ID must leave the scene and cursor unchanged');
  assert.equal(history.length,beforeUnknownHistory);
  applyLayoutTemplate();assert.equal(state.scene,'A','An empty scene must not silently load demo photos');
  state.image=imageAssets.get('current-photo').image;state.mainImageId='current-photo';
  assert.equal(applyLayoutTemplate(),true); assert.equal(state.scene,'B','Omitting the ID retains the cycling API');
`, {
  assert,setTimeout,clearTimeout,
  controls: masterControls,
  document: {querySelector: selector => masterControls[selector] || null,querySelectorAll:()=>[]}
});
console.log('PASS: composed master REMIX history, cursor restoration, 3-group cycle, published/legacy IDs, and snapshot compatibility');

vm.runInNewContext(`
  let state = {
    image: null, imageName: '', mainImageId: '', assets: [], secondaries: [],
    frames: [], details: [], fragments: [], texts: [], layers: [], filters: {}
  };
  const imageAssets = new Map();
  const emptyState = { classList: { add: () => {}, remove: () => {} } };
  const status = { textContent: '' };
  const motion = { capture: () => ({}), play: () => {} };
  let lastToast = '';
  const toast = (msg) => { lastToast = msg; };
  let remixBaseSnapshot = null, remixLastResultSnapshot = null;
  let lastRemixCopyName = '', lastRemixAnchorName = '', lastRemixFramePatternName = '', lastRemixBackgroundStyle = '';
  let history = [], historyIndex = -1, historyTimer = 0;
  let zoomMode = 'fit';
  const fitWorkspace = () => {};
  const requestAnimationFrame = (fn) => fn();
  const makeId = () => 'id-' + Math.random().toString(36).slice(2, 8);
  const cleanFilters = () => ({ bw: 0, brightness: 0, contrast: 0, saturation: 100, halftone: 0, grain: 0 });
  const makeFrame = (num, opts) => ({ id: makeId(), number: num, ...opts });
  const makeDetail = (frame, idx, opts) => ({ id: makeId(), frameId: frame.id, ...opts });
  const syncAllChildFramesOf = () => {};
  const renderImageTray = () => {};
  const renderInspector = () => {};
  const render = () => {};
  const commit = () => {};
  const updateRemixCard = () => {};
  const markManuallyEdited = () => {};

  ${section('  function hasUserUploadedImages()', '  function applyDemo(')}
  ${section('  const layoutTemplates = [', '  function remixLayout(')}

  // 1. Initial State: Demo assets
  const demoImg = { naturalWidth: 800, naturalHeight: 1000, src: 'demo' };
  applyTemplate01({ close: demoImg, hands: demoImg, crouch: demoImg, sky: demoImg }, true);
  assert.equal(hasUserUploadedImages(), false, 'Demo state must not be flagged as user uploaded');
  assert.equal(state.mainImageId, 'asset-karina-close');

  // 2. User uploads a custom photo
  const userPhoto = { naturalWidth: 600, naturalHeight: 800, src: 'user-photo' };
  const uid = 'user-p1';
  imageAssets.set(uid, { id: uid, name: 'my-vacation.jpg', image: userPhoto, src: userPhoto.src });
  state.assets = [{ id: uid, name: 'my-vacation.jpg' }];
  state.image = userPhoto;
  state.imageName = 'my-vacation.jpg';
  state.mainImageId = uid;

  assert.equal(hasUserUploadedImages(), true);
  triggerMasterRemix();

  assert.equal(state.image, userPhoto, 'Master Remix must preserve user image as main');
  assert.equal(state.imageName, 'my-vacation.jpg');
  assert.equal(state.mainImageId, uid);
  assert.equal(state.assets.length, 1, 'Demo assets must be pruned from state.assets');
  assert.equal(state.secondaries.length, 0, 'Template 02 keeps a single uploaded photo as the base');
  assert.equal(state.details.length, 7);
  state.frames.forEach(f => assert.equal(f.sourceId, 'main', 'Template 02 crops must sample the uploaded main'));
  assert.equal(state.backgroundStyle, 'solid');
  assert.ok(lastToast.includes('已为您的图片应用模板 02'), 'The active template index advances from demo 01 to template 02');

  // 3. User with multiple photos
  const u2 = 'user-p2', u3 = 'user-p3';
  imageAssets.set(u2, { id: u2, name: 'p2.jpg', image: userPhoto, src: userPhoto.src });
  imageAssets.set(u3, { id: u3, name: 'p3.jpg', image: userPhoto, src: userPhoto.src });
  state.assets.push({ id: u2, name: 'p2.jpg' }, { id: u3, name: 'p3.jpg' });
  const uploadedPool = JSON.stringify(state.assets);
  triggerMasterRemix();
  assert.equal(state.secondaries.length, 7, "Template 03 contains seven photo slots");
  assert.ok(state.posterPaper, "Template 03 installs its paper panel");
  assert.equal(JSON.stringify(state.assets), uploadedPool, "Template 03 preserves all uploads");
  assert.equal(state.mainImageId, uid, "Template 03 preserves the main photo");
  triggerMasterRemix();
  assert.equal(state.secondaries.length,3,'Template 04 has a foreground and two desktop windows');
  assert.equal(state.texts[0].textStyle,'balloon');
  assert.equal(JSON.stringify(state.assets),uploadedPool);
  triggerMasterRemix();
  assert.equal(currentMasterIndex,4);
  assert.equal(state.secondaries.filter(s=>s.windowStyle==='photo-booth').length,1);
  triggerMasterRemix();
  assert.equal(currentMasterIndex,5);
  assert.equal(state.secondaries.find(s=>s.id==='desktop-background').filters.blur,14);
  triggerMasterRemix();assert.equal(currentMasterIndex,6);assert.equal(state.secondaries.length,3);
  triggerMasterRemix();assert.equal(currentMasterIndex,7);assert.equal(state.filters.bw,100);
  triggerMasterRemix();
  const assertUploadedCollage = () => {
    assert.equal(state.image, userPhoto, 'Dense collage retains the decoded uploaded primary');
    assert.equal(state.mainImageId, uid, 'Dense collage retains the chosen primary ID');
    assert.equal(state.imageName, 'my-vacation.jpg');
    assert.equal(JSON.stringify(state.assets), uploadedPool, 'All three uploaded assets retain order and metadata');
    assert.equal(state.secondaries.length, 4, 'Dense collage retains all four authored image slots');
    assert.deepEqual(state.secondaries.map(card => card.imageId), [u2, u3, u2, u3],
      'Four collage slots cycle through the two available non-primary uploads');
    state.secondaries.forEach(card => assert.ok(imageAssets.get(card.imageId)?.image,
      'Every slot remains bound to loaded image pixels'));
    assert.equal(state.frames.length, 3); assert.equal(state.details.length, 3);
    state.frames.forEach(frame => assert.equal(frame.sourceId, 'main', 'Detail frames sample the chosen uploaded primary'));
    state.details.forEach(detail => assert.ok(state.frames.some(frame => frame.id === detail.frameId),
      'Every detail retains its sampling-frame association'));
  };
  assertUploadedCollage();

  // 4. Test Modular Layout Template 01 (geometry only, preserves filters/bg)
  state.backgroundStyle = 'scan';
  state.filters.contrast = 99;
  const filtersBeforeLayout = JSON.stringify(state.filters);
  applyLayoutTemplate01(null, false, true);
  assert.equal(state.backgroundStyle, 'scan', 'applyLayoutTemplate01 should not override existing backgroundStyle');
  assert.equal(JSON.stringify(state.filters), filtersBeforeLayout, 'Layout-only action retains all user filter adjustments');
  assertUploadedCollage();
  assert.equal(state.main.layoutMode, 'AESPA RICH MAN ARCHIVE', 'Uploaded layout uses the authored dense collage');
  assert.deepEqual(state.secondaries.map(card => [card.x, card.y, card.w, card.h]),
    [[28,175,160,215], [605,285,265,360], [575,785,280,175], [440,855,185,145]],
    'Layout keeps the authored staggered image slots rather than the rejected sidebar');
  assert.ok(lastToast.includes('排版模板 01'), 'Toast mentions Layout Template 01');

  // 5. Test Modular Filter Template 01 (styling only, coordinates remain)
  const sceneGeometry = () => JSON.stringify(['main','secondaries','frames','details','fragments','texts'].map(key => {
    const items = Array.isArray(state[key]) ? state[key] : [state[key]];
    return items.map(item => ({ id:item.id, x:item.x, y:item.y, w:item.w, h:item.h, rotation:item.rotation }));
  }));
  const beforeFilterGeometry = sceneGeometry();
  applyFilterTemplate01(true);
  assert.equal(state.backgroundStyle, 'electric-tiger', 'applyFilterTemplate01 sets electric tiger base');
  assert.equal(sceneGeometry(), beforeFilterGeometry, 'Filter-only action retains every authored scene position and size');
  assertUploadedCollage();
  assert.ok(lastToast.includes('滤镜模板 01'), 'Toast mentions Filter Template 01');

  // 6. Demo Reset
  applyTemplate01({ close: demoImg, hands: demoImg, crouch: demoImg, sky: demoImg }, true);
  assert.equal(state.mainImageId, 'asset-karina-close');
  assert.equal(hasUserUploadedImages(), false);
`, {
  assert,
  setTimeout,
  clearTimeout,
  document: {
    querySelectorAll: () => [],
    querySelector: () => null,
    getElementById: () => null
  },
  window: {}
});
console.log('PASS: user image preservation on Master Remix, multi-image slot distribution, decoupled layout 01 and filter 01');


{
  const begin=source.indexOf('    if (t.backgroundColor && t.backgroundEnabled !== false)'),end=source.indexOf('    ctx.fillStyle = t.color;',begin),paint=source.slice(begin,end);
  for(const opacity of [undefined,0,45,100]){
    let alpha;const ctx={globalAlpha:.6,save(){this.saved=this.globalAlpha;},restore(){this.globalAlpha=this.saved;},fillRect(){alpha=this.globalAlpha;}};
    vm.runInNewContext(paint,{ctx,t:{backgroundColor:'#171717',backgroundOpacity:opacity,content:'Toolbar',size:15,font:'Arial',weight:400},lh:1.1,measureLine:()=>80});
    assert.equal(alpha,.6*(opacity??100)/100);assert.equal(ctx.globalAlpha,.6,'Backing opacity must not fade the text');
  }
}
console.log('PASS: separate text backing opacity, zero disables only the backing and legacy default stays opaque');
