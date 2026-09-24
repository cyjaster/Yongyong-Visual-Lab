// Collage Poster v1.5 — Multi-Image Mode & focused framework-free editor.
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
  const zoomValue = $('#posterZoomValue');
  const W = canvas.width, H = canvas.height;
  const imageBox = { x: 70, y: 150, w: 760, h: 900 };
  const makeMain = () => ({ id:'main-image', x:imageBox.x, y:imageBox.y, w:imageBox.w, h:imageBox.h, rotation:0, zoom:1, panX:0, panY:0, layoutMode:'FULL BASE' });
  const makeId = () => `poster-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const clone = (v) => JSON.parse(JSON.stringify(v));
  let isBeforePreviewActive = false;
  const cleanFilters = () => ({ bw: 0, brightness: 0, contrast: 0, saturation: 100, halftone: 0, halftoneSize: 8, halftoneDensity: 50, halftoneAngle: 0, grain: 0, rough: 0, outline: 0, scan: 0, scanAngle: 0, paper: 0, dirty: 0, compression: 0, invert: 0, posterize: 0 });

  const state = {
    mode: 'single',
    image: null, imageName: '', mainImageId: '', assets: [], secondaries: [],
    main: makeMain(), fragments: [], frames: [], details: [], texts: [], layers: [], selected: null,
    background: '#efeee8', backgroundStyle:'solid', backgroundImageId:null, backgroundImageOpacity:38, backgroundImageFit:'cover', border: true, borderColor: '#fff', borderWidth: 5,
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
  let drag = null, history = [], historyIndex = -1, historyTimer = 0;
  let remixBaseSnapshot = null, remixLastResultSnapshot = null;
  let lastRemixLayoutName = '', lastRemixCopyName = '', lastRemixMainName = '', lastRemixAnchorName = '', lastRemixFramePatternName = '', lastRemixBackgroundStyle = '', lastRemixTypographyMode = '';
  let zoom = 1, zoomMode = 'fit', spaceDown = false, pan = null, fitTimer = 0;
  const imageAssets = new Map();
  const backgroundAssets = new Map();

  function toast(message) {
    const node = $('#toast'); node.textContent = message; node.classList.add('is-visible');
    clearTimeout(toast.timer); toast.timer = setTimeout(() => node.classList.remove('is-visible'), 2100);
  }
  function applyZoom(next, mode = 'manual', anchor = null) {
    const previous = zoom;
    zoom = Math.max(.2, Math.min(2, Math.round(next * 100) / 100));
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
    const pad = 42;
    const availableW = Math.max(180, viewport.clientWidth - pad);
    const availableH = Math.max(240, viewport.clientHeight - pad);
    applyZoom(Math.min(availableW / W, availableH / H, 1.35), 'fit');
    requestAnimationFrame(() => requestAnimationFrame(() => { viewport.scrollLeft = 0; viewport.scrollTop = 0; }));
  }
  function zoomBy(delta, anchor = null) { applyZoom(zoom + delta, 'manual', anchor); }
  function snapshot() { const { image, ...rest } = state; return JSON.stringify(rest); }
  function commit(immediate = true) {
    const save = () => { const value = snapshot(); if (history[historyIndex] === value) return; history = history.slice(0, historyIndex + 1); history.push(value); if (history.length > 60) history.shift(); historyIndex = history.length - 1; };
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
    const multiRows = state.mode === 'multi' ? `
        <div class="poster-remix-row">
          <span class="poster-remix-key">多图叙事 / NARRATIVE</span>
          <div class="poster-remix-val">${info.narrativeZh || '主辅叙事'} <small>${info.narrativeEn || 'Hero + Support'}</small></div>
        </div>
        <div class="poster-remix-row">
          <span class="poster-remix-key">图像分工 / ROLES</span>
          <div class="poster-remix-val">${info.rolesZh || '主辅有序'} <small>${info.rolesEn || 'Structured'}</small></div>
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
  function setPosterMode(nextMode) {
    state.mode = nextMode;
    $('#posterWorkspace')?.classList.toggle('is-multi-mode', nextMode === 'multi');
    document.querySelectorAll('[data-poster-mode]').forEach((b) => {
      b.classList.toggle('is-active', b.dataset.posterMode === nextMode);
    });
    const panelDesc = $('#posterPanelDesc');
    if (panelDesc) {
      panelDesc.textContent = nextMode === 'multi'
        ? '用主图、辅图和证据图建立多图叙事。'
        : '从一张图里拆细节，生成索引海报。';
    }
    const detailBtnText = $('#posterActionDetailText');
    if (detailBtnText) {
      detailBtnText.textContent = nextMode === 'multi' ? '生成证据图' : '生成局部放大';
    }
    if (nextMode === 'multi' && (!state.secondaries || state.secondaries.length === 0)) {
      const secAsset = state.assets?.find((a) => a.id !== state.mainImageId) || (imageAssets.has('asset-demo-sec') ? { id: 'asset-demo-sec', name: 'demo-karina.jpg' } : null);
      if (secAsset && imageAssets.has(secAsset.id)) {
        addSecondaryImage(secAsset.id);
      }
    }
    renderImageTray();
    renderInspector();
    render();
    toast(`已切换至 ${nextMode === 'multi' ? '多图拼贴模式 MULTI' : '单图索引模式 SINGLE'}`);
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
    (state.frames || []).forEach((f) => {
      if ((f.sourceId || 'main') === parentId) {
        syncFrameAbsoluteFromParent(f);
      }
    });
  }

  function renderImageTray() {
    if (!imageTray) return;
    if (trayCount) trayCount.textContent = `${state.assets?.length || 0} IMAGES`;
    if (!state.assets || !state.assets.length) {
      imageTray.innerHTML = `<p style="padding: 12px 0; color: var(--muted); font-size: 8.5px; text-align: center;">暂无素材，点击上方上传图片</p>`;
      return;
    }
    imageTray.innerHTML = state.assets.map((assetMeta) => {
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
            ${src ? `<img src="${src}" alt="${assetMeta.name}">` : ''}
            <span class="poster-tray-badge ${isMain ? 'is-primary' : 'is-secondary'}">
              ${isMain ? '★ PRIMARY' : 'SECONDARY'}
            </span>
          </div>
          <div class="poster-tray-info">
            <span class="poster-tray-name" title="${assetMeta.name}">${assetMeta.name}</span>
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

  function addSecondaryImage(assetId, extra = {}) {
    const asset = imageAssets.get(assetId);
    if (!asset) return toast('未找到对应素材。');
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
    setSelected('secondary', s);
    renderImageTray();
    render();
    commit();
    markManuallyEdited();
    toast(`已添加辅图卡片 · ${asset.name}`);
  }

  function deleteAsset(assetId) {
    if (state.assets.length <= 1) return toast('素材库中至少保留一张图片。');
    if (state.mainImageId === assetId) return toast('主图素材不能直接删除，请先将其他图片设为主图。');
    state.assets = state.assets.filter((a) => a.id !== assetId);
    imageAssets.delete(assetId);
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
    const currentImage = state.image;
    Object.assign(state, JSON.parse(history[index]));
    if (state.mainImageId && imageAssets.has(state.mainImageId)) {
      state.image = imageAssets.get(state.mainImageId).image;
    } else {
      state.image = currentImage;
    }
    historyIndex = index;
    $('#posterWorkspace')?.classList.toggle('is-multi-mode', state.mode === 'multi');
    document.querySelectorAll('[data-poster-mode]').forEach((b) => {
      b.classList.toggle('is-active', b.dataset.posterMode === (state.mode || 'single'));
    });
    renderImageTray();
    renderInspector();
    render();
    updateRemixCard();
  }
  function undo() { if (historyIndex > 0) restore(historyIndex - 1); else toast('已经是最早一步。'); }
  function redo() { if (historyIndex < history.length - 1) restore(historyIndex + 1); else toast('没有可重做的操作。'); }

  function getCover() {
    if (!state.image) return null;
    const box = state.main || imageBox;
    const scale = Math.max(box.w / state.image.naturalWidth, box.h / state.image.naturalHeight) * (box.zoom || 1);
    const w = state.image.naturalWidth * scale, h = state.image.naturalHeight * scale;
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
    if (frame.sourceId && frame.sourceId !== 'main') {
      const s = state.secondaries?.find((v) => v.id === frame.sourceId);
      if (s) {
        const asset = imageAssets.get(s.imageId);
        const img = asset?.image || state.image;
        if (!img) return null;
        const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
        const a = rotatePoint(frame.x, frame.y, cx, cy, -(s.rotation || 0));
        const b = rotatePoint(frame.x + frame.w, frame.y + frame.h, cx, cy, -(s.rotation || 0));
        const left = Math.min(a.x, b.x), top = Math.min(a.y, b.y);
        const right = Math.max(a.x, b.x), bottom = Math.max(a.y, b.y);
        const relLeft = (left - s.x) / Math.max(1, s.w);
        const relTop = (top - s.y) / Math.max(1, s.h);
        const relW = (right - left) / Math.max(1, s.w);
        const relH = (bottom - top) / Math.max(1, s.h);
        const sx = Math.max(0, Math.min(img.naturalWidth - 8, relLeft * img.naturalWidth));
        const sy = Math.max(0, Math.min(img.naturalHeight - 8, relTop * img.naturalHeight));
        const sw = Math.max(8, Math.min(img.naturalWidth - sx, Math.max(0.04, relW) * img.naturalWidth));
        const sh = Math.max(8, Math.min(img.naturalHeight - sy, Math.max(0.04, relH) * img.naturalHeight));
        return { sx, sy, sw, sh };
      }
    }
    const cover = getCover(); if (!cover) return null;
    const box = state.main || imageBox, cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    const a = rotatePoint(frame.x, frame.y, cx, cy, -(box.rotation || 0)), b = rotatePoint(frame.x + frame.w, frame.y + frame.h, cx, cy, -(box.rotation || 0));
    const left = Math.max(box.x, Math.min(a.x,b.x)), top = Math.max(box.y, Math.min(a.y,b.y));
    const right = Math.min(box.x + box.w, Math.max(a.x,b.x)), bottom = Math.min(box.y + box.h, Math.max(a.y,b.y));
    const sx = Math.max(0, (left - cover.x) / cover.scale), sy = Math.max(0, (top - cover.y) / cover.scale);
    return { sx, sy, sw: Math.max(1, Math.min(state.image.naturalWidth - sx, Math.max(8, right - left) / cover.scale)), sh: Math.max(1, Math.min(state.image.naturalHeight - sy, Math.max(8, bottom - top) / cover.scale)) };
  }
  function raster(w, h, draw) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); draw(c.getContext('2d'), c); return c; }
  function noise(seed) { const n = Math.sin(seed * 12.9898 + 78.233) * 43758.5453; return n - Math.floor(n); }

  function drawPosterBackground() {
    const style = state.backgroundStyle || 'solid';
    ctx.fillStyle = state.background; ctx.fillRect(0, 0, W, H);
    if (style === 'grid') {
      ctx.save(); ctx.strokeStyle = 'rgba(31,84,189,.18)'; ctx.lineWidth = 1;
      for (let x = 0; x <= W; x += 36) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
      for (let y = 0; y <= H; y += 36) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(31,84,189,.34)';
      for (let x = 0; x <= W; x += 180) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
      for (let y = 0; y <= H; y += 180) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
      ctx.restore();
    } else if (style === 'chrome') {
      const g = ctx.createLinearGradient(0,0,W,H); g.addColorStop(0,'#d9f3ff'); g.addColorStop(.25,'#f4d7ee'); g.addColorStop(.5,'#eef4ff'); g.addColorStop(.72,'#b9c9f4'); g.addColorStop(1,'#f7e0ea');
      ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
      const glow = ctx.createRadialGradient(W*.72,H*.18,10,W*.72,H*.18,W*.58); glow.addColorStop(0,'rgba(255,255,255,.92)'); glow.addColorStop(.34,'rgba(158,191,255,.26)'); glow.addColorStop(1,'rgba(255,255,255,0)'); ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);
    } else if (style === 'scan') {
      ctx.save(); ctx.globalAlpha=.22; ctx.fillStyle='#5b554c';
      for(let i=0;i<520;i++){const x=noise(i*17)*W,y=noise(i*31)*H,s=.3+noise(i*43)*2.3;ctx.fillRect(x,y,s,s*(1+noise(i*7)*4));}
      ctx.globalAlpha=.1; ctx.fillStyle='#171717'; for(let y=8;y<H;y+=9)ctx.fillRect(0,y,W,1);ctx.restore();
    } else if (style === 'dots') {
      ctx.save(); ctx.fillStyle='rgba(30,36,48,.22)';
      for(let y=10;y<H;y+=18)for(let x=10;x<W;x+=18){ctx.beginPath();ctx.arc(x+(Math.floor(y/18)%2?5:0),y,1.4,0,Math.PI*2);ctx.fill();}ctx.restore();
    } else if (style === 'soft-y2k') {
      const g=ctx.createLinearGradient(0,0,W,H);g.addColorStop(0,'#e1ecff');g.addColorStop(.46,'#f0e6f5');g.addColorStop(1,'#d4e1f5');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
      ctx.save();ctx.globalAlpha=.28;ctx.strokeStyle='#718bd4';ctx.lineWidth=2;
      [[W*.18,H*.2,210],[W*.82,H*.68,320],[W*.5,H*.92,190]].forEach(([x,y,r])=>{for(let n=0;n<4;n++){ctx.beginPath();ctx.arc(x,y,r+n*18,0,Math.PI*2);ctx.stroke();}});ctx.restore();
    } else if (style === 'blueprint') {
      ctx.fillStyle='#b9cbed';ctx.fillRect(0,0,W,H);ctx.save();ctx.strokeStyle='rgba(255,255,255,.35)';ctx.lineWidth=1;
      for(let x=0;x<W;x+=24){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}for(let y=0;y<H;y+=24){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
      ctx.strokeStyle='rgba(27,58,130,.28)';ctx.lineWidth=2;for(let x=0;x<W;x+=120){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}for(let y=0;y<H;y+=120){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}ctx.restore();
    }
    const bgImage = state.backgroundImageId ? backgroundAssets.get(state.backgroundImageId) : null;
    if (bgImage) {
      ctx.save(); ctx.globalAlpha = (state.backgroundImageOpacity ?? 38) / 100;
      const fit = state.backgroundImageFit || 'cover', iw=bgImage.naturalWidth||bgImage.width, ih=bgImage.naturalHeight||bgImage.height;
      if (fit === 'stretch') ctx.drawImage(bgImage,0,0,W,H);
      else { const scale = fit === 'contain' ? Math.min(W/iw,H/ih) : Math.max(W/iw,H/ih), w=iw*scale,h=ih*scale; ctx.drawImage(bgImage,(W-w)/2,(H-h)/2,w,h); }
      ctx.restore();
    }
  }

  function pixelEffects(target, o) {
    const tc = target.getContext('2d');
    if (!(o.grain || o.rough || o.outline || o.compression || o.posterize)) return;
    let imageData; try { imageData = tc.getImageData(0, 0, target.width, target.height); } catch (e) { console.warn('Pixel effects skipped.', e); return; }
    const d = imageData.data, lum = new Float32Array(target.width * target.height);
    for (let i = 0, p = 0; i < d.length; i += 4, p++) lum[p] = d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114;

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

    for (let y = 0; y < target.height; y++) for (let x = 0; x < target.width; x++) {
      const p = y * target.width + x, i = p * 4;
      let r = d[i], g = d[i + 1], b = d[i + 2], l = lum[p];

      if (o.rough) {
        const threshold = 126 + (noise(p * 3) - 0.5) * (o.rough * 1.8);
        const t = l > threshold ? 242 : 16;
        r += (t - r) * roughBlend;
        g += (t - g) * roughBlend;
        b += (t - b) * roughBlend;
      }

      if (o.outline) {
        const nextX = Math.min(p + 1, lum.length - 1);
        const nextY = Math.min(p + target.width, lum.length - 1);
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
        const blockOriginIdx = (by * target.width + bx) * 4;
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
    const overlay = raster(target.width, target.height, () => {}), oc = overlay.getContext('2d');
    const spacing = Math.max(3, 16 - Math.max(1, o.halftoneDensity || 50) * .12);
    const size = Math.max(.5, o.halftoneSize || 7);
    const angle = (o.halftoneAngle || 0) * Math.PI / 180;
    const diagonal = Math.hypot(target.width, target.height);
    const strength = Math.pow(o.halftone / 100, 0.8);
    oc.save(); oc.translate(target.width / 2, target.height / 2); oc.rotate(angle); oc.fillStyle = '#111';
    for (let gy = -diagonal / 2; gy < diagonal / 2; gy += spacing) for (let gx = -diagonal / 2; gx < diagonal / 2; gx += spacing) {
      const cos = Math.cos(-angle), sin = Math.sin(-angle);
      const sx = Math.round(gx * cos - gy * sin + target.width / 2);
      const sy = Math.round(gx * sin + gy * cos + target.height / 2);
      if (sx < 0 || sy < 0 || sx >= target.width || sy >= target.height) continue;
      const p = (sy * target.width + sx) * 4;
      const l = pixels[p] * .299 + pixels[p + 1] * .587 + pixels[p + 2] * .114;
      const radius = Math.max(.2, (1 - l / 255) * size * .52 * Math.min(1.6, 0.35 + strength * 1.15));
      oc.beginPath(); oc.arc(gx, gy, radius, 0, Math.PI * 2); oc.fill();
    }
    oc.restore();
    tc.save();
    tc.globalAlpha = Math.min(1, 0.25 + strength * 0.75);
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
      if (rect) rc.drawImage(source, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, target.width, target.height);
      else { const cover = getCover(), box = state.main || imageBox; rc.drawImage(source, cover.x - box.x, cover.y - box.y, cover.w, cover.h); }
      rc.filter = 'none';
    });
    pixelEffects(result, o); halftone(result, o); surfaceTexture(result, o); return result;
  }

  function detailOptions(d) {
    const o = { bw: 0, brightness: d.brightness || 0, contrast: d.contrast || 0, saturation: d.saturation ?? 100, grain: d.grain || 0, rough: 0, outline: 0, invert: 0, posterize: 0, compression: 0, scan: 0, paper: 0, dirty: 0, halftone: 0, halftoneSize: d.halftoneSize || 8, halftoneDensity: d.halftoneDensity || 55, halftoneAngle: d.halftoneAngle || 15 };
    if (d.filterType === 'bw') o.bw = 100;
    if (d.filterType === 'highbw') { o.bw = 100; o.contrast += 85; o.rough = 35; }
    if (d.filterType === 'halftone') { o.bw = 100; o.contrast += 38; o.halftone = d.halftoneStrength || 75; }
    if (d.filterType === 'rough') { o.contrast += 28; o.grain = Math.max(35, o.grain); o.rough = 52; o.dirty = 35; o.scan = 25; }
    if (d.filterType === 'outline') { o.bw = 100; o.outline = 100; o.contrast += 20; }
    if (d.filterType === 'invert') o.invert = 100;
    if (d.filterType === 'posterize') { o.posterize = 78; o.contrast += 22; }
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
      if (f.tagStyle === 'solid') { ctx.fillStyle = f.tagBackground; ctx.fillRect(0, -th, tw, th); }
      if (f.tagStyle === 'plain') { ctx.fillStyle = 'rgba(255,255,255,.82)'; ctx.fillRect(0, -th, tw, th); }
      if (f.tagStyle === 'outline') { ctx.strokeStyle = f.tagBackground; ctx.lineWidth = 1.5; ctx.strokeRect(0, -th, tw, th); }
      ctx.fillStyle = f.tagStyle === 'solid' ? f.tagTextColor : f.color; ctx.fillText(text.toUpperCase(), px, -8);
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
    ctx.save(); ctx.globalAlpha = (d.opacity ?? 100) / 100; transformBox(ctx, d); ctx.fillStyle = d.backingColor || '#fff'; ctx.fillRect(-3, -3, d.w + 6, d.h + 6); ctx.drawImage(cut, 0, 0, d.w, d.h); ctx.strokeStyle = d.color; ctx.lineWidth = d.lineWidth; ctx.strokeRect(0, 0, d.w, d.h); ctx.restore();
  }
  function drawSecondaryImage(s) {
    const asset = imageAssets.get(s.imageId);
    const img = asset?.image;
    if (!img) return;
    const isTargetBefore = isBeforePreviewActive && state.selected?.type === 'secondary' && state.selected.id === s.id;
    const opts = isTargetBefore ? cleanFilters() : (s.filters || cleanFilters());
    const cut = filteredImage(img, { sx: 0, sy: 0, sw: img.naturalWidth, sh: img.naturalHeight }, s.w, s.h, opts);
    ctx.save(); ctx.globalAlpha = (s.opacity ?? 100) / 100; transformBox(ctx, s);
    if (s.backingColor) { ctx.fillStyle = s.backingColor; ctx.fillRect(-2, -2, s.w + 4, s.h + 4); }
    ctx.drawImage(cut, 0, 0, s.w, s.h);
    if (s.lineWidth && s.color) { ctx.strokeStyle = s.color; ctx.lineWidth = s.lineWidth; ctx.strokeRect(0, 0, s.w, s.h); }
    ctx.restore();
  }
  function fragmentSourceRect(fragment) { const s = fragment.source; return { sx:s.x * state.image.naturalWidth, sy:s.y * state.image.naturalHeight, sw:s.w * state.image.naturalWidth, sh:s.h * state.image.naturalHeight }; }
  function drawFragment(fragment) {
    if (!state.image) return;
    const isTargetBefore = isBeforePreviewActive && state.selected?.type === 'fragment' && state.selected.id === fragment.id;
    const opts = isTargetBefore ? { bw:0, brightness:0, contrast:0, saturation:100, grain:0, rough:0, outline:0, invert:0, posterize:0, compression:0, scan:0, paper:0, dirty:0, halftone:0 } : detailOptions(fragment);
    const cut = filteredImage(state.image, fragmentSourceRect(fragment), fragment.w, fragment.h, opts);
    ctx.save(); ctx.globalAlpha = (fragment.opacity ?? 100) / 100; transformBox(ctx, fragment); ctx.fillStyle = fragment.backingColor || '#fff'; ctx.fillRect(-2, -2, fragment.w + 4, fragment.h + 4); ctx.drawImage(cut, 0, 0, fragment.w, fragment.h); if (fragment.lineWidth) { ctx.strokeStyle = fragment.color || '#fff'; ctx.lineWidth = fragment.lineWidth; ctx.strokeRect(0, 0, fragment.w, fragment.h); } ctx.restore();
  }

  function measureLine(line, spacing) { return ctx.measureText(line).width + Math.max(0, line.length - 1) * spacing; }
  function spacedLine(line, spacing, x, y, align = 'left') { const width = measureLine(line, spacing); let cursor = x - (align === 'center' ? width / 2 : align === 'right' ? width : 0); if (!spacing) return ctx.fillText(line, cursor, y); for (const ch of line) { ctx.fillText(ch, cursor, y); cursor += ctx.measureText(ch).width + spacing; } }
  function drawText(t) {
    ctx.save(); ctx.translate(t.x, t.y); ctx.rotate((t.rotation || 0) * Math.PI / 180); ctx.scale(t.scaleX || 1, t.scaleY || 1); ctx.globalAlpha = (t.opacity ?? 100) / 100; ctx.fillStyle = t.color; ctx.font = `${t.weight} ${t.size}px ${t.font}`; ctx.textBaseline = 'top';
    if (t.kind === 'repeat') for (let i = 0; i < t.repeat; i++) { const width = measureLine(t.content, t.letterSpacing || 0), x = i * ((t.direction === 'horizontal' ? width + (t.repeatSpacing || 0) : 0) + (t.repeatOffsetX || 0)), y = i * ((t.direction === 'vertical' ? t.size * t.lineHeight + (t.repeatSpacing || 0) : 0) + (t.repeatOffsetY || 0)); ctx.save(); ctx.translate(x, y); ctx.rotate(i * (t.rotationStep || 0) * Math.PI / 180); spacedLine(t.content, t.letterSpacing || 0, 0, 0, t.align || 'left'); ctx.restore(); }
    else if (t.writingMode === 'vertical') [...t.content.replace(/\n/g, '')].forEach((ch, i) => spacedLine(ch, 0, 0, i * t.size * t.lineHeight, t.align || 'left'));
    else t.content.split('\n').forEach((line, i) => spacedLine(line, t.letterSpacing || 0, 0, i * t.size * t.lineHeight, t.align || 'left')); ctx.restore();
  }
  function textBounds(t) { ctx.save(); ctx.font = `${t.weight} ${t.size}px ${t.font}`; const lines = t.content.split('\n'); let w = Math.max(...lines.map((line) => measureLine(line, t.letterSpacing || 0)), 10), h = t.size * lines.length * t.lineHeight, minX = 0, minY = 0; if (t.writingMode === 'vertical' && t.kind !== 'repeat') { w = t.size; h = Math.max(1, t.content.replace(/\n/g, '').length) * t.size * t.lineHeight; } if (t.kind === 'repeat') { const lw = measureLine(t.content, t.letterSpacing || 0), count = Math.max(1, t.repeat); const dx = (t.direction === 'horizontal' ? lw + (t.repeatSpacing || 0) : 0) + (t.repeatOffsetX || 0), dy = (t.direction === 'vertical' ? t.size * t.lineHeight + (t.repeatSpacing || 0) : 0) + (t.repeatOffsetY || 0); minX = Math.min(0, dx * (count - 1)); minY = Math.min(0, dy * (count - 1)); w = lw + Math.abs(dx) * (count - 1); h = t.size * t.lineHeight + Math.abs(dy) * (count - 1); } const alignShift = t.align === 'center' ? -w / 2 : t.align === 'right' ? -w : 0; ctx.restore(); return { x: t.x + (minX + alignShift) * (t.scaleX || 1), y: t.y + minY * (t.scaleY || 1), w: w * (t.scaleX || 1), h: h * (t.scaleY || 1), rotation: t.rotation || 0 }; }
  function boundsOf(item, type) { return type === 'text' ? textBounds(item) : { x: item.x, y: item.y, w: item.w, h: item.h, rotation: item.rotation || 0 }; }
  function drawSelection() { const item = selectedObject(); if (!item || state.selected.type === 'connector') return; const b = boundsOf(item, state.selected.type); ctx.save(); transformBox(ctx, b); ctx.strokeStyle = '#151515'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]); ctx.strokeRect(-4, -4, b.w + 8, b.h + 8); if (state.selected.type !== 'text') { ctx.setLineDash([]); ctx.fillStyle = '#151515'; ctx.fillRect(b.w - 7, b.h - 7, 14, 14); } ctx.restore(); }
  function drawMainImage() {
    if (!state.image) return;
    const box = state.main || makeMain();
    const isTargetBefore = isBeforePreviewActive && (!state.selected || state.selected.type === 'main');
    const main = filteredImage(state.image, null, box.w, box.h, isTargetBefore ? cleanFilters() : state.filters);
    ctx.save(); transformBox(ctx, box);
    if (box.fragmented && !isTargetBefore) {
      const bandH = box.h / 3, shifts = [-14,18,-9];
      for (let i = 0; i < 3; i++) {
        ctx.save(); ctx.beginPath(); ctx.rect(0, i * bandH + 3, box.w, bandH - 6); ctx.clip(); ctx.drawImage(main, shifts[i], 0, box.w, box.h); ctx.restore();
      }
    } else ctx.drawImage(main, 0, 0, box.w, box.h);
    ctx.strokeStyle = 'rgba(20,20,20,.18)'; ctx.strokeRect(0, 0, box.w, box.h); ctx.restore();
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
      filterType: ['halftone','highbw','outline','rough'][count % 4],
      contrast: 12,
      brightness: 0,
      saturation: 100,
      grain: 12,
      halftoneSize: 10,
      halftoneDensity: 62,
      halftoneAngle: 15,
      halftoneStrength: 82,
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
    toast(state.mode === 'multi' ? '特写证据图已生成。' : '局部放大已生成。');
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
        if ((f.sourceId || 'main') === hit.item.id) {
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
    `<div class="poster-field"><div class="poster-field-label"><div class="poster-field-label-group"><span class="poster-label-main">${zh}</span><span class="poster-label-sub">${en}</span></div></div>${hint ? `<span class="poster-field-hint">${hint}</span>` : ''}${type === 'textarea' ? `<textarea data-${global ? 'global' : 'prop'}="${key}">${value}</textarea>` : `<input type="${type}" data-${global ? 'global' : 'prop'}="${key}" value="${value}">`}</div>`;

  const toggle = (zh, en, key, value, global = false, hint = '') =>
    `<div class="poster-field"><label class="poster-toggle"><div class="poster-toggle-title"><span class="poster-label-main">${zh}</span><span class="poster-label-sub">${en}</span></div><input type="checkbox" data-${global ? 'global' : 'prop'}="${key}" ${value ? 'checked' : ''}></label>${hint ? `<span class="poster-field-hint">${hint}</span>` : ''}</div>`;

  const select = (zh, en, key, value, options, global = false, hint = '') =>
    `<div class="poster-field"><div class="poster-field-label"><div class="poster-field-label-group"><span class="poster-label-main">${zh}</span><span class="poster-label-sub">${en}</span></div></div>${hint ? `<span class="poster-field-hint">${hint}</span>` : ''}<select data-${global ? 'global' : 'prop'}="${key}">${options.map(([v, optZh, optEn]) => `<option value="${v}" ${String(v) === String(value) ? 'selected' : ''}>${optZh} · ${optEn || v}</option>`).join('')}</select></div>`;

  const accordion = (zh, en, content, open = false) =>
    `<details class="poster-accordion" ${open ? 'open' : ''}><summary><span class="acc-zh">${zh}</span><span class="acc-en">${en}</span></summary><div class="poster-accordion-body">${content}</div></details>`;

  const objectActions = () => `${layerControls()}<div class="poster-object-actions"><button class="poster-action" data-poster-action="duplicate">复制对象</button><button class="poster-delete" data-poster-action="delete">删除对象</button></div>`;

  function renderInspector() {
    const o = selectedObject();
    if (!o) {
      if (holdBeforeButton) holdBeforeButton.style.display = 'flex';
      inspectorSelection.textContent = 'SELECTED · POSTER / MAIN IMAGE';
      inspectorTitle.innerHTML = '海报全局 <small>POSTER BASE</small>';
      inspector.innerHTML = accordion('画布', 'CANVAS', `${field('画布底色','Background Color','background',state.background,'color',true)}${select('背景样式','Background Style','backgroundStyle',state.backgroundStyle||'solid',[['solid','纯色基底','Solid'],['grid','坐标网格','Index Grid'],['chrome','金属渐变','Chrome Gradient'],['scan','复印扫描纸','Scan Paper'],['dots','点阵印刷','Dot Matrix'],['soft-y2k','柔和 Y2K','Soft Y2K'],['blueprint','工程蓝图','Blue Print']],true)}${range('背景图透明度','Image Opacity','backgroundImageOpacity',state.backgroundImageOpacity??38,0,100,1,true)}${select('背景图填充','Image Fit','backgroundImageFit',state.backgroundImageFit||'cover',[['cover','铺满','Cover'],['contain','完整适应','Contain'],['stretch','拉伸拉满','Stretch']],true)}${toggle('海报外框','Poster Border','border',state.border,true)}${field('外框颜色','Border Color','borderColor',state.borderColor,'color',true)}${range('外框线宽','Border Width','borderWidth',state.borderWidth,1,18,1,true)}`, true)
        + accordion('图像', 'IMAGE', `${range('黑白','B&W','bw',state.filters.bw,0,100,1,true,'将彩色转换为黑白基调')}${range('亮度','Brightness','brightness',state.filters.brightness,-70,80,1,true,'调节画面整体明暗曝光')}${range('对比度','Contrast','contrast',state.filters.contrast,-50,120,1,true,'拉开明暗反差与视觉冲击')}${range('饱和度','Saturation','saturation',state.filters.saturation??100,0,200,1,true,'控制色彩纯度与鲜艳度')}`, true)
        + accordion('印刷 / 扫描', 'PRINT / SCAN', `${range('半调强度','Halftone Strength','halftone',state.filters.halftone,0,100,1,true,'控制印刷网点效果的明显程度')}${range('网点大小','Dot Size','halftoneSize',state.filters.halftoneSize,1,42,1,true,'控制半调颗粒尺寸')}${range('网点密度','Dot Density','halftoneDensity',state.filters.halftoneDensity,1,100,1,true,'控制网点之间的疏密')}${range('网点角度','Dot Angle','halftoneAngle',state.filters.halftoneAngle,-90,90,1,true,'旋转半调网点排列角度')}${range('扫描线','Scanline','scan',state.filters.scan,0,100,1,true,'模拟复印或显像管扫描条纹')}${segmented('扫描方向','Scan Direction','scanAngle',state.filters.scanAngle||0,[[0,'横向','Horizontal'],[90,'纵向','Vertical']],true,'切换横向或纵向扫描条纹')}`)
        + accordion('质感', 'TEXTURE', `${range('颗粒','Grain','grain',state.filters.grain,0,100,1,true,'添加胶片噪点与印刷颗粒')}${range('粗糙度','Roughness','rough',state.filters.rough,0,100,1,true,'增加复印 / 阈值化的粗粝感')}${range('纸张纹理','Paper Texture','paper',state.filters.paper,0,100,1,true,'模拟旧报纸与复印纸纤维杂质')}${range('脏版印刷','Dirty Print','dirty',state.filters.dirty,0,100,1,true,'增加墨点、污渍和印刷缺陷')}${range('压缩损坏','Compression','compression',state.filters.compression,0,100,1,true,'模拟低质量数字图片的块状损坏')}`)
        + accordion('风格化', 'STYLIZE', `${range('轮廓','Outline','outline',state.filters.outline,0,100,1,true,'提取高对比边缘描边线条')}${range('反相','Invert','invert',state.filters.invert,0,100,1,true,'翻转明暗与底片反色')}${range('色阶压缩','Color Compression / Posterize','posterize',state.filters.posterize,0,100,1,true,'减少颜色层级，形成块面效果')}<p class="poster-help">所有质感均可从 Clean 的 0% 推到 Destroyed 的 100%。</p>`);
      return;
    }
    if (state.selected.type === 'main') {
      if (holdBeforeButton) holdBeforeButton.style.display = 'flex';
      inspectorSelection.textContent = state.mode === 'multi' ? 'SELECTED · PRIMARY IMAGE / 主图' : `SELECTED · MAIN IMAGE / ${o.layoutMode || 'CUSTOM'}`;
      inspectorTitle.innerHTML = state.mode === 'multi' ? '主图 <small>PRIMARY IMAGE · 核心视觉</small>' : '主图 <small>MAIN IMAGE</small>';
      inspector.innerHTML = accordion('变换', 'TRANSFORM', `${field('水平位置','X','x',Math.round(o.x),'number')}${field('垂直位置','Y','y',Math.round(o.y),'number')}${field('宽度','Width','w',Math.round(o.w),'number')}${field('高度','Height','h',Math.round(o.h),'number')}${range('旋转角度','Rotation','rotation',o.rotation||0,-12,12,.5)}`, true)
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
      inspectorTitle.innerHTML = `辅图卡片 <small>SECONDARY · ${srcInfo.name || String(number).padStart(2,'0')}</small>`;
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
      inspectorTitle.innerHTML = `索引框 <small>INDEX FRAME · ON ${targetInfo.name || targetInfo.displayName}</small>`;

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
      inspectorSelection.textContent = state.mode === 'multi'
        ? `SELECTED · EVIDENCE / FROM ${srcInfo.name}`
        : `SELECTED · DETAIL CROP / ${String(number).padStart(2,'0')}`;
      inspectorTitle.innerHTML = state.mode === 'multi'
        ? `证据图 <small>EVIDENCE · FROM ${srcInfo.name}</small>`
        : `局部放大 <small>DETAIL CROP / ${String(number).padStart(2,'0')}</small>`;
      inspector.innerHTML = accordion('变换', 'TRANSFORM', `${field('水平位置','X','x',Math.round(o.x),'number')}${field('垂直位置','Y','y',Math.round(o.y),'number')}${field('宽度','Width','w',Math.round(o.w),'number')}${field('高度','Height','h',Math.round(o.h),'number')}${range('旋转角度','Rotation','rotation',o.rotation||0,-180,180)}${range('透明度','Opacity','opacity',o.opacity??100,0,100)}`, true)
        + accordion('风格滤镜', 'STYLE', `${select('滤镜类型','Filter Type','filterType',o.filterType,[['original','原图','Original'],['bw','黑白','B&W'],['highbw','高对比黑白','High Contrast B&W'],['halftone','半调网点','Halftone'],['outline','轮廓描边','Outline']])}${o.filterType === 'halftone' ? range('网点大小','Dot Size','halftoneSize',o.halftoneSize||8,2,30) : ''}${range('胶片颗粒','Grain','grain',o.grain||0,0,100)}`, true)
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
      inspectorSelection.textContent = state.mode === 'multi'
        ? `SELECTED · CONNECTOR / ${srcInfo.name} → EVIDENCE`
        : 'SELECTED · CONNECTOR';
      inspectorTitle.innerHTML = state.mode === 'multi'
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

  function applyDemo(image) {
    remixBaseSnapshot = null; remixLastResultSnapshot = null; lastRemixLayoutName = ''; lastRemixCopyName = ''; lastRemixMainName = ''; lastRemixAnchorName = ''; lastRemixFramePatternName = ''; lastRemixBackgroundStyle = ''; lastRemixTypographyMode = '';
    const mainAssetId = 'asset-demo-main';
    const secAssetId = 'asset-demo-sec';
    imageAssets.set(mainAssetId, { id: mainAssetId, name: 'demo-collage.jpg', image, src: image.src });
    state.image = image; state.imageName = 'demo-collage.jpg'; state.mainImageId = mainAssetId;
    state.assets = [{ id: mainAssetId, name: 'demo-collage.jpg' }];
    state.secondaries = [];
    state.main = makeMain(); state.fragments = []; state.background = '#dce3e5'; state.backgroundStyle='solid'; state.backgroundImageId=null; state.backgroundImageOpacity=38; state.backgroundImageFit='cover'; state.border = true; state.borderColor = '#fff'; state.borderWidth = 7;
    state.filters = { bw: 0, brightness: 0, contrast: 8, saturation: 100, halftone: 0, halftoneSize: 8, halftoneDensity: 58, halftoneAngle: 15, grain: 4, rough: 0, outline: 0, scan: 0, scanAngle: 0, paper: 4, dirty: 0, compression: 0, invert: 0, posterize: 0 };
    state.frames = [makeFrame(1,{id:'demo-face',x:380,y:210,w:220,h:238,rotation:-3,labelPrefix:'FACE'}),makeFrame(2,{id:'demo-hand',x:472,y:405,w:238,h:320,rotation:4,labelPrefix:'HAND',frameStyle:'corner',strokeOpacity:82}),makeFrame(3,{id:'demo-flower',x:485,y:450,w:108,h:90,rotation:-7,labelPrefix:'FLOWER',tagStyle:'outline',strokeStyle:'dashed',strokeOpacity:72})];
    state.details = [makeDetail(state.frames[0],0,{id:'demo-detail-face',x:24,y:260,w:225,h:252,rotation:-6,filterType:'halftone',halftoneSize:11,halftoneDensity:67,halftoneAngle:18,halftoneStrength:88,connectorType:'elbow'}),makeDetail(state.frames[1],1,{id:'demo-detail-hand',x:655,y:745,w:220,h:285,rotation:5,filterType:'highbw',contrast:30,grain:24}),makeDetail(state.frames[2],2,{id:'demo-detail-flower',x:36,y:830,w:196,h:188,rotation:8,filterType:'outline',contrast:28,connectorType:'elbow',endpointStyle:'cross'})];
    state.texts = [{id:'demo-title',kind:'hero',content:'WILD SIGNAL',x:-34,y:45,size:90,weight:800,font:'Arial Black, Impact, sans-serif',color:'#161616',rotation:-2,opacity:100,lineHeight:.82,letterSpacing:-4,scaleX:1.35,scaleY:.76,align:'left',writingMode:'horizontal'},{id:'demo-subtitle',kind:'subtitle',content:'SPRING INDEX / 01',x:626,y:108,size:18,weight:700,font:'Arial, sans-serif',color:'#c52f39',rotation:2,opacity:100,lineHeight:1.2,letterSpacing:1.5,scaleX:1,scaleY:1,align:'left',writingMode:'horizontal'},{id:'demo-caption',kind:'caption',content:'FACE · HAND · FLOWER\nA STUDY OF SOFT GESTURES',x:485,y:1092,size:14,weight:700,font:'ui-monospace, Consolas, monospace',color:'#161616',rotation:0,opacity:100,lineHeight:1.45,letterSpacing:.4,scaleX:1,scaleY:1,align:'left',writingMode:'horizontal'},{id:'demo-micro',kind:'micro',content:'FILE 0021 / CAMERA 01 / DATA UPDATED',x:846,y:270,size:9,weight:700,font:'ui-monospace, Consolas, monospace',color:'#161616',rotation:0,opacity:88,lineHeight:1.12,letterSpacing:2.5,scaleX:1,scaleY:1,align:'left',writingMode:'vertical'},{id:'demo-repeat',kind:'repeat',content:'FIELD NOTE',x:805,y:160,size:13,weight:800,font:'Arial, sans-serif',color:'#c52f39',repeat:8,direction:'vertical',repeatSpacing:1,repeatOffsetX:-3,repeatOffsetY:0,rotationStep:.7,rotation:3,opacity:100,lineHeight:1.25,letterSpacing:1,scaleX:1,scaleY:1,align:'left',writingMode:'horizontal'}];
    state.layers = [{type:'text',id:'demo-title'},{type:'main',id:'main-image'},{type:'connector',id:'demo-detail-face'},{type:'frame',id:'demo-face'},{type:'detail',id:'demo-detail-face'},{type:'connector',id:'demo-detail-hand'},{type:'frame',id:'demo-hand'},{type:'text',id:'demo-repeat'},{type:'detail',id:'demo-detail-hand'},{type:'connector',id:'demo-detail-flower'},{type:'frame',id:'demo-flower'},{type:'text',id:'demo-caption'},{type:'detail',id:'demo-detail-flower'},{type:'text',id:'demo-subtitle'},{type:'text',id:'demo-micro'}];
    state.selected = null; emptyState.classList.add('is-hidden'); status.textContent = 'DEMO 01 / WILD SIGNAL';
    state.remixInfo = {
      anchorZh: '示范模板', anchorEn: 'Demo Template',
      mainLayoutZh: '完整底图', mainLayoutEn: 'Full Base',
      typographyZh: '编辑排版', typographyEn: 'Editorial Stack',
      backgroundZh: '纯色', backgroundEn: 'Solid',
      strengthZh: '标准 · 平衡', strengthEn: 'Standard · Balanced',
      isManuallyEdited: false,
    };
    const secImg = new Image();
    secImg.onload = () => {
      imageAssets.set(secAssetId, { id: secAssetId, name: 'demo-karina.jpg', image: secImg, src: secImg.src });
      if (!state.assets.some((a) => a.id === secAssetId)) {
        state.assets.push({ id: secAssetId, name: 'demo-karina.jpg' });
      }
      renderImageTray();
    };
    secImg.src = 'assets/demo-karina.jpg';
    renderImageTray(); renderInspector(); render(); if (zoomMode === 'fit') requestAnimationFrame(fitWorkspace); history = []; historyIndex = -1; commit(); updateRemixCard();
  }
  function loadDemo(show = true) {
    if (state.mode === 'multi') {
      toast('多图模式下已隐藏单图示范模板。');
      return;
    }
    const image = new Image();
    image.onload = () => { applyDemo(image); if (show) toast('示范模板已恢复。'); };
    image.onerror = () => toast('示范图片未能载入。');
    image.src = 'assets/demo-collage.jpg';
  }

  function preset(name) {
    const all = {
      red:{background:'#d8d6d0',accent:'#c32631',border:'#fff',filters:{bw:48,brightness:-5,contrast:62,halftone:0,halftoneSize:9,halftoneDensity:58,halftoneAngle:15,grain:30,rough:18,outline:0,scan:58,scanAngle:0,paper:24,dirty:28,compression:15,invert:0,posterize:0},crop:['highbw','rough','halftone']},
      blue:{background:'#dbe3e9',accent:'#1f54bd',border:'#171717',filters:{bw:72,brightness:0,contrast:36,halftone:0,halftoneSize:7,halftoneDensity:62,halftoneAngle:-15,grain:18,rough:0,outline:0,scan:18,scanAngle:90,paper:10,dirty:5,compression:8,invert:0,posterize:0},crop:['bw','highbw','outline']},
      editorial:{background:'#e4dfd3',accent:'#2355b7',border:'#fff',filters:{bw:100,brightness:2,contrast:55,halftone:72,halftoneSize:12,halftoneDensity:63,halftoneAngle:22,grain:42,rough:25,outline:0,scan:16,scanAngle:0,paper:58,dirty:32,compression:12,invert:0,posterize:0},crop:['halftone','highbw','rough']},
      y2k:{background:'#e5e2ef',accent:'#765fc2',border:'#fff',filters:{bw:8,brightness:13,contrast:-12,halftone:0,halftoneSize:5,halftoneDensity:65,halftoneAngle:0,grain:5,rough:0,outline:0,scan:0,scanAngle:0,paper:6,dirty:0,compression:4,invert:0,posterize:0},crop:['original','bw','posterize']},
      xerox:{background:'#d8d5cc',accent:'#111',border:'#111',filters:{bw:100,brightness:2,contrast:118,halftone:90,halftoneSize:17,halftoneDensity:48,halftoneAngle:-18,grain:82,rough:76,outline:0,scan:72,scanAngle:0,paper:80,dirty:88,compression:38,invert:0,posterize:62},crop:['highbw','halftone','invert']},
    };
    const p = all[name]; if (!p) return; state.background = p.background; state.borderColor = p.border; state.filters = {...p.filters}; state.frames.forEach((f) => {f.color=p.accent;f.tagBackground=p.accent;}); state.details.forEach((d,i)=>{d.color=p.accent;d.lineColor=p.accent;d.filterType=p.crop[i%p.crop.length];if(name==='xerox')d.rotation=[-8,6,11][i%3];}); state.fragments.forEach((f,i)=>{f.color=p.accent;f.filterType=p.crop[(i+1)%p.crop.length];}); state.texts.forEach((t)=>{if(t.kind==='repeat')t.color=p.accent;}); setSelected(null,null); render(); commit(); markManuallyEdited(); toast(`已应用 ${name==='xerox'?'XEROX / PUNK':name.toUpperCase()} 视觉系统。`);
  }

  function applyPosterBackground(style) {
    const colors = { solid:'#efeee8', grid:'#e5e9e8', chrome:'#dbe7f4', scan:'#e5dfd2', dots:'#e9e6df', 'soft-y2k':'#e5e2ef', blueprint:'#b9cbed' };
    state.backgroundStyle = style; state.background = colors[style] || state.background;
    setSelected(null,null); renderInspector(); render(); commit(); markManuallyEdited(); toast(`背景已切换 · ${style.toUpperCase()}`);
  }

  // REMIX keeps every object, then recomposes it inside a family of editorial
  // layouts. Copy can join the shuffle without removing the option to preserve it.
  const remixClamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const remixBetween = (min, max) => min + Math.random() * (max - min);
  const remixPick = (items) => items[Math.floor(Math.random() * items.length)];
  const remixShuffle = (items) => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
    return copy;
  };
  const remixNudge = (value, amount) => value + remixBetween(-amount, amount);

  function makeMainFragment(index, main, strength) {
    const types = ['OFFSET SLICE','ENLARGED DETAIL','DUPLICATED BLOCK','STYLIZED FRAGMENT'];
    const type = types[index % types.length], wild = strength === 'wild';
    const zones = [
      { x:.2, y:.08, w:.55, h:.2 }, { x:.28, y:.14, w:.42, h:.32 },
      { x:.38, y:.28, w:.42, h:.3 }, { x:.12, y:.5, w:.66, h:.24 },
      { x:.18, y:.68, w:.62, h:.25 },
    ];
    const source = { ...remixPick(zones) };
    source.x = remixClamp(source.x + remixBetween(-.07,.07), 0, 1 - source.w);
    source.y = remixClamp(source.y + remixBetween(-.07,.07), 0, 1 - source.h);
    const placements = [
      { x:main.x - main.w * .06, y:main.y + main.h * .22, w:main.w * .72, h:main.h * .16 },
      { x:main.x + main.w * .58, y:main.y + main.h * .08, w:main.w * .34, h:main.h * .38 },
      { x:main.x + main.w * .05, y:main.y + main.h * .67, w:main.w * .42, h:main.h * .27 },
      { x:main.x + main.w * .48, y:main.y + main.h * .52, w:main.w * .48, h:main.h * .22 },
    ];
    const p = placements[index % placements.length], drift = wild ? 65 : 28;
    const filters = wild ? ['highbw','halftone','outline','rough','posterize','invert'] : ['original','bw','halftone','outline'];
    return { id:makeId(), fragmentType:type, source, x:remixClamp(p.x + remixBetween(-drift,drift), -80, W - 90), y:remixClamp(p.y + remixBetween(-drift,drift), -80, H - 90), w:remixClamp(p.w * remixBetween(.88,1.16), 120, 430), h:remixClamp(p.h * remixBetween(.86,1.18), 85, 360), rotation:remixBetween(wild ? -12 : -6, wild ? 12 : 6), color:'#fff', lineWidth:remixPick([0,0,2,3]), backingColor:'#fff', opacity:Math.round(remixBetween(wild ? 72 : 84,100)), filterType:remixPick(filters), contrast:Math.round(remixBetween(0,wild ? 42 : 22)), brightness:0, saturation:100, grain:Math.round(remixBetween(0,wild ? 45 : 18)), halftoneSize:Math.round(remixBetween(6,wild ? 22 : 13)), halftoneDensity:Math.round(remixBetween(45,76)), halftoneAngle:Math.round(remixBetween(-35,35)), halftoneStrength:Math.round(remixBetween(58,96)) };
  }

  function makeOverlapCompanion(main, strength) {
    const wild = strength === 'wild', side = Math.random() < .5 ? -1 : 1;
    const w = main.w * remixBetween(.82,.91), h = main.h * remixBetween(.84,.94), sourceX = remixBetween(0,.045), sourceY = remixBetween(0,.04);
    return {
      id:makeId(), fragmentType:'OVERLAP PLATE', fragmentRole:'companion',
      source:{ x:sourceX, y:sourceY, w:remixBetween(.93,1-sourceX), h:remixBetween(.94,1-sourceY) },
      x:remixClamp(main.x + side * remixBetween(main.w*.08,main.w*.16), -65, W-w+65),
      y:remixClamp(main.y + remixBetween(-main.h*.035,main.h*.07), -45, H-h+55),
      w, h, rotation:(main.rotation||0) + side * remixBetween(wild?4.5:2.4,wild?8:5.2),
      color:wild?'#171717':'#fff', lineWidth:remixPick(wild?[2,3,5]:[2,3]), backingColor:'#fff',
      opacity:Math.round(remixBetween(wild?74:84,96)), filterType:remixPick(wild?['original','bw','highbw','halftone']:['original','original','bw']),
      contrast:Math.round(remixBetween(0,wild?34:16)), brightness:0, saturation:100,
      grain:Math.round(remixBetween(0,wild?24:9)), halftoneSize:Math.round(remixBetween(7,15)),
      halftoneDensity:58, halftoneAngle:15, halftoneStrength:Math.round(remixBetween(55,82)),
    };
  }

  function remixOverlap(a, b) {
    const width = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
    const height = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    return width * height / Math.max(1, Math.min(a.w * a.h, b.w * b.h));
  }

  function moveOutOfQuietZone(item, zone, gap = 18) {
    if (!zone || !item || remixOverlap(item, zone) < .12) return;
    if (zone.side === 'left') item.x = Math.max(item.x, zone.w + gap);
    if (zone.side === 'right') item.x = Math.min(item.x, zone.x - item.w - gap);
    if (zone.side === 'top') item.y = Math.max(item.y, zone.h + gap);
    if (zone.side === 'bottom') item.y = Math.min(item.y, zone.y - item.h - gap);
  }

  const narrativeTemplates = [
    {
      id: 'hero-support',
      zh: '主辅环绕',
      en: 'Hero + Support',
      descZh: '主图占据视觉核心，辅图卡片环绕平衡',
      descEn: 'Primary hero center, secondary cards flanking',
      cropLimit: 2,
      apply(p, s) {
        p.x = 130 + remixBetween(-20, 20);
        p.y = 140 + remixBetween(-20, 20);
        p.w = 580 + remixBetween(-30, 30);
        p.h = 720 + remixBetween(-30, 30);
        p.rotation = remixBetween(-1.5, 1.5);
        p.layoutMode = 'HERO CENTER';
        const secSlots = [
          { x: 35, y: 720, w: 250, h: 300, rot: -4 },
          { x: 610, y: 160, w: 250, h: 310, rot: 3 },
          { x: 600, y: 740, w: 260, h: 320, rot: -3 },
          { x: 40, y: 180, w: 240, h: 290, rot: 4 },
        ];
        s.forEach((sec, idx) => {
          const slot = secSlots[idx % secSlots.length];
          sec.x = slot.x + remixBetween(-15, 15);
          sec.y = slot.y + remixBetween(-15, 15);
          sec.w = slot.w; sec.h = slot.h;
          sec.rotation = slot.rot + remixBetween(-1.5, 1.5);
        });
      }
    },
    {
      id: 'main-evidence',
      zh: '主体证物',
      en: 'Main + Evidence',
      descZh: '大体量主图构建基底，高对比证据图深挖细节',
      descEn: 'Large primary base, strong evidence crops',
      cropLimit: 3,
      apply(p, s) {
        p.x = 60 + remixBetween(-20, 20);
        p.y = 120 + remixBetween(-20, 20);
        p.w = 720 + remixBetween(-30, 30);
        p.h = 880 + remixBetween(-30, 30);
        p.rotation = remixBetween(-1, 1);
        p.layoutMode = 'DOMINANT BASE';
        const secSlots = [
          { x: 45, y: 780, w: 240, h: 280, rot: -3 },
          { x: 615, y: 760, w: 240, h: 290, rot: 2 },
          { x: 610, y: 150, w: 230, h: 270, rot: -2 },
        ];
        s.forEach((sec, idx) => {
          const slot = secSlots[idx % secSlots.length];
          sec.x = slot.x + remixBetween(-15, 15);
          sec.y = slot.y + remixBetween(-15, 15);
          sec.w = slot.w; sec.h = slot.h;
          sec.rotation = slot.rot + remixBetween(-1.5, 1.5);
        });
      }
    },
    {
      id: 'moodboard',
      zh: '情绪画板',
      en: 'Moodboard Focus',
      descZh: '多图错落层叠如艺术画报，视觉中心明确',
      descEn: 'Editorial layering, balanced visual rhythm',
      cropLimit: 2,
      apply(p, s) {
        p.x = 180 + remixBetween(-25, 25);
        p.y = 200 + remixBetween(-25, 25);
        p.w = 520 + remixBetween(-30, 30);
        p.h = 660 + remixBetween(-30, 30);
        p.rotation = remixBetween(-1.5, 1.5);
        p.layoutMode = 'MOODBOARD ANCHOR';
        const secSlots = [
          { x: 35, y: 160, w: 280, h: 340, rot: -4 },
          { x: 575, y: 640, w: 290, h: 360, rot: 3 },
          { x: 580, y: 160, w: 270, h: 320, rot: -2 },
          { x: 40, y: 680, w: 260, h: 310, rot: 3 },
        ];
        s.forEach((sec, idx) => {
          const slot = secSlots[idx % secSlots.length];
          sec.x = slot.x + remixBetween(-15, 15);
          sec.y = slot.y + remixBetween(-15, 15);
          sec.w = slot.w; sec.h = slot.h;
          sec.rotation = slot.rot + remixBetween(-1.5, 1.5);
        });
      }
    },
    {
      id: 'pair-compare',
      zh: '双核对照',
      en: 'Pair Comparison',
      descZh: '主图与辅图左右分立对照，证据图置于底部安全区',
      descEn: 'Dual-image dialogue, comparative evidence',
      cropLimit: 2,
      apply(p, s) {
        p.x = 40 + remixBetween(-10, 10);
        p.y = 180 + remixBetween(-15, 15);
        p.w = 400 + remixBetween(-15, 15);
        p.h = 620 + remixBetween(-15, 15);
        p.rotation = remixBetween(-1, 1);
        p.layoutMode = 'LEFT COMPARISON';
        if (s.length) {
          s[0].x = 470 + remixBetween(-10, 10);
          s[0].y = 200 + remixBetween(-15, 15);
          s[0].w = 390 + remixBetween(-15, 15);
          s[0].h = 600 + remixBetween(-15, 15);
          s[0].rotation = remixBetween(-1.5, 1.5);
        }
        const otherSlots = [
          { x: 40, y: 830, w: 210, h: 250, rot: -2 },
          { x: 640, y: 830, w: 210, h: 250, rot: 2 },
        ];
        s.slice(1).forEach((sec, idx) => {
          const slot = otherSlots[idx % otherSlots.length];
          sec.x = slot.x + remixBetween(-10, 10);
          sec.y = slot.y + remixBetween(-10, 10);
          sec.w = slot.w; sec.h = slot.h;
          sec.rotation = slot.rot + remixBetween(-1.5, 1.5);
        });
      }
    },
    {
      id: 'detail-chain',
      zh: '线索链条',
      en: 'Detail Chain',
      descZh: '主辅图平衡分布，证据图左右交替串联形成清晰脉络',
      descEn: 'Cross-image evidence chain, linked narrative',
      cropLimit: 3,
      apply(p, s) {
        p.x = 220 + remixBetween(-15, 15);
        p.y = 140 + remixBetween(-15, 15);
        p.w = 480 + remixBetween(-20, 20);
        p.h = 580 + remixBetween(-20, 20);
        p.rotation = remixBetween(-1, 1);
        p.layoutMode = 'EVIDENCE HUB';
        const secSlots = [
          { x: 35, y: 440, w: 230, h: 280, rot: 3 },
          { x: 635, y: 440, w: 230, h: 280, rot: -3 },
          { x: 340, y: 770, w: 250, h: 300, rot: 2 },
          { x: 35, y: 130, w: 200, h: 240, rot: -2 },
        ];
        s.forEach((sec, idx) => {
          const slot = secSlots[idx % secSlots.length];
          sec.x = slot.x + remixBetween(-10, 10);
          sec.y = slot.y + remixBetween(-10, 10);
          sec.w = slot.w; sec.h = slot.h;
          sec.rotation = slot.rot + remixBetween(-1, 1);
        });
      }
    }
  ];

  function remixLayout(strength = 'medium') {
    if (!state.image) return toast('请先上传主图。');
    if (!state.main) state.main = makeMain();
    commit(); // capture a pending inspector edit before REMIX becomes one undo step
    const currentSnapshot = snapshot();
    if (remixBaseSnapshot && remixLastResultSnapshot && currentSnapshot === remixLastResultSnapshot) {
      const image = state.image;
      Object.assign(state, JSON.parse(remixBaseSnapshot), { image });
    } else {
      // A manual edit, preset, undo/redo jump or restored template starts a new series.
      remixBaseSnapshot = currentSnapshot;
    }
    // Auxiliary REMIX frames are regenerated each round. If the user has turned
    // one into a real crop, preserve it as a normal frame instead.
    const removableAuxIds = new Set(state.frames.filter((frame) => frame.remixAux && !state.details.some((detail) => detail.frameId === frame.id)).map((frame) => frame.id));
    state.frames.forEach((frame) => { if (frame.remixAux && !removableAuxIds.has(frame.id)) frame.remixAux = false; });
    state.frames = state.frames.filter((frame) => !removableAuxIds.has(frame.id));
    state.layers = state.layers.filter((layer) => !(layer.type === 'frame' && removableAuxIds.has(layer.id)));
    const levels = {
      light: { drift: 34, scale: .09, turn: 5, style: .12, bleed: .06 },
      medium: { drift: 82, scale: .2, turn: 12, style: .34, bleed: .13 },
      wild: { drift: 145, scale: .34, turn: 24, style: .62, bleed: .2 },
    };
    const power = levels[strength] || levels.medium;
    const compositionMode = $('#posterCompositionMode')?.value || 'balanced';
    const experimental = compositionMode === 'experimental';
    const anchorModes = [
      { id:'main', name:'MAIN IMAGE STABLE' },
      { id:'hero', name:'HERO TITLE STABLE' },
      ...(state.details.length ? [{ id:'detail', name:'DETAIL CROP STABLE' }] : []),
      { id:'quiet', name:'QUIET SPACE STABLE' },
    ];
    const anchorPool = anchorModes.filter((item) => item.name !== lastRemixAnchorName);
    const anchorMode = remixPick(anchorPool.length ? anchorPool : anchorModes); lastRemixAnchorName = anchorMode.name;
    const anchorDetail = anchorMode.id === 'detail' ? remixPick(state.details) : null;
    const quietZone = anchorMode.id === 'quiet' ? remixPick([
      { side:'left', x:0, y:0, w:W*.27, h:H }, { side:'right', x:W*.73, y:0, w:W*.27, h:H },
      { side:'top', x:0, y:0, w:W, h:H*.22 }, { side:'bottom', x:0, y:H*.78, w:W, h:H*.22 },
    ]) : null;
    const budgetsByAnchor = {
      main:{ main:'stable', hero:'medium', detail:'medium', fragment:'stable', frame:'medium', tertiary:'wild', texture:'medium' },
      hero:{ main:'medium', hero:'stable', detail:'medium', fragment:'medium', frame:'medium', tertiary:'wild', texture:'medium' },
      detail:{ main:'medium', hero:'medium', detail:'medium', fragment:'stable', frame:'medium', tertiary:'wild', texture:'medium' },
      quiet:{ main:'medium', hero:'stable', detail:'medium', fragment:'stable', frame:'medium', tertiary:'medium', texture:'stable' },
    };
    const budgets = budgetsByAnchor[anchorMode.id];
    const budgetScale = (level) => level === 'stable' ? .18 : level === 'medium' ? (experimental ? .68 : .5) : (experimental ? 1 : .72);
    const previousMain = { ...(state.main || makeMain()) };

    let selectedNarrative = null;
    if (state.mode === 'multi') {
      if (!state.secondaries || state.secondaries.length === 0) {
        const secAsset = state.assets?.find((a) => a.id !== state.mainImageId) || (imageAssets.has('asset-demo-sec') ? { id: 'asset-demo-sec', name: 'demo-karina.jpg' } : null);
        if (secAsset && imageAssets.has(secAsset.id)) {
          addSecondaryImage(secAsset.id);
        }
      }
      selectedNarrative = remixPick(narrativeTemplates);
      selectedNarrative.apply(state.main, state.secondaries || []);
      state.fragments = [];
      state.layers = state.layers.filter((layer) => layer.type !== 'fragment');

      if (state.details.length > selectedNarrative.cropLimit) {
        const excessDetails = state.details.slice(selectedNarrative.cropLimit);
        const excessDetailIds = new Set(excessDetails.map((d) => d.id));
        const excessFrameIds = new Set(excessDetails.map((d) => d.frameId));
        state.details = state.details.slice(0, selectedNarrative.cropLimit);
        state.frames = state.frames.filter((f) => !excessFrameIds.has(f.id));
        state.layers = state.layers.filter((l) => !excessDetailIds.has(l.id) && !excessFrameIds.has(l.id));
      } else if (state.details.length === 0) {
        const f1 = makeFrame(1, {
          sourceId: 'main',
          labelPrefix: 'EVID',
          x: Math.round(state.main.x + state.main.w * 0.25),
          y: Math.round(state.main.y + state.main.h * 0.2),
          w: Math.round(Math.min(180, state.main.w * 0.3)),
          h: Math.round(Math.min(200, state.main.h * 0.3)),
        });
        state.frames.push(f1);
        addLayer('frame', f1.id);
        const d1 = makeDetail(f1, 0, { x: 45, y: 720, w: 220, h: 250 });
        state.details.push(d1);
        addLayer('connector', d1.id);
        addLayer('detail', d1.id);
        if (state.secondaries && state.secondaries.length > 0) {
          const s0 = state.secondaries[0];
          const f2 = makeFrame(2, {
            sourceId: s0.id,
            labelPrefix: 'EVID',
            x: Math.round(s0.x + s0.w * 0.2),
            y: Math.round(s0.y + s0.h * 0.2),
            w: Math.round(Math.min(160, s0.w * 0.6)),
            h: Math.round(Math.min(180, s0.h * 0.6)),
            rotation: s0.rotation || 0,
          });
          state.frames.push(f2);
          addLayer('frame', f2.id);
          const d2 = makeDetail(f2, 1, { x: 620, y: 720, w: 220, h: 250 });
          state.details.push(d2);
          addLayer('connector', d2.id);
          addLayer('detail', d2.id);
        }
      }
    } else {
      const mainModes = [
        { name:'FULL BASE', x:70, y:150, w:760, h:900, zoom:1.02, fragments:0 },
        { name:'TIGHT CROP', x:88, y:112, w:724, h:970, zoom:1.34, panY:28, fragments:0 },
        { name:'OFFSET BASE', x:42, y:155, w:735, h:920, zoom:1.1, panX:-16, fragments:0 },
        { name:'FLOATING BASE + 1', x:102, y:175, w:690, h:850, zoom:1.08, fragments:1 },
        { name:'FULL BASE + 2', x:65, y:140, w:770, h:920, zoom:1.12, fragments:2 },
        { name:'FRAGMENTED BASE', x:95, y:210, w:710, h:820, zoom:1.26, panY:22, fragments:3 },
      ];
      const strengthMainModes = strength === 'light' ? mainModes.slice(0,3) : strength === 'medium' ? mainModes.slice(0,4) : mainModes;
      const allowedNames = anchorMode.id === 'main' ? ['FULL BASE','OFFSET BASE'] : anchorMode.id === 'quiet' ? ['FULL BASE','OFFSET BASE','FLOATING BASE + 1'] : anchorMode.id === 'detail' ? ['FULL BASE','TIGHT CROP','OFFSET BASE','FLOATING BASE + 1'] : mainModes.map((item)=>item.name);
      const allowedMainModes = strengthMainModes.filter((item) => allowedNames.includes(item.name));
      const freshMainModes = allowedMainModes.filter((item) => item.name !== lastRemixMainName);
      const mainMode = remixPick(freshMainModes.length ? freshMainModes : allowedMainModes); lastRemixMainName = mainMode.name;
      const offsetVariants = [{ label:'LEFT', x:28, y:150 },{ label:'RIGHT', x:122, y:145 },{ label:'LOW', x:72, y:235 }];
      const offsetVariant = mainMode.name === 'OFFSET BASE' ? remixPick(offsetVariants) : null;
      const mainConfig = offsetVariant ? { ...mainMode, x:offsetVariant.x, y:offsetVariant.y } : mainMode;
      const mainModeLabel = offsetVariant ? `${mainMode.name} / ${offsetVariant.label}` : mainMode.name;
      const defaultMain = makeMain(), mainChaos = budgetScale(budgets.main);
      const mainDrift = (strength === 'light' ? 8 : strength === 'wild' ? 25 : 16) * mainChaos;
      const modeInfluence = budgets.main === 'stable' ? .12 : budgets.main === 'medium' ? .38 : .68;
      const sizeDelta = (strength === 'wild' ? .08 : strength === 'medium' ? .045 : .02) * mainChaos;
      const rotationMax = (strength === 'light' ? 2 : strength === 'wild' ? 8 : 5.5) * mainChaos;
      const blend = (base, target) => base + (target - base) * modeInfluence;
      state.main = { id:'main-image', x:blend(defaultMain.x,mainConfig.x) + remixBetween(-mainDrift,mainDrift), y:blend(defaultMain.y,mainConfig.y) + remixBetween(-mainDrift,mainDrift), w:blend(defaultMain.w,mainConfig.w) * remixBetween(1-sizeDelta,1+sizeDelta), h:blend(defaultMain.h,mainConfig.h) * remixBetween(1-sizeDelta,1+sizeDelta), rotation:remixBetween(-rotationMax,rotationMax), zoom:remixClamp(1 + ((mainConfig.zoom || 1)-1)*modeInfluence + remixBetween(-.08,.14)*mainChaos, .88, 1.72), panX:(mainConfig.panX || 0)*modeInfluence + remixBetween(-mainDrift,mainDrift), panY:(mainConfig.panY || 0)*modeInfluence + remixBetween(-mainDrift,mainDrift), layoutMode:mainModeLabel, fragmented:mainMode.name === 'FRAGMENTED BASE' && budgets.main !== 'stable' };
      state.main.x = remixClamp(state.main.x, -state.main.w * .18, W - state.main.w * .72);
      state.main.y = remixClamp(state.main.y, -state.main.h * .12, H - state.main.h * .72);
      if (budgets.main !== 'stable' && strength !== 'light' && Math.abs(state.main.rotation) < 1.1) state.main.rotation = (Math.random()<.5?-1:1) * remixBetween(1.1,Math.max(1.2,rotationMax));
      if (quietZone) {
        if (quietZone.side === 'left') { state.main.x = W * .23; state.main.w = Math.min(state.main.w, W * .73); }
        if (quietZone.side === 'right') { state.main.x = 34; state.main.w = Math.min(state.main.w, W * .73); }
        if (quietZone.side === 'top') { state.main.y = H * .21; state.main.h = Math.min(state.main.h, H * .77); }
        if (quietZone.side === 'bottom') { state.main.y = 78; state.main.h = Math.min(state.main.h, H * .75); }
        state.main.rotation = remixClamp(state.main.rotation, -2.2, 2.2);
      }
      state.layers = state.layers.filter((layer) => layer.type !== 'fragment');
      state.fragments = [];
      const rawFragmentCount = strength === 'light' || budgets.fragment === 'stable' ? 0 : Math.max(0, Math.round(mainMode.fragments * budgetScale(budgets.fragment)));
      const fragmentCount = Math.min(experimental ? 2 : 1, rawFragmentCount);
      for (let i = 0; i < fragmentCount; i++) state.fragments.push(makeMainFragment(i, state.main, experimental && budgets.fragment === 'wild' ? 'wild' : 'medium'));
      if (fragmentCount > 1) state.fragments.forEach((fragment) => { fragment.w *= .78; fragment.h *= .78; });
      const overlapChance = anchorMode.id === 'main' ? (strength === 'light' ? .08 : .24) : strength === 'light' ? .16 : strength === 'wild' ? .72 : .48;
      if (Math.random() < overlapChance) {
        state.fragments.unshift(makeOverlapCompanion(state.main, strength));
        state.main.layoutMode += ' / OVERLAP';
      }
    }
    const layouts = [
      { name:'ORBIT', slots:[[-35,210,226,252],[670,185,205,240],[650,765,245,292],[20,835,205,205]], hero:[[-65,35],[45,1010]], copy:[[640,105],[35,610],[820,270],[475,1110]] },
      { name:'SIDE STACK', slots:[[650,245,230,270],[608,565,266,210],[-32,805,220,250],[42,185,180,215]], hero:[[-45,42],[-70,930]], copy:[[45,1090],[620,105],[28,575],[825,255]] },
      { name:'DIAGONAL', slots:[[-34,170,220,255],[205,720,205,230],[665,820,240,255],[635,280,190,220]], hero:[[-65,48],[82,1015]], copy:[[690,105],[35,520],[790,535],[430,1120]] },
      { name:'ONE BIG / TWO SMALL', slots:[[-58,250,305,355],[676,175,192,220],[665,825,218,240],[35,875,182,192]], hero:[[-40,35],[35,1000]], copy:[[620,112],[55,700],[810,310],[475,1110]], wild:true },
      { name:'EDGE NOTES', slots:[[40,120,208,235],[696,350,206,248],[28,905,235,224],[648,900,230,210]], hero:[[-70,36],[100,1015]], copy:[[650,105],[35,580],[825,250],[470,1100]] },
      { name:'TOP PRESS', slots:[[15,340,260,290],[610,300,255,250],[665,760,205,250],[-25,820,205,215]], hero:[[-80,-22],[35,38]], copy:[[42,250],[690,150],[825,560],[475,1115]] },
      { name:'BOTTOM PRESS', slots:[[-28,135,235,260],[655,160,225,250],[610,560,265,300],[25,595,200,225]], hero:[[-85,930],[35,1030]], copy:[[650,110],[40,1120],[820,310],[365,95]] },
      { name:'LEFT RAIL', slots:[[-35,155,220,230],[-45,445,245,250],[-30,765,215,270],[625,865,230,220]], hero:[[80,35],[-55,1010]], copy:[[670,110],[240,1085],[825,330],[230,590]] },
      { name:'RIGHT RAIL', slots:[[690,145,220,235],[660,430,245,260],[685,760,215,275],[-30,865,225,220]], hero:[[-70,40],[55,1015]], copy:[[45,1090],[610,105],[30,420],[815,640]] },
      { name:'SPLIT AXIS', slots:[[-45,230,240,285],[685,230,235,280],[-20,785,215,245],[675,800,230,230]], hero:[[-55,38],[65,1025]], copy:[[365,105],[350,1100],[25,620],[825,570]] },
      { name:'CORNER BURST', slots:[[-55,105,245,275],[685,120,245,255],[-50,860,245,260],[685,865,235,245]], hero:[[-35,470],[85,520]], copy:[[360,105],[350,1110],[25,590],[815,570]], wild:true },
      { name:'CENTER LOCK', slots:[[110,265,255,285],[555,265,245,275],[120,700,235,260],[560,710,250,255]], hero:[[-80,35],[45,1020]], copy:[[650,110],[30,1120],[815,440],[40,485]], wild:true },
      { name:'MAGAZINE SPINE', slots:[[55,190,205,240],[630,185,240,270],[615,720,255,285],[55,790,215,225]], hero:[[-100,470],[-55,35]], copy:[[805,110],[35,1090],[450,1120],[820,520]] },
      { name:'CROSS SCAN', slots:[[335,145,225,245],[-40,465,255,270],[680,470,250,265],[340,850,225,235]], hero:[[-70,35],[55,1010]], copy:[[45,420],[660,420],[45,760],[690,760]], wild:true },
      { name:'OFF GRID', slots:[[-70,310,280,315],[615,120,260,285],[665,710,265,310],[40,875,190,205]], hero:[[-95,15],[130,1020]], copy:[[530,108],[25,650],[820,410],[450,1120]], wild:true },
    ];
    const layoutPool = strength === 'light' || !experimental ? layouts.filter((item) => !item.wild) : layouts;
    const freshLayouts = layoutPool.filter((item) => item.name !== lastRemixLayoutName);
    const layout = remixPick(freshLayouts.length ? freshLayouts : layoutPool); lastRemixLayoutName = layout.name;

    const copySets = [
      { name:'SIGNAL LOST', hero:'SIGNAL LOST', subtitle:'SUBJECT INDEX / 07', caption:'IMAGE FOUND BETWEEN TWO TRANSMISSIONS', micro:'FILE 0707 / SIGNAL INTERRUPTED / KEEP WATCH', repeat:'NO SIGNAL' },
      { name:'SOFT EVIDENCE', hero:'SOFT EVIDENCE', subtitle:'BODY STUDY / SPRING 01', caption:'A SOFT GESTURE RECORDED AS HARD DATA', micro:'ARCHIVE 0318 / HUMAN TRACE / FIELD COPY', repeat:'STILL HERE' },
      { name:'AFTER IMAGE', hero:'AFTER IMAGE', subtitle:'MEMORY BUFFER / 02', caption:'THE IMAGE REMAINS AFTER THE MOMENT', micro:'CACHE 0021 / FRAME DELAY / TRACE ACTIVE', repeat:'LOOK AGAIN' },
      { name:'OBJECT IN FRAME', hero:'OBJECT IN FRAME', subtitle:'VISUAL INVENTORY / 05', caption:'FACE · HAND · FLOWER · UNRESOLVED OBJECT', micro:'CAMERA 01 / OBJECT LOCK / DATA UPDATED', repeat:'IN FRAME' },
      { name:'NO FIXED IDENTITY', hero:'NO FIXED IDENTITY', subtitle:'PORTRAIT ERROR / EDITION 03', caption:'IDENTITY SHIFTS WHEN THE FRAME MOVES', micro:'ID NULL / SUBJECT PRESENT / MATCH FAILED', repeat:'WHO IS SHE' },
      { name:'FIELD RECORD', hero:'FIELD RECORD', subtitle:'OUTDOOR INDEX / 04', caption:'WIND · COLOR · SKIN · TEMPORARY LIGHT', micro:'SITE 24A / WEATHER SOFT / CAMERA READY', repeat:'FIELD NOTE' },
      { name:'IMAGE UNDER REVIEW', hero:'UNDER REVIEW', subtitle:'ANALYSIS FRAME / 09', caption:'EVERY DETAIL BECOMES A SECOND IMAGE', micro:'REVIEW 0009 / CROP ACTIVE / STATUS OPEN', repeat:'REVIEW' },
      { name:'COPY SCAN', hero:'COPY / SCAN', subtitle:'SECOND GENERATION IMAGE', caption:'PRINTED ONCE · SCANNED TWICE · SAVED AGAIN', micro:'DPI 300 / COPY 02 / DUST ACCEPTED', repeat:'COPY COPY' },
      { name:'TRACE FILE', hero:'TRACE FILE', subtitle:'VISIBLE REMAINS / 12', caption:'SMALL DETAILS LEAVE THE LOUDEST TRACE', micro:'TRACE 1204 / LAYER OPEN / MARK FOUND', repeat:'TRACE' },
      { name:'SPRING ERROR', hero:'SPRING ERROR', subtitle:'COLOR INCIDENT / 01', caption:'A FLOWER INTERRUPTS THE PORTRAIT SYSTEM', micro:'YELLOW HIT / FRAME 03 / ERROR BEAUTIFUL', repeat:'BLOOM ERROR' },
      { name:'MEMORY BUFFER', hero:'MEMORY BUFFER', subtitle:'TEMPORARY ARCHIVE / 06', caption:'NOTHING IS LOST · EVERYTHING IS DELAYED', micro:'BUFFER 62% / IMAGE HELD / DO NOT CLEAR', repeat:'REMEMBER' },
      { name:'PRIVATE SIGNAL', hero:'PRIVATE SIGNAL', subtitle:'PERSONAL TRANSMISSION / 08', caption:'A QUIET MESSAGE HIDING INSIDE THE IMAGE', micro:'CHANNEL 08 / LOW VOICE / RECEIVED ONCE', repeat:'KEEP CLOSE' },
      { name:'PROOF OF LIFE', hero:'PROOF OF LIFE', subtitle:'HUMAN INDEX / 11', caption:'GESTURE IS EVIDENCE · COLOR IS MEMORY', micro:'SUBJECT LIVE / TIME UNKNOWN / FRAME TRUE', repeat:'I AM HERE' },
      { name:'BEAUTIFUL DAMAGE', hero:'BEAUTIFUL DAMAGE', subtitle:'XEROX STUDY / 13', caption:'NOISE BECOMES TEXTURE WHEN WE KEEP IT', micro:'COPY 13 / TONER LOW / SURFACE DAMAGED', repeat:'PRINT AGAIN' },
    ];
    const copyPool = copySets.filter((item) => item.name !== lastRemixCopyName);
    const copySet = remixPick(copyPool.length ? copyPool : copySets); lastRemixCopyName = copySet.name;
    const remixCopyEnabled = $('#posterRemixCopy')?.checked !== false;
    const palettes = [
      { bg:'#efeee8', accent:'#c32631', border:'#ffffff', ink:'#151515' },
      { bg:'#dbe3e9', accent:'#2355b7', border:'#171717', ink:'#111820' },
      { bg:'#e4dfd3', accent:'#244fb0', border:'#ffffff', ink:'#171717' },
      { bg:'#e7e1ec', accent:'#795fc4', border:'#ffffff', ink:'#211b2c' },
      { bg:'#d8d5cc', accent:'#171717', border:'#171717', ink:'#090909' },
    ];
    const palette = remixPick(palettes);
    if (strength !== 'light') {
      state.background = palette.bg;
      state.borderColor = palette.border;
      state.borderWidth = Math.round(remixBetween(strength === 'wild' ? 2 : 4, strength === 'wild' ? 13 : 9));
    }

    // Backgrounds join REMIX as a restrained paper layer. The current anchor
    // decides which surfaces are quiet enough to preserve its visual priority.
    const backgroundPools = {
      main: strength === 'light' ? ['solid','grid','soft-y2k'] : ['solid','grid','soft-y2k','chrome'],
      hero: strength === 'light' ? ['solid','grid','chrome'] : ['solid','grid','chrome','blueprint','soft-y2k'],
      detail: strength === 'light' ? ['solid','grid','dots'] : ['grid','scan','dots','solid','blueprint'],
      quiet: strength === 'light' ? ['solid','soft-y2k','grid'] : ['solid','soft-y2k','grid','scan'],
    };
    let backgroundPool = [...backgroundPools[anchorMode.id]];
    const printedLayouts = new Set(['EDGE NOTES','MAGAZINE SPINE','CROSS SCAN','OFF GRID','SPLIT AXIS']);
    const atmosphericLayouts = new Set(['ORBIT','CORNER BURST','ONE BIG / TWO SMALL']);
    if (strength !== 'light' && printedLayouts.has(layout.name)) backgroundPool.push('scan','dots','blueprint');
    if (strength !== 'light' && atmosphericLayouts.has(layout.name)) backgroundPool.push('chrome','soft-y2k');
    if (strength === 'wild') backgroundPool.push('scan','dots','blueprint','chrome');
    const freshBackgrounds = backgroundPool.filter((style) => style !== state.backgroundStyle && style !== lastRemixBackgroundStyle);
    const backgroundStyle = remixPick(freshBackgrounds.length ? freshBackgrounds : backgroundPool);
    lastRemixBackgroundStyle = backgroundStyle;
    state.backgroundStyle = backgroundStyle;
    const backgroundBaseColors = {
      solid: palette.bg,
      grid: palette.bg === '#d8d5cc' ? '#ddd9d0' : '#e5e9e8',
      chrome: '#dbe7f4', scan: '#e5dfd2', dots: '#e9e6df',
      'soft-y2k': '#e5e2ef', blueprint: '#b9cbed',
    };
    state.background = backgroundBaseColors[backgroundStyle] || palette.bg;
    if (state.backgroundImageId) {
      const opacityRange = strength === 'light' ? [32,48] : strength === 'wild' ? [18,68] : [26,56];
      state.backgroundImageOpacity = Math.round(remixBetween(...opacityRange));
      if (strength !== 'light') state.backgroundImageFit = remixPick(['cover','cover','contain','stretch']);
    }

    const cropProfiles = remixShuffle([
      { type:'original', contrast:[0,12], grain:[0,7], dot:[7,11], strength:[35,55] },
      { type:'bw', contrast:[10,28], grain:[3,14], dot:[7,12], strength:[45,65] },
      { type:'highbw', contrast:[42,72], grain:[16,34], dot:[8,14], strength:[55,76] },
      { type:'halftone', contrast:[24,52], grain:[8,24], dot:[5,20], strength:[68,96] },
      { type:'outline', contrast:[20,46], grain:[0,15], dot:[6,12], strength:[50,72] },
      { type:'rough', contrast:[18,44], grain:[38,72], dot:[9,18], strength:[55,82] },
      ...(experimental ? [{ type:'posterize', contrast:[24,58], grain:[10,32], dot:[8,16], strength:[58,84] }, { type:'invert', contrast:[8,32], grain:[4,20], dot:[7,13], strength:[48,70] }] : []),
    ]);
    const cropShapes = remixShuffle([{w:1.18,h:.82},{w:.82,h:1.2},{w:1.02,h:1.02},{w:1.25,h:.72}]);

    // Protected Zones definition for REMIX collision avoidance
    const primaryCoreZone = {
      x: state.main.x + state.main.w * 0.2,
      y: state.main.y + state.main.h * 0.2,
      w: state.main.w * 0.6,
      h: state.main.h * 0.6,
    };
    const secondaryCoreZones = (state.secondaries || []).map((sec) => ({
      x: sec.x + sec.w * 0.2,
      y: sec.y + sec.h * 0.2,
      w: sec.w * 0.6,
      h: sec.h * 0.6,
    }));
    const heroTitleObj = state.texts.find((t) => t.kind === 'hero');
    const heroProtectedZone = heroTitleObj ? (() => {
      const b = textBounds(heroTitleObj);
      return { x: b.x - 15, y: b.y - 15, w: b.w + 30, h: b.h + 30 };
    })() : null;
    const coreProtectedZones = [primaryCoreZone, ...secondaryCoreZones, ...(heroProtectedZone ? [heroProtectedZone] : [])];

    const safeMarginSlots = [
      { x: 30, y: 740 },
      { x: 625, y: 740 },
      { x: 30, y: 210 },
      { x: 625, y: 210 },
      { x: 340, y: 820 },
      { x: 340, y: 50 },
    ];

    state.details.forEach((detail, index) => {
      const slot = layout.slots[index % layout.slots.length];
      const isAnchor = detail === anchorDetail;
      const detailChaos = budgetScale(isAnchor ? 'stable' : budgets.detail);
      const ratio = Math.max(.45, detail.h / Math.max(1, detail.w));
      const slotScale = 1 + remixBetween(-power.scale, power.scale) * detailChaos;
      const cropShape = cropShapes[index % cropShapes.length];
      detail.w = remixClamp(slot[2] * slotScale * cropShape.w, 130, strength === 'wild' ? 320 : 270);
      detail.h = remixClamp((slot[3] || detail.w * ratio) * slotScale * cropShape.h, 115, 340);
      const bleedX = detail.w * power.bleed * detailChaos, bleedY = detail.h * power.bleed * detailChaos;
      
      let bestX = remixClamp(slot[0] + remixBetween(-power.drift, power.drift) * detailChaos, 15, W - detail.w - 15);
      let bestY = remixClamp(slot[1] + remixBetween(-power.drift, power.drift) * detailChaos, 30, H - detail.h - 30);

      // Check collision with core protected zones
      let placedSafely = false;
      for (let attempt = 0; attempt < 18; attempt++) {
        let testX, testY;
        if (attempt === 0) {
          testX = bestX;
          testY = bestY;
        } else {
          const fallback = safeMarginSlots[(index + attempt) % safeMarginSlots.length];
          testX = remixClamp(fallback.x + remixBetween(-20, 20), 15, W - detail.w - 15);
          testY = remixClamp(fallback.y + remixBetween(-20, 20), 30, H - detail.h - 30);
        }
        const candidateBox = { x: testX, y: testY, w: detail.w, h: detail.h };
        const maxOverlap = Math.max(...coreProtectedZones.map((pz) => remixOverlap(candidateBox, pz)));
        if (maxOverlap < 0.18) {
          bestX = testX;
          bestY = testY;
          placedSafely = true;
          break;
        }
      }
      if (!placedSafely) {
        const edge = safeMarginSlots[index % safeMarginSlots.length];
        bestX = remixClamp(edge.x, 15, W - detail.w - 15);
        bestY = remixClamp(edge.y, 30, H - detail.h - 30);
      }
      detail.x = bestX;
      detail.y = bestY;
      detail.rotation = remixBetween(-power.turn, power.turn) * detailChaos;
      detail.connectorType = Math.random() < .52 ? 'elbow' : 'straight';
      detail.connectorWidth = remixClamp(remixNudge(detail.connectorWidth || 2, (strength === 'wild' ? 2 : 1) * detailChaos), 1, 6);
      detail.lineOpacity = Math.round(remixBetween(62, 100));
      detail.endpointStyle = remixPick(['none','dot','cross']);
      const cropProfile = cropProfiles[index % cropProfiles.length];
      if (strength !== 'light' && !isAnchor) {
        detail.filterType = cropProfile.type;
        detail.contrast = Math.round(remixBetween(...cropProfile.contrast));
        detail.grain = Math.round(remixBetween(...cropProfile.grain));
        detail.halftoneSize = Math.round(remixBetween(...cropProfile.dot));
        detail.halftoneStrength = Math.round(remixBetween(...cropProfile.strength));
      } else if (strength !== 'light' && Math.random() < power.style * detailChaos) detail.filterType = remixPick(['original','bw','highbw','halftone','rough','outline','posterize']);
      detail.halftoneSize = Math.round(remixClamp(remixNudge(detail.halftoneSize || 9, (strength === 'wild' ? 10 : 5) * detailChaos), 2, 30));
      detail.halftoneStrength = Math.round(remixClamp(remixNudge(detail.halftoneStrength || 75, (strength === 'wild' ? 28 : 14) * detailChaos), 20, 100));
      detail.grain = Math.round(remixClamp(remixNudge(detail.grain || 0, (strength === 'wild' ? 30 : 14) * detailChaos), 0, 88));
      if (strength !== 'light') { detail.color = palette.accent; detail.lineColor = palette.accent; }
      if (isAnchor) {
        detail.w = remixClamp(detail.w * 1.22, 245, 360); detail.h = remixClamp(detail.h * 1.2, 260, 410);
        if (state.mode !== 'multi') {
          detail.x = remixClamp(quietZone?.side === 'right' ? 250 : quietZone?.side === 'left' ? 470 : 520, 18, W - detail.w - 18);
          detail.y = remixClamp(quietZone?.side === 'bottom' ? 270 : 335, 18, H - detail.h - 18);
        }
        detail.rotation = remixBetween(-1.5,1.5); detail.opacity = 100; detail.filterType = remixPick(['original','bw']);
        detail.contrast = remixClamp(detail.contrast || 0, -10, 20); detail.grain = Math.min(detail.grain, 6); detail.halftoneStrength = Math.min(detail.halftoneStrength, 42);
      }
      moveOutOfQuietZone(detail, quietZone);
    });

    if (state.secondaries && state.secondaries.length) {
      if (state.mode !== 'multi') {
        const secondarySlots = [
          { x: 45, y: 680, rot: -4 },
          { x: 590, y: 190, rot: 3 },
          { x: 570, y: 740, rot: -2 },
          { x: 55, y: 180, rot: 4 },
        ];
        state.secondaries.forEach((sec, idx) => {
          const slot = secondarySlots[idx % secondarySlots.length];
          const chaos = budgetScale('medium');
          sec.x = remixClamp(slot.x + remixBetween(-30, 30) * chaos, 10, W - sec.w - 10);
          sec.y = remixClamp(slot.y + remixBetween(-35, 35) * chaos, 10, H - sec.h - 10);
          sec.rotation = remixClamp(slot.rot + remixBetween(-4, 4) * chaos, -12, 12);
          if (strength !== 'light') {
            sec.color = palette.border;
            sec.backingColor = palette.border;
          }
          moveOutOfQuietZone(sec, quietZone);
        });
      } else {
        state.secondaries.forEach((sec) => {
          if (strength !== 'light') {
            sec.color = palette.border;
            sec.backingColor = palette.border;
          }
          moveOutOfQuietZone(sec, quietZone);
        });
      }
    }

    // Keep strong treatments scarce: one loud crop in Balanced, two in Experimental.
    const strongCropFilters = new Set(['highbw','halftone','rough','outline','posterize','invert']);
    const mainIsLoud = (state.filters.halftone || 0) > 55 || (state.filters.outline || 0) > 45 || (state.filters.posterize || 0) > 55;
    let strongCropAllowance = mainIsLoud ? 1 : (experimental ? 3 : 2);
    state.details.forEach((detail) => {
      if (detail === anchorDetail) return;
      if (!strongCropFilters.has(detail.filterType)) return;
      if (strongCropAllowance > 0) strongCropAllowance -= 1;
      else { detail.filterType = remixPick(['original','bw']); detail.grain = Math.min(detail.grain, 12); }
    });

    if (state.mode !== 'multi') {
      const targetFrameCount = strength === 'light' ? 5 : experimental && strength === 'wild' ? 7 : 6;
      const auxPrefixes = ['TRACE','AREA','SCAN','ID'];
      for (let i = state.frames.length; i < targetFrameCount; i++) {
        state.frames.push(makeFrame(i + 1, {
          remixAux:true, x:state.main.x, y:state.main.y, w:remixBetween(72,108), h:remixBetween(58,116), rotation:0,
          labelPrefix:auxPrefixes[(i - 3 + auxPrefixes.length) % auxPrefixes.length], labelNumber:i + 1,
          lineWidth:remixPick([1,2,2]), labelSize:9, frameStyle:remixPick(['corner','corner','full']),
          strokeStyle:remixPick(['solid','dashed']), strokeOpacity:Math.round(remixBetween(58,88)), tagStyle:remixPick(['plain','outline']),
        }));
      }
    }
    const perimeterZones = [
      {x:.15,y:.16,scale:.58},{x:.84,y:.18,scale:.6},{x:.13,y:.45,scale:.62},{x:.86,y:.48,scale:.58},
      {x:.18,y:.78,scale:.68},{x:.81,y:.8,scale:.64},{x:.5,y:.9,scale:.56},{x:.5,y:.1,scale:.55},
    ];
    const framePatterns = [
      { name:'PERIMETER CLOCKWISE', order:[0,3,4,1,5,2,6] },
      { name:'PERIMETER CROSS', order:[1,2,5,0,3,4,6] },
      { name:'PERIMETER LOW', order:[4,1,3,5,0,2,6] },
      { name:'PERIMETER HIGH', order:[0,1,5,2,3,4,6] },
      { name:'PERIMETER SPLIT', order:[2,5,0,3,4,1,6] },
      { name:'PERIMETER OFFSET', order:[3,0,4,1,2,5,6] },
    ].map((pattern) => ({...pattern, zones:pattern.order.map((zoneIndex) => perimeterZones[zoneIndex])}));
    const freshFramePatterns = framePatterns.filter((pattern) => pattern.name !== lastRemixFramePatternName);
    const framePattern = remixPick(freshFramePatterns.length ? freshFramePatterns : framePatterns); lastRemixFramePatternName = framePattern.name;
    const stableFrameId = anchorDetail?.frameId || null;
    const placedFrames = [];
    state.frames.forEach((frame, index) => {
      const frameIsAnchor = stableFrameId === frame.id;
      const frameChaos = budgetScale(frameIsAnchor ? 'stable' : budgets.frame);

      const targetCard = frame.sourceId && frame.sourceId !== 'main'
        ? (state.secondaries || []).find((s) => s.id === frame.sourceId)
        : null;

      if (targetCard) {
        frame.w = remixClamp(frame.w, 48, Math.min(180, targetCard.w * 0.72));
        frame.h = remixClamp(frame.h, 44, Math.min(190, targetCard.h * 0.72));
        frame.x = remixClamp(targetCard.x + targetCard.w * 0.18 + remixBetween(-10, 10), targetCard.x, targetCard.x + targetCard.w - frame.w);
        frame.y = remixClamp(targetCard.y + targetCard.h * 0.18 + remixBetween(-10, 10), targetCard.y, targetCard.y + targetCard.h - frame.h);
        frame.rotation = targetCard.rotation || 0;
        frame.lineWidth = remixClamp(Math.round(remixNudge(frame.lineWidth || 2, 1.1 * frameChaos)), 1, 4);
        frame.labelSize = remixClamp(frame.labelSize || 10, 8, 12);
        if (strength !== 'light') { frame.color = palette.accent; frame.tagBackground = palette.accent; }
        placedFrames.push({ x: frame.x, y: frame.y, w: frame.w, h: frame.h });
        return;
      }

      const oldCenterX = frame.x + frame.w / 2, oldCenterY = frame.y + frame.h / 2;
      const normalizedX = (oldCenterX - previousMain.x) / Math.max(1, previousMain.w), normalizedY = (oldCenterY - previousMain.y) / Math.max(1, previousMain.h);
      const followScale = Math.min(state.main.w / Math.max(1, previousMain.w), state.main.h / Math.max(1, previousMain.h));
      frame.w *= followScale; frame.h *= followScale;
      frame.x = state.main.x + normalizedX * state.main.w - frame.w / 2;
      frame.y = state.main.y + normalizedY * state.main.h - frame.h / 2;
      const zone = framePattern.zones[index % framePattern.zones.length];
      const frameScaleRange = strength === 'light' ? .08 : strength === 'wild' ? .28 : .18;
      const sizeFactor = (1 + remixBetween(-frameScaleRange, frameScaleRange) * frameChaos) * (frameIsAnchor ? .68 : zone.scale);
      const centerX = frame.x + frame.w / 2, centerY = frame.y + frame.h / 2;
      frame.w = remixClamp(frame.w * sizeFactor, 48, Math.min(172,state.main.w*.24)); frame.h = remixClamp(frame.h * sizeFactor, 44, Math.min(188,state.main.h*.22));
      const targetCenterX = state.main.x + state.main.w * zone.x, targetCenterY = state.main.y + state.main.h * zone.y;
      const targetInfluence = frameIsAnchor ? .3 : strength === 'light' ? .55 : experimental && strength === 'wild' ? .98 : experimental ? .94 : strength === 'wild' ? .92 : .86;
      const driftX = state.main.w * (frameIsAnchor ? .018 : experimental ? .035 : .025);
      const driftY = state.main.h * (frameIsAnchor ? .018 : experimental ? .035 : .025);
      const remixedCenterX = centerX + (targetCenterX - centerX) * targetInfluence + remixBetween(-driftX,driftX);
      const remixedCenterY = centerY + (targetCenterY - centerY) * targetInfluence + remixBetween(-driftY,driftY);
      frame.x = remixClamp(remixedCenterX - frame.w / 2, state.main.x - frame.w * .16, state.main.x + state.main.w - frame.w * .84);
      frame.y = remixClamp(remixedCenterY - frame.h / 2, state.main.y - frame.h * .16, state.main.y + state.main.h - frame.h * .84);
      frame.rotation = remixNudge(frame.rotation || 0, power.turn * .72 * frameChaos);
      frame.lineWidth = remixClamp(Math.round(remixNudge(frame.lineWidth || 2, 1.1 * frameChaos)), 1, 4);
      frame.labelSize = remixClamp(frame.labelSize || 10, 8, 12);
      if (strength !== 'light') { frame.color = palette.accent; frame.tagBackground = palette.accent; }
      if (strength === 'wild' || (strength === 'medium' && index % 2)) frame.frameStyle = Math.random() < .48 ? 'corner' : 'full';
      frame.tagStyle = remixPick(strength === 'light' ? [frame.tagStyle || 'solid','plain'] : ['solid','plain','outline']);
      frame.strokeStyle = Math.random() < power.style ? 'dashed' : 'solid';
      if (placedFrames.some((other) => remixOverlap(frame, other) > .64)) {
        frame.x = remixClamp(frame.x + (index % 2 ? state.main.w*.08 : -state.main.w*.08), state.main.x - frame.w * .16, state.main.x + state.main.w - frame.w * .84);
        frame.y = remixClamp(frame.y + (index % 2 ? -state.main.h*.06 : state.main.h*.06), state.main.y - frame.h * .16, state.main.y + state.main.h - frame.h * .84);
      }
      if (frameIsAnchor) { frame.rotation = remixClamp(frame.rotation, -1.5, 1.5); frame.lineWidth = remixClamp(frame.lineWidth, 2, 4); frame.frameStyle = 'full'; frame.tagStyle = 'solid'; frame.strokeStyle = 'solid'; }
      placedFrames.push({x:frame.x,y:frame.y,w:frame.w,h:frame.h});
    });

    const heroFonts = ['Arial Black, Impact, sans-serif','Impact, Haettenschweiler, sans-serif','Franklin Gothic Medium, Arial Narrow, sans-serif','Trebuchet MS, Arial, sans-serif','Georgia, Times New Roman, serif','Times New Roman, Georgia, serif'];
    const editorialFonts = ['Georgia, Times New Roman, serif','Times New Roman, Georgia, serif','Trebuchet MS, Arial, sans-serif','Arial, Helvetica, sans-serif'];
    const uiFonts = ['ui-monospace, Consolas, monospace','Courier New, monospace','Arial Narrow, Arial, sans-serif'];
    const accentFonts = ['Impact, Haettenschweiler, sans-serif','Georgia, Times New Roman, serif','Arial Black, Impact, sans-serif'];
    const typographyModes = [
      { name:'BOTTOM LOCK', hero:{x:-34,y:1000,size:[76,118],rotation:0,scaleX:[1.08,1.42],scaleY:[.76,.94]}, subtitle:{x:58,y:944}, caption:{x:58,y:1110}, micro:{x:650,y:1110,align:'right'}, repeat:{x:765,y:80,direction:'vertical'}, breakRole:'hero' },
      { name:'TOP EDITORIAL', hero:{x:-32,y:24,size:[76,116],rotation:0,scaleX:[1.08,1.4],scaleY:[.78,.96]}, subtitle:{x:56,y:150}, caption:{x:56,y:190}, micro:{x:650,y:188,align:'right'}, repeat:{x:790,y:610,direction:'vertical'}, breakRole:'hero' },
      { name:'SIDE SPINE', hero:{x:28,y:1085,size:[66,92],rotation:-90,scaleX:[1,1.18],scaleY:[.82,1]}, subtitle:{x:74,y:1055,rotation:-90}, caption:{x:108,y:1055,rotation:-90}, micro:{x:822,y:170,writingMode:'vertical'}, repeat:{x:150,y:72,direction:'horizontal'}, breakRole:'hero' },
      { name:'SPLIT AXIS', hero:{x:-30,y:42,size:[74,112],rotation:0,scaleX:[1.04,1.36],scaleY:[.8,.98]}, subtitle:{x:648,y:118}, caption:{x:648,y:160}, micro:{x:836,y:280,writingMode:'vertical'}, repeat:{x:42,y:1090,direction:'horizontal'}, breakRole:'repeat' },
      { name:'IMAGE OVERLAP', hero:{x:-36,y:492,size:[82,126],rotation:-2,scaleX:[1.12,1.5],scaleY:[.72,.9]}, subtitle:{x:58,y:620}, caption:{x:58,y:660}, micro:{x:828,y:250,writingMode:'vertical'}, repeat:{x:54,y:88,direction:'horizontal'}, breakRole:'hero' },
      { name:'QUIET CORNER', hero:{x:58,y:72,size:[62,88],rotation:0,scaleX:[.94,1.16],scaleY:[.86,1]}, subtitle:{x:60,y:172}, caption:{x:60,y:212}, micro:{x:60,y:266}, repeat:{x:620,y:1080,direction:'horizontal'}, breakRole:'none' },
    ];
    const typographyAllowed = {
      main:['BOTTOM LOCK','TOP EDITORIAL','SIDE SPINE','QUIET CORNER'],
      hero:['BOTTOM LOCK','TOP EDITORIAL','SPLIT AXIS','IMAGE OVERLAP'],
      detail:['BOTTOM LOCK','SPLIT AXIS','IMAGE OVERLAP','SIDE SPINE'],
      quiet:['BOTTOM LOCK','TOP EDITORIAL','SIDE SPINE','QUIET CORNER'],
    }[anchorMode.id];
    const typographyPool = typographyModes.filter((mode)=>typographyAllowed.includes(mode.name) && mode.name !== lastRemixTypographyMode);
    const typographyMode = remixPick(typographyPool.length ? typographyPool : typographyModes.filter((mode)=>typographyAllowed.includes(mode.name)));
    lastRemixTypographyMode = typographyMode.name;
    const selectedFonts = { hero:remixPick(heroFonts), editorial:remixPick(editorialFonts), ui:remixPick(uiFonts), accent:remixPick(accentFonts) };
    const typeJitter = strength === 'light' ? 3 : strength === 'wild' && experimental ? 14 : 7;
    const kindCounts = {};
    state.texts.forEach((text) => {
      if (remixCopyEnabled && copySet[text.kind]) text.content = copySet[text.kind];
      kindCounts[text.kind] = (kindCounts[text.kind] || 0) + 1;
      const stack = kindCounts[text.kind] - 1;
      if (text.kind === 'hero') {
        const slot = typographyMode.hero, heroChaos = budgetScale(budgets.hero), isBreak = typographyMode.breakRole === 'hero';
        text.x = slot.x + remixBetween(-typeJitter,typeJitter) * heroChaos; text.y = slot.y + stack * 92 + remixBetween(-typeJitter,typeJitter) * heroChaos;
        text.size = Math.round(remixBetween(...slot.size)); text.rotation = slot.rotation + (isBreak ? remixBetween(-2.2,2.2) * heroChaos : remixBetween(-.7,.7));
        text.scaleX = remixBetween(...slot.scaleX); text.scaleY = remixBetween(...slot.scaleY); text.letterSpacing = isBreak ? remixBetween(-5,8) : remixBetween(-1,4);
        text.font = strength === 'light' ? text.font : selectedFonts.hero; text.opacity = 100; text.align = 'left'; text.writingMode = 'horizontal';
        const readableWidth = typographyMode.name === 'SIDE SPINE' ? 820 : 800, estimatedSize = readableWidth / Math.max(5,text.content.length*.62*text.scaleX);
        text.size = Math.round(remixClamp(Math.min(text.size,estimatedSize),typographyMode.name==='SIDE SPINE'?54:58,126));
      } else if (text.kind === 'repeat') {
        const slot = typographyMode.repeat, isBreak = typographyMode.breakRole === 'repeat'; text.x = slot.x; text.y = slot.y + stack*24; text.direction = slot.direction; text.repeat = Math.round(remixBetween(3, experimental&&strength==='wild'?7:5)); text.repeatSpacing = Math.round(remixBetween(1,isBreak?14:7)); text.repeatOffsetX = isBreak ? Math.round(remixBetween(-3,7)) : 0; text.repeatOffsetY = isBreak ? Math.round(remixBetween(-2,5)) : 0; text.rotationStep = isBreak&&experimental ? remixBetween(-.6,.6) : 0; text.rotation = isBreak ? remixBetween(-2,2) : 0; text.size = remixClamp(text.size||12,8,15); text.opacity = Math.round(remixBetween(44,64)); text.font = selectedFonts.accent; text.align='left'; text.writingMode='horizontal';
      } else {
        const slot = typographyMode[text.kind] || typographyMode.caption, secondary = text.kind === 'subtitle' || text.kind === 'caption';
        text.x = slot.x + remixBetween(-typeJitter*.35,typeJitter*.35); text.y = slot.y + stack*(text.kind==='subtitle'?34:26) + remixBetween(-typeJitter*.25,typeJitter*.25); text.rotation = slot.rotation||0; text.align = slot.align||'left'; text.writingMode = slot.writingMode||'horizontal';
        text.size = text.kind==='subtitle'?Math.round(remixBetween(16,24)):text.kind==='caption'?Math.round(remixBetween(11,16)):Math.round(remixBetween(8,11)); text.font = strength==='light'?text.font:(secondary?selectedFonts.editorial:selectedFonts.ui); text.scaleX=1; text.scaleY=1; text.letterSpacing=text.kind==='micro'?remixBetween(1.2,2.8):remixBetween(.2,1.3); text.opacity=text.kind==='micro'?Math.round(remixBetween(52,72)):92;
      }
      if (strength !== 'light' && ['repeat','subtitle'].includes(text.kind)) text.color = palette.accent;
      if (!['repeat','subtitle'].includes(text.kind) && strength === 'wild' && Math.random() < .28) text.color = palette.ink;
    });

    const filterDrift = (strength === 'light' ? 5 : strength === 'wild' ? 24 : 12) * budgetScale(budgets.texture);
    ['contrast','grain','scan','paper','dirty','compression','halftone','posterize','outline'].forEach((key) => {
      const limit = key === 'contrast' ? 120 : 100;
      state.filters[key] = Math.round(remixClamp(remixNudge(state.filters[key] || 0, filterDrift), key === 'contrast' ? -35 : 0, limit));
    });
    state.filters.halftoneSize = Math.round(remixClamp(remixNudge(state.filters.halftoneSize || 8, (strength === 'wild' ? 8 : 3) * budgetScale(budgets.texture)), 2, 30));
    state.filters.halftoneAngle = Math.round(remixClamp(remixNudge(state.filters.halftoneAngle || 0, (strength === 'wild' ? 35 : 16) * budgetScale(budgets.texture)), -90, 90));
    if (!experimental || budgets.texture === 'stable') {
      state.filters.grain = Math.min(state.filters.grain, budgets.texture === 'stable' ? 16 : 34); state.filters.scan = Math.min(state.filters.scan, 28); state.filters.dirty = Math.min(state.filters.dirty, 24);
      state.filters.halftone = Math.min(state.filters.halftone, 44); state.filters.posterize = Math.min(state.filters.posterize, 35); state.filters.outline = Math.min(state.filters.outline, 20);
    }
    if (state.filters.halftone > 55 || state.filters.outline > 45 || state.filters.posterize > 55) {
      let retainedStrongCrop = 0;
      state.details.forEach((detail) => { if (strongCropFilters.has(detail.filterType)) { retainedStrongCrop += 1; if (retainedStrongCrop > 1) { detail.filterType = remixPick(['original','bw']); detail.grain = Math.min(detail.grain, 10); } } });
    }

    // Readability repair: reserve the anchor and keep tertiary elements from becoming the first read.
    const heroTexts = state.texts.filter((text) => text.kind === 'hero');
    heroTexts.forEach((hero) => { hero.x = remixClamp(hero.x, -55, W - 120); hero.y = remixClamp(hero.y, -18, H - 92); });
    if (anchorMode.id === 'main') {
      state.main.fragmented = false; state.fragments = []; state.main.rotation = remixClamp(state.main.rotation, -1.1, 1.1); state.main.zoom = Math.min(state.main.zoom, 1.2);
      const safe = { x:state.main.x + state.main.w*.25, y:state.main.y + state.main.h*.08, w:state.main.w*.5, h:state.main.h*.55 };
      state.details.forEach((detail,index) => { if (remixOverlap(detail,safe) > .38) detail.x = index % 2 ? W - detail.w - 18 : 18; });
    }
    if (anchorMode.id === 'hero') heroTexts.forEach((hero) => { hero.rotation = remixClamp(hero.rotation,-2.2,2.2); hero.opacity = 100; hero.scaleY = remixClamp(hero.scaleY,.84,1.12); });
    if (quietZone) {
      state.details.forEach((detail) => moveOutOfQuietZone(detail, quietZone));
      state.fragments.forEach((fragment) => moveOutOfQuietZone(fragment, quietZone));
      state.texts.forEach((text) => {
        const proxy = { x:text.x, y:text.y, w:Math.max(90,(text.content?.length || 10)*(text.size || 12)*.42), h:Math.max(26,(text.size || 12)*1.8) };
        moveOutOfQuietZone(proxy, quietZone); text.x = proxy.x; text.y = proxy.y;
      });
    }

    // Rebuild layers by role.
    const main = { type:'main', id:'main-image' };
    const companionFragmentLayers = state.fragments.filter((f)=>f.fragmentRole==='companion').map((f)=>({type:'fragment',id:f.id}));
    const fragmentLayers = remixShuffle(state.fragments.filter((f)=>f.fragmentRole!=='companion').map((f) => ({ type:'fragment', id:f.id })));
    const connectorLayers = remixShuffle(state.details.map((d) => ({ type:'connector', id:d.id })));
    const frameLayers = remixShuffle(state.frames.map((f) => ({ type:'frame', id:f.id })));
    const detailLayers = remixShuffle(state.details.map((d) => ({ type:'detail', id:d.id })));
    const tertiaryIds = new Set(state.texts.filter((t) => ['repeat','micro'].includes(t.kind)).map((t) => t.id));
    const heroIds = new Set(state.texts.filter((t) => t.kind === 'hero').map((t) => t.id));
    const tertiaryLayers = remixShuffle(state.texts.filter((t) => tertiaryIds.has(t.id)).map((t) => ({type:'text',id:t.id})));
    const secondaryTextLayers = remixShuffle(state.texts.filter((t) => !tertiaryIds.has(t.id) && !heroIds.has(t.id)).map((t) => ({type:'text',id:t.id})));
    const heroLayers = state.texts.filter((t) => heroIds.has(t.id)).map((t) => ({type:'text',id:t.id}));
    const anchorDetailLayers = anchorDetail ? detailLayers.filter((layer) => layer.id === anchorDetail.id) : [];
    const secondaryDetailLayers = detailLayers.filter((layer) => !anchorDetailLayers.some((anchor) => anchor.id === layer.id));
    const secondaryCardLayers = (state.secondaries || []).map((s) => ({ type:'secondary', id: s.id }));

    // Strict Hero Layering: Foreground Hero (above photos, in margin banners) or Background Hero (watermark behind photos). Never sandwich!
    const heroMode = (anchorMode.id === 'hero' || Math.random() < 0.7) ? 'foreground' : 'background';
    if (heroMode === 'background') {
      state.texts.filter((t) => t.kind === 'hero').forEach((h) => {
        h.opacity = Math.round(remixBetween(42, 68));
      });
      state.layers = [
        ...tertiaryLayers,
        ...heroLayers,
        main,
        ...secondaryCardLayers,
        ...companionFragmentLayers,
        ...fragmentLayers,
        ...connectorLayers,
        ...frameLayers,
        ...secondaryDetailLayers,
        ...anchorDetailLayers,
        ...secondaryTextLayers,
      ];
    } else {
      state.texts.filter((t) => t.kind === 'hero').forEach((h) => {
        h.opacity = 100;
        if (h.y > 160 && h.y < 920) {
          h.y = Math.random() < 0.5 ? 42 : 1010;
        }
      });
      state.layers = [
        ...tertiaryLayers,
        main,
        ...secondaryCardLayers,
        ...companionFragmentLayers,
        ...fragmentLayers,
        ...connectorLayers,
        ...frameLayers,
        ...secondaryDetailLayers,
        ...anchorDetailLayers,
        ...secondaryTextLayers,
        ...heroLayers,
      ];
    }

    // Final Guaranteed Protected Zones Collision Avoidance Pass for Details/Evidence Crops
    if (state.details.length) {
      const finalPCore = {
        x: state.main.x + state.main.w * 0.2,
        y: state.main.y + state.main.h * 0.2,
        w: state.main.w * 0.6,
        h: state.main.h * 0.6,
      };
      const finalSCores = (state.secondaries || []).map((sec) => ({
        x: sec.x + sec.w * 0.2,
        y: sec.y + sec.h * 0.2,
        w: sec.w * 0.6,
        h: sec.h * 0.6,
      }));
      const allCores = [finalPCore, ...finalSCores];

      const getCoreOverlapRatio = (box) => {
        let maxO = 0;
        for (const core of allCores) {
          const ox = Math.max(0, Math.min(box.x + box.w, core.x + core.w) - Math.max(box.x, core.x));
          const oy = Math.max(0, Math.min(box.y + box.h, core.y + core.h) - Math.max(box.y, core.y));
          if (ox > 0 && oy > 0) {
            const ratio = (ox * oy) / Math.min(box.w * box.h, core.w * core.h);
            if (ratio > maxO) maxO = ratio;
          }
        }
        return maxO;
      };

      const candidatePerimeterPoints = [
        { x: 25, y: 780 },
        { x: W - 25, y: 780, right: true },
        { x: 25, y: 200 },
        { x: W - 25, y: 200, right: true },
        { x: 25, y: 480 },
        { x: W - 25, y: 480, right: true },
        { x: 25, y: 880 },
        { x: W - 25, y: 880, right: true },
        { x: 340, y: 920 },
        { x: 340, y: 45 },
        { x: 50, y: 50 },
        { x: W - 50, y: 50, right: true }
      ];

      state.details.forEach((detail, idx) => {
        const dBox = { x: detail.x, y: detail.y, w: detail.w, h: detail.h };
        if (getCoreOverlapRatio(dBox) > 0.15) {
          for (let p = 0; p < candidatePerimeterPoints.length; p++) {
            const pt = candidatePerimeterPoints[(idx + p) % candidatePerimeterPoints.length];
            const testX = pt.right ? (W - detail.w - 20) : pt.x;
            const testY = pt.y;
            const testBox = { x: testX, y: testY, w: detail.w, h: detail.h };
            if (getCoreOverlapRatio(testBox) <= 0.15) {
              detail.x = testX;
              detail.y = testY;
              break;
            }
          }
        }
      });
    }

    const anchorZhMap = {
      'MAIN IMAGE STABLE': '主图锁定',
      'HERO TITLE STABLE': '主标题锁定',
      'DETAIL CROP STABLE': '局部特写锁定',
      'QUIET SPACE STABLE': '留白空间锁定',
    };
    const anchorEnMap = {
      'MAIN IMAGE STABLE': 'Main Stable',
      'HERO TITLE STABLE': 'Hero Stable',
      'DETAIL CROP STABLE': 'Detail Stable',
      'QUIET SPACE STABLE': 'Quiet Space',
    };
    const typographyZhMap = {
      'BOTTOM LOCK': '底部沉底',
      'TOP EDITORIAL': '顶部报刊',
      'SIDE SPINE': '侧边书脊',
      'SPLIT AXIS': '双轴对齐',
      'IMAGE OVERLAP': '图文穿插',
      'QUIET CORNER': '角隅留白',
    };
    const bgZhMap = {
      solid: '纯色基底',
      grid: '坐标网格',
      chrome: '金属渐变',
      scan: '复印扫描纸',
      dots: '点阵印刷',
      'soft-y2k': '柔和 Y2K',
      blueprint: '工程蓝图',
    };
    const bgEnMap = {
      solid: 'Solid',
      grid: 'Index Grid',
      chrome: 'Chrome',
      scan: 'Scan Paper',
      dots: 'Dot Matrix',
      'soft-y2k': 'Soft Y2K',
      blueprint: 'Blueprint',
    };
    const strengthZhMap = {
      light: '克制微调',
      medium: '标准平衡',
      wild: '大胆实验',
    };
    const strengthEnMap = {
      light: 'Light Drift',
      medium: 'Balanced',
      wild: 'Wild Expressive',
    };

    let mainZh = state.main.layoutMode || '完整底图';
    if (mainZh.includes('FULL BASE')) mainZh = '完整底图';
    else if (mainZh.includes('TIGHT CROP')) mainZh = '特写裁切';
    else if (mainZh.includes('OFFSET BASE')) mainZh = '偏心底图';
    else if (mainZh.includes('FRAGMENTED BASE')) mainZh = '解构底图';
    if (state.main.layoutMode.includes('LEFT')) mainZh += ' · 偏左';
    if (state.main.layoutMode.includes('RIGHT')) mainZh += ' · 偏右';
    if (state.main.layoutMode.includes('LOW')) mainZh += ' · 偏下';
    if (state.main.layoutMode.includes('OVERLAP')) mainZh += ' · 重叠层';

    state.remixInfo = {
      anchorZh: anchorZhMap[anchorMode.name] || anchorMode.name,
      anchorEn: anchorEnMap[anchorMode.name] || anchorMode.name,
      mainLayoutZh: mainZh,
      mainLayoutEn: state.main.layoutMode,
      typographyZh: typographyZhMap[typographyMode.name] || typographyMode.name,
      typographyEn: typographyMode.name,
      backgroundZh: bgZhMap[state.backgroundStyle] || '纸张',
      backgroundEn: bgEnMap[state.backgroundStyle] || 'Paper',
      strengthZh: strengthZhMap[strength] || strength,
      strengthEn: strengthEnMap[strength] || strength,
      isManuallyEdited: false,
    };
    if (state.mode === 'multi' && selectedNarrative) {
      const secCount = state.secondaries?.length || 0;
      const evidCount = state.details.length;
      state.remixInfo.narrativeZh = selectedNarrative.zh;
      state.remixInfo.narrativeEn = selectedNarrative.en;
      state.remixInfo.rolesZh = `1主图 · ${secCount}辅图 · ${evidCount}证据图`;
      state.remixInfo.rolesEn = `1 Primary · ${secCount} Secondary · ${evidCount} Evidence`;
    }
    updateRemixCard();

    state.selected = null;
    syncAllChildFramesOf('main');
    (state.secondaries || []).forEach((s) => syncAllChildFramesOf(s.id));
    renderInspector(); render(); commit(); remixLastResultSnapshot = snapshot();
    const button = $('#posterRemixButton'); button?.classList.remove('is-remixing'); canvasWrap.classList.remove('is-remixing'); void canvasWrap.offsetWidth; button?.classList.add('is-remixing'); canvasWrap.classList.add('is-remixing');
    setTimeout(() => { button?.classList.remove('is-remixing'); canvasWrap.classList.remove('is-remixing'); }, 460);
    if (state.mode === 'multi' && selectedNarrative) {
      toast(`NEW · 多图叙事: ${selectedNarrative.zh} (${selectedNarrative.en}) · ${anchorMode.name} · ${strength.toUpperCase()}`);
    } else {
      const backgroundLabel = ({solid:'SOLID',grid:'INDEX GRID',chrome:'CHROME',scan:'SCAN PAPER',dots:'DOT MATRIX','soft-y2k':'SOFT Y2K',blueprint:'BLUE PRINT'})[state.backgroundStyle] || 'PAPER';
      const pairLabel = state.fragments.some((fragment)=>fragment.fragmentRole==='companion') ? ' · OVERLAP PAIR' : '';
      toast(`NEW · ${anchorMode.name} · ${layout.name} / ${typographyMode.name}${pairLabel} · ${backgroundLabel} · ${strength.toUpperCase()}`);
    }
  }

  function exportPoster() { if (!state.image) return toast('请先上传主图。'); try { render(false); const out = document.createElement('canvas'); out.width=W;out.height=H;out.getContext('2d').drawImage(canvas,0,0,W,H);const link=document.createElement('a');link.download=`collage-poster-${Date.now()}.png`;link.href=out.toDataURL('image/png');link.click();render();toast(`PNG 海报已导出 · ${W} × ${H}`); } catch(e){render();console.error(e);toast('导出失败，请通过 localhost 打开或重新上传图片。');} }

  $('.poster-tools').addEventListener('click',(e)=>{const a=e.target.closest('[data-poster-action]')?.dataset.posterAction;if(!a)return;if(a==='demo')loadDemo();if(a==='frame')addFrame();if(a==='detail')addDetail();if(a==='connector')toast('每张局部图已自动拥有连接线。');if(a==='undo')undo();if(a==='redo')redo();if(a==='duplicate')duplicateSelected();if(a==='remix')remixLayout($('#posterRemixStrength')?.value||'medium');if(['hero','subtitle','caption','micro','repeat'].includes(a))addText(a);});
  document.querySelectorAll('[data-poster-preset]').forEach((b)=>b.addEventListener('click',()=>preset(b.dataset.posterPreset)));
  document.querySelectorAll('[data-poster-background]').forEach((b)=>b.addEventListener('click',()=>applyPosterBackground(b.dataset.posterBackground)));
  $('#posterBackgroundClear')?.addEventListener('click',()=>{state.backgroundImageId=null;renderInspector();render();commit();markManuallyEdited();toast('自定义背景图已移除。');});
  $('#posterExportButton').addEventListener('click',exportPoster);
  inspector.addEventListener('input',(e)=>{
    const c=e.target,p=c.dataset.prop||c.dataset.global;
    if(!p)return;
    let root=c.dataset.global?(p in state.filters?state.filters:state):selectedObject();
    if(!root)return;
    if(state.selected?.type==='secondary'&&!c.dataset.global){
      if(p === 'secAppearance'){
        const v = c.value;
        root.appearance = v;
        if(!root.filters) root.filters = cleanFilters();
        if(v === 'original'){ root.filters.bw = 0; root.filters.contrast = 0; }
        else if(v === 'bw'){ root.filters.bw = 100; root.filters.contrast = 15; }
        else if(v === 'highbw'){ root.filters.bw = 100; root.filters.contrast = 55; }
        scheduleRender();
        commit(false);
        markManuallyEdited();
        return;
      }
      if(p === 'secGrain'){
        if(!root.filters) root.filters = cleanFilters();
        root.filters.grain = Number(c.value);
        scheduleRender();
        const out = c.closest('.poster-field')?.querySelector('output');
        if(out) out.textContent = c.value;
        commit(false);
        markManuallyEdited();
        return;
      }
      if(p === 'secFramePreset'){
        const v = c.value;
        if(v === 'none'){ root.lineWidth = 0; }
        else if(v === 'thin'){ root.lineWidth = 1; root.color = '#ffffff'; root.backingColor = '#ffffff'; }
        else if(v === 'white-border'){ root.lineWidth = 4; root.color = '#ffffff'; root.backingColor = '#ffffff'; }
        else if(v === 'editorial'){ root.lineWidth = 8; root.color = '#ffffff'; root.backingColor = '#ffffff'; }
        renderInspector();
        scheduleRender();
        commit(false);
        markManuallyEdited();
        return;
      }
      if(['bw','brightness','contrast','saturation','halftone','halftoneSize','halftoneDensity','halftoneAngle','scan','scanAngle','grain','rough','paper','dirty','compression','outline','invert','posterize'].includes(p)){
        if(!root.filters)root.filters=cleanFilters();
        root=root.filters;
      }
    }
    root[p]=c.type==='checkbox'?c.checked:(c.type==='range'||c.type==='number'?Number(c.value):c.value);
    if(['x','y','w','h','rotation'].includes(p)){
      if(state.selected?.type==='secondary'||state.selected?.type==='main'){
        syncAllChildFramesOf(root.id);
      } else if(state.selected?.type==='frame'){
        syncFrameRelativeToParent(root);
      }
    }
    if(p === 'filterType' && state.selected?.type === 'detail'){
      renderInspector();
    }
    scheduleRender();
    const out=c.closest('.poster-field')?.querySelector('output');
    if(out)out.textContent=c.value;
    commit(false);
    markManuallyEdited();
  });
  inspector.addEventListener('change',(e)=>{if(e.target.matches('select'))e.target.dispatchEvent(new Event('input',{bubbles:true}));});
  inspector.addEventListener('click',(e)=>{
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
    const a=e.target.closest('[data-poster-action]')?.dataset.posterAction,l=e.target.closest('[data-layer-action]')?.dataset.layerAction;
    if(a==='delete')deleteSelected();
    if(a==='detail')addDetail();
    if(a==='duplicate')duplicateSelected();
    if(a==='frame-for-secondary')addFrame(selectedObject());
    if(a==='add-evidence-for-card') {
      const sec = selectedObject();
      if (sec) addEvidenceCropForAsset(sec.imageId);
    }
    if(l)changeLayer(l);
  });
  document.querySelectorAll('[data-poster-mode]').forEach((b) => {
    b.addEventListener('click', () => setPosterMode(b.dataset.posterMode));
  });
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
  multiInput?.addEventListener('change', () => {
    const files = Array.from(multiInput.files || []);
    if (!files.length) return;
    toast(`正在读取 ${files.length} 张图片素材...`);
    let loadedCount = 0;
    const newlyLoaded = [];
    const stepDone = () => {
      loadedCount++;
      if (loadedCount === files.length) {
        if (!newlyLoaded.length) {
          toast('未能载入图片，请检查图片格式。');
          multiInput.value = '';
          return;
        }
        const isDemoOrEmpty = !state.image || state.mainImageId === 'asset-demo-main' || (state.imageName && state.imageName.startsWith('demo-'));
        let startIndex = 0;
        if (isDemoOrEmpty && newlyLoaded.length > 0) {
          // Clear demo artifacts
          state.secondaries = [];
          state.frames = [];
          state.details = [];
          state.fragments = [];
          state.layers = [];
          const first = newlyLoaded[0];
          state.image = first.image;
          state.imageName = first.name;
          state.mainImageId = first.id;
          ensureMainLayer();
          emptyState.classList.add('is-hidden');
          status.textContent = `MAIN IMAGE / ${first.name}`;
          startIndex = 1;
        }
        for (let i = startIndex; i < newlyLoaded.length; i++) {
          addSecondaryImage(newlyLoaded[i].id);
        }
        // Auto-extract initial evidence for clarity if none exist
        if (state.frames.length === 0 && newlyLoaded.length > 0) {
          const f1 = makeFrame(1, {
            sourceId: 'main',
            parentObjectId: 'main',
            labelPrefix: 'EVID',
            x: Math.round(state.main.x + state.main.w * 0.25),
            y: Math.round(state.main.y + state.main.h * 0.2),
            w: Math.round(Math.min(180, state.main.w * 0.3)),
            h: Math.round(Math.min(200, state.main.h * 0.3)),
          });
          syncFrameRelativeToParent(f1);
          state.frames.push(f1);
          addLayer('frame', f1.id);
          const d1 = makeDetail(f1, 0, { x: 35, y: 720, w: 220, h: 250 });
          state.details.push(d1);
          addLayer('connector', d1.id);
          addLayer('detail', d1.id);
          if (state.secondaries && state.secondaries.length > 0) {
            const s0 = state.secondaries[0];
            const f2 = makeFrame(2, {
              sourceId: s0.id,
              parentObjectId: s0.id,
              labelPrefix: 'EVID',
              x: Math.round(s0.x + s0.w * 0.18),
              y: Math.round(s0.y + s0.h * 0.18),
              w: Math.round(Math.min(160, s0.w * 0.6)),
              h: Math.round(Math.min(180, s0.h * 0.6)),
              rotation: s0.rotation || 0,
            });
            syncFrameRelativeToParent(f2);
            state.frames.push(f2);
            addLayer('frame', f2.id);
            const d2 = makeDetail(f2, 1, { x: 620, y: 720, w: 220, h: 250 });
            state.details.push(d2);
            addLayer('connector', d2.id);
            addLayer('detail', d2.id);
          }
        }
        if (state.mode !== 'multi') {
          state.mode = 'multi';
          $('#posterWorkspace')?.classList.add('is-multi-mode');
          document.querySelectorAll('[data-poster-mode]').forEach((b) => {
            b.classList.toggle('is-active', b.dataset.posterMode === 'multi');
          });
        }
        renderImageTray();
        renderInspector();
        render();
        commit();
        markManuallyEdited();
        toast(`已导入 ${newlyLoaded.length} 张图片并加入多图拼贴。`);
        multiInput.value = '';
      }
    };

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const image = new Image();
        image.onload = () => {
          const id = makeId();
          imageAssets.set(id, { id, name: file.name, image, src: reader.result });
          if (!state.assets) state.assets = [];
          state.assets.push({ id, name: file.name });
          newlyLoaded.push({ id, name: file.name, image });
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
  });
  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const id = makeId();
        imageAssets.set(id, { id, name: file.name, image, src: reader.result });
        if (!state.assets) state.assets = [];
        state.assets.unshift({ id, name: file.name });
        state.image = image;
        state.imageName = file.name;
        state.mainImageId = id;
        ensureMainLayer();
        emptyState.classList.add('is-hidden');
        status.textContent = `MAIN IMAGE / ${file.name}`;
        renderImageTray();
        render();
        commit();
        markManuallyEdited();
        toast('主图已载入；现有拼贴元素已保留。');
      };
      image.onerror = () => toast('图片未能载入。');
      image.src = reader.result;
    };
    reader.onerror = () => toast('读取文件失败。');
    reader.readAsDataURL(file);
  });
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
  viewport.addEventListener('pointermove',(e)=>{if(!pan)return;viewport.scrollLeft=pan.left-(e.clientX-pan.x);viewport.scrollTop=pan.top-(e.clientY-pan.y);});
  viewport.addEventListener('pointerup',()=>{pan=null;viewport.classList.remove('is-panning');});
  viewport.addEventListener('pointercancel',()=>{pan=null;viewport.classList.remove('is-panning');});
  document.addEventListener('keydown',(e)=>{if($('#posterWorkspace').hidden)return;if(e.code==='Space'&&!/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)){spaceDown=true;e.preventDefault();return;}if(/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName))return;const mod=e.ctrlKey||e.metaKey,k=e.key.toLowerCase();if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();deleteSelected();}if(mod&&k==='z'&&!e.shiftKey){e.preventDefault();undo();}if(mod&&k==='z'&&e.shiftKey){e.preventDefault();redo();}if(mod&&k==='d'){e.preventDefault();duplicateSelected();}if(!mod&&k==='f')addFrame();if(!mod&&k==='d')addDetail();});
  document.addEventListener('keyup',(e)=>{if(e.code==='Space'){spaceDown=false;pan=null;viewport.classList.remove('is-panning');}});
  window.addEventListener('resize',()=>{clearTimeout(fitTimer);fitTimer=setTimeout(()=>{if(zoomMode==='fit')fitWorkspace();},120);});
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
  window.posterFitWorkspace = fitWorkspace;
  Object.defineProperty(window, 'posterHistory', { get: () => history, configurable: true });
  window.posterSyncAllChildFramesOf = syncAllChildFramesOf;
  renderInspector();render();loadDemo(false);requestAnimationFrame(fitWorkspace);updateRemixCard();
})();
