const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '../poster-liquid-chrome.js'), 'utf8');
const document = { hidden:false, body:{dataset:{ambient:'on',motionTier:'lite'}} };
let now=0, frames=0, draws=0;
const Stage = vm.runInNewContext(source.slice(source.indexOf('class InteractiveFluidStage'),source.indexOf('// 全局注册与挂载 API'))+'; InteractiveFluidStage', {
  document, window:{devicePixelRatio:3}, performance:{now:()=>now}, requestAnimationFrame:()=>++frames
});
const stage = Object.create(Stage.prototype);
stage.gl = {viewport(){}}; stage.render = () => draws++;
stage.canvas={parentElement:{getBoundingClientRect:()=>({width:390,height:844})}};
stage.resize();
assert.equal(stage.canvas.height,720);
assert.ok(stage.canvas.width<=390, 'Mobile background never uses the 3x screen resolution');
stage.state={running:true,lastTime:0,elapsed:0,mouse:{x:.5,y:.5},targetMouse:{x:.5,y:.5},velocity:{x:0,y:0},disturbance:0,click:{age:-1}};
for(let i=0;i<60;i++){now=i*1000/60;stage.loop();}
assert.ok(draws>=18 && draws<=24, 'Mobile manual motion caps actual WebGL draws, not editor exports');
const mobileDraws=draws;
draws=0;document.body.dataset.motionTier='full';
for(let i=0;i<60;i++){now+=1000/60;stage.loop();}
assert.equal(draws,60, 'Desktop retains its normal background cadence');
document.body.dataset.ambient='off';frames=0;stage.hasRendered=true;stage.loop();
assert.equal(frames,0, 'Off stops the background scheduling');
stage.hasRendered=true;stage.canvas.width=1;stage.resize();
draws=0;stage.start();
assert.equal(draws,1, 'Resizing a static background redraws it once');
assert.equal(stage.state.running,false);
const sidebar=fs.readFileSync(path.join(__dirname,'../sidebar-motion.js'),'utf8');
const init=sidebar.slice(sidebar.indexOf('function initMotionSystem()'),sidebar.indexOf("if (document.readyState"));
vm.runInNewContext(init+';initMotionSystem();', {matchMedia:()=>({matches:true}), document:{querySelector(){throw Error('Touch must not initialize mouse loops');}}});
const scheduler=sidebar.slice(sidebar.indexOf('let motionFrame ='),sidebar.indexOf('// Delegate transient feedback'));
let pending=[],cursorUpdates=0;
document.body.dataset={ambient:'on',motionTier:'full'};
const schedulerContext=vm.createContext({document:{...document,addEventListener(){}},
  requestAnimationFrame:fn=>{pending.push(fn);return pending.length;},
  MutationObserver:class{observe(){}},tiltTarget:{},tiltCurrent:{},isCursorVisible:false,
  cursorWrap:{classList:{remove(){}}},updateCursorLoop:()=>cursorUpdates++,updateCanvasFloatLoop(){}
});
vm.runInContext(scheduler,schedulerContext);
vm.runInContext('wakeMotion();wakeMotion();',schedulerContext);
assert.equal(pending.length,1, 'Preference and pointer events do not duplicate the loop');
document.body.dataset.ambient='off';pending.shift()();
assert.equal(pending.length,0, 'Disabling motion drains the pending loop');
assert.equal(cursorUpdates,0);
document.body.dataset.ambient='on';vm.runInContext('wakeMotion()',schedulerContext);
pending.shift()();assert.equal(cursorUpdates,1);assert.equal(pending.length,1);
schedulerContext.document.hidden=true;pending.shift()();assert.equal(pending.length,0, 'Hidden tabs stop the mouse loop');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
assert.doesNotMatch(html, /<details[^>]*\sopen[\s>]/, 'Left and Filter settings start closed');
const poster=fs.readFileSync(path.join(__dirname,'../poster.js'),'utf8');
const flow=poster.slice(poster.indexOf('const inspectorGroups ='),poster.indexOf('function organizeInspector()'));
const group = (name,open) => ({open,closest:()=>({dataset:{inspectorPane:'look'}}),querySelector:()=>({textContent:name})});
let target='canvas',groups=[];
const ctx=vm.createContext({Map,inspector:{querySelector:()=>({value:target}),querySelectorAll:()=>groups},
  renderInspectorContent(){},organizeInspector(){groups=[group('BACKGROUND & PAPER',true)];}});
vm.runInContext(flow+';renderInspector();',ctx);
assert.equal(groups[0].open,false, 'New groups start closed even if older markup requested open');
groups[0].open=true;vm.runInContext('renderInspector()',ctx);
assert.equal(groups[0].open,true, 'Editing preserves a group the user opened');
groups[0].open=false;vm.runInContext('renderInspector()',ctx);
assert.equal(groups[0].open,false, 'Editing preserves a group the user closed');
groups[0].open=true;target='main:main-image';vm.runInContext('renderInspector()',ctx);
assert.equal(groups[0].open,false, 'A new object type starts closed');
target='canvas';vm.runInContext('renderInspector()',ctx);
assert.equal(groups[0].open,true, 'Changing the target dropdown retains the previous object type state');
console.log(`PASS: ${mobileDraws} mobile draws vs 60 desktop; capped background pixels, no touch mouse loops, collapsed defaults and retained disclosure`);
