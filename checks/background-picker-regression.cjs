const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '../poster.js'), 'utf8');
const pickerSource = source.slice(source.indexOf('const backgroundStyles ='), source.indexOf('const accordion ='));
let tigerDraws = 0, chromeDraws = 0;
const state = { backgroundStyle: 'pink-paper', background: '#f6f1f4' };
const context = vm.createContext({ state, W: 900, H: 1200, escapeHTML: value => value,
  document: { createElement: () => ({ getContext: () => ({ scale() {} }), toDataURL: () => 'data:image/png;base64,dGlnZXI=' }) },
  drawElectricTigerPattern: () => tigerDraws++,
  window: { posterLiquidChrome: { renderToCanvas: () => { chromeDraws++; return { toDataURL: () => 'data:image/png;base64,Y2hyb21l' }; } } }
});
vm.runInContext(pickerSource, context);
const markup = vm.runInContext('backgroundStylePicker()', context);
assert.equal((markup.match(/data-global="backgroundStyle"/g) || []).length, 11);
assert.equal((markup.match(/aria-pressed="true"/g) || []).length, 1);
assert.match(markup, /data-val="pink-paper" aria-pressed="true"/);
assert.equal((markup.match(/<img /g) || []).length, 2);
vm.runInContext('backgroundStylePicker()', context);
assert.equal(tigerDraws, 1, 'Preview rendering is cached across inspector rebuilds');
assert.equal(chromeDraws, 1, 'Preview uses a separate static render, not the export cache');
assert.equal(state.backgroundStyle, 'pink-paper', 'Generating thumbnails does not change the artwork');
state.backgroundStyle = 'grid';
assert.match(vm.runInContext('backgroundStylePicker()', context), /data-val="grid" aria-pressed="true"/);
console.log('PASS: 11 labeled previews, selected state, isolated cached texture previews, and no artwork mutation');
