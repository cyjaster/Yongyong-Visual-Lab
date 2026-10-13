const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '..');
function preview(args, occupiedBody, browserFailure, port) {
  let opened = 0, bound, requestUrl;
  const handlers = {}, process = { argv:args, env:port === undefined ? {} : {PORT:port} };
  const server = {
    on(event, callback) { handlers[event] = callback; },
    listen(port, address, ready) { bound = [port,address]; if (occupiedBody === undefined) ready(); else handlers.error({code:'EADDRINUSE'}); }
  };
  const http = {
    createServer:() => server,
    get(url, callback) {
      requestUrl = url;
      callback({statusCode:200,setEncoding(){},on(event, fn){ if(event === 'data')fn(occupiedBody); if(event === 'end')fn(); }});
      return {on(){}};
    }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'serve-local.cjs'),'utf8'), {
    __dirname,process,console:{log(){},error(){}},
    require:name => name === 'node:http' ? http : name === 'node:child_process' ? {
      spawn(command,args,options) {
        assert.equal(command,'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'); assert.deepEqual(Array.from(args),['http://127.0.0.1:8089/#poster']);
        assert.equal(options.windowsHide,true); assert.equal(options.stdio,'inherit'); opened++;
        return {on(event,callback){ if(event === 'error' && browserFailure === 'spawn')callback(new Error('denied')); if(event === 'exit' && browserFailure === 'exit')callback(1); }};
      }
    } : require(name)
  });
  assert.deepEqual(bound,[Number(port || 8089),'127.0.0.1']);
  return {opened,process,requestUrl};
}
(async () => {
  assert.equal(preview([]).opened,0);
  assert.equal(preview([],undefined,undefined,'8090').opened,0);
  assert.throws(() => preview([],undefined,undefined,'NaN'), /PORT/);
  assert.throws(() => preview([],undefined,undefined,'65536'), /PORT/);
  assert.equal(preview(['--open']).opened,1);
  assert.equal(preview(['--open'],fs.readFileSync(path.join(root,'index.html'),'utf8')).opened,1);
  const wrong = preview(['--open'],'another site');
  assert.equal(wrong.opened,0); assert.equal(wrong.process.exitCode,1);
  assert.equal(preview(['--open'],undefined,'spawn').process.exitCode,1);
  assert.equal(preview(['--open'],fs.readFileSync(path.join(root,'index.html'),'utf8'),'exit').process.exitCode,1);
  let pixelReads = 0;
  const window = {location:{protocol:'file:'},PosterPixels:{normalize(){pixelReads++;}}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'poster-cutout.js'),'utf8'),{window});
  await assert.rejects(window.posterCutout.removeBackground({}),/打开网站.cmd/);
  assert.equal(pixelReads,0,'file mode stops before tainting a canvas or loading the model');
  const html = fs.readFileSync(path.join(root,'index.html'),'utf8');
  const notice = html.match(/<script>(document.getElementById\('localFileNotice'\).*?)<\/script>/)[1];
  for (const protocol of ['file:','http:','https:']) {
    const node = {hidden:true};
    vm.runInNewContext(notice,{location:{protocol},document:{getElementById:()=>node}});
    assert.equal(node.hidden,protocol !== 'file:');
  }
  console.log('PASS: loopback startup, browser open, same-site reuse, port conflict, file-mode notice and safe cutout refusal');
})().catch(error => { console.error(error); process.exitCode = 1; });
