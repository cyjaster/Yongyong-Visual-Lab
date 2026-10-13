// Real uploads and PNG downloads; only the two agreed gallery samples.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const packages='C:/Users/24369/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const {chromium}=require(packages+'playwright'),sharp=require(packages+'sharp');
const root=path.resolve(__dirname,'..'),out=path.join(root,'samples/results/template-07-08/20261010-text-fix');
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
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  page=await browser.newPage({viewport:{width:1280,height:1000},acceptDownloads:true});page.setDefaultTimeout(60000);page.on('dialog',d=>d.accept());page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto('http://localhost:8089/#poster'); await page.evaluate(() => window.visualLab?.enterEdit());await page.waitForFunction(()=>posterState?.image?.complete);await page.locator('#posterMotionPreference').selectOption('off');
  await demo(8);const base=await png('demo-08');
  const layout=await page.evaluate(()=>{
    const ctx=document.createElement('canvas').getContext('2d'),captions=['PERSONAL ARCHIVE','Keep the moments.\nMake them yours.','A PHOTO DIARY','Saved for later.'];
    const box=t=>{
      ctx.font=`${t.weight} ${t.size}px ${t.font}`;const lines=t.content.split('\n');return {x:t.x,y:t.y,w:Math.max(...lines.map(l=>ctx.measureText(l).width+Math.max(0,l.length-1)*(t.letterSpacing||0))),h:lines.length*t.size*t.lineHeight};
    };
    const panels=posterState.texts.filter(t=>t.badgeShape==='profile-card').map(t=>{
      const w=t.badgeWidth,h=t.badgeHeight,a=t.rotation*Math.PI/180,cx=t.x+w/2,cy=t.y+h/2,rw=Math.abs(w*Math.cos(a))+Math.abs(h*Math.sin(a)),rh=Math.abs(w*Math.sin(a))+Math.abs(h*Math.cos(a));return {x:cx-rw/2,y:cy-rh/2,w:rw,h:rh};
    });
    return {captions:captions.map(c=>({content:c,...box(posterState.texts.find(t=>t.content===c))})),panels,old:posterState.texts.some(t=>['bring','someone’s','own','overtaking.'].includes(t.content)),punctuation:posterState.texts.filter(t=>t.content==='!!!').map(t=>t.font)};
  });
  assert.equal(layout.old,false);assert.ok(layout.punctuation.every(f=>f==='Arial, sans-serif'));
  for(const a of layout.captions)for(const b of layout.panels)assert.equal(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y,false,a.content+' must remain outside profile text panels');
  report.checks.push('All four complete caption groups avoid both rotated profile panels; old scattered fragments removed; explicit readable punctuation font');
  const i=await page.evaluate(()=>posterState.texts.findIndex(t=>t.content==='Keep the moments.\nMake them yours.'));await selectText(i);await control('content','Keep my photos.\nMake them mine.');await png('caption-edited');await page.locator('[data-poster-action="undo"]').first().click();await same(base,await png('caption-undo'));report.checks.push('New two-line caption remains editable; undo restores the exact PNG');
  for(const a of samples){assert.equal(hash(original(a)),a.sha256);await uploaded(8,[a]);assert.equal(await page.evaluate(()=>posterState.imageName),a.filename);await png('single-'+a.id);assert.equal(hash(original(a)),a.sha256);}report.checks.push('Only 03/20 real upload checks; original hashes preserved');
  await demo(8);await page.locator('#posterResolutionSelect').selectOption('3000x4000');await png('demo-08-3000x4000');await page.locator('#posterResolutionSelect').selectOption('1200x1600');
  await demo(7);const toolbar=await page.evaluate(()=>posterState.texts.findIndex(t=>t.content.includes('Boomerang')));await selectText(toolbar);await control('backgroundOpacity',0);const other=await png('demo-07');await same(other,path.join(root,'samples/results/template-07-08/20261010/demo-07.png'));report.checks.push('Actual default and high-resolution PNG; template 7 legacy pixels unchanged when new toolbar backing is off');
  assert.deepEqual(report.errors,[]);fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({...report,layout},null,2));console.log('PASS: '+report.exports.length+' actual PNGs; caption placement, edit/undo, two uploads and unchanged template 7');
})().catch(e=>{report.failure=e.stack;fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));console.error(e);process.exitCode=1;}).finally(async()=>browser?.close());
