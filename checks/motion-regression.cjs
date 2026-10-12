// Run: node checks/motion-regression.cjs
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const listeners = {};
const active = [];
const workspace = { dataset: {} };
const body = { dataset: {} }, timers = new Map(); let timerId = 0;
const eventTarget = { addEventListener(type, fn) { listeners[type] = fn; } };
function element() {
  return {
    ...eventTarget, style: {}, children: [],
    setAttribute() {}, closest() { return workspace; },
    getContext() { return { drawImage() {} }; },
    append(child) { this.children.push(child); },
    remove() { this.removed = true; },
    animate(frames, options) {
      let finish;
      const animation = { frames, options, finished: new Promise(resolve => { finish = resolve; }),
        cancel() { this.cancelled = true; finish(); }, finish: () => finish() };
      active.push(animation);
      return animation;
    }
  };
}
const window = { ...eventTarget };
const reduced = { ...eventTarget, matches: true };
const document = { ...eventTarget, body, hidden: false, hasFocus: () => true, createElement: element };
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname, '../poster-motion.js'), 'utf8'), {
  window, document, matchMedia: () => reduced,
  setTimeout: fn => { timers.set(++timerId, fn); return timerId; }, clearTimeout: id => timers.delete(id)
});
(async () => {
  const canvas = { ...element(), width: 900, height: 1200 };
  const wrap = element(), preference = { ...eventTarget, value: 'auto' };
  const motion = window.createPosterMotion(canvas, wrap, preference);
  assert.equal(motion.capture(), null, 'Auto respects reduced motion');
  assert.equal(workspace.dataset.motion, 'off', 'UI feedback follows the same preference');
  preference.value = 'on';
  listeners.change();
  assert.equal(workspace.dataset.motion, 'on');
  assert.equal(body.dataset.ambient, 'on', 'Explicit On overrides reduced motion');
  reduced.matches = false; listeners.change();
  assert.equal(body.dataset.ambient, 'on');
  const editingEvent = type => ({ type, target: { closest: () => workspace } });
  listeners.pointerdown(editingEvent('pointerdown'));
  assert.equal(body.dataset.ambientEditing, 'true');
  assert.equal(timers.size, 0, 'Do not resume while a pointer is held');
  listeners.pointerup();
  assert.equal(timers.size, 1);
  listeners.input(editingEvent('input'));
  assert.equal(timers.size, 1, 'Repeated edits replace the idle timer');
  timers.values().next().value(); timers.clear();
  assert.equal(body.dataset.ambientEditing, 'false');
  motion.play(motion.capture());
  assert.equal(wrap.children[0].children.length, 5);
  assert.ok(active.every(a => a.options.duration + (a.options.delay || 0) <= 560), 'Template transition finishes within 560ms');
  const first = wrap.children[0];
  motion.play(motion.capture());
  await new Promise(setImmediate);
  assert.ok(first.removed);
  assert.ok(!wrap.children[1].removed, 'Old completion cannot remove new overlay');
  listeners.pointerdown();
  assert.ok(wrap.children[1].removed, 'Editing cancels transition');
  motion.play(motion.capture());
  active.forEach(animation => animation.finish());
  await new Promise(setImmediate);
  assert.ok(wrap.children[2].removed, 'Completed transition cleans up');
  motion.play(motion.capture(), 'filter');
  assert.equal(wrap.children[3].children.length, 1, 'Filter transition reuses its one snapshot');
  assert.equal(active.at(-1).options.duration, 160);
  listeners.blur();
  assert.ok(wrap.children[3].removed, 'Window blur cancels the transition');
  motion.reveal(element());
  assert.equal(active.at(-1).options.duration, 180);
  const paneAnimation = active.at(-1);
  listeners.keydown();
  assert.ok(paneAnimation.cancelled, 'New input cancels panel motion');
  preference.value = 'off';
  listeners.change();
  assert.equal(motion.capture(), null);
  const count = active.length;
  motion.reveal(element());
  assert.equal(active.length, count, 'Off disables panel animation too');
  assert.equal(body.dataset.ambient, 'off');
  preference.value = 'on'; listeners.change(); listeners.focus();
  assert.equal(body.dataset.ambient, 'on');
  listeners.pointerdown(editingEvent('pointerdown')); listeners.blur();
  assert.equal(body.dataset.ambient, 'on', 'Visible page keeps breathing when chat takes focus');
  assert.equal(body.dataset.ambientEditing, 'false');
  assert.equal(timers.size, 0, 'Blur clears the idle timer');
  listeners.focus(); document.hidden = true; listeners.visibilitychange();
  assert.equal(body.dataset.ambient, 'off');
  document.hidden = false; listeners.visibilitychange();
  assert.equal(body.dataset.ambient, 'on');
  listeners.pointerdown(editingEvent('pointerdown')); listeners['visual-lab-mode-change']();
  assert.equal(body.dataset.ambientEditing, 'false');
  console.log('Motion regression passed: preference, short strips, filter fade, panels, restart, input/blur cancellation, cleanup.');
})().catch(error => { console.error(error); process.exitCode = 1; });
