// Desktop demos: 04/05 use three photos, 06 uses four; upload checks use 03/20.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const packages='C:/Users/24369/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const {chromium}=require(packages+'playwright'),sharp=require(packages+'sharp');
const root=path.resolve(__dirname,'..'),out=path.join(root,'samples/results/demo06-four-photos/20261011');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'samples/aespa/manifest.json')));
const samples=[manifest.images[2],manifest.images[19]],demoIds=['aespa-20','aespa-03','aespa-09','aespa-15'];
const original=a=>path.join(root,'samples/aespa',a.original),hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const report={demoIds,uploadSamples:samples.map(a=>a.id),checks:[],exports:[],errors:[]};let page,browser;
async function ready(n){await page.waitForFunction(n=>document.querySelector('#posterMasterRemixTag').textContent.includes('['+n+'/8]')&&(n===4?posterState.secondaries[0]?.cutout:posterState.main.cutout),n);}
async function demo(n){await page.locator('[data-poster-action="demo-0'+n+'"]').click();await ready(n);await page.waitForFunction(n=>posterState.assets.length===(n===6?4:3)&&!posterHasUserUploadedImages(),n);}
async function sources(){return page.evaluate(()=>({main:posterState.mainImageId,pool:JSON.stringify(posterState.assets),valid:posterState.secondaries.every(s=>posterState.assets.some(a=>a.id===s.imageId))}));}
async function step(){const tag=await page.locator('#posterMasterRemixTag').textContent(),n=Number(tag.match(/\[(\d+)\//)[1])%8+1;await page.locator('[data-poster-action="master-remix"]').click();await page.waitForFunction(n=>document.querySelector('#posterMasterRemixTag').textContent.includes('['+n+'/8]'),n);return n;}
async function cycle(n){const before=await sources();for(let i=0;i<8;i++){await step();assert.deepEqual(await sources(),before);}await ready(n);}
async function png(name){const pending=page.waitForEvent('download');await page.locator('#posterExportButton').click();const file=path.join(out,name+'.png');await(await pending).saveAs(file);const meta=await sharp(file).metadata();assert.equal(meta.width+'x'+meta.height,await page.locator('#posterResolutionSelect').inputValue());report.exports.push(path.basename(file));return file;}
async function pixels(file){return crypto.createHash('sha256').update(await sharp(file).ensureAlpha().raw().toBuffer()).digest('hex');}
async function control(prop,value){const c=page.locator('[data-prop="'+prop+'"], [data-global="'+prop+'"]').first();const nav=await c.evaluate(e=>({pane:e.closest('[data-inspector-pane]')?.dataset.inspectorPane,effect:e.closest('[data-inspector-effect]')?.dataset.inspectorEffect}));await page.locator('[data-inspector-tab="'+nav.pane+'"]').click();if(nav.effect)await page.locator('#posterInspectorEffect').selectOption(nav.effect);await c.evaluate((e,v)=>{e.value=String(v);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));},value);}
(async()=>{
 fs.mkdirSync(out,{recursive:true});for(const id of demoIds){const a=manifest.images.find(a=>a.id===id);assert.equal(hash(original(a)),a.sha256);}
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});page=await browser.newPage({viewport:{width:1600,height:1100},acceptDownloads:true});page.setDefaultTimeout(60000);page.on('dialog',d=>d.accept());page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto('http://localhost:8089/#poster'); await page.evaluate(() => window.visualLab?.enterEdit());await page.waitForFunction(()=>window.posterState?.image?.complete);await page.locator('#posterMotionPreference').selectOption('off');
 for(const n of [4,5,6]){
  await demo(n);assert.deepEqual(await page.evaluate(()=>posterState.assets.map(a=>posterImageAssets.get(a.id).libraryId)),demoIds.slice(0,n===6?4:3));
  const used=await page.evaluate(()=>[...new Set([posterState.mainImageId,...posterState.secondaries.map(s=>s.imageId)])]);assert.equal(used.length,n===6?4:3);assert.ok(used.includes('asset-pink-camera'));
  if(n===6){const photos=await page.evaluate(()=>posterState.secondaries.filter(s=>s.id!=='desktop-background').map(s=>s.imageId));assert.equal(new Set(photos).size,4,'Photo strip and AirDrop have four distinct sources');assert.equal(photos.at(-1),'asset-pink-outdoor');}
  const base=await png('demo-0'+n);await cycle(n);assert.equal(await pixels(await png('demo-0'+n+'-remix-cycle')),await pixels(base));
  const card=await page.evaluate(()=>posterState.secondaries.find(s=>s.imageId==='asset-pink-camera'&&s.id!=='desktop-background').id);
  await page.locator('#posterInspectorTarget').selectOption('secondary:'+card);const zoom=await page.locator('[data-prop="zoom"]').inputValue();await control('zoom',Number(zoom)+.25);
  const cropped=await png('demo-0'+n+'-crop');assert.notEqual(await pixels(cropped),await pixels(base));await page.locator('[data-poster-action="undo"]').first().click();assert.equal(await pixels(await png('demo-0'+n+'-crop-undo')),await pixels(base));await page.locator('[data-poster-action="redo"]').first().click();assert.equal(await pixels(await png('demo-0'+n+'-crop-redo')),await pixels(cropped));await page.locator('[data-poster-action="undo"]').first().click();
  await page.locator('#posterInspectorTarget').selectOption('main:main-image');const brightness=await page.locator('[data-global="brightness"]').inputValue();await control('brightness',60);const adjusted=await png('demo-0'+n+'-brightness');assert.notEqual(await pixels(adjusted),await pixels(base));await control('brightness',0);await png('demo-0'+n+'-brightness-zero');await control('brightness',Number(brightness));assert.equal(await pixels(await png('demo-0'+n+'-brightness-restored')),await pixels(base));
  await page.locator('#posterResolutionSelect').selectOption('3000x4000');await png('demo-0'+n+'-3000x4000');await page.locator('#posterResolutionSelect').selectOption('1200x1600');
  await page.locator('#posterSaveDraftButton').click();await page.waitForFunction(()=>!posterDraftPending());await page.reload();await ready(n);await page.locator('#posterMotionPreference').selectOption('off');assert.equal(await pixels(await png('demo-0'+n+'-draft')),await pixels(base));assert.equal(await page.evaluate(()=>posterState.assets.length),n===6?4:3);
  report.checks.push('Demo '+n+': all '+(n===6?4:3)+' sources used, eight-template retention, crop/history, brightness/zero/restore, high-resolution and exact draft reload');console.log('PASS demo '+n);
 }
 for(const list of [[samples[0]],[samples[1]],samples]){
  await demo(4);await page.locator('#posterImageInput').setInputFiles(list.map(original));await page.waitForFunction(count=>posterHasUserUploadedImages()&&posterState.assets.length===count,list.length);
  for(const n of [4,5,6]){for(let i=0;i<8;i++)if(await step()===n)break;await ready(n);await cycle(n);await png(list.length===1?'single-'+list[0].id+'-0'+n:'pair-main-03-0'+n);}
  if(list.length===2){const id=await page.evaluate(()=>posterState.assets[1].id);await page.locator('[data-asset-id="'+id+'"] [data-tray-action="set-main"]').click();for(const n of [4,5,6]){for(let i=0;i<8;i++)if(await step()===n)break;await ready(n);await cycle(n);await png('pair-main-20-0'+n);}}
  console.log('PASS upload '+list.map(a=>a.id).join('/'));
 }
 for(const width of [968,390]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
 for(const id of demoIds){const a=manifest.images.find(a=>a.id===id);assert.equal(hash(original(a)),a.sha256);}assert.deepEqual(report.errors,[]);report.checks.push('03/20 single, pair and swapped-main preserve uploads through complete cycles for all three templates; originals unchanged; 968/390 no overflow');
 fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));console.log('PASS: '+report.exports.length+' actual PNGs');
})().catch(e=>{report.failure=e.stack;fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));console.error(e);process.exitCode=1;}).finally(async()=>browser?.close());
