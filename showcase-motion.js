// Preview transforms only: mouse and device tilt never touch canvas pixels.
(() => {
  const body = document.body;
  const cards = document.querySelectorAll('#posterCanvasWrap, .canvas-frame');
  const button = document.getElementById('showcaseGyroButton');
  const preference = document.getElementById('posterMotionPreference');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const touch = matchMedia('(pointer: coarse)');
  let savedGyro;
  try {
    const savedMotion = localStorage.getItem('visual-lab-motion');
    if (['on', 'auto', 'off'].includes(savedMotion)) preference.value = savedMotion;
    savedGyro = localStorage.getItem('visual-lab-gyro');
  } catch (_) {}
  const needsPermission = typeof window.DeviceOrientationEvent?.requestPermission === 'function';
  // Permission browsers can resume a previous grant; a first grant still needs a button click.
  let gyro = touch.matches && !!window.DeviceOrientationEvent && window.isSecureContext
    && savedGyro !== 'off' && (!needsPermission || savedGyro === 'on');
  let frame = 0, x = 0, y = 0, listening = false;
  let origin = null, sensorTimeout = 0, requesting = false;
  const active = () => body.classList.contains('is-showcase') && !document.hidden
    && (!reduced.matches || preference?.value === 'on') && preference?.value !== 'off';
  const clamp = value => Math.max(-12, Math.min(12, value));
  function paint() {
    frame = 0;
    if (!active()) return;
    cards.forEach(card => {
      card.style.setProperty('--showcase-tilt-x', `${x.toFixed(2)}deg`);
      card.style.setProperty('--showcase-tilt-y', `${y.toFixed(2)}deg`);
    });
    if (body.dataset.showcaseInput === 'gyro') {
      window.dispatchEvent(new CustomEvent('visual-lab-gravity', { detail: { x: y / 12, y: -x / 12, active: true } }));
    }
  }
  function tilt(nextX, nextY, input) {
    x = clamp(nextX); y = clamp(nextY);
    body.dataset.showcaseInput = input;
    if (!frame) frame = requestAnimationFrame(paint);
  }
  function reset() {
    cancelAnimationFrame(frame); frame = 0; x = y = 0; origin = null;
    delete body.dataset.showcaseInput;
    cards.forEach(card => {
      card.style.removeProperty('--showcase-tilt-x');
      card.style.removeProperty('--showcase-tilt-y');
    });
    window.dispatchEvent(new CustomEvent('visual-lab-gravity', { detail: { x: 0, y: 0, active: false } }));
  }
  document.querySelectorAll('.poster-stage, .stage-column').forEach(stage => {
    stage.addEventListener('pointermove', event => {
      if (!active() || event.pointerType !== 'mouse' || gyro || body.dataset.ambient !== 'on' || body.dataset.motionTier === 'lite') return;
      const rect = stage.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      tilt(-(2 * (event.clientY - rect.top) / rect.height - 1) * 12,
        (2 * (event.clientX - rect.left) / rect.width - 1) * 12, 'mouse');
    }, { passive: true });
    stage.addEventListener('pointerleave', () => { if (!gyro) reset(); }, { passive: true });
  });
  function orientation(event) {
    if (!active() || !Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;
    clearTimeout(sensorTimeout);
    if (button.textContent !== '关闭体感') button.textContent = '关闭体感';
    if (!origin) origin = { beta: event.beta, gamma: event.gamma };
    const delta = (value, start) => ((value - start + 540) % 360) - 180;
    const beta = delta(event.beta, origin.beta), gamma = delta(event.gamma, origin.gamma);
    const angle = (window.screen.orientation?.angle ?? window.orientation ?? 0) * Math.PI / 180;
    tilt(-(beta * Math.cos(angle) - gamma * Math.sin(angle)) * .65,
      (gamma * Math.cos(angle) + beta * Math.sin(angle)) * .65, 'gyro');
  }
  function detach() {
    window.removeEventListener('deviceorientation', orientation);
    listening = false; clearTimeout(sensorTimeout); reset();
  }
  function sync() {
    detach();
    button.hidden = (!touch.matches && !gyro) || !window.DeviceOrientationEvent || !window.isSecureContext;
    button.disabled = requesting || !active();
    button.title = reduced.matches && preference?.value !== 'on' ? '系统已开启减少动态效果' : preference?.value === 'off' ? '请先开启界面动效或选择跟随系统' : '随手机倾斜旋转作品';
    button.setAttribute('aria-pressed', String(gyro));
    button.textContent = gyro ? '等待体感 · 关闭' : needsPermission ? '授权开启体感' : '开启体感';
    if (!gyro || !active()) return;
    window.addEventListener('deviceorientation', orientation, { passive: true });
    listening = true;
    sensorTimeout = setTimeout(() => {
      gyro = false; sync(); button.textContent = '无体感数据 · 重试';
    }, 4000);
  }
  button.addEventListener('click', async () => {
    if (requesting || !active()) return;
    if (gyro) {
      gyro = false;
      try { localStorage.setItem('visual-lab-gyro', 'off'); } catch (_) {}
      sync(); return;
    }
    requesting = true; button.disabled = true;
    try {
      const permission = typeof window.DeviceOrientationEvent.requestPermission === 'function'
        ? await window.DeviceOrientationEvent.requestPermission() : 'granted';
      gyro = permission === 'granted';
      if (gyro) { try { localStorage.setItem('visual-lab-gyro', 'on'); } catch (_) {} }
      requesting = false; sync();
      if (!gyro) button.textContent = '未授权 · 重试';
    } catch (_) {
      requesting = false; gyro = false; sync(); button.textContent = '无法开启 · 重试';
    }
  });
  window.addEventListener('visual-lab-view-change', sync);
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('blur', detach);
  window.addEventListener('focus', sync);
  window.addEventListener('orientationchange', () => { origin = null; });
  window.screen.orientation?.addEventListener('change', () => { origin = null; });
  preference?.addEventListener('change', () => {
    try { localStorage.setItem('visual-lab-motion', preference.value); } catch (_) {}
    sync();
  });
  reduced.addEventListener('change', sync);
  touch.addEventListener('change', sync);
  new MutationObserver(() => {
    if (body.dataset.showcaseInput === 'mouse' && (body.dataset.ambient !== 'on' || body.dataset.motionTier === 'lite')) reset();
    if (listening && !active()) sync();
  }).observe(body, { attributes: true, attributeFilter: ['data-ambient', 'data-motion-tier'] });
  sync();
})();
