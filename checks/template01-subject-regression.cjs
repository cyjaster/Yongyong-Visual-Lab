// Run: node checks/template01-subject-regression.cjs
// Geometry coverage for the authored dense collage. This does not establish
// anatomical detection, whole-photo display, or universal face clearance.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../poster.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../samples/aespa/manifest.json'), 'utf8'));
function section(start, end) {
  const from = source.indexOf(start), to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `production source section exists: ${start}`);
  return source.slice(from, to);
}
const production = [
  source.split('\n').find(line => line.includes('const cleanFilters =')),
  section('  function getImageSourceInfo(', '  function updateRemixCard('),
  section('  function syncFrameRelativeToParent(', '  function renderImageTray('),
  section('  function getCover()', '  function raster('),
  section('  function rotatePoint(', '  function connectorPoints('),
  section('  function makeFrame(', '  function addFrame('),
  section('  function makeDetail(', '  function addDetail('),
  section('  function hasUserUploadedImages(', '  function applyDemo(')
].join('\n');
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-7,
  `${message}: ${actual} != ${expected}`);
function harness(photos, primaryIndex = 0) {
  let sequence = 0;
  const imageAssets = new Map(photos.map(photo => [photo.id, { id: photo.id,
    name: photo.filename || `${photo.id}.jpg`, origin: 'upload',
    image: { naturalWidth: photo.width, naturalHeight: photo.height, src: photo.id } }]));
  const mainAsset = imageAssets.get(photos[primaryIndex].id);
  const state = { image: mainAsset.image, mainImageId: mainAsset.id, imageName: mainAsset.name,
    assets: photos.map(photo => ({ id: photo.id, name: imageAssets.get(photo.id).name })),
    main: { id: 'main-image' }, secondaries: [], frames: [], details: [], fragments: [], texts: [], layers: [], filters: {} };
  const context = vm.createContext({ state, imageAssets, console,
    imageBox: { x: 70, y: 150, w: 760, h: 900 },
    makeId: () => `layer-${++sequence}`, motion: { capture: () => null, play() {} },
    document: { querySelectorAll: () => [] }, window: {},
    emptyState: { classList: { add() {} } }, status: {},
    toast() {}, render() {}, renderImageTray() {}, renderInspector() {}, commit() {},
    updateRemixCard() {}, markManuallyEdited() {}, fitWorkspace() {}, requestAnimationFrame: fn => fn() });
  vm.runInContext(`let remixBaseSnapshot = null, remixLastResultSnapshot = null;
    let lastRemixCopyName = '', lastRemixAnchorName = '', lastRemixFramePatternName = '';
    let history = [], historyIndex = -1, zoomMode = 'fit'; ${production}`, context);
  return { state, context, imageAssets };
}
const boxValues = item => [item.x,item.y,item.w,item.h];
function normalizedSource(h, frame) {
  const image = h.context.getSourceImageForFrame(frame), rect = h.context.sourceRect(frame);
  return { x: rect.sx/image.naturalWidth, y: rect.sy/image.naturalHeight,
    w: rect.sw/image.naturalWidth, h: rect.sh/image.naturalHeight };
}
function assertUniformCover(h, image, box, label) {
  const cover = h.context.imageCover(image,box);
  assert.ok(Number.isFinite(cover.scale) && cover.scale>0, `${label}: finite cover scale`);
  near(cover.w/image.naturalWidth,cover.h/image.naturalHeight,`${label}: one scale retains the photo ratio`);
  assert.ok(cover.w>=box.w-1e-7 && cover.h>=box.h-1e-7,`${label}: cover fills the display box`);
}
function assertAuthoredTemplate(h, label) {
  const {state,context,imageAssets}=h;
  assert.equal(state.main.layoutMode,'AESPA RICH MAN ARCHIVE',`${label}: dense archive layout is active`);
  assert.deepEqual(boxValues(state.main),[38,105,824,1035],`${label}: authored main backdrop`);
  assertUniformCover(h,state.image,state.main,`${label} main`);
  assert.equal(state.secondaries.length,4,`${label}: four authored collage slots remain`);
  const cards=[[28,175,160,215],[605,285,265,360],[575,785,280,175],[440,855,185,145]];
  state.secondaries.forEach((card,i)=>{
    assert.deepEqual(boxValues(card),cards[i],`${label}: collage card ${i+1} position`);
    const asset=imageAssets.get(card.imageId);
    assert.ok(asset && state.assets.some(meta=>meta.id===asset.id),`${label}: card refers to a retained asset`);
    assertUniformCover(h,asset.image,card,`${label} card ${i+1}`);
  });
  assert.deepEqual(Array.from(state.fragments,boxValues),[[125,135,168,185],[220,615,155,175],[240,840,125,125]],
    `${label}: yellow blocks keep their staggered locations`);
  assert.equal(state.frames.length,3); assert.equal(state.details.length,3);
  assert.deepEqual(Array.from(state.details,boxValues),[[95,295,235,145],[65,915,245,140],[620,665,240,90]],
    `${label}: detail windows retain the dense arrangement with copies at lower-left / right`);
  assert.equal(new Set(state.details.map(detail=>detail.frameId)).size,3,`${label}: each detail has its own source frame`);
  state.frames.forEach(frame=>{
    assert.equal(frame.sourceId,'main'); assert.equal(frame.parentObjectId,'main');
    assert.equal(context.getSourceImageForFrame(frame),state.image,`${label}: frame samples the actual primary`);
    const crop=normalizedSource(h,frame);
    assert.ok(crop.x>=0 && crop.y>=0 && crop.w>0 && crop.h>0 && crop.x+crop.w<=1+1e-7 && crop.y+crop.h<=1+1e-7,
      `${label}: clipped source crop stays inside the photo`);
    const detail=state.details.find(item=>item.frameId===frame.id);
    for(const key of ['frameId','sourceFrameId']) assert.equal(detail[key],frame.id);
    for(const key of ['sourceImageId','derivedFromImageId']) assert.equal(detail[key],state.mainImageId);
    assert.equal(detail.sourceId,'main'); assert.equal(detail.derivedFromObjectId,'main');
  });
  const hero=state.texts.find(text=>text.id==='t-hero-richman');
  assert.equal(hero.content,'RICH MAN'); assert.deepEqual([hero.x,hero.y,hero.size],[340,22,78]);
  const aespa=state.texts.find(text=>text.id==='t-hero-aespa');
  assert.equal(aespa.content,'aespa'); assert.deepEqual([aespa.x,aespa.y,aespa.size],[620,255,48]);
  const statement=state.texts.find(text=>text.id==='t-statement2');
  assert.deepEqual([statement.x,statement.y,statement.size],[92,785,29]); assert.equal(statement.strikeThrough,true);
  assert.ok(state.texts.some(text=>text.id==='t-stack3'),`${label}: dense repeated typography remains`);
  assert.ok(!state.texts.some(text=>/PRIMARY \/ 01|DETAIL \/ STUDIES|IMAGE \/ SEQUENCE/.test(text.content)),
    `${label}: rejected sidebar typography is absent`);
  const layerIds=new Set(state.layers.map(layer=>`${layer.type}:${layer.id}`));
  assert.equal(layerIds.size,state.layers.length,`${label}: no duplicated render layers`);
  assert.equal(state.layers[0].type,'main');
  for(const [collection,type] of [['secondaries','secondary'],['frames','frame'],['details','detail'],['fragments','fragment'],['texts','text']])
    state[collection].forEach(item=>assert.ok(layerIds.has(`${type}:${item.id}`),`${label}: retained item has a render layer`));
}
function geometrySnapshot(state) {
  return JSON.stringify(['main','secondaries','frames','details','fragments','texts'].map(key=>
    Array.isArray(state[key]) ? state[key].map(item=>({id:item.id,x:item.x,y:item.y,w:item.w,h:item.h,rotation:item.rotation}))
      : {x:state[key].x,y:state[key].y,w:state[key].w,h:state[key].h,rotation:state[key].rotation}));
}
let passed=0,failed=0;
function test(name,run) {
  try {run();passed++;console.log(`PASS: ${name}`);}
  catch(error) {failed++;console.error(`FAIL: ${name}\n  ${error.stack}`);}
}
const shapes=[...manifest.images,
  {id:'synthetic-square',width:1024,height:1024},{id:'synthetic-tall',width:600,height:3600},
  {id:'synthetic-landscape',width:2400,height:1200},{id:'synthetic-panorama',width:6000,height:600},
  {id:'synthetic-extreme-tall',width:64,height:4096},{id:'synthetic-extreme-wide',width:4096,height:64}];
