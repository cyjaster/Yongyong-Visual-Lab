const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),window={};
vm.runInNewContext(fs.readFileSync(path.join(root,'poster-decor.js'),'utf8'),{window});
const source=fs.readFileSync(path.join(root,'poster.js'),'utf8'),section=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const image={naturalWidth:900,naturalHeight:1200},state={image,main:{x:0,y:0,w:900,h:1200},secondaries:[]};
const context=vm.createContext({window,state,imageAssets:new Map([['photo',{image}]]),assert});
vm.runInContext(section('  function getCover()', '  function raster(')+section('  function rotatePoint(', '  function transformBox('),context);
for(const style of ['desktop','photo-booth','airdrop','polaroid','circle']){
  const s={id:'card',imageId:'photo',x:100,y:100,w:300,h:400,windowFrame:true,windowStyle:style};
  state.secondaries=[s];const p=window.PosterDecor.photoRect(s);
  assert.ok(p.w>0 && p.h>0 && p.x>=0 && p.y>=0 && p.x+p.w<=s.w && p.y+p.h<=s.h);
  context.frame={sourceId:'card',x:s.x+p.x,y:s.y+p.y,w:p.w,h:p.h,rotation:0};
  const rect=vm.runInContext('sourceRect(frame)',context);
  assert.ok(Math.abs(rect.sw/rect.sh-p.w/p.h)<1e-8,style+' crop preserves the visible photo aspect');
  assert.ok(rect.sx>=0 && rect.sy>=0 && rect.sx+rect.sw<=900 && rect.sy+rect.sh<=1200);
  s.windowFrame=false;assert.equal(window.PosterDecor.photoRect(s).h,400);
}
console.log('PASS: all five editable photo frames use the same inset geometry for rendering and sampling; off restores the full card');

const calls=[];const paint=new Proxy({}, {get:(o,k)=>k in o?o[k]:(...args)=>calls.push([k,...args]),set:(o,k,v)=>(o[k]=v,true)});
for(const shape of ['outline-box','sketch-arrow','connector-path','retro-window','profile-card','speech','checker-panel','recycle-bin']){
  const t={badgeShape:shape,badgeWidth:160,badgeHeight:130,badgeColor:'#2113ff',content:'Archive\n03 posts | 20 photos | 08 templates\nMy photos',size:14,x:3,y:7};
  calls.length=0;assert.equal(window.PosterDecor.draw(paint,t),true);assert.ok(calls.length,shape+' draws');const b=window.PosterDecor.bounds(t);assert.equal(b.w,160);assert.equal(b.h,130);
  if(['outline-box','sketch-arrow','connector-path'].includes(shape)){calls.length=0;t.strokeWidth=0;window.PosterDecor.draw(paint,t);assert.equal(calls.length,0,shape+' zero width disables the line');}
}
console.log('PASS: eight new editable decoration shapes, hit bounds and zero line width');

for(const style of ['desktop','photo-booth','airdrop','polaroid','circle']){
  const s={id:'card',imageId:'photo',x:100,y:100,w:300,h:400,windowFrame:true,windowStyle:style,fit:'contain',zoom:1};state.secondaries=[s];const p=window.PosterDecor.photoRect(s);
  context.frame={sourceId:'card',x:s.x+p.x,y:s.y+p.y,w:p.w,h:p.h,rotation:0};let r=vm.runInContext('sourceRect(frame)',context);
  assert.ok(Math.abs(r.sw-900)<1e-8&&Math.abs(r.sh-1200)<1e-8,style+' contains the full source');
  s.panX=17;s.panY=9;s.zoom=1.2;const c=context.imageCover(image,{...s,x:s.x+p.x,y:s.y+p.y,w:p.w,h:p.h});
  context.frame={sourceId:'card',x:c.x+150*c.scale,y:c.y+160*c.scale,w:70*c.scale,h:80*c.scale,rotation:0};r=vm.runInContext('sourceRect(frame)',context);
  for(const [key,val] of Object.entries({sx:150,sy:160,sw:70,sh:80}))assert.ok(Math.abs(r[key]-val)<1e-8,style+' contains with zoom/offset and correct linked sampling '+key);
}
const canvasCalls=[],drawing=new Proxy({},{get:(o,k)=>k in o?o[k]:(...a)=>canvasCalls.push([k,...a]),set:(o,k,v)=>(o[k]=v,true)});
const drawContext=vm.createContext({window:{PosterDecor:window.PosterDecor},ctx:drawing,imageAssets:new Map([['photo',{image}]]),isBeforePreviewActive:false,state,renderScale:1,cleanFilters:()=>({}),transformBox(){},cachedFilteredImage:(id,img,rect,w,h,opts)=>({img,rect,w,h,opts})});
vm.runInContext(section('  function imageCover(', '  function getSourceImageForFrame(')+section('  function drawSecondaryImage(', '  function drawFragment('),drawContext);
const s={id:'fit-card',imageId:'photo',x:0,y:0,w:475,h:432,fit:'contain',zoom:1};drawContext.drawSecondaryImage(s);
const actual=canvasCalls.find(c=>c[0]==='drawImage');assert.ok(actual);assert.equal(actual[1].rect.sw,900);assert.equal(actual[1].rect.sh,1200);assert.equal(actual[4]/actual[5],900/1200);assert.equal(actual[3],0);assert.ok(actual[2]>0,'portrait has horizontal margins rather than cropping');assert.ok(canvasCalls.some(c=>c[0]==='clip'));
calls.length=0;window.PosterDecor.draw(paint,{badgeShape:'panel',badgeWidth:200,badgeHeight:140,content:'A\nB\nC',size:14,font:'Georgia, serif'});assert.deepEqual(calls.filter(c=>c[0]==='fillText').map(c=>c[1]),['A','B','C']);
window.PosterDecor.draw(paint,{badgeShape:'profile-card',badgeWidth:300,badgeHeight:200,content:'Archive\n3 | 20 | 8\nMy photos',size:14,font:'Georgia, serif'});assert.ok(paint.font.endsWith('Georgia, serif'));
console.log('PASS: complete secondary photos, actual drawing aspect and clipping, five-frame linked sampling, multiline panels and selected profile font');
