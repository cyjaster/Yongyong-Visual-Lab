// Real uploads and PNG downloads; only the two agreed gallery samples.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const packages='C:/Users/24369/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const {chromium}=require(packages+'playwright'),sharp=require(packages+'sharp');
const root=path.resolve(__dirname,'..'),out=path.join(root,'samples/results/template-07-08/20261010');
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
(async()=>{
  for(const a of samples)assert.equal(hash(original(a)),a.sha256);
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  page=await browser.newPage({viewport:{width:1600,height:1100},acceptDownloads:true});page.setDefaultTimeout(60000);
  page.on('dialog',d=>d.accept());page.on('pageerror',e=>report.errors.push(e.message));
  page.on('request',r=>{if(!/^(http:\/\/localhost:8089\/|data:|blob:)/.test(r.url()))report.remote.push(r.url());});
  await page.goto('http://localhost:8089/#poster');await page.waitForFunction(()=>posterState?.image?.complete);
  await page.locator('#posterMotionPreference').selectOption('off');assert.equal(await page.locator('.poster-demo-button-row button').count(),8);
  for(const n of [7,8]){
    await demo(n);assert.deepEqual(await page.evaluate(()=>posterState.assets.map(a=>posterImageAssets.get(a.id).libraryId)),n===7?['aespa-05','aespa-04','aespa-20']:['aespa-12','aespa-05','aespa-03','aespa-18']);
    const base=await png('demo-0'+n);await page.screenshot({path:path.join(out,'workspace-0'+n+'.png')});
    if(n===7){
      await selectCard(0);await control('lineWidth',0);assert.equal(await page.evaluate(()=>posterState.secondaries[0].lineWidth),0);
      const off=await png('template-07-border-zero');assert.notEqual(hash(base),hash(off));
      await page.locator('[data-poster-action="undo"]').first().click();await same(base,await png('template-07-border-undo'));
      await selectCard(0);await control('zoom',1.2);await control('panY',0);await control('color','#ffc8b0');
      const before=await page.evaluate(()=>{const s=posterState.secondaries[0];return JSON.stringify([s.x,s.y,s.w,s.h,s.lineWidth,s.color]);});
      const other=await page.evaluate(()=>posterState.assets[1].id);await control('imageId',other);
      assert.equal(await page.evaluate(()=>{const s=posterState.secondaries[0];return JSON.stringify([s.x,s.y,s.w,s.h,s.lineWidth,s.color]);}),before);
      await png('template-07-crop-source-edited');
      const caption=await page.evaluate(()=>posterState.texts.findIndex(t=>t.content==='Fancy\ndinner'));
      await selectText(caption);await control('content','My\nmemories');await control('strokeWidth',0);await png('template-07-caption-edited');
    }else{
      await elements();await page.locator('[data-poster-action="select-main"]').first().click();
      await control('cutoutBorderWidth',0);await control('cutoutShadow',0);assert.equal(await page.evaluate(()=>posterState.main.cutoutBorderWidth),0);
      const off=await png('template-08-sticker-edge-zero');assert.notEqual(hash(base),hash(off));
      await page.locator('[data-poster-action="undo"]').first().click();await page.locator('[data-poster-action="undo"]').first().click();await same(base,await png('template-08-edge-undo'));
      await elements();await page.locator('[data-poster-action="select-main"]').first().click();await control('cutoutBorderColor','#7ecbff');await control('cutoutBorderWidth',18);await png('template-08-edge-color-edited');
      await demo(n);await elements();await page.locator('[data-poster-action="select-main"]').first().click();await control('bw',0,true);
      assert.equal(await page.evaluate(()=>posterState.filters.bw),0);const color=await png('template-08-bw-zero');assert.notEqual(hash(base),hash(color));
      await page.locator('[data-poster-action="undo"]').first().click();await same(base,await png('template-08-bw-undo'));
      await page.locator('[data-poster-action="redo"]').first().click();await same(color,await png('template-08-bw-redo'));
      await demo(n);await elements();await page.locator('[data-poster-action="select-main"]').first().click();await page.locator('[data-poster-action="cutout"]').click();assert.equal(await page.evaluate(()=>posterState.main.cutout),false);await png('template-08-original-background');
      await page.locator('[data-poster-action="cutout"]').click();await ready(n);await same(base,await png('template-08-cutout-restored'));
      const profile=await page.evaluate(()=>posterState.texts.findIndex(t=>t.badgeShape==='profile-card'));await selectText(profile);await control('content','MY ARCHIVE\n03 posts | 20 photos | 08 templates\nLocal memories\nKept close\nMy own photos');await png('template-08-profile-edited');
    }
    await demo(n);const arrow=await page.evaluate(n=>posterState.texts.findIndex(t=>t.badgeShape===(n===7?'sketch-arrow':'outline-box')),n);
    await selectText(arrow);await control('badgeColor','#00a6b0');await control('badgeWidth',140);await png('template-0'+n+'-decoration-edited');
    await demo(n);await selectCard(n===7?0:3);await page.locator('[data-poster-action="frame"]').click();await page.locator('[data-poster-action="detail"]').first().click();
    assert.equal(await page.evaluate(()=>posterState.details.every(d=>posterState.frames.some(f=>f.id===d.frameId))),true);await png('template-0'+n+'-linked-sample');
    report.checks.push('Template '+n+': photo/decoration edits and linked sampling; zero parameters, exact Undo/Redo or original/cutout restoration where applicable');
    for(const a of samples){await uploaded(n,[a]);await cycle(n);assert.equal(await page.evaluate(()=>posterState.imageName),a.filename);await png('template-0'+n+'-single-'+a.id+'-default');}
    await uploaded(n,samples);await cycle(n);await png('template-0'+n+'-pair-main-03');
    const ids=await page.evaluate(()=>posterState.assets.map(a=>a.id));await page.locator('[data-asset-id="'+ids[1]+'"] [data-tray-action="set-main"]').click();
    await cycle(n);assert.equal(await page.evaluate(()=>posterState.mainImageId),ids[1]);await png('template-0'+n+'-pair-main-20');
    report.checks.push('Template '+n+': both real single uploads and pair plus main switch retain pool and sources throughout all eight templates');
    await demo(n);await page.locator('#posterResolutionSelect').selectOption('3000x4000');await png('demo-0'+n+'-3000x4000');await page.locator('#posterResolutionSelect').selectOption('1200x1600');
    await page.locator('#posterSaveDraftButton').click();await page.waitForFunction(()=>!posterDraftPending());await page.reload();await ready(n);await same(base,await png('template-0'+n+'-draft-restored'));
    report.checks.push('Template '+n+': actual 3000x4000 export and draft reload with exact default PNG');
  }
  for(const width of [900,390]){
    await page.setViewportSize({width,height:950});await settle();assert.equal(await page.locator('.poster-demo-button-row').evaluate(e=>e.scrollWidth>e.clientWidth+1),false);
    await page.waitForFunction(()=>{const v=document.querySelector('.poster-viewport').getBoundingClientRect(),c=document.querySelector('#posterCanvas').getBoundingClientRect();return c.x>=v.x-1&&c.right<=v.right+1;});await page.screenshot({path:path.join(out,'workspace-'+width+'.png')});
  }
  report.checks.push('Eight demo buttons and FIT canvas stay within desktop, 900px and 390px');
  for(const a of samples)assert.equal(hash(original(a)),a.sha256);assert.deepEqual(report.errors,[]);assert.deepEqual(report.remote,[]);
  report.checks.push('Only 03/20 validated; original hashes unchanged; no pageerror or external photo/model request');
  fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));console.log('PASS: '+report.exports.length+' actual PNG exports; '+report.checks.length+' scenarios');
})().catch(e=>{report.failure=e.stack;fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));console.error(e);process.exitCode=1;}).finally(async()=>browser?.close());