assert.equal(manifest.images.length,21,'fixed library dimensional coverage stays explicit');
for(const photo of shapes) test(`single ${photo.id} ${photo.width}x${photo.height}: dense archive / uniform cover / bound sources`,()=>{
  const h=harness([photo]),assets=JSON.stringify(h.state.assets),image=h.state.image;
  h.context.applyLayoutTemplate01(null,false,false); assertAuthoredTemplate(h,photo.id);
  assert.equal(h.state.mainImageId,photo.id);assert.equal(h.state.image,image);assert.equal(JSON.stringify(h.state.assets),assets);
  h.state.secondaries.forEach(card=>assert.equal(card.imageId,photo.id));
  const before=geometrySnapshot(h.state);h.context.applyFilterTemplate01(false);
  assert.equal(geometrySnapshot(h.state),before,'filter-only action retains authored geometry');
  assertAuthoredTemplate(h,`${photo.id} after filter`);
});
const mixed=['aespa-08','aespa-12','aespa-15','aespa-11'].map(id=>manifest.images.find(photo=>photo.id===id));
for(let primaryIndex=0;primaryIndex<mixed.length;primaryIndex++) test(`four photos with ${mixed[primaryIndex].id} primary: slot cycling and source identities`,()=>{
  const h=harness(mixed,primaryIndex),assets=JSON.stringify(h.state.assets);
  h.context.applyLayoutTemplate01(null,false,false);assertAuthoredTemplate(h,mixed[primaryIndex].id);
  assert.equal(h.state.mainImageId,mixed[primaryIndex].id);assert.equal(JSON.stringify(h.state.assets),assets);
  const candidates=mixed.filter((_,i)=>i!==primaryIndex).map(photo=>photo.id);
  assert.deepEqual(Array.from(h.state.secondaries,card=>card.imageId),[...candidates,candidates[0]]);
  h.context.applyFilterTemplate01(false);assertAuthoredTemplate(h,'four photos after filter');
});
test('two photos preserve primary and alternate support / primary through four collage slots',()=>{
  const h=harness(mixed.slice(0,2));h.context.applyLayoutTemplate01(null,false,false);assertAuthoredTemplate(h,'two photos');
  assert.deepEqual(Array.from(h.state.secondaries,card=>card.imageId),[mixed[1].id,mixed[0].id,mixed[1].id,mixed[0].id]);
});
test('seven uploads retain the whole pool even when only four supporting slots are visible',()=>{
  const h=harness(manifest.images.slice(0,7),5),assets=JSON.stringify(h.state.assets);
  h.context.applyLayoutTemplate01(null,false,false);assertAuthoredTemplate(h,'seven photos');
  assert.equal(h.state.assets.length,7);assert.equal(JSON.stringify(h.state.assets),assets);
});
test('moving / scaling primary and adjusting photo zoom / pan update linked source crops',()=>{
  const h=harness([mixed[0]]);h.context.applyLayoutTemplate01(null,false,false);
  const before=h.state.frames.map(frame=>normalizedSource(h,frame));
  Object.assign(h.state.main,{x:h.state.main.x+13,y:h.state.main.y+19,w:h.state.main.w*1.25,h:h.state.main.h*1.25,
    panX:h.state.main.panX*1.25,panY:h.state.main.panY*1.25});
  h.context.syncAllChildFramesOf('main-image');
  h.state.frames.forEach((frame,i)=>{
    const crop=normalizedSource(h,frame);Object.keys(crop).forEach(key=>near(crop[key],before[i][key],`scaled primary retains source ${key}`));
  });
  const originalZoom=h.state.main.zoom;h.state.main.zoom=1.4;
  h.state.frames.forEach((frame,i)=>{
    const crop=normalizedSource(h,frame);near(crop.w,before[i].w*originalZoom/1.4,'uniform zoom shrinks sampled width');
    near(crop.h,before[i].h*originalZoom/1.4,'uniform zoom shrinks sampled height');
  });
  const zoomed=h.state.frames.map(frame=>normalizedSource(h,frame));h.state.main.panX+=12;
  const shift=12/h.context.getCover().scale/h.state.image.naturalWidth;
  h.state.frames.forEach((frame,i)=>{
    const crop=normalizedSource(h,frame);near(crop.x,zoomed[i].x-shift,'horizontal photo pan moves sampled pixels');
    near(crop.y,zoomed[i].y,'horizontal photo pan retains vertical sample');
  });
  const frame=h.state.frames[0],beforeFrameMove=normalizedSource(h,frame);frame.x+=30;
  h.context.syncFrameRelativeToParent(frame);
  assert.ok(normalizedSource(h,frame).x>beforeFrameMove.x,'moving the sampling frame changes the bound detail crop');
  frame.rotation+=12;assert.ok(normalizedSource(h,frame).w>beforeFrameMove.w,'frame rotation changes its sampled extent');
});
test('ordinary manually created frames keep their existing minimum size',()=>{
  const h=harness([mixed[0]]);h.context.applyLayoutTemplate01(null,false,false);
  const frame=h.context.makeFrame(9,{sourceId:'main',w:1,h:1});h.state.frames.push(frame);
  h.context.syncAllChildFramesOf('main');assert.equal(frame.w,20);assert.equal(frame.h,20);
});
test('explicit demo reset uses the same authored layout with the distinct demo assets',()=>{
  const h=harness([mixed[0]]),image={naturalWidth:736,naturalHeight:1041,src:'demo'};
  h.context.applyLayoutTemplate01({close:image,hands:image,crouch:image,sky:image},true,false);assertAuthoredTemplate(h,'demo');
  assert.equal(h.state.mainImageId,'asset-karina-close');assert.equal(h.context.hasUserUploadedImages(),false);
  assert.deepEqual(Array.from(h.state.secondaries,card=>card.imageId),['asset-karina-hands','asset-karina-crouch','asset-karina-sky','asset-karina-close']);
});
test('template 02 remains its separate seven-window design; returning to template 01 preserves uploads',()=>{
  const h=harness(mixed,1),assets=JSON.stringify(h.state.assets),image=h.state.image;
  h.context.applyLayoutTemplate01(null,false,false);h.context.applyLayoutTemplate02(null,false,false);
  assert.equal(h.state.details.length,7);assert.equal(h.state.fragments.length,0);
  assert.deepEqual(boxValues(h.state.main),[35,95,830,1090]);
  assert.ok(h.state.texts.some(text=>text.content==='AFTER IMAGE'));
  assert.ok(!h.state.texts.some(text=>text.content==='RICH MAN'));
  assert.equal(h.state.filters.motionDistance,4);assert.equal(h.state.filters.grain,7);
  assert.equal(h.state.mainImageId,mixed[1].id);assert.equal(h.state.image,image);assert.equal(JSON.stringify(h.state.assets),assets);
  h.context.applyLayoutTemplate01(null,false,false);assertAuthoredTemplate(h,'return from template 02');
  assert.equal(h.state.mainImageId,mixed[1].id);assert.equal(JSON.stringify(h.state.assets),assets);
});
console.log(`\nTemplate 01 authored-layout regression: ${passed} passed, ${failed} failed (${manifest.images.length} actual sample dimensions).`);
if(failed) process.exitCode=1;
