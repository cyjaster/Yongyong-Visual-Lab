const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../poster.js'),'utf8');
const code=source.slice(source.indexOf('  const filteredImageCache ='),source.indexOf('  function filteredImage('));
vm.runInNewContext(code+`
let calls=0,blends=0;
function filteredImage(source,rect,w,h,options){calls++;return {width:w,height:h};}
function blendMainEdges(){blends++;}
let renderScale=1;
const state={main:{zoom:1,panX:0,panY:0,fit:'cover'}},photo={},other={},rect={sx:0,sy:0,sw:100,sh:100};
const draw=(id='a',src=photo,r=rect,w=100,h=100,o={grain:0},defer=false,fade=0)=>cachedFilteredImage(id,src,r,w,h,o,defer,fade);
const first=draw();assert.equal(draw(),first);assert.equal(calls,1);
assert.notEqual(draw('a',other),first);assert.equal(calls,2);
const normal=draw();rect.sx=10;assert.notEqual(draw(),normal);
assert.notEqual(draw('a',photo,rect,120),draw());
assert.notEqual(draw('a',photo,rect,100,100,{grain:30}),draw());
const frozen=draw();rect.sy=20;assert.equal(draw('a',photo,rect,100,100,{grain:0},true),frozen);
assert.notEqual(draw(),frozen,'Release recomputes the final crop');
const preview=draw();renderScale=2;assert.notEqual(draw('a',photo,rect,100,100,{grain:0},true),preview);const count=calls;draw();assert.equal(calls,count+1,'Exports always rerender');renderScale=1;assert.equal(draw(),preview,'Export does not replace preview cache');
const main=draw('main',photo,null);state.main.panX=12;assert.notEqual(draw('main',photo,null),main);
const faded=draw('main',photo,null,100,100,{},false,40);assert.equal(draw('main',photo,null,100,100,{},false,40),faded);assert.equal(blends,1,'Cached edge fade is not multiplied on every redraw');
for(let i=0;i<40;i++)draw('small-'+i);assert.ok(filteredImageCache.size<=32);
for(let i=0;i<4;i++)draw('large-'+i,photo,rect,3000,3000);assert.ok(filteredImageCachePixels<=16*1024*1024);
draw('oversize',photo,rect,5000,5000);assert.equal(filteredImageCache.has('oversize'),false);
`,{assert});
console.log('PASS: source/crop/size/filter invalidation, deferred crop release, export bypass, edge fade and bounded cache');

const finish=source.slice(source.indexOf('  function finishCanvasDrag()'),source.indexOf("  canvas.addEventListener('pointerup', finishCanvasDrag)"));
const blurStart=source.indexOf("  window.addEventListener('blur',()=>{");
const blur=source.slice(blurStart,source.indexOf('\n  });',blurStart)+7);
vm.runInNewContext(`
let drag=null,calls=[],spaceDown=false,pan=null,onBlur;
const window={addEventListener(type,fn){if(type==='blur')onBlur=fn;}},viewport={classList:{remove(){}}};
const syncFrameRelativeToParent=()=>calls.push('frame'),syncAllChildFramesOf=()=>calls.push('children'),commit=()=>calls.push('commit'),markManuallyEdited=()=>calls.push('edited'),renderInspector=()=>calls.push('inspector'),render=()=>calls.push('render');
`+finish+blur+`
for(const type of ['frame','main','secondary','connector']){
 drag={type,item:{id:'item'}};calls=[];spaceDown=true;pan={};
 onBlur();assert.equal(drag,null);assert.equal(spaceDown,false);assert.equal(pan,null);
 assert.ok(calls.includes('render'),'Blur must redraw the final preview');
 if(type!=='connector')assert.deepEqual(calls,type==='frame'?['frame','commit','edited','inspector','render']:['children','commit','edited','inspector','render']);
 const count=calls.length;finishCanvasDrag();onBlur();assert.equal(calls.length,count,'Repeated release must be neutral');
}
`,{assert});
console.log('PASS: window blur uses final drag synchronization, history, redraw and idempotent release');
