// Collage Poster — one framework-free editor, with optional additional photos.
(() => {
  const $ = (s) => document.querySelector(s);
  const canvas = $('#posterCanvas');
  const ctx = canvas.getContext('2d');
  const input = $('#posterImageInput');
  const multiInput = $('#posterMultiImageInput');
  const imageTray = $('#posterImageTray');
  const trayCount = $('#posterTrayCount');
  const backgroundInput = $('#posterBackgroundImageInput');
  const inspector = $('#posterInspectorContent');
  const inspectorTitle = $('#posterInspectorTitle');
  const inspectorSelection = $('#posterInspectorSelection');
  const holdBeforeButton = $('#posterHoldBeforeButton');
  const remixStatusNode = $('#posterRemixStatus');
  const emptyState = $('#posterEmptyState');
  const status = $('#posterStatus');
  const viewport = $('#posterViewport');
  const canvasWrap = $('#posterCanvasWrap');
  const motion = window.createPosterMotion(canvas, canvasWrap, $('#posterMotionPreference'));
  const zoomValue = $('#posterZoomValue');
  const W = canvas.width, H = canvas.height;
  const imageBox = { x: 70, y: 150, w: 760, h: 900 };
  const makeMain = () => ({ id:'main-image', x:imageBox.x, y:imageBox.y, w:imageBox.w, h:imageBox.h, rotation:0, opacity:100, zoom:1, panX:0, panY:0, layoutMode:'FULL BASE' });
  const makeId = () => `poster-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let isBeforePreviewActive = false;
  const cleanFilters = () => ({ bw: 0, brightness: 0, contrast: 0, saturation: 100, halftone: 0, halftoneSize: 8, halftoneDensity: 50, halftoneAngle: 0, grain: 0, rough: 0, outline: 0, scan: 0, scanAngle: 0, paper: 0, dirty: 0, compression: 0, invert: 0, posterize: 0 });

  const state = {
    image: null, imageName: '', mainImageId: '', assets: [], secondaries: [],
    exportResolution: [1200, 1600],
    main: makeMain(), fragments: [], frames: [], details: [], texts: [], layers: [], selected: null,
    background: '#efeee8', backgroundStyle:'solid', backgroundTextureOpacity: 80, backgroundImageId:null, backgroundImageOpacity:48, backgroundImageFit:'cover', border: true, borderColor: '#fff', borderWidth: 5,
    filters: { bw: 0, brightness: 0, contrast: 0, saturation: 100, halftone: 0, halftoneSize: 9, halftoneDensity: 58, halftoneAngle: 15, grain: 0, rough: 0, outline: 0, scan: 0, scanAngle: 0, paper: 0, dirty: 0, compression: 0, invert: 0, posterize: 0 },
    remixInfo: {
      anchorZh: '示范模板', anchorEn: 'Demo Template',
      mainLayoutZh: '完整底图', mainLayoutEn: 'Full Base',
      typographyZh: '编辑排版', typographyEn: 'Editorial Stack',
      backgroundZh: '纯色', backgroundEn: 'Solid',
      strengthZh: '标准 · 平衡', strengthEn: 'Standard · Balanced',
      isManuallyEdited: false,
    },
  };
  const hasSecondaryImages = () => state.secondaries.length > 0;
  let drag = null, history = [], historyIndex = -1, historyTimer = 0;
  let remixBaseSnapshot = null, remixLastResultSnapshot = null;
  let lastRemixCopyName = '', lastRemixAnchorName = '', lastRemixFramePatternName = '', lastRemixBackgroundStyle = '';
  let zoom = 1, zoomMode = 'fit', spaceDown = false, pan = null, fitTimer = 0;
  const imageAssets = new Map();
  const backgroundAssets = new Map();

  function toast(message) {
    const node = $('#toast'); node.textContent = message; node.classList.add('is-visible');
    clearTimeout(toast.timer); toast.timer = setTimeout(() => node.classList.remove('is-visible'), 2100);
  }
  function applyZoom(next, mode = 'manual', anchor = null) {
    const previous = zoom;
    zoom = Math.max(.2, Math.min(2, (mode === 'fit' ? Math.floor(next * 100) : Math.round(next * 100)) / 100));
    zoomMode = mode;
    const ratio = zoom / previous;
    const left = anchor ? anchor.x : viewport.clientWidth / 2;
    const top = anchor ? anchor.y : viewport.clientHeight / 2;
    const contentX = viewport.scrollLeft + left;
    const contentY = viewport.scrollTop + top;
    canvasWrap.style.width = `${W * zoom}px`;
    canvasWrap.style.height = `${H * zoom}px`;
    zoomValue.textContent = `${Math.round(zoom * 100)}%`;
    requestAnimationFrame(() => {
      viewport.scrollLeft = contentX * ratio - left;
      viewport.scrollTop = contentY * ratio - top;
    });
  }
  function fitWorkspace() {
    if ($('#posterWorkspace').hidden) return;
    // Fit the actual UI padding; rounding up can create a needless scrollbar.
    const style = getComputedStyle(viewport);
    const availableW = Math.max(180, viewport.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight));
    const availableH = Math.max(240, viewport.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom));
    applyZoom(Math.min(availableW / W, availableH / H, 1.35), 'fit');
    requestAnimationFrame(() => requestAnimationFrame(() => { viewport.scrollLeft = 0; viewport.scrollTop = 0; }));
  }
  function zoomBy(delta, anchor = null) { applyZoom(zoom + delta, 'manual', anchor); }
  function snapshot() { const { image, ...rest } = state; return JSON.stringify(rest); }
  function commit(immediate = true) {
    const save = () => { historyTimer = 0; const value = snapshot(); if (history[historyIndex] === value) return; history = history.slice(0, historyIndex + 1); history.push(value); if (history.length > 60) history.shift(); historyIndex = history.length - 1; };
    clearTimeout(historyTimer); if (immediate) save(); else historyTimer = setTimeout(save, 180);
  }
  function markManuallyEdited() {
    if (state.remixInfo && !state.remixInfo.isManuallyEdited) {
      state.remixInfo.isManuallyEdited = true;
      updateRemixCard();
    }
  }
  function getImageSourceInfo(sourceId) {
    if (!sourceId || sourceId === 'main') {
      return {
        type: 'main',
        id: 'main',
        assetId: state.mainImageId,
        name: state.imageName || '主图',
        displayName: `主图 · ${state.imageName || 'Primary'}`,
        role: 'primary',
      };
    }
    const sec = state.secondaries?.find((s) => s.id === sourceId);
    if (sec) {
      const asset = imageAssets.get(sec.imageId);
      const secIdx = state.secondaries.findIndex((s) => s.id === sec.id) + 1;
      return {
        type: 'secondary',
        id: sec.id,
        assetId: sec.imageId,
        name: asset?.name || '辅图卡片',
        displayName: `辅图卡片 ${String(secIdx).padStart(2, '0')} · ${asset?.name || 'Card'}`,
        cardIndex: secIdx,
        role: 'secondary',
      };
    }
    const directAsset = imageAssets.get(sourceId);
    if (directAsset) {
      return {
        type: 'asset',
        id: sourceId,
        assetId: sourceId,
        name: directAsset.name,
        displayName: `素材 · ${directAsset.name}`,
        role: 'secondary',
      };
    }
    return {
      type: 'main',
      id: 'main',
      assetId: state.mainImageId,
      name: state.imageName || '主图',
      displayName: `主图 · ${state.imageName || 'Primary'}`,
      role: 'primary',
    };
  }

  function updateRemixCard() {
    if (!remixStatusNode) return;
    const info = state.remixInfo || {
      anchorZh: '示范模板', anchorEn: 'Demo Template',
      mainLayoutZh: '完整底图', mainLayoutEn: 'Full Base',
      typographyZh: '编辑排版', typographyEn: 'Editorial Stack',
      backgroundZh: '纯色', backgroundEn: 'Solid',
      strengthZh: '标准 · 平衡', strengthEn: 'Standard · Balanced',
      narrativeZh: '主辅叙事', narrativeEn: 'Hero + Support',
      rolesZh: '主辅有序', rolesEn: 'Structured',
      isManuallyEdited: false,
    };
    const multiRows = hasSecondaryImages() ? `
        <div class="poster-remix-row">
          <span class="poster-remix-key">多图叙事 / NARRATIVE</span>
          <div class="poster-remix-val">${info.narrativeZh || '主辅叙事'} <small>${info.narrativeEn || 'Hero + Support'}</small></div>
        </div>
        <div class="poster-remix-row">
          <span class="poster-remix-key">图像分工 / ROLES</span>
          <div class="poster-remix-val">1主图 · ${state.secondaries.length}辅图 · ${state.details.length}局部图 <small>Primary / Secondary / Detail</small></div>
        </div>
    ` : '';
    remixStatusNode.innerHTML = `
      <div class="poster-remix-status-header">
        <span class="poster-remix-status-title">CURRENT REMIX</span>
        <span class="poster-remix-badge ${info.isManuallyEdited ? 'is-edited' : 'is-fresh'}">
          ${info.isManuallyEdited ? '已手动调整 · MANUALLY EDITED' : '生成方案 · REMIXED'}
        </span>
      </div>
      <div class="poster-remix-grid">
        <div class="poster-remix-row">
          <span class="poster-remix-key">视觉锚点 / ANCHOR</span>
          <div class="poster-remix-val">${info.anchorZh} <small>${info.anchorEn}</small></div>
        </div>
        <div class="poster-remix-row">
          <span class="poster-remix-key">主图布局 / MAIN LAYOUT</span>
          <div class="poster-remix-val">${info.mainLayoutZh} <small>${info.mainLayoutEn}</small></div>
        </div>
        ${multiRows}
        <div class="poster-remix-row">
          <span class="poster-remix-key">文字构图 / TYPOGRAPHY</span>
          <div class="poster-remix-val">${info.typographyZh} <small>${info.typographyEn}</small></div>
        </div>
        <div class="poster-remix-row">
          <span class="poster-remix-key">背景纸张 / BACKGROUND</span>
          <div class="poster-remix-val">${info.backgroundZh} <small>${info.backgroundEn}</small></div>
        </div>
        <div class="poster-remix-row">
          <span class="poster-remix-key">生成强度 / STRENGTH</span>
          <div class="poster-remix-val">${info.strengthZh} <small>${info.strengthEn}</small></div>
        </div>
      </div>
    `;
  }
  function syncFrameRelativeToParent(frame) {
    if (!frame) return;
    const parentId = frame.sourceId || 'main';
    frame.parentObjectId = parentId;
    const parent = parentId === 'main' ? state.main : state.secondaries?.find((s) => s.id === parentId);
    if (!parent || !parent.w || !parent.h) return;
    frame.relX = (frame.x - parent.x) / parent.w;
    frame.relY = (frame.y - parent.y) / parent.h;
    frame.relW = frame.w / parent.w;
    frame.relH = frame.h / parent.h;
    if (parent.rotation !== undefined) {
      frame.relRotation = (frame.rotation || 0) - (parent.rotation || 0);
    }
  }

  function syncFrameAbsoluteFromParent(frame) {
    if (!frame) return;
    const parentId = frame.sourceId || 'main';
    frame.parentObjectId = parentId;
    const parent = parentId === 'main' ? state.main : state.secondaries?.find((s) => s.id === parentId);
    if (!parent || !parent.w || !parent.h) return;
    if (frame.relX === undefined || frame.relY === undefined || frame.relW === undefined || frame.relH === undefined) {
      syncFrameRelativeToParent(frame);
      return;
    }
    frame.x = parent.x + frame.relX * parent.w;
    frame.y = parent.y + frame.relY * parent.h;
    frame.w = Math.max(20, frame.relW * parent.w);
    frame.h = Math.max(20, frame.relH * parent.h);
    if (parent.rotation !== undefined) {
      frame.rotation = (parent.rotation || 0) + (frame.relRotation || 0);
    }
  }

  function syncAllChildFramesOf(parentId) {
    if (parentId === state.main.id) parentId = 'main';
    (state.frames || []).forEach((f) => {
      if ((f.sourceId || 'main') === parentId) {
        syncFrameAbsoluteFromParent(f);
      }
    });
  }

  function renderImageTray() {
    if (!imageTray) return;
    const activeAssets = state.assets.filter(a => a.id === state.mainImageId || state.secondaries.some(s => s.imageId === a.id));
    if (trayCount) trayCount.textContent = `${(state.image ? 1 : 0) + state.secondaries.length} IMAGES`;
    updateRemixCard();
    if (!activeAssets.length) {
      imageTray.innerHTML = `<p class="poster-help">先上传主图，也可以一次添加多张图片。</p>`;
      return;
    }
    imageTray.innerHTML = activeAssets.map((assetMeta) => {
      const asset = imageAssets.get(assetMeta.id);
      const src = asset?.src || (asset?.image ? asset.image.src : '');
      const isMain = state.mainImageId === assetMeta.id || (!state.mainImageId && state.imageName === assetMeta.name);
      
      let evidenceCount = 0;
      if (isMain) {
        evidenceCount = state.details.filter((d) => {
          const f = frameById(d.frameId);
          return !f || !f.sourceId || f.sourceId === 'main';
        }).length;
      } else {
        const secIds = new Set((state.secondaries || []).filter((s) => s.imageId === assetMeta.id).map((s) => s.id));
        evidenceCount = state.details.filter((d) => {
          const f = frameById(d.frameId);
          return f && secIds.has(f.sourceId);
        }).length;
      }

      return `
        <div class="poster-tray-item ${isMain ? 'is-main' : ''}" data-asset-id="${assetMeta.id}" title="点击在画布中选中">
          <div class="poster-tray-thumb">
            ${src ? `<img src="${escapeHTML(src)}" alt="${escapeHTML(assetMeta.name)}">` : ''}
            <span class="poster-tray-badge ${isMain ? 'is-primary' : 'is-secondary'}">
              ${isMain ? '★ PRIMARY' : 'SECONDARY'}
            </span>
          </div>
          <div class="poster-tray-info">
            <span class="poster-tray-name" title="${escapeHTML(assetMeta.name)}">${escapeHTML(assetMeta.name)}</span>
            <span class="poster-tray-stats">
              ${isMain ? `主图 · 特写 ${evidenceCount}` : `辅图 · 特写 ${evidenceCount}`}
            </span>
            <div class="poster-tray-actions">
              ${!isMain ? `<button type="button" class="poster-tray-btn" data-tray-action="set-main" title="设为主视觉核心">设为主图</button>` : ''}
              ${!isMain ? `<button type="button" class="poster-tray-btn poster-tray-btn-del" data-tray-action="delete" title="删除素材">×</button>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function setMainImage(assetId) {
    const asset = imageAssets.get(assetId);
    if (!asset) return;
    const oldMainId = state.mainImageId;
    if (oldMainId === assetId) return;

    const existingSecIdx = (state.secondaries || []).findIndex((s) => s.imageId === assetId);
    let secIdBeingPromoted = null;
    if (existingSecIdx >= 0) {
      secIdBeingPromoted = state.secondaries[existingSecIdx].id;
      state.secondaries.splice(existingSecIdx, 1);
      state.layers = state.layers.filter((l) => !(l.type === 'secondary' && l.id === secIdBeingPromoted));
    }

    if (oldMainId && oldMainId !== assetId && imageAssets.has(oldMainId)) {
      const s = {
        id: makeId(),
        imageId: oldMainId,
        x: 50,
        y: 720,
        w: 260,
        h: 320,
        rotation: -2,
        opacity: 100,
        color: '#ffffff',
        lineWidth: 3,
        backingColor: '#ffffff',
        filters: cleanFilters(),
      };
      state.secondaries.push(s);
      addLayer('secondary', s.id);
      state.frames.forEach((f) => {
        if (!f.sourceId || f.sourceId === 'main') {
          f.sourceId = s.id;
          f.parentObjectId = s.id;
          syncFrameRelativeToParent(f);
        }
      });
    }

    if (secIdBeingPromoted) {
      state.frames.forEach((f) => {
        if (f.sourceId === secIdBeingPromoted) {
          f.sourceId = 'main';
          f.parentObjectId = 'main';
          syncFrameRelativeToParent(f);
        }
      });
    }

    state.image = asset.image;
    state.imageName = asset.name;
    state.mainImageId = asset.id;
    ensureMainLayer();
    emptyState.classList.add('is-hidden');
    status.textContent = `MAIN IMAGE / ${asset.name}`;

    syncAllChildFramesOf('main');
    (state.secondaries || []).forEach((s) => syncAllChildFramesOf(s.id));

    renderImageTray();
    render();
    commit();
    markManuallyEdited();
    toast(`已设为主图 · ${asset.name}`);
  }

  function addSecondaryImage(assetId, extra = {}, save = true) {
    const asset = imageAssets.get(assetId);
    if (!asset) return toast('未找到对应素材。');
    if (save) commit();
    const count = (state.secondaries || []).length;
    const positions = [
      { x: 50, y: 720, w: 260, h: 320, rotation: -3 },
      { x: 590, y: 180, w: 250, h: 300, rotation: 2 },
      { x: 580, y: 760, w: 270, h: 330, rotation: -2 },
      { x: 60, y: 190, w: 240, h: 290, rotation: 3 },
    ];
    const pos = positions[count % positions.length];
    let w = pos.w, h = pos.h;
    if (asset.image?.naturalWidth && asset.image?.naturalHeight) {
      const ratio = asset.image.naturalHeight / asset.image.naturalWidth;
      h = Math.round(w * ratio);
      if (h > 420) { h = 420; w = Math.round(h / ratio); }
      if (h < 120) { h = 120; w = Math.round(h / ratio); }
    }
    const s = {
      id: makeId(),
      imageId: asset.id,
      x: pos.x,
      y: pos.y,
      w,
      h,
      rotation: pos.rotation,
      opacity: 100,
      color: '#ffffff',
      lineWidth: 3,
      backingColor: '#ffffff',
      filters: cleanFilters(),
      ...extra,
    };
    state.secondaries.push(s);
    const mainIdx = layerIndex('main', 'main-image');
    addLayer('secondary', s.id, mainIdx >= 0 ? mainIdx : state.layers.length - 1);
    state.selected = { type: 'secondary', id: s.id };
    if (save) {
      renderImageTray(); renderInspector(); render(); commit(); markManuallyEdited();
      toast(`已添加辅图卡片 · ${asset.name}`);
    }
  }

  function appendImages(assets) {
    if (!assets.length) return;
    commit(); // One batch is one undo step, including a pending inspector edit.
    assets.forEach(asset => {
      imageAssets.set(asset.id, asset);
      state.assets.push({ id: asset.id, name: asset.name });
      if (!state.image) {
        state.image = asset.image; state.imageName = asset.name; state.mainImageId = asset.id;
        ensureMainLayer(); emptyState.classList.add('is-hidden');
        status.textContent = `MAIN IMAGE / ${asset.name}`;
      } else addSecondaryImage(asset.id, {}, false);
    });
    renderImageTray(); renderInspector(); render(); commit(); markManuallyEdited();
  }

  function deleteAsset(assetId) {
    if (state.assets.length <= 1) return toast('素材库中至少保留一张图片。');
    if (state.mainImageId === assetId) return toast('主图素材不能直接删除，请先将其他图片设为主图。');
    commit();
    state.assets = state.assets.filter((a) => a.id !== assetId);
    // Keep decoded pixels for undo; removing from the scene is not removing from history.
    const deadSecondaryIds = state.secondaries.filter((s) => s.imageId === assetId).map((s) => s.id);
    state.secondaries = state.secondaries.filter((s) => s.imageId !== assetId);
    const deadFrameIds = new Set(state.frames.filter((f) => deadSecondaryIds.includes(f.sourceId)).map((f) => f.id));
    const deadDetailIds = new Set(state.details.filter((d) => deadFrameIds.has(d.frameId)).map((d) => d.id));
    state.frames = state.frames.filter((f) => !deadFrameIds.has(f.id));
    state.details = state.details.filter((d) => !deadDetailIds.has(d.id));
    state.layers = state.layers.filter((l) => !(l.type === 'secondary' && deadSecondaryIds.includes(l.id)) && !deadFrameIds.has(l.id) && !deadDetailIds.has(l.id));
    if (state.selected && (deadSecondaryIds.includes(state.selected.id) || deadFrameIds.has(state.selected.id) || deadDetailIds.has(state.selected.id))) {
      setSelected(null, null);
    }
    renderImageTray();
    render();
    commit();
    markManuallyEdited();
    toast('素材已删除。');
  }

  function restore(index) {
    if (index < 0 || index >= history.length) return;
    clearTimeout(historyTimer); historyTimer = 0;
    const currentImage = state.image;
    Object.assign(state, JSON.parse(history[index]));
    if (state.mainImageId && imageAssets.has(state.mainImageId)) {
      state.image = imageAssets.get(state.mainImageId).image;
    } else {
      state.image = state.mainImageId ? currentImage : null;
    }
    historyIndex = index;
    renderImageTray();
    renderInspector();
    render();
    updateRemixCard();
  }
  function undo() { if (historyTimer) commit(); if (historyIndex > 0) restore(historyIndex - 1); else toast('已经是最早一步。'); }
  function redo() { if (historyTimer) commit(); if (historyIndex < history.length - 1) restore(historyIndex + 1); else toast('没有可重做的操作。'); }

  function getCover() {
    if (!state.image) return null;
    return imageCover(state.image, state.main || imageBox);
  }
  function imageCover(image, box) {
    const scale = Math.max(box.w / image.naturalWidth, box.h / image.naturalHeight) * (box.zoom || 1);
    const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
    return { x: box.x + (box.w - w) / 2 + (box.panX || 0), y: box.y + (box.h - h) / 2 + (box.panY || 0), w, h, scale };
  }
  function getSourceImageForFrame(f) {
    if (!f) return state.image;
    if (!f.sourceId || f.sourceId === 'main') return state.image;
    const s = state.secondaries?.find((v) => v.id === f.sourceId);
    if (s) {
      const asset = imageAssets.get(s.imageId);
      if (asset?.image) return asset.image;
    }
    const directAsset = imageAssets.get(f.sourceId);
    if (directAsset?.image) return directAsset.image;
    return state.image;
  }
  function sourceRect(frame) {
    const image = getSourceImageForFrame(frame); if (!image) return null;
    const box = state.secondaries?.find((v) => v.id === frame.sourceId) || state.main || imageBox;
    const cover = imageCover(image, box), cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    // Map all four rotated frame corners back into the unrotated source image.
    const corners = [[0,0],[frame.w,0],[frame.w,frame.h],[0,frame.h]].map(([x,y]) => {
      const p = rotatePoint(frame.x+x, frame.y+y, frame.x+frame.w/2, frame.y+frame.h/2, frame.rotation || 0);
      return rotatePoint(p.x, p.y, cx, cy, -(box.rotation || 0));
    });
    const left = Math.max(box.x, Math.min(...corners.map(p => p.x))), top = Math.max(box.y, Math.min(...corners.map(p => p.y)));
    const right = Math.min(box.x+box.w, Math.max(...corners.map(p => p.x))), bottom = Math.min(box.y+box.h, Math.max(...corners.map(p => p.y)));
    const sx = Math.max(0, Math.min(image.naturalWidth-1, (left-cover.x)/cover.scale));
    const sy = Math.max(0, Math.min(image.naturalHeight-1, (top-cover.y)/cover.scale));
    return { sx, sy, sw: Math.max(1, Math.min(image.naturalWidth-sx, (right-cover.x)/cover.scale-sx)), sh: Math.max(1, Math.min(image.naturalHeight-sy, (bottom-cover.y)/cover.scale-sy)) };
  }
  function raster(w, h, draw) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); draw(c.getContext('2d'), c); return c; }
  function noise(seed) { const n = Math.sin(seed * 12.9898 + 78.233) * 43758.5453; return n - Math.floor(n); }

  function drawElectricTigerPattern(tc, w, h) {
    const bgGrad = tc.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, '#001fd4');
    bgGrad.addColorStop(0.25, '#042cf0');
    bgGrad.addColorStop(0.65, '#0020be');
    bgGrad.addColorStop(1, '#00138c');
    tc.fillStyle = bgGrad;
    tc.fillRect(0, 0, w, h);

    const glow1 = tc.createRadialGradient(w * 0.22, h * 0.12, 10, w * 0.22, h * 0.12, w * 0.6);
    glow1.addColorStop(0, 'rgba(80, 160, 255, 0.45)');
    glow1.addColorStop(1, 'rgba(0, 31, 212, 0)');
    tc.fillStyle = glow1;
    tc.fillRect(0, 0, w, h);

    const glow2 = tc.createRadialGradient(w * 0.78, h * 0.15, 10, w * 0.78, h * 0.15, w * 0.5);
    glow2.addColorStop(0, 'rgba(60, 140, 255, 0.35)');
    glow2.addColorStop(1, 'rgba(0, 31, 212, 0)');
    tc.fillStyle = glow2;
    tc.fillRect(0, 0, w, h);

    function drawClaw(pts, width) {
      if (pts.length < 2) return;
      tc.save();
      tc.beginPath();
      tc.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        const p0 = pts[i - 1], p1 = pts[i];
        const mx = (p0.x + p1.x) / 2, my = (p0.y + p1.y) / 2;
        tc.quadraticCurveTo(p0.x, p0.y, mx, my);
      }
      const last = pts[pts.length - 1];
      tc.lineTo(last.x, last.y);
      tc.lineWidth = width;
      tc.lineCap = 'round';
      tc.lineJoin = 'round';
      tc.strokeStyle = '#06070a';
      tc.stroke();
      tc.restore();
    }

    const claws = [
      { pts: [{ x: -30, y: 15 }, { x: 90, y: 35 }, { x: 220, y: 15 }, { x: 340, y: 45 }], w: 28 },
      { pts: [{ x: -20, y: 65 }, { x: 130, y: 95 }, { x: 240, y: 65 }, { x: 380, y: 105 }], w: 24 },
      { pts: [{ x: -40, y: 135 }, { x: 70, y: 160 }, { x: 170, y: 130 }, { x: 250, y: 155 }], w: 20 },
      { pts: [{ x: 520, y: 25 }, { x: 670, y: 55 }, { x: 810, y: 25 }, { x: 930, y: 65 }], w: 32 },
      { pts: [{ x: 590, y: 95 }, { x: 740, y: 125 }, { x: 860, y: 85 }, { x: 940, y: 120 }], w: 26 },
      { pts: [{ x: 710, y: 165 }, { x: 820, y: 190 }, { x: 910, y: 160 }], w: 22 },
      { pts: [{ x: -25, y: 260 }, { x: 55, y: 290 }, { x: 35, y: 380 }, { x: -25, y: 410 }], w: 34 },
      { pts: [{ x: -25, y: 460 }, { x: 65, y: 500 }, { x: 25, y: 580 }, { x: -25, y: 610 }], w: 36 },
      { pts: [{ x: -25, y: 680 }, { x: 70, y: 720 }, { x: 30, y: 810 }, { x: -25, y: 850 }], w: 32 },
      { pts: [{ x: -25, y: 920 }, { x: 65, y: 960 }, { x: 35, y: 1050 }, { x: -25, y: 1090 }], w: 35 },
      { pts: [{ x: 925, y: 270 }, { x: 845, y: 300 }, { x: 865, y: 390 }, { x: 925, y: 420 }], w: 32 },
      { pts: [{ x: 925, y: 480 }, { x: 835, y: 520 }, { x: 875, y: 610 }, { x: 925, y: 640 }], w: 36 },
      { pts: [{ x: 925, y: 700 }, { x: 830, y: 740 }, { x: 870, y: 830 }, { x: 925, y: 860 }], w: 34 },
      { pts: [{ x: 925, y: 930 }, { x: 840, y: 970 }, { x: 865, y: 1060 }, { x: 925, y: 1090 }], w: 32 },
      { pts: [{ x: 140, y: 1225 }, { x: 240, y: 1155 }, { x: 380, y: 1195 }, { x: 490, y: 1225 }], w: 30 },
      { pts: [{ x: 530, y: 1225 }, { x: 640, y: 1160 }, { x: 760, y: 1195 }, { x: 860, y: 1225 }], w: 28 }
    ];
    claws.forEach((c) => drawClaw(c.pts, c.w));

    tc.save();
    tc.globalAlpha = 0.08;
    tc.fillStyle = '#ffffff';
    for (let i = 0; i < 350; i++) {
      const rx = ((Math.sin(i * 19.3) * 43758.5453) % 1 + 1) % 1 * w;
      const ry = ((Math.sin(i * 31.7) * 43758.5453) % 1 + 1) % 1 * h;
      tc.fillRect(rx, ry, 1.8, 1.8);
    }
    tc.restore();
  }

  function drawPosterBackground() {
    const style = state.backgroundStyle || 'solid';
    ctx.fillStyle = state.background; ctx.fillRect(0, 0, W, H);

    const textureAlpha = Math.max(0, Math.min(100, state.backgroundTextureOpacity ?? 80)) / 100;
    if (style !== 'solid' && textureAlpha > 0.005) {
      ctx.save();
      ctx.globalAlpha = textureAlpha;
      if (style === 'ps-dark' || style === 'dark-studio') {
        const rad = ctx.createRadialGradient(W / 2, H * 0.45, 80, W / 2, H * 0.45, W * 0.72);
        rad.addColorStop(0, '#1c1f28');
        rad.addColorStop(0.65, '#0e1015');
        rad.addColorStop(1, '#07080a');
        ctx.fillStyle = rad;
        ctx.fillRect(0, 0, W, H);
      } else if (style === 'electric-tiger' || style === 'tiger') {
        drawElectricTigerPattern(ctx, W, H);
      } else if (style === 'liquid-chrome') {
        if (window.posterLiquidChrome) {
          const chromeCanvas = window.posterLiquidChrome.getCachedCanvas(W, H, state.liquidChromeSeed || 0);
          if (chromeCanvas) ctx.drawImage(chromeCanvas, 0, 0, W, H);
        }
      } else if (style === 'grid') {
        ctx.strokeStyle = 'rgba(31,84,189,.35)'; ctx.lineWidth = 1;
        for (let x = 0; x <= W; x += 36) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
        for (let y = 0; y <= H; y += 36) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(31,84,189,.55)';
        for (let x = 0; x <= W; x += 180) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
        for (let y = 0; y <= H; y += 180) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
      } else if (style === 'chrome') {
        const g = ctx.createLinearGradient(0,0,W,H); g.addColorStop(0,'#d9f3ff'); g.addColorStop(.25,'#f4d7ee'); g.addColorStop(.5,'#eef4ff'); g.addColorStop(.72,'#b9c9f4'); g.addColorStop(1,'#f7e0ea');
        ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
        const glow = ctx.createRadialGradient(W*.72,H*.18,10,W*.72,H*.18,W*.58); glow.addColorStop(0,'rgba(255,255,255,.92)'); glow.addColorStop(.34,'rgba(158,191,255,.26)'); glow.addColorStop(1,'rgba(255,255,255,0)'); ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);
      } else if (style === 'scan') {
        ctx.fillStyle='#5b554c';
        for(let i=0;i<520;i++){const x=noise(i*17)*W,y=noise(i*31)*H,s=.3+noise(i*43)*2.3;ctx.fillRect(x,y,s,s*(1+noise(i*7)*4));}
        ctx.fillStyle='#171717'; for(let y=8;y<H;y+=9)ctx.fillRect(0,y,W,1);
      } else if (style === 'dots') {
        ctx.fillStyle='rgba(30,36,48,.45)';
        for(let y=10;y<H;y+=18)for(let x=10;x<W;x+=18){ctx.beginPath();ctx.arc(x+(Math.floor(y/18)%2?5:0),y,1.4,0,Math.PI*2);ctx.fill();}
      } else if (style === 'soft-y2k') {
        const g=ctx.createLinearGradient(0,0,W,H);g.addColorStop(0,'#e1ecff');g.addColorStop(.46,'#f0e6f5');g.addColorStop(1,'#d4e1f5');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
        ctx.strokeStyle='#718bd4';ctx.lineWidth=2;
        [[W*.18,H*.2,210],[W*.82,H*.68,320],[W*.5,H*.92,190]].forEach(([x,y,r])=>{for(let n=0;n<4;n++){ctx.beginPath();ctx.arc(x,y,r+n*18,0,Math.PI*2);ctx.stroke();}});
      } else if (style === 'blueprint') {
        ctx.fillStyle='#b9cbed';ctx.fillRect(0,0,W,H);
        ctx.strokeStyle='rgba(255,255,255,.55)';ctx.lineWidth=1;
        for(let x=0;x<W;x+=24){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}for(let y=0;y<H;y+=24){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
        ctx.strokeStyle='rgba(27,58,130,.45)';ctx.lineWidth=2;for(let x=0;x<W;x+=120){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}for(let y=0;y<H;y+=120){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
      }
      ctx.restore();
    }

    const bgImage = state.backgroundImageId ? backgroundAssets.get(state.backgroundImageId) : null;
    if (bgImage) {
      ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(100, state.backgroundImageOpacity ?? 48)) / 100;
      const fit = state.backgroundImageFit || 'cover', iw=bgImage.naturalWidth||bgImage.width, ih=bgImage.naturalHeight||bgImage.height;
      if (fit === 'stretch') ctx.drawImage(bgImage,0,0,W,H);
      else { const scale = fit === 'contain' ? Math.min(W/iw,H/ih) : Math.max(W/iw,H/ih), w=iw*scale,h=ih*scale; ctx.drawImage(bgImage,(W-w)/2,(H-h)/2,w,h); }
      ctx.restore();
    }
  }

  function pixelEffects(target, o) {
    const tc = target.getContext('2d');
    if (!(o.grain || o.rough || o.outline || o.compression || o.posterize || o.glass || o.mosaic || o.dither || o.duotone || o.threshold)) return;
    let imageData; try { imageData = tc.getImageData(0, 0, target.width, target.height); } catch (e) { console.warn('Pixel effects skipped.', e); return; }
    const d = imageData.data, W = target.width, H = target.height;

    // 1. 玻璃「块状」 (Glass Brick / Thick Glass Refraction)
    if (o.glass) {
      const gSize = Math.max(12, Math.min(72, o.glassSize || 32));
      const copy = new Uint8ClampedArray(d);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const bx = Math.floor(x / gSize) * gSize;
          const by = Math.floor(y / gSize) * gSize;
          const u = (x - bx) / gSize - 0.5;
          const v = (y - by) / gSize - 0.5;
          // 凸透镜/水波砖折射畸变位移
          const rDist = Math.hypot(u, v);
          const bend = Math.sin(rDist * Math.PI) * 20 * (o.glass / 100);
          const srcX = Math.max(0, Math.min(W - 1, Math.round(x + u * bend * 2.5)));
          const srcY = Math.max(0, Math.min(H - 1, Math.round(y + v * bend * 2.5)));
          const targetIdx = (y * W + x) * 4;
          const srcIdx = (srcY * W + srcX) * 4;
          let r = copy[srcIdx], g = copy[srcIdx + 1], b = copy[srcIdx + 2];

          // 玻璃方格高光与倒角阴影边框
          const isHighlight = (x - bx < 2 || y - by < 2);
          const isShadow = (bx + gSize - x < 2 || by + gSize - y < 2);
          if (isHighlight) {
            r = Math.min(255, r + 85);
            g = Math.min(255, g + 90);
            b = Math.min(255, b + 100);
          } else if (isShadow) {
            r *= 0.5; g *= 0.5; b *= 0.5;
          }
          d[targetIdx] = r; d[targetIdx + 1] = g; d[targetIdx + 2] = b;
        }
      }
    }

    // 2. 马赛克 (像素化 + 锐化或拼贴)
    if (o.mosaic) {
      const mSize = Math.max(4, Math.min(64, o.mosaicSize || 18));
      const copy = new Uint8ClampedArray(d);
      const isFacet = o.mosaicStyle === 'facet';
      for (let by = 0; by < H; by += mSize) {
        for (let bx = 0; bx < W; bx += mSize) {
          const bw = Math.min(mSize, W - bx), bh = Math.min(mSize, H - by);
          let sumR = 0, sumG = 0, sumB = 0, count = 0;
          for (let y = by; y < by + bh; y++) {
            for (let x = bx; x < bx + bw; x++) {
              const idx = (y * W + x) * 4;
              sumR += copy[idx]; sumG += copy[idx + 1]; sumB += copy[idx + 2];
              count++;
            }
          }
          const avgR = sumR / count, avgG = sumG / count, avgB = sumB / count;
          for (let y = by; y < by + bh; y++) {
            for (let x = bx; x < bx + bw; x++) {
              const idx = (y * W + x) * 4;
              let r = avgR, g = avgG, b = avgB;
              if (isFacet) {
                // 彩色玻璃镶嵌缝/暗纹
                const onBorder = (x === bx || y === by || x === bx + bw - 1 || y === by + bh - 1);
                if (onBorder) { r *= 0.22; g *= 0.22; b *= 0.22; }
                else {
                  const bevel = ((x - bx) - (y - by)) / mSize * 36;
                  r = Math.max(0, Math.min(255, r + bevel));
                  g = Math.max(0, Math.min(255, g + bevel));
                  b = Math.max(0, Math.min(255, b + bevel));
                }
              } else {
                // 经典阶梯大像素 + 锐化边界 (Sharp Pixelate)
                if (x === bx || y === by) {
                  r *= 0.84; g *= 0.84; b *= 0.84;
                } else if (x === bx + bw - 1 || y === by + bh - 1) {
                  r = Math.min(255, r * 1.08);
                  g = Math.min(255, g * 1.08);
                  b = Math.min(255, b * 1.08);
                }
              }
              d[idx] = r; d[idx + 1] = g; d[idx + 2] = b;
            }
          }
        }
      }
    }

    const lum = new Float32Array(W * H);
    for (let i = 0, p = 0; i < d.length; i += 4, p++) lum[p] = d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114;

    // 3. 位图：20 像素 (Bayer 8x8 抖动点刻 Dither)
    if (o.dither) {
      const bayer8 = [
         0, 32,  8, 40,  2, 34, 10, 42,
        48, 16, 56, 24, 50, 18, 58, 26,
        12, 44,  4, 36, 14, 46,  6, 38,
        60, 28, 52, 20, 62, 30, 54, 22,
         3, 35, 11, 43,  1, 33,  9, 41,
        51, 19, 59, 27, 49, 17, 57, 25,
        15, 47,  7, 39, 13, 45,  5, 37,
        63, 31, 55, 23, 61, 29, 53, 21
      ];
      const step = Math.max(2, Math.round(o.ditherStep || 4));
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const p = y * W + x, idx = p * 4;
          const bx = Math.floor(x / step) % 8;
          const by = Math.floor(y / step) % 8;
          const threshold = (bayer8[by * 8 + bx] / 64) * 255;
          const val = (lum[p] > threshold) ? 250 : 12;
          d[idx] = val; d[idx + 1] = val; d[idx + 2] = val;
        }
      }
    }

    // 4. 阈值 + 颗粒 (纯硬二值化复印 Threshold)
    if (o.threshold) {
      const thLevel = o.thresholdLevel || 128;
      for (let p = 0; p < lum.length; p++) {
        const idx = p * 4;
        const val = lum[p] >= thLevel ? 250 : 10;
        d[idx] = val; d[idx + 1] = val; d[idx + 2] = val;
      }
    }

    // 5. 渐变映射 / 双色调 (Duotone / Gradient Map)
    if (o.duotone) {
      const hexToRgb = (hex, def) => {
        const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
        return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : def;
      };
      const darkRgb = hexToRgb(o.duotoneDark, [22, 38, 114]);
      const lightRgb = hexToRgb(o.duotoneLight, [251, 167, 39]);
      for (let p = 0; p < lum.length; p++) {
        const idx = p * 4;
        const t = Math.max(0, Math.min(1, lum[p] / 255));
        d[idx] = Math.round(darkRgb[0] + (lightRgb[0] - darkRgb[0]) * t);
        d[idx + 1] = Math.round(darkRgb[1] + (lightRgb[1] - darkRgb[1]) * t);
        d[idx + 2] = Math.round(darkRgb[2] + (lightRgb[2] - darkRgb[2]) * t);
      }
    }

    let levels = 0, step = 0;
    if (o.posterize) {
      if (o.posterize < 35) levels = Math.max(5, Math.round(8 - (o.posterize / 35) * 3));
      else if (o.posterize < 70) levels = Math.max(3, Math.round(5 - ((o.posterize - 35) / 35) * 2));
      else levels = Math.max(2, Math.round(3 - ((o.posterize - 70) / 30)));
      step = 255 / (levels - 1);
    }

    const blockSize = o.compression ? Math.max(3, Math.round(3 + (o.compression / 100) * 13)) : 1;
    const compressionWeight = o.compression ? Math.min(1, Math.pow(o.compression / 100, 0.72) * 1.15) : 0;
    const roughBlend = o.rough ? Math.min(1, Math.pow(o.rough / 100, 0.75) * 1.05) : 0;
    const outlineBlend = o.outline ? Math.min(1, Math.pow(o.outline / 100, 0.75) * 1.1) : 0;

    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const p = y * W + x, i = p * 4;
      let r = d[i], g = d[i + 1], b = d[i + 2], l = (d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114);

      if (o.rough) {
        const threshold = 126 + (noise(p * 3) - 0.5) * (o.rough * 1.8);
        const t = l > threshold ? 242 : 16;
        r += (t - r) * roughBlend;
        g += (t - g) * roughBlend;
        b += (t - b) * roughBlend;
      }

      if (o.outline) {
        const nextX = Math.min(p + 1, lum.length - 1);
        const nextY = Math.min(p + W, lum.length - 1);
        const edge = Math.min(255, (Math.abs(l - lum[nextX]) * 1.5 + Math.abs(l - lum[nextY]) * 1.8) * 2.4);
        const ink = Math.max(0, 255 - edge);
        r += (ink - r) * outlineBlend;
        g += (ink - g) * outlineBlend;
        b += (ink - b) * outlineBlend;
      }

      if (levels) {
        r = Math.round(r / step) * step;
        g = Math.round(g / step) * step;
        b = Math.round(b / step) * step;
      }

      if (o.compression) {
        const bx = Math.floor(x / blockSize) * blockSize;
        const by = Math.floor(y / blockSize) * blockSize;
        const blockOriginIdx = (by * W + bx) * 4;
        if (blockOriginIdx < d.length - 4) {
          r += (d[blockOriginIdx] - r) * compressionWeight * 0.88;
          g += (d[blockOriginIdx + 1] - g) * compressionWeight * 0.88;
          b += (d[blockOriginIdx + 2] - b) * compressionWeight * 0.88;
        }
        if (x % blockSize === 0 || y % blockSize === 0) {
          const shift = (noise((bx * 17 + by * 37) % 999) - 0.5) * (o.compression * 1.7);
          r += shift;
          g += shift * 0.6;
          b -= shift * 0.5;
        }
      }

      if (o.grain) {
        const n = (noise(p) - 0.5) * (o.grain * 2.8);
        r += n; g += n; b += n;
      }

      d[i] = Math.max(0, Math.min(255, r));
      d[i + 1] = Math.max(0, Math.min(255, g));
      d[i + 2] = Math.max(0, Math.min(255, b));
    }
    tc.putImageData(imageData, 0, 0);
  }

  function halftone(target, o) {
    if (!o.halftone) return;
    const tc = target.getContext('2d'); let pixels;
    try { pixels = tc.getImageData(0, 0, target.width, target.height).data; } catch (e) { console.warn('Halftone skipped.', e); return; }
    const spacing = Math.max(4, 18 - Math.max(1, o.halftoneDensity || 50) * .14);
    const size = Math.max(1, o.halftoneSize || 8);
    const strength = Math.pow(o.halftone / 100, 0.75);
    const W = target.width, H = target.height;

    // A. 彩色半调 (CMYK 分色印刷网点 - 直接生成高辨识度分色网屏画面)
    if (o.colorHalftone) {
      const isDuotoneMap = !!o.duotone;
      const cmykCanvas = raster(W, H, (cc) => {
        cc.fillStyle = isDuotoneMap ? (o.duotoneLight || '#dbe8ff') : '#f8f8f6';
        cc.fillRect(0, 0, W, H);
        const channels = isDuotoneMap ? [
          { name: 'c', angle: 15 * Math.PI / 180, color: 'rgba(24, 60, 215, 0.94)' },
          { name: 'm', angle: 75 * Math.PI / 180, color: 'rgba(18, 42, 175, 0.92)' },
          { name: 'y', angle: 0, color: 'rgba(68, 115, 245, 0.88)' },
          { name: 'k', angle: 45 * Math.PI / 180, color: 'rgba(10, 20, 75, 0.98)' }
        ] : [
          { name: 'c', angle: 15 * Math.PI / 180, color: 'rgba(0, 168, 240, 0.92)' },
          { name: 'm', angle: 75 * Math.PI / 180, color: 'rgba(235, 10, 130, 0.92)' },
          { name: 'y', angle: 0, color: 'rgba(255, 230, 10, 0.95)' },
          { name: 'k', angle: 45 * Math.PI / 180, color: 'rgba(20, 20, 20, 0.98)' }
        ];
        const diagonal = Math.hypot(W, H);

        channels.forEach((ch) => {
          cc.save();
          cc.translate(W / 2, H / 2);
          cc.rotate(ch.angle);
          cc.fillStyle = ch.color;
          cc.globalCompositeOperation = 'multiply';

          for (let gy = -diagonal / 2; gy < diagonal / 2; gy += spacing) {
            for (let gx = -diagonal / 2; gx < diagonal / 2; gx += spacing) {
              const cos = Math.cos(-ch.angle), sin = Math.sin(-ch.angle);
              const sx = Math.round(gx * cos - gy * sin + W / 2);
              const sy = Math.round(gx * sin + gy * cos + H / 2);
              if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
              const p = (sy * W + sx) * 4;
              const r = pixels[p] / 255, g = pixels[p + 1] / 255, b = pixels[p + 2] / 255;
              const k = 1 - Math.max(r, g, b);
              const c = (1 - r - k) / Math.max(0.001, 1 - k);
              const m = (1 - g - k) / Math.max(0.001, 1 - k);
              const yVal = (1 - b - k) / Math.max(0.001, 1 - k);
              const dotVal = ch.name === 'c' ? c : ch.name === 'm' ? m : ch.name === 'y' ? yVal : k;
              const radius = Math.max(0, dotVal * size * 0.68 * (0.35 + strength * 0.9));
              if (radius > 0.4) {
                cc.beginPath(); cc.arc(gx, gy, radius, 0, Math.PI * 2); cc.fill();
              }
            }
          }
          cc.restore();
        });
      });

      // 直接以高不透明度覆盖，形成极具辨识度的真实 CMYK 网屏印刷画报感
      tc.save();
      tc.globalAlpha = Math.min(1, 0.55 + strength * 0.45);
      tc.drawImage(cmykCanvas, 0, 0);
      tc.restore();      return;
    }

    // B. 半调图案「圆形 / 同心圆」 (Concentric Circle Halftone)
    if (o.halftoneShape === 'concentric') {
      const overlay = raster(W, H, () => {});
      const oc = overlay.getContext('2d');
      const centerX = W / 2, centerY = H / 2;
      const maxR = Math.hypot(centerX, centerY);
      const ringStep = Math.max(5, spacing * 0.95);
      const isDuotoneConcentric = !!o.duotone;
      oc.strokeStyle = isDuotoneConcentric ? (o.duotoneLight || '#9cb3ff') : '#111';
      for (let r = 0; r < maxR; r += ringStep) {
        const sampleCount = Math.max(12, Math.round(Math.PI * 2 * r / ringStep));
        let ringLum = 0;
        for (let a = 0; a < Math.PI * 2; a += (Math.PI * 2 / sampleCount)) {
          const sx = Math.max(0, Math.min(W - 1, Math.round(centerX + Math.cos(a) * r)));
          const sy = Math.max(0, Math.min(H - 1, Math.round(centerY + Math.sin(a) * r)));
          const p = (sy * W + sx) * 4;
          ringLum += (pixels[p] * .299 + pixels[p + 1] * .587 + pixels[p + 2] * .114);
        }
        ringLum /= sampleCount;
        const width = Math.max(0.6, (1 - ringLum / 255) * ringStep * 0.92 * strength);
        oc.lineWidth = width;
        oc.beginPath(); oc.arc(centerX, centerY, r, 0, Math.PI * 2); oc.stroke();
      }
      tc.save();
      tc.globalAlpha = Math.min(1, 0.45 + strength * 0.55);
      tc.globalCompositeOperation = isDuotoneConcentric ? 'screen' : 'multiply';
      tc.drawImage(overlay, 0, 0);
      tc.restore();
      return;
    }

    // B2. 半调图案「线条」 (Line / Scanline Halftone)
    if (o.halftoneShape === 'line') {
      const overlay = raster(W, H, () => {});
      const oc = overlay.getContext('2d');
      const angle = (o.halftoneAngle || 0) * Math.PI / 180;
      const lineStep = Math.max(3, spacing * 0.85);
      const diagonal = Math.hypot(W, H);
      oc.save();
      oc.translate(W / 2, H / 2);
      oc.rotate(angle);
      const isDuotoneLine = !!o.duotone;
      oc.strokeStyle = isDuotoneLine ? (o.duotoneLight || '#6ba0ff') : '#111';
      for (let gy = -diagonal / 2; gy < diagonal / 2; gy += lineStep) {
        let lineLum = 0, count = 0;
        for (let gx = -diagonal / 2; gx < diagonal / 2; gx += lineStep * 2) {
          const cos = Math.cos(-angle), sin = Math.sin(-angle);
          const sx = Math.round(gx * cos - gy * sin + W / 2);
          const sy = Math.round(gx * sin + gy * cos + H / 2);
          if (sx >= 0 && sy >= 0 && sx < W && sy < H) {
            const p = (sy * W + sx) * 4;
            lineLum += (pixels[p] * .299 + pixels[p + 1] * .587 + pixels[p + 2] * .114);
            count++;
          }
        }
        if (count > 0) lineLum /= count;
        const lw = Math.max(0.4, (1 - lineLum / 255) * lineStep * 0.9 * strength);
        oc.lineWidth = lw;
        oc.beginPath();
        oc.moveTo(-diagonal / 2, gy);
        oc.lineTo(diagonal / 2, gy);
        oc.stroke();
      }
      oc.restore();
      tc.save();
      tc.globalAlpha = Math.min(1, 0.45 + strength * 0.55);
      tc.globalCompositeOperation = isDuotoneLine ? 'screen' : 'multiply';
      tc.drawImage(overlay, 0, 0);
      tc.restore();
      return;
    }

    // C. 经典点状单色半调 (Dot Halftone)
    const overlay = raster(W, H, () => {}), oc = overlay.getContext('2d');
    const angle = (o.halftoneAngle || 0) * Math.PI / 180;
    const diagonal = Math.hypot(W, H);
    oc.save(); oc.translate(W / 2, H / 2); oc.rotate(angle); oc.fillStyle = '#111';
    for (let gy = -diagonal / 2; gy < diagonal / 2; gy += spacing) for (let gx = -diagonal / 2; gx < diagonal / 2; gx += spacing) {
      const cos = Math.cos(-angle), sin = Math.sin(-angle);
      const sx = Math.round(gx * cos - gy * sin + W / 2);
      const sy = Math.round(gx * sin + gy * cos + H / 2);
      if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
      const p = (sy * W + sx) * 4;
      const l = pixels[p] * .299 + pixels[p + 1] * .587 + pixels[p + 2] * .114;
      const radius = Math.max(.2, (1 - l / 255) * size * .52 * Math.min(1.6, 0.35 + strength * 1.15));
      oc.beginPath(); oc.arc(gx, gy, radius, 0, Math.PI * 2); oc.fill();
    }
    oc.restore();
    tc.save();
    tc.globalAlpha = Math.min(1, 0.45 + strength * 0.55);
    tc.globalCompositeOperation = 'multiply';
    tc.drawImage(overlay, 0, 0);
    tc.restore();
  }

  function surfaceTexture(target, o) {
    const tc = target.getContext('2d');
    if (o.paper) {
      const alpha = Math.min(0.92, Math.pow(o.paper / 100, 0.72) * 0.8);
      tc.save();
      tc.globalAlpha = alpha * 0.32;
      tc.fillStyle = '#d4cbbd';
      tc.fillRect(0, 0, target.width, target.height);
      tc.globalAlpha = alpha * 0.82;
      tc.fillStyle = '#372f23';
      const fiberCount = Math.round(1400 + (o.paper / 100) * 2600);
      for (let i = 0; i < fiberCount; i++) {
        tc.fillRect(noise(i * 3.7 + 1) * target.width, noise(i * 7.1 + 2) * target.height, noise(i * 11.3) * 2.8 + .5, noise(i * 13.9) * 11 + 1.2);
      }
      tc.globalAlpha = alpha * 0.42;
      tc.fillStyle = '#fffdf7';
      for (let i = 0; i < fiberCount * 0.4; i++) {
        tc.fillRect(noise(i * 17.3 + 5) * target.width, noise(i * 19.9 + 7) * target.height, noise(i * 23.1) * 2 + .4, noise(i * 29.5) * 8 + 1);
      }
      tc.restore();
    }
    if (o.scan) {
      const alpha = Math.min(0.88, 0.14 + Math.pow(o.scan / 100, 0.8) * 0.74);
      tc.save();
      tc.globalAlpha = alpha;
      tc.strokeStyle = '#0d0d0d';
      tc.lineWidth = 1;
      const step = Math.max(3, Math.round(9 - (o.scan / 100) * 5));
      const isVertical = Math.abs(o.scanAngle || 0) > 45;
      if (isVertical) {
        for (let x = 0; x < target.width; x += step) {
          tc.beginPath(); tc.moveTo(x, 0); tc.lineTo(x, target.height); tc.stroke();
        }
      } else {
        for (let y = 0; y < target.height; y += step) {
          tc.beginPath(); tc.moveTo(0, y); tc.lineTo(target.width, y); tc.stroke();
        }
      }
      tc.restore();
    }
    if (o.dirty) {
      const alpha = Math.min(0.92, 0.18 + Math.pow(o.dirty / 100, 0.75) * 0.74);
      tc.save();
      tc.fillStyle = '#11100e';
      tc.globalAlpha = alpha;
      const count = Math.round(70 + (o.dirty / 100) * 350);
      for (let i = 0; i < count; i++) {
        const x = noise(i * 19 + 4) * target.width, y = noise(i * 23 + 6) * target.height;
        const rw = (1 + noise(i * 29) * (o.dirty * .42 + 4)), rh = (1 + noise(i * 31) * (o.dirty * .22 + 3));
        tc.save();
        tc.translate(x, y);
        tc.rotate(noise(i * 37) * Math.PI);
        tc.fillRect(-rw / 2, -rh / 2, rw, rh);
        tc.restore();
      }
      const smudgeCount = Math.round(2 + (o.dirty / 100) * 16);
      for (let i = 0; i < smudgeCount; i++) {
        const sx = noise(i * 41 + 11) * target.width, sy = noise(i * 43 + 13) * target.height;
        const sr = 3 + noise(i * 47) * (o.dirty * .35 + 8);
        tc.save();
        tc.globalAlpha = alpha * 0.55;
        tc.beginPath();
        tc.arc(sx, sy, sr, 0, Math.PI * 2);
        tc.fill();
        tc.restore();
      }
      tc.restore();
    }
  }

  function filteredImage(source, rect, w, h, o) {
    const result = raster(w, h, (rc, target) => {
      rc.filter = `grayscale(${Math.max(0, Math.min(100, o.bw || 0))}%) brightness(${Math.max(5, 100 + (o.brightness || 0))}%) contrast(${Math.max(5, 100 + (o.contrast || 0))}%) saturate(${Math.max(0, o.saturation ?? 100)}%) invert(${Math.max(0, Math.min(100, o.invert || 0))}%)`;
      if (rect) {
        // Cover the card with one uniform scale; crop excess edges, never stretch faces.
        // Use logical dimensions so rounding the raster canvas cannot distort the final draw.
        const scale = Math.max(w / rect.sw, h / rect.sh), sw = w / scale, sh = h / scale;
        rc.drawImage(source, rect.sx+(rect.sw-sw)/2, rect.sy+(rect.sh-sh)/2, sw, sh, 0, 0, target.width, target.height);
      }
      else { const cover = getCover(), box = state.main || imageBox; rc.drawImage(source, cover.x - box.x, cover.y - box.y, cover.w, cover.h); }
      rc.filter = 'none';
    });
    pixelEffects(result, o); halftone(result, o); surfaceTexture(result, o); return result;
  }

  function detailOptions(d) {
    const o = {
      bw: 0, brightness: d.brightness || 0, contrast: d.contrast || 0, saturation: d.saturation ?? 100,
      grain: d.grain || 0, rough: 0, outline: 0, invert: 0, posterize: 0, compression: 0, scan: 0,
      paper: 0, dirty: 0, halftone: 0, halftoneSize: d.halftoneSize || 8, halftoneDensity: d.halftoneDensity || 55,
      halftoneAngle: d.halftoneAngle || 15, colorHalftone: false, halftoneShape: 'dot',
      glass: 0, glassSize: d.glassSize || 32, mosaic: 0, mosaicSize: d.mosaicSize || 18, mosaicStyle: 'sharp',
      dither: 0, ditherStep: d.ditherStep || 4, ditherInvert: false, threshold: 0, thresholdLevel: 128,
      duotone: false, duotoneDark: d.duotoneDark || '#182678', duotoneLight: d.duotoneLight || '#f5af2d'
    };

    const type = d.filterType || 'original';

    // 1. 彩色半调 (Color Halftone / 胶印像素化分色)
    if (type === 'color_halftone') {
      o.contrast += 18;
      o.saturation = Math.max(120, o.saturation + 15);
      o.halftone = d.halftoneStrength || 85;
      o.colorHalftone = true;
      if (d.duotone) {
        o.duotone = true;
        o.duotoneDark = d.duotoneDark || '#122db5';
        o.duotoneLight = d.duotoneLight || '#dbe8ff';
      }
    }
    // 2. 单色半调「点状」 (Dot Halftone / 强调色点阵)
    else if (type === 'dot_halftone' || type === 'halftone') {
      o.bw = 100;
      o.contrast += 35;
      o.halftone = d.halftoneStrength || 75;
      o.halftoneShape = 'dot';
    }
    // 3. 半调图案「圆形」+ 颗粒 (Concentric Circle Halftone + Grain)
    else if (type === 'circle_halftone') {
      o.bw = 100;
      o.contrast += 25;
      o.grain = Math.max(22, o.grain || 25);
      o.halftone = d.halftoneStrength || 80;
      o.halftoneShape = 'concentric';
      if (d.duotone) {
        o.duotone = true;
        o.duotoneDark = d.duotoneDark || '#0b1a3d';
        o.duotoneLight = d.duotoneLight || '#9cb3ff';
      }
    }
    // 3b. 半调图案「线条」 (Line Halftone + Duotone)
    else if (type === 'line_halftone') {
      o.bw = 100;
      o.contrast += 25;
      o.halftone = d.halftoneStrength || 80;
      o.halftoneShape = 'line';
      o.halftoneAngle = d.halftoneAngle || 0;
      o.duotone = true;
      o.duotoneDark = d.duotoneDark || '#14225a';
      o.duotoneLight = d.duotoneLight || '#82b1ff';
    }
    // 4. 玻璃「块状」 (Glass Brick / Refraction)
    else if (type === 'glass') {
      o.glass = 85;
      o.contrast += 16;
      o.saturation = Math.max(110, o.saturation + 10);
    }
    // 5. 马赛克 (像素化) + 增强锐化 (Mosaic Pixelate + Sharpen)
    else if (type === 'mosaic_sharp') {
      o.mosaic = 100;
      o.mosaicStyle = 'sharp';
      o.contrast += 25;
      o.saturation = Math.max(115, o.saturation + 10);
    }
    // 6. 马赛克拼贴 + 颗粒 (Mosaic Facet Tiles + Grain)
    else if (type === 'mosaic_tile') {
      o.mosaic = 100;
      o.mosaicStyle = 'facet';
      o.grain = Math.max(28, o.grain || 30);
      o.contrast += 18;
    }
    // 7. 渐变映射 + 颗粒 (双色调 Duotone High Contrast + Grain)
    else if (type === 'duotone') {
      o.duotone = true;
      o.grain = Math.max(24, o.grain || 26);
      o.contrast += 22;
      o.duotoneDark = d.duotoneDark || '#162772'; // 深蓝紫
      o.duotoneLight = d.duotoneLight || '#fca311'; // 金黄
    }
    // 8. 渐变映射 (柔和微调 / 氛围单色渐变)
    else if (type === 'gradient_map') {
      o.duotone = true;
      o.contrast += 8;
      o.duotoneDark = d.duotoneDark || '#2b2353'; // 柔和暗紫
      o.duotoneLight = d.duotoneLight || '#9bb1ff'; // 柔和蓝粉高光
    }
    // 9. 位图：20 像素 (Bayer Dither 纯点刻抖动)
    else if (type === 'dither') {
      o.dither = 100;
      o.ditherStep = d.ditherStep || 4;
      o.contrast += 20;
    }
    // 10. 阈值 + 颗粒 (黑白强对比复印 Threshold + Grain)
    else if (type === 'threshold' || type === 'highbw') {
      o.threshold = 100;
      o.grain = Math.max(35, o.grain || 35);
      o.thresholdLevel = d.thresholdLevel || 124;
    }
    // 兼容原有的黑白与描边
    else if (type === 'bw') {
      o.bw = 100;
    }
    else if (type === 'outline') {
      o.bw = 100;
      o.outline = 100;
      o.contrast += 20;
    }
    else if (type === 'rough') {
      o.contrast += 28;
      o.grain = Math.max(35, o.grain);
      o.rough = 52;
      o.dirty = 35;
      o.scan = 25;
    }
    else if (type === 'invert') {
      o.invert = 100;
    }
    else if (type === 'posterize') {
      o.posterize = 78;
      o.contrast += 22;
    }
    else if (type === 'original') {
      // 原色微增强
      o.contrast += 6;
      o.saturation = Math.max(105, o.saturation);
    }
    return o;
  }

  function selectedObject() {
    if (!state.selected) return null;
    if (state.selected.type === 'main') return state.main;
    if (state.selected.type === 'secondary') return state.secondaries.find((v) => v.id === state.selected.id) || null;
    if (state.selected.type === 'fragment') return state.fragments.find((v) => v.id === state.selected.id) || null;
    if (state.selected.type === 'frame') return state.frames.find((v) => v.id === state.selected.id) || null;
    if (state.selected.type === 'detail' || state.selected.type === 'connector') return state.details.find((v) => v.id === state.selected.id) || null;
    return state.texts.find((v) => v.id === state.selected.id) || null;
  }
  function setSelected(type, item) { state.selected = item ? { type, id: item.id } : null; renderInspector(); }
  function frameById(frameId) { return state.frames.find((v) => v.id === frameId); }
  function layerIndex(type, layerId) { return state.layers.findIndex((v) => v.type === type && v.id === layerId); }
  function addLayer(type, layerId, after = state.layers.length - 1) { state.layers.splice(Math.max(0, after + 1), 0, { type, id: layerId }); }
  function rotatePoint(x, y, cx, cy, deg) { const a = deg * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a); return { x: cx + (x - cx) * cos - (y - cy) * sin, y: cy + (x - cx) * sin + (y - cy) * cos }; }
  function transformBox(tc, item) { tc.translate(item.x + item.w / 2, item.y + item.h / 2); tc.rotate((item.rotation || 0) * Math.PI / 180); tc.translate(-item.w / 2, -item.h / 2); }

  function labelText(f) { return f.autoNumber ? `${f.labelPrefix || 'ITEM'} / ${String(f.labelNumber || 1).padStart(2, '0')}` : f.label || ''; }
  function strokeFrameShape(tc, f) {
    if (f.frameStyle !== 'corner') return tc.strokeRect(0, 0, f.w, f.h);
    const corner = Math.max(18, Math.min(f.w, f.h) * .24);
    tc.beginPath();
    tc.moveTo(0, corner); tc.lineTo(0, 0); tc.lineTo(corner, 0);
    tc.moveTo(f.w - corner, 0); tc.lineTo(f.w, 0); tc.lineTo(f.w, corner);
    tc.moveTo(f.w, f.h - corner); tc.lineTo(f.w, f.h); tc.lineTo(f.w - corner, f.h);
    tc.moveTo(corner, f.h); tc.lineTo(0, f.h); tc.lineTo(0, f.h - corner);
    tc.stroke();
  }
  function drawFrame(f) {
    ctx.save(); transformBox(ctx, f); ctx.strokeStyle = f.color; ctx.lineWidth = f.lineWidth; ctx.globalAlpha = (f.strokeOpacity ?? 100) / 100; ctx.setLineDash(f.strokeStyle === 'dashed' ? [12, 9] : []); strokeFrameShape(ctx, f); ctx.globalAlpha = 1; ctx.setLineDash([]);
    const text = labelText(f); if (f.showLabel && text) {
      ctx.font = `700 ${f.labelSize}px ui-monospace,Consolas,monospace`; const px = 8, tw = ctx.measureText(text).width + px * 2, th = f.labelSize + 12;
      let tx = 0, ty = -th;
      if (f.tagPosition === 'bottom-left') { tx = 0; ty = f.h; }
      else if (f.tagPosition === 'bottom-right') { tx = f.w - tw; ty = f.h; }
      else if (f.tagPosition === 'top-right') { tx = f.w - tw; ty = -th; }
      if (f.tagStyle === 'solid') { ctx.fillStyle = f.tagBackground; ctx.fillRect(tx, ty, tw, th); }
      if (f.tagStyle === 'plain') { ctx.fillStyle = 'rgba(255,255,255,.82)'; ctx.fillRect(tx, ty, tw, th); }
      if (f.tagStyle === 'outline') { ctx.strokeStyle = f.tagBackground; ctx.lineWidth = 1.5; ctx.strokeRect(tx, ty, tw, th); }
      ctx.fillStyle = f.tagStyle === 'solid' ? (f.tagTextColor || f.tagColor || '#fff') : f.color; ctx.fillText(text.toUpperCase(), tx + px, ty + th - 4);
    }
    if (f.showHandles) {
      const handleSize = f.handleSize || 7;
      const half = handleSize / 2;
      const pts = [
        [0, 0], [f.w / 2, 0], [f.w, 0],
        [0, f.h / 2], [f.w, f.h / 2],
        [0, f.h], [f.w / 2, f.h], [f.w, f.h]
      ];
      ctx.fillStyle = f.handleColor || '#ffffff';
      ctx.strokeStyle = f.handleStrokeColor || f.color || '#fbcfe8';
      ctx.lineWidth = 1.2;
      pts.forEach(([hx, hy]) => {
        ctx.fillRect(hx - half, hy - half, handleSize, handleSize);
        ctx.strokeRect(hx - half, hy - half, handleSize, handleSize);
      });
    }
    ctx.restore();
  }
  function connectorPoints(d) { const f = frameById(d.frameId); return f ? { start: { x: f.x + f.w / 2, y: f.y + f.h / 2 }, end: { x: d.x + d.w / 2, y: d.y + d.h / 2 } } : null; }
  function endpoint(p, style, width) { if (style === 'dot') { ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(3, width * 1.7), 0, Math.PI * 2); ctx.fill(); } if (style === 'cross') { const s = Math.max(5, width * 2.2); ctx.beginPath(); ctx.moveTo(p.x - s, p.y); ctx.lineTo(p.x + s, p.y); ctx.moveTo(p.x, p.y - s); ctx.lineTo(p.x, p.y + s); ctx.stroke(); } }
  function segmentIntersectsRect(x1, y1, x2, y2, rect) {
    const minRx = rect.x, maxRx = rect.x + rect.w, minRy = rect.y, maxRy = rect.y + rect.h;
    if ((x1 >= minRx && x1 <= maxRx && y1 >= minRy && y1 <= maxRy) ||
        (x2 >= minRx && x2 <= maxRx && y2 >= minRy && y2 <= maxRy)) return true;
    const lineIntersects = (ax, ay, bx, by, cx, cy, dx, dy) => {
      const denom = (dy - cy) * (bx - ax) - (dx - cx) * (by - ay);
      if (denom === 0) return false;
      const ua = ((dx - cx) * (ay - cy) - (dy - cy) * (ax - cx)) / denom;
      const ub = ((bx - ax) * (ay - cy) - (by - ay) * (ax - cx)) / denom;
      return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
    };
    return lineIntersects(x1, y1, x2, y2, minRx, minRy, maxRx, minRy) ||
           lineIntersects(x1, y1, x2, y2, maxRx, minRy, maxRx, maxRy) ||
           lineIntersects(x1, y1, x2, y2, maxRx, maxRy, minRx, maxRy) ||
           lineIntersects(x1, y1, x2, y2, minRx, maxRy, minRx, minRy);
  }

  function getElbowRoute(start, end, detail) {
    const midX = start.x + (end.x - start.x) * 0.52;
    const midY = start.y + (end.y - start.y) * 0.52;
    const routeH = [
      { x1: start.x, y1: start.y, x2: midX, y2: start.y },
      { x1: midX, y1: start.y, x2: midX, y2: end.y },
      { x1: midX, y1: end.y, x2: end.x, y2: end.y },
    ];
    const routeV = [
      { x1: start.x, y1: start.y, x2: start.x, y2: midY },
      { x1: start.x, y1: midY, x2: end.x, y2: midY },
      { x1: end.x, y1: midY, x2: end.x, y2: end.y },
    ];

    const obstacles = [];
    const f = frameById(detail?.frameId);
    const parentId = f?.sourceId || 'main';

    if (parentId !== 'main' && state.main) {
      obstacles.push({ x: state.main.x + 10, y: state.main.y + 10, w: Math.max(10, state.main.w - 20), h: Math.max(10, state.main.h - 20) });
    }
    (state.secondaries || []).forEach((s) => {
      if (s.id !== parentId) {
        obstacles.push({ x: s.x + 8, y: s.y + 8, w: Math.max(10, s.w - 16), h: Math.max(10, s.h - 16) });
      }
    });
    state.texts.filter((t) => t.kind === 'hero').forEach((h) => {
      const b = textBounds(h);
      obstacles.push({ x: b.x, y: b.y, w: b.w, h: b.h });
    });
    (state.details || []).forEach((other) => {
      if (other.id !== detail?.id) {
        obstacles.push({ x: other.x, y: other.y, w: other.w, h: other.h });
      }
    });

    let countH = 0, countV = 0;
    for (const seg of routeH) for (const obs of obstacles) if (segmentIntersectsRect(seg.x1, seg.y1, seg.x2, seg.y2, obs)) countH++;
    for (const seg of routeV) for (const obs of obstacles) if (segmentIntersectsRect(seg.x1, seg.y1, seg.x2, seg.y2, obs)) countV++;

    return countV < countH ? 'vertical' : 'horizontal';
  }

  function drawConnector(d) {
    const p = connectorPoints(d); if (!p) return; ctx.save(); ctx.globalAlpha = (d.lineOpacity ?? 100) / 100; ctx.strokeStyle = d.lineColor || d.color || '#bd2e35'; ctx.fillStyle = d.lineColor || d.color || '#bd2e35'; ctx.lineWidth = d.connectorWidth || 2; ctx.setLineDash(d.connectorDash ? [7, 6] : []); ctx.beginPath(); ctx.moveTo(p.start.x, p.start.y);
    if (d.connectorType === 'elbow') {
      const mode = getElbowRoute(p.start, p.end, d);
      if (mode === 'vertical') {
        const by = p.start.y + (p.end.y - p.start.y) * 0.52;
        ctx.lineTo(p.start.x, by);
        ctx.lineTo(p.end.x, by);
      } else {
        const bx = p.start.x + (p.end.x - p.start.x) * 0.52;
        ctx.lineTo(bx, p.start.y);
        ctx.lineTo(bx, p.end.y);
      }
    }
    ctx.lineTo(p.end.x, p.end.y); ctx.stroke(); endpoint(p.start, d.endpointStyle, ctx.lineWidth); endpoint(p.end, d.endpointStyle, ctx.lineWidth); ctx.restore();
  }
  function drawDetail(d) {
    const f = frameById(d.frameId); if (!f) return;
    const srcImg = getSourceImageForFrame(f); if (!srcImg) return;
    const rect = sourceRect(f); if (!rect) return;
    const isTargetBefore = isBeforePreviewActive && state.selected?.type === 'detail' && state.selected.id === d.id;
    const opts = isTargetBefore ? { bw:0, brightness:0, contrast:0, saturation:100, grain:0, rough:0, outline:0, invert:0, posterize:0, compression:0, scan:0, paper:0, dirty:0, halftone:0 } : detailOptions(d);
    const cut = filteredImage(srcImg, rect, d.w, d.h, opts);
    ctx.save(); ctx.globalAlpha = (d.opacity ?? 100) / 100; transformBox(ctx, d); ctx.fillStyle = d.backingColor || '#fff'; ctx.fillRect(-3, -3, d.w + 6, d.h + 6); ctx.drawImage(cut, 0, 0, d.w, d.h); ctx.strokeStyle = d.color; ctx.lineWidth = d.lineWidth; ctx.strokeRect(0, 0, d.w, d.h);
    if (d.showHandles) {
      const handleSize = d.handleSize || 7;
      const half = handleSize / 2;
      const pts = [
        [0, 0], [d.w / 2, 0], [d.w, 0],
        [0, d.h / 2], [d.w, d.h / 2],
        [0, d.h], [d.w / 2, d.h], [d.w, d.h]
      ];
      ctx.fillStyle = d.handleColor || '#ffffff';
      ctx.strokeStyle = d.handleStrokeColor || d.color || '#fbcfe8';
      ctx.lineWidth = 1.2;
      pts.forEach(([hx, hy]) => {
        ctx.fillRect(hx - half, hy - half, handleSize, handleSize);
        ctx.strokeRect(hx - half, hy - half, handleSize, handleSize);
      });
    }
    if (d.showTag !== false && (d.tagText || (f && f.showLabel && labelText(f)))) {
      const text = d.tagText || (f ? labelText(f) : '');
      if (text) {
        const tagSize = d.tagSize || 13;
        ctx.font = `700 ${tagSize}px ui-monospace,Consolas,monospace`;
        const px = 8, tw = ctx.measureText(text).width + px * 2, th = tagSize + 12;
        let tx = 0, ty = d.h;
        if (d.tagPosition === 'bottom-left') { tx = 0; ty = d.h; }
        else if (d.tagPosition === 'bottom-right') { tx = d.w - tw; ty = d.h; }
        else if (d.tagPosition === 'top-left') { tx = 0; ty = -th; }
        else if (d.tagPosition === 'top-right') { tx = d.w - tw; ty = -th; }
        ctx.fillStyle = d.tagBackground || d.color || '#002FA7';
        ctx.fillRect(tx, ty, tw, th);
        ctx.fillStyle = d.tagTextColor || '#ffffff';
        ctx.fillText(text.toUpperCase(), tx + px, ty + th - 4);
      }
    }
    ctx.restore();
  }
  function drawSecondaryImage(s) {
    const asset = imageAssets.get(s.imageId);
    const img = asset?.image;
    if (!img) return;
    const isTargetBefore = isBeforePreviewActive && state.selected?.type === 'secondary' && state.selected.id === s.id;
    const opts = isTargetBefore ? cleanFilters() : (s.filters || cleanFilters());
    const iw = img.naturalWidth || s.w;
    const ih = img.naturalHeight || s.h;
    const scale = Math.max(s.w / iw, s.h / ih);
    const sw = Math.min(iw, s.w / scale);
    const sh = Math.min(ih, s.h / scale);
    const sx = Math.max(0, (iw - sw) / 2);
    const sy = Math.max(0, (ih - sh) / 2);
    const cut = filteredImage(img, { sx, sy, sw, sh }, s.w, s.h, opts);
    ctx.save(); ctx.globalAlpha = (s.opacity ?? 100) / 100; transformBox(ctx, s);
    if (s.backingColor) { ctx.fillStyle = s.backingColor; ctx.fillRect(-2, -2, s.w + 4, s.h + 4); }
    ctx.drawImage(cut, 0, 0, s.w, s.h);
    if (s.lineWidth && s.color) { ctx.strokeStyle = s.color; ctx.lineWidth = s.lineWidth; ctx.strokeRect(0, 0, s.w, s.h); }
    ctx.restore();
  }
  function fragmentSourceRect(fragment) {
    if (typeof fragment.source === 'object' && fragment.source && fragment.source.x !== undefined) {
      return { sx: fragment.source.x * state.image.naturalWidth, sy: fragment.source.y * state.image.naturalHeight, sw: fragment.source.w * state.image.naturalWidth, sh: fragment.source.h * state.image.naturalHeight };
    }
    const scaleX = state.image.naturalWidth / W;
    const scaleY = state.image.naturalHeight / H;
    return {
      sx: Math.max(0, Math.min(state.image.naturalWidth - 10, fragment.x * scaleX)),
      sy: Math.max(0, Math.min(state.image.naturalHeight - 10, fragment.y * scaleY)),
      sw: Math.max(10, Math.min(state.image.naturalWidth, fragment.w * scaleX)),
      sh: Math.max(10, Math.min(state.image.naturalHeight, fragment.h * scaleY))
    };
  }
  function drawFragment(fragment) {
    if (!state.image) return;
    const isTargetBefore = isBeforePreviewActive && state.selected?.type === 'fragment' && state.selected.id === fragment.id;
    const opts = isTargetBefore ? { bw:0, brightness:0, contrast:0, saturation:100, grain:0, rough:0, outline:0, invert:0, posterize:0, compression:0, scan:0, paper:0, dirty:0, halftone:0 } : detailOptions(fragment);
    const cut = filteredImage(state.image, fragmentSourceRect(fragment), fragment.w, fragment.h, opts);
    ctx.save();
    ctx.globalAlpha = (fragment.opacity ?? 100) / 100;
    transformBox(ctx, fragment);
    if (fragment.backingColor) {
      ctx.fillStyle = fragment.backingColor;
      ctx.fillRect(0, 0, fragment.w, fragment.h);
    }
    ctx.drawImage(cut, 0, 0, fragment.w, fragment.h);
    if (fragment.lineWidth) {
      ctx.strokeStyle = fragment.color || '#fff';
      ctx.lineWidth = fragment.lineWidth;
      ctx.strokeRect(0, 0, fragment.w, fragment.h);
    }
    ctx.restore();
  }

  function measureLine(line, spacing) { return ctx.measureText(line).width + Math.max(0, line.length - 1) * spacing; }
  function spacedLine(line, spacing, x, y, align = 'left', strokeColor = null, strokeWidth = 0) {
    const width = measureLine(line, spacing);
    let cursor = x - (align === 'center' ? width / 2 : align === 'right' ? width : 0);
    if (!spacing) {
      if (strokeColor && strokeWidth) {
        ctx.save();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.strokeText(line, cursor, y);
        ctx.restore();
      }
      return ctx.fillText(line, cursor, y);
    }
    for (const ch of line) {
      if (strokeColor && strokeWidth) {
        ctx.save();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.strokeText(ch, cursor, y);
        ctx.restore();
      }
      ctx.fillText(ch, cursor, y);
      cursor += ctx.measureText(ch).width + spacing;
    }
  }
  function drawText(t) {
    ctx.save(); ctx.translate(t.x, t.y); ctx.rotate((t.rotation || 0) * Math.PI / 180); ctx.scale(t.scaleX || 1, t.scaleY || 1); ctx.globalAlpha = (t.opacity ?? 100) / 100;
    const lh = t.lineHeight || 1.15;
    if (t.badgeShape === 'pick') {
      ctx.save();
      const bw = t.badgeWidth || 116, bh = t.badgeHeight || 128;
      const lines = t.content.split('\n');
      const totalH = lines.length * t.size * lh;
      ctx.translate(0, totalH * 0.44);
      ctx.fillStyle = t.badgeColor || '#002fa7';
      ctx.beginPath();
      ctx.moveTo(-bw * 0.44, -bh * 0.38);
      ctx.quadraticCurveTo(0, -bh * 0.50, bw * 0.44, -bh * 0.38);
      ctx.quadraticCurveTo(bw * 0.52, 0, bw * 0.22, bh * 0.44);
      ctx.quadraticCurveTo(0, bh * 0.58, -bw * 0.22, bh * 0.44);
      ctx.quadraticCurveTo(-bw * 0.52, 0, -bw * 0.44, -bh * 0.38);
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.restore();
    }
    else if (t.badgeShape === 'ps-icon' || t.badgeShape === 'app-icon') {
      ctx.save();
      const bw = t.badgeWidth || 54, bh = t.badgeHeight || 54, r = 12;
      const totalH = t.size * lh;
      ctx.translate(0, totalH * 0.5);
      ctx.fillStyle = t.badgeColor || '#001e36';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-bw / 2, -bh / 2, bw, bh, r);
      else ctx.rect(-bw / 2, -bh / 2, bw, bh);
      ctx.fill();
      ctx.strokeStyle = t.badgeBorderColor || '#1473e6';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    }
    if (t.backgroundColor) {
      ctx.save();
      ctx.font = `${t.weight} ${t.size}px ${t.font}`;
      const lines = t.content.split('\n');
      const maxW = Math.max(...lines.map(l => measureLine(l, t.letterSpacing || 0)));
      const px = t.backgroundPaddingX ?? 7, py = t.backgroundPaddingY ?? 3;
      const totalH = lines.length * t.size * lh;
      const bgX = (t.align === 'center' ? -maxW / 2 : t.align === 'right' ? -maxW : 0) - px;
      ctx.fillStyle = t.backgroundColor;
      ctx.fillRect(bgX, -py, maxW + px * 2, totalH + py * 2);
      ctx.restore();
    }
    ctx.fillStyle = t.color; ctx.font = `${t.weight} ${t.size}px ${t.font}`; ctx.textBaseline = 'top';
    if (t.kind === 'repeat' && (t.repeat || 1) > 1) for (let i = 0; i < t.repeat; i++) {
      const width = measureLine(t.content, t.letterSpacing || 0),
            x = i * ((t.direction === 'horizontal' ? width + (t.repeatSpacing || 0) : 0) + (t.repeatOffsetX || 0)),
            y = i * ((t.direction === 'vertical' ? t.size * lh + (t.repeatSpacing || 0) : 0) + (t.repeatOffsetY || 0));
      ctx.save(); ctx.translate(x, y); ctx.rotate(i * (t.rotationStep || 0) * Math.PI / 180);
      spacedLine(t.content, t.letterSpacing || 0, 0, 0, t.align || 'left', t.strokeColor, t.strokeWidth);
      ctx.restore();
    }
    else if (t.writingMode === 'vertical') [...t.content.replace(/\n/g, '')].forEach((ch, i) => spacedLine(ch, 0, 0, i * t.size * lh, t.align || 'left', t.strokeColor, t.strokeWidth));
    else {
      const lines = t.content.split('\n');
      lines.forEach((line, i) => spacedLine(line, t.letterSpacing || 0, 0, i * t.size * lh, t.align || 'left', t.strokeColor, t.strokeWidth));
      if (t.strikeThrough) {
        ctx.save();
        ctx.strokeStyle = t.strikeThroughColor || '#ff2244';
        ctx.lineWidth = t.strikeThroughWidth || Math.max(3, t.size * 0.16);
        ctx.lineCap = 'round';
        lines.forEach((line, i) => {
          const w = measureLine(line, t.letterSpacing || 0);
          const startX = t.align === 'center' ? -w / 2 : t.align === 'right' ? -w : 0;
          const strikeY = i * t.size * lh + t.size * 0.52;
          ctx.beginPath();
          ctx.moveTo(startX - 6, strikeY + 2);
          ctx.lineTo(startX + w + 8, strikeY - 3);
          ctx.stroke();
          ctx.lineWidth = (t.strikeThroughWidth || Math.max(3, t.size * 0.16)) * 0.45;
          ctx.beginPath();
          ctx.moveTo(startX - 2, strikeY - 3);
          ctx.lineTo(startX + w + 4, strikeY + 3);
          ctx.stroke();
        });
        ctx.restore();
      }
    }
    ctx.restore();
  }
  function textBounds(t) {
    ctx.save(); ctx.font = `${t.weight} ${t.size}px ${t.font}`;
    const lh = t.lineHeight || 1.15;
    const lines = t.content.split('\n');
    let w = Math.max(...lines.map((line) => measureLine(line, t.letterSpacing || 0)), 10), h = t.size * lines.length * lh, minX = 0, minY = 0;
    if (t.writingMode === 'vertical' && t.kind !== 'repeat') { w = t.size; h = Math.max(1, t.content.replace(/\n/g, '').length) * t.size * lh; }
    if (t.kind === 'repeat') {
      const lw = measureLine(t.content, t.letterSpacing || 0), count = Math.max(1, t.repeat);
      const dx = (t.direction === 'horizontal' ? lw + (t.repeatSpacing || 0) : 0) + (t.repeatOffsetX || 0),
            dy = (t.direction === 'vertical' ? t.size * lh + (t.repeatSpacing || 0) : 0) + (t.repeatOffsetY || 0);
      minX = Math.min(0, dx * (count - 1)); minY = Math.min(0, dy * (count - 1));
      w = lw + Math.abs(dx) * (count - 1); h = t.size * lh + Math.abs(dy) * (count - 1);
    }
    const alignShift = t.align === 'center' ? -w / 2 : t.align === 'right' ? -w : 0;
    ctx.restore();
    return { x: t.x + (minX + alignShift) * (t.scaleX || 1), y: t.y + minY * (t.scaleY || 1), w: w * (t.scaleX || 1), h: h * (t.scaleY || 1), rotation: t.rotation || 0 };
  }
  function boundsOf(item, type) { return type === 'text' ? textBounds(item) : { x: item.x, y: item.y, w: item.w, h: item.h, rotation: item.rotation || 0 }; }
  function drawSelection() { const item = selectedObject(); if (!item || state.selected.type === 'connector') return; const b = boundsOf(item, state.selected.type); ctx.save(); transformBox(ctx, b); ctx.strokeStyle = '#151515'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]); ctx.strokeRect(-4, -4, b.w + 8, b.h + 8); if (state.selected.type !== 'text') { ctx.setLineDash([]); ctx.fillStyle = '#151515'; ctx.fillRect(b.w - 7, b.h - 7, 14, 14); } ctx.restore(); }
  function drawMainImage() {
    if (!state.image) return;
    const box = state.main || makeMain();
    const isTargetBefore = isBeforePreviewActive && (!state.selected || state.selected.type === 'main');
    const main = filteredImage(state.image, null, box.w, box.h, isTargetBefore ? cleanFilters() : state.filters);
    ctx.save(); ctx.globalAlpha = (box.opacity ?? 100) / 100; transformBox(ctx, box);
    if (box.fragmented && !isTargetBefore) {
      const bandH = box.h / 3, shifts = [-14,18,-9];
      for (let i = 0; i < 3; i++) {
        ctx.save(); ctx.beginPath(); ctx.rect(0, i * bandH + 3, box.w, bandH - 6); ctx.clip(); ctx.drawImage(main, shifts[i], 0, box.w, box.h); ctx.restore();
      }
    } else {
      ctx.drawImage(main, 0, 0, box.w, box.h);
    }
    if (box.lineWidth && box.color) {
      ctx.strokeStyle = box.color;
      ctx.lineWidth = box.lineWidth;
      ctx.strokeRect(0, 0, box.w, box.h);
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, box.w, box.h);
    }
    ctx.restore();
  }
  function drawLayer(layer) {
    if (layer.type === 'main') drawMainImage();
    if (layer.type === 'secondary') { const s = state.secondaries?.find((v) => v.id === layer.id); if (s) drawSecondaryImage(s); }
    if (layer.type === 'fragment') { const f = state.fragments.find((v) => v.id === layer.id); if (f) drawFragment(f); }
    if (layer.type === 'connector') { const d = state.details.find((v) => v.id === layer.id); if (d) drawConnector(d); }
    if (layer.type === 'frame') { const f = state.frames.find((v) => v.id === layer.id); if (f) drawFrame(f); }
    if (layer.type === 'detail') { const d = state.details.find((v) => v.id === layer.id); if (d) drawDetail(d); }
    if (layer.type === 'text') { const t = state.texts.find((v) => v.id === layer.id); if (t) drawText(t); }
  }
  function ensureMainLayer() { if (state.image && !state.layers.some((v) => v.type === 'main')) state.layers.unshift({ type: 'main', id: 'main-image' }); }
  function render(showSelection = true) { ctx.clearRect(0, 0, W, H); drawPosterBackground(); if (!state.image) { ctx.strokeStyle = 'rgba(20,20,20,.08)'; for (let n = 25; n < W; n += 50) { ctx.beginPath(); ctx.moveTo(n, 0); ctx.lineTo(n, H); ctx.stroke(); } for (let n = 25; n < H; n += 50) { ctx.beginPath(); ctx.moveTo(0, n); ctx.lineTo(W, n); ctx.stroke(); } } ensureMainLayer(); state.layers.forEach(drawLayer); if (state.border) { ctx.strokeStyle = state.borderColor; ctx.lineWidth = state.borderWidth; ctx.strokeRect(18, 18, W - 36, H - 36); } if (showSelection) drawSelection(); }
  let renderFrameRequested = false;
  function scheduleRender(showSelection = true) {
    if (!renderFrameRequested) {
      renderFrameRequested = true;
      requestAnimationFrame(() => {
        renderFrameRequested = false;
        render(showSelection);
      });
    }
  }

  function makeFrame(index, extra = {}) {
    const parentObjectId = extra.sourceId || 'main';
    const f = {
      id: makeId(),
      sourceId: parentObjectId,
      parentObjectId,
      x: 230 + index * 37,
      y: 350 + index * 43,
      w: 175,
      h: 215,
      rotation: index % 2 ? -3 : 2,
      color: '#bd2e35',
      lineWidth: 4,
      strokeOpacity: 100,
      strokeStyle: 'solid',
      frameStyle: 'full',
      label: `ITEM / ${String(index).padStart(2, '0')}`,
      labelPrefix: 'ITEM',
      labelNumber: index,
      autoNumber: true,
      labelSize: 14,
      showLabel: true,
      tagStyle: 'solid',
      tagBackground: '#bd2e35',
      tagTextColor: '#fff',
      relX: undefined,
      relY: undefined,
      relW: undefined,
      relH: undefined,
      relRotation: 0,
      ...extra,
    };
    if (f.relX === undefined) {
      syncFrameRelativeToParent(f);
    }
    return f;
  }
  function addFrame(target = null) {
    if (!state.image && (!state.assets || !state.assets.length)) return toast('请先上传图片。');
    const selected = selectedObject();
    const secTarget = target || (state.selected?.type === 'secondary' ? selected : null);
    let extra = {};
    if (secTarget) {
      extra = {
        sourceId: secTarget.id,
        parentObjectId: secTarget.id,
        x: Math.round(secTarget.x + secTarget.w * 0.15),
        y: Math.round(secTarget.y + secTarget.h * 0.15),
        w: Math.round(Math.min(180, secTarget.w * 0.7)),
        h: Math.round(Math.min(220, secTarget.h * 0.7)),
        rotation: secTarget.rotation || 0,
      };
    } else {
      extra = {
        sourceId: 'main',
        parentObjectId: 'main',
        x: Math.round(state.main.x + state.main.w * 0.22 + (state.frames.length % 3) * 35),
        y: Math.round(state.main.y + state.main.h * 0.22 + (state.frames.length % 3) * 40),
        w: Math.round(Math.min(185, state.main.w * 0.3)),
        h: Math.round(Math.min(215, state.main.h * 0.3)),
        rotation: state.main.rotation || 0,
      };
    }
    const f = makeFrame(state.frames.length + 1, extra);
    syncFrameRelativeToParent(f);
    state.frames.push(f);
    addLayer('frame', f.id);
    setSelected('frame', f);
    render();
    commit();
    markManuallyEdited();
    toast(secTarget ? '已在辅图卡片上创建索引框。' : '已在主图上创建索引框。');
  }
  function makeDetail(frame, count, extra = {}) {
    const srcInfo = getImageSourceInfo(frame?.sourceId);
    const pos = [{ x: 548, y: 155 }, { x: 35, y: 690 }, { x: 625, y: 800 }, { x: -20, y: 210 }][count % 4];
    const size = [{ w: 235, h: 270 }, { w: 205, h: 245 }, { w: 250, h: 190 }, { w: 190, h: 235 }][count % 4];
    return {
      id: makeId(),
      frameId: frame.id,
      sourceId: frame.sourceId || 'main',
      derivedFromObjectId: frame.sourceId || 'main',
      sourceImageId: srcInfo.assetId,
      sourceFrameId: frame.id,
      derivedFromImageId: srcInfo.assetId,
      sourceImageName: srcInfo.name,
      evidenceRole: 'evidence',
      ...pos,
      ...size,
      rotation: [-4, 3, 6, -7][count % 4],
      color: frame.color,
      lineWidth: 3,
      backingColor: '#fff',
      opacity: 100,
      filterType: ['color_halftone','glass','mosaic_sharp','duotone'][count % 4],
      contrast: 14,
      brightness: 0,
      saturation: 110,
      grain: 12,
      halftoneSize: 10,
      halftoneDensity: 62,
      halftoneAngle: 15,
      halftoneStrength: 82,
      glassSize: 32,
      mosaicSize: 18,
      ditherStep: 4,
      thresholdLevel: 124,
      duotoneDark: '#162772',
      duotoneLight: '#fca311',
      connectorType: count % 2 ? 'elbow' : 'straight',
      connectorWidth: 2,
      lineColor: frame.color,
      lineOpacity: 88,
      connectorDash: true,
      endpointStyle: 'dot',
      ...extra,
    };
  }
  function addDetail(frame = null) {
    if (!state.image && (!state.assets || !state.assets.length)) return toast('请先上传图片。');
    let targetFrame = frame;
    if (!targetFrame) {
      if (state.selected?.type === 'frame') {
        targetFrame = selectedObject();
      } else if (state.selected?.type === 'secondary') {
        const sec = selectedObject();
        targetFrame = makeFrame(state.frames.length + 1, {
          sourceId: sec.id,
          parentObjectId: sec.id,
          labelPrefix: 'EVID',
          x: Math.round(sec.x + sec.w * 0.15),
          y: Math.round(sec.y + sec.h * 0.15),
          w: Math.round(Math.min(180, sec.w * 0.7)),
          h: Math.round(Math.min(220, sec.h * 0.7)),
          rotation: sec.rotation || 0,
        });
        syncFrameRelativeToParent(targetFrame);
        state.frames.push(targetFrame);
        addLayer('frame', targetFrame.id);
      } else if (state.selected?.type === 'main') {
        targetFrame = makeFrame(state.frames.length + 1, {
          sourceId: 'main',
          parentObjectId: 'main',
          labelPrefix: 'EVID',
          x: Math.round(state.main.x + state.main.w * 0.25),
          y: Math.round(state.main.y + state.main.h * 0.2),
          w: Math.round(Math.min(180, state.main.w * 0.3)),
          h: Math.round(Math.min(200, state.main.h * 0.3)),
          rotation: state.main.rotation || 0,
        });
        syncFrameRelativeToParent(targetFrame);
        state.frames.push(targetFrame);
        addLayer('frame', targetFrame.id);
      }
    }
    if (!targetFrame) return toast('请先选中索引框或图片。');
    const d = makeDetail(targetFrame, state.details.length);
    state.details.push(d);
    addLayer('connector', d.id);
    addLayer('detail', d.id);
    setSelected('detail', d);
    renderImageTray();
    renderInspector();
    render();
    commit();
    markManuallyEdited();
    toast('局部放大已生成。');
  }
  function addText(kind) { const defaults = { hero: { content: 'NOTICE', x: -35, y: 46, size: 112, weight: 800, font: 'Arial Black, Impact, sans-serif', color: '#171717', scaleX: 1.35, scaleY: .82 }, subtitle: { content: 'COLLAGE INDEX / EDITION 01', x: 70, y: 1085, size: 22, weight: 700, font: 'Arial, sans-serif', color: '#171717', scaleX: 1, scaleY: 1 }, caption: { content: 'A visual record of detail, texture and presence.', x: 68, y: 1122, size: 15, weight: 500, font: 'Arial, sans-serif', color: '#171717', scaleX: 1, scaleY: 1 }, micro: { content: 'FILE 0021 / DATA UPDATED', x: 742, y: 245, size: 10, weight: 700, font: 'ui-monospace, Consolas, monospace', color: '#171717', scaleX: 1, scaleY: 1.08, letterSpacing: 3, writingMode: 'vertical' }, repeat: { content: 'IM RICH MAN', x: 78, y: 760, size: 20, weight: 800, font: 'Arial Black, Arial, sans-serif', color: '#bd2e35', repeat: 5, direction: 'vertical', repeatSpacing: 3, repeatOffsetX: 7, repeatOffsetY: 0, rotationStep: 0, scaleX: 1, scaleY: 1 } }; const t = { id: makeId(), kind, rotation: kind === 'hero' ? -2 : 0, opacity: 100, lineHeight: 1.15, letterSpacing: kind === 'hero' ? -2 : 0, align: 'left', writingMode: 'horizontal', ...defaults[kind] }; state.texts.push(t); addLayer('text', t.id); setSelected('text', t); render(); commit(); markManuallyEdited(); }

  function layerControls() { return `<p class="poster-section-label">LAYER ORDER</p><div class="poster-layer-order"><button data-layer-action="front">置于顶层</button><button data-layer-action="forward">上移一层</button><button data-layer-action="backward">下移一层</button><button data-layer-action="back">置于底层</button></div>`; }
  function changeLayer(action) { if (!state.selected) return; const index = layerIndex(state.selected.type, state.selected.id); if (index < 0) return; const [layer] = state.layers.splice(index, 1); if (action === 'front') state.layers.push(layer); if (action === 'back') state.layers.unshift(layer); if (action === 'forward') state.layers.splice(Math.min(state.layers.length, index + 1), 0, layer); if (action === 'backward') state.layers.splice(Math.max(0, index - 1), 0, layer); render(); commit(); markManuallyEdited(); }
  function duplicateSelected() {
    const item = selectedObject(); if (!item) return toast('请先选中对象。');
    const type = state.selected.type;
    if (type === 'main') return toast('主图可通过 REMIX 生成衍生碎片。');
    if (type === 'secondary') {
      const c = { ...clone(item), id: makeId(), x: item.x + 20, y: item.y + 20, rotation: (item.rotation || 0) + 2 };
      state.secondaries.push(c);
      addLayer('secondary', c.id, layerIndex('secondary', item.id));
      setSelected('secondary', c);
      renderImageTray();
    } else if (type === 'frame') {
      const c = { ...clone(item), id: makeId(), x: item.x + 10, y: item.y + 10, labelNumber: state.frames.length + 1 };
      state.frames.push(c);
      addLayer('frame', c.id, layerIndex('frame', item.id));
      setSelected('frame', c);
    } else if (type === 'text') {
      const c = { ...clone(item), id: makeId(), x: item.x + 10, y: item.y + 10 };
      state.texts.push(c);
      addLayer('text', c.id, layerIndex('text', item.id));
      setSelected('text', c);
    } else if (type === 'fragment') {
      const c = { ...clone(item), id: makeId(), x: item.x + 12, y: item.y + 12, rotation: (item.rotation || 0) + 2 };
      state.fragments.push(c);
      addLayer('fragment', c.id, layerIndex('fragment', item.id));
      setSelected('fragment', c);
    } else {
      const c = { ...clone(item), id: makeId(), x: item.x + 10, y: item.y + 10, rotation: (item.rotation || 0) + 2 };
      state.details.push(c);
      const at = layerIndex('detail', item.id);
      addLayer('connector', c.id, Math.max(-1, at - 1));
      addLayer('detail', c.id, at + 1);
      setSelected('detail', c);
    }
    render(); commit(); markManuallyEdited();
  }
  function deleteSelected() {
    if (!state.selected) return;
    const { type, id } = state.selected;
    if (type === 'main') return toast('主图不能删除。');
    if (type === 'secondary') {
      const childFrames = state.frames.filter((f) => f.sourceId === id);
      const childFrameIds = new Set(childFrames.map((f) => f.id));
      const childDetailIds = new Set(state.details.filter((d) => childFrameIds.has(d.frameId)).map((d) => d.id));
      state.secondaries = state.secondaries.filter((v) => v.id !== id);
      state.frames = state.frames.filter((v) => !childFrameIds.has(v.id));
      state.details = state.details.filter((v) => !childDetailIds.has(v.id));
      state.layers = state.layers.filter((v) => v.id !== id && !childFrameIds.has(v.id) && !childDetailIds.has(v.id));
      renderImageTray();
    } else if (type === 'frame') {
      const ids = state.details.filter((d) => d.frameId === id).map((d) => d.id);
      state.frames = state.frames.filter((v) => v.id !== id);
      state.details = state.details.filter((v) => v.frameId !== id);
      state.layers = state.layers.filter((v) => !(v.type === 'frame' && v.id === id) && !ids.includes(v.id));
      renderImageTray();
    } else if (type === 'detail' || type === 'connector') {
      state.details = state.details.filter((v) => v.id !== id);
      state.layers = state.layers.filter((v) => v.id !== id);
      renderImageTray();
    } else if (type === 'fragment') {
      state.fragments = state.fragments.filter((v) => v.id !== id);
      state.layers = state.layers.filter((v) => !(v.type === 'fragment' && v.id === id));
    } else {
      state.texts = state.texts.filter((v) => v.id !== id);
      state.layers = state.layers.filter((v) => !(v.type === 'text' && v.id === id));
    }
    setSelected(null, null); render(); commit(); markManuallyEdited();
  }

  function hitBox(x, y, b) { const p = rotatePoint(x, y, b.x + b.w / 2, b.y + b.h / 2, -(b.rotation || 0)); return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h; }
  function segmentDistance(p, a, b) { const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy; if (!l) return Math.hypot(p.x - a.x, p.y - a.y); const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l)); return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)); }
  function hitConnector(d, p) {
    const c = connectorPoints(d);
    if (!c) return false;
    if (d.connectorType !== 'elbow') return segmentDistance(p, c.start, c.end) < 10;
    const mode = getElbowRoute(c.start, c.end, d);
    if (mode === 'vertical') {
      const y = c.start.y + (c.end.y - c.start.y) * 0.52;
      const a = { x: c.start.x, y }, b = { x: c.end.x, y };
      return Math.min(segmentDistance(p, c.start, a), segmentDistance(p, a, b), segmentDistance(p, b, c.end)) < 10;
    } else {
      const x = c.start.x + (c.end.x - c.start.x) * 0.52;
      const a = { x, y: c.start.y }, b = { x, y: c.end.y };
      return Math.min(segmentDistance(p, c.start, a), segmentDistance(p, a, b), segmentDistance(p, b, c.end)) < 10;
    }
  }
  function hitAt(x, y) {
    const selected = selectedObject();
    if (selected && !['text','connector'].includes(state.selected.type)) {
      const b = boundsOf(selected, state.selected.type), h = rotatePoint(b.x + b.w, b.y + b.h, b.x + b.w / 2, b.y + b.h / 2, b.rotation);
      if (Math.hypot(x - h.x, y - h.y) < 22) return { type: state.selected.type, item: selected, handle: 'resize' };
    }
    for (const layer of [...state.layers].reverse()) {
      if (layer.type === 'connector') { const d = state.details.find((v) => v.id === layer.id); if (d && hitConnector(d, { x, y })) return { type: 'connector', item: d }; }
      if (layer.type === 'frame') { const f = state.frames.find((v) => v.id === layer.id); if (f && hitBox(x, y, boundsOf(f, 'frame'))) return { type: 'frame', item: f }; }
      if (layer.type === 'detail') { const d = state.details.find((v) => v.id === layer.id); if (d && hitBox(x, y, boundsOf(d, 'detail'))) return { type: 'detail', item: d }; }
      if (layer.type === 'fragment') { const f = state.fragments.find((v) => v.id === layer.id); if (f && hitBox(x, y, boundsOf(f, 'fragment'))) return { type: 'fragment', item: f }; }
      if (layer.type === 'secondary') { const s = state.secondaries?.find((v) => v.id === layer.id); if (s && hitBox(x, y, boundsOf(s, 'secondary'))) return { type: 'secondary', item: s }; }
      if (layer.type === 'text') { const t = state.texts.find((v) => v.id === layer.id); if (t && hitBox(x, y, boundsOf(t, 'text'))) return { type: 'text', item: t }; }
      if (layer.type === 'main' && state.main && hitBox(x, y, boundsOf(state.main, 'main'))) return { type:'main', item:state.main };
    }
    return null;
  }
  function eventPoint(e) { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; }
  canvas.addEventListener('pointerdown', (e) => {
    const p = eventPoint(e), hit = hitAt(p.x, p.y);
    if (!hit) { setSelected(null, null); render(); return; }
    setSelected(hit.type, hit.item);
    if (hit.type === 'secondary' || hit.type === 'main') {
      (state.frames || []).forEach((f) => {
        if ((f.sourceId || 'main') === (hit.type === 'main' ? 'main' : hit.item.id)) {
          syncFrameRelativeToParent(f);
        }
      });
    }
    drag = { ...hit, startX: p.x, startY: p.y, x: hit.item.x, y: hit.item.y, w: hit.item.w, h: hit.item.h };
    canvas.setPointerCapture(e.pointerId);
    render();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag || drag.type === 'connector') return;
    const p = eventPoint(e), dx = p.x - drag.startX, dy = p.y - drag.startY, item = drag.item;
    if (drag.handle === 'resize') {
      item.w = Math.max(32, drag.w + dx);
      item.h = Math.max(32, drag.h + dy);
    } else {
      item.x = drag.x + dx;
      item.y = drag.y + dy;
    }
    if (drag.type === 'secondary' || drag.type === 'main') {
      syncAllChildFramesOf(item.id);
    } else if (drag.type === 'frame') {
      syncFrameRelativeToParent(item);
    }
    scheduleRender();
  });
  canvas.addEventListener('pointerup', () => {
    if (drag && drag.type !== 'connector') {
      if (drag.type === 'secondary' || drag.type === 'main') {
        syncAllChildFramesOf(drag.item.id);
      } else if (drag.type === 'frame') {
        syncFrameRelativeToParent(drag.item);
      }
      commit();
      markManuallyEdited();
    }
    drag = null;
    renderInspector();
  });
  canvas.addEventListener('pointercancel', () => { drag = null; });

  const range = (zh, en, key, value, min, max, step = 1, global = false, hint = '') =>
    `<div class="poster-field"><div class="range-title"><div class="poster-field-label-group"><span class="poster-label-main">${zh}</span><span class="poster-label-sub">${en}</span></div><output>${value}</output></div>${hint ? `<span class="poster-field-hint">${hint}</span>` : ''}<input type="range" data-${global ? 'global' : 'prop'}="${key}" min="${min}" max="${max}" step="${step}" value="${value}"></div>`;

  const segmented = (zh, en, key, value, options, global = false, hint = '') =>
    `<div class="poster-field"><div class="poster-field-label"><div class="poster-field-label-group"><span class="poster-label-main">${zh}</span><span class="poster-label-sub">${en}</span></div></div>${hint ? `<span class="poster-field-hint">${hint}</span>` : ''}<div class="poster-segmented" data-segmented-for="${key}">${options.map(([v, optZh, optEn]) => `<button type="button" class="${String(v) === String(value) ? 'is-active' : ''}" data-${global ? 'global' : 'prop'}="${key}" data-val="${v}"><span>${optZh}</span> <small>${optEn}</small></button>`).join('')}</div></div>`;

  const field = (zh, en, key, value, type = 'text', global = false, hint = '') =>
    `<div class="poster-field"><div class="poster-field-label"><div class="poster-field-label-group"><span class="poster-label-main">${zh}</span><span class="poster-label-sub">${en}</span></div></div>${hint ? `<span class="poster-field-hint">${hint}</span>` : ''}${type === 'textarea' ? `<textarea aria-label="${zh}" data-${global ? 'global' : 'prop'}="${key}">${escapeHTML(value)}</textarea>` : `<input aria-label="${zh}" type="${type}" data-${global ? 'global' : 'prop'}="${key}" value="${escapeHTML(value)}">`}</div>`;

  const toggle = (zh, en, key, value, global = false, hint = '') =>
    `<div class="poster-field"><label class="poster-toggle"><div class="poster-toggle-title"><span class="poster-label-main">${zh}</span><span class="poster-label-sub">${en}</span></div><input type="checkbox" data-${global ? 'global' : 'prop'}="${key}" ${value ? 'checked' : ''}></label>${hint ? `<span class="poster-field-hint">${hint}</span>` : ''}</div>`;

  const select = (zh, en, key, value, options, global = false, hint = '') =>
    `<div class="poster-field"><div class="poster-field-label"><div class="poster-field-label-group"><span class="poster-label-main">${zh}</span><span class="poster-label-sub">${en}</span></div></div>${hint ? `<span class="poster-field-hint">${hint}</span>` : ''}<select data-${global ? 'global' : 'prop'}="${key}">${options.map(([v, optZh, optEn]) => `<option value="${v}" ${String(v) === String(value) ? 'selected' : ''}>${optZh} · ${optEn || v}</option>`).join('')}</select></div>`;

  const accordion = (zh, en, content, open = false) =>
    `<details class="poster-accordion" ${open ? 'open' : ''}><summary><span class="acc-zh">${zh}</span><span class="acc-en">${en}</span></summary><div class="poster-accordion-body">${content}</div></details>`;

  const objectActions = () => `${layerControls()}<div class="poster-object-actions"><button class="poster-action" data-poster-action="duplicate">复制对象</button><button class="poster-delete" data-poster-action="delete">删除对象</button></div>`;

  function syncLeftControls() {
    const main = state.main || makeMain();
    const zoomInput = document.getElementById('leftMainZoom');
    const zoomOut = document.getElementById('leftMainZoomOutput');
    if (zoomInput && zoomOut) {
      const val = main.zoom || 1;
      zoomInput.value = val;
      zoomOut.textContent = `${Math.round(val * 100)}%`;
    }
    const panXInput = document.getElementById('leftMainPanX');
    const panXOut = document.getElementById('leftMainPanXOutput');
    if (panXInput && panXOut) {
      const val = main.panX || 0;
      panXInput.value = val;
      panXOut.textContent = val;
    }
    const panYInput = document.getElementById('leftMainPanY');
    const panYOut = document.getElementById('leftMainPanYOutput');
    if (panYInput && panYOut) {
      const val = main.panY || 0;
      panYInput.value = val;
      panYOut.textContent = val;
    }
    const rotInput = document.getElementById('leftMainRotation');
    const rotOut = document.getElementById('leftMainRotationOutput');
    if (rotInput && rotOut) {
      const val = main.rotation || 0;
      rotInput.value = val;
      rotOut.textContent = `${val}°`;
    }

    const listEl = document.getElementById('posterLeftElementsList');
    if (listEl) {
      let html = '';
      const isMainSelected = state.selected?.type === 'main';
      html += `<div class="poster-layer-row ${isMainSelected ? 'is-selected' : ''}" data-poster-action="select-main" style="cursor:pointer;padding:6px 10px;border-radius:4px;background:${isMainSelected ? '#e0e7ff' : '#f0f4ff'};border:1px solid ${isMainSelected ? '#002FA7' : '#c7d7fe'};display:flex;align-items:center;justify-content:space-between;"><span style="font-weight:600;font-size:12px;color:#002FA7;">🖼️ 主图 · MAIN IMAGE</span><small style="color:#002FA7;font-weight:700;">${isMainSelected ? '已选 ✓' : '选中 ↗'}</small></div>`;

      (state.secondaries || []).forEach((sec, idx) => {
        const isSel = state.selected?.type === 'secondary' && state.selected?.item?.id === sec.id;
        html += `<div class="poster-layer-row ${isSel ? 'is-selected' : ''}" data-poster-action="select-secondary" data-id="${sec.id}" style="cursor:pointer;padding:6px 10px;border-radius:4px;background:${isSel ? '#e0e7ff' : '#fff'};border:1px solid ${isSel ? '#002FA7' : '#e2e8f0'};display:flex;align-items:center;justify-content:space-between;"><span style="font-size:12px;">🗂️ 辅图卡片 ${String(idx+1).padStart(2,'0')}</span><small style="color:${isSel ? '#002FA7' : '#666'};font-weight:${isSel ? '700' : '400'};">${isSel ? '已选 ✓' : '选中 ↗'}</small></div>`;
      });
      (state.frames || []).forEach((f, idx) => {
        const isSel = state.selected?.type === 'frame' && state.selected?.item?.id === f.id;
        html += `<div class="poster-layer-row ${isSel ? 'is-selected' : ''}" data-poster-action="select-frame" data-id="${f.id}" style="cursor:pointer;padding:6px 10px;border-radius:4px;background:${isSel ? '#e0e7ff' : '#fff'};border:1px solid ${isSel ? '#002FA7' : '#e2e8f0'};display:flex;align-items:center;justify-content:space-between;"><span style="font-size:12px;">🔍 索引框 [${f.labelPrefix||'ITEM'} ${String(idx+1).padStart(2,'0')}]</span><small style="color:${isSel ? '#002FA7' : '#666'};font-weight:${isSel ? '700' : '400'};">${isSel ? '已选 ✓' : '选中 ↗'}</small></div>`;
      });
      (state.details || []).forEach((d, idx) => {
        const isSel = state.selected?.type === 'detail' && state.selected?.item?.id === d.id;
        html += `<div class="poster-layer-row ${isSel ? 'is-selected' : ''}" data-poster-action="select-detail" data-id="${d.id}" style="cursor:pointer;padding:6px 10px;border-radius:4px;background:${isSel ? '#e0e7ff' : '#fff'};border:1px solid ${isSel ? '#002FA7' : '#e2e8f0'};display:flex;align-items:center;justify-content:space-between;"><span style="font-size:12px;">🔬 局部特写 ${String(idx+1).padStart(2,'0')}</span><small style="color:${isSel ? '#002FA7' : '#666'};font-weight:${isSel ? '700' : '400'};">${isSel ? '已选 ✓' : '选中 ↗'}</small></div>`;
      });
      (state.texts || []).forEach((t) => {
        const isSel = state.selected?.type === 'text' && state.selected?.item?.id === t.id;
        const textNames = { hero:'主标题', subtitle:'副标题', caption:'说明', micro:'微型', repeat:'重复' };
        html += `<div class="poster-layer-row ${isSel ? 'is-selected' : ''}" data-poster-action="select-text" data-id="${t.id}" style="cursor:pointer;padding:6px 10px;border-radius:4px;background:${isSel ? '#e0e7ff' : '#fff'};border:1px solid ${isSel ? '#002FA7' : '#e2e8f0'};display:flex;align-items:center;justify-content:space-between;"><span style="font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px;">✍️ ${textNames[t.kind]||'文字'}: ${escapeHTML(t.content?.slice(0,14))}</span><small style="color:${isSel ? '#002FA7' : '#666'};font-weight:${isSel ? '700' : '400'};">${isSel ? '已选 ✓' : '选中 ↗'}</small></div>`;
      });
      listEl.innerHTML = html;
    }
  }

  function renderInspector() {
    syncLeftControls();
    const o = selectedObject();
    const deselectBtn = $('#posterDeselectButton');
    if (deselectBtn) {
      deselectBtn.style.display = o ? 'inline-block' : 'none';
    }
    if (!o) {
      if (holdBeforeButton) holdBeforeButton.style.display = 'flex';
      inspectorSelection.textContent = 'FILTERS · TEXTURE';
      inspectorTitle.innerHTML = '滤镜与质感 <small>FILTERS & TEXTURE</small>';

      const filterRemixBanner = `<div class="poster-inspector-remix-banner" style="margin-bottom:12px;">
        <button class="poster-filter-remix-button" type="button" data-poster-action="filter-remix" style="width:100%;padding:10px 14px;background:#002FA7;color:#fff;border:none;border-radius:6px;font-weight:700;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 2px 6px rgba(0,47,167,0.25);transition:all 0.15s ease;">
          <span>滤镜 REMIX ↻</span>
          <small style="opacity:0.85;font-weight:400;font-size:11px;">循环切换 6 组精选滤镜调色</small>
        </button>
      </div>`;

      const presetsContent = `<div class="poster-presets">
        <button type="button" data-poster-preset="electric">TIGER<br /><b>AESPA</b></button>
        <button type="button" data-poster-preset="red">CCTV<br /><b>RED</b></button>
        <button type="button" data-poster-preset="blue">CCTV<br /><b>BLUE</b></button>
        <button type="button" data-poster-preset="editorial">HALFTONE<br /><b>EDITORIAL</b></button>
        <button type="button" data-poster-preset="chrome">LIQUID<br /><b>CHROME</b></button>
        <button class="poster-preset-xerox" type="button" data-poster-preset="xerox">XEROX<br /><b>/ PUNK</b></button>
      </div>`;
      const presetsAccordion = accordion('风格预设', 'STYLE PRESETS', presetsContent, true);

      const hasBgImage = !!state.backgroundImageId;
      const isPattern = state.backgroundStyle && state.backgroundStyle !== 'solid';
      let bgStyleControls = '';
      if (isPattern) {
        bgStyleControls += range('背景纹理浓度','Texture Opacity','backgroundTextureOpacity',state.backgroundTextureOpacity??80,0,100,1,true,'调节网格/复印纸/点阵等图案浓度');
        if (state.backgroundStyle === 'liquid-chrome') {
          bgStyleControls += `<div class="poster-field"><button type="button" class="poster-action" data-poster-action="reroll-chrome" style="width:100%;margin-top:4px;">换一换水银流向 ↻ / REROLL CHROME</button></div>`;
        }
      }
      let bgImageControls = '';
      if (hasBgImage) {
        bgImageControls += range('背景图透明度','Image Opacity','backgroundImageOpacity',state.backgroundImageOpacity??48,0,100,1,true,'调节已上传的背景图透明度');
        bgImageControls += select('背景图填充','Image Fit','backgroundImageFit',state.backgroundImageFit||'cover',[['cover','铺满','Cover'],['contain','完整适应','Contain'],['stretch','拉伸拉满','Stretch']],true);
        bgImageControls += `<div class="poster-field"><button type="button" class="poster-action" id="posterInspectorBgClear" style="width:100%;margin-top:4px;">移除背景图</button></div>`;
      } else {
        bgImageControls += `<div class="poster-field"><label class="poster-action" for="posterBackgroundImageInput" style="display:block;text-align:center;cursor:pointer;margin-top:4px;">+ 上传背景图 <small>LOCAL IMAGE</small></label></div>`;
      }

      const bgPresetsContent = `<div class="poster-background-presets" style="margin-bottom:10px;">
        <button type="button" data-poster-background="electric-tiger"><b>ELECTRIC TIGER</b><small>Aespa 经典电光虎纹 · 蓝黑斑纹</small></button>
        <button type="button" data-poster-background="liquid-chrome"><b>LIQUID CHROME</b><small>酸性全息水银 · WebGL 算法流体</small></button>
        <button type="button" data-poster-background="pure-black"><b>PURE BLACK</b><small>纯黑基底</small></button>
        <button type="button" data-poster-background="pure-white"><b>PURE WHITE</b><small>纯白基底</small></button>
        <button type="button" data-poster-background="solid"><b>SOLID</b><small>复古米白</small></button>
        <button type="button" data-poster-background="grid"><b>INDEX GRID</b><small>坐标网格</small></button>
        <button type="button" data-poster-background="chrome"><b>CHROME</b><small>金属渐变</small></button>
        <button type="button" data-poster-background="scan"><b>SCAN PAPER</b><small>复印扫描纸</small></button>
        <button type="button" data-poster-background="dots"><b>DOT MATRIX</b><small>点阵印刷</small></button>
        <button type="button" data-poster-background="soft-y2k"><b>SOFT Y2K</b><small>柔和千禧</small></button>
        <button type="button" data-poster-background="blueprint"><b>BLUE PRINT</b><small>工程蓝图</small></button>
      </div>`
      + field('画布底色','Background Color','background',state.background,'color',true)
      + select('背景样式','Background Style','backgroundStyle',state.backgroundStyle||'solid',[['electric-tiger','电光虎纹','Electric Tiger'],['liquid-chrome','酸性全息水银','Liquid Chrome'],['solid','纯色基底','Solid'],['grid','坐标网格','Index Grid'],['chrome','金属渐变','Chrome Gradient'],['scan','复印扫描纸','Scan Paper'],['dots','点阵印刷','Dot Matrix'],['soft-y2k','柔和 Y2K','Soft Y2K'],['blueprint','工程蓝图','Blue Print']],true)
      + bgStyleControls + bgImageControls
      + toggle('海报外框','Poster Border','border',state.border,true)
      + field('外框颜色','Border Color','borderColor',state.borderColor,'color',true)
      + range('外框线宽','Border Width','borderWidth',state.borderWidth,1,18,1,true);
      const bgAccordion = accordion('背景与纸张', 'BACKGROUND & PAPER', bgPresetsContent, true);

      const colorAccordion = accordion('图像调色', 'COLOR & TONALITY', `${range('主图透明度','Image Opacity','mainOpacity',state.main?.opacity??100,0,100,1,true,'调节主图与背景的融合透明度')}${range('黑白','B&W','bw',state.filters.bw,0,100,1,true,'将彩色转换为黑白基调')}${range('亮度','Brightness','brightness',state.filters.brightness,-70,80,1,true,'调节画面整体明暗曝光')}${range('对比度','Contrast','contrast',state.filters.contrast,-50,120,1,true,'拉开明暗反差与视觉冲击')}${range('饱和度','Saturation','saturation',state.filters.saturation??100,0,200,1,true,'控制色彩纯度与鲜艳度')}<div class="poster-field" style="margin-top:6px;"><button type="button" class="poster-action" data-poster-action="reset-filters" style="width:100%;">恢复原图清晰质感 / RESET FILTERS</button></div>`, true);

      inspector.innerHTML = filterRemixBanner
        + presetsAccordion
        + bgAccordion
        + colorAccordion
        + accordion('印刷 / 扫描', 'PRINT / SCAN', `${range('半调强度','Halftone Strength','halftone',state.filters.halftone,0,100,1,true,'控制印刷网点效果的明显程度')}${range('网点大小','Dot Size','halftoneSize',state.filters.halftoneSize,1,42,1,true,'控制半调颗粒尺寸')}${range('网点密度','Dot Density','halftoneDensity',state.filters.halftoneDensity,1,100,1,true,'控制网点之间的疏密')}${range('网点角度','Dot Angle','halftoneAngle',state.filters.halftoneAngle,-90,90,1,true,'旋转半调网点排列角度')}${range('扫描线','Scanline','scan',state.filters.scan,0,100,1,true,'模拟复印或显像管扫描条纹')}${segmented('扫描方向','Scan Direction','scanAngle',state.filters.scanAngle||0,[[0,'横向','Horizontal'],[90,'纵向','Vertical']],true,'切换横向或纵向扫描条纹')}`)
        + accordion('质感', 'TEXTURE', `${range('颗粒','Grain','grain',state.filters.grain,0,100,1,true,'添加胶片噪点与印刷颗粒')}${range('粗糙度','Roughness','rough',state.filters.rough,0,100,1,true,'增加复印 / 阈值化的粗粝感')}${range('纸张纹理','Paper Texture','paper',state.filters.paper,0,100,1,true,'模拟旧报纸与复印纸纤维杂质')}${range('脏版印刷','Dirty Print','dirty',state.filters.dirty,0,100,1,true,'增加墨点、污渍和印刷缺陷')}${range('压缩损坏','Compression','compression',state.filters.compression,0,100,1,true,'模拟低质量数字图片的块状损坏')}`)
        + accordion('风格化', 'STYLIZE', `${range('轮廓','Outline','outline',state.filters.outline,0,100,1,true,'提取高对比边缘描边线条')}${range('反相','Invert','invert',state.filters.invert,0,100,1,true,'翻转明暗与底片反色')}${range('色阶压缩','Color Compression / Posterize','posterize',state.filters.posterize,0,100,1,true,'减少颜色层级，形成块面效果')}<p class="poster-help">所有质感均可从 Clean 的 0% 推到 Destroyed 的 100%。</p>`);
      return;
    }
    if (state.selected.type === 'main') {
      if (holdBeforeButton) holdBeforeButton.style.display = 'flex';
      inspectorSelection.textContent = `SELECTED · MAIN IMAGE / ${o.layoutMode || 'CUSTOM'}`;
      inspectorTitle.innerHTML = '主图 <small>MAIN IMAGE · 核心视觉</small>';
      inspector.innerHTML = accordion('变换', 'TRANSFORM', `${field('水平位置','X','x',Math.round(o.x),'number')}${field('垂直位置','Y','y',Math.round(o.y),'number')}${field('宽度','Width','w',Math.round(o.w),'number')}${field('高度','Height','h',Math.round(o.h),'number')}${range('旋转角度','Rotation','rotation',o.rotation||0,-12,12,.5)}${range('主图透明度','Opacity','opacity',o.opacity??100,0,100)}`, true)
        + accordion('裁切', 'CROP', `${range('画面缩放','Image Zoom','zoom',o.zoom||1,.7,2.4,.02)}${range('裁切水平偏移','Crop X','panX',o.panX||0,-350,350,1)}${range('裁切垂直偏移','Crop Y','panY',o.panY||0,-450,450,1)}`, true)
        + layerControls();
      return;
    }
    if (state.selected.type === 'fragment') {
      if (holdBeforeButton) holdBeforeButton.style.display = 'flex';
      const number = state.fragments.findIndex((v) => v.id === o.id) + 1;
      inspectorSelection.textContent = `SELECTED · ${o.fragmentType || 'MAIN FRAGMENT'} / ${String(number).padStart(2,'0')}`;
      inspectorTitle.innerHTML = `图像碎片 <small>FRAGMENT / ${String(number).padStart(2,'0')}</small>`;
      inspector.innerHTML = accordion('变换', 'TRANSFORM', `${field('水平位置','X','x',Math.round(o.x),'number')}${field('垂直位置','Y','y',Math.round(o.y),'number')}${field('宽度','Width','w',Math.round(o.w),'number')}${field('高度','Height','h',Math.round(o.h),'number')}${range('旋转角度','Rotation','rotation',o.rotation||0,-180,180)}${range('透明度','Opacity','opacity',o.opacity??100,0,100)}`, true)
        + accordion('图像', 'IMAGE', `${range('亮度','Brightness','brightness',o.brightness||0,-80,100)}${range('对比度','Contrast','contrast',o.contrast||0,-60,120)}${range('饱和度','Saturation','saturation',o.saturation??100,0,200)}${field('碎片边框','Border Color','color',o.color||'#fff','color')}${range('边框线宽','Border Width','lineWidth',o.lineWidth||0,0,12)}`, true)
        + accordion('印刷 / 扫描', 'PRINT / SCAN', `${range('半调强度','Halftone Strength','halftoneStrength',o.halftoneStrength||75,0,100,false,'控制碎片半调网点强度')}${range('网点大小','Dot Size','halftoneSize',o.halftoneSize||8,1,42)}${range('网点密度','Dot Density','halftoneDensity',o.halftoneDensity||55,1,100)}${range('网点角度','Dot Angle','halftoneAngle',o.halftoneAngle||0,-90,90)}`)
        + accordion('质感', 'TEXTURE', `${range('颗粒','Grain','grain',o.grain||0,0,100,false,'给碎片添加噪点颗粒')}`)
        + accordion('风格化', 'STYLIZE', `${select('滤镜类型','Filter Type','filterType',o.filterType,[['original','原图','Original'],['bw','黑白','B&W'],['highbw','高对比黑白','High Contrast B&W'],['halftone','半调网点','Halftone'],['rough','粗糙颗粒','Rough / Grain'],['outline','轮廓描边','Outline / Edge'],['invert','反相','Invert'],['posterize','色阶压缩','Posterize']])}`)
        + objectActions();
      return;
    }
    if (state.selected.type === 'secondary') {
      if (holdBeforeButton) holdBeforeButton.style.display = 'flex';
      const number = state.secondaries.findIndex((v) => v.id === o.id) + 1;
      const srcInfo = getImageSourceInfo(o.id);
      inspectorSelection.textContent = `SELECTED · SECONDARY IMAGE / 辅图 · ${srcInfo.name || `CARD ${String(number).padStart(2,'0')}`}`;
      inspectorTitle.innerHTML = `辅图卡片 <small>SECONDARY · ${escapeHTML(srcInfo.name || String(number).padStart(2,'0'))}</small>`;
      if (!o.filters) o.filters = cleanFilters();
      const currentAppearance = o.appearance || (o.filters.bw > 0 ? (o.filters.contrast > 40 ? 'highbw' : 'bw') : 'original');
      let currentFramePreset = 'thin';
      if (o.lineWidth === 0) currentFramePreset = 'none';
      else if (o.lineWidth === 1) currentFramePreset = 'thin';
      else if (o.lineWidth === 4 && o.backingColor === '#ffffff') currentFramePreset = 'white-border';
      else if (o.lineWidth >= 8 && o.backingColor === '#ffffff') currentFramePreset = 'editorial';

      inspector.innerHTML = accordion('变换', 'TRANSFORM', `${field('水平位置','X','x',Math.round(o.x),'number')}${field('垂直位置','Y','y',Math.round(o.y),'number')}${field('宽度','Width','w',Math.round(o.w),'number')}${field('高度','Height','h',Math.round(o.h),'number')}${range('旋转角度','Rotation','rotation',o.rotation||0,-180,180)}${range('透明度','Opacity','opacity',o.opacity??100,0,100)}`, true)
        + accordion('外观', 'APPEARANCE', `${select('风格预设','Appearance','secAppearance',currentAppearance,[['original','原图色彩','Original'],['bw','黑白基调','B&W'],['highbw','高对比黑白','High Contrast B&W']])}${range('胶片颗粒','Grain','secGrain',o.filters.grain||0,0,100,1,false,'轻度噪点质感')}`, true)
        + accordion('边框', 'FRAME', `${select('边框样式','Frame Style','secFramePreset',currentFramePreset,[['thin','细线框 (1px)','Thin Border'],['white-border','拍立得白边 (4px)','White Border'],['editorial','编辑宽衬底 (8px)','Editorial Border'],['none','无边框','None']])}${field('边框颜色','Border Color','color',o.color||'#ffffff','color')}${range('边框粗细','Border Width','lineWidth',o.lineWidth??3,0,16)}`, true)
        + objectActions();
      return;
    }
    if (state.selected.type === 'frame') {
      if (holdBeforeButton) holdBeforeButton.style.display = 'none';
      const number = state.frames.findIndex((v) => v.id === o.id) + 1;
      const targetInfo = getImageSourceInfo(o.sourceId);
      inspectorSelection.textContent = `SELECTED · INDEX FRAME / ON ${targetInfo.name || targetInfo.displayName}`;
      inspectorTitle.innerHTML = `索引框 <small>INDEX FRAME · ON ${escapeHTML(targetInfo.name || targetInfo.displayName)}</small>`;

      const advancedLabelContent = `${toggle('自动编号','Auto Number','autoNumber',o.autoNumber)}${field('标签前缀','Label Prefix','labelPrefix',o.labelPrefix||'ITEM')}${range('编号数值','Label Number','labelNumber',o.labelNumber||1,1,999)}${field('自定义标签','Custom Label','label',o.label||'')}${field('标签底色','Tag Background','tagBackground',o.tagBackground,'color')}${field('标签文字颜色','Tag Text Color','tagTextColor',o.tagTextColor,'color')}${range('标签字号','Font Size','labelSize',o.labelSize,8,32)}${select('标签样式','Tag Style','tagStyle',o.tagStyle,[['solid','实心色块','Solid'],['plain','纯文字底','Plain'],['outline','描边线框','Outline']])}`;

      inspector.innerHTML = accordion('变换', 'TRANSFORM', `${field('水平位置','X','x',Math.round(o.x),'number')}${field('垂直位置','Y','y',Math.round(o.y),'number')}${field('宽度','Width','w',Math.round(o.w),'number')}${field('高度','Height','h',Math.round(o.h),'number')}${range('旋转角度','Rotation','rotation',o.rotation||0,-180,180)}`, true)
        + accordion('框线', 'FRAME', `${field('框线颜色','Stroke Color','color',o.color,'color')}${range('框线粗细','Stroke Width','lineWidth',o.lineWidth,1,12)}${range('框线透明度','Stroke Opacity','strokeOpacity',o.strokeOpacity??100,0,100)}${select('线条样式','Stroke Style','strokeStyle',o.strokeStyle||'solid',[['solid','实线','Solid'],['dashed','虚线','Dashed']])}${select('边框样式','Frame Style','frameStyle',o.frameStyle||'full',[['full','完整框','Full Frame'],['corner','角标框','Corner Frame']])}`, true)
        + accordion('标签', 'LABEL', `${toggle('显示标签','Show Label','showLabel',o.showLabel)}${accordion('高级标签设置','ADVANCED LABEL',advancedLabelContent,false)}`, true)
        + `<button class="poster-action poster-action-primary" data-poster-action="detail">抽出特写 ↗ / EXTRACT EVIDENCE</button>${objectActions()}`;
      return;
    }
    if (state.selected.type === 'detail') {
      if (holdBeforeButton) holdBeforeButton.style.display = 'flex';
      const number = state.details.findIndex((v) => v.id === o.id) + 1;
      const targetFrame = frameById(o.frameId);
      const srcInfo = getImageSourceInfo(targetFrame?.sourceId || o.sourceId);
      inspectorSelection.textContent = hasSecondaryImages()
        ? `SELECTED · EVIDENCE / FROM ${srcInfo.name}`
        : `SELECTED · DETAIL CROP / ${String(number).padStart(2,'0')}`;
      inspectorTitle.innerHTML = hasSecondaryImages()
        ? `证据图 <small>EVIDENCE · FROM ${escapeHTML(srcInfo.name)}</small>`
        : `局部放大 <small>DETAIL CROP / ${String(number).padStart(2,'0')}</small>`;

      const filterList = [
        ['original', '原图色彩 (增强)', 'Original Clean'],
        ['color_halftone', '彩色半调 (像素化)', 'Color Halftone'],
        ['dot_halftone', '半调图案「点状」', 'Dot Halftone'],
        ['circle_halftone', '半调图案「圆形」+ 颗粒', 'Circle Halftone + Grain'],
        ['glass', '玻璃「块状」(折射)', 'Glass Brick'],
        ['mosaic_sharp', '马赛克 (像素化) + 锐化', 'Sharp Pixelate'],
        ['mosaic_tile', '马赛克拼贴 + 颗粒', 'Mosaic Tiles + Grain'],
        ['duotone', '渐变映射 + 颗粒 (双色调)', 'Duotone + Grain'],
        ['gradient_map', '渐变映射 (柔和氛围)', 'Soft Gradient Map'],
        ['dither', '位图：20 像素 (Dither 抖动)', 'Bayer Dither'],
        ['threshold', '阈值 + 颗粒 (复印高反差)', 'Threshold + Grain'],
        ['bw', '黑白基调', 'B&W'],
        ['outline', '轮廓描边', 'Outline / Edge'],
        ['rough', '粗糙复印', 'Rough / Xerox'],
        ['invert', '底片反相', 'Invert'],
        ['posterize', '色阶压缩', 'Posterize']
      ];

      let filterExtraSliders = '';
      if (o.filterType === 'color_halftone' || o.filterType === 'dot_halftone' || o.filterType === 'halftone') {
        filterExtraSliders += range('网点大小','Dot Size','halftoneSize',o.halftoneSize||8,2,36);
        filterExtraSliders += range('半调网点强度','Halftone Strength','halftoneStrength',o.halftoneStrength||80,20,100);
      } else if (o.filterType === 'circle_halftone') {
        filterExtraSliders += range('环纹间距','Ring Spacing','halftoneDensity',o.halftoneDensity||55,20,90);
        filterExtraSliders += range('胶片颗粒','Grain','grain',o.grain||25,0,100);
      } else if (o.filterType === 'glass') {
        filterExtraSliders += range('玻璃方块尺寸','Glass Block Size','glassSize',o.glassSize||32,12,72);
      } else if (o.filterType === 'mosaic_sharp' || o.filterType === 'mosaic_tile') {
        filterExtraSliders += range('马赛克块尺寸','Mosaic Block Size','mosaicSize',o.mosaicSize||18,4,64);
        if (o.filterType === 'mosaic_tile') filterExtraSliders += range('拼贴颗粒','Grain','grain',o.grain||30,0,100);
      } else if (o.filterType === 'duotone' || o.filterType === 'gradient_map') {
        filterExtraSliders += field('暗部映射色','Dark Tone Color','duotoneDark',o.duotoneDark||(o.filterType==='duotone'?'#162772':'#2b2353'),'color');
        filterExtraSliders += field('亮部映射色','Light Tone Color','duotoneLight',o.duotoneLight||(o.filterType==='duotone'?'#fca311':'#9bb1ff'),'color');
        if (o.filterType === 'duotone') filterExtraSliders += range('映射颗粒','Grain','grain',o.grain||26,0,100);
      } else if (o.filterType === 'dither') {
        filterExtraSliders += range('点刻步长 (粗细)','Dither Step','ditherStep',o.ditherStep||4,2,16);
      } else if (o.filterType === 'threshold' || o.filterType === 'highbw') {
        filterExtraSliders += range('二值化阈值','Threshold Level','thresholdLevel',o.thresholdLevel||124,40,220);
        filterExtraSliders += range('复印颗粒','Grain','grain',o.grain||35,0,100);
      }

      inspector.innerHTML = accordion('变换', 'TRANSFORM', `${field('水平位置','X','x',Math.round(o.x),'number')}${field('垂直位置','Y','y',Math.round(o.y),'number')}${field('宽度','Width','w',Math.round(o.w),'number')}${field('高度','Height','h',Math.round(o.h),'number')}${range('旋转角度','Rotation','rotation',o.rotation||0,-180,180)}${range('透明度','Opacity','opacity',o.opacity??100,0,100)}`, true)
        + accordion('风格滤镜', 'STYLE', `${select('滤镜效果','Filter Effect','filterType',o.filterType,filterList)}${filterExtraSliders}${range('画面对比度','Contrast','contrast',o.contrast||0,-40,100)}`, true)
        + accordion('边框与衬底', 'FRAME & BACKING', `${field('边框颜色','Border Color','color',o.color,'color')}${range('边框线宽','Border Width','lineWidth',o.lineWidth,0,12)}${field('衬底颜色','Backing Color','backingColor',o.backingColor||'#fff','color')}`, true)
        + accordion('图源信息', 'SOURCE', `<div class="poster-field"><div class="poster-field-label"><div class="poster-field-label-group"><span class="poster-label-main">来源图源</span><span class="poster-label-sub">SOURCE</span></div></div><div class="poster-readonly-badge">来源：${srcInfo.name} / SOURCE · ${srcInfo.name}</div></div>`, true)
        + objectActions();
      return;
    }
    if (state.selected.type === 'connector') {
      if (holdBeforeButton) holdBeforeButton.style.display = 'none';
      const d = state.details.find((item) => item.id === o.id);
      const targetFrame = d ? frameById(d.frameId) : null;
      const srcInfo = getImageSourceInfo(targetFrame?.sourceId || d?.sourceId);
      inspectorSelection.textContent = hasSecondaryImages()
        ? `SELECTED · CONNECTOR / ${srcInfo.name} → EVIDENCE`
        : 'SELECTED · CONNECTOR';
      inspectorTitle.innerHTML = hasSecondaryImages()
        ? `关系连线 <small>CONNECTOR · ${srcInfo.name} → EVIDENCE</small>`
        : '连接线 <small>CONNECTOR</small>';
      inspector.innerHTML = accordion('连接线', 'CONNECTOR', `${select('连接类型','Connector Type','connectorType',o.connectorType,[['straight','直线','Straight'],['elbow','折线 (智能避让)','Elbow (Avoidance)']])}${field('线条颜色','Line Color','lineColor',o.lineColor,'color')}${range('线条粗细','Line Width','connectorWidth',o.connectorWidth||2,1,12)}${range('透明度','Opacity','lineOpacity',o.lineOpacity??100,0,100)}${toggle('虚线','Dashed Line','connectorDash',o.connectorDash)}${select('端点样式','Endpoint Style','endpointStyle',o.endpointStyle,[['none','无端点','None'],['dot','圆点','Dot'],['cross','十字','Cross']])}`, true)
        + layerControls()
        + `<button class="poster-delete" data-poster-action="delete">删除连接线与局部图</button>`;
      return;
    }
    if (holdBeforeButton) holdBeforeButton.style.display = 'none';
    const names = { hero:'HERO TITLE', subtitle:'SUBTITLE', caption:'CAPTION', micro:'MICRO TEXT', repeat:'REPEAT TEXT' };
    const titlesZh = { hero:'主标题', subtitle:'副标题', caption:'小字说明', micro:'微型信息', repeat:'重复文字' };
    inspectorSelection.textContent = `SELECTED · ${names[o.kind] || 'TEXT'}`;
    inspectorTitle.innerHTML = `${titlesZh[o.kind] || '排版文字'} <small>${names[o.kind] || 'TYPOGRAPHY'}</small>`;
    const repeatControls = o.kind === 'repeat' ? accordion('重复文字', 'REPEAT', `${range('重复次数','Repeat Count','repeat',o.repeat,2,24)}${segmented('排列方向','Direction','direction',o.direction,[['vertical','纵向','Vertical'],['horizontal','横向','Horizontal']])}${range('间距','Spacing','repeatSpacing',o.repeatSpacing||0,-20,100)}${range('水平错位','X Offset','repeatOffsetX',o.repeatOffsetX||0,-100,100)}${range('垂直错位','Y Offset','repeatOffsetY',o.repeatOffsetY||0,-100,100)}${range('逐次旋转步长','Rotation Step','rotationStep',o.rotationStep||0,-20,20,.5)}`, true) : '';
    inspector.innerHTML = accordion('变换', 'TRANSFORM', `${field('水平位置','X','x',Math.round(o.x),'number')}${field('垂直位置','Y','y',Math.round(o.y),'number')}${range('水平缩放','Horizontal Scale','scaleX',o.scaleX||1,.2,3,.05)}${range('垂直缩放','Vertical Scale','scaleY',o.scaleY||1,.2,3,.05)}${range('旋转角度','Rotation','rotation',o.rotation||0,-180,180)}${range('透明度','Opacity','opacity',o.opacity,0,100)}`, true)
      + accordion('排版文字', 'TYPOGRAPHY', `${field('文字内容','Text Content','content',o.content,'textarea')}${select('字体','Font Family','font',o.font,[['Arial, sans-serif','Arial','Sans-Serif'],['Arial Black, Impact, sans-serif','Arial Black','Display'],['Georgia, serif','Georgia','Serif'],['ui-monospace, Consolas, monospace','Monospace','Technical']])}${range('字号','Font Size','size',o.size,6,240)}${select('字重','Weight','weight',o.weight,[['400','常规','Regular'],['500','中等','Medium'],['700','加粗','Bold'],['800','超重','Black']])}${range('字距','Tracking','letterSpacing',o.letterSpacing||0,-20,100,.5)}${range('行距','Line Height','lineHeight',o.lineHeight,.35,4,.05)}${select('对齐方式','Alignment','align',o.align||'left',[['left','左对齐','Left'],['center','居中','Center'],['right','右对齐','Right']])}${o.kind !== 'repeat' ? segmented('排版方向','Text Direction','writingMode',o.writingMode||'horizontal',[['horizontal','横排','Horizontal'],['vertical','竖排','Vertical']]) : ''}${field('文字颜色','Color','color',o.color,'color')}`, true)
      + repeatControls + objectActions();
  }

  function ensureKarinaMultiAssets(callback) {
    const urls = {
      close: window.KARINA_CLOSE_DATA || 'assets/karina-close.jpg',
      hands: window.KARINA_HANDS_DATA || 'assets/karina-hands.jpg',
      crouch: window.KARINA_CROUCH_DATA || 'assets/karina-crouch.jpg',
      sky: window.KARINA_SKY_DATA || 'assets/karina-sky.jpg'
    };
    const loadedImages = {};
    const keys = Object.keys(urls);
    let count = 0;
    keys.forEach(k => {
      const assetId = 'asset-karina-' + k;
      if (imageAssets.has(assetId) && imageAssets.get(assetId).image) {
        loadedImages[k] = imageAssets.get(assetId).image;
        count++;
        if (count === keys.length) callback(loadedImages);
        return;
      }
      const img = new Image();
      img.onload = () => {
        imageAssets.set(assetId, { id: assetId, name: 'karina-' + k + '.jpg', image: img, src: img.src });
        loadedImages[k] = img;
        count++;
        if (count === keys.length) callback(loadedImages);
      };
      img.onerror = () => {
        console.warn('Failed to load asset', k);
        count++;
        if (count === keys.length) callback(loadedImages);
      };
      img.src = urls[k];
    });
  }

  function hasUserUploadedImages() {
    const demoIds = new Set(['asset-karina-close', 'asset-karina-hands', 'asset-karina-crouch', 'asset-karina-sky', 'main-demo']);
    const demoNames = new Set(['karina-close.jpg', 'karina-hands.jpg', 'karina-crouch.jpg', 'karina-sky.jpg', 'demo.jpg']);
    const isDemoName = (n) => !n || demoNames.has(n) || n.startsWith('karina-');
    const isDemoId = (id) => !id || demoIds.has(id);

    const hasUserAsset = (state.assets || []).some(a => !isDemoId(a.id) && !isDemoName(a.name) && imageAssets.has(a.id));
    const hasUserMain = Boolean(state.image && !isDemoId(state.mainImageId) && !isDemoName(state.imageName));
    return hasUserAsset || hasUserMain;
  }

  // ==========================================
  // 6 组精选滤镜模板 (FILTER TEMPLATES 01 - 06)
  // 纯视觉调色、底纸材质与印刷质感，不改动任何空间几何坐标
  // ==========================================

  // ==========================================
  // 6 组精选滤镜模板 (FILTER TEMPLATES 01 - 06)
  // 纯视觉调色、底纸材质与印刷质感，不改动任何空间几何坐标
  // ==========================================

  // ==========================================
  // 6 组精选滤镜模板 (FILTER TEMPLATES 01 - 06)
  // 纯视觉调色、底纸材质与印刷质感，不改动任何空间几何坐标
  // ==========================================

  function applyFilterTemplate01(showToast = true, toastMsg = '') {
    const previousPoster = motion.capture();
    state.background = '#001fd4';
    state.backgroundStyle = 'electric-tiger';
    state.backgroundImageId = null;
    state.border = true;
    state.borderColor = '#ffffff';
    state.borderWidth = 4;
    state.filters = {
      bw: 0, brightness: 4, contrast: 18, saturation: 110,
      halftone: 20, halftoneSize: 5, halftoneDensity: 65, halftoneAngle: 15,
      grain: 12, rough: 0, outline: 0, scan: 0, scanAngle: 0, paper: 0, dirty: 0,
      compression: 0, invert: 0, posterize: 0
    };
    (state.secondaries || []).forEach((sec, idx) => {
      if (idx === 1) {
        sec.color = '#002FA7'; sec.lineWidth = 3; sec.backingColor = '#002FA7';
        sec.filters = { ...cleanFilters(), bw: 100, contrast: 45, brightness: -5 };
      } else if (idx === 0) {
        sec.color = '#ffffff'; sec.lineWidth = 2; sec.backingColor = '#ffffff';
        sec.filters = cleanFilters();
      } else {
        sec.color = '#002FA7'; sec.lineWidth = 2.5; sec.backingColor = '#002FA7';
        sec.filters = cleanFilters();
      }
    });
    (state.fragments || []).forEach(frag => {
      frag.color = '#ffbe0b'; frag.backingColor = 'rgba(255, 190, 11, 0.45)'; frag.opacity = 95;
      frag.filterType = 'duotone'; frag.duotoneDark = '#7a5500'; frag.duotoneLight = '#ffe600';
      frag.contrast = 40; frag.brightness = 25; frag.grain = 0;
      frag.halftoneSize = 9; frag.halftoneDensity = 56; frag.halftoneAngle = 15; frag.halftoneStrength = 82;
    });
    (state.frames || []).forEach(f => { f.color = '#002FA7'; f.tagBackground = '#002FA7'; f.tagTextColor = '#ffffff'; });
    (state.details || []).forEach(d => { d.color = '#002FA7'; d.lineColor = '#002FA7'; d.filterType = 'original'; });
    (state.texts || []).forEach(t => {
      if (t.id === 't-hero-richman' || (t.kind === 'hero' && t.content?.includes('RICH'))) {
        t.color = '#ffbe0b'; t.strokeColor = '#000000';
      } else if (t.id === 't-hero-aespa' || (t.kind === 'hero' && t.content?.includes('aespa'))) {
        t.color = '#e2e8f0'; t.strokeColor = '#111111';
      } else if (t.id === 't-badge') {
        t.color = '#ffbe0b'; t.badgeColor = '#002FA7';
      }
    });
    document.querySelectorAll('[data-poster-preset]').forEach(b => b.classList.toggle('is-active', b.dataset.posterPreset === 'electric'));
    render(); renderInspector(); commit(); markManuallyEdited(); motion.play(previousPoster);
    if (showToast) toast(toastMsg || '🎨 滤镜 REMIX [1/1] (滤镜模板 01)：Aespa 电光虎纹与胶印色彩');
  }


  function applyFilterTemplate02(showToast = true, toastMsg = '') {
    const previousPoster = motion.capture();
    state.background = '#0a0c10';
    state.backgroundStyle = 'ps-dark';
    state.backgroundImageId = null;
    state.border = true;
    state.borderColor = '#1f2430';
    state.borderWidth = 0;
    state.filters = {
      bw: 100, brightness: -4, contrast: 32, saturation: 0,
      halftone: 0, halftoneSize: 6, halftoneDensity: 55, halftoneAngle: 15,
      grain: 12, rough: 0, outline: 0, scan: 0, scanAngle: 0, paper: 0, dirty: 0,
      compression: 0, invert: 0, posterize: 0
    };

    (state.details || []).forEach((d) => {
      d.color = '#fbcfe8';
      d.lineWidth = 1.2;
      d.showHandles = true;
      d.handleColor = '#ffffff';
      d.handleStrokeColor = '#fbcfe8';
      d.handleSize = 7;
      d.showTag = false;
      d.lineOpacity = 0;
      d.backingColor = 'transparent';
    });

    (state.frames || []).forEach((f) => {
      f.color = '#fbcfe8';
      f.lineWidth = 1.2;
      f.showHandles = true;
      f.handleColor = '#ffffff';
      f.handleStrokeColor = '#fbcfe8';
      f.handleSize = 7;
      f.showLabel = false;
    });

    (state.texts || []).forEach(t => {
      if (t.id === 't-ps-icon' || t.badgeShape === 'ps-icon') {
        t.color = '#31a8ff';
        t.badgeColor = '#001e36';
        t.badgeBorderColor = '#1473e6';
      } else if (t.id === 't-title-main') {
        t.color = '#ffffff';
      } else if (t.id === 't-title-sub') {
        t.color = '#b8c4d8';
      } else if (t.kind === 'micro' || t.kind === 'caption') {
        t.color = '#c0d0e6';
      }
    });

    render(); renderInspector(); commit(); markManuallyEdited(); motion.play(previousPoster);
    if (showToast) toast(toastMsg || '🎨 滤镜 REMIX [2/2] (滤镜模板 02)：Photoshop 教程深邃暗调与多维色度');
  }

  const filterRemixList = [
    { id: 'filter-01', nameZh: 'Aespa 电光虎纹与胶印色彩', apply: applyFilterTemplate01 },
    { id: 'filter-02', nameZh: 'Photoshop 教程深邃暗调与多维色度', apply: applyFilterTemplate02 }
  ];

  // ==========================================
  // 通用用户图片/示范素材卡片槽位分配器
  // ==========================================
  function resolveSlotAssetIds(images, isReset) {
    const isUserMode = !isReset && hasUserUploadedImages();
    let slot0Id, slot1Id, slot2Id, slot3Id;

    if (isUserMode) {
      const demoIds = new Set(['asset-karina-close', 'asset-karina-hands', 'asset-karina-crouch', 'asset-karina-sky', 'main-demo']);
      const demoNames = new Set(['karina-close.jpg', 'karina-hands.jpg', 'karina-crouch.jpg', 'karina-sky.jpg', 'demo.jpg']);
      const isDemoName = (n) => !n || demoNames.has(n) || n.startsWith('karina-');
      const isDemoId = (id) => !id || demoIds.has(id);

      let userAssets = (state.assets || []).filter(a => !isDemoId(a.id) && !isDemoName(a.name) && imageAssets.has(a.id));

      if (state.image && !isDemoId(state.mainImageId) && !isDemoName(state.imageName)) {
        const mid = state.mainImageId || makeId();
        if (!imageAssets.has(mid)) {
          imageAssets.set(mid, { id: mid, name: state.imageName || 'user-image.jpg', image: state.image, src: state.image.src || '' });
        }
        if (!userAssets.some(a => a.id === mid)) {
          userAssets.unshift({ id: mid, name: state.imageName || 'user-image.jpg' });
        }
        state.mainImageId = mid;
      }

      let mainAsset = userAssets.find(a => a.id === state.mainImageId);
      if (!mainAsset && userAssets.length > 0) {
        mainAsset = userAssets[0];
        state.mainImageId = mainAsset.id;
      }

      if (mainAsset) {
        const loadedMain = imageAssets.get(mainAsset.id);
        if (loadedMain?.image) {
          state.image = loadedMain.image;
          state.imageName = loadedMain.name || mainAsset.name;
        }
      }

      state.assets = userAssets.map(a => ({ id: a.id, name: a.name }));

      const secCandidates = userAssets.filter(a => a.id !== state.mainImageId);
      const getSlotAssetId = (idx) => {
        if (secCandidates.length === 0) return state.mainImageId;
        if (secCandidates.length === 1) {
          return idx % 2 === 0 ? secCandidates[0].id : state.mainImageId;
        }
        return secCandidates[idx % secCandidates.length].id;
      };

      slot0Id = getSlotAssetId(0);
      slot1Id = getSlotAssetId(1);
      slot2Id = getSlotAssetId(2);
      slot3Id = getSlotAssetId(3);
    } else {
      const imgClose = images?.close || state.image;
      const imgHands = images?.hands || imgClose;
      const imgCrouch = images?.crouch || imgClose;
      const imgSky = images?.sky || imgClose;

      const assetClose = { id: 'asset-karina-close', name: 'karina-close.jpg', image: imgClose, src: imgClose?.src || '' };
      const assetHands = { id: 'asset-karina-hands', name: 'karina-hands.jpg', image: imgHands, src: imgHands?.src || '' };
      const assetCrouch = { id: 'asset-karina-crouch', name: 'karina-crouch.jpg', image: imgCrouch, src: imgCrouch?.src || '' };
      const assetSky = { id: 'asset-karina-sky', name: 'karina-sky.jpg', image: imgSky, src: imgSky?.src || '' };

      [assetClose, assetHands, assetCrouch, assetSky].forEach(a => {
        imageAssets.set(a.id, a);
      });

      state.assets = [
        { id: assetClose.id, name: assetClose.name },
        { id: assetHands.id, name: assetHands.name },
        { id: assetCrouch.id, name: assetCrouch.name },
        { id: assetSky.id, name: assetSky.name }
      ];

      state.image = imgClose;
      state.imageName = 'karina-close.jpg';
      state.mainImageId = assetClose.id;

      slot0Id = assetHands.id;
      slot1Id = assetCrouch.id;
      slot2Id = assetSky.id;
      slot3Id = assetClose.id;
    }

    return { isUserMode, slot0Id, slot1Id, slot2Id, slot3Id };
  }

  // ==========================================
  // 6 组精选排版模板 (LAYOUT TEMPLATES 01 - 06)
  // 纯空间几何构图，不覆盖用户已选定的滤镜或背景调色
  // ==========================================

  function applyLayoutTemplate01(images, isReset = false, showToast = true, toastMsg = '') {
    remixBaseSnapshot = null; remixLastResultSnapshot = null; lastRemixCopyName = ''; lastRemixAnchorName = ''; lastRemixFramePatternName = '';
    const previousPoster = motion.capture();

    const { isUserMode, slot0Id, slot1Id, slot2Id, slot3Id } = resolveSlotAssetIds(images, isReset);

    // 默认确保有背景纸张与外框
    if (!state.backgroundStyle || state.backgroundStyle === 'solid') {
      state.background = '#001fd4';
      state.backgroundStyle = 'electric-tiger';
      state.border = true;
      state.borderColor = '#ffffff';
      state.borderWidth = 4;
    }

    // 1. 主图空间定位
    state.main = {
      id: 'main-image',
      x: 38,
      y: 105,
      w: 824,
      h: 1035,
      rotation: 0,
      opacity: 100,
      zoom: 1.02,
      panX: 0,
      panY: -10,
      lineWidth: 2,
      color: '#ffffff',
      layoutMode: 'AESPA RICH MAN ARCHIVE'
    };

    // 2. 金黄色半透明半调衬块 (Fragments)
    const frag1 = {
      id: makeId(),
      fragmentType: 'color-block',
      source: 'main',
      x: 125, y: 135, w: 168, h: 185,
      rotation: 0,
      color: '#ffbe0b',
      backingColor: 'rgba(255, 190, 11, 0.45)',
      opacity: 95,
      filterType: 'duotone',
      duotoneDark: '#7a5500',
      duotoneLight: '#ffe600',
      contrast: 40, brightness: 25, grain: 0,
      halftoneSize: 9, halftoneDensity: 56, halftoneAngle: 15, halftoneStrength: 82
    };
    const frag2 = {
      id: makeId(),
      fragmentType: 'color-block',
      source: 'main',
      x: 220, y: 615, w: 155, h: 175,
      rotation: 0,
      color: '#ffbe0b',
      backingColor: 'rgba(255, 190, 11, 0.45)',
      opacity: 95,
      filterType: 'duotone',
      duotoneDark: '#7a5500',
      duotoneLight: '#ffe600',
      contrast: 40, brightness: 25, grain: 0,
      halftoneSize: 9, halftoneDensity: 56, halftoneAngle: 15, halftoneStrength: 82
    };
    const frag3 = {
      id: makeId(),
      fragmentType: 'color-block',
      source: 'main',
      x: 240, y: 840, w: 125, h: 125,
      rotation: 0,
      color: '#ffbe0b',
      backingColor: 'rgba(255, 190, 11, 0.45)',
      opacity: 95,
      filterType: 'duotone',
      duotoneDark: '#7a5500',
      duotoneLight: '#ffe600',
      contrast: 40, brightness: 25, grain: 0,
      halftoneSize: 9, halftoneDensity: 56, halftoneAngle: 15, halftoneStrength: 82
    };
    state.fragments = [frag1, frag2, frag3];

    // 3. 多图辅图卡片 (Secondaries)
    state.secondaries = [
      {
        id: makeId(),
        imageId: slot0Id,
        x: 28,
        y: 175,
        w: 160,
        h: 215,
        rotation: 0,
        opacity: 100,
        color: '#ffffff',
        lineWidth: 2,
        backingColor: '#ffffff',
        filters: cleanFilters()
      },
      {
        id: makeId(),
        imageId: slot1Id,
        x: 605,
        y: 285,
        w: 265,
        h: 360,
        rotation: 0,
        opacity: 100,
        color: '#002FA7',
        lineWidth: 3,
        backingColor: '#002FA7',
        filters: {
          ...cleanFilters(),
          bw: 100,
          contrast: 45,
          brightness: -5
        }
      },
      {
        id: makeId(),
        imageId: slot2Id,
        x: 575,
        y: 785,
        w: 280,
        h: 175,
        rotation: 0,
        opacity: 100,
        color: '#002FA7',
        lineWidth: 2.5,
        backingColor: '#002FA7',
        filters: cleanFilters()
      },
      {
        id: makeId(),
        imageId: slot3Id,
        x: 440,
        y: 855,
        w: 185,
        h: 145,
        rotation: 0,
        opacity: 100,
        color: '#002FA7',
        lineWidth: 2.5,
        backingColor: '#002FA7',
        filters: cleanFilters()
      }
    ];

    // 4. 专属核心证据采样框与彩色特写 (Eye / Teeth / Eye contact)
    const f1 = makeFrame(1, {
      sourceId: 'main',
      labelPrefix: 'Eye',
      labelNumber: '',
      x: 235,
      y: 185,
      w: 220,
      h: 140,
      color: '#002FA7',
      tagBackground: '#002FA7',
      tagTextColor: '#ffffff',
      lineWidth: 1.5,
      strokeStyle: 'dashed',
      frameStyle: 'full',
      tagStyle: 'solid',
      showLabel: false
    });
    const d1 = makeDetail(f1, 0, {
      x: 95,
      y: 295,
      w: 235,
      h: 145,
      rotation: 0
    });
    d1.color = '#002FA7';
    d1.lineWidth = 2;
    d1.lineColor = '#002FA7';
    d1.filterType = 'original';
    d1.connectorType = 'elbow';
    d1.connectorWidth = 1.5;
    d1.lineOpacity = 80;
    d1.endpointStyle = 'dot';
    d1.showTag = true;
    d1.tagText = 'Eye';
    d1.tagPosition = 'bottom-left';
    d1.tagBackground = '#002FA7';
    d1.tagTextColor = '#ffffff';

    const f2 = makeFrame(2, {
      sourceId: 'main',
      labelPrefix: 'Teeth',
      labelNumber: '',
      x: 320,
      y: 395,
      w: 235,
      h: 145,
      color: '#002FA7',
      tagBackground: '#002FA7',
      tagTextColor: '#ffffff',
      lineWidth: 1.5,
      strokeStyle: 'dashed',
      frameStyle: 'full',
      tagStyle: 'solid',
      showLabel: false
    });
    const d2 = makeDetail(f2, 1, {
      x: 330,
      y: 520,
      w: 245,
      h: 140,
      rotation: 0
    });
    d2.color = '#002FA7';
    d2.lineWidth = 2;
    d2.lineColor = '#002FA7';
    d2.filterType = 'original';
    d2.connectorType = 'elbow';
    d2.connectorWidth = 1.5;
    d2.lineOpacity = 80;
    d2.endpointStyle = 'dot';
    d2.showTag = true;
    d2.tagText = 'Teeth';
    d2.tagPosition = 'bottom-left';
    d2.tagBackground = '#002FA7';
    d2.tagTextColor = '#ffffff';

    const f3 = makeFrame(3, {
      sourceId: 'main',
      labelPrefix: 'Eye contact',
      labelNumber: '',
      x: 320,
      y: 470,
      w: 250,
      h: 90,
      color: '#002FA7',
      tagBackground: '#002FA7',
      tagTextColor: '#ffffff',
      lineWidth: 1.5,
      strokeStyle: 'dashed',
      frameStyle: 'full',
      tagStyle: 'solid',
      showLabel: false
    });
    const d3 = makeDetail(f3, 2, {
      x: 388,
      y: 442,
      w: 240,
      h: 110,
      rotation: 0
    });
    d3.color = '#002FA7';
    d3.lineWidth = 2;
    d3.lineColor = '#002FA7';
    d3.filterType = 'original';
    d3.connectorType = 'elbow';
    d3.connectorWidth = 1.5;
    d3.lineOpacity = 80;
    d3.endpointStyle = 'dot';
    d3.showTag = true;
    d3.tagText = 'Eye contact';
    d3.tagPosition = 'bottom-left';
    d3.tagBackground = '#002FA7';
    d3.tagTextColor = '#ffffff';

    state.frames = [f1, f2, f3];
    state.details = [d1, d2, d3];

    // 5. 排版文字 (Texts)
    state.texts = [
      {
        id: 't-hero-richman', kind: 'hero', content: 'RICH MAN',
        x: 340, y: 22, size: 78, weight: 900,
        font: 'Impact, Arial Black, sans-serif', color: '#ffbe0b',
        strokeColor: '#000000', strokeWidth: 5,
        rotation: 0, opacity: 100, scaleX: 1.05, letterSpacing: -1.5
      },
      {
        id: 't-hero-aespa', kind: 'hero', content: 'aespa',
        x: 620, y: 255, size: 48, weight: 900,
        font: 'Impact, Arial Black, sans-serif', color: '#e2e8f0',
        strokeColor: '#111111', strokeWidth: 3.5,
        rotation: 0, opacity: 100
      },
      {
        id: 't-badge', kind: 'caption', content: 'aespa\nTHE 6TH MINI ALBUM\nRICH MAN',
        x: 82, y: 60, size: 10, weight: 800,
        font: 'ui-monospace, Consolas, monospace', color: '#ffbe0b',
        rotation: -5, opacity: 100, align: 'center', lineHeight: 1.25,
        badgeShape: 'pick', badgeColor: '#002FA7', badgeWidth: 116, badgeHeight: 128
      },
      {
        id: 't-stack1', kind: 'micro', content: 'Karina\nKarina\nKarina',
        x: 30, y: 405, size: 21, weight: 700,
        font: 'Arial, Helvetica, sans-serif', color: '#ffffff',
        strokeColor: '#000000', strokeWidth: 3,
        rotation: 0, opacity: 100, lineHeight: 1.05
      },
      {
        id: 't-stack2', kind: 'micro', content: 'rich man\nrich man\nrich man',
        x: 60, y: 685, size: 15, weight: 600,
        font: 'Arial, Helvetica, sans-serif', color: '#e2e8f0',
        strokeColor: '#000000', strokeWidth: 2,
        rotation: 0, opacity: 90, lineHeight: 1.1
      },
      {
        id: 't-stack3', kind: 'micro', content: "i'm a rich man\ni'm a rich man\ni'm a rich man",
        x: 470, y: 380, size: 14, weight: 600,
        font: 'ui-monospace, Consolas, monospace', color: '#111111',
        strokeColor: '#ffffff', strokeWidth: 1.5,
        rotation: 0, opacity: 90, lineHeight: 1.15
      },
      {
        id: 't-statement1', kind: 'hero', content: "I'M ENOUGH AS I AM.",
        x: 50, y: 750, size: 26, weight: 900,
        font: 'Impact, Arial Black, sans-serif', color: '#002FA7',
        strokeColor: '#ffffff', strokeWidth: 2,
        rotation: -1, opacity: 100
      },
      {
        id: 't-statement2', kind: 'hero', content: "I'M A RICH MAN",
        x: 92, y: 785, size: 29, weight: 900,
        font: 'Impact, Arial Black, sans-serif', color: '#002FA7',
        strokeColor: '#ffffff', strokeWidth: 2,
        strikeThrough: true, strikeThroughColor: '#e60033', strikeThroughWidth: 7,
        rotation: -1, opacity: 100
      },
      {
        id: 't-woman', kind: 'micro', content: 'woman',
        x: 365, y: 825, size: 12, weight: 600,
        font: 'ui-monospace, Consolas, monospace', color: '#ffffff',
        strokeColor: '#000000', strokeWidth: 2,
        rotation: 0, opacity: 85
      },
      {
        id: 't-date', kind: 'micro', content: '11.4.2000',
        x: 720, y: 608, size: 12, weight: 700,
        font: 'ui-monospace, Consolas, monospace', color: '#ffffff',
        rotation: 0, opacity: 100, backgroundColor: '#002FA7', backgroundPaddingX: 8, backgroundPaddingY: 4
      },
      {
        id: 't-name', kind: 'micro', content: 'Yu\nJi-min',
        x: 775, y: 830, size: 11, weight: 700,
        font: 'ui-monospace, Consolas, monospace', color: '#ffffff',
        strokeColor: '#000000', strokeWidth: 2,
        rotation: 0, opacity: 85
      },
      {
        id: 't-eyecontact', kind: 'micro', content: 'Eye contact',
        x: 505, y: 608, size: 11, weight: 600,
        font: 'ui-monospace, Consolas, monospace', color: '#ffffff',
        strokeColor: '#000000', strokeWidth: 2,
        rotation: 0, opacity: 90
      }
    ];

    state.layers = [
      { type: 'main', id: 'main-image' },
      { type: 'secondary', id: state.secondaries[0].id },
      { type: 'secondary', id: state.secondaries[1].id },
      { type: 'secondary', id: state.secondaries[2].id },
      { type: 'secondary', id: state.secondaries[3].id },
      { type: 'fragment', id: frag1.id },
      { type: 'fragment', id: frag2.id },
      { type: 'fragment', id: frag3.id },
      { type: 'frame', id: f1.id },
      { type: 'detail', id: d1.id },
      { type: 'connector', id: d1.id },
      { type: 'frame', id: f2.id },
      { type: 'detail', id: d2.id },
      { type: 'connector', id: d2.id },
      { type: 'frame', id: f3.id },
      { type: 'detail', id: d3.id },
      { type: 'connector', id: d3.id },
      ...state.texts.map(t => ({ type: 'text', id: t.id }))
    ];

    state.remixInfo = {
      anchorZh: isUserMode ? '排版 REMIX [1/1] · Aespa 电光档案 (用户图片)' : '排版 REMIX [1/1] · Aespa 电光档案 (多图版)',
      anchorEn: 'Layout REMIX [1/1] · Electric Archive',
      mainLayoutZh: '原色缩放主图 · 镂空电光虎纹底纸',
      mainLayoutEn: 'Scaled True-Color Main · Electric Tiger Base',
      typographyZh: '电光涂鸦与三行叠字',
      typographyEn: 'Graffiti & Triple Stack',
      backgroundZh: 'Aespa 经典电光蓝黑虎纹',
      backgroundEn: 'Electric Tiger Cyber Noir',
      strengthZh: isUserMode ? '专属图片应用' : '精选多图排版',
      strengthEn: isUserMode ? 'Custom Asset Applied' : 'Curated Multi-Image Layout',
      isManuallyEdited: false
    };

    state.selected = null;
    emptyState.classList.add('is-hidden');
    status.textContent = isUserMode
      ? `LAYOUT [1/2] · ${(state.imageName || 'CUSTOM IMAGE').toUpperCase()}`
      : 'LAYOUT [1/2] / AESPA RICH MAN (MULTI-IMAGE)';

    syncAllChildFramesOf('main');
    (state.secondaries || []).forEach(s => syncAllChildFramesOf(s.id));
    renderImageTray(); renderInspector(); render();
    if (isReset) { history = []; historyIndex = -1; }
    commit(); updateRemixCard();
    if (zoomMode === 'fit') requestAnimationFrame(fitWorkspace);
    motion.play(previousPoster);
    if (showToast) {
      const resolvedToast = toastMsg || (isUserMode
        ? '📐 排版 REMIX [1/1] (排版模板 01)：已应用 Aespa 电光档案构图 (已适配您的专属图片)'
        : '📐 排版 REMIX [1/1] (排版模板 01)：Aespa 电光档案构图');
      toast(resolvedToast);
    }
  }


  function applyLayoutTemplate02(images, isReset = false, showToast = true, toastMsg = '') {
    remixBaseSnapshot = null; remixLastResultSnapshot = null; lastRemixCopyName = ''; lastRemixAnchorName = ''; lastRemixFramePatternName = '';
    const previousPoster = motion.capture();

    const { isUserMode, slot0Id, slot1Id, slot2Id, slot3Id } = resolveSlotAssetIds(images, isReset);

    // 默认确保有背景暗调
    if (!state.backgroundStyle || state.backgroundStyle === 'solid') {
      state.background = '#0a0c10';
      state.backgroundStyle = 'ps-dark';
      state.border = true;
      state.borderColor = '#1f2430';
      state.borderWidth = 0;
    }

    // 1. 主图空间定位 (居中微调模特暗调底图)
    state.main = {
      id: 'main-image',
      x: 45,
      y: 110,
      w: 810,
      h: 1060,
      rotation: 0,
      opacity: 100,
      zoom: 1.0,
      panX: 0,
      panY: 0,
      lineWidth: 0,
      color: '#ffffff',
      layoutMode: 'PHOTOSHOP EFFECT TUTORIAL'
    };

    // 2. 多图辅图卡片结构 (兼容多图用户与回归测试)
    state.secondaries = [
      { id: makeId(), imageId: slot0Id, x: 134, y: 318, w: 256, h: 186, rotation: 0, opacity: 0, color: '#fbcfe8', lineWidth: 1.2, backingColor: 'transparent', filters: cleanFilters() },
      { id: makeId(), imageId: slot1Id, x: 500, y: 298, w: 344, h: 254, rotation: 0, opacity: 0, color: '#fbcfe8', lineWidth: 1.2, backingColor: 'transparent', filters: cleanFilters() },
      { id: makeId(), imageId: slot2Id, x: 52, y: 694, w: 150, h: 184, rotation: 0, opacity: 0, color: '#fbcfe8', lineWidth: 1.2, backingColor: 'transparent', filters: cleanFilters() },
      { id: makeId(), imageId: slot3Id, x: 580, y: 656, w: 250, h: 122, rotation: 0, opacity: 0, color: '#fbcfe8', lineWidth: 1.2, backingColor: 'transparent', filters: cleanFilters() }
    ];

    state.fragments = [];

    // 3. 七大 Ps 自由变换选区视窗 (7 Effect Specimen Callouts)
    // 视窗 1：耳机顶部马赛克像素化 (Headphone Mosaic)
    const f1 = makeFrame(1, {
      sourceId: 'main',
      labelPrefix: '', labelNumber: '',
      x: 278, y: 194, w: 160, h: 162,
      color: '#fbcfe8', lineWidth: 1.2, strokeStyle: 'solid', frameStyle: 'full',
      showHandles: true, handleColor: '#ffffff', handleStrokeColor: '#fbcfe8', handleSize: 7,
      showLabel: false
    });
    const d1 = makeDetail(f1, 0, {
      x: 278, y: 194, w: 160, h: 162, rotation: 0,
      color: '#fbcfe8', lineWidth: 1.2, backingColor: 'transparent',
      filterType: 'mosaic_sharp', mosaicSize: 10, contrast: 25, brightness: 5,
      showHandles: true, handleColor: '#ffffff', handleStrokeColor: '#fbcfe8', handleSize: 7,
      showTag: false, lineOpacity: 0
    });

    // 视窗 2：左肩同心圆半调与颗粒 (Left Shoulder Concentric Halftone)
    const f2 = makeFrame(2, {
      sourceId: (isUserMode && slot2Id) ? slot2Id : 'main',
      labelPrefix: '', labelNumber: '',
      x: 134, y: 318, w: 256, h: 186,
      color: '#fbcfe8', lineWidth: 1.2, strokeStyle: 'solid', frameStyle: 'full',
      showHandles: true, handleColor: '#ffffff', handleStrokeColor: '#fbcfe8', handleSize: 7,
      showLabel: false
    });
    const d2 = makeDetail(f2, 1, {
      x: 134, y: 318, w: 256, h: 186, rotation: 0,
      color: '#fbcfe8', lineWidth: 1.2, backingColor: 'transparent',
      filterType: 'circle_halftone', halftoneStrength: 85, grain: 24,
      duotoneDark: '#0b1a3d', duotoneLight: '#9cb3ff', duotone: true,
      showHandles: true, handleColor: '#ffffff', handleStrokeColor: '#fbcfe8', handleSize: 7,
      showTag: false, lineOpacity: 0
    });

    // 视窗 3：右侧面容与墨镜彩色半调 (Face & Glasses Color Halftone - HERO)
    const f3 = makeFrame(3, {
      sourceId: (isUserMode && slot1Id) ? slot1Id : 'main',
      labelPrefix: '', labelNumber: '',
      x: 500, y: 298, w: 344, h: 254,
      color: '#fbcfe8', lineWidth: 1.2, strokeStyle: 'solid', frameStyle: 'full',
      showHandles: true, handleColor: '#ffffff', handleStrokeColor: '#fbcfe8', handleSize: 7,
      showLabel: false
    });
    const d3 = makeDetail(f3, 2, {
      x: 500, y: 298, w: 344, h: 254, rotation: 0,
      color: '#fbcfe8', lineWidth: 1.2, backingColor: 'transparent',
      filterType: 'color_halftone', halftoneStrength: 90, halftoneDensity: 64, halftoneSize: 6,
      duotoneDark: '#122db5', duotoneLight: '#dbe8ff', duotone: true,
      showHandles: true, handleColor: '#ffffff', handleStrokeColor: '#fbcfe8', handleSize: 7,
      showTag: false, lineOpacity: 0
    });

    // 视窗 4：左臂 20 像素 Bayer 位图点阵 (Arm Bitmap Dither)
    const f4 = makeFrame(4, {
      sourceId: (isUserMode && slot3Id) ? slot3Id : 'main',
      labelPrefix: '', labelNumber: '',
      x: 52, y: 694, w: 150, h: 184,
      color: '#fbcfe8', lineWidth: 1.2, strokeStyle: 'solid', frameStyle: 'full',
      showHandles: true, handleColor: '#ffffff', handleStrokeColor: '#fbcfe8', handleSize: 7,
      showLabel: false
    });
    const d4 = makeDetail(f4, 3, {
      x: 52, y: 694, w: 150, h: 184, rotation: 0,
      color: '#fbcfe8', lineWidth: 1.2, backingColor: 'transparent',
      filterType: 'dither', ditherStep: 5, contrast: 28,
      duotoneDark: '#141d38', duotoneLight: '#9ab0ff',
      showHandles: true, handleColor: '#ffffff', handleStrokeColor: '#fbcfe8', handleSize: 7,
      showTag: false, lineOpacity: 0
    });

    // 视窗 5：左下腹斜向点状半调 (Waist Slanted Dot Halftone)
    const f5 = makeFrame(5, {
      sourceId: 'main',
      labelPrefix: '', labelNumber: '',
      x: 68, y: 942, w: 164, h: 98,
      color: '#fbcfe8', lineWidth: 1.2, strokeStyle: 'solid', frameStyle: 'full',
      showHandles: true, handleColor: '#ffffff', handleStrokeColor: '#fbcfe8', handleSize: 7,
      showLabel: false
    });
    const d5 = makeDetail(f5, 4, {
      x: 68, y: 942, w: 164, h: 98, rotation: 0,
      color: '#fbcfe8', lineWidth: 1.2, backingColor: 'transparent',
      filterType: 'dot_halftone', halftoneStrength: 80, halftoneAngle: -18, halftoneDensity: 60, halftoneSize: 6,
      duotoneDark: '#162878', duotoneLight: '#b8d0ff',
      showHandles: true, handleColor: '#ffffff', handleStrokeColor: '#fbcfe8', handleSize: 7,
      showTag: false, lineOpacity: 0
    });

    // 视窗 6：胸前图案 2 阶调阈值与颗粒 (T-Shirt Graphic Threshold)
    const f6 = makeFrame(6, {
      sourceId: 'main',
      labelPrefix: '', labelNumber: '',
      x: 450, y: 684, w: 182, h: 386,
      color: '#fbcfe8', lineWidth: 1.2, strokeStyle: 'solid', frameStyle: 'full',
      showHandles: true, handleColor: '#ffffff', handleStrokeColor: '#fbcfe8', handleSize: 7,
      showLabel: false
    });
    const d6 = makeDetail(f6, 5, {
      x: 450, y: 684, w: 182, h: 386, rotation: 0,
      color: '#fbcfe8', lineWidth: 1.2, backingColor: 'transparent',
      filterType: 'threshold', thresholdLevel: 132, grain: 32,
      duotoneDark: '#0b1632', duotoneLight: '#eef3ff',
      showHandles: true, handleColor: '#ffffff', handleStrokeColor: '#fbcfe8', handleSize: 7,
      showTag: false, lineOpacity: 0
    });

    // 视窗 7：右腰线性半调与水平动感扫描 (Right Waist Scanline Halftone)
    const f7 = makeFrame(7, {
      sourceId: 'main',
      labelPrefix: '', labelNumber: '',
      x: 580, y: 656, w: 250, h: 122,
      color: '#fbcfe8', lineWidth: 1.2, strokeStyle: 'solid', frameStyle: 'full',
      showHandles: true, handleColor: '#ffffff', handleStrokeColor: '#fbcfe8', handleSize: 7,
      showLabel: false
    });
    const d7 = makeDetail(f7, 6, {
      x: 580, y: 656, w: 250, h: 122, rotation: 0,
      color: '#fbcfe8', lineWidth: 1.2, backingColor: 'transparent',
      filterType: 'line_halftone', halftoneStrength: 85, halftoneAngle: 0, halftoneDensity: 58,
      duotoneDark: '#14225a', duotoneLight: '#6ba0ff', duotone: true,
      showHandles: true, handleColor: '#ffffff', handleStrokeColor: '#fbcfe8', handleSize: 7,
      showTag: false, lineOpacity: 0
    });

    state.frames = [f1, f2, f3, f4, f5, f6, f7];
    state.details = [d1, d2, d3, d4, d5, d6, d7];

    // 4. 排版文字 (Texts)
    state.texts = [
      // Photoshop 软件徽标 (Ps Icon Badge)
      {
        id: 't-ps-icon', kind: 'caption', content: 'Ps',
        x: 68, y: 46, size: 28, weight: 900,
        font: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#31a8ff', align: 'center',
        badgeShape: 'ps-icon', badgeWidth: 54, badgeHeight: 54,
        badgeColor: '#001e36', badgeBorderColor: '#1473e6'
      },
      // 主标题：画像エフェクトの組み合わせ例 7選
      {
        id: 't-title-main', kind: 'hero', content: '画像エフェクトの組み合わせ例 7選',
        x: 118, y: 38, size: 36, weight: 900,
        font: 'PingFang SC, Source Han Sans SC, "Noto Sans CJK JP", sans-serif',
        color: '#ffffff', letterSpacing: -0.5, opacity: 100
      },
      // 副标题：7 Photoshop Image Effect Combinations That Work Well Together
      {
        id: 't-title-sub', kind: 'caption', content: '7 Photoshop Image Effect Combinations That Work Well Together',
        x: 120, y: 84, size: 14.5, weight: 600,
        font: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#b8c4d8', letterSpacing: 0.2, opacity: 90
      },
      // 标注 1 (耳机顶部)
      {
        id: 't-recipe-1', kind: 'micro',
        content: 'モザイク（ピクセレート）\nMosaic (Pixelate)\n+\nカラーハーフトーン（ピクセレート）\nColor Halftone (Pixelate)',
        x: 260, y: 198, size: 11, weight: 600,
        font: 'PingFang SC, Source Han Sans SC, "Noto Sans CJK JP", sans-serif',
        color: '#dbeafe', align: 'right', lineHeight: 1.22, opacity: 95
      },
      // 标注 2 (左肩蝴蝶)
      {
        id: 't-recipe-2', kind: 'micro',
        content: 'ハーフトーンパターン「円」（フィルターギャラリー）\nHalftone Pattern \'Circle\' (Filter Gallery)\n+\n粒子（調整レイヤー）\nGrain Effect (Adjustment Layer)\n+\nグラデーションマップ（調整レイヤー）\nGradient Map (Adjustment Layer)',
        x: 134, y: 516, size: 10, weight: 600,
        font: 'PingFang SC, Source Han Sans SC, "Noto Sans CJK JP", sans-serif',
        color: '#c7d7f0', align: 'left', lineHeight: 1.22, opacity: 90
      },
      // 标注 3 (右侧面容 - HERO)
      {
        id: 't-recipe-3', kind: 'micro',
        content: 'カラーハーフトーン（ピクセレート）\nColor Halftone (Pixelate)\n+\nグラデーションマップ（调整レイヤー）\nGradient Map (Adjustment Layer)',
        x: 844, y: 192, size: 11, weight: 600,
        font: 'PingFang SC, Source Han Sans SC, "Noto Sans CJK JP", sans-serif',
        color: '#dbeafe', align: 'right', lineHeight: 1.22, opacity: 95
      },
      // 标注 4 (左臂位图)
      {
        id: 't-recipe-4', kind: 'micro',
        content: 'モノクロ 2 階調 (20pixel)\nBitmap (20 pixels)\n+\nグラデーションマップ（調整レイヤー）\nGrain Effect (Adjustment Layer)',
        x: 214, y: 730, size: 10.5, weight: 600,
        font: 'PingFang SC, Source Han Sans SC, "Noto Sans CJK JP", sans-serif',
        color: '#c7d7f0', align: 'left', lineHeight: 1.22, opacity: 90
      },
      // 标注 5 (左下腹点状)
      {
        id: 't-recipe-5', kind: 'micro',
        content: 'ハーフトーンパターン「ドット」（フィルターギャラリー）\nHalftone Pattern \'Dot\' (Filter Gallery)\n+\nグラデーションマップ（調整レイヤー）\nGrain Effect (Adjustment Layer)',
        x: 68, y: 1052, size: 9.5, weight: 600,
        font: 'PingFang SC, Source Han Sans SC, "Noto Sans CJK JP", sans-serif',
        color: '#b0c4de', align: 'left', lineHeight: 1.22, opacity: 85
      },
      // 标注 6 (T恤图案阈值)
      {
        id: 't-recipe-6', kind: 'micro',
        content: '2 階調化（調整レイヤー）\nThreshold (Adjustment Layer)\n+\n粒子（調整レイヤー）\nGrain Effect (Adjustment Layer)\n+\nグラデーションマップ（調整レイヤー）\nGrain Effect (Adjustment Layer)',
        x: 644, y: 888, size: 10, weight: 600,
        font: 'PingFang SC, Source Han Sans SC, "Noto Sans CJK JP", sans-serif',
        color: '#c7d7f0', align: 'left', lineHeight: 1.22, opacity: 90
      },
      // 标注 7 (右腰线状半调)
      {
        id: 't-recipe-7', kind: 'micro',
        content: 'ハーフトーンパターン「線」\n（フィルターギャラリー）\nHalftone Pattern \'Line\' (Filter Gallery)\n+\nぼかし（移動）\nMotion Blur\n+\nグラデーションマップ（調整レイヤー）\nGradient Map (Adjustment Layer)',
        x: 844, y: 772, size: 9.5, weight: 600,
        font: 'PingFang SC, Source Han Sans SC, "Noto Sans CJK JP", sans-serif',
        color: '#c7d7f0', align: 'right', lineHeight: 1.22, opacity: 90
      },
      // 水印标注 (tamasan_design)
      {
        id: 't-credit', kind: 'micro', content: 'tamasan_design',
        x: 24, y: 1160, size: 11, weight: 600,
        font: 'ui-monospace, Consolas, monospace',
        color: '#4a5568', rotation: -90, opacity: 85
      }
    ];

    state.layers = [
      { type: 'main', id: 'main-image' },
      ...state.secondaries.map(s => ({ type: 'secondary', id: s.id })),
      { type: 'frame', id: f1.id }, { type: 'detail', id: d1.id }, { type: 'connector', id: d1.id },
      { type: 'frame', id: f2.id }, { type: 'detail', id: d2.id }, { type: 'connector', id: d2.id },
      { type: 'frame', id: f3.id }, { type: 'detail', id: d3.id }, { type: 'connector', id: d3.id },
      { type: 'frame', id: f4.id }, { type: 'detail', id: d4.id }, { type: 'connector', id: d4.id },
      { type: 'frame', id: f5.id }, { type: 'detail', id: d5.id }, { type: 'connector', id: d5.id },
      { type: 'frame', id: f6.id }, { type: 'detail', id: d6.id }, { type: 'connector', id: d6.id },
      { type: 'frame', id: f7.id }, { type: 'detail', id: d7.id }, { type: 'connector', id: d7.id },
      ...state.texts.map(t => ({ type: 'text', id: t.id }))
    ];

    state.remixInfo = {
      anchorZh: isUserMode ? '排版 REMIX [2/2] · Photoshop 选区采样 7 选 (用户图片)' : '排版 REMIX [2/2] · Photoshop 选区采样 7 选',
      anchorEn: 'Layout REMIX [2/2] · Photoshop 7 Effect Showcase',
      mainLayoutZh: '暗调主图 · 7 处自由变换选区视窗',
      mainLayoutEn: 'Moody Base · 7 Transform Specimen Windows',
      typographyZh: 'Ps 软件徽标与特效配方标注',
      typographyEn: 'Photoshop Badge & Effect Annotation',
      backgroundZh: '深邃暗夜影棚微光',
      backgroundEn: 'Deep Studio Dark Vignette',
      strengthZh: isUserMode ? '专属图片应用' : '选区教程排版',
      strengthEn: isUserMode ? 'Custom Asset Applied' : 'Selection Specimen Layout',
      isManuallyEdited: false
    };

    state.selected = null;
    emptyState.classList.add('is-hidden');
    status.textContent = isUserMode
      ? `LAYOUT [2/2] · ${(state.imageName || 'CUSTOM IMAGE').toUpperCase()}`
      : 'LAYOUT [2/2] / PHOTOSHOP 7 EFFECTS';

    syncAllChildFramesOf('main');
    (state.secondaries || []).forEach(s => syncAllChildFramesOf(s.id));
    renderImageTray(); renderInspector(); render();
    if (isReset) { history = []; historyIndex = -1; }
    commit(); updateRemixCard();
    if (zoomMode === 'fit') requestAnimationFrame(fitWorkspace);
    motion.play(previousPoster);
    if (showToast) {
      const resolvedToast = toastMsg || (isUserMode
        ? '📐 排版 REMIX [2/2] (排版模板 02)：已应用 Photoshop 选区采样 7 选构图 (已适配您的专属图片)'
        : '📐 排版 REMIX [2/2] (排版模板 02)：Photoshop 选区采样 7 选构图');
      toast(resolvedToast);
    }
  }

  const layoutRemixList = [
    { id: 'layout-01', nameZh: 'Aespa 电光档案构图', apply: applyLayoutTemplate01 },
    { id: 'layout-02', nameZh: 'Photoshop 选区采样 7 选构图', apply: applyLayoutTemplate02 }
  ];

  const masterRemixList = [
    { nameZh: 'Aespa 电光档案', shortZh: 'Aespa 电光', layoutIdx: 0, filterIdx: 0 },
    { nameZh: 'Photoshop 特效搭配 7 选', shortZh: 'Ps 特效 7 选', layoutIdx: 1, filterIdx: 1 }
  ];

  let currentLayoutIndex = 0;
  let currentFilterIndex = 0;
  let currentMasterIndex = -1;

  function cycleLayoutRemix() {
    const total = layoutRemixList.length;
    currentLayoutIndex = (currentLayoutIndex + 1) % total;
    const item = layoutRemixList[currentLayoutIndex];
    if (item?.apply) {
      item.apply(null, false, true, `📐 排版 REMIX [${currentLayoutIndex + 1}/${total}]：${item.nameZh}`);
    }
  }

  function cycleFilterRemix() {
    const total = filterRemixList.length;
    currentFilterIndex = (currentFilterIndex + 1) % total;
    const item = filterRemixList[currentFilterIndex];
    if (item?.apply) {
      item.apply(true, `🎨 滤镜 REMIX [${currentFilterIndex + 1}/${total}]：${item.nameZh}`);
    }
  }

  function applyMasterRemixByIndex(index, images, isReset = false, customMsg = '') {
    const total = masterRemixList.length;
    const resolvedIndex = isReset ? 0 : (((index % total) + total) % total);
    const m = masterRemixList[resolvedIndex];
    currentMasterIndex = isReset ? -1 : resolvedIndex;
    currentLayoutIndex = m.layoutIdx;
    currentFilterIndex = m.filterIdx;

    layoutRemixList[m.layoutIdx].apply(images, isReset, false);
    filterRemixList[m.filterIdx].apply(false);

    const dockSub = document.querySelector('#posterMasterRemixSub');
    if (dockSub) dockSub.textContent = `[${resolvedIndex + 1}/${total}] 排版 0${m.layoutIdx + 1} + 滤镜 0${m.filterIdx + 1}`;
    const dockTag = document.querySelector('#posterMasterRemixTag');
    if (dockTag) dockTag.textContent = `[${resolvedIndex + 1}/${total}] ↻`;
    const toplineText = document.querySelector('#posterMasterRemixToplineText');
    if (toplineText) toplineText.textContent = `[${resolvedIndex + 1}/${total}] ${m.shortZh}`;

    const isUserMode = !isReset && hasUserUploadedImages();
    const resolvedToast = customMsg || (isUserMode
      ? `⚡ 总 REMIX [${resolvedIndex + 1}/${total}] 已生效：已为您的图片应用模板 0${resolvedIndex + 1} (${m.nameZh})`
      : `⚡ 总 REMIX [${resolvedIndex + 1}/${total}] 已生效：${m.nameZh} (排版 0${m.layoutIdx + 1} + 滤镜 0${m.filterIdx + 1})`);
    toast(resolvedToast);
  }

  function cycleMasterRemix() {
    const nextIndex = (currentMasterIndex + 1 + masterRemixList.length) % masterRemixList.length;
    applyMasterRemixByIndex(nextIndex, null, false);
  }

  function applyTemplate01(images, isReset = false, toastMsg = '') {
    applyMasterRemixByIndex(0, images, isReset, toastMsg);
  }

  function applyDemo(image) {
    ensureKarinaMultiAssets(images => {
      applyMasterRemixByIndex(0, images, true);
    });
  }

  function loadDemo(show = true) {
    if (show && hasSecondaryImages() && !window.confirm('恢复示范模板会替换当前海报及历史记录。确定恢复吗？')) return;
    ensureKarinaMultiAssets(images => {
      applyMasterRemixByIndex(0, images, true, show ? '示范模板已恢复为 Aespa 多图精选档案。' : '');
    });
  }

  function preset(name) {
    if (name === 'electric' || name === 'template-01-electric') {
      currentFilterIndex = 0; applyFilterTemplate01(true); return;
    }
    const all = {
      red:      { background:'#d8d6d0', backgroundStyle:'scan',  accent:'#c32631', border:'#ffffff', borderWidth:7,
                  filters:{bw:0,brightness:-2,contrast:32,saturation:110,halftone:0,halftoneSize:9,halftoneDensity:58,halftoneAngle:15,grain:14,rough:0,outline:0,scan:20,scanAngle:0,paper:16,dirty:10,compression:0,invert:0,posterize:0} },
      blue:     { background:'#dbe3e9', backgroundStyle:'grid',  accent:'#1f54bd', border:'#171717', borderWidth:5,
                  filters:{bw:0,brightness:0,contrast:25,saturation:100,halftone:0,halftoneSize:7,halftoneDensity:62,halftoneAngle:-15,grain:10,rough:0,outline:0,scan:12,scanAngle:90,paper:8,dirty:0,compression:0,invert:0,posterize:0} },
      editorial:{ background:'#e4dfd3', backgroundStyle:'paper', accent:'#2355b7', border:'#ffffff', borderWidth:6,
                  filters:{bw:0,brightness:2,contrast:28,saturation:100,halftone:0,halftoneSize:12,halftoneDensity:63,halftoneAngle:22,grain:18,rough:0,outline:0,scan:10,scanAngle:0,paper:35,dirty:12,compression:0,invert:0,posterize:0} },
      chrome:   { background:'#0b1220', backgroundStyle:'liquid-chrome', accent:'#c8d8ff', border:'#ffffff', borderWidth:4,
                  filters:{bw:0,brightness:5,contrast:30,saturation:80,halftone:0,halftoneSize:8,halftoneDensity:55,halftoneAngle:0,grain:18,rough:0,outline:0,scan:8,scanAngle:0,paper:0,dirty:0,compression:0,invert:0,posterize:0} },
      xerox:    { background:'#d8d5cc', backgroundStyle:'solid', accent:'#111111', border:'#111111', borderWidth:0,
                  filters:{bw:100,brightness:2,contrast:95,saturation:0,halftone:80,halftoneSize:15,halftoneDensity:48,halftoneAngle:-18,grain:65,rough:50,outline:0,scan:55,scanAngle:0,paper:65,dirty:70,compression:25,invert:0,posterize:45} }
    };
    const p = all[name]; if (!p) return;
    const previousPoster = motion.capture();
    state.background = p.background;
    state.backgroundStyle = p.backgroundStyle || 'solid';
    state.backgroundImageId = null;
    state.border = true;
    state.borderColor = p.border;
    state.borderWidth = p.borderWidth;
    state.filters = { ...cleanFilters(), ...p.filters };
    (state.frames || []).forEach(f => { f.color = p.accent; f.tagBackground = p.accent; f.tagTextColor = '#ffffff'; });
    (state.details || []).forEach(d => { d.color = p.accent; d.lineColor = p.accent; });
    (state.texts || []).forEach(t => { if (t.kind === 'hero' || t.kind === 'repeat') t.color = p.accent; });
    document.querySelectorAll('[data-poster-preset]').forEach(b => b.classList.toggle('is-active', b.dataset.posterPreset === name));
    render(); renderInspector(); commit(); markManuallyEdited(); motion.play(previousPoster);
    toast(`🎨 风格预设已应用：${name.toUpperCase()}`);
  }

  function applyPosterBackground(style) {
    const colors = {
      'electric-tiger': '#001fd4',
      'liquid-chrome': '#0b1220',
      'pure-black': '#000000',
      'pure-white': '#ffffff',
      solid: '#efeee8',
      grid: '#e5e9e8',
      chrome: '#dbe7f4',
      scan: '#e5dfd2',
      dots: '#e9e6df',
      'soft-y2k': '#e5e2ef',
      blueprint: '#b9cbed'
    };
    if (style === 'electric-tiger') {
      state.backgroundStyle = 'electric-tiger';
      state.background = '#001fd4';
      state.borderColor = '#ffffff';
    } else if (style === 'liquid-chrome') {
      state.backgroundStyle = 'liquid-chrome';
      state.background = '#0b1220';
      state.borderColor = '#ffffff';
      (state.texts || []).forEach(t => {
        if (['#111111', '#151515', '#161616', '#171717', '#000000', '#191816', '#181818'].includes(t.color)) {
          t.color = '#ffffff';
        }
      });
    } else if (style === 'pure-black') {
      state.backgroundStyle = 'solid';
      state.background = '#000000';
      state.borderColor = '#ffffff';
      (state.texts || []).forEach(t => {
        if (['#111111', '#151515', '#161616', '#171717', '#000000', '#191816', '#181818'].includes(t.color)) {
          t.color = '#ffffff';
        }
      });
    } else if (style === 'pure-white') {
      state.backgroundStyle = 'solid';
      state.background = '#ffffff';
      state.borderColor = '#111111';
      (state.texts || []).forEach(t => {
        if (['#ffffff', '#f5f5f5', '#fff'].includes(t.color)) {
          t.color = '#111111';
        }
      });
    } else {
      state.backgroundStyle = style;
      state.background = colors[style] || state.background;
    }
    setSelected(null,null); renderInspector(); render(); commit(); markManuallyEdited(); toast(`背景已切换 · ${style.toUpperCase()}`);
  }

  const layoutTemplates = [
    { id: 'template-01-richman', nameZh: '模板 01 · Aespa 电光档案', apply: applyLayoutTemplate01 },
    { id: 'template-02-ps7', nameZh: '模板 02 · Photoshop 特效 7 选', apply: applyLayoutTemplate02 }
  ];

  function applyLayoutTemplate(templateId) {
    const idx = layoutRemixList.findIndex(x => x.id === templateId || x.nameZh.includes(templateId));
    if (idx !== -1) {
      currentLayoutIndex = idx;
      layoutRemixList[idx].apply(null, false, true);
    } else {
      cycleLayoutRemix();
    }
  }

  function triggerMasterRemix() {
    cycleMasterRemix();
  }

  function remixLayout(strength = 'medium') {
    cycleLayoutRemix();
  }

  function remixFilters(strength = 'medium') {
    cycleFilterRemix();
  }

  function exportPoster() {
    if (!state.image) return toast('请先上传主图。');
    try {
      render(false);
      const [targetW, targetH] = state.exportResolution || [1200, 1600];
      const out = document.createElement('canvas');
      out.width = targetW;
      out.height = targetH;
      const outCtx = out.getContext('2d');
      outCtx.imageSmoothingEnabled = true;
      outCtx.imageSmoothingQuality = 'high';
      outCtx.drawImage(canvas, 0, 0, targetW, targetH);
      const link = document.createElement('a');
      link.download = `collage-poster-${targetW}x${targetH}-${Date.now()}.png`;
      link.href = out.toDataURL('image/png');
      link.click();
      render();
      toast(`PNG 海报已导出 · ${targetW} × ${targetH}`);
    } catch(e) {
      render();
      console.error(e);
      toast('导出失败，请通过 localhost 打开或重新上传图片。');
    }
  }

  $('.poster-tools').addEventListener('click', (e) => {
    const targetItem = e.target.closest('[data-poster-action]');
    const a = targetItem?.dataset.posterAction, elemId = targetItem?.dataset.id;
    if (!a) return;
    if (a === 'demo') loadDemo();
    if (a === 'frame') addFrame();
    if (a === 'detail') addDetail();
    if (a === 'connector') toast('每张局部图已自动拥有连接线。');
    if (a === 'undo') undo();
    if (a === 'redo') redo();
    if (a === 'duplicate') duplicateSelected();
    if (a === 'master-remix') { triggerMasterRemix(); return; }
    if (a === 'filter-remix') { remixFilters(); return; }
    if (a === 'remix') remixLayout($('#posterRemixStrength')?.value || 'medium');
    if (['hero', 'subtitle', 'caption', 'micro', 'repeat'].includes(a)) addText(a);
    if (a === 'select-main') {
      if (!state.main) state.main = makeMain();
      setSelected('main', state.main);
      render(); renderInspector();
      return;
    }
    if (a === 'select-secondary' && elemId) {
      const sec = (state.secondaries || []).find((s) => s.id === elemId);
      if (sec) { setSelected('secondary', sec); render(); renderInspector(); }
      return;
    }
    if (a === 'select-frame' && elemId) {
      const fr = (state.frames || []).find((f) => f.id === elemId);
      if (fr) { setSelected('frame', fr); render(); renderInspector(); }
      return;
    }
    if (a === 'select-detail' && elemId) {
      const dt = (state.details || []).find((d) => d.id === elemId);
      if (dt) { setSelected('detail', dt); render(); renderInspector(); }
      return;
    }
    if (a === 'select-text' && elemId) {
      const tx = (state.texts || []).find((t) => t.id === elemId);
      if (tx) { setSelected('text', tx); render(); renderInspector(); }
      return;
    }
  });
  $('.poster-tools').addEventListener('input', handleInspectorInput);
  $('.poster-tools').addEventListener('change', handleInspectorInput);
  document.querySelectorAll('[data-poster-preset]').forEach((b) => b.addEventListener('click', () => preset(b.dataset.posterPreset)));
  document.querySelectorAll('[data-poster-background]').forEach((b) => b.addEventListener('click', () => applyPosterBackground(b.dataset.posterBackground)));
  $('#posterBackgroundClear')?.addEventListener('click', () => { state.backgroundImageId = null; renderInspector(); render(); commit(); markManuallyEdited(); toast('自定义背景图已移除。'); });
  $('#posterExportButton').addEventListener('click', exportPoster);
  const resSelect = $('#posterResolutionSelect');
  const resDisplay = $('#posterResolutionDisplay');
  const resTag = $('#posterResolutionTag');
  const exportBtn = $('#posterExportButton');
  if (resSelect) {
    resSelect.addEventListener('change', () => {
      const [w, h] = resSelect.value.split('x').map(Number);
      if (w && h) {
        state.exportResolution = [w, h];
        if (resDisplay) resDisplay.textContent = `${w} × ${h} / PNG`;
        const tagMap = { '1080x1440': '1K', '1200x1600': '1.2K', '1500x2000': '1.5K', '1800x2400': '2K', '2400x3200': '3K', '3000x4000': '4K' };
        const tag = tagMap[resSelect.value] || `${Math.round(w / 1000 * 10) / 10}K`;
        if (resTag) resTag.textContent = tag;
        if (exportBtn) exportBtn.title = `导出高清 PNG (${w} × ${h} · ${tag})`;
        toast(`海报导出分辨率已设为 ${w} × ${h} (${tag})`);
      }
    });
  }
  function handleInspectorInput(e) {
    const c = e.target, p = c.dataset.prop || c.dataset.global;
    if (!p) return;
    let root = c.dataset.global ? (p in state.filters ? state.filters : state) : selectedObject();
    if (!root) return;

    if (p === 'mainOpacity' || p === 'mainZoom' || p === 'mainPanX' || p === 'mainPanY' || p === 'mainRotation') {
      if (!state.main) state.main = makeMain();
      const val = Number(c.value);
      if (p === 'mainOpacity') state.main.opacity = val;
      if (p === 'mainZoom') state.main.zoom = val;
      if (p === 'mainPanX') state.main.panX = val;
      if (p === 'mainPanY') state.main.panY = val;
      if (p === 'mainRotation') {
        state.main.rotation = val;
        syncAllChildFramesOf('main');
      }
      scheduleRender();
      syncLeftControls();
      const out = c.closest('.poster-field')?.querySelector('output');
      if (out) out.textContent = c.value;
      commit(false);
      markManuallyEdited();
      return;
    }

    if (state.selected?.type === 'secondary' && !c.dataset.global) {
      if (p === 'secAppearance') {
        const v = c.value;
        root.appearance = v;
        if (!root.filters) root.filters = cleanFilters();
        if (v === 'original') { root.filters.bw = 0; root.filters.contrast = 0; }
        else if (v === 'bw') { root.filters.bw = 100; root.filters.contrast = 15; }
        else if (v === 'highbw') { root.filters.bw = 100; root.filters.contrast = 55; }
        scheduleRender();
        commit(false);
        markManuallyEdited();
        return;
      }
      if (p === 'secGrain') {
        if (!root.filters) root.filters = cleanFilters();
        root.filters.grain = Number(c.value);
        scheduleRender();
        const out = c.closest('.poster-field')?.querySelector('output');
        if (out) out.textContent = c.value;
        commit(false);
        markManuallyEdited();
        return;
      }
      if (p === 'secFramePreset') {
        const v = c.value;
        if (v === 'none') { root.lineWidth = 0; }
        else if (v === 'thin') { root.lineWidth = 1; root.color = '#ffffff'; root.backingColor = '#ffffff'; }
        else if (v === 'white-border') { root.lineWidth = 4; root.color = '#ffffff'; root.backingColor = '#ffffff'; }
        else if (v === 'editorial') { root.lineWidth = 8; root.color = '#ffffff'; root.backingColor = '#ffffff'; }
        renderInspector();
        scheduleRender();
        commit(false);
        markManuallyEdited();
        return;
      }
      if (['bw','brightness','contrast','saturation','halftone','halftoneSize','halftoneDensity','halftoneAngle','scan','scanAngle','grain','rough','paper','dirty','compression','outline','invert','posterize'].includes(p)) {
        if (!root.filters) root.filters = cleanFilters();
        root = root.filters;
      }
    }
    if (c.type === 'number' && (c.value === '' || !Number.isFinite(c.valueAsNumber))) return;
    root[p] = c.type === 'checkbox' ? c.checked : (c.type === 'range' || c.type === 'number' ? Number(c.value) : c.value);
    if (['w', 'h'].includes(p)) root[p] = Math.max(20, root[p]);
    if (['x','y','w','h','rotation'].includes(p)) {
      if (state.selected?.type === 'secondary' || state.selected?.type === 'main') {
        syncAllChildFramesOf(root.id);
      } else if (state.selected?.type === 'frame') {
        syncFrameRelativeToParent(root);
      }
    }
    if (p === 'filterType' && state.selected?.type === 'detail') {
      renderInspector();
    }
    scheduleRender();
    const out = c.closest('.poster-field')?.querySelector('output');
    if (out) out.textContent = c.value;
    commit(false);
    markManuallyEdited();
  }
  inspector.addEventListener('input', handleInspectorInput);
  inspector.addEventListener('change', (e) => {
    handleInspectorInput(e);
    if (historyTimer) commit();
  });
  inspector.addEventListener('click',(e)=>{
    const filterTemplateBtn = e.target.closest('[data-poster-filter-template]');
    if (filterTemplateBtn) {
      applyFilterTemplate01(true);
      return;
    }
    const presetBtn = e.target.closest('[data-poster-preset]');
    if (presetBtn) {
      preset(presetBtn.dataset.posterPreset);
      return;
    }
    const bgPresetBtn = e.target.closest('[data-poster-background]');
    if (bgPresetBtn) {
      applyPosterBackground(bgPresetBtn.dataset.posterBackground);
      return;
    }
    const rerollChromeBtn = e.target.closest('[data-poster-action="reroll-chrome"]');
    if (rerollChromeBtn) {
      if (window.posterLiquidChrome) {
        state.liquidChromeSeed = (state.liquidChromeSeed || 0) + 1.37;
        window.posterLiquidChrome.regenerate(W, H);
        render();
        commit();
        markManuallyEdited();
        toast('酸性全息水银纹理已更新。');
      }
      return;
    }
    const filterRemixBtn = e.target.closest('[data-poster-action="filter-remix"]');
    if (filterRemixBtn) {
      remixFilters($('#posterRemixStrength')?.value || 'medium');
      return;
    }
    const segBtn = e.target.closest('.poster-segmented button');
    if (segBtn) {
      const p = segBtn.dataset.prop || segBtn.dataset.global;
      let root = segBtn.dataset.global ? (p in state.filters ? state.filters : state) : selectedObject();
      if (root && p) {
        if (state.selected?.type === 'secondary' && !segBtn.dataset.global) {
          if (['scanAngle'].includes(p)) {
            if (!root.filters) root.filters = cleanFilters();
            root = root.filters;
          }
        }
        let rawVal = segBtn.dataset.val;
        let parsedVal = rawVal;
        if (!isNaN(Number(rawVal)) && rawVal.trim() !== '') parsedVal = Number(rawVal);
        root[p] = parsedVal;
        const parentSeg = segBtn.closest('.poster-segmented');
        if (parentSeg) {
          parentSeg.querySelectorAll('button').forEach((b) => b.classList.toggle('is-active', b === segBtn));
        }
        render();
        commit(false);
        markManuallyEdited();
      }
      return;
    }
    if (e.target.id === 'posterInspectorBgClear') {
      state.backgroundImageId = null;
      renderInspector();
      render();
      commit();
      markManuallyEdited();
      toast('背景图已移除。');
      return;
    }
    const targetItem = e.target.closest('[data-poster-action]');
    const a = targetItem?.dataset.posterAction, elemId = targetItem?.dataset.id;
    if (a === 'select-main') {
      if (!state.main) state.main = makeMain();
      setSelected('main', state.main);
      render();
      renderInspector();
      return;
    }
    if (a === 'select-secondary' && elemId) {
      const sec = (state.secondaries || []).find((s) => s.id === elemId);
      if (sec) { setSelected('secondary', sec); render(); renderInspector(); }
      return;
    }
    if (a === 'select-frame' && elemId) {
      const fr = (state.frames || []).find((f) => f.id === elemId);
      if (fr) { setSelected('frame', fr); render(); renderInspector(); }
      return;
    }
    if (a === 'select-detail' && elemId) {
      const dt = (state.details || []).find((d) => d.id === elemId);
      if (dt) { setSelected('detail', dt); render(); renderInspector(); }
      return;
    }
    if (a === 'select-text' && elemId) {
      const tx = (state.texts || []).find((t) => t.id === elemId);
      if (tx) { setSelected('text', tx); render(); renderInspector(); }
      return;
    }
    if (a === 'to-global') {
      setSelected(null, null);
      render();
      renderInspector();
      return;
    }
    if (a === 'reset-filters') {
      state.filters = cleanFilters();
      if (state.main) {
        state.main.opacity = 100;
        state.main.zoom = 1;
        state.main.panX = 0;
        state.main.panY = 0;
        state.main.rotation = 0;
      }
      renderInspector();
      render();
      commit();
      markManuallyEdited();
      toast('已恢复原图清晰质感，所有破坏性滤镜已清空。');
      return;
    }
    if (a === 'delete') deleteSelected();
    if (a === 'detail') addDetail();
    if (a === 'duplicate') duplicateSelected();
    if (a === 'frame-for-secondary') addFrame(selectedObject());
    if (a === 'add-evidence-for-card') {
      const sec = selectedObject();
      if (sec) addEvidenceCropForAsset(sec.imageId);
    }
    const l = e.target.closest('[data-layer-action]')?.dataset.layerAction;
    if (l) changeLayer(l);
  });
  $('#posterDeselectButton')?.addEventListener('click', () => {
    setSelected(null, null);
    render();
    renderInspector();
  });
  $('#posterAddImagesButton')?.addEventListener('click', () => multiInput?.click());
  imageTray?.addEventListener('click', (e) => {
    const item = e.target.closest('.poster-tray-item');
    if (!item) return;
    const assetId = item.dataset.assetId;
    const actionBtn = e.target.closest('[data-tray-action]');
    if (actionBtn) {
      const action = actionBtn.dataset.trayAction;
      if (action === 'set-main') setMainImage(assetId);
      if (action === 'add-card') addSecondaryImage(assetId);
      if (action === 'add-evidence') addEvidenceCropForAsset(assetId);
      if (action === 'delete') deleteAsset(assetId);
      return;
    }
    const sec = state.secondaries?.find((s) => s.imageId === assetId);
    if (sec) {
      setSelected('secondary', sec);
      render();
    } else if (state.mainImageId === assetId) {
      setSelected('main', state.main);
      render();
    }
  });
  function handlePosterImageUpload(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    toast(`正在读取 ${files.length} 张图片素材...`);
    let loadedCount = 0;
    const newlyLoaded = new Array(files.length);
    const stepDone = () => {
      loadedCount++;
      if (loadedCount === files.length) {
        const loaded = newlyLoaded.filter(Boolean);
        if (!loaded.length) {
          toast('未能载入图片，请检查图片格式。');
          if (input) input.value = '';
          if (multiInput) multiInput.value = '';
          return;
        }

        commit();

        const isUserMode = hasUserUploadedImages();

        if (!isUserMode) {
          // 当前为示范图模式或空画布：清除示范图，切换为用户自己的素材
          state.assets = [];
          const mainAsset = loaded[0];
          imageAssets.set(mainAsset.id, mainAsset);
          state.assets.push({ id: mainAsset.id, name: mainAsset.name });
          state.image = mainAsset.image;
          state.imageName = mainAsset.name;
          state.mainImageId = mainAsset.id;
          ensureMainLayer();
          emptyState.classList.add('is-hidden');
          status.textContent = `MAIN IMAGE / ${mainAsset.name}`;

          for (let i = 1; i < loaded.length; i++) {
            const asset = loaded[i];
            imageAssets.set(asset.id, asset);
            state.assets.push({ id: asset.id, name: asset.name });
          }

          // 自动分配槽位到当前模板卡片中
          if (state.secondaries && state.secondaries.length > 0) {
            state.secondaries.forEach((sec, idx) => {
              const targetAsset = loaded[idx % loaded.length];
              sec.imageId = targetAsset.id;
            });
          } else if (loaded.length > 1) {
            for (let i = 1; i < loaded.length; i++) {
              addSecondaryImage(loaded[i].id, {}, false);
            }
          }

          renderImageTray();
          renderInspector();
          render();
          commit();
          markManuallyEdited();

          if (loaded.length === 1) {
            toast('已载入 1 张图片（单图创作模式），已自动适配全套排版与滤镜！');
          } else {
            toast(`已载入 ${loaded.length} 张图片（多图创作模式，第 1 张已设为主图）！`);
          }
        } else {
          // 当前已经是用户创作状态：追加素材
          loaded.forEach(asset => {
            imageAssets.set(asset.id, asset);
            state.assets.push({ id: asset.id, name: asset.name });
            if (!state.image) {
              state.image = asset.image;
              state.imageName = asset.name;
              state.mainImageId = asset.id;
              ensureMainLayer();
              emptyState.classList.add('is-hidden');
              status.textContent = `MAIN IMAGE / ${asset.name}`;
            } else {
              addSecondaryImage(asset.id, {}, false);
            }
          });

          renderImageTray();
          renderInspector();
          render();
          commit();
          markManuallyEdited();
          toast(`已添加 ${loaded.length} 张图片素材；原有海报元素已保留。`);
        }

        if (input) input.value = '';
        if (multiInput) multiInput.value = '';
      }
    };

    files.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = () => {
        const image = new Image();
        image.onload = () => {
          const id = makeId();
          newlyLoaded[index] = { id, name: file.name, image, src: reader.result };
          stepDone();
        };
        image.onerror = () => {
          console.error('Image decode failed:', file.name);
          stepDone();
        };
        image.src = reader.result;
      };
      reader.onerror = () => {
        console.error('File read failed:', file.name);
        stepDone();
      };
      reader.readAsDataURL(file);
    });
  }

  input?.addEventListener('change', () => handlePosterImageUpload(input.files));
  multiInput?.addEventListener('change', () => handlePosterImageUpload(multiInput.files));
  backgroundInput?.addEventListener('change',()=>{const file=backgroundInput.files[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{const image=new Image();image.onload=()=>{const id=makeId();backgroundAssets.set(id,image);state.backgroundImageId=id;state.backgroundImageOpacity=48;renderInspector();render();commit();markManuallyEdited();toast(`背景图已载入 · ${file.name}`);backgroundInput.value='';};image.onerror=()=>toast('背景图未能载入。');image.src=reader.result;};reader.readAsDataURL(file);});
  if (holdBeforeButton) {
    const startBefore = (e) => {
      e.preventDefault();
      if (isBeforePreviewActive) return;
      isBeforePreviewActive = true;
      holdBeforeButton.classList.add('is-active');
      render(false);
    };
    const endBefore = (e) => {
      e.preventDefault();
      if (!isBeforePreviewActive) return;
      isBeforePreviewActive = false;
      holdBeforeButton.classList.remove('is-active');
      render();
    };
    holdBeforeButton.addEventListener('pointerdown', startBefore);
    holdBeforeButton.addEventListener('pointerup', endBefore);
    holdBeforeButton.addEventListener('pointercancel', endBefore);
    holdBeforeButton.addEventListener('pointerleave', endBefore);
    holdBeforeButton.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  $('.poster-zoom-controls').addEventListener('click',(e)=>{const action=e.target.closest('[data-zoom-action]')?.dataset.zoomAction;if(action==='in')zoomBy(.1);if(action==='out')zoomBy(-.1);if(action==='actual')applyZoom(1,'manual');if(action==='fit')fitWorkspace();});
  viewport.addEventListener('wheel',(e)=>{if(!(e.ctrlKey||e.metaKey))return;e.preventDefault();const r=viewport.getBoundingClientRect();zoomBy(e.deltaY < 0 ? .08 : -.08,{x:e.clientX-r.left,y:e.clientY-r.top});},{passive:false});
  viewport.addEventListener('pointerdown',(e)=>{if(!spaceDown)return;e.preventDefault();e.stopPropagation();pan={x:e.clientX,y:e.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};viewport.classList.add('is-panning');viewport.setPointerCapture(e.pointerId);},true);
  viewport.addEventListener('pointermove',(e)=>{
    if (e.pointerType !== 'touch') {
      const rect = viewport.getBoundingClientRect();
      viewport.style.setProperty('--scan-x', `${((e.clientX - rect.left) / rect.width) * 100}%`);
      viewport.style.setProperty('--scan-y', `${((e.clientY - rect.top) / rect.height) * 100}%`);
      viewport.classList.add('is-tracking');
    }
    if(!pan)return;
    viewport.scrollLeft=pan.left-(e.clientX-pan.x);viewport.scrollTop=pan.top-(e.clientY-pan.y);
  });
  viewport.addEventListener('pointerleave',()=>viewport.classList.remove('is-tracking'));
  viewport.addEventListener('pointerup',()=>{pan=null;viewport.classList.remove('is-panning');});
  viewport.addEventListener('pointercancel',()=>{pan=null;viewport.classList.remove('is-panning');});
  document.addEventListener('keydown',(e)=>{if($('#posterWorkspace').hidden)return;if(e.code==='Space'&&!/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)){spaceDown=true;e.preventDefault();return;}if(/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName))return;const mod=e.ctrlKey||e.metaKey,k=e.key.toLowerCase();if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();deleteSelected();}if(mod&&k==='z'&&!e.shiftKey){e.preventDefault();undo();}if(mod&&k==='z'&&e.shiftKey){e.preventDefault();redo();}if(mod&&k==='d'){e.preventDefault();duplicateSelected();}if(!mod&&k==='f')addFrame();if(!mod&&k==='d')addDetail();});
  document.addEventListener('keyup',(e)=>{if(e.code==='Space'){spaceDown=false;pan=null;viewport.classList.remove('is-panning');}});
  window.addEventListener('resize',()=>{clearTimeout(fitTimer);fitTimer=setTimeout(()=>{if(zoomMode==='fit')fitWorkspace();},120);});
  window.addEventListener('visual-lab-mode-change', (e) => {
    viewport.classList.remove('is-tracking');
    if (e.detail.mode === 'poster' && zoomMode === 'fit') requestAnimationFrame(fitWorkspace);
  });
  window.addEventListener('blur',()=>{
    spaceDown=false; pan=null; viewport.classList.remove('is-panning');
    if(drag){drag=null;commit();renderInspector();}
  });


  function setupPosterResizers() {
    const workspace = $('#posterWorkspace');
    const resizerLeft = $('#posterResizerLeft');
    const resizerRight = $('#posterResizerRight');
    if (!workspace || !resizerLeft || !resizerRight) return;

    const DEFAULT_LEFT = 220;
    const DEFAULT_RIGHT = 260;
    const MIN_LEFT = 170;
    const MIN_RIGHT = 200;

    try {
      const savedLeft = parseInt(localStorage.getItem('yongyong_poster_left_width'), 10);
      const savedRight = parseInt(localStorage.getItem('yongyong_poster_right_width'), 10);
      if (savedLeft && savedLeft >= MIN_LEFT && savedLeft <= 650) {
        workspace.style.setProperty('--poster-left-width', `${savedLeft}px`);
      }
      if (savedRight && savedRight >= MIN_RIGHT && savedRight <= 650) {
        workspace.style.setProperty('--poster-right-width', `${savedRight}px`);
      }
    } catch (_) {}

    function initDrag(resizer, isLeft) {
      let isDragging = false;
      let startX = 0;
      let startWidth = 0;

      resizer.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        isDragging = true;
        startX = e.clientX;
        const currentStyle = getComputedStyle(workspace);
        const currentProp = isLeft ? currentStyle.getPropertyValue('--poster-left-width') : currentStyle.getPropertyValue('--poster-right-width');
        startWidth = parseInt(currentProp, 10) || (isLeft ? DEFAULT_LEFT : DEFAULT_RIGHT);

        resizer.classList.add('is-dragging');
        document.body.classList.add('is-resizing-poster');
        resizer.setPointerCapture(e.pointerId);
      });

      resizer.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const maxW = Math.min(650, Math.floor(window.innerWidth * 0.45));
        let nextW;
        if (isLeft) {
          nextW = Math.max(MIN_LEFT, Math.min(maxW, Math.round(startWidth + dx)));
          workspace.style.setProperty('--poster-left-width', `${nextW}px`);
        } else {
          nextW = Math.max(MIN_RIGHT, Math.min(maxW, Math.round(startWidth - dx)));
          workspace.style.setProperty('--poster-right-width', `${nextW}px`);
        }
        if (zoomMode === 'fit') {
          fitWorkspace();
        }
      });

      function stopDrag(e) {
        if (!isDragging) return;
        isDragging = false;
        resizer.classList.remove('is-dragging');
        document.body.classList.remove('is-resizing-poster');
        try { resizer.releasePointerCapture(e.pointerId); } catch (_) {}

        const finalStyle = getComputedStyle(workspace);
        const finalProp = isLeft ? finalStyle.getPropertyValue('--poster-left-width') : finalStyle.getPropertyValue('--poster-right-width');
        const finalW = parseInt(finalProp, 10);
        if (finalW) {
          try {
            localStorage.setItem(isLeft ? 'yongyong_poster_left_width' : 'yongyong_poster_right_width', finalW);
          } catch (_) {}
        }
        if (zoomMode === 'fit') {
          fitWorkspace();
        }
      }

      resizer.addEventListener('pointerup', stopDrag);
      resizer.addEventListener('pointercancel', stopDrag);

      resizer.addEventListener('dblclick', (e) => {
        e.preventDefault();
        const defaultW = isLeft ? DEFAULT_LEFT : DEFAULT_RIGHT;
        workspace.style.setProperty(isLeft ? '--poster-left-width' : '--poster-right-width', `${defaultW}px`);
        try {
          localStorage.removeItem(isLeft ? 'yongyong_poster_left_width' : 'yongyong_poster_right_width');
        } catch (_) {}
        if (zoomMode === 'fit') {
          fitWorkspace();
        }
        toast(isLeft ? `左侧栏已恢复默认宽度 (${defaultW}px)` : `右侧栏已恢复默认宽度 (${defaultW}px)`);
      });

      resizer.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          const currentStyle = getComputedStyle(workspace);
          const currentProp = isLeft ? currentStyle.getPropertyValue('--poster-left-width') : currentStyle.getPropertyValue('--poster-right-width');
          let currentW = parseInt(currentProp, 10) || (isLeft ? DEFAULT_LEFT : DEFAULT_RIGHT);
          const delta = (e.key === 'ArrowRight' ? 1 : -1) * (isLeft ? 15 : -15);
          const maxW = Math.min(650, Math.floor(window.innerWidth * 0.45));
          const minW = isLeft ? MIN_LEFT : MIN_RIGHT;
          const nextW = Math.max(minW, Math.min(maxW, currentW + delta));
          workspace.style.setProperty(isLeft ? '--poster-left-width' : '--poster-right-width', `${nextW}px`);
          try {
            localStorage.setItem(isLeft ? 'yongyong_poster_left_width' : 'yongyong_poster_right_width', nextW);
          } catch (_) {}
          if (zoomMode === 'fit') fitWorkspace();
        } else if (e.key === 'Enter' || e.key === ' ' || e.key === 'Home') {
          e.preventDefault();
          const defaultW = isLeft ? DEFAULT_LEFT : DEFAULT_RIGHT;
          workspace.style.setProperty(isLeft ? '--poster-left-width' : '--poster-right-width', `${defaultW}px`);
          try {
            localStorage.removeItem(isLeft ? 'yongyong_poster_left_width' : 'yongyong_poster_right_width');
          } catch (_) {}
          if (zoomMode === 'fit') fitWorkspace();
          toast(isLeft ? `左侧栏已恢复默认宽度 (${defaultW}px)` : `右侧栏已恢复默认宽度 (${defaultW}px)`);
        }
      });
    }

    initDrag(resizerLeft, true);
    initDrag(resizerRight, false);
  }

  window.posterState = state;
  window.posterImageAssets = imageAssets;
  window.posterSetMainImage = setMainImage;
  window.posterAddSecondaryImage = addSecondaryImage;
  window.posterAddFrame = addFrame;
  window.posterAddDetail = addDetail;
  window.posterSetSelected = setSelected;
  window.posterDeleteSelected = deleteSelected;
  window.posterUndo = undo;
  window.posterRedo = redo;
  window.posterRemixLayout = remixLayout;
  window.posterRemixFilters = remixFilters;
  window.posterFitWorkspace = fitWorkspace;
  window.posterApplyTemplate = applyLayoutTemplate;
  window.posterTriggerMasterRemix = triggerMasterRemix;
  window.posterLayoutTemplates = layoutTemplates;
  window.posterSetupResizers = setupPosterResizers;
  window.posterHasUserUploadedImages = hasUserUploadedImages;
  window.posterApplyTemplate01 = applyTemplate01;
  window.posterApplyLayoutTemplate01 = applyLayoutTemplate01;
  window.posterApplyFilterTemplate01 = applyFilterTemplate01;
  Object.defineProperty(window, 'posterHistory', { get: () => history, configurable: true });
  window.posterSyncAllChildFramesOf = syncAllChildFramesOf;
  renderInspector();render();loadDemo(false);requestAnimationFrame(fitWorkspace);updateRemixCard();setupPosterResizers();
})();
