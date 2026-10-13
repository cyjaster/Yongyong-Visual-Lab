const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const handlers = {}, windowHandlers = {}, timers = [];
const element = () => ({ classList: { values: new Set(),
  add(...names) { names.forEach(name => this.values.add(name)); },
  remove(...names) { names.forEach(name => this.values.delete(name)); }
} });
const output = element(), field = element(), button = element(), cursor = element();
field.querySelector = () => output;
const source = fs.readFileSync(path.join(__dirname, '../sidebar-motion.js'), 'utf8');
const feedback = source.slice(source.indexOf('const pressedControls'), source.indexOf('// --- 4.'));
vm.runInNewContext(feedback.slice(0, feedback.lastIndexOf('}')), {
  cursorWrap: cursor, Set,
  document: { addEventListener(type, handler) { handlers[type] = handler; } },
  window: { addEventListener(type, handler) {
    assert.equal(windowHandlers[type], undefined, 'One shared release handler per event');
    windowHandlers[type] = handler;
  } },
  clearTimeout() {}, setTimeout(fn) { timers.push(fn); }
});
const range = { closest: () => field, matches: () => true };
const rangeEvent = { target: { closest: selector => selector === 'input[type="range"]' ? range : null } };
for (let rebuild = 0; rebuild < 40; rebuild++) {
  handlers.pointerdown(rangeEvent);
  assert.ok(field.classList.values.has('is-sliding'));
  assert.ok(output.classList.values.has('is-active'));
  windowHandlers.pointerup();
  assert.equal(field.classList.values.size, 0);
  assert.equal(output.classList.values.size, 0);
}
handlers.input({ target: range });
assert.ok(output.classList.values.has('is-active'));
timers.at(-1)();
assert.equal(output.classList.values.size, 0);
for (const release of ['pointerup', 'pointercancel', 'blur']) {
  handlers.pointerdown({ target: { closest: selector => selector === 'input[type="range"]' ? null : button } });
  assert.ok(button.classList.values.has('is-pressed'));
  windowHandlers[release]();
  assert.equal(button.classList.values.size, 0);
}
assert.equal(Object.keys(windowHandlers).length, 3, 'Window bindings stay constant across rebuilt controls');
console.log('PASS: rebuilt controls share release listeners; slider, button, cancel and blur feedback reset');
