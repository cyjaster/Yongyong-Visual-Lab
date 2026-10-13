// Exercise the moved controls and check their geometry at the reported viewport.
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const packages='C:/Users/24369/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const {chromium}=require(packages+'playwright'),sharp=require(packages+'sharp');
const root=path.resolve(__dirname,'..'),out=process.env.TOOLBAR_CHECK_OUT||path.join(root,'samples/results/toolbar-20261010');
const base=process.env.POSTER_BASE_URL||'http://localhost:8089/';
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try {
  const page=await browser.newPage({viewport:{width:968,height:800},acceptDownloads:true}),errors=[];
  page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.goto(base+'?toolbar=20261010#poster');await page.waitForFunction(()=>window.posterState?.image?.complete);
  await page.locator('#posterMotionPreference').selectOption('off');
  for(const width of [1280,968,900,390]){
   await page.setViewportSize({width,height:800});await page.locator('[data-zoom-action="fit"]').click();
   const geometry=await page.evaluate(()=>{
    const dock=document.querySelector('.poster-action-dock'),side=document.querySelector('.poster-tools-content'),stage=document.querySelector('.poster-stage'),vp=document.querySelector('#posterViewport');
    const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,height:r.height};};
    const d=rect(dock);return {inStage:stage.contains(dock),masters:document.querySelectorAll('[data-poster-action="master-remix"]').length,overflow:document.documentElement.scrollWidth>innerWidth,dock:d,side:rect(side),viewport:rect(vp),card:rect(document.querySelector('#posterCanvasWrap')),buttons:[...dock.querySelectorAll('button:not([hidden])')].map(e=>({...rect(e),text:e.textContent.trim()}))};
   });
   assert.equal(geometry.inStage,true);assert.equal(geometry.masters,1);assert.equal(geometry.overflow,false);
   assert.ok(geometry.dock.bottom<=geometry.viewport.top,'Toolbar must not overlap canvas');
   assert.ok(geometry.card.top>=geometry.viewport.top-1&&geometry.card.bottom<=geometry.viewport.bottom+1,'FIT must show the complete artwork');
   if(width>820)assert.ok(geometry.dock.height<=100,'Compact toolbar must stay within 100px');
   if(width>820){assert.ok(geometry.side.height>650,'Sidebar must use the full available height');assert.ok(geometry.side.right<=geometry.dock.left);}
   for(const b of geometry.buttons){assert.ok(b.left>=geometry.dock.left-1&&b.right<=geometry.dock.right+1,b.text+' must fit toolbar');}
   await page.locator('.poster-stage-topline').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'toolbar-'+width+'.png')});
  }
  await page.setViewportSize({width:968,height:800});
  const count=()=>page.evaluate(()=>posterState.texts.length);
  const before=await count();await page.locator('[data-poster-action="hero"]').click();assert.equal(await count(),before+1);
  await page.locator('.poster-header-history [data-poster-action="duplicate"]').click();assert.equal(await count(),before+2);
  await page.locator('.poster-header-history [data-poster-action="undo"]').click();assert.equal(await count(),before+1);
  await page.locator('.poster-header-history [data-poster-action="redo"]').click();assert.equal(await count(),before+2);
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'samples/aespa/manifest.json')));
  await page.locator('#posterImageInput').setInputFiles([2,19].map(i=>path.join(root,'samples/aespa',manifest.images[i].original)));
  await page.waitForFunction(()=>posterHasUserUploadedImages()&&posterState.assets.length===2);
  const sources=()=>page.evaluate(()=>({main:posterState.mainImageId,assets:JSON.stringify(posterState.assets)}));const initial=await sources();
  for(let i=0;i<8;i++){const prev=await page.locator('#posterMasterRemixTag').textContent();await page.locator('[data-poster-action="master-remix"]').click();await page.waitForFunction(p=>document.querySelector('#posterMasterRemixTag').textContent!==p,prev);assert.deepEqual(await sources(),initial);}
  await page.locator('[data-poster-action="select-main"]').first().click();
  if(await page.evaluate(()=>posterState.main.cutout))await page.locator('#posterCutoutRestore').click();
  await page.locator('#posterCutoutEntry').click();await page.waitForFunction(()=>!!posterState.main.cutout);
  await page.locator('#posterCutoutRestore').click();await page.waitForFunction(()=>!posterState.main.cutout);
  await page.locator('#posterSaveDraftButton').click();await page.waitForFunction(()=>!posterDraftPending());
  const download=page.waitForEvent('download');await page.locator('#posterExportButton').click();const file=path.join(out,'toolbar-export.png');await(await download).saveAs(file);
  const meta=await sharp(file).metadata();assert.equal(meta.width+'x'+meta.height,await page.locator('#posterResolutionSelect').inputValue());
  assert.deepEqual(errors,[]);console.log('PASS: toolbar geometry at 1280/968/900/390, one master REMIX, copy/history, two-upload retention across eight templates, cutout/restore, draft and actual PNG.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
