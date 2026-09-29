// Run with: node checks/editor-regression.cjs (no dependencies).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../poster.js'), 'utf8');
const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const context = vm.createContext({ assert, setTimeout, clearTimeout });
vm.runInContext(`
  let state = { value: 0, main: { id: 'main-image' }, frames: [] };
  let history = [], historyIndex = -1, historyTimer = 0;
  const snapshot = () => JSON.stringify(state);
  const toast = () => {};
  const restore = (index) => { state = JSON.parse(history[index]); historyIndex = index; };
  ${section('  function commit(', '  function markManuallyEdited(')}
  ${section('  function undo()', '  function getCover()')}
  commit(); state.value = 1; commit(false); undo();
  assert.equal(state.value, 0, 'Immediate undo must preserve the pending edit for redo');
  redo(); assert.equal(state.value, 1);
  undo(); state.value = 2; commit(false); redo();
  assert.equal(state.value, 2, 'A new edit must invalidate the old redo branch');
  assert.equal(historyTimer, 0);
  const synced = [];
  const syncFrameAbsoluteFromParent = (frame) => synced.push(frame.id);
  ${section('  function syncAllChildFramesOf(', '  function renderImageTray(')}
  state.frames = [{id: 'a', sourceId: 'main'}, {id: 'b', sourceId: 'secondary'}];
  syncAllChildFramesOf('main-image'); assert.equal(synced.join(), 'a');
  ${source.split('\n').find(line => line.includes('const escapeHTML ='))}
  assert.equal(escapeHTML('<tag a="x">&'), '&lt;tag a=&quot;x&quot;&gt;&amp;');
  ${section('  const field =', '  const toggle =')}
  const input = field('标题', 'Title', 'content', 'a" autofocus="yes');
  assert.ok(input.includes('value="a&quot; autofocus=&quot;yes"'));
  const area = field('标题', 'Title', 'content', '</textarea><img>', 'textarea');
  assert.ok(area.includes('&lt;/textarea&gt;&lt;img&gt;'));
`, context);
console.log('PASS: pending undo/redo, redo branching, main-frame sync, safe text fields');
