// Run after serve-local.cjs; only aespa-03/20 originals are used.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const packages='C:/Users/24369/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const {chromium}=require(packages+'playwright'),sharp=require(packages+'sharp');
const root=path.resolve(__dirname,'..'),out=path.join(root,'samples/results/ambient/20261012');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'samples/aespa/manifest.json'))),samples=[manifest.images[2],manifest.images[19]];
const report={checks:[],exports:[],uploadScenes:[],performance:[],errors:[]};let browser,page;
const ambient=()=>page.evaluate(()=>document.getAnimations().filter(a=>a.animationName?.startsWith('lab-')).map(a=>({name:a.animationName,state:a.playState,frames:a.effect.getKeyframes()})));
const ready=()=>page.waitForFunction(()=>document.body.dataset.ambient==='on'&&document.body.dataset.ambientEditing==='false');
const idle=()=>page.waitForFunction(()=>!document.querySelector('.poster-paper-transition'));
const pixels=async file=>crypto.createHash('sha256').update(await sharp(file).raw().toBuffer()).digest('hex');
async function png(name){const download=page.waitForEvent('download');await page.locator('#posterExportButton').click();const file=path.join(out,name+'.png');await(await download).saveAs(file);assert.equal((await sharp(file).metadata()).width,1200);report.exports.push(name+'.png');return pixels(file);}
async function template(n){while(!(await page.locator('#posterMasterRemixTag').textContent()).includes('['+n+'/8]')){const tag=await page.locator('#posterMasterRemixTag').textContent();await page.locator('#posterMasterRemixDock').click();await page.waitForFunction(tag=>document.querySelector('#posterMasterRemixTag').textContent!==tag,tag);}await idle();}
async function measure(mode,enabled){return page.evaluate(async({mode,enabled})=>{
 document.body.dataset.ambient=enabled?'on':'off';
 const create=document.createElement.bind(document),read=CanvasRenderingContext2D.prototype.getImageData;let canvases=0,reads=0;
 document.createElement=(tag,...args)=>{if(tag==='canvas')canvases++;return create(tag,...args);};CanvasRenderingContext2D.prototype.getImageData=function(...args){reads++;return read.apply(this,args);};
 const start=performance.now(),intervals=[],tasks=[];let previous=start;const observer=new PerformanceObserver(list=>tasks.push(...list.getEntries().filter(e=>e.startTime>=start).map(e=>e.duration)));observer.observe({type:'longtask'});
 try{await new Promise(resolve=>{function frame(now){intervals.push(now-previous);previous=now;if(now-start<2000)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});return {mode,enabled,intervals,longTasks:tasks,canvases,pixelReads:reads};}
 finally{observer.disconnect();document.createElement=create;CanvasRenderingContext2D.prototype.getImageData=read;}
},{mode,enabled});}
(async()=>{
 fs.mkdirSync(out,{recursive:true});browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});page=await browser.newPage({viewport:{width:1280,height:1000},acceptDownloads:true});page.setDefaultTimeout(45000);
 page.on('dialog',d=>d.accept());page.on('pageerror',e=>report.errors.push(e.message));await page.goto('http://localhost:8089/?check=ambient#poster');await page.waitForFunction(()=>window.posterState?.image?.complete);await ready();
 await idle();assert.equal((await ambient()).length,5);
 for(const a of await ambient())for(const frame of a.frames)assert.ok(Object.keys(frame).every(k=>['offset','computedOffset','easing','composite','transform','opacity'].includes(k)),a.name+' must only animate transform/opacity');
 const bounds=await page.locator('#posterCanvas').boundingBox(),history=await page.evaluate(()=>JSON.stringify(posterHistory));
 await page.waitForTimeout(1000);assert.deepEqual(await page.locator('#posterCanvas').boundingBox(),bounds);assert.equal(await page.evaluate(()=>JSON.stringify(posterHistory)),history);
 // Holding a pointer must keep the scene decoration paused, not merely debounce it.
 const box=await page.locator('#posterStatus').boundingBox();await page.mouse.move(box.x+4,box.y+4);await page.mouse.down();await page.waitForTimeout(1400);
 assert.equal(await page.evaluate(()=>document.body.dataset.ambientEditing),'true');assert.equal((await ambient()).filter(a=>a.state==='paused').length,3);await page.mouse.up();await ready();assert.ok((await ambient()).every(a=>a.state==='running'));
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal((await ambient()).length,0);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await ready();
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.body.dataset.ambient==='off');assert.equal((await ambient()).length,0);
 await page.locator('#posterMotionPreference').selectOption('on');assert.equal((await ambient()).length,0,'Continuous loops respect reduced motion even with explicit on');
 await page.emulateMedia({reducedMotion:'no-preference'});await ready();
 await page.locator('#posterMotionPreference').selectOption('off');assert.equal((await ambient()).length,0);await page.locator('#posterMotionPreference').selectOption('on');await ready();
 report.checks.push('Five bounded CSS loops, stationary canvas/history, held-pointer pause and idle resume, blur/focus, reduced motion and off');
 for(const mode of ['poster','filter']){await page.locator('[data-mode="'+mode+'"]').click();await ready();assert.equal(await page.locator('.topbar #posterMotionPreference').isVisible(),true);assert.equal((await ambient()).length,mode==='poster'?5:4);for(const enabled of [false,true,true,false]){const result=await measure(mode,enabled);assert.equal(result.canvases,0);assert.equal(result.pixelReads,0);report.performance.push(result);}await page.evaluate(()=>document.body.dataset.ambient='on');}
 await page.locator('[data-mode="poster"]').click();
 for(const [name,list] of [['single-03',[samples[0]]],['single-20',[samples[1]]],['pair',samples]]){
  await page.locator('[data-poster-action="demo"]').click();await page.waitForFunction(()=>!posterHasUserUploadedImages()&&document.querySelector('#posterMasterRemixTag').textContent.includes('[1/8]'));await idle();
  await page.locator('#posterMotionPreference').selectOption('off');await page.locator('#posterImageInput').setInputFiles(list.map(a=>path.join(root,'samples/aespa',a.original)));await page.waitForFunction(n=>posterHasUserUploadedImages()&&posterState.assets.length===n,list.length);await template(1);
  const assets=await page.evaluate(()=>JSON.stringify(posterState.assets)),off=await png(name+'-off');await page.locator('#posterMotionPreference').selectOption('on');await ready();assert.equal(await png(name+'-on'),off);
  if(name==='pair'){
   for(let i=0;i<8;i++){const tag=await page.locator('#posterMasterRemixTag').textContent();await page.locator('#posterMasterRemixDock').click();await page.waitForFunction(tag=>document.querySelector('#posterMasterRemixTag').textContent!==tag,tag);await idle();assert.equal(await page.evaluate(()=>JSON.stringify(posterState.assets)),assets);}await template(1);
   const secondary=await page.evaluate(()=>posterState.assets.find(a=>a.id!==posterState.mainImageId).id);await page.evaluate(id=>posterSetMainImage(id),secondary);await page.locator('#posterMotionPreference').selectOption('off');const swapped=await png('pair-swapped-off');await page.locator('#posterMotionPreference').selectOption('on');await ready();assert.equal(await png('pair-swapped-on'),swapped);
   const draft=await png('draft-before');await page.locator('#posterSaveDraftButton').click();await page.waitForFunction(()=>!posterDraftPending());await page.reload();await page.waitForFunction(()=>window.posterState?.image?.complete&&posterHasUserUploadedImages());await ready();assert.equal(await png('draft-restored'),draft);
  }
  assert.equal(await page.evaluate(()=>posterState.assets.length),list.length);report.uploadScenes.push({name,assets:await page.evaluate(()=>posterState.assets)});console.log('PASS ambient PNG '+name);
 }
 for(const mode of ['poster','filter']){await page.locator('[data-mode="'+mode+'"]').click();for(const width of [1280,968,390]){await page.setViewportSize({width,height:1000});if(mode==='poster')await page.locator('[data-zoom-action="fit"]').click();await page.locator('.topbar').scrollIntoViewIfNeeded();await ready();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(out,'viewport-'+mode+'-'+width+'.png')});}}
 await page.locator('[data-mode="poster"]').click();
 await page.setViewportSize({width:1280,height:1000});await page.locator('[data-zoom-action="fit"]').click();await ready();
 for(const time of [0,4500]){await page.evaluate(time=>{for(const a of document.getAnimations().filter(a=>a.animationName?.startsWith('lab-'))){a.pause();a.currentTime=time;}},time);await page.screenshot({path:path.join(out,'phase-'+time+'.png')});}
 for(const a of samples)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'samples/aespa',a.original))).digest('hex'),a.sha256);
 assert.deepEqual(report.errors,[]);report.checks.push('Both modes, idle ABBA probes, 03/20 single/pair/swapped actual PNGs, eight master groups, draft, original hashes and three viewports');console.log('PASS ambient browser check');
})().catch(e=>{report.failure=e.stack;console.error(e);process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));await browser?.close();});
