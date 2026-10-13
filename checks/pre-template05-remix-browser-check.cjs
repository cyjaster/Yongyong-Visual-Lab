// Current demo photos are also user-visible work: REMIX may never replace them.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const packages='C:/Users/24369/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const {chromium}=require(packages+'playwright'),sharp=require(packages+'sharp');
const out=path.resolve(__dirname,'../samples/results/pre-template05-20261009/remix-preservation');
const report={samples:['aespa-03','aespa-20'],checks:[],exports:[],errors:[],remote:[]};let browser;
fs.mkdirSync(out,{recursive:true});
(async()=>{
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const page=await browser.newPage({viewport:{width:1600,height:1100},acceptDownloads:true});let acceptDemo=true;
 page.on('dialog',d=>acceptDemo?d.accept():d.dismiss());page.on('pageerror',e=>report.errors.push(e.message));
 page.on('request',r=>{if(!r.url().startsWith('http://localhost:8089/')&&!r.url().startsWith('data:'))report.remote.push(r.url());});
 await page.goto('http://localhost:8089/#poster'); await page.evaluate(() => window.visualLab?.enterEdit());await page.waitForFunction(()=>posterState?.image?.complete);
 await page.locator('#posterMotionPreference').selectOption('off');await page.locator('[data-poster-action="demo-04"]').click();
 await page.waitForFunction(()=>posterState.remixInfo.anchorEn==='Pink Desktop'&&posterState.secondaries[0].cutout);
 const sources=()=>page.evaluate(()=>({main:posterState.mainImageId,pool:posterState.assets.map(a=>({...a,src:posterImageAssets.get(a.id).image.src})),uploaded:posterHasUserUploadedImages()}));
 const initial=await sources();assert.equal(initial.main,'asset-pink-hero');assert.equal(initial.uploaded,false);
 async function png(name){const pending=page.waitForEvent('download');await page.locator('#posterExportButton').click();const download=await pending,file=path.join(out,name+'.png');await download.saveAs(file);const meta=await sharp(file).metadata();assert.equal(meta.width+'x'+meta.height,await page.locator('#posterResolutionSelect').inputValue());report.exports.push({file:name+'.png',width:meta.width,height:meta.height});return sharp(file).ensureAlpha().raw().toBuffer();}
 const before=await png('current-demo04');await page.locator('[data-poster-action="master-remix"]').first().click();
 assert.deepEqual(await sources(),initial);const after=await png('remix-template01');
 await page.locator('[data-poster-action="undo"]').first().click();assert.deepEqual(await sources(),initial);assert.ok(before.equals(await png('undo-template04')));
 await page.locator('[data-poster-action="redo"]').first().click();assert.deepEqual(await sources(),initial);assert.ok(after.equals(await png('redo-template01')));
 for(let i=1;i<4;i++){
  await page.locator('[data-poster-action="master-remix"]').first().click();
  await page.waitForFunction(n=>document.querySelector('#posterMasterRemixTag').textContent.includes('['+(n+1)+'/4]'),i);
  assert.deepEqual(await sources(),initial);await png('remix-template0'+(i+1));
  assert.equal(await page.evaluate(()=>posterState.secondaries.every(s=>posterState.assets.some(a=>a.id===s.imageId))),true);
 }
 assert.equal(await page.evaluate(()=>posterState.remixInfo.anchorEn),'Pink Desktop');
 report.checks.push('Demo04 current two photos keep identical main ID, original sources, pool and demo provenance through all four total REMIX templates; Undo/Redo restore exact PNG');
 for(let i=0;i<4;i++){await page.locator('[data-poster-action="remix"]').first().click();assert.deepEqual(await sources(),initial);}
 if(await page.locator('#posterDeselectButton').isVisible())await page.locator('#posterDeselectButton').click();
 await page.locator('[data-poster-action="filter-remix"]').click();assert.deepEqual(await sources(),initial);
 report.checks.push('Layout-only and filter-only REMIX also preserve current photos; no new demo photography is requested by the cycling actions');
 await page.locator('[data-asset-id="asset-pink-portrait"] [data-tray-action="set-main"]').click();
 const swapped=await sources();assert.equal(swapped.main,'asset-pink-portrait');
 for(let i=0;i<4;i++){await page.locator('[data-poster-action="master-remix"]').first().click();if(i===3)await page.waitForFunction(()=>posterState.remixInfo.anchorEn==='Pink Desktop');assert.deepEqual(await sources(),swapped);}
 acceptDemo=false;await page.locator('[data-poster-action="demo-04"]').click();assert.deepEqual(await sources(),swapped);
 acceptDemo=true;await page.locator('[data-poster-action="demo-04"]').click();await page.waitForFunction(()=>posterState.mainImageId==='asset-pink-hero');assert.deepEqual(await sources(),initial);
 report.checks.push('Promoting existing demo03 photo keeps it through another full cycle; cancel demo loading is neutral; only explicitly confirmed demo04 resets photos');
 assert.match(await page.locator('#posterMasterRemixSub').textContent(),/保留当前图片/);assert.equal(await page.getByText('示范作品 · 会更换图片和排版',{exact:true}).count(),1);
 await page.locator('#posterResolutionSelect').selectOption('3000x4000');await png('preserved-photos-3000x4000');
 await page.screenshot({path:path.join(out,'remix-and-demo-separate-1600.png')});
 await page.locator('#posterSaveDraftButton').click();await page.waitForFunction(()=>!posterDraftPending());await page.reload();await page.waitForFunction(()=>posterState?.mainImageId==='asset-pink-hero');assert.deepEqual(await sources(),initial);
 assert.equal(await page.locator('#posterResolutionSelect').inputValue(),'3000x4000');assert.deepEqual(report.errors,[]);assert.deepEqual(report.remote,[]);
 report.checks.push('UI names distinguish changing composition from loading demo photos; high-resolution output and draft reload preserve photos; 0 pageerror and external requests');
 fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));console.log('PASS: demo and current-photo preservation; '+report.exports.length+' actual PNGs; '+report.checks.length+' scenarios');
})().catch(e=>{report.failure=e.stack;fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));console.error(e);process.exitCode=1;}).finally(async()=>browser?.close());
