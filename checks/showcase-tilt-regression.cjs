const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '../showcase-motion.js'), 'utf8');
function setup({ coarse = false, permission = 'granted', secure = true, supported = true, permissionAPI = true } = {}) {
  const listeners = new Map(), timers = new Map(), frames = new Map();
  let id = 0, requests = 0, showcase = true;
  const target = () => ({ addEventListener(type, fn) { listeners.set(this.name + type, fn); },
    removeEventListener(type) { listeners.delete(this.name + type); } });
  const button = { ...target(), name: 'button', setAttribute(key, value) { this[key] = value; } };
  const preference = { ...target(), name: 'preference', value: 'auto' };
  const reduced = { ...target(), name: 'reduced', matches: false };
  const touch = { ...target(), name: 'touch', matches: coarse };
  const stage = { ...target(), name: 'stage', getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 1000 }) };
  const props = new Map();
  const card = { style: { setProperty: (k, v) => props.set(k, v), removeProperty: k => props.delete(k) } };
  const body = { dataset: { ambient: coarse ? 'off' : 'on', motionTier: coarse ? 'lite' : 'full' }, classList: { contains: () => showcase } };
  const document = { ...target(), name: 'document', body, hidden: false,
    querySelectorAll: sel => sel.includes('posterCanvasWrap') ? [card] : [stage],
    getElementById: id => id === 'showcaseGyroButton' ? button : preference };
  const screenOrientation = { ...target(), name: 'orientation', angle: 0 };
  const window = { ...target(), name: 'window', screen: { orientation: screenOrientation }, isSecureContext: secure,
    dispatchEvent(event) { window.gravity = event.detail; },
    DeviceOrientationEvent: supported ? { requestPermission: async () => { requests++; if (permission instanceof Error) throw permission; return permission; } } : undefined };
  let mutation;
  if (supported && !permissionAPI) delete window.DeviceOrientationEvent.requestPermission;
  vm.runInNewContext(source, { document, window, CustomEvent: class { constructor(type, { detail }) { this.type = type; this.detail = detail; } }, matchMedia: q => q.includes('reduced') ? reduced : touch,
    requestAnimationFrame: fn => { frames.set(++id, fn); return id; }, cancelAnimationFrame: id => frames.delete(id),
    setTimeout: fn => { timers.set(++id, fn); return id; }, clearTimeout: id => timers.delete(id),
    MutationObserver: class { constructor(fn) { mutation = fn; } observe() {} } });
  const emit = (name, event = {}) => listeners.get(name)?.(event);
  const flush = () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(fn => fn()); };
  return { body, props, button, preference, document, window, reduced, screenOrientation, listeners, timers, frames,
    emit, flush, mutation: () => mutation(), setView: value => { showcase = value; emit('windowvisual-lab-view-change'); }, requests: () => requests };
}
(async () => {
  const mouse = setup();
  assert.equal(mouse.button.hidden, true);
  mouse.emit('stagepointermove', { pointerType: 'mouse', clientX: 950, clientY: 50 });
  mouse.emit('stagepointermove', { pointerType: 'mouse', clientX: 1000, clientY: 0 });
  assert.equal(mouse.frames.size, 1, 'Rapid input shares one pending frame'); mouse.flush();
  assert.equal(mouse.props.get('--showcase-tilt-x'), '12.00deg');
  assert.equal(mouse.props.get('--showcase-tilt-y'), '12.00deg');
  mouse.emit('stagepointerleave'); assert.equal(mouse.props.size, 0);
  mouse.emit('stagepointermove', { pointerType: 'mouse', clientX: 950, clientY: 50 });
  mouse.setView(false); mouse.flush(); assert.equal(mouse.props.size, 0, 'Edit transition cancels pending tilt');
  mouse.setView(true); mouse.emit('stagepointermove', { pointerType: 'mouse', clientX: 950, clientY: 50 }); mouse.flush();
  mouse.body.dataset.ambient = 'off'; mouse.mutation(); assert.equal(mouse.props.size, 0);
  const phone = setup({ coarse: true });
  assert.equal(phone.button.hidden, false); assert.equal(phone.requests(), 0, 'Permission needs a click');
  await phone.emit('buttonclick'); assert.equal(phone.requests(), 1);
  phone.emit('windowdeviceorientation', { beta: null, gamma: 5 }); assert.equal(phone.frames.size, 0);
  phone.emit('windowdeviceorientation', { beta: 45, gamma: 0 }); phone.flush();
  assert.equal(phone.props.get('--showcase-tilt-x'), '0.00deg', 'Initial grip is neutral');
  phone.emit('windowdeviceorientation', { beta: 55, gamma: 10 }); phone.flush();
  assert.equal(phone.props.get('--showcase-tilt-x'), '-6.50deg');
  assert.equal(phone.props.get('--showcase-tilt-y'), '6.50deg');
  assert.equal(phone.body.dataset.ambient, 'off', 'Gyro does not start the ambient background');
  assert.equal(phone.window.gravity.active, true, 'Opt-in tilt separately enables capped gravity flow');
  assert.ok(phone.window.gravity.x > 0 && phone.window.gravity.y > 0, 'Mercury drifts toward the lowered edges');
  phone.emit('windowdeviceorientation', { beta: 140, gamma: 80 }); phone.flush();
  assert.equal(phone.props.get('--showcase-tilt-y'), '12.00deg', 'Sensor tilt is bounded');
  phone.screenOrientation.angle = 90; phone.emit('orientationchange');
  phone.emit('windowdeviceorientation', { beta: 45, gamma: 0 }); phone.flush();
  phone.emit('windowdeviceorientation', { beta: 55, gamma: 10 }); phone.flush();
  assert.equal(phone.props.get('--showcase-tilt-x'), '6.50deg');
  assert.equal(phone.props.get('--showcase-tilt-y'), '6.50deg', 'Landscape remaps both axes');
  phone.setView(false); assert.equal(phone.listeners.has('windowdeviceorientation'), false); assert.equal(phone.props.size, 0);
  assert.equal(phone.window.gravity.active, false, 'Editing resets fluid gravity');
  phone.setView(true); assert.equal(phone.listeners.has('windowdeviceorientation'), true); assert.equal(phone.requests(), 1);
  phone.document.hidden = true; phone.emit('documentvisibilitychange'); assert.equal(phone.listeners.has('windowdeviceorientation'), false);
  phone.document.hidden = false; phone.emit('documentvisibilitychange');
  phone.reduced.matches = true; phone.emit('reducedchange'); assert.equal(phone.listeners.has('windowdeviceorientation'), false);
  assert.equal(phone.button.disabled, true);
  phone.preference.value = 'on'; phone.emit('preferencechange');
  assert.equal(phone.listeners.has('windowdeviceorientation'), true, 'Explicit motion on overrides the system preference');
  phone.preference.value = 'auto'; phone.emit('preferencechange');
  phone.reduced.matches = false; phone.emit('reducedchange');
  phone.preference.value = 'off'; phone.emit('preferencechange'); assert.equal(phone.listeners.has('windowdeviceorientation'), false);
  phone.preference.value = 'auto'; phone.emit('preferencechange');
  await phone.emit('buttonclick'); assert.equal(phone.listeners.has('windowdeviceorientation'), false, 'Toggle detaches sensor');
  for (const permission of ['denied', new Error('blocked')]) {
    const denied = setup({ coarse: true, permission }); await denied.emit('buttonclick');
    assert.equal(denied.listeners.has('windowdeviceorientation'), false); assert.equal(denied.button.disabled, false);
  }
  const unavailable = setup({ coarse: true }); await unavailable.emit('buttonclick');
  [...unavailable.timers.values()][0](); assert.match(unavailable.button.textContent, /重试/);
  assert.equal(unavailable.listeners.has('windowdeviceorientation'), false, 'No-data fallback stops listening');
  assert.equal(setup({ coarse: true, secure: false }).button.hidden, true);
  assert.equal(setup({ coarse: true, supported: false }).button.hidden, true);
  const android = setup({ coarse: true, permissionAPI: false });
  await android.emit('buttonclick'); assert.equal(android.listeners.has('windowdeviceorientation'), true, 'No permission API still supports Android sensors');
  const css = fs.readFileSync(path.join(__dirname, '../studio.css'), 'utf8');
  assert.match(css, /body\.is-showcase\[data-showcase-input\][\s\S]*?animation: none !important/);
  const liquid = fs.readFileSync(path.join(__dirname, '../poster-liquid-chrome.js'), 'utf8');
  let now = 0, draws = 0;
  const document = { hidden: false, body: { dataset: { ambient: 'off', motionTier: 'lite' } } };
  const Stage = vm.runInNewContext(liquid.slice(liquid.indexOf('class InteractiveFluidStage'), liquid.indexOf('// 全局注册与挂载 API')) + ';InteractiveFluidStage', {
    document, performance: { now: () => now }, requestAnimationFrame() {}
  });
  const fluid = Object.create(Stage.prototype);
  fluid.gl = {}; fluid.render = () => draws++;
  fluid.state = { running: false, lastTime: 0, elapsed: 0, mouse: { x: .5, y: .5 }, targetMouse: { x: .5, y: .5 }, velocity: { x: 0, y: 0 }, disturbance: 0, click: { age: -1 } };
  fluid.setGravity({ x: 1, y: .5, active: true });
  for (let i = 1; i <= 60; i++) { now = i * 1000 / 60; fluid.loop(); }
  assert.ok(draws <= 25 && draws >= 18, 'Opt-in gravity retains the mobile draw cap');
  assert.ok(fluid.gravityOffset.x > fluid.gravityOffset.y && fluid.gravityOffset.y > 0, 'Sustained lean produces directional flow');
  const offset = fluid.gravityOffset.x;
  fluid.setGravity({ x: -1, y: 0, active: true });
  for (let i = 0; i < 120; i++) { now += 1000 / 60; fluid.loop(); }
  assert.ok(fluid.gravityOffset.x < offset, 'Reversing the lean reverses drift after damping');
  document.hidden = true; const hiddenDraws = draws; fluid.loop(); assert.equal(draws, hiddenDraws);
  document.hidden = false; fluid.setGravity({ x: 0, y: 0, active: false }); fluid.start();
  assert.equal(fluid.state.running, false, 'Ambient off stops once gyro is disabled');
  assert.match(liquid, /setU\('u_gravityOffset', l => gl.uniform2f\(l, 0\.0, 0\.0\)\)/, 'Exports explicitly use zero gravity');
  console.log('PASS: mouse tilt, one queued frame, calibrated gyro, landscape, permissions/fallbacks, edit/background/off/reduced cleanup');
})().catch(error => { console.error(error); process.exitCode = 1; });
