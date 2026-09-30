// Run: node checks/motion-regression.cjs
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const listeners = {};
const active = [];
const eventTarget = { addEventListener(type, fn) { listeners[type] = fn; } };
function element() {
  return {
    ...eventTarget, style: {}, children: [],
    setAttribute() {},
    getContext() { return { drawImage() {} }; },
    append(child) { this.children.push(child); },
    remove() { this.removed = true; },
    animate() {
      let finish;
      const animation = { finished: new Promise(resolve => { finish = resolve; }),
        cancel() { this.cancelled = true; finish(); }, finish: () => finish() };
      active.push(animation);
      return animation;
    }
  };
}
const window = { ...eventTarget };
const reduced = { ...eventTarget, matches: true };
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname, '../poster-motion.js'), 'utf8'), {
  window, document: { ...eventTarget, createElement: element }, matchMedia: () => reduced
});
(async () => {
  const canvas = { ...element(), width: 900, height: 1200 };
  const wrap = element(), preference = { ...eventTarget, value: 'auto' };
  const motion = window.createPosterMotion(canvas, wrap, preference);
  assert.equal(motion.capture(), null, 'Auto respects reduced motion');
  preference.value = 'on';
  motion.play(motion.capture());
  assert.equal(wrap.children[0].children.length, 5);
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
  preference.value = 'off';
  assert.equal(motion.capture(), null);
  console.log('Motion regression passed: reduced motion, strips, restart, input cancellation, cleanup.');
})().catch(error => { console.error(error); process.exitCode = 1; });
