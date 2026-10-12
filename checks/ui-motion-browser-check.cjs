// Run after serve-local.cjs; uses the same 03/20 photos and a pre-motion Git baseline.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const packages='C:/Users/24369/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const {chromium}=require(packages+'playwright'),sharp=require(packages+'sharp');
const root=path.resolve(__dirname,'..'),out=path.join(root,'samples/results/ui-motion/20261012');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'samples/aespa/manifest.json'))),samples=[manifest.images[2],manifest.images[19]];
const report={baseline:'b2289a8',checks:[],performance:[],exports:[],errors:[]};let browser,page;
const settle=p=>p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const idle=p=>p.waitForFunction(()=>!document.querySelector('.poster-paper-transition')&&document.getAnimations().every(a=>a.effect?.getTiming().iterations===Infinity||a.playState!=='running'));
const pixels=async file=>crypto.createHash('sha256').update(await sharp(file).raw().toBuffer()).digest('hex');
async function png(p,name){const pending=p.waitForEvent('download');await p.locator('#posterExportButton').click();const file=path.join(out,name+'.png');await(await pending).saveAs(file);assert.equal((await sharp(file).metadata()).width,1200);report.exports.push(name+'.png');return pixels(file);}
async function template(p,n){while(!(await p.locator('#posterMasterRemixTag').textContent()).includes('['+n+'/8]')){const tag=await p.locator('#posterMasterRemixTag').textContent();await p.locator('#posterMasterRemixDock').click();await p.waitForFunction(tag=>document.querySelector('#posterMasterRemixTag').textContent!==tag,tag);}await settle(p);await idle(p);}
async function measure(p,pref){await p.locator('#posterMotionPreference').selectOption(pref);const times=[];
 for(let i=0;i<8;i++){
  times.push(await p.evaluate(()=>{const create=document.createElement.bind(document);let canvases=0;document.createElement=(tag,...args)=>{if(tag==='canvas')canvases++;return create(tag,...args);};const start=performance.now();try{posterRemixFilters();return {ms:+(performance.now()-start).toFixed(2),canvases,overlays:document.querySelectorAll('.poster-paper-transition').length};}finally{document.createElement=create;}}));
  assert.ok(times.at(-1).overlays<=1);await idle(p);
 }
 return times;
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 page=await browser.newPage({viewport:{width:1280,height:1000},acceptDownloads:true});const old=await browser.newPage({viewport:{width:1280,height:1000},acceptDownloads:true});
 await page.addInitScript(()=>{let factory;window.uiMotionStats={captures:0,plays:[]};Object.defineProperty(window,'createPosterMotion',{get:()=>factory,set:create=>{factory=(...args)=>{const motion=create(...args),capture=motion.capture,play=motion.play;motion.capture=()=>{uiMotionStats.captures++;return capture();};motion.play=(image,kind)=>{if(image)uiMotionStats.plays.push(kind||'paper');return play(image,kind);};return motion;};}});});
 for(const file of ['poster.js','poster-motion.js','poster.css']){const body=execFileSync('git',['show','b2289a8:'+file],{cwd:root,encoding:'utf8'});await old.route('**/'+file+'?*',r=>r.fulfill({contentType:file.endsWith('.css')?'text/css':'application/javascript',body}));}
 for(const p of [page,old]){p.setDefaultTimeout(60000);p.on('dialog',d=>d.accept());p.on('pageerror',e=>report.errors.push(e.message));await p.goto('http://localhost:8089/?check=ui-motion#poster');await p.waitForFunction(()=>window.posterState?.image?.complete);await p.locator('#posterMotionPreference').selectOption('off');await p.locator('#posterImageInput').setInputFiles(samples.map(a=>path.join(root,'samples/aespa',a.original)));await p.waitForFunction(()=>posterHasUserUploadedImages()&&posterState.assets.length===2);}
 assert.equal(await page.locator('#posterEmptyState').isVisible(),false,'Loaded photos must hide the empty prompt');
 const sources=await page.evaluate(()=>JSON.stringify(posterState.assets));
 await page.locator('#posterMotionPreference').selectOption('on');
 await page.locator('#posterInspectorTarget').selectOption('main:main-image');
 const before=await page.evaluate(()=>JSON.stringify(posterHistory));
 await page.locator('[data-inspector-tab="layout"]').click();
 assert.equal(await page.evaluate(()=>document.activeElement.dataset.inspectorTab),'layout');
 assert.equal(await page.locator('[data-inspector-pane]:visible').count(),1);
 await page.locator('[data-inspector-tab="layout"]').press('ArrowRight');assert.equal(await page.evaluate(()=>document.activeElement.dataset.inspectorTab),'advanced');
 await page.locator('[data-inspector-tab="advanced"]').press('Home');assert.equal(await page.evaluate(()=>document.activeElement.dataset.inspectorTab),'look');
 assert.equal(await page.evaluate(()=>JSON.stringify(posterHistory)),before,'Panel motion must not write history');
 await idle(page);
 // A visible panel animates on switching, but slider updates do not start a new reveal.
 await page.evaluate(()=>document.querySelector('[data-inspector-tab="layout"]').click());
 assert.equal(await page.evaluate(()=>document.getAnimations().filter(a=>a.effect?.target?.dataset.inspectorPane).length),1);
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal(await page.evaluate(()=>document.getAnimations().filter(a=>a.effect?.target?.dataset.inspectorPane).length),0);
 await page.locator('[data-inspector-tab="look"]').click();await idle(page);
 await page.locator('[data-prop="brightness"],[data-global="brightness"]').first().evaluate(e=>{e.value='0';e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));});
 assert.equal(await page.evaluate(()=>document.getAnimations().filter(a=>a.effect?.target?.dataset.inspectorPane).length),0);
 await page.locator('#posterMotionPreference').selectOption('auto');await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.querySelector('#posterWorkspace').dataset.motion==='off');
 await page.evaluate(()=>document.querySelector('[data-inspector-tab="layout"]').click());assert.equal(await page.evaluate(()=>document.getAnimations().length),0);
 await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForFunction(()=>document.querySelector('#posterWorkspace').dataset.motion==='on');
 const button=page.locator('#posterExportButton');await button.hover();await page.waitForTimeout(160);assert.notEqual(await button.evaluate(e=>getComputedStyle(e).transform),'none');
 await page.locator('#posterMotionPreference').selectOption('off');await button.hover();assert.equal(await button.evaluate(e=>getComputedStyle(e).transform),'none');
 report.checks.push('Panel/tab keyboard focus, single reveal, no slider/history animation, reduced motion and button feedback');
 for(const n of [1,6,8]){
  for(const p of [old,page]){await p.bringToFront();await p.locator('#posterMotionPreference').selectOption('off');await template(p,n);await measure(p,'off');}
  assert.equal(await png(page,'current-template-'+n),await png(old,'baseline-template-'+n),'Motion changes must preserve actual PNG pixels');
  const result={template:n,baseline:{off:[],on:[]},current:{off:[],on:[]}};
  // ABBA preference order; alternate old/current so warm-up does not always favor one version.
  for(const [i,pref] of ['off','on','on','off'].entries())for(const [label,p] of (i%2?[['current',page],['baseline',old]]:[['baseline',old],['current',page]])){await p.bringToFront();result[label][pref].push(...await measure(p,pref));}
  await page.bringToFront();await page.locator('#posterMotionPreference').selectOption('on');
  result.playback=await page.evaluate(async()=>{let reads=0;const original=CanvasRenderingContext2D.prototype.getImageData;CanvasRenderingContext2D.prototype.getImageData=function(...args){reads++;return original.apply(this,args);};try{posterRemixFilters();const start=performance.now(),initialReads=reads,intervals=[],tasks=[];let previous=start;const observer=new PerformanceObserver(list=>tasks.push(...list.getEntries().filter(e=>e.startTime>=start).map(e=>e.duration)));observer.observe({type:'longtask'});await new Promise(resolve=>{function frame(now){intervals.push(now-previous);previous=now;if(now-start<700)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});observer.disconnect();return {initialReads,readsDuringPlayback:reads-initialReads,frameIntervals:intervals,longTasksAfterCalculation:tasks};}finally{CanvasRenderingContext2D.prototype.getImageData=original;}});
  assert.equal(result.playback.readsDuringPlayback,0,'Animation playback must not recompute pixel filters');
  report.performance.push(result);assert.equal(await page.evaluate(()=>JSON.stringify(posterState.assets)),sources);
  console.log('PASS performance/pixels template '+n);
 }
 // One composed operation captures once; rapid restarts and fresh input leave no stale overlay.
 await page.evaluate(()=>{window.uiMotionStats={captures:0,plays:[]};posterTriggerMasterRemix();});
 await page.waitForFunction(()=>document.querySelector('.poster-paper-transition'));
 assert.deepEqual(await page.evaluate(()=>uiMotionStats),{captures:1,plays:['paper']});
 assert.equal(await page.locator('.poster-paper-transition canvas').count(),5);
 await page.screenshot({path:path.join(out,'template-transition.png')});
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal(await page.locator('.poster-paper-transition').count(),0);
 await page.evaluate(()=>{posterRemixFilters();posterRemixFilters();posterRemixFilters();});assert.equal(await page.locator('.poster-paper-transition').count(),1);assert.equal(await page.locator('.poster-paper-transition canvas').count(),1);await idle(page);
 const draft=await png(page,'draft-before');await page.locator('#posterSaveDraftButton').click();await page.waitForFunction(()=>!posterDraftPending());await page.reload();await page.waitForFunction(()=>window.posterState?.image?.complete);assert.equal(await page.locator('#posterEmptyState').isVisible(),false,'Draft restoration must hide the empty prompt');assert.equal(await png(page,'draft-restored'),draft);
 for(const width of [1280,968,390]){await page.setViewportSize({width,height:1000});await page.locator('[data-zoom-action="fit"]').click();await settle(page);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.locator('.poster-stage-topline').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'viewport-'+width+'.png')});}
 await page.locator('[data-mode="filter"]').click();assert.equal(await page.locator('#posterWorkspace').isVisible(),false);assert.equal(await page.locator('.poster-paper-transition').count(),0);await page.locator('[data-mode="poster"]').click();
 for(const a of samples)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'samples/aespa',a.original))).digest('hex'),a.sha256);
 assert.deepEqual(report.errors,[]);report.checks.push('03/20 sources and PNG pixels preserved; one overlay, blur/restart cleanup, draft, three viewports and mode switching');
 console.log('PASS UI motion browser check');
})().catch(e=>{report.failure=e.stack;console.error(e);process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));await browser?.close();});
