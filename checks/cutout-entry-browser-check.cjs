// Two actual gallery photos; checks the fixed entry without changing the user's tab.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const packages='C:/Users/24369/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const {chromium}=require(packages+'playwright'),sharp=require(packages+'sharp');
const root=path.resolve(__dirname,'..'),out=path.join(root,'samples/results/cutout-direct-20261009');
const samples=JSON.parse(fs.readFileSync(path.join(root,'samples/aespa/manifest.json'))).images.filter(a=>['aespa-03','aespa-20'].includes(a.id));
const report={samples:samples.map(a=>a.id),checks:[],errors:[],exports:[]};let browser;
fs.mkdirSync(out,{recursive:true});
(async()=>{
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const page=await browser.newPage({viewport:{width:1600,height:1100},acceptDownloads:true});page.setDefaultTimeout(15000);
 page.on('dialog',d=>d.accept());page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto('http://localhost:8089/#poster');await page.waitForFunction(()=>posterState?.image?.complete);
 await page.locator('#posterMotionPreference').selectOption('off');
 await page.locator('#posterImageInput').setInputFiles(samples.map(a=>path.join(root,'samples/aespa',a.original)));
 await page.waitForFunction(()=>posterHasUserUploadedImages()&&posterState.assets.length===2);
 const ids=await page.evaluate(()=>posterState.assets.map(a=>a.id));
 const entry=page.locator('#posterCutoutEntry'),cutout=page.locator('#posterInspectorContent [data-poster-action="cutout"]');
 if(await page.locator('#posterDeselectButton').isVisible())await page.locator('#posterDeselectButton').click();
 await page.evaluate(()=>{window.nativeCutout=posterCutout.removeBackground;posterCutout.removeBackground=async image=>{const result=await nativeCutout(image);return new Promise(resolve=>window.releaseCutout=()=>resolve(result));};});
 await entry.click();await page.waitForFunction(()=>typeof releaseCutout==='function');assert.equal(await entry.isDisabled(),true);assert.match(await entry.textContent(),/正在抠图/);assert.match(await page.locator('#posterCutoutTarget').textContent(),/正在处理：主图/);
 await page.evaluate(()=>{releaseCutout();posterCutout.removeBackground=nativeCutout;});
 assert.equal(await page.evaluate(()=>posterState.selected.type),'main');await page.waitForFunction(()=>posterState.main.cutout===true);assert.match(await cutout.textContent(),/已抠图.*恢复背景/);
 assert.equal(await entry.isDisabled(),true);assert.equal(await page.locator('#posterCutoutRestore').isVisible(),true);assert.match(await page.locator('#posterCutoutTarget').textContent(),/主图/);
 async function png(name){const pending=page.waitForEvent('download');await page.locator('#posterExportButton').click();const download=await pending,file=path.join(out,name+'.png');await download.saveAs(file);const meta=await sharp(file).metadata();assert.equal(meta.width+'x'+meta.height,await page.locator('#posterResolutionSelect').inputValue());report.exports.push({file:name+'.png',width:meta.width,height:meta.height});}
 await png('main-03-cutout');await page.locator('#posterCutoutRestore').click();assert.equal(await page.evaluate(()=>posterState.main.cutout),false);
 await page.locator('[data-poster-action="hero"]').click();assert.match(await page.locator('#posterCutoutTarget').textContent(),/主图（默认）/);await entry.click();await page.waitForFunction(()=>posterState.main.cutout);assert.equal(await page.evaluate(()=>posterState.selected.type),'main');await page.locator('#posterCutoutRestore').click();
 report.checks.push('Single click cuts out main 03; target shows main/default-main; completed cutout cannot accidentally reverse; separate restore works, including when text was selected');
 const card=await page.evaluate(id=>posterState.secondaries.find(s=>s.imageId===id).id,ids[1]);
 await page.locator('summary').filter({hasText:'海报元素列表'}).evaluate(e=>e.parentElement.open=true);
 await page.locator(`[data-poster-action="select-secondary"][data-id="${card}"]`).click();
 await page.locator('.poster-inspector').evaluate(e=>e.scrollTop=e.scrollHeight);await entry.click();
 assert.equal(await page.evaluate(()=>posterState.selected.id),card);assert.equal(await page.locator('.poster-inspector').evaluate(e=>e.scrollTop),0);
 await page.waitForFunction(id=>posterState.secondaries.find(s=>s.id===id).cutout===true,card);assert.match(await page.locator('#posterCutoutTarget').textContent(),/辅图/);assert.equal(await page.evaluate(()=>posterState.main.cutout),false);
 await png('secondary-20-cutout');await page.screenshot({path:path.join(out,'entry-and-completed-state-1600.png')});
 await page.locator('[data-poster-action="undo"]').first().click();assert.equal(await page.evaluate(id=>posterState.secondaries.find(s=>s.id===id).cutout,card),false);assert.equal(await entry.isDisabled(),false);await page.locator('[data-poster-action="redo"]').first().click();assert.equal(await entry.isDisabled(),true);await page.locator('#posterCutoutRestore').click();assert.equal(await page.evaluate(id=>posterState.secondaries.find(s=>s.id===id).cutout,card),false);
 report.checks.push('Single click cuts out selected secondary 20 and preserves main; separate restore and Undo/Redo synchronize completed/available states');
 for(const width of [900,390]){
  await page.setViewportSize({width,height:1000});await entry.scrollIntoViewIfNeeded();await entry.click();
  await page.waitForFunction(id=>posterState.secondaries.find(s=>s.id===id).cutout,card);
  await page.locator('#posterCutoutRestore').scrollIntoViewIfNeeded();const rect=await page.locator('#posterCutoutRestore').boundingBox();assert.ok(rect.x>=0&&rect.y>=0&&rect.x+rect.width<=width+1&&rect.y+rect.height<=1001,'Cutout button visible after entry click');
  await page.screenshot({path:path.join(out,'direct-controls-'+width+'.png')});await page.locator('#posterCutoutRestore').click();
 }
 assert.deepEqual(report.errors,[]);report.checks.push('Direct cutout and restore controls usable at 900/390; 0 pageerror; only two actual photos');
 fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));console.log('PASS: direct cutout; two actual photos, two PNGs, main/secondary/text selection, independent restore, Undo/Redo and 900/390');
})().catch(e=>{report.failure=e.stack;fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));console.error(e);process.exitCode=1;}).finally(async()=>browser?.close());
