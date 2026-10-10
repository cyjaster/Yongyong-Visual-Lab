'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../poster.js'),'utf8');
const code=source.slice(source.indexOf('  let cutoutBusy = false;'),source.indexOf('  function renderInspector()'));
function harness(type='main') {
  const original={naturalWidth:736,naturalHeight:1472},other={naturalWidth:1200,naturalHeight:1602};
  const state={image:original,mainImageId:'upload-1',main:{id:'main-image',cutout:false},assets:[{id:'upload-1',name:'photo.jpg'},{id:'upload-2',name:'other.jpg'}],secondaries:[{id:'card-1',imageId:'upload-2',cutout:false}],selected:{type}};
  const imageAssets=new Map([['upload-1',{id:'upload-1',origin:'upload',image:original}],['upload-2',{id:'upload-2',origin:'upload',image:other}]]);
  let resolve,reject,requests=0,commits=0;const toasts=[];
  const context=vm.createContext({state,imageAssets,console,window:{posterCutout:{removeBackground(){requests++;return new Promise((a,b)=>{resolve=a;reject=b});}}},selectedObject:()=>state.selected.type==='main'?state.main:state.secondaries[0],renderInspector(){},render(){},commit(){commits++;},markManuallyEdited(){},toast:m=>toasts.push(m)});
  vm.runInContext(code,context);
  return {state,imageAssets,context,original,other,toasts,resolve:value=>resolve(value),reject:e=>reject(e),requests:()=>requests,commits:()=>commits,run:()=>context.togglePersonCutout()};
}
(async()=>{
  for(const type of ['main','secondary']){
    const h=harness(type),pool=JSON.stringify(h.state.assets),id=type==='main'?'upload-1':'upload-2',object=type==='main'?h.state.main:h.state.secondaries[0];
    const pending=h.run(),alpha={naturalWidth:736,naturalHeight:1472};await h.run();assert.equal(h.requests(),1,'duplicate click does not start another inference');h.resolve(alpha);await pending;
    assert.equal(object.cutout,true);assert.equal(h.imageAssets.get(id).cutoutImage,alpha);assert.equal(h.state.image,h.original);assert.equal(JSON.stringify(h.state.assets),pool);assert.equal(h.imageAssets.get(id).origin,'upload');assert.equal(h.commits(),1);
    await h.run();assert.equal(object.cutout,false);assert.equal(h.imageAssets.get(id).cutoutImage,alpha);await h.run();assert.equal(object.cutout,true);assert.equal(h.requests(),1,'cached result re-enables without inference');console.log('PASS: '+type+' original identity / cached cutout / restore / duplicate-click guard');
  }
  {const h=harness();const pending=h.run();h.state.main={id:'main-image'};h.state.mainImageId='upload-2';h.resolve({});await pending;assert.equal(h.state.main.cutout,undefined);assert.equal(h.imageAssets.get('upload-1').cutoutImage,undefined);assert.equal(h.commits(),0);console.log('PASS: late result cannot overwrite a switched scene or photo');}
  {const h=harness('secondary');const pending=h.run();h.state.secondaries=[];h.resolve({});await pending;assert.equal(h.commits(),0);console.log('PASS: deleted card is not restored by a late cutout');}
  {const h=harness();const pending=h.run();h.reject(new Error('model missing'));await pending;assert.equal(h.state.main.cutout,false);assert.equal(h.state.image,h.original);assert.equal(h.commits(),0);const retry=h.run();assert.equal(h.requests(),2);h.resolve({});await retry;assert.equal(h.state.main.cutout,true);console.log('PASS: failed model preserves the photo and can be explicitly retried');}
  {let callback,applied=0;const state={mainImageId:'old',main:{x:100},assets:[]};const context={state,history:[],window:{confirm:()=>true},hasUserUploadedImages:()=>false,hasSecondaryImages:()=>false,snapshot:()=>JSON.stringify(state),ensureBlueValentineAssets:fn=>{callback=fn;},applyMasterRemixByIndex:()=>{applied++;},toast:()=>{}};vm.runInNewContext(source.slice(source.indexOf('  function loadDemo03('),source.indexOf('  const layoutTemplates =')),context);context.loadDemo03(true);state.mainImageId='new-upload';callback();assert.equal(applied,0,'loading demo cannot replace a newer upload');context.loadDemo03(true);state.main.x=250;callback();assert.equal(applied,0,'loading demo cannot replace a newer edit');context.loadDemo03(true);callback();assert.equal(applied,1);console.log('PASS: delayed library demo preserves newer uploads and edits');}
  {
    const state={image:{src:'original-1'},mainImageId:'one',assets:[{id:'one'},{id:'two'}],main:{x:1}};
    const originals=[state.image,{src:'original-2'}],imageAssets=new Map([['one',{image:originals[0]}],['two',{image:originals[1]}]]);
    let applied=0,calls=0,resolve,reject;const toasts=[];
    const context={state,imageAssets,snapshot:()=>JSON.stringify(state),toast:m=>toasts.push(m),console:{warn(){}},window:{posterCutout:{removeBackground:()=>{calls++;return new Promise((a,b)=>{resolve=a;reject=b;});}}}};
    const start=source.indexOf('  function narrativeReady('),end=source.indexOf('  function hasUserUploadedImages()',start);vm.runInNewContext(source.slice(start,end),context);
    assert.equal(context.narrativeReady(6),true);assert.equal(context.narrativeReady(7),false);
    const before=JSON.stringify(state),failed=context.prepareNarrative(()=>applied++,7);reject(new Error('model unavailable'));await failed;
    assert.equal(applied,0);assert.equal(JSON.stringify(state),before);assert.ok(toasts.length);
    const late=context.prepareNarrative(()=>applied++,7);state.main.x=200;resolve({src:'alpha-1'});await new Promise(setImmediate);assert.equal(calls,3);resolve({src:'alpha-2'});await late;
    assert.equal(applied,0,'late segmentation cannot replace a newer edit');assert.equal(state.main.x,200);
    assert.equal(context.narrativeReady(7),true,'prepared alpha stays cached for an explicit retry');
    await context.prepareNarrative(()=>applied++,7);assert.equal(applied,1);assert.equal(calls,3,'retry reuses both cached cutouts');
    assert.equal(imageAssets.get('one').image,originals[0]);assert.equal(imageAssets.get('two').image,originals[1]);
    console.log('PASS: narrative preparation failure, late edit guard, two-source cache, explicit retry and original preservation');
  }
})().catch(e=>{console.error(e);process.exitCode=1});
