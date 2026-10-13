/**
 * Yongyong Visual Lab - Kinetic Motion & Custom Probe Cursor System
 * 包含：
 * 1. 顶奢暗房双重物理光标 (Custom Kinetic Probe & Reticle Cursor)
 * 2. 中央画布 2.5D 物理悬浮与动态投影 (2.5D Canvas Floating Parallax)
 * 3. 哑光金属聚光灯跟随 (Panel Cursor Spotlight)
 * 4. 示范卡片与缩略图 3D 磁吸视差微浮起 (Magnetic 3D Tilt)
 * 5. 调参滑块能量活化与数值悬浮放大 (Tactile Sliders)
 * 6. 背景色块印章下沉回弹 (Swatch Stamp Pop)
 * 7. 按钮机械弹性触感反馈 (Tactile Button Spring Press)
 */
(() => {
  function initMotionSystem() {
    if (matchMedia('(pointer: coarse)').matches) return;
    // --- 1. 创建顶奢暗房探针光标 DOM ---
    let cursorWrap = document.querySelector('.kinetic-cursor-wrapper');
    if (!cursorWrap) {
      cursorWrap = document.createElement('div');
      cursorWrap.className = 'kinetic-cursor-wrapper';
      cursorWrap.setAttribute('aria-hidden', 'true');
      cursorWrap.innerHTML = `
        <div class="cursor-dot"></div>
        <div class="cursor-ring">
          <span class="cursor-crosshair ch-x"></span>
          <span class="cursor-crosshair ch-y"></span>
          <span class="cursor-label" id="cursorLabel"></span>
        </div>
      `;
      document.body.appendChild(cursorWrap);
    }

    // Inspector rebuilds only need new control bindings, not another animation loop.
    if (!cursorWrap._motionAttached) {
    cursorWrap._motionAttached = true;
    const dot = cursorWrap.querySelector('.cursor-dot');
    const ring = cursorWrap.querySelector('.cursor-ring');
    const label = cursorWrap.querySelector('#cursorLabel');

    let mouse = { x: -100, y: -100 };
    let ringPos = { x: -100, y: -100 };
    let isCursorVisible = false;

    window.addEventListener('pointermove', (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      if (!isCursorVisible) {
        isCursorVisible = true;
        cursorWrap.classList.add('is-visible');
        ringPos.x = mouse.x;
        ringPos.y = mouse.y;
      }
      dot.style.transform = `translate3d(${mouse.x}px, ${mouse.y}px, 0)`;
      wakeMotion();
    }, { passive: true });

    document.addEventListener('pointerleave', () => {
      isCursorVisible = false;
      cursorWrap.classList.remove('is-visible');
    });

    window.addEventListener('pointerdown', () => {
      cursorWrap.classList.add('is-down');
    }, { passive: true });

    // 光标弹性追踪与状态机
    function updateCursorLoop() {
      if (isCursorVisible) {
        ringPos.x += (mouse.x - ringPos.x) * 0.22;
        ringPos.y += (mouse.y - ringPos.y) * 0.22;
        ring.style.transform = `translate3d(${ringPos.x}px, ${ringPos.y}px, 0)`;
      }
    }

    // 光标模式嗅探 (Stage Reticle vs Button Magnet)
    const stages = document.querySelectorAll('.poster-stage, .stage-column');
    stages.forEach((stg) => {
      stg.addEventListener('pointerenter', () => {
        cursorWrap.classList.add('is-reticle');
        if (label) label.textContent = document.body?.classList?.contains?.('is-showcase') ? 'DOUBLE CLICK · 进入编辑' : 'STIR · 拨动水银';
      });
      stg.addEventListener('pointerleave', () => {
        cursorWrap.classList.remove('is-reticle');
        if (label) label.textContent = '';
      });
    });

    const magneticTargets = document.querySelectorAll('button, .mode-tab, .style-option, .poster-demo-button, .upload-button, .poster-action');
    magneticTargets.forEach((target) => {
      target.addEventListener('pointerenter', () => {
        cursorWrap.classList.add('is-magnetic');
        cursorWrap.classList.remove('is-reticle');
        if (label) label.textContent = '';
      });
      target.addEventListener('pointerleave', () => {
        cursorWrap.classList.remove('is-magnetic');
        if (target.closest('.poster-stage, .stage-column')) {
          cursorWrap.classList.add('is-reticle');
          if (label) label.textContent = 'STIR · 拨动水银';
        }
      });
    });

    // --- 2. 中央画布 2.5D 物理悬浮微视差 (Canvas 3D Floating Parallax) ---
    const canvasWraps = document.querySelectorAll('#posterCanvasWrap, .canvas-frame');
    let tiltTarget = { x: 0, y: 0 };
    let tiltCurrent = { x: 0, y: 0 };
    canvasWraps.forEach(wrap => wrap.addEventListener('pointerenter', () => {
      tiltTarget.x = tiltTarget.y = tiltCurrent.x = tiltCurrent.y = 0;
      canvasWraps.forEach(card => { card.style.transform = ''; });
    }, { passive: true }));

    stages.forEach((stage) => {
      stage.addEventListener('pointermove', (e) => {
        if (document.body?.classList?.contains?.('is-showcase') || document.body.dataset.ambientEditing === 'true' || e.target.closest('#posterCanvasWrap, .canvas-frame')) {
          tiltTarget.x = 0;
          tiltTarget.y = 0;
          return;
        }
        const rect = stage.getBoundingClientRect();
        const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
        const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
        tiltTarget.x = -ny * 9.5; // rotateX
        tiltTarget.y = nx * 9.5;  // rotateY
      }, { passive: true });

      stage.addEventListener('pointerleave', () => {
        tiltTarget.x = 0;
        tiltTarget.y = 0;
      }, { passive: true });
    });

    function updateCanvasFloatLoop() {
      if (document.body?.classList?.contains?.('is-showcase') || document.body.dataset.ambient !== 'on' || document.body.dataset.ambientEditing === 'true') {
        tiltTarget.x = tiltTarget.y = tiltCurrent.x = tiltCurrent.y = 0;
      }
      tiltCurrent.x += (tiltTarget.x - tiltCurrent.x) * 0.1;
      tiltCurrent.y += (tiltTarget.y - tiltCurrent.y) * 0.1;

      if (!document.body?.classList?.contains?.('is-showcase') && (Math.abs(tiltCurrent.x) > 0.02 || Math.abs(tiltCurrent.y) > 0.02)) {
        canvasWraps.forEach((wrap) => {
          wrap.style.transform = `perspective(900px) rotateX(${tiltCurrent.x.toFixed(2)}deg) rotateY(${tiltCurrent.y.toFixed(2)}deg)`;
          wrap.style.setProperty('--card-shadow-x', `${(-tiltCurrent.y * 6).toFixed(1)}px`);
          wrap.style.setProperty('--card-shadow-y', `${(tiltCurrent.x * 4 + 38).toFixed(1)}px`);
        });
      } else {
        canvasWraps.forEach((wrap) => {
          wrap.style.transform = '';
          wrap.style.removeProperty('--card-shadow-x');
          wrap.style.removeProperty('--card-shadow-y');
        });
      }
    }

    // --- 3. 面板聚光灯光标跟随 ---
    const panels = document.querySelectorAll('.poster-tools-content, .poster-inspector, .inspector');
    panels.forEach((panel) => {
      panel.addEventListener('pointermove', (e) => {
        const rect = panel.getBoundingClientRect();
        panel.style.setProperty('--panel-mx', `${(e.clientX - rect.left).toFixed(1)}px`);
        panel.style.setProperty('--panel-my', `${(e.clientY - rect.top).toFixed(1)}px`);
      }, { passive: true });
    });

    // One preview loop; off, hidden and touch layouts need no mouse animation.
    let motionFrame = 0;
    const motionEnabled = () => !document.hidden && document.body.dataset.ambient === 'on' && document.body.dataset.motionTier !== 'lite';
    function tickMotion() {
      motionFrame = 0;
      if (!motionEnabled()) { wakeMotion(); return; }
      updateCursorLoop();
      updateCanvasFloatLoop();
      motionFrame = requestAnimationFrame(tickMotion);
    }
    function wakeMotion() {
      if (motionEnabled()) {
        if (!motionFrame) motionFrame = requestAnimationFrame(tickMotion);
      } else {
        tiltTarget.x = tiltTarget.y = tiltCurrent.x = tiltCurrent.y = 0;
        updateCanvasFloatLoop();
        cursorWrap.classList.remove('is-visible');
        isCursorVisible = false;
      }
    }
    new MutationObserver(wakeMotion).observe(document.body, { attributes: true, attributeFilter: ['data-ambient', 'data-motion-tier'] });
    document.addEventListener('visibilitychange', wakeMotion);
    wakeMotion();

    // Delegate transient feedback so inspector rebuilds cannot retain old controls.
    const pressedControls = new Set();
    const pressSelector = '.poster-action, .text-button, .primary-button, .mode-tab, .settings-intro button, .poster-inspector-tabs button, .mini-action, #copyReferenceButton, #resetButton';
    document.addEventListener('pointerdown', (event) => {
      const range = event.target.closest('input[type="range"]');
      const field = range?.closest('.poster-field, .range-control, .effect-range');
      const output = field?.querySelector('output');
      const button = event.target.closest(pressSelector);
      if (field) { field.classList.add('is-sliding'); pressedControls.add(field); }
      if (output) { output.classList.add('is-active'); pressedControls.add(output); }
      if (button) { button.classList.add('is-pressed'); pressedControls.add(button); }
    }, { passive: true });
    document.addEventListener('input', (event) => {
      if (!event.target.matches('input[type="range"]')) return;
      const output = event.target.closest('.poster-field, .range-control, .effect-range')?.querySelector('output');
      if (!output) return;
      output.classList.add('is-active');
      clearTimeout(output._timer);
      output._timer = setTimeout(() => output.classList.remove('is-active'), 350);
    }, { passive: true });
    function releaseControls() {
      cursorWrap.classList.remove('is-down');
      pressedControls.forEach(control => control.classList.remove('is-sliding', 'is-active', 'is-pressed'));
      pressedControls.clear();
    }
    window.addEventListener('pointerup', releaseControls, { passive: true });
    window.addEventListener('pointercancel', releaseControls, { passive: true });
    window.addEventListener('blur', releaseControls);

    }
    // --- 4. 示范卡片 3D 磁吸视差微浮起 ---
    function attachTilt(selector) {
      document.querySelectorAll(selector).forEach((card) => {
        if (card._tiltAttached) return;
        card._tiltAttached = true;

        card.addEventListener('pointermove', (e) => {
          const rect = card.getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
          const py = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
          card.style.transform = `perspective(500px) rotateX(${(-py * 7).toFixed(2)}deg) rotateY(${(px * 7).toFixed(2)}deg) translateY(-3px) scale(1.02)`;
        }, { passive: true });

        card.addEventListener('pointerleave', () => {
          card.style.transform = '';
        }, { passive: true });
      });
    }

    attachTilt('.poster-demo-button');
    attachTilt('.poster-tray-item');
    attachTilt('.style-option');

    // --- 7. 背景色板点击印章弹跳 ---
    document.querySelectorAll('.style-option').forEach((opt) => {
      if (opt._stampAttached) return;
      opt._stampAttached = true;
      opt.addEventListener('click', () => {
        opt.classList.remove('is-stamped');
        void opt.offsetWidth;
        opt.classList.add('is-stamped');
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMotionSystem);
  } else {
    initMotionSystem();
  }

  window.addEventListener('visual-lab-mode-change', () => setTimeout(initMotionSystem, 80));
  window.addEventListener('load', () => setTimeout(initMotionSystem, 100));

  // 动态节点监听（右侧检视器与左侧工具列表重绘时自动绑定物理交互）
  let observerTimer = null;
  const debouncedInit = () => {
    if (observerTimer) return;
    observerTimer = setTimeout(() => {
      observerTimer = null;
      initMotionSystem();
    }, 60);
  };

  const dynamicObserver = new MutationObserver(debouncedInit);
  const observeTargets = ['#posterInspectorContent', '#posterToolsList', '.inspector', '#posterTray'];
  observeTargets.forEach(sel => {
    const el = document.querySelector(sel);
    if (el) dynamicObserver.observe(el, { childList: true, subtree: true });
  });
})();
