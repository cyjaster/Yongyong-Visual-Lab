// Run: node checks/export-history-regression.cjs
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname,'../poster.js'),'utf8');
function section(a,b) { const x=source.indexOf(a), y=source.indexOf(b,x); assert.ok(x>=0&&y>x,a); return source.slice(x,y); }
let passed=0;
function test(name,run) { run(); passed++; console.log('PASS: '+name); }
for (const entry of ['loadDemo','loadDemo02']) {
  test(entry+' protects a single upload, manual edits, and historical edits; cancel is neutral',()=>{
    for(const scene of ['upload','manual','history']) {
      let confirmed=0, applied=0, accept=false;
      const context={state:{remixInfo:{isManuallyEdited:scene==='manual'}},history:scene==='history'?['a','b']:['a'],
        hasUserUploadedImages:()=>scene==='upload',hasSecondaryImages:()=>false,
        window:{confirm:()=>{confirmed++;return accept;}},
        ensureKarinaMultiAssets:callback=>callback({}),ensureModelTechwearAsset:callback=>callback(),
        applyMasterRemixByIndex:()=>{applied++;}};
      vm.runInNewContext(section('  function loadDemo(', '  const layoutTemplates ='),context);
      context[entry](true); assert.equal(confirmed,1);assert.equal(applied,0);
      accept=true;context[entry](true);assert.equal(confirmed,2);assert.equal(applied,1);
    }
  });
}
test('cache preserves undo/redo assets, then frees expired uploads and backgrounds',()=>{
  const imageAssets=new Map([['a',{id:'a'}],['b',{id:'b'}],['demo',{id:'demo',origin:'demo'}]]);
  const backgroundAssets=new Map([['old-bg',{}]]);
  const context={state:{mainImageId:'b',assets:[{id:'b'}],secondaries:[],backgroundImageId:null,value:0},imageAssets,backgroundAssets,
    history:[],historyIndex:-1,historyTimer:0,historyTransactionDepth:0,currentLayoutIndex:0,currentFilterIndex:0,currentMasterIndex:0,
    isDemoAsset:asset=>asset.origin==='demo',setTimeout,clearTimeout};
  vm.runInNewContext(section('  function pruneAssetCaches()', '  function markManuallyEdited('),context);
  context.history.push(JSON.stringify({mainImageId:'a',assets:[{id:'a'}],backgroundImageId:'old-bg'}));context.historyIndex=0;
  context.commit();assert.ok(imageAssets.has('a'));assert.ok(backgroundAssets.has('old-bg'));
  for(let i=1;i<=61;i++){context.state.value=i;context.commit();}
  assert.equal(context.history.length,60);assert.ok(!imageAssets.has('a'));assert.ok(!backgroundAssets.has('old-bg'));
  assert.ok(imageAssets.has('b'));assert.ok(imageAssets.has('demo'));
});
test('discarding a redo branch frees only the images no longer referenced',()=>{
  const context={state:{mainImageId:'a',assets:[{id:'a'}],value:2},imageAssets:new Map([['a',{id:'a'}],['b',{id:'b'}]]),backgroundAssets:new Map(),
    history:[JSON.stringify({mainImageId:'a'}),JSON.stringify({mainImageId:'b'})],historyIndex:0,historyTimer:0,historyTransactionDepth:0,
    currentLayoutIndex:0,currentFilterIndex:0,currentMasterIndex:0,isDemoAsset:()=>false,setTimeout,clearTimeout};
  vm.runInNewContext(section('  function pruneAssetCaches()', '  function markManuallyEdited('),context);
  context.commit();assert.ok(context.imageAssets.has('a'));assert.ok(!context.imageAssets.has('b'));
});
test('undo/redo refreshes the canvas status using a three-template registry',()=>{
  const state={image:{},imageName:'my-photo.jpg',mainImageId:'a',assets:[{id:'a'}],exportResolution:[1200,1600]};
  const context={state,status:{textContent:''},imageAssets:new Map([['a',{image:state.image}]]),backgroundAssets:new Map(),history:[],historyIndex:-1,
    historyTimer:0,historyTransactionDepth:0,currentLayoutIndex:0,currentFilterIndex:0,currentMasterIndex:0,
    layoutRemixList:[{nameZh:'A'},{nameZh:'B'},{nameZh:'C'}],masterRemixList:[0,1,2].map(i=>({layoutIdx:i,filterIdx:i,shortZh:String(i)})),
    document:{querySelector:()=>null,querySelectorAll:()=>[]},renderImageTray(){},renderInspector(){},render(){},updateRemixCard(){},toast(){},isDemoAsset:()=>false,setTimeout,clearTimeout};
  vm.runInNewContext(section('  function pruneAssetCaches()', '  function markManuallyEdited(')+section('  function restore(index)', '  function getCover()')
    +section('  function updateMasterRemixControls()', '  function cycleLayoutRemix()'),context);
  context.commit();context.currentLayoutIndex=1;context.currentMasterIndex=1;context.commit();context.undo();
  assert.equal(context.status.textContent,'LAYOUT [1/3] · MY-PHOTO.JPG');context.redo();assert.equal(context.status.textContent,'LAYOUT [2/3] · MY-PHOTO.JPG');
});
test('native export rerenders into a separate target and restores context even on failure',()=>{
  const oldContext={}, exportContext={save(){},restore(){},scale(x,y){this.scaleUsed=[x,y];}};
  const out={getContext:()=>exportContext};let during;
  const context={ctx:oldContext,renderScale:1,isBeforePreviewActive:true,W:900,H:1200,document:{createElement:()=>out},render(showSelection){during={ctx:this.ctx,scale:this.renderScale,before:this.isBeforePreviewActive,showSelection};}};
  // A normal function in the sandbox reads the mutable rendering globals.
  context.inspect=()=>({ctx:context.ctx,scale:context.renderScale,before:context.isBeforePreviewActive});
  vm.runInNewContext('function render(showSelection){record={...inspect(),showSelection};}\n'+section('  function renderExportCanvas(', '  function exportPoster()'),context);
  const exported=context.renderExportCanvas(3000,4000);assert.equal(exported.width,3000);assert.equal(exported.height,4000);
  assert.equal(context.record.ctx,exportContext);assert.equal(context.record.scale,3000/900);assert.equal(context.record.before,false);assert.equal(context.record.showSelection,false);
  assert.equal(context.ctx,oldContext);assert.equal(context.renderScale,1);assert.equal(context.isBeforePreviewActive,true);
  context.render=()=>{throw Error('render failure');};assert.throws(()=>context.renderExportCanvas(1200,1600),/render failure/);
  assert.equal(context.ctx,oldContext);assert.equal(context.renderScale,1);assert.equal(context.isBeforePreviewActive,true);
});
test('high-resolution crops sample original pixels and send scaled pattern controls',()=>{
  const calls=[];const rc={scale(...args){calls.push(['scale',...args]);},setTransform(){},drawImage(...args){calls.push(['image',...args]);},
    getImageData(){return {width:400,height:800,data:new Uint8ClampedArray(400*800*4)};},putImageData(){}};
  let options;const target={width:400,height:800,getContext:()=>rc};const original={naturalWidth:4000,naturalHeight:6000};
  const context={renderScale:2,raster:(w,h,paint)=>{assert.equal(w,400);assert.equal(h,800);paint(rc,target);return target;},
    window:{PosterFilterEngine:{apply:(image,o)=>{options=o;return image;}}},pixelEffects(){},halftone(){},surfaceTexture(){}};
  vm.runInNewContext(section('  function filteredImage(', '  function detailOptions('),context);
  context.filteredImage(original,{sx:0,sy:0,sw:2000,sh:4000},200,400,{grain:10,halftoneSize:32});
  const drawing=calls.find(item=>item[0]==='image');assert.equal(drawing[1],original);assert.equal(drawing.at(-2),200);assert.equal(drawing.at(-1),400);
  assert.equal(options.pixelScale,2);
});
test('filter geometry scales without mutating the chosen settings',()=>{
  const engine=require('../poster-filter-engine.js');const image={width:48,height:36,data:new Uint8ClampedArray(48*36*4)};
  for(let i=0;i<image.data.length;i+=4)image.data.set([i%256,(i*3)%256,(i*7)%256,255],i);
  for(const [fn,opts,scaled] of [
    ['halftone',{effect:'dot',halftoneSize:16},{effect:'dot',halftoneSize:32}],
    ['motionBlur',{motionDistance:8,motionAngle:0},{motionDistance:16,motionAngle:0}],
    ['addNoise',{grain:12,noiseSize:2},{grain:12,noiseSize:4}],
    ['bitmap',{bitmapMethod:'ordered',ditherStep:2},{bitmapMethod:'ordered',ditherStep:4}],
    ['mosaic',{mosaicSize:12},{mosaicSize:24}]
  ]) {
    const original=JSON.stringify(opts);assert.deepEqual(engine[fn](image,{...opts,pixelScale:2}).data,engine[fn](image,scaled).data,fn);
    assert.equal(JSON.stringify(opts),original);
  }
});
console.log('Export/history regression: '+passed+' passed.');
