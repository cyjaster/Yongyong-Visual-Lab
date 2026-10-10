const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
let draws=0,reads=0;
const original=new Uint8ClampedArray([12,34,56,255,78,90,123,255]);
const context={drawImage(){draws++;},getImageData(){reads++;return {data:original.slice(),width:2,height:1};},putImageData(){}};
const window={};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../poster-pixels.js'),'utf8'),{
 window,Uint8ClampedArray,document:{createElement:()=>({getContext:()=>context})},
 ImageData:class{constructor(data,width,height){Object.assign(this,{data,width,height});}}
});
const image={naturalWidth:2,naturalHeight:1};
const canvas=window.PosterPixels.normalize(image);
assert.equal(window.PosterPixels.normalize(image),canvas);
assert.equal(window.PosterPixels.normalize(canvas),canvas);
const first=window.PosterPixels.copyPixels(image);first.data[3]=0;
assert.deepEqual([...window.PosterPixels.copyPixels(canvas).data],[...original]);
assert.equal(draws,1);assert.equal(reads,1,'Segmentation copies pixels without touching the rendered source again');
assert.equal(canvas.naturalWidth,2);assert.equal(canvas.naturalHeight,1);
assert.equal(window.PosterPixels.normalize(null),null);
console.log('PASS: decoded source is cached once; cutout pixels are independent copies; natural dimensions remain compatible');
