// Run: node checks/filter-editor-regression.cjs (no dependencies).
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../poster.js'), 'utf8');
const section = (a,b) => source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const engine = require('../poster-filter-engine.js');

const optionsContext = vm.createContext({assert});
vm.runInContext(`${section('  function detailOptions(', '  function selectedObject(')}
  for (const filterType of ['circle_halftone','line_halftone','dot_halftone','color_halftone','duotone','gradient_map','threshold','dither','mosaic_tile']) {
    const result = detailOptions({filterType,grain:0,motionDistance:0,halftoneStrength:0,halftoneAngle:0,thresholdLevel:0,duotone:false});
    assert.equal(result.grain,0,filterType+' must not force grain');
    assert.equal(result.motionDistance,0);
    assert.equal(result.halftoneStrength,0);
    assert.equal(result.halftoneAngle,0);
    assert.equal(result.thresholdLevel,0);
    assert.equal(result.duotone,false,filterType+' must allow disabling gradient mapping');
  }
  assert.equal(detailOptions({filterType:'line_halftone',motionDistance:18,motionAngle:0}).effect,'line');
  assert.equal(detailOptions({filterType:'dither',bitmapMethod:'diffusion'}).bitmapMethod,'diffusion');
`,optionsContext);
console.log('PASS: local style options retain zero/false and select real pattern/bitmap operations');

const pixels = {width:19,height:13,data:new Uint8ClampedArray(19*13*4)};
for (let i=0;i<pixels.data.length;i+=4) pixels.data.set([i%256,(i*3)%256,(i*7)%256,255],i);
let output, applied, legacyOptions, overprintCalls=0;
const rasterContext = {
  drawImage:()=>{},
  getImageData:()=>({...pixels,data:new Uint8ClampedArray(pixels.data)}),
  putImageData:data=>{output=data;}
};
const raster = (w,h,paint) => {
  const target={width:pixels.width,height:pixels.height,getContext:()=>rasterContext};
  paint(rasterContext,target);return target;
};
const fixture = {
  assert,raster,renderScale:1,window:{PosterFilterEngine:{apply:(image,o)=>{applied=o;return engine.apply(image,o);}}},
  pixelEffects:(canvas,o)=>{legacyOptions=o;},halftone:()=>{overprintCalls++;},surfaceTexture:()=>{},
  sourceImage:{},rect:{sx:0,sy:0,sw:19,sh:13},w:19,h:13
};
const integrated = vm.createContext(fixture);
vm.runInContext(section('  function filteredImage(','  function detailOptions('),integrated);
const opts={filterType:'circle_halftone',halftone:75,halftoneSize:4,motionDistance:8,motionAngle:0,grain:7,duotone:true,duotoneDark:'#102060',duotoneLight:'#ffd0e8'};
integrated.opts=opts;
vm.runInContext('filteredImage(sourceImage,rect,w,h,opts)',integrated);
assert.equal(applied.effect,'circle');
assert.equal(applied.halftoneStrength,75);
assert.equal(legacyOptions.grain,0,'grain must run only once');
assert.equal(legacyOptions.duotone,false,'mapping must not precede the photo-responsive pattern');
assert.equal(overprintCalls,0,'explicit patterns must not add the old dot overlay');
assert.deepEqual(output.data,engine.apply(pixels,{...opts,effect:'circle',halftoneStrength:75}).data);
integrated.opts={filterType:'original',halftone:20};
vm.runInContext('filteredImage(sourceImage,rect,w,h,opts)',integrated);
assert.equal(overprintCalls,1,'original legacy presets retain their separate overprint treatment');
console.log('PASS: main filters invoke the real engine once, map last, and preserve legacy overprint presets');

const state={filters:{bw:0},selected:null};
let selected=null;
const routing = vm.createContext({assert,state,selectedObject:()=>selected,cleanFilters:()=>({}),
  scheduleRender:()=>{},renderInspector:()=>{},commit:()=>{},markManuallyEdited:()=>{},syncLeftControls:()=>{},
  syncAllChildFramesOf:()=>{},syncFrameRelativeToParent:()=>{}});
vm.runInContext(section('  const inspectorFilterKeys =','  const inspectorPatternTypes =')+section('  function handleInspectorInput(','  inspector.addEventListener('),routing);
const input=(prop,value,global=false,type='range')=>{
  routing.event={target:{dataset:global?{global:prop}:{prop},type,value,checked:value,closest:()=>null}};
  vm.runInContext('handleInspectorInput(event)',routing);
};
input('motionDistance',18,true);
assert.equal(state.filters.motionDistance,18,'missing preset keys must still write to filters');
assert.equal(state.motionDistance,undefined);
input('filterType','circle_halftone',true,'select-one');
assert.equal(state.filters.halftone,75);
input('halftone',0,true);
assert.equal(state.filters.halftone,0);
selected={id:'secondary',filters:{}};state.selected={type:'secondary'};
input('grain',0);input('motionAngle',90);input('duotone',false,false,'checkbox');
assert.equal(selected.filters.grain,0);assert.equal(selected.filters.motionAngle,90);assert.equal(selected.filters.duotone,false);
assert.equal(selected.motionAngle,undefined);
selected={id:'crop'};state.selected={type:'detail'};
input('filterType','line_halftone',false,'select-one');input('halftoneStrength',0);input('grain',0);
assert.equal(selected.halftoneStrength,0);assert.equal(selected.grain,0);
assert.equal(state.filters.motionDistance,18,'local controls leave main settings independent');
console.log('PASS: global, secondary and crop controls route independently and can disable effects');

const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
assert.ok(html.indexOf('src="poster-filter-engine.js')<html.indexOf('src="poster.js'),'filter engine loads before the editor');
