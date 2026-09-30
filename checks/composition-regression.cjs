// Run: node checks/composition-regression.cjs
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const window = {};
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../poster-composition.js'),'utf8'),{window});
const composition = window.posterComposition;
const measure = t => {
  const lines = t.content.split('\n');
  let w = Math.max(...lines.map(s=>s.length*t.size*.7+Math.max(0,s.length-1)*t.letterSpacing));
  if(t.kind==='repeat') w = w*t.repeat+t.repeatSpacing*(t.repeat-1);
  return {w:w*t.scaleX,h:t.size*lines.length*t.lineHeight*t.scaleY};
};
const overlap = (a,b) => Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
for(const design of composition.designs) for(const count of [0,3,8]) {
  const state = {
    main:{id:'main-image',x:70,y:150,w:760,h:900,zoom:1.4},secondaries:[{id:'secondary-a'},{id:'secondary-b'}],frames:[],
    fragments:[{id:'companion',fragmentRole:'companion',x:100,y:140,w:600,h:800}],
    details:Array.from({length:count},(_,i)=>({id:`crop-${i}`,frameId:`frame-${i}`,w:180,h:240})),
    texts:['hero','subtitle','caption','micro','repeat'].map(kind=>({id:kind,kind,content:kind==='hero'?'NO FIXED IDENTITY':'A USER TEXT WITH UNUSUAL LENGTH',repeat:8})),
  };
  const content = JSON.stringify(state.texts.map(t=>t.content));
  composition.apply(state,design,measure,'wild',true,{accent:'#c32631',ink:'#151515'},()=>.5);
  assert.equal(state.details.length,count);
  assert.equal(state.secondaries.length,2);
  state.secondaries.forEach(s=>assert.ok(s.w>0&&s.h>0&&s.x>=0&&s.y>=0&&s.x+s.w<=900&&s.y+s.h<=1200));
  assert.equal(JSON.stringify(state.texts.map(t=>t.content)),content);
  assert.equal(new Set(state.layers.map(l=>`${l.type}:${l.id}`)).size,state.layers.length);
  assert.ok(state.layers.findIndex(l=>l.id==='companion')<state.layers.findIndex(l=>l.type==='main'));
  state.details.forEach((d,i)=>{
    assert.ok(d.w>0&&d.h>0&&d.x>=0&&d.y>=0&&d.x+d.w<=900&&d.y+d.h<=1200,`${design.name}: crop inside poster`);
    state.details.slice(i+1).forEach(other=>assert.equal(overlap(d,other),0,`${design.name}: crops do not stack accidentally`));
    assert.equal(overlap(d,state.main),0,`${design.name}: evidence stays outside primary photograph`);
  });
  const hero = state.texts[0], b = measure(hero);
  assert.ok(b.w<=design.hero[2]+.01&&b.h<=design.hero[3]+.01,`${design.name}: long title fits its band`);
}
console.log('PASS: all 8 compositions, content/layers preserved, crop rails, long titles.');
