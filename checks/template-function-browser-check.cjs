// Real uploads and PNG downloads; only the two agreed gallery samples.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const packages='C:/Users/24369/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const {chromium}=require(packages+'playwright'),sharp=require(packages+'sharp');
const root=path.resolve(__dirname,'..'),out=path.join(root,'samples/results/template-function-acceptance/20261010');
fs.mkdirSync(out,{recursive:true});
const manifest=JSON.parse(fs.readFileSync(path.join(root,'samples/aespa/manifest.json'))),samples=[manifest.images[2],manifest.images[19]];
const original=a=>path.join(root,'samples/aespa',a.original),hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const report={samples:samples.map(a=>a.id),checks:[],exports:[],errors:[],remote:[]};let browser,page;
const names={7:'After Hours Album',8:'Electric Blue Archive'};
async function settle(){await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
async function ready(n){await page.waitForFunction(n=>posterState.remixInfo.anchorEn===({7:'After Hours Album',8:'Electric Blue Archive'}[n])&&(n===7?!posterState.main.cutout:posterState.main.cutout),n);await settle();}
async function demo(n){await page.locator('[data-poster-action="demo-0'+n+'"]').click();await ready(n);}
async function elements(){await page.locator('summary').filter({hasText:'海报元素列表'}).evaluate(e=>e.parentElement.open=true);}
async function selectCard(index){await elements();await page.locator('[data-poster-action="select-secondary"]').nth(index).click();}
async function selectText(index){await elements();await page.locator('[data-poster-action="select-text"]').nth(index).click();}
async function control(prop,value,global=false){
  const c=page.locator('[data-'+(global?'global':'prop')+'="'+prop+'"]').first();await c.evaluate(e=>{const d=e.closest('details');if(d)d.open=true;});
  if(await c.evaluate(e=>e.tagName)==='SELECT')await c.selectOption(String(value));
  else if(await c.getAttribute('type')==='checkbox')await c.setChecked(value);
  else if(['range','color'].includes(await c.getAttribute('type'))){await c.evaluate((e,v)=>{e.value=String(v);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));},value);}
  else {await c.fill(String(value));await c.dispatchEvent('input');await c.dispatchEvent('change');}await settle();
}
async function png(name){
  await settle();const pending=page.waitForEvent('download');await page.locator('#posterExportButton').click();
  const file=path.join(out,name+'.png');await(await pending).saveAs(file);const m=await sharp(file).metadata();
  assert.equal(m.width+'x'+m.height,await page.locator('#posterResolutionSelect').inputValue());
  report.exports.push({file:path.basename(file),width:m.width,height:m.height,sha256:hash(file)});return file;
}
async function same(a,b){assert.ok((await sharp(a).ensureAlpha().raw().toBuffer()).equals(await sharp(b).ensureAlpha().raw().toBuffer()),path.basename(a)+' must match '+path.basename(b));}
async function sources(){return page.evaluate(()=>({main:posterState.mainImageId,pool:JSON.stringify(posterState.assets),valid:posterState.secondaries.every(s=>posterState.assets.some(a=>a.id===s.imageId))}));}
async function step(){
  const tag=await page.locator('#posterMasterRemixTag').textContent(),now=Number(tag.match(/\[(\d+)\//)?.[1] || 0),next=now%8+1;
  await page.locator('[data-poster-action="master-remix"]').first().click();
  await page.waitForFunction(n=>document.querySelector('#posterMasterRemixTag').textContent.includes('['+n+'/8]'),next);await settle();return next;
}
async function cycle(n){const before=await sources();for(let i=0;i<8;i++){await step();assert.deepEqual(await sources(),before);}await ready(n);}
async function uploaded(n,list){await demo(n);await page.locator('#posterImageInput').setInputFiles(list.map(original));await page.waitForFunction(count=>posterHasUserUploadedImages()&&posterState.assets.length===count,list.length);let reached=false;for(let i=0;i<8;i++)if(await step()===n){reached=true;break;}assert.ok(reached);await ready(n);}
async function auditFonts(n){
  const fonts=await page.evaluate(()=>Array.from(new Map(posterState.texts.filter(t=>t.font).map(t=>[t.font,posterState.texts.indexOf(t)])).entries()));
  for(const [font,i]of fonts){await selectText(i);assert.equal(await page.locator('[data-prop="font"]').inputValue(),font,'Template '+n+': menu must display '+font);}
  report.checks.push('Template '+n+': every template font is available and selected correctly');
}
async function uploadedCase(label,list){
  await demo(8);await page.locator('#posterImageInput').setInputFiles(list.map(original));await page.waitForFunction(count=>posterHasUserUploadedImages()&&posterState.assets.length===count,list.length);await fullCycle(label);
}
async function fullCycle(label){
  const before=await sources();
  for(let i=0;i<8;i++){
    const n=await step();assert.deepEqual(await sources(),before);await auditFonts(n);await png(label+'-template-0'+n);
    console.log(label+': template '+n+' exported and fonts checked');
  }
  report.checks.push(label+': complete eight-template cycle preserves actual upload IDs, main and all sources');
}
(async()=>{
  for(const a of samples)assert.equal(hash(original(a)),a.sha256);
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});page=await browser.newPage({viewport:{width:1600,height:1100},acceptDownloads:true});page.setDefaultTimeout(60000);
  page.on('dialog',d=>d.accept());page.on('pageerror',e=>report.errors.push(e.message));page.on('request',r=>{if(!/^(http:\/\/localhost:8089\/|data:|blob:)/.test(r.url()))report.remote.push(r.url());});
  await page.goto('http://localhost:8089/#poster');await page.waitForFunction(()=>posterState?.image?.complete);await page.locator('#posterMotionPreference').selectOption('off');
  for(const a of samples)await uploadedCase('single-'+a.id,[a]);
  await uploadedCase('pair-main-03',samples);const ids=await page.evaluate(()=>posterState.assets.map(a=>a.id));await page.locator('[data-asset-id="'+ids[1]+'"] [data-tray-action="set-main"]').click();await fullCycle('pair-main-20');
  const base=path.join(out,'pair-main-20-template-08.png'),cardIndex=await page.evaluate(()=>posterState.secondaries.findIndex(s=>s.cutout&&s.fit==='contain'));assert.ok(cardIndex>=0);await selectCard(cardIndex);
  await control('fit','cover');const cover=await png('fit-cover');assert.notEqual(hash(base),hash(cover));await page.locator('[data-poster-action="undo"]').first().click();await same(base,await png('fit-contain-undo'));await page.locator('[data-poster-action="redo"]').first().click();await same(cover,await png('fit-cover-redo'));
  await selectCard(cardIndex);await control('fit','contain');await control('zoom',1.15);await control('panX',-27);await control('panY',19);await png('fit-zoom-pan');
  await page.locator('[data-poster-action="frame"]').click();await page.locator('[data-poster-action="detail"]').first().click();assert.equal(await page.evaluate(i=>posterState.frames.at(-1).sourceId===posterState.secondaries[i].id,cardIndex),true);await png('fit-linked-sample');
  await selectCard(cardIndex);const geometry=await page.evaluate(i=>{const s=posterState.secondaries[i];return JSON.stringify([s.x,s.y,s.w,s.h,s.fit,s.zoom,s.panX,s.panY]);},cardIndex);await control('imageId',ids[1]);assert.equal(await page.evaluate(i=>{const s=posterState.secondaries[i];return JSON.stringify([s.x,s.y,s.w,s.h,s.fit,s.zoom,s.panX,s.panY]);},cardIndex),geometry);await png('fit-source-replaced');
  report.checks.push('Actual fit menu switches cover/contain, exact undo/redo; zoom/offset, linked frame and source replacement retain fit geometry');
  await demo(8);const defaultDemo=await png('demo-08');await page.locator('#posterResolutionSelect').selectOption('3000x4000');await png('demo-08-3000x4000');await page.locator('#posterResolutionSelect').selectOption('1200x1600');
  await page.locator('#posterSaveDraftButton').click();await page.waitForFunction(()=>!posterDraftPending());await page.reload();await ready(8);await same(defaultDemo,await png('fit-draft-restored'));report.checks.push('Contain pose retained by real high-resolution export and exact draft reload');
  await demo(7);const demo7=await png('demo-07');const toolbar=await page.evaluate(()=>posterState.texts.findIndex(t=>t.content.includes('Boomerang')));await selectText(toolbar);await control('backgroundOpacity',0);const off=await png('toolbar-backing-zero');await same(off,path.join(root,'samples/results/template-07-08/20261010/demo-07.png'));await page.locator('[data-poster-action="undo"]').first().click();await same(demo7,await png('toolbar-backing-undo'));await page.locator('[data-poster-action="redo"]').first().click();await same(off,await png('toolbar-backing-redo'));report.checks.push('Toolbar backing opacity zero restores the prior exact template 7 pixels; undo/redo are exact');
  await uploaded(7,[samples[1]]);await selectCard(0);await control('panY',200);await png('template-07-portrait-crop-adjusted');report.checks.push('Portraits in template 7 horizontal cards can be moved toward the top with actual crop controls');
  for(const width of [900,390]){await page.setViewportSize({width,height:950});await settle();assert.equal(await page.locator('.poster-demo-button-row').evaluate(e=>e.scrollWidth>e.clientWidth+1),false);await page.screenshot({path:path.join(out,'workspace-'+width+'.png')});}report.checks.push('Editor demo controls still fit at 900/390 widths');
  for(const a of samples)assert.equal(hash(original(a)),a.sha256);assert.deepEqual(report.errors,[]);assert.deepEqual(report.remote,[]);
  fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));console.log('PASS: '+report.exports.length+' actual PNG exports; four eight-template upload cycles and feature checks');
})().catch(e=>{report.failure=e.stack;fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));console.error(e);process.exitCode=1;}).finally(async()=>browser?.close());
