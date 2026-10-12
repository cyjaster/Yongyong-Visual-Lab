// Preview-only paper transition. The editor canvas and history stay authoritative.
window.createPosterMotion = (canvas, wrap, preference) => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const workspace = wrap.closest('.poster-workspace');
  let overlay = null, animations = [];
  let ambientTimer = 0, pointerHeld = false, focused = document.hasFocus();
  const enabled = () => preference.value === 'on' || (preference.value === 'auto' && !reduced.matches);
  const syncAmbient = () => {
    document.body.dataset.ambient = enabled() && !reduced.matches && !document.hidden && focused ? 'on' : 'off';
  };
  const resumeAmbient = () => {
    clearTimeout(ambientTimer);
    if (!pointerHeld) ambientTimer = setTimeout(() => { document.body.dataset.ambientEditing = 'false'; }, 1200);
  };
  const resetAmbient = () => {
    clearTimeout(ambientTimer); pointerHeld = false;
    document.body.dataset.ambientEditing = 'false'; syncAmbient();
  };
  const cancel = () => {
    animations.forEach((animation) => animation.cancel());
    animations = [];
    overlay?.remove();
    overlay = null;
  };
  const capture = () => {
    cancel();
    if (!enabled() || !canvas.animate) return null;
    const image = document.createElement('canvas');
    image.width = canvas.width; image.height = canvas.height;
    image.getContext('2d').drawImage(canvas, 0, 0);
    return image;
  };
  const play = (image, kind = 'paper') => {
    cancel();
    if (!image || !enabled()) return;
    const layer = document.createElement('div');
    layer.className = 'poster-paper-transition' + (kind === 'filter' ? ' is-filter-transition' : '');
    layer.setAttribute('aria-hidden', 'true');
    overlay = layer;
    wrap.append(layer);
    if (kind === 'filter') {
      layer.append(image);
      animations.push(image.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease-out', fill: 'both' }));
    } else {
      // Five static paper strips: only transform/opacity animate, no per-frame filters.
      for (let i = 0; i < 5; i++) {
        const strip = document.createElement('canvas');
        const y = Math.round(image.height * i / 5);
        const h = Math.round(image.height * (i + 1) / 5) - y;
        strip.width = image.width; strip.height = h;
        strip.style.top = `${i * 20}%`;
        strip.getContext('2d').drawImage(image, 0, y, image.width, h, 0, 0, image.width, h);
        layer.append(strip);
        const direction = i % 2 ? -1 : 1;
        animations.push(strip.animate([
          { transform: 'translateX(0) rotate(0deg)', opacity: 1 },
          { transform: `translateX(${direction * 8}%) rotate(${direction * 2}deg)`, opacity: 1, offset: .24 },
          { transform: `translateX(${direction * 115}%) rotate(${direction * 6}deg)`, opacity: 0 }
        ], { duration: 420, delay: i * 35, easing: 'cubic-bezier(.22,.7,.2,1)', fill: 'both' }));
      }
      animations.push(canvas.animate([
        { transform: 'scale(.98)', opacity: .85 },
        { transform: 'scale(1)', opacity: 1 }
      ], { duration: 460, easing: 'cubic-bezier(.16,1,.3,1)' }));
    }
    Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
      if (overlay === layer) cancel();
    });
  };
  const reveal = (node) => {
    cancel();
    if (!enabled() || !node?.animate) return;
    const animation = node.animate([{ transform: 'translateY(4px)', opacity: .7 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 180, easing: 'ease-out' });
    animations.push(animation);
    animation.finished.then(() => { if (animations[0] === animation) animations = []; }, () => {});
  };
  const syncPreference = () => {
    cancel();
    workspace.dataset.motion = enabled() ? 'on' : 'off';
    syncAmbient();
  };
  const pauseForEditing = (event) => {
    cancel();
    if (!event?.target?.closest('#posterWorkspace, .workspace')) return;
    if (event.type === 'pointerdown') pointerHeld = true;
    document.body.dataset.ambientEditing = 'true'; resumeAmbient();
  };
  // Finish immediately before editing, exporting, zooming or undoing.
  document.addEventListener('pointerdown', pauseForEditing, true);
  document.addEventListener('keydown', pauseForEditing, true);
  document.addEventListener('input', pauseForEditing, true);
  document.addEventListener('wheel', pauseForEditing, { passive: true, capture: true });
  ['pointerup', 'pointercancel'].forEach(type => document.addEventListener(type, () => { pointerHeld = false; resumeAmbient(); }, true));
  document.addEventListener('visibilitychange', () => { cancel(); resetAmbient(); });
  window.addEventListener('visual-lab-mode-change', () => { cancel(); resetAmbient(); });
  window.addEventListener('resize', cancel);
  window.addEventListener('blur', () => { focused = false; cancel(); resetAmbient(); });
  window.addEventListener('focus', () => { focused = true; syncAmbient(); });
  preference.addEventListener('change', syncPreference);
  reduced.addEventListener('change', syncPreference);
  document.body.dataset.ambientEditing = 'false';
  syncPreference();
  return { capture, play, cancel, reveal };
};
