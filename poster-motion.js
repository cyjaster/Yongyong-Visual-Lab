// Preview-only paper transition. The editor canvas and history stay authoritative.
window.createPosterMotion = (canvas, wrap, preference) => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let overlay = null, animations = [];
  const enabled = () => preference.value === 'on' || (preference.value === 'auto' && !reduced.matches);
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
  const play = (image) => {
    cancel();
    if (!image || !enabled()) return;
    const layer = document.createElement('div');
    layer.className = 'poster-paper-transition';
    layer.setAttribute('aria-hidden', 'true');
    overlay = layer;
    wrap.append(layer);
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
      ], { duration: 650, delay: i * 65, easing: 'cubic-bezier(.22,.7,.2,1)', fill: 'both' }));
    }
    animations.push(canvas.animate([
      { transform: 'scale(.94)', opacity: .65 },
      { transform: 'scale(1)', opacity: 1 }
    ], { duration: 850, easing: 'cubic-bezier(.16,1,.3,1)' }));
    Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
      if (overlay === layer) cancel();
    });
  };
  // Finish immediately before editing, exporting, zooming or undoing.
  document.addEventListener('pointerdown', cancel, true);
  document.addEventListener('keydown', cancel, true);
  document.addEventListener('wheel', cancel, { passive: true, capture: true });
  document.addEventListener('visibilitychange', cancel);
  window.addEventListener('visual-lab-mode-change', cancel);
  window.addEventListener('resize', cancel);
  preference.addEventListener('change', cancel);
  reduced.addEventListener('change', cancel);
  return { capture, play, cancel };
};
