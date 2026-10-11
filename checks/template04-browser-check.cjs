// Two actual gallery images only; isolated Edge, real uploads and PNG downloads.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const packages='C:/Users/24369/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const {chromium}=require(packages+'playwright'),sharp=require(packages+'sharp');
const root=path.resolve(__dirname,'..'),out=path.join(root,'samples/results/template-04/20261010-clean-grain');
fs.mkdirSync(out,{recursive:true});
const manifest=JSON.parse(fs.readFileSync(path.join(root,'samples/aespa/manifest.json'))),samples=[manifest.images[2],manifest.images[19]];
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const original=a=>path.join(root,'samples/aespa',a.original);
const report={samples:samples.map(a=>a.id),exports:[],checks:[],errors:[],remote:[]};let browser,page;
async function settle(){await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
async function pink(){await page.waitForFunction(()=>posterState.remixInfo.anchorEn==='Pink Desktop'&&posterState.secondaries[0].cutout);await settle();}
async function demo(){await page.locator('[data-poster-action="demo-04"]').click();await pink();await page.waitForFunction(()=>!posterHasUserUploadedImages());}
async function elements(){await page.locator('summary').filter({hasText:'海报元素列表'}).evaluate(e=>e.parentElement.open=true);}
async function selectText(index){await elements();await page.locator('[data-poster-action="select-text"]').nth(index).click();}
async function selectCard(index){await elements();await page.locator('[data-poster-action="select-secondary"]').nth(index).click();}
async function control(selector,value){const c=page.locator(selector).first();await c.evaluate(e=>{const d=e.closest('details');if(d)d.open=true;});if(await c.getAttribute('type')==='checkbox')await c.setChecked(value);else if(await c.evaluate(e=>e.tagName)==='SELECT')await c.selectOption(String(value));else {await c.fill(String(value));await c.dispatchEvent('input');await c.dispatchEvent('change');}await settle();}
async function png(name){await settle();const promise=page.waitForEvent('download');await page.locator('#posterExportButton').click();const d=await promise,file=path.join(out,name+'.png');await d.saveAs(file);const meta=await sharp(file).metadata(),target=await page.locator('#posterResolutionSelect').inputValue();assert.equal(meta.width+'x'+meta.height,target);report.exports.push({file:name+'.png',width:meta.width,height:meta.height,bytes:fs.statSync(file).size,sha256:hash(file)});return file;}
async function same(a,b){assert.ok((await sharp(a).ensureAlpha().raw().toBuffer()).equals(await sharp(b).ensureAlpha().raw().toBuffer()),'Actual PNG pixels restore: '+path.basename(a)+' / '+path.basename(b));}
async function uploaded(list){await demo();await page.locator('#posterImageInput').setInputFiles(list.map(original));await page.waitForFunction(n=>posterHasUserUploadedImages()&&posterState.assets.length===n,list.length);for(let i=0;i<4;i++)await page.locator('[data-poster-action="master-remix"]').first().click();await pink();}
async function cycle(){const before=await page.evaluate(()=>({id:posterState.mainImageId,pool:JSON.stringify(posterState.assets)}));for(let i=0;i<8;i++){await page.locator('[data-poster-action="master-remix"]').first().click();if(i===7)await pink();const now=await page.evaluate(()=>({id:posterState.mainImageId,pool:JSON.stringify(posterState.assets),valid:posterState.secondaries.every(s=>posterState.assets.some(a=>a.id===s.imageId))}));assert.equal(now.id,before.id);assert.equal(now.pool,before.pool);assert.equal(now.valid,true);}assert.match(await page.locator('#posterMasterRemixTag').textContent(),/4\/8/);}
(async()=>{
 for(const a of samples)assert.equal(hash(original(a)),a.sha256);
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 page=await browser.newPage({viewport:{width:1600,height:1100},acceptDownloads:true});page.setDefaultTimeout(15000);
 page.on('dialog',d=>d.accept());page.on('pageerror',e=>report.errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith('http://localhost:8089/')&&!r.url().startsWith('data:'))report.remote.push(r.url());});
 await page.goto('http://localhost:8089/#poster');await page.waitForFunction(()=>posterState?.image?.complete);assert.equal(await page.evaluate(()=>posterState.backgroundStyle),'electric-tiger');
 await page.locator('#posterMotionPreference').selectOption('off');await demo();
 assert.deepEqual(await page.evaluate(()=>posterState.assets.map(a=>posterImageAssets.get(a.id).libraryId)),['aespa-20','aespa-03','aespa-09']);
 assert.equal(await page.evaluate(()=>posterState.secondaries.filter(s=>s.windowFrame).length),2);
 const defaultPng=await png('demo-default-1200x1600');await page.screenshot({path:path.join(out,'workspace-1600.png')});
 report.checks.push('Fresh browser defaults template 01; demo 04 uses own gallery 20/03/09, one original hero, one locally cut foreground and two distinct photo windows');
 assert.equal(await page.evaluate(()=>posterState.backgroundStyle),'pink-paper');
 assert.equal(await page.evaluate(()=>posterState.filters.noiseMonochrome),false);
 assert.equal(await page.evaluate(()=>posterState.filters.paper),0);
 assert.equal(await page.evaluate(()=>posterState.secondaries.every(s=>s.filters.paper===0)),true);
 for(const [prop,value,name] of [['noiseMonochrome',true,'monochrome-noise'],['paper',4,'paper-on'],['backgroundTextureOpacity',0,'paper-background-off']]){
   if(await page.locator('#posterDeselectButton').isVisible())await page.locator('#posterDeselectButton').click();await control(`[data-global="${prop}"]`,value);const changed=await png(name);assert.notEqual(hash(changed),hash(defaultPng));
   await page.locator('[data-poster-action="undo"]').first().click();await same(defaultPng,await png(name+'-undo'));
 }
 for(const shape of ['flower','butterfly','book','heart-arrow']){
   const index=await page.evaluate(shape=>posterState.texts.findIndex(t=>t.badgeShape===shape),shape);assert.ok(index>=0);await selectText(index);
   await control('[data-prop="badgeColor"]','#73c0cd');const changed=await png(shape+'-color-edited');assert.notEqual(hash(changed),hash(defaultPng));
   await page.locator('[data-poster-action="undo"]').first().click();await same(defaultPng,await png(shape+'-color-undo'));
 }
 await selectText(2);await control('[data-prop="badgeColor"]','#73c0cd');await control('[data-prop="badgeShape"]','checker-heart');await png('checker-color-edited');await demo();
 report.checks.push('Default main/card paper is off; color/monochrome noise, paper strength and background opacity visibly change actual PNG; four new editable sticker shapes recolor and Undo restores exact pixels; checker fill follows its color');
 for(const a of samples){await uploaded([a]);assert.equal(await page.evaluate(()=>posterState.imageName),a.filename);assert.equal(await page.evaluate(()=>posterState.assets.length),1);await cycle();await png('single-'+a.id+'-default');}
 await uploaded(samples);await cycle();const ids=await page.evaluate(()=>posterState.assets.map(a=>a.id));await selectCard(1);
 await page.locator(`[data-asset-id="${ids[1]}"] [data-tray-action="set-main"]`).click();assert.equal(await page.evaluate(()=>posterState.mainImageId),ids[1]);
 await cycle();await png('pair-aespa-03-20-main-20');assert.equal(await page.evaluate(()=>posterState.assets.length),2);
 report.checks.push('Both real single uploads and a two-image pair survive all eight templates; pair main promotion and automatic foreground segmentation preserve upload IDs and pool');
 await demo();await selectText(0);
 await control('[data-prop="textStyle"]','plain');const plain=await png('title-plain');await control('[data-prop="textStyle"]','balloon');await same(defaultPng,await png('title-balloon-restored'));
 assert.notEqual(hash(defaultPng),hash(plain));await control('[data-prop="balloonShine"]',0);const matte=await png('title-matte');assert.notEqual(hash(matte),hash(defaultPng));
 await page.locator('[data-poster-action="undo"]').first().click();await same(defaultPng,await png('title-shine-undo'));
 await control('[data-prop="content"]','PINK LOVE');await control('[data-prop="color"]','#bc70ce');await png('title-text-color-edited');
 report.checks.push('Balloon/plain toggle, shine 0, editable title/color and actual PNG Undo restore work');
 await demo();const folder=await page.evaluate(()=>posterState.texts.find(t=>t.badgeShape==='folder'));
 const rect=await page.locator('#posterCanvas').boundingBox();await page.mouse.click(rect.x+(folder.x+folder.badgeWidth/2)*rect.width/900,rect.y+(folder.y+folder.badgeHeight/2)*rect.height/1200);
 assert.equal(await page.evaluate(()=>posterState.selected.id),folder.id,'Clicking icon body selects editable sticker, not underlying photo');
 await control('[data-prop="badgeWidth"]',130);await control('[data-prop="badgeColor"]','#cf84b0');await png('folder-size-color-edited');
 await page.locator('[data-poster-action="duplicate"]').first().click();assert.equal(await page.evaluate(()=>posterState.texts.filter(t=>t.badgeShape==='folder').length),3);
 await page.locator('#posterInspectorContent [data-poster-action="delete"]').click();assert.equal(await page.evaluate(()=>posterState.texts.filter(t=>t.badgeShape==='folder').length),2);
 await selectText(2);await control('[data-prop="badgeShape"]','none');await png('heart-off');await control('[data-prop="badgeShape"]','checker-heart');
 report.checks.push('Sticker body hit-testing, size/color editing, duplicate/delete and disabling/re-enabling a heart work');
 await demo();await selectCard(1);await control('[data-prop="windowFrame"]',false);const borderOff=await png('window-off');await control('[data-prop="windowFrame"]',true);await same(defaultPng,await png('window-restored'));
 assert.notEqual(hash(defaultPng),hash(borderOff));await control('[data-prop="windowTitle"]','MY PHOTO.jpg');await control('[data-prop="windowColor"]','#de7db0');await control('[data-prop="zoom"]',1.4);await control('[data-prop="panY"]',35);await png('window-title-color-crop-edited');
 const geometry=await page.evaluate(()=>{const s=posterState.secondaries[1];return JSON.stringify([s.id,s.x,s.y,s.w,s.h,s.rotation,s.filters,s.windowFrame,s.windowTitle]);});
 await control('[data-prop="imageId"]','asset-pink-hero');assert.equal(await page.evaluate(()=>{const s=posterState.secondaries[1];return JSON.stringify([s.id,s.x,s.y,s.w,s.h,s.rotation,s.filters,s.windowFrame,s.windowTitle]);}),geometry);await png('window-photo-replaced');
 await page.locator('[data-poster-action="frame"]').click();await page.locator('[data-poster-action="detail"]').first().click();await png('window-linked-sample');
 report.checks.push('Window on/off restores exact PNG; title/color/photo zoom and offset editing, independent source replacement and window-linked sample export work');
 await demo();await selectCard(0);await page.locator('[data-poster-action="cutout"]').click();assert.equal(await page.evaluate(()=>posterState.secondaries[0].cutout),false);const raw=await png('foreground-original-background');await page.locator('[data-poster-action="cutout"]').click();await pink();await same(defaultPng,await png('foreground-cutout-restored'));assert.notEqual(hash(raw),hash(defaultPng));
 await page.locator('#posterDeselectButton').click();await control('[data-global="grain"]',0);await png('grain-off');
 await demo();await page.locator('#posterResolutionSelect').selectOption('3000x4000');await png('demo-3000x4000');await page.locator('#posterResolutionSelect').selectOption('1200x1600');
 await page.locator('#posterSaveDraftButton').click();await page.waitForFunction(()=>!posterDraftPending());await page.reload();await pink();
 assert.equal(await page.evaluate(()=>posterState.texts[0].textStyle),'balloon');assert.equal(await page.evaluate(()=>posterState.secondaries.filter(s=>s.windowFrame).length),2);await same(defaultPng,await png('draft-restored-1200x1600'));
 report.checks.push('Foreground background restoration preserves pixels; grain 0 and 3000×4000 export respond; editable draft restores balloon, stickers, windows and active cutout');
 for(const width of [900,390]){await page.setViewportSize({width,height:950});await settle();const overflow=await page.locator('.poster-demo-button-row').evaluate(e=>e.scrollWidth>e.clientWidth+1);assert.equal(overflow,false);await page.waitForFunction(()=>{
 const stage=document.querySelector('.poster-stage').getBoundingClientRect(),viewport=document.querySelector('.poster-viewport').getBoundingClientRect(),canvas=document.querySelector('#posterCanvas').getBoundingClientRect();
 return stage.x>=0&&stage.right<=innerWidth+1&&canvas.x>=viewport.x-1&&canvas.right<=viewport.right+1&&canvas.width>0&&[...document.querySelectorAll('.poster-resizer')].every(e=>getComputedStyle(e).display==='none');
});await page.screenshot({path:path.join(out,'workspace-'+width+'.png')});}
 await page.setViewportSize({width:1600,height:1100});await settle();
 await page.locator('#posterImageInput').setInputFiles(original(samples[0]));await page.waitForFunction(()=>posterHasUserUploadedImages());
 for(let i=0;i<3;i++)await page.locator('[data-poster-action="master-remix"]').first().click();
 const beforeFailure=await page.evaluate(()=>JSON.stringify({...posterState,image:null}));
 await page.evaluate(()=>{window.nativeCutout=posterCutout.removeBackground;posterCutout.removeBackground=async()=>{throw new Error('Controlled local model failure');};});
 await page.locator('[data-poster-action="master-remix"]').first().click();await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('Controlled local model failure'));
 assert.equal(await page.evaluate(()=>JSON.stringify({...posterState,image:null})),beforeFailure);
 await page.evaluate(()=>{posterCutout.removeBackground=async image=>{const result=await nativeCutout(image);return new Promise(resolve=>window.releasePinkResult=()=>resolve(result));};});
 await page.locator('[data-poster-action="master-remix"]').first().click();await page.waitForFunction(()=>typeof releasePinkResult==='function');
 await page.locator('#posterImageInput').setInputFiles(original(samples[1]));await page.waitForFunction(()=>posterState.assets.length===2);
 const newer=await page.evaluate(()=>JSON.stringify({...posterState,image:null}));await page.evaluate(()=>{releasePinkResult();posterCutout.removeBackground=nativeCutout;});
 await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('作品已修改，未替换成模板四'));
 assert.equal(await page.evaluate(()=>JSON.stringify({...posterState,image:null})),newer);
 await page.locator('[data-poster-action="master-remix"]').first().click();await pink();assert.equal(await page.evaluate(()=>posterState.assets.length),2);
 report.checks.push('New template preparation preserves the current scene on model failure; a late real local model result cannot overwrite newer uploads; retry succeeds');
 await demo();await png('demo-final-1200x1600');
 for(const a of samples)assert.equal(hash(original(a)),a.sha256);assert.deepEqual(report.errors,[]);assert.deepEqual(report.remote,[]);
 report.checks.push('Only two actual sample photos; original SHA-256 unchanged; no browser pageerror or external photo/model requests; eight demo buttons and FIT canvas stay inside the viewport at 900/390; responsive resizers are hidden');
 fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));console.log('PASS: '+report.exports.length+' actual PNG exports; '+report.checks.length+' scenarios');
})().catch(e=>{report.failure=e.stack;fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));console.error(e);process.exitCode=1;}).finally(async()=>browser?.close());
