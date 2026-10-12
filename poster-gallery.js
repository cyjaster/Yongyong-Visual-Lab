// Preview lenses use the shipped thumbnails, never the editing canvas or photo pixels.
(() => {
  let frame = 0, active = null, bounds = null, x = 0, y = 0;
  const clear = () => {
    cancelAnimationFrame(frame); frame = 0;
    active?.classList.remove('is-inspecting'); active = null;
  };
  const inspect = art => {
    clear(); active = art; bounds = art.getBoundingClientRect();
    art.style.setProperty('--art-w', bounds.width + 'px');
    art.style.setProperty('--art-h', bounds.height + 'px');
  };
  document.querySelectorAll('.poster-demo-art').forEach(art => {
    art.addEventListener('pointerenter', event => {
      if (event.pointerType === 'touch' || document.body.dataset.ambient !== 'on') return;
      inspect(art);
    });
    art.addEventListener('pointermove', event => {
      if (event.pointerType === 'touch' || document.body.dataset.ambient !== 'on' || document.body.dataset.ambientEditing === 'true') { clear(); return; }
      if (active !== art) inspect(art);
      x = Math.max(22, Math.min(bounds.width - 22, event.clientX - bounds.left));
      y = Math.max(22, Math.min(bounds.height - 22, event.clientY - bounds.top));
      if (!frame) frame = requestAnimationFrame(() => {
        frame = 0;
        if (!active) return;
        active.style.setProperty('--lens-x', x + 'px');
        active.style.setProperty('--lens-y', y + 'px');
        active.classList.add('is-inspecting');
      });
    });
    art.addEventListener('pointerleave', clear);
  });
  document.addEventListener('pointerdown', clear, true);
  document.addEventListener('keydown', clear, true);
  document.addEventListener('input', clear, true);
  document.addEventListener('scroll', clear, true);
  document.addEventListener('visibilitychange', clear);
  window.addEventListener('blur', clear);
  window.addEventListener('resize', clear);
  window.addEventListener('visual-lab-mode-change', clear);
  document.querySelector('#posterMotionPreference').addEventListener('change', clear);
})();
