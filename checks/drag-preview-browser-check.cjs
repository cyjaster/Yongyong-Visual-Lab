const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const packages='C:/Users/24369/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const {chromium}=require(packages+'playwright'),sharp=require(packages+'sharp');
const root=path.resolve(__dirname,'..'),out=path.join(root,'samples/results/drag-preview/20261011-blur-fix');
const baseline=execFileSync('git',['show','e5770a9:poster.js'],{cwd:root,encoding:'utf8'});
const manifest=JSON.parse(fs.readFileSync(path.join(root,'samples/aespa/manifest.json'))),samples=[manifest.images[2],manifest.images[19]];
const report={checks:[],performance:[],exports:[],errors:[]};let browser,page;
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
async function settle(p=page){await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
async function select(type,index=0){const value=await page.locator('#posterInspectorTarget option').evaluateAll((items,{type,index})=>items.filter(o=>o.value.startsWith(type+':'))[index].value,{type,index});await page.locator('#posterInspectorTarget').selectOption(value);}
async function control(prop,value){const c=page.locator('[data-prop="'+prop+'"], [data-global="'+prop+'"]').first();const nav=await c.evaluate(e=>({pane:e.closest('[data-inspector-pane]')?.dataset.inspectorPane,effect:e.closest('[data-inspector-effect]')?.dataset.inspectorEffect}));await page.locator('[data-inspector-tab="'+nav.pane+'"]').click();if(nav.effect)await page.locator('#posterInspectorEffect').selectOption(nav.effect);await c.evaluate((e,v)=>{if(e.type==='checkbox')e.checked=v;else e.value=String(v);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));},value);await settle();}
async function png(name,p=page){const pending=p.waitForEvent('download');await p.locator('#posterExportButton').click();const file=path.join(out,name+'.png');await(await pending).saveAs(file);const meta=await sharp(file).metadata();assert.equal(meta.width+'x'+meta.height,await p.locator('#posterResolutionSelect').inputValue());report.exports.push(path.basename(file));return file;}
async function pixels(file){return crypto.createHash('sha256').update(await sharp(file).ensureAlpha().raw().toBuffer()).digest('hex');}
async function canvasHash(p=page,detail=false){return p.evaluate(async detail=>{const d=posterState.details.at(-1),canvas=document.querySelector('#posterCanvas'),c=canvas.getContext('2d');const data=detail?c.getImageData(d.x+10,d.y+10,d.w-20,d.h-20).data:c.getImageData(0,0,canvas.width,canvas.height).data;return [...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(b=>b.toString(16).padStart(2,'0')).join('');},detail);}
async function measure(p){return p.evaluate(async()=>{const create=document.createElement.bind(document),read=CanvasRenderingContext2D.prototype.getImageData;let count=0,reads=0;document.createElement=(name,...args)=>{if(name==='canvas')count++;return create(name,...args)};CanvasRenderingContext2D.prototype.getImageData=function(...args){reads++;return read.apply(this,args)};const timings=[];for(const o of [...document.querySelectorAll('#posterInspectorTarget option')].filter(o=>o.value.startsWith('text:')).slice(0,3)){const c=document.querySelector('#posterInspectorTarget'),start=performance.now();c.value=o.value;c.dispatchEvent(new Event('change',{bubbles:true}));timings.push(performance.now()-start);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));}document.createElement=create;CanvasRenderingContext2D.prototype.getImageData=read;return {selectionMs:timings.map(v=>+v.toFixed(1)),temporaryCanvases:count,pixelReads:reads};});}
async function step(p=page){const tag=await p.locator('#posterMasterRemixTag').textContent(),next=Number(tag.match(/\[(\d+)\//)[1])%8+1;await p.locator('[data-poster-action="master-remix"]').click();await p.waitForFunction(n=>document.querySelector('#posterMasterRemixTag').textContent.includes('['+n+'/8]'),next);return next;}
async function sources(p=page){return p.evaluate(()=>({main:posterState.mainImageId,pool:JSON.stringify(posterState.assets),valid:posterState.secondaries.every(s=>posterState.assets.some(a=>a.id===s.imageId))}));}
async function dragFrame(cancel=false){
 const beforeDetail=await canvasHash(page,true),geometry=await page.evaluate(()=>{const f=posterState.frames.at(-1),r=document.querySelector('#posterCanvas').getBoundingClientRect();return {x:r.x+(f.x+25)*r.width/900,y:r.y+(f.y+25)*r.height/1200,sx:r.width/900,sy:r.height/1200};});
 await page.mouse.move(geometry.x,geometry.y);await page.mouse.down();assert.equal(await page.evaluate(()=>posterState.selected.id),await page.evaluate(()=>posterState.frames.at(-1).id));await settle();
 for(let i=1;i<=6;i++){await page.mouse.move(geometry.x+i*12*geometry.sx,geometry.y+i*7*geometry.sy);await settle();assert.equal(await canvasHash(page,true),beforeDetail,'Detail stays frozen until release');}
 if(cancel==='blur'){
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await settle();
  assert.notEqual(await canvasHash(page,true),beforeDetail,'Window blur updates final sampling immediately');
  const history=await page.evaluate(()=>JSON.stringify(posterHistory));
  await page.mouse.up();await settle();
  assert.equal(await page.evaluate(()=>JSON.stringify(posterHistory)),history,'Pointerup after blur must not commit twice');
 }else{if(cancel)await page.locator('#posterCanvas').dispatchEvent('pointercancel',{pointerId:1});await page.mouse.up();await settle();}
 assert.notEqual(await canvasHash(page,true),beforeDetail,'Final sampling updates on release/cancel/blur');
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 page=await browser.newPage({viewport:{width:1600,height:1100},acceptDownloads:true});page.setDefaultTimeout(60000);page.on('dialog',d=>d.accept());page.on('pageerror',e=>report.errors.push(e.message));
 const old=await browser.newPage({viewport:{width:1600,height:1100},acceptDownloads:true});old.setDefaultTimeout(60000);old.on('dialog',d=>d.accept());await old.route('**/poster.js?*',r=>r.fulfill({contentType:'application/javascript',body:baseline}));
 for(const p of [page,old]){await p.goto('http://localhost:8089/?check=drag-preview#poster');await p.waitForFunction(()=>window.posterState?.image?.complete);await p.locator('#posterMotionPreference').selectOption('off');}
 for(const n of [1,5,8]){
  if(n!==1)for(const p of [page,old]){await p.locator('[data-poster-action="demo-0'+n+'"]').click();await p.waitForFunction(n=>document.querySelector('#posterMasterRemixTag').textContent.includes('['+n+'/8]'),n);}
  assert.equal(await canvasHash(),await canvasHash(old),'Preview retains original pixels for template '+n);
  const before=await measure(old),after=await measure(page);assert.equal(after.temporaryCanvases,0,'Unchanged photos create no new raster surfaces');assert.equal(after.pixelReads,0,'Selecting text does not reread photo pixels');report.performance.push({template:n,before,after});
  assert.equal(await pixels(await png('baseline-demo-0'+n,old)),await pixels(await png('optimized-demo-0'+n)),'Actual PNG is unchanged');console.log('PASS pixels and performance template '+n,JSON.stringify({before,after}));
 }
 await old.close();
 for(const list of [[samples[0]],[samples[1]],samples]){
  await page.locator('[data-poster-action="demo"]').click();await page.waitForFunction(()=>document.querySelector('#posterMasterRemixTag').textContent.includes('[1/8]'));
  await page.locator('#posterImageInput').setInputFiles(list.map(a=>path.join(root,'samples/aespa',a.original)));await page.waitForFunction(count=>posterHasUserUploadedImages()&&posterState.assets.length===count,list.length);
  const initial=await sources();for(let i=0;i<8;i++){await step();assert.deepEqual(await sources(),initial);}
  if(list.length===2){const id=await page.evaluate(()=>posterState.assets[1].id);await page.locator('[data-asset-id="'+id+'"] [data-tray-action="set-main"]').click();const swapped=await sources();for(let i=0;i<8;i++){await step();assert.deepEqual(await sources(),swapped);}}
  await select('main');await page.locator('[data-poster-action="frame"]').click();await control('x',260);await control('y',260);await control('w',100);await control('h',110);await control('rotation',0);await page.locator('[data-poster-action="detail"]').first().click();await control('x',650);await control('y',780);await control('w',200);await control('h',230);await control('rotation',0);await control('filterType','color_halftone');await control('halftoneStrength',90);
  const label=list.map(a=>a.id).join('-'),base=await png(label+'-before');await select('frame',await page.evaluate(()=>posterState.frames.length-1));await dragFrame();const final=await png(label+'-released');assert.notEqual(await pixels(final),await pixels(base));await page.locator('[data-poster-action="undo"]').first().click();assert.equal(await pixels(await png(label+'-undo')),await pixels(base));await page.locator('[data-poster-action="redo"]').first().click();assert.equal(await pixels(await png(label+'-redo')),await pixels(final));
  await select('frame',await page.evaluate(()=>posterState.frames.length-1));await dragFrame(true);await png(label+'-cancel');
  const beforeBlur=await png(label+'-before-blur');await select('frame',await page.evaluate(()=>posterState.frames.length-1));await dragFrame('blur');const blurred=await png(label+'-blur');await page.locator('[data-poster-action="undo"]').first().click();assert.equal(await pixels(await png(label+'-blur-undo')),await pixels(beforeBlur));await page.locator('[data-poster-action="redo"]').first().click();assert.equal(await pixels(await png(label+'-blur-redo')),await pixels(blurred));
  await select('detail',await page.evaluate(()=>posterState.details.length-1));const preview=await canvasHash();await control('halftoneStrength',0);assert.notEqual(await canvasHash(),preview,'Changed filters invalidate preview cache');await control('halftoneStrength',90);
  await page.locator('#posterResolutionSelect').selectOption('3000x4000');await png(label+'-3000x4000');await page.locator('#posterResolutionSelect').selectOption('1200x1600');const draft=await png(label+'-draft');await page.locator('#posterSaveDraftButton').click();await page.waitForFunction(()=>!posterDraftPending());await page.reload();await page.waitForFunction(()=>window.posterState?.image?.complete);assert.equal(await pixels(await png(label+'-draft-restored')),await pixels(draft));await page.locator('#posterMotionPreference').selectOption('off');console.log('PASS drag/upload '+label);
 }
 for(const width of [968,390]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
 for(const a of samples)assert.equal(hash(path.join(root,'samples/aespa',a.original)),a.sha256);assert.deepEqual(report.errors,[]);report.checks.push('Original preview/export pixels, text selection avoids photo rasterization, linked-frame deferred drag/release/cancel, filter zero invalidation, exact history, high-resolution, draft and 03/20 upload retention');fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));console.log('PASS: '+report.exports.length+' actual PNGs');
})().catch(e=>{report.failure=e.stack;fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));console.error(e);process.exitCode=1;}).finally(async()=>browser?.close());

