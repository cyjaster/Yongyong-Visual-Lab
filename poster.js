// Collage Poster — one framework-free editor, with optional additional photos.
(() => {
  const $ = (s) => document.querySelector(s);
  const canvas = $('#posterCanvas');
  let ctx = canvas.getContext('2d');
  let renderScale = 1;
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
  const cleanFilters = () => ({ bw: 0, brightness: 0, contrast: 0, saturation: 100, filterType: 'original', halftone: 0, halftoneSize: 8, halftoneDensity: 50, halftoneAngle: 0, halftoneContrast: 65, halftoneOriginX: 50, halftoneOriginY: 50, motionDistance: 0, motionAngle: 0, grain: 0, noiseDistribution: 'gaussian', noiseMonochrome: true, noiseSize: 1, rough: 0, outline: 0, scan: 0, scanAngle: 0, paper: 0, dirty: 0, compression: 0, invert: 0, posterize: 0, duotone: false, duotoneDark: '#0d226b', duotoneLight: '#eed4eb', gradientGamma: 1, bitmapMethod: 'diffusion' });

  const state = {
    image: null, imageName: '', mainImageId: '', assets: [], secondaries: [],
    exportResolution: [1200, 1600],
    mainEdgeFade: 0, posterPaper: null,
    main: makeMain(), fragments: [], frames: [], details: [], texts: [], layers: [], selected: null,
    background: '#efeee8', backgroundStyle:'solid', backgroundTextureOpacity: 80, backgroundImageId:null, backgroundImageOpacity:48, backgroundImageFit:'cover', border: true, borderColor: '#fff', borderWidth: 5,
    filters: { ...cleanFilters(), halftoneSize: 9, halftoneDensity: 58, halftoneAngle: 15 },
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
  function pruneAssetCaches() {
    const images = new Set(), backgrounds = new Set();
    for (const scene of [state, ...history.map(value => JSON.parse(value))]) {
      if (scene.mainImageId) images.add(scene.mainImageId);
      for (const asset of scene.assets || []) images.add(asset.id);
      for (const card of scene.secondaries || []) images.add(card.imageId);
      if (scene.backgroundImageId) backgrounds.add(scene.backgroundImageId);
    }
    for (const [id, asset] of imageAssets) {
      if (!images.has(id) && !isDemoAsset(asset)) imageAssets.delete(id);
    }
    for (const id of backgroundAssets.keys()) {
      if (!backgrounds.has(id)) backgroundAssets.delete(id);
    }
  }
  function snapshot() {
    const { image, exportResolution, ...rest } = state;
    return JSON.stringify({ ...rest, remixCursor: { layout: currentLayoutIndex, filter: currentFilterIndex, master: currentMasterIndex } });
  }
  function commit(immediate = true) {
    if (historyTransactionDepth) return;
    const save = () => { historyTimer = 0; const value = snapshot(); if (history[historyIndex] === value) return; history = history.slice(0, historyIndex + 1); history.push(value); if (history.length > 60) history.shift(); historyIndex = history.length - 1; pruneAssetCaches(); if (typeof scheduleDraftSave === 'function') scheduleDraftSave(); };
    if (!immediate && typeof scheduleDraftSave === 'function') scheduleDraftSave();
    clearTimeout(historyTimer); if (immediate) save(); else historyTimer = setTimeout(save, 180);
  }
  function markManuallyEdited() {
    if (state.remixInfo && !state.remixInfo.isManuallyEdited) {
      state.remixInfo.isManuallyEdited = true;
      updateRemixCard();
    }
  }
  let draftReady = false, draftHasEdits = false, draftDirty = false, draftTimer = 0;
  let draftWrites = Promise.resolve();
  function draftStatus(message) { const node=$('#posterDraftStatus'); if(node)node.textContent='草稿 · '+message; }
  function scheduleDraftSave() {
    if (!draftReady || historyTransactionDepth || !state.image || !(draftHasEdits || hasUserUploadedImages() || history.length>1)) return;
    draftHasEdits = true; draftDirty = true; draftStatus('保存中…');
    clearTimeout(draftTimer); draftTimer=setTimeout(saveDraftNow,600);
  }
  async function saveDraftNow() {
    clearTimeout(draftTimer); draftTimer=0;
    if (!state.image) return;
    draftHasEdits=true; draftDirty=true; draftStatus('保存中…');
    try {
    const value=snapshot(), resolution=JSON.stringify(state.exportResolution);
    const cutouts=new Set(state.secondaries.filter(s=>s.cutout).map(s=>s.imageId));
    if(state.main.cutout)cutouts.add(state.mainImageId);
    const assets=state.assets.map(meta=>{
      const asset=imageAssets.get(meta.id);
      if(!asset?.image)throw new Error('草稿照片缺失。');
      return {id:meta.id,name:asset.name,origin:asset.origin,libraryId:asset.libraryId,
        src:asset.src || asset.image.src,cutoutSrc:cutouts.has(meta.id)?asset.cutoutImage?.src:null};
    });
    const background=state.backgroundImageId ? {id:state.backgroundImageId,src:backgroundAssets.get(state.backgroundImageId)?.src} : null;
    const record={version:1,scene:JSON.parse(value),assets,background,exportResolution:state.exportResolution.slice(),savedAt:Date.now()};
      const write=draftWrites.catch(()=>{}).then(()=>window.PosterDraft.save(record));
      draftWrites=write; await write;
      const current=JSON.parse(snapshot()); current.selected=record.scene.selected;
      if(JSON.stringify(current)===value && JSON.stringify(state.exportResolution)===resolution){draftDirty=false;draftStatus('已保存在此浏览器');}
    } catch(error) { console.warn('Draft save failed',error);draftStatus('保存失败，请点保存重试');toast('草稿未保存：'+error.message+'。请保留当前页面并重试。'); }
  }
  async function loadDraftImage(src) {
    if(typeof src!=='string' || (!src.startsWith('data:image/') && new URL(src,location.href).origin!==location.origin)) throw new Error('草稿照片来源无效。');
    const image=new Image();image.src=src;await image.decode();return image;
  }
  async function initializePoster() {
    const initial=snapshot(); let restored=false;
    try {
      const record=await window.PosterDraft.load();
      if(snapshot()!==initial)return;
      if(!record){loadDemo(false);draftStatus('编辑后自动保存');return;}
      if(record.version!==1 || !record.scene?.main || !record.scene?.filters
        || !['assets','secondaries','fragments','frames','details','texts','layers'].every(key=>Array.isArray(record.scene[key]))
        || !Array.isArray(record.assets) || !record.assets.some(a=>a.id===record.scene.mainImageId))throw new Error('草稿数据不完整。');
      const assets=await Promise.all(record.assets.map(async asset=>({...asset,image:await loadDraftImage(asset.src),cutoutImage:asset.cutoutSrc?await loadDraftImage(asset.cutoutSrc):null})));
      const background=record.background ? await loadDraftImage(record.background.src) : null;
      if(snapshot()!==initial)return;
      assets.forEach(asset=>imageAssets.set(asset.id,asset));
      if(background)backgroundAssets.set(record.background.id,background);
      const resolution=Array.isArray(record.exportResolution)?record.exportResolution.join('x'):'';
      const resolutionSelect=$('#posterResolutionSelect');
      if(Array.from(resolutionSelect.options).some(option=>option.value===resolution))state.exportResolution=record.exportResolution.slice();
      history=[JSON.stringify(record.scene)];historyIndex=0;restore(0);
      resolutionSelect.value=state.exportResolution.join('x');resolutionSelect.dispatchEvent(new Event('change'));
      restored=true;draftHasEdits=true;draftDirty=false;draftStatus('已恢复本地作品');toast('已恢复本地草稿，可继续编辑。');
    } catch(error) {console.warn('Draft restore failed',error);draftStatus('恢复失败，旧草稿保留');toast('草稿未能恢复：'+error.message+'。旧草稿仍保留。');if(snapshot()===initial)loadDemo(false);}
    finally {draftReady=true;if(!restored)scheduleDraftSave();}
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
    const layoutNumber = '[' + (currentLayoutIndex + 1) + '/' + layoutRemixList.length + ']';
    const anchorZh = (info.anchorZh || '').replace(/(排版 REMIX) \[\d+\/\d+\]/, '$1 ' + layoutNumber);
    const anchorEn = (info.anchorEn || '').replace(/(Layout REMIX) \[\d+\/\d+\]/, '$1 ' + layoutNumber);
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
          <div class="poster-remix-val">${anchorZh} <small>${anchorEn}</small></div>
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
    const minSize = frame.minSize ?? 20;
    frame.w = Math.max(minSize, frame.relW * parent.w);
    frame.h = Math.max(minSize, frame.relH * parent.h);
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
    // The upload pool remains accessible even when the current template uses only
    // some photos. Cards are scene instances and must not decide library visibility.
    const activeAssets = state.assets.filter(a => imageAssets.get(a.id)?.image || (a.id === state.mainImageId && state.image));
    if (trayCount) trayCount.textContent = `${activeAssets.length || (state.image ? 1 : 0)} IMAGES`;
    updateRemixCard();
    if (!activeAssets.length) {
      imageTray.innerHTML = `<p class="poster-help">先上传主图，也可以一次添加多张图片。</p>`;
      return;
    }
    imageTray.innerHTML = activeAssets.map((assetMeta) => {
      const asset = imageAssets.get(assetMeta.id);
      const src = asset?.src || (asset?.image ? asset.image.src : '');
      const isMain = state.mainImageId === assetMeta.id || (!state.mainImageId && state.imageName === assetMeta.name);
      const isAssigned = isMain || state.secondaries.some(s => s.imageId === assetMeta.id);
      
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
        <div class="poster-tray-item ${isMain ? 'is-main' : ''}" data-asset-id="${assetMeta.id}" title="${isAssigned ? '点击在画布中选中' : '尚未分配到画布，可设为主图'}">
          <div class="poster-tray-thumb">
            ${src ? `<img src="${escapeHTML(src)}" alt="${escapeHTML(assetMeta.name)}">` : ''}
            <span class="poster-tray-badge ${isMain ? 'is-primary' : 'is-secondary'}">
              ${isMain ? '★ PRIMARY' : (isAssigned ? 'SECONDARY' : 'ASSET')}
            </span>
          </div>
          <div class="poster-tray-info">
            <span class="poster-tray-name" title="${escapeHTML(assetMeta.name)}">${escapeHTML(assetMeta.name)}</span>
            <span class="poster-tray-stats">
              ${isMain ? `主图 · 特写 ${evidenceCount}` : (isAssigned ? `辅图 · 特写 ${evidenceCount}` : '素材 · 未分配')}
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
    commit();

    const selectedCard = state.secondaries.find(s=>s.id===state.selected?.id && s.imageId===assetId);
    const card = selectedCard || state.secondaries.find(s=>s.imageId===assetId);
    const promotedCutout = !!card?.cutout && !!asset.cutoutImage;
    const oldMainCutout = !!state.main.cutout;
    if (card && oldMainId && imageAssets.has(oldMainId)) {
      card.imageId = oldMainId;
      card.cutout = oldMainCutout && !!imageAssets.get(oldMainId).cutoutImage;
      for (const frame of state.frames) {
        if (!frame.sourceId || frame.sourceId === 'main') {
          frame.sourceId = card.id; frame.parentObjectId = card.id;
          syncFrameRelativeToParent(frame);
        } else if (frame.sourceId === card.id) {
          frame.sourceId = 'main'; frame.parentObjectId = 'main';
          syncFrameRelativeToParent(frame);
        }
      }
    }
    state.main.cutout = promotedCutout;

    state.image = asset.image;
    state.imageName = asset.name;
    state.mainImageId = asset.id;
    ensureMainLayer();
    emptyState.classList.add('is-hidden');
    status.textContent = `MAIN IMAGE / ${asset.name}`;

    syncAllChildFramesOf('main');
    (state.secondaries || []).forEach((s) => syncAllChildFramesOf(s.id));

    setSelected('main', state.main);
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
    const currentExportResolution = state.exportResolution;
    const { remixCursor, ...savedState } = JSON.parse(history[index]);
    Object.assign(state, savedState);
    state.posterPaper = savedState.posterPaper || null;
    // Older scene snapshots have no cursor; their first next REMIX starts at 01.
    currentLayoutIndex = remixCursor?.layout ?? 0;
    currentFilterIndex = remixCursor?.filter ?? 0;
    currentMasterIndex = remixCursor?.master ?? -1;
    state.exportResolution = currentExportResolution;
    if (state.mainImageId && imageAssets.has(state.mainImageId)) {
      state.image = imageAssets.get(state.mainImageId).image;
    } else {
      state.image = state.mainImageId ? currentImage : null;
    }
    historyIndex = index;
    if (typeof scheduleDraftSave === 'function') scheduleDraftSave();
    renderImageTray();
    renderInspector();
    render();
    updateRemixCard();
    updateMasterRemixControls();
  }
  function undo() { if (historyTimer) commit(); if (historyIndex > 0) restore(historyIndex - 1); else toast('已经是最早一步。'); }
  function redo() { if (historyTimer) commit(); if (historyIndex < history.length - 1) restore(historyIndex + 1); else toast('没有可重做的操作。'); }

  function getCover() {
    if (!state.image) return null;
    return imageCover(state.image, state.main || imageBox);
  }
  function imageCover(image, box) {
    const baseScale = box.fit === 'contain'
      ? Math.min(box.w / image.naturalWidth, box.h / image.naturalHeight)
      : Math.max(box.w / image.naturalWidth, box.h / image.naturalHeight);
    const scale = baseScale * (box.zoom || 1);
    const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
    return { x: box.x + (box.w - w) / 2 + (box.panX || 0), y: box.y + (box.h - h) / 2 + (box.panY || 0), w, h, scale };
  }
  function getSourceImageForFrame(f) {
    if (!f || !f.sourceId || f.sourceId === 'main') return (state.main?.cutout && imageAssets.get(state.mainImageId)?.cutoutImage) || state.image;
    const s = state.secondaries?.find((v) => v.id === f.sourceId);
    if (s) {
      const asset = imageAssets.get(s.imageId);
      if (asset?.image) return (s.cutout && asset.cutoutImage) || asset.image;
    }
    const directAsset = imageAssets.get(f.sourceId);
    if (directAsset?.image) return directAsset.image;
    return state.image;
  }
  function sourceRect(frame) {
    const image = getSourceImageForFrame(frame); if (!image) return null;
    const secondary=state.secondaries?.find((v)=>v.id===frame.sourceId);
    const box = secondary || state.main || imageBox;
    const photoBox={...box};
    if(secondary){
      const p=(typeof window!=='undefined' && window.PosterDecor?.photoRect(box)) || {x:0,y:box.windowFrame?Math.min(22,box.h*.14):0,w:box.w,h:box.windowFrame?box.h-Math.min(22,box.h*.14):box.h};
      photoBox.x+=p.x;photoBox.y+=p.y;photoBox.w=p.w;photoBox.h=p.h;
      if(box.fit!=='contain'){
        const scale=Math.max(photoBox.w/image.naturalWidth,photoBox.h/image.naturalHeight)*(box.zoom || 1);
        const dx=(image.naturalWidth*scale-photoBox.w)/2,dy=(image.naturalHeight*scale-photoBox.h)/2;
        photoBox.panX=Math.max(-dx,Math.min(dx,box.panX || 0));photoBox.panY=Math.max(-dy,Math.min(dy,box.panY || 0));
      }
    }
    const cover = imageCover(image, photoBox), cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    // Map all four rotated frame corners back into the unrotated source image.
    const corners = [[0,0],[frame.w,0],[frame.w,frame.h],[0,frame.h]].map(([x,y]) => {
      const p = rotatePoint(frame.x+x, frame.y+y, frame.x+frame.w/2, frame.y+frame.h/2, frame.rotation || 0);
      return rotatePoint(p.x, p.y, cx, cy, -(box.rotation || 0));
    });
    const left = Math.max(photoBox.x, Math.min(...corners.map(p => p.x))), top = Math.max(photoBox.y, Math.min(...corners.map(p => p.y)));
    const right = Math.min(photoBox.x+photoBox.w, Math.max(...corners.map(p => p.x))), bottom = Math.min(photoBox.y+photoBox.h, Math.max(...corners.map(p => p.y)));
    const sx = Math.max(0, Math.min(image.naturalWidth-1, (left-cover.x)/cover.scale));
    const sy = Math.max(0, Math.min(image.naturalHeight-1, (top-cover.y)/cover.scale));
    return { sx, sy, sw: Math.max(1, Math.min(image.naturalWidth-sx, (right-cover.x)/cover.scale-sx)), sh: Math.max(1, Math.min(image.naturalHeight-sy, (bottom-cover.y)/cover.scale-sy)) };
  }
  function raster(w, h, draw) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); draw(c.getContext('2d',{willReadFrequently:true}), c); return c; }
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

  function drawBlueValentineBackdrop() {
    const ghost = (image, x, y, w, h, opacity) => {
      if (!image) return;
      image = window.PosterPixels?.normalize(image) || image;
      const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
      ctx.save(); ctx.globalAlpha = opacity; ctx.filter = 'grayscale(75%)';
      ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
      ctx.drawImage(image, x + (w - image.naturalWidth * scale) / 2,
        y + (h - image.naturalHeight * scale) / 2, image.naturalWidth * scale, image.naturalHeight * scale);
      ctx.restore();
    };
    ctx.fillStyle = '#a8afd2'; ctx.fillRect(0, 0, W, H);
    ghost(state.image, 8, -95, 430, 430, .28);
    const support = state.assets.find(asset => asset.id !== state.mainImageId);
    ghost(imageAssets.get(support?.id)?.image || state.image, 687, 285, 210, 895, .38);
    ctx.fillStyle = 'rgba(174,180,229,.37)'; ctx.fillRect(0, 0, W, H);
    // Fixed torn paper and printed fruit are background graphics, never substitute uploaded photos.
    ctx.save(); ctx.translate(-24, 310); ctx.rotate(-.13);
    ctx.fillStyle = '#e8e7ee'; ctx.beginPath(); ctx.moveTo(0, 22);
    for (let y = 22; y < 660; y += 13) ctx.lineTo(240 + noise(y) * 12, y);
    ctx.lineTo(0, 660); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#3f4d91'; ctx.beginPath(); ctx.ellipse(100, 220, 122, 179, -.06, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#d6d2e9'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(100, 220, 122, 179, -.06, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    ctx.save(); ctx.translate(768, 71); ctx.rotate(.09);
    ctx.fillStyle = '#d4bfe8'; ctx.beginPath(); ctx.ellipse(0, 0, 109, 135, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#bfa9d8'; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = '#263561'; [-19,19].forEach(x => {ctx.beginPath();ctx.ellipse(x, -3, 7, 20, x / 100, 0, Math.PI * 2);ctx.fill();}); ctx.restore();
    ctx.fillStyle = 'rgba(243,240,255,.32)';
    for (let i = 0; i < 3300; i++) {const x = noise(i * 17 + 9) * W, y = noise(i * 31 + 2) * H;ctx.fillRect(x,y,.5 + noise(i)*1.7,.6);}
  }
  function drawPosterPaper() {
    const p = state.posterPaper; if (!p) return;
    ctx.save(); ctx.fillStyle = p.color || '#fafaff'; ctx.shadowColor = 'rgba(23,31,63,.25)';
    ctx.shadowBlur = 16 * renderScale; ctx.shadowOffsetY = 7 * renderScale;
    ctx.fillRect(p.x, p.y, p.w, p.h); ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.fillStyle = p.headerColor || '#3152ed'; ctx.fillRect(p.x+14,p.y+14,p.w-28,p.headerH ?? 178);
    ctx.restore();
  }
  function drawPosterBackground() {
    const style = state.backgroundStyle || 'solid';
    ctx.fillStyle = state.background; ctx.fillRect(0, 0, W, H);

    const textureAlpha = Math.max(0, Math.min(100, state.backgroundTextureOpacity ?? 80)) / 100;
    if (style !== 'solid' && textureAlpha > 0.005) {
      ctx.save();
      ctx.globalAlpha = textureAlpha;
      if (style === 'blue-valentine') {
        drawBlueValentineBackdrop();
      } else if (style === 'ps-dark' || style === 'dark-studio') {
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
          const chromeCanvas = window.posterLiquidChrome.getCachedCanvas(Math.round(W * renderScale), Math.round(H * renderScale), state.liquidChromeSeed || 0);
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
      } else if (style === 'pink-paper') {
        ctx.fillStyle='#f6f1f4';ctx.fillRect(0,0,W,H);
        for(let i=0;i<6;i++){
          const x=noise(i*19+2)*W,y=noise(i*37+5)*H,r=180+noise(i*11)*220,g=ctx.createRadialGradient(x,y,0,x,y,r);
          g.addColorStop(0,i%2?'rgba(223,210,232,.3)':'rgba(255,255,255,.9)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
        }
        for(let i=0;i<4500;i++){ctx.fillStyle=['rgba(187,135,166,.17)','rgba(124,166,174,.13)','rgba(255,255,255,.7)'][i%3];ctx.fillRect(noise(i*17+4)*W,noise(i*29+9)*H,.4+noise(i*3),.6);}
        ctx.strokeStyle='rgba(255,255,255,.55)';ctx.lineWidth=.65;
        for(let i=0;i<28;i++){const x=noise(i*41+2)*W,y=noise(i*53+3)*H;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+40+noise(i*7)*120,y-15-noise(i*13)*45);ctx.stroke();}
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

    const originalBackground = state.backgroundImageId ? backgroundAssets.get(state.backgroundImageId) : null;
    const bgImage = originalBackground ? (window.PosterPixels?.normalize(originalBackground) || originalBackground) : null;
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
      const gSize = Math.max(12, Math.min(72, o.glassSize || 32)) * renderScale;
      const copy = new Uint8ClampedArray(d);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const bx = Math.floor(x / gSize) * gSize;
          const by = Math.floor(y / gSize) * gSize;
          const u = (x - bx) / gSize - 0.5;
          const v = (y - by) / gSize - 0.5;
          // 凸透镜/水波砖折射畸变位移
          const rDist = Math.hypot(u, v);
          const bend = Math.sin(rDist * Math.PI) * 20 * renderScale * (o.glass / 100);
          const srcX = Math.max(0, Math.min(W - 1, Math.round(x + u * bend * 2.5)));
          const srcY = Math.max(0, Math.min(H - 1, Math.round(y + v * bend * 2.5)));
          const targetIdx = (y * W + x) * 4;
          const srcIdx = (srcY * W + srcX) * 4;
          let r = copy[srcIdx], g = copy[srcIdx + 1], b = copy[srcIdx + 2];

          // 玻璃方格高光与倒角阴影边框
          const isHighlight = (x - bx < 2 * renderScale || y - by < 2 * renderScale);
          const isShadow = (bx + gSize - x < 2 * renderScale || by + gSize - y < 2 * renderScale);
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
      const mSize = Math.max(1, Math.round(Math.max(4, Math.min(64, o.mosaicSize || 18)) * renderScale));
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
                const onBorder = (x - bx < renderScale || y - by < renderScale || bx + bw - 1 - x < renderScale || by + bh - 1 - y < renderScale);
                if (onBorder) { r *= 0.22; g *= 0.22; b *= 0.22; }
                else {
                  const bevel = ((x - bx) - (y - by)) / mSize * 36;
                  r = Math.max(0, Math.min(255, r + bevel));
                  g = Math.max(0, Math.min(255, g + bevel));
                  b = Math.max(0, Math.min(255, b + bevel));
                }
              } else {
                // 经典阶梯大像素 + 锐化边界 (Sharp Pixelate)
                if (x - bx < renderScale || y - by < renderScale) {
                  r *= 0.84; g *= 0.84; b *= 0.84;
                } else if (bx + bw - 1 - x < renderScale || by + bh - 1 - y < renderScale) {
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
      const step = Math.max(1, Math.round(Math.max(2, Math.round(o.ditherStep || 4)) * renderScale));
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
        const srcVal = (o.threshold || o.dither || o.mosaic) ? (d[idx] * .299 + d[idx + 1] * .587 + d[idx + 2] * .114) : lum[p];
        const t = Math.max(0, Math.min(1, srcVal / 255));
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

    const blockSize = o.compression ? Math.max(1, Math.round(Math.max(3, Math.round(3 + (o.compression / 100) * 13)) * renderScale)) : 1;
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
        const nextX = Math.min(p + Math.max(1, Math.round(renderScale)), lum.length - 1);
        const nextY = Math.min(p + W * Math.max(1, Math.round(renderScale)), lum.length - 1);
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
    const spacing = Math.max(4, 18 - Math.max(1, o.halftoneDensity || 50) * .14) * renderScale;
    const size = Math.max(1, o.halftoneSize || 8) * renderScale;
    const strength = Math.pow(o.halftone / 100, 0.75);
    const W = target.width, H = target.height;

    // C. 经典点状单色半调 (Dot Halftone)
    const overlay = raster(W, H, () => {}), oc = overlay.getContext('2d');
    const angle = (o.halftoneAngle || 0) * Math.PI / 180;
    const diagonal = Math.hypot(W, H);
    const isDuotoneDot = !!o.duotone;
    oc.save(); oc.translate(W / 2, H / 2); oc.rotate(angle);
    oc.fillStyle = isDuotoneDot ? (o.duotoneDark || '#0d226b') : '#111';
    for (let gy = -diagonal / 2; gy < diagonal / 2; gy += spacing) for (let gx = -diagonal / 2; gx < diagonal / 2; gx += spacing) {
      const cos = Math.cos(-angle), sin = Math.sin(-angle);
      const sx = Math.round(gx * cos - gy * sin + W / 2);
      const sy = Math.round(gx * sin + gy * cos + H / 2);
      if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
      const p = (sy * W + sx) * 4;
      const l = pixels[p] * .299 + pixels[p + 1] * .587 + pixels[p + 2] * .114;
      const radius = Math.max(.2 * renderScale, (1 - l / 255) * size * .52 * Math.min(1.6, 0.35 + strength * 1.15));
      oc.beginPath(); oc.arc(gx, gy, radius, 0, Math.PI * 2); oc.fill();
    }
    oc.restore();
    tc.save();
    if (isDuotoneDot) {
      tc.fillStyle = o.duotoneLight || '#d6e2ff';
      tc.fillRect(0, 0, W, H);
      tc.globalAlpha = Math.min(1, 0.75 + strength * 0.25);
      tc.drawImage(overlay, 0, 0);
    } else {
      tc.globalAlpha = Math.min(1, 0.45 + strength * 0.55);
      tc.globalCompositeOperation = 'multiply';
      tc.drawImage(overlay, 0, 0);
    }
    tc.restore();
  }

  function surfaceTexture(target, o) {
    const tc = target.getContext('2d');
    const width = target.width / renderScale, height = target.height / renderScale;
    tc.save();
    if (renderScale !== 1) tc.scale(renderScale, renderScale);
    if (o.paper) {
      const alpha = Math.min(0.92, Math.pow(o.paper / 100, 0.72) * 0.8);
      tc.save();
      tc.globalAlpha = alpha * 0.32;
      tc.fillStyle = '#d4cbbd';
      tc.fillRect(0, 0, width, height);
      tc.globalAlpha = alpha * 0.82;
      tc.fillStyle = '#372f23';
      const fiberCount = Math.round(1400 + (o.paper / 100) * 2600);
      for (let i = 0; i < fiberCount; i++) {
        tc.fillRect(noise(i * 3.7 + 1) * width, noise(i * 7.1 + 2) * height, noise(i * 11.3) * 2.8 + .5, noise(i * 13.9) * 11 + 1.2);
      }
      tc.globalAlpha = alpha * 0.42;
      tc.fillStyle = '#fffdf7';
      for (let i = 0; i < fiberCount * 0.4; i++) {
        tc.fillRect(noise(i * 17.3 + 5) * width, noise(i * 19.9 + 7) * height, noise(i * 23.1) * 2 + .4, noise(i * 29.5) * 8 + 1);
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
        for (let x = 0; x < width; x += step) {
          tc.beginPath(); tc.moveTo(x, 0); tc.lineTo(x, height); tc.stroke();
        }
      } else {
        for (let y = 0; y < height; y += step) {
          tc.beginPath(); tc.moveTo(0, y); tc.lineTo(width, y); tc.stroke();
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
        const x = noise(i * 19 + 4) * width, y = noise(i * 23 + 6) * height;
        const rw = (1 + noise(i * 29) * (o.dirty * .42 + 4)), rh = (1 + noise(i * 31) * (o.dirty * .22 + 3));
        tc.save();
        tc.translate(x, y);
        tc.rotate(noise(i * 37) * Math.PI);
        tc.fillRect(-rw / 2, -rh / 2, rw, rh);
        tc.restore();
      }
      const smudgeCount = Math.round(2 + (o.dirty / 100) * 16);
      for (let i = 0; i < smudgeCount; i++) {
        const sx = noise(i * 41 + 11) * width, sy = noise(i * 43 + 13) * height;
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
    tc.restore();
  }

  const filteredImageCache = new Map();
  let filteredImageCachePixels = 0;
  function cachedFilteredImage(id, source, rect, w, h, options, defer = false, edgeFade = 0) {
    const preview = renderScale === 1;
    const crop = rect || [state.main.zoom, state.main.panX, state.main.panY, state.main.fit];
    const key = JSON.stringify([crop, w, h, options, edgeFade]);
    const cached = preview && filteredImageCache.get(id);
    if (cached && cached.source === source && (defer || cached.key === key)) return cached.image;
    const image = filteredImage(source, rect, w, h, options);
    if (edgeFade) blendMainEdges(image, state.main, edgeFade);
    // Cache only editor previews, capped at 32 surfaces / 64 MiB of RGBA pixels.
    if (preview) {
      const previous = filteredImageCache.get(id);
      if (previous) { filteredImageCachePixels -= previous.pixels; filteredImageCache.delete(id); }
      const pixels = image.width * image.height;
      if (pixels <= 16 * 1024 * 1024) {
        while (filteredImageCache.size >= 32 || filteredImageCachePixels + pixels > 16 * 1024 * 1024) {
          const oldest = filteredImageCache.keys().next().value;
          filteredImageCachePixels -= filteredImageCache.get(oldest).pixels;
          filteredImageCache.delete(oldest);
        }
        filteredImageCache.set(id, { source, key, image, pixels }); filteredImageCachePixels += pixels;
      }
    }
    return image;
  }
  function filteredImage(source, rect, w, h, o) {
    source = (typeof window !== 'undefined' && window.PosterPixels?.normalize(source)) || source;
    const result = raster(w * renderScale, h * renderScale, (rc, target) => {
      if (renderScale !== 1) rc.scale(renderScale, renderScale);
      rc.filter = `grayscale(${Math.max(0, Math.min(100, o.bw || 0))}%) brightness(${Math.max(5, 100 + (o.brightness || 0))}%) contrast(${Math.max(5, 100 + (o.contrast || 0))}%) saturate(${Math.max(0, o.saturation ?? 100)}%) invert(${Math.max(0, Math.min(100, o.invert || 0))}%)`;
      if (rect) {
        // Cover the card with one uniform scale; crop excess edges, never stretch faces.
        // Use logical dimensions so rounding the raster canvas cannot distort the final draw.
        const scale = Math.max(w / rect.sw, h / rect.sh), sw = w / scale, sh = h / scale;
        rc.drawImage(source, rect.sx+(rect.sw-sw)/2, rect.sy+(rect.sh-sh)/2, sw, sh, 0, 0, target.width / renderScale, target.height / renderScale);
      }
      else { const cover = getCover(), box = state.main || imageBox; rc.drawImage(source, cover.x - box.x, cover.y - box.y, cover.w, cover.h); }
      rc.filter = 'none';
      if (renderScale !== 1) rc.setTransform(1, 0, 0, 1, 0, 0);
    });
    const engine = typeof window !== 'undefined' && window.PosterFilterEngine;
    if (engine) {
      const effects = { color_halftone:'color', dot_halftone:'dot', halftone:'dot', circle_halftone:'circle', line_halftone:'line', mosaic_sharp:'mosaic', dither:'bitmap', threshold:'threshold', highbw:'threshold' };
      const effect = o.effect ?? effects[o.filterType] ?? 'none';
      // Keep existing glass, facet, outline and print treatments; process reference
      // patterns from photo luminance and apply the gradient map only at the end.
      const legacy = { ...o, grain:0, duotone:false, dither:0, threshold:0 };
      if (effect === 'mosaic') legacy.mosaic = 0;
      pixelEffects(result, legacy);
      // Original presets keep their established overprinted dot screen.
      if (effect === 'none' && !o.effect && (o.filterType ?? 'original') === 'original') halftone(result, legacy);
      if (effect !== 'none' || o.motionDistance || o.grain || o.duotone) {
        const rc = result.getContext('2d');
        const pixels = rc.getImageData(0, 0, result.width, result.height);
        const output = engine.apply(pixels, { ...o, pixelScale: renderScale, effect, halftoneStrength: o.halftoneStrength ?? o.halftone ?? 75 });
        pixels.data.set(output.data);
        rc.putImageData(pixels, 0, 0);
      }
    } else {
      pixelEffects(result, o); halftone(result, o);
    }
    surfaceTexture(result, o); return result;
  }

  function detailOptions(d) {
    const o = {
      bw: d.bw ?? 0, brightness: d.brightness ?? 0, contrast: d.contrast ?? 0, saturation: d.saturation ?? 100,
      grain: d.grain ?? 0, noiseDistribution: d.noiseDistribution ?? 'gaussian', noiseMonochrome: d.noiseMonochrome ?? true, noiseSize: d.noiseSize ?? 1,
      motionDistance: d.motionDistance ?? 0, motionAngle: d.motionAngle ?? 0,
      rough: 0, outline: 0, invert: 0, posterize: 0, compression: 0, scan: 0,
      paper: 0, dirty: 0, effect:'none', halftone: 0, halftoneStrength: d.halftoneStrength ?? 80,
      halftoneSize: d.halftoneSize ?? 6, halftoneDensity: d.halftoneDensity ?? 55,
      halftoneAngle: d.halftoneAngle ?? 0, halftoneContrast: d.halftoneContrast ?? 65,
      halftoneOriginX: d.halftoneOriginX ?? 50, halftoneOriginY: d.halftoneOriginY ?? 50,
      glass: 0, glassSize: d.glassSize ?? 32, mosaic: 0, mosaicSize: d.mosaicSize ?? 18, mosaicStyle: 'sharp',
      dither: 0, ditherStep: d.ditherStep ?? 1, bitmapMethod: d.bitmapMethod ?? 'diffusion', ditherInvert: false,
      threshold: 0, thresholdLevel: d.thresholdLevel ?? 128,
      duotone: d.duotone ?? ['duotone','gradient_map'].includes(d.filterType),
      duotoneDark: d.duotoneDark ?? '#0d226b', duotoneLight: d.duotoneLight ?? '#eed4eb', gradientGamma: d.gradientGamma ?? 1
    };

    const type = d.filterType || 'original';

    const effects = {
      color_halftone:'color', dot_halftone:'dot', halftone:'dot',
      circle_halftone:'circle', line_halftone:'line', mosaic_sharp:'mosaic',
      dither:'bitmap', threshold:'threshold', highbw:'threshold'
    };
    o.effect = effects[type] ?? 'none';
    // These independent controls all retain an explicit zero or false.
    if (['dot_halftone','halftone','circle_halftone','line_halftone','threshold','highbw','dither'].includes(type)) o.bw = 100;
    if (type === 'glass') {
      o.glass = 85;
      o.contrast += 16;
    } else if (type === 'mosaic_tile') {
      o.mosaic = 100;
      o.mosaicStyle = 'facet';
    } else if (type === 'bw') {
      o.bw = 100;
    } else if (type === 'outline') {
      o.bw = 100;
      o.outline = 100;
    } else if (type === 'rough') {
      o.rough = 52;
      o.dirty = 35;
      o.scan = 25;
    } else if (type === 'invert') {
      o.invert = 100;
    } else if (type === 'posterize') {
      o.posterize = 78;
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
  function setSelected(type, item) { state.selected = item ? { type, id: item.id } : null; renderInspector(); inspector.closest('.poster-inspector').scrollTop = 0; }
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
    const defer = drag?.type === 'frame' && drag.item.id === f.id && !isTargetBefore;
    const cut = cachedFilteredImage('detail:'+d.id, srcImg, rect, d.w, d.h, opts, defer);
    ctx.save(); ctx.globalAlpha = (d.opacity ?? 100) / 100; transformBox(ctx, d);
    if (d.hasShadow) {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.48)';
      ctx.shadowBlur = (d.shadowBlur || 14) * renderScale;
      ctx.shadowOffsetX = (d.shadowOffsetX || 2) * renderScale;
      ctx.shadowOffsetY = (d.shadowOffsetY || 6) * renderScale;
      ctx.fillStyle = '#0a0c10';
      ctx.fillRect(0, 0, d.w, d.h);
      ctx.restore();
    }
    if (d.backingColor && d.backingColor !== 'transparent') {
      ctx.fillStyle = d.backingColor;
      ctx.fillRect(-2, -2, d.w + 4, d.h + 4);
    }
    ctx.drawImage(cut, 0, 0, d.w, d.h);
    ctx.strokeStyle = d.color; ctx.lineWidth = d.lineWidth; ctx.strokeRect(0, 0, d.w, d.h);
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
    if (d.tape) {
      ctx.save();
      ctx.fillStyle = d.tapeColor || 'rgba(255, 255, 255, 0.38)';
      const tw = d.tapeWidth || 44, th = d.tapeHeight || 16;
      if (d.tape === 'top') {
        ctx.translate(d.w / 2 - tw / 2, -th * 0.55);
        ctx.rotate(-0.03);
        ctx.fillRect(0, 0, tw, th);
      } else if (d.tape === 'corner-left') {
        ctx.translate(-tw * 0.3, -th * 0.4);
        ctx.rotate(-0.4);
        ctx.fillRect(0, 0, tw, th);
      } else if (d.tape === 'corner-right') {
        ctx.translate(d.w - tw * 0.7, -th * 0.4);
        ctx.rotate(0.4);
        ctx.fillRect(0, 0, tw, th);
      }
      ctx.restore();
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
    const img = (s.cutout && asset?.cutoutImage) || asset?.image;
    if (!img) return;
    const isTargetBefore = isBeforePreviewActive && state.selected?.type === 'secondary' && state.selected.id === s.id;
    const opts = isTargetBefore ? cleanFilters() : (s.filters || cleanFilters());
    const p=window.PosterDecor?.photoRect(s) || {x:0,y:s.windowFrame?Math.min(22,s.h*.14):0,w:s.w,h:s.windowFrame?s.h-Math.min(22,s.h*.14):s.h};
    const header=p.y,photoH=p.h;
    const iw = img.naturalWidth || s.w;
    const ih = img.naturalHeight || s.h;
    const scale = Math.max(p.w / iw, photoH / ih) * (s.zoom || 1);
    const sw = Math.min(iw, p.w / scale);
    const sh = Math.min(ih, photoH / scale);
    const sx = Math.max(0,Math.min(iw-sw,(iw-sw)/2-(s.panX || 0)/scale));
    const sy = Math.max(0,Math.min(ih-sh,(ih-sh)/2-(s.panY || 0)/scale));
    const full=s.fit==='contain';
    const cover=full?imageCover(img,{...s,x:0,y:0,w:p.w,h:photoH}):{x:0,y:0,w:p.w,h:photoH};
    const cut = cachedFilteredImage('secondary:'+s.id, isTargetBefore ? asset.image : img, full?{sx:0,sy:0,sw:iw,sh:ih}:{sx,sy,sw,sh}, cover.w, cover.h, opts);
    ctx.save(); ctx.globalAlpha = (s.opacity ?? 100) / 100; transformBox(ctx, s);
    if (s.backingColor) { ctx.fillStyle = s.backingColor; ctx.fillRect(-2, -2, s.w + 4, s.h + 4); }
    if(s.windowFrame)window.PosterDecor?.windowFrame(ctx,s);
    if(s.cutout && !isTargetBefore){ctx.save();ctx.translate(p.x+cover.x,header+cover.y);window.PosterDecor?.cutoutBacking(ctx,cut,cover.w,cover.h,s,renderScale);ctx.restore();}
    ctx.save();
    if(full){ctx.beginPath();ctx.rect(p.x,header,p.w,photoH);ctx.clip();}
    if(s.windowFrame && s.windowStyle==='circle'){ctx.beginPath();ctx.ellipse(s.w/2,s.h/2,Math.max(1,s.w/2-3),Math.max(1,s.h/2-3),0,0,Math.PI*2);ctx.clip();}
    if(opts.blur){ctx.filter=`blur(${opts.blur*renderScale}px)`;}
    ctx.drawImage(cut, p.x+cover.x, header+cover.y, cover.w, cover.h);ctx.restore();
    if(s.windowFrame && (!s.windowStyle || s.windowStyle==='desktop')){
      ctx.fillStyle=s.windowColor || '#e88fb9';ctx.fillRect(0,0,s.w,header);
      ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.strokeRect(.5,.5,s.w-1,s.h-1);
      ctx.font='bold 9px Consolas, monospace';ctx.textBaseline='middle';ctx.fillStyle='#fff';
      ctx.save();ctx.beginPath();ctx.rect(5,0,Math.max(0,s.w-42),header);ctx.clip();ctx.fillText(s.windowTitle || 'portrait.jpg',6,header/2);ctx.restore();
      for(let i=0;i<3;i++){const x=s.w-31+i*10;ctx.fillStyle='#fff';ctx.fillRect(x,header/2-3,7,6);ctx.strokeStyle='#765269';ctx.lineWidth=.7;ctx.strokeRect(x,header/2-3,7,6);}
    }
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
    const cut = cachedFilteredImage('fragment:'+fragment.id, state.image, fragmentSourceRect(fragment), fragment.w, fragment.h, opts);
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
    if (window.PosterDecor?.draw(ctx,t)) {ctx.restore();return;}
    if (t.badgeShape === 'heart') {
      ctx.save(); ctx.translate(0, t.size * (t.lineHeight || 1.1));ctx.scale((t.badgeWidth||164)/164,(t.badgeHeight||134)/134);
      ctx.strokeStyle = t.badgeColor || '#d9dfee'; ctx.lineWidth = 2;
      for (const offset of [0,7]) {
        ctx.beginPath(); ctx.moveTo(0, 62 + offset);
        ctx.bezierCurveTo(-92,-1,-62,-72,-12,-30);
        ctx.bezierCurveTo(2,-60,74,-66,64,-16);
        ctx.bezierCurveTo(63,18,19,26,0,62+offset); ctx.stroke();
      }
      ctx.restore();
    }
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
    if (t.backgroundColor && t.backgroundEnabled !== false) {
      ctx.save();ctx.globalAlpha *= (t.backgroundOpacity ?? 100) / 100;
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
    else if (t.kind === 'ps-title') {
      const fontFam = t.font || 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif';
      const baseSize = t.size || 28;
      const numSize = Math.round(baseSize * 1.38);
      ctx.fillStyle = t.color || '#ffffff';
      const baselineY = baseSize * 0.95;
      let cursor = 0;
      ctx.textBaseline = 'alphabetic';
      const tokens = t.content.split(/(\d+)/);
      tokens.forEach(tok => {
        if (!tok) return;
        const isNum = /^\d+$/.test(tok);
        ctx.font = `900 ${isNum ? numSize : baseSize}px ${fontFam}`;
        ctx.fillText(tok, cursor, baselineY);
        cursor += ctx.measureText(tok).width + (isNum ? 4 : 1);
      });
    }
    else {
      const lines = t.content.split('\n');
      if (t.kind === 'ps-recipe') {
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
        ctx.shadowBlur = 6 * renderScale;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = renderScale;
      }
      lines.forEach((line, i) => {
        if (t.kind === 'ps-recipe') {
          const trimmed = line.trim();
          if (trimmed === '+') {
            ctx.fillStyle = '#94a3b8';
            ctx.font = `600 ${Math.max(9, Math.round(t.size * 0.85))}px ${t.font}`;
          } else if (/^[A-Za-z0-9\s\(\)\'\:\/\.\-\,\+]+$/.test(trimmed)) {
            ctx.fillStyle = '#cbd5e1';
            ctx.font = `500 ${Math.max(8.5, Math.round(t.size * 0.88))}px ${t.font}`;
          } else {
            ctx.fillStyle = '#ffffff';
            ctx.font = `700 ${t.size}px ${t.font}`;
          }
        }
        spacedLine(line, t.letterSpacing || 0, 0, i * t.size * lh, t.align || 'left', t.strokeColor, t.strokeWidth);
      });
      if (t.kind === 'ps-recipe') {
        ctx.restore();
      }
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
    const decorBounds=typeof window!=='undefined' && window.PosterDecor?.bounds(t);
    if(decorBounds)return decorBounds;
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
    if (t.kind === 'ps-title') {
      const baseSize = t.size || 28;
      const numSize = Math.round(baseSize * 1.38);
      const fontFam = t.font || 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif';
      let totalW = 0;
      t.content.split(/(\d+)/).forEach(tok => {
        if (!tok) return;
        const isNum = /^\d+$/.test(tok);
        ctx.font = `900 ${isNum ? numSize : baseSize}px ${fontFam}`;
        totalW += ctx.measureText(tok).width + (isNum ? 4 : 1);
      });
      w = totalW;
      h = numSize * lh;
    }
    const alignShift = t.align === 'center' ? -w / 2 : t.align === 'right' ? -w : 0;
    ctx.restore();
    return { x: t.x + (minX + alignShift) * (t.scaleX || 1), y: t.y + minY * (t.scaleY || 1), w: w * (t.scaleX || 1), h: h * (t.scaleY || 1), rotation: t.rotation || 0 };
  }
  function boundsOf(item, type) { return type === 'text' ? textBounds(item) : { x: item.x, y: item.y, w: item.w, h: item.h, rotation: item.rotation || 0 }; }
  function drawSelection() { const item = selectedObject(); if (!item || state.selected.type === 'connector') return; const b = boundsOf(item, state.selected.type); ctx.save(); transformBox(ctx, b); ctx.strokeStyle = '#151515'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]); ctx.strokeRect(-4, -4, b.w + 8, b.h + 8); if (state.selected.type !== 'text') { ctx.setLineDash([]); ctx.fillStyle = '#151515'; ctx.fillRect(b.w - 7, b.h - 7, 14, 14); } ctx.restore(); }
  function blendMainEdges(target, box, amount) {
    const strength = Math.max(0, Math.min(100, Number(amount) || 0)) / 100;
    if (!strength) return;
    const cover = getCover();
    if (!cover) return;
    // Fade the visible photo, including its actual bottom after crop/pan.
    const left = Math.max(0, cover.x - box.x), top = Math.max(0, cover.y - box.y);
    const right = Math.min(target.width / renderScale, cover.x + cover.w - box.x);
    const bottom = Math.min(target.height / renderScale, cover.y + cover.h - box.y);
    const w = right - left, h = bottom - top;
    if (w <= 0 || h <= 0) return;
    const mc = target.getContext('2d');
    mc.save();
    if (renderScale !== 1) mc.scale(renderScale, renderScale);
    mc.globalCompositeOperation = 'destination-in';
    const horizontal = mc.createLinearGradient(left, 0, right, 0);
    horizontal.addColorStop(0, 'rgba(255,255,255,0)');
    horizontal.addColorStop(0.16 * strength, '#ffffff');
    horizontal.addColorStop(1 - 0.16 * strength, '#ffffff');
    horizontal.addColorStop(1, 'rgba(255,255,255,0)');
    mc.fillStyle = horizontal;
    mc.fillRect(0, 0, target.width / renderScale, target.height / renderScale);
    const vertical = mc.createLinearGradient(0, top, 0, bottom);
    vertical.addColorStop(0, 'rgba(255,255,255,0)');
    vertical.addColorStop(0.2 * strength, '#ffffff');
    vertical.addColorStop(1 - 0.26 * strength, '#ffffff');
    vertical.addColorStop(1, 'rgba(255,255,255,0)');
    mc.fillStyle = vertical;
    mc.fillRect(0, 0, target.width / renderScale, target.height / renderScale);
    mc.restore();
  }
  function drawMainImage() {
    if (!state.image) return;
    const box = state.main || makeMain();
    const isTargetBefore = isBeforePreviewActive && (!state.selected || state.selected.type === 'main');
    const image = !isTargetBefore && box.cutout && imageAssets.get(state.mainImageId)?.cutoutImage || state.image;
    const main = cachedFilteredImage('main', image, null, box.w, box.h, isTargetBefore ? cleanFilters() : state.filters, false, isTargetBefore ? 0 : state.mainEdgeFade);
    ctx.save(); ctx.globalAlpha = (box.opacity ?? 100) / 100; transformBox(ctx, box);
    if(box.cutout && !isTargetBefore)window.PosterDecor?.cutoutBacking(ctx,main,box.w,box.h,box,renderScale);
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
    } else if (box.lineWidth !== 0) {
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
  function render(showSelection = true) {
    emptyState.classList.toggle('is-hidden', !!state.image);
    ctx.clearRect(0, 0, W, H); drawPosterBackground(); drawPosterPaper(); if (!state.image) { ctx.strokeStyle = 'rgba(20,20,20,.08)'; for (let n = 25; n < W; n += 50) { ctx.beginPath(); ctx.moveTo(n, 0); ctx.lineTo(n, H); ctx.stroke(); } for (let n = 25; n < H; n += 50) { ctx.beginPath(); ctx.moveTo(0, n); ctx.lineTo(W, n); ctx.stroke(); } } ensureMainLayer(); state.layers.forEach(drawLayer); if (state.border) { ctx.strokeStyle = state.borderColor; ctx.lineWidth = state.borderWidth; ctx.strokeRect(18, 18, W - 36, H - 36); } if (showSelection) drawSelection(); }
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
  function finishCanvasDrag() {
    if (!drag) return;
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
    render();
  }
  canvas.addEventListener('pointerup', finishCanvasDrag);
  canvas.addEventListener('pointercancel', finishCanvasDrag);
  canvas.addEventListener('lostpointercapture', finishCanvasDrag);

  const range = (zh, en, key, value, min, max, step = 1, global = false, hint = '') =>
    `<div class="poster-field"><div class="range-title"><div class="poster-field-label-group"><span class="poster-label-main">${zh}</span><span class="poster-label-sub">${en}</span></div><output>${value}</output></div>${hint ? `<span class="poster-field-hint">${hint}</span>` : ''}<input type="range" data-${global ? 'global' : 'prop'}="${key}" min="${min}" max="${max}" step="${step}" value="${value}"></div>`;

  const segmented = (zh, en, key, value, options, global = false, hint = '') =>
    `<div class="poster-field"><div class="poster-field-label"><div class="poster-field-label-group"><span class="poster-label-main">${zh}</span><span class="poster-label-sub">${en}</span></div></div>${hint ? `<span class="poster-field-hint">${hint}</span>` : ''}<div class="poster-segmented" data-segmented-for="${key}">${options.map(([v, optZh, optEn]) => `<button type="button" class="${String(v) === String(value) ? 'is-active' : ''}" data-${global ? 'global' : 'prop'}="${key}" data-val="${v}"><span>${optZh}</span> <small>${optEn}</small></button>`).join('')}</div></div>`;

  const field = (zh, en, key, value, type = 'text', global = false, hint = '') =>
    `<div class="poster-field"><div class="poster-field-label"><div class="poster-field-label-group"><span class="poster-label-main">${zh}</span><span class="poster-label-sub">${en}</span></div></div>${hint ? `<span class="poster-field-hint">${hint}</span>` : ''}${type === 'textarea' ? `<textarea aria-label="${zh}" data-${global ? 'global' : 'prop'}="${key}">${escapeHTML(value)}</textarea>` : `<input aria-label="${zh}" type="${type}" data-${global ? 'global' : 'prop'}="${key}" value="${escapeHTML(value)}">`}</div>`;

  const toggle = (zh, en, key, value, global = false, hint = '') =>
    `<div class="poster-field"><label class="poster-toggle"><div class="poster-toggle-title"><span class="poster-label-main">${zh}</span><span class="poster-label-sub">${en}</span></div><input type="checkbox" data-${global ? 'global' : 'prop'}="${key}" ${value ? 'checked' : ''}></label>${hint ? `<span class="poster-field-hint">${hint}</span>` : ''}</div>`;

  const select = (zh, en, key, value, options, global = false, hint = '') =>
    `<div class="poster-field"><div class="poster-field-label"><div class="poster-field-label-group"><span class="poster-label-main">${zh}</span><span class="poster-label-sub">${en}</span></div></div>${hint ? `<span class="poster-field-hint">${hint}</span>` : ''}<select data-${global ? 'global' : 'prop'}="${key}">${options.map(([v, optZh, optEn]) => `<option value="${escapeHTML(v)}" ${String(v) === String(value) ? 'selected' : ''}>${optZh} · ${optEn || v}</option>`).join('')}</select></div>`;

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
        const isSel = state.selected?.type === 'secondary' && state.selected?.id === sec.id;
        html += `<div class="poster-layer-row ${isSel ? 'is-selected' : ''}" data-poster-action="select-secondary" data-id="${sec.id}" style="cursor:pointer;padding:6px 10px;border-radius:4px;background:${isSel ? '#e0e7ff' : '#fff'};border:1px solid ${isSel ? '#002FA7' : '#e2e8f0'};display:flex;align-items:center;justify-content:space-between;"><span style="font-size:12px;">🗂️ 辅图卡片 ${String(idx+1).padStart(2,'0')}</span><small style="color:${isSel ? '#002FA7' : '#666'};font-weight:${isSel ? '700' : '400'};">${isSel ? '已选 ✓' : '选中 ↗'}</small></div>`;
      });
      (state.frames || []).forEach((f, idx) => {
        const isSel = state.selected?.type === 'frame' && state.selected?.id === f.id;
        html += `<div class="poster-layer-row ${isSel ? 'is-selected' : ''}" data-poster-action="select-frame" data-id="${f.id}" style="cursor:pointer;padding:6px 10px;border-radius:4px;background:${isSel ? '#e0e7ff' : '#fff'};border:1px solid ${isSel ? '#002FA7' : '#e2e8f0'};display:flex;align-items:center;justify-content:space-between;"><span style="font-size:12px;">🔍 索引框 [${f.labelPrefix||'ITEM'} ${String(idx+1).padStart(2,'0')}]</span><small style="color:${isSel ? '#002FA7' : '#666'};font-weight:${isSel ? '700' : '400'};">${isSel ? '已选 ✓' : '选中 ↗'}</small></div>`;
      });
      (state.details || []).forEach((d, idx) => {
        const isSel = state.selected?.type === 'detail' && state.selected?.id === d.id;
        html += `<div class="poster-layer-row ${isSel ? 'is-selected' : ''}" data-poster-action="select-detail" data-id="${d.id}" style="cursor:pointer;padding:6px 10px;border-radius:4px;background:${isSel ? '#e0e7ff' : '#fff'};border:1px solid ${isSel ? '#002FA7' : '#e2e8f0'};display:flex;align-items:center;justify-content:space-between;"><span style="font-size:12px;">🔬 局部特写 ${String(idx+1).padStart(2,'0')}</span><small style="color:${isSel ? '#002FA7' : '#666'};font-weight:${isSel ? '700' : '400'};">${isSel ? '已选 ✓' : '选中 ↗'}</small></div>`;
      });
      (state.texts || []).forEach((t) => {
        const isSel = state.selected?.type === 'text' && state.selected?.id === t.id;
        const textNames = { hero:'主标题', subtitle:'副标题', caption:'说明', micro:'微型', repeat:'重复' };
        html += `<div class="poster-layer-row ${isSel ? 'is-selected' : ''}" data-poster-action="select-text" data-id="${t.id}" style="cursor:pointer;padding:6px 10px;border-radius:4px;background:${isSel ? '#e0e7ff' : '#fff'};border:1px solid ${isSel ? '#002FA7' : '#e2e8f0'};display:flex;align-items:center;justify-content:space-between;"><span style="font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px;">✍️ ${textNames[t.kind]||'文字'}: ${escapeHTML(t.content?.slice(0,14))}</span><small style="color:${isSel ? '#002FA7' : '#666'};font-weight:${isSel ? '700' : '400'};">${isSel ? '已选 ✓' : '选中 ↗'}</small></div>`;
      });
      listEl.innerHTML = html;
    }
  }

  const inspectorFilterKeys = new Set([
    'filterType', 'bw', 'brightness', 'contrast', 'saturation', 'halftone',
    'halftoneSize', 'halftoneDensity', 'halftoneAngle', 'halftoneStrength',
    'halftoneContrast', 'halftoneOriginX', 'halftoneOriginY',
    'motionDistance', 'motionAngle', 'blur', 'grain', 'noiseDistribution',
    'noiseMonochrome', 'noiseSize', 'bitmapMethod', 'ditherStep',
    'gradientGamma', 'duotone', 'duotoneDark', 'duotoneLight',
    'scan', 'scanAngle', 'rough', 'paper', 'dirty', 'compression',
    'outline', 'invert', 'posterize'
  ]);
  const inspectorPatternTypes = [
    ['original', '原图基调', 'Original Base'],
    ['color_halftone', '彩色半调', 'Color Halftone'],
    ['dot_halftone', '半调图案「点状」', 'Dot Pattern'],
    ['circle_halftone', '半调图案「圆形」', 'Circle Pattern'],
    ['line_halftone', '半调图案「线条」', 'Line Pattern']
  ];
  function inspectorMotionNoise(filters, global = false) {
    return accordion('运动模糊', 'MOTION BLUR',
      range('模糊距离 (px)', 'Distance / px', 'motionDistance', filters.motionDistance ?? 0, 0, 80, 1, global, '0 关闭；沿指定方向形成运动拖影')
      + range('运动方向 (°)', 'Angle / degrees', 'motionAngle', filters.motionAngle ?? 0, -180, 180, 1, global))
      + accordion('杂色', 'NOISE',
        range('杂色强度', 'Noise Amount', 'grain', filters.grain ?? 0, 0, 100, 1, global, '0 关闭；控制明暗与颜色噪点')
        + select('杂色分布', 'Distribution', 'noiseDistribution', filters.noiseDistribution ?? 'gaussian', [['uniform', '均匀', 'Uniform'], ['gaussian', '高斯', 'Gaussian']], global)
        + toggle('单色杂色', 'Monochromatic', 'noiseMonochrome', filters.noiseMonochrome ?? true, global, '关闭后使用彩色杂色')
        + range('杂色颗粒大小 (px)', 'Noise Size / px', 'noiseSize', filters.noiseSize ?? 1, 1, 8, 1, global));
  }
  function inspectorPatternControls(filters, global = false, strengthKey = 'halftoneStrength') {
    return range('图案大小 (px)', 'Pattern Size / px', 'halftoneSize', filters.halftoneSize ?? 8, 2, 32, 1, global)
      + range('半调强度', 'Pattern Strength', strengthKey, filters[strengthKey] ?? 75, 0, 100, 1, global, '0 关闭；100 完全呈现图案')
      + range('图案对比度', 'Pattern Contrast', 'halftoneContrast', filters.halftoneContrast ?? 65, 0, 100, 1, global)
      + (filters.filterType === 'circle_halftone' ? '' : range('图案角度 (°)', 'Pattern Angle', 'halftoneAngle', filters.halftoneAngle ?? 0, -90, 90, 1, global))
      + range('图案中心 X (%)', 'Origin X / %', 'halftoneOriginX', filters.halftoneOriginX ?? 50, -100, 200, 1, global)
      + range('图案中心 Y (%)', 'Origin Y / %', 'halftoneOriginY', filters.halftoneOriginY ?? 50, -100, 200, 1, global);
  }
  function inspectorImagePatterns(filters, global = false) {
    const type = filters.filterType ?? 'original';
    const isPattern = ['color_halftone', 'dot_halftone', 'circle_halftone', 'line_halftone'].includes(type);
    const patternContent = select('半调类型', 'Pattern Type', 'filterType', type, inspectorPatternTypes, global)
      + (isPattern ? inspectorPatternControls(filters, global, 'halftone') : '<p class="poster-help">选择半调类型启用图案；原图基调可单独添加叠印网点。</p>');
    const overprintContent = range('叠印强度', 'Overprint Strength', 'halftone', filters.halftone ?? 0, 0, 100, 1, global, '0 关闭；在原图上叠加印刷网点')
      + range('叠印网点大小', 'Overprint Dot Size', 'halftoneSize', filters.halftoneSize ?? 9, 1, 42, 1, global)
      + range('叠印网点密度', 'Overprint Density', 'halftoneDensity', filters.halftoneDensity ?? 58, 1, 100, 1, global)
      + range('叠印网点角度', 'Overprint Angle', 'halftoneAngle', filters.halftoneAngle ?? 15, -90, 90, 1, global);
    return accordion('半调图案', 'HALFTONE PATTERN', patternContent)
      + (type === 'original' ? accordion('叠印网点', 'OVERPRINT DOTS', overprintContent) : '');
  }
  function inspectorGradientControls(filters, global = false) {
    const defaultEnabled = ['duotone', 'gradient_map'].includes(filters.filterType);
    return accordion('渐变映射', 'GRADIENT MAP',
      toggle('启用双色映射', 'Enable Gradient Map', 'duotone', filters.duotone ?? defaultEnabled, global)
      + field('暗部映射色', 'Dark Tone', 'duotoneDark', filters.duotoneDark ?? '#0d226b', 'color', global)
      + field('亮部映射色', 'Light Tone', 'duotoneLight', filters.duotoneLight ?? '#eed4eb', 'color', global)
      + range('映射中间调', 'Gradient Gamma', 'gradientGamma', filters.gradientGamma ?? 1, .2, 3, .05, global));
  }
  let cutoutBusy = false;
  let cutoutLabel = '';
  function cutoutControls(object,assetId) {
    const asset = imageAssets.get(assetId);
    const enabled = object.cutout && asset?.cutoutImage;
    return accordion('人像抠图','PERSON CUTOUT',
      '<button type="button" class="poster-action poster-action-primary" data-poster-action="cutout" '+(cutoutBusy?'disabled':'')+'>'+(cutoutBusy?'正在抠图…':enabled?'已抠图 · 恢复背景':'自动抠出人像')+'</button><p class="poster-help">'+(enabled?'这张照片已自动抠出人像，点击上方可恢复原图背景。':'点击上方自动去除照片背景，只保留人像。')+' 原图保留，支持撤销。</p>'
      +range('人像贴纸边缘','Sticker Edge','cutoutBorderWidth',object.cutoutBorderWidth||0,0,24)+field('边缘颜色','Edge Color','cutoutBorderColor',object.cutoutBorderColor||'#ffffff','color')+range('人像投影','Portrait Shadow','cutoutShadow',object.cutoutShadow||0,0,30),true);
  }
  async function togglePersonCutout() {
    const object = selectedObject(), type = state.selected?.type;
    if (!object || !['main','secondary'].includes(type) || cutoutBusy) return;
    const assetId = type === 'main' ? state.mainImageId : object.imageId;
    const asset = imageAssets.get(assetId); if (!asset?.image) return;
    if (object.cutout && asset.cutoutImage) { object.cutout = false;renderInspector();render();commit();markManuallyEdited();return; }
    cutoutBusy = true; cutoutLabel = type === 'main' ? '主图' : `辅图 ${state.secondaries.indexOf(object)+1}`; renderInspector(); toast('正在本地抠出人像…');
    try {
      const image = asset.cutoutImage || await window.posterCutout.removeBackground(asset.image);
      // A late model result must not change a different scene or newly selected photo.
      const current = type === 'main' ? state.main : state.secondaries.find(item=>item.id===object.id);
      const currentId = type === 'main' ? state.mainImageId : current?.imageId;
      if (current !== object || currentId !== assetId) { toast('作品已切换，本次抠图未应用。'); return; }
      asset.cutoutImage = image; object.cutout = true;
      render();commit();markManuallyEdited();toast('人像已抠出；可恢复原图或撤销。');
    } catch (error) { console.warn('Person cutout failed',error);toast('抠图未完成：'+error.message); }
    finally { cutoutBusy = false;cutoutLabel = '';renderInspector(); }
  }
  let inspectorTab = 'look', inspectorViewKey = '', inspectorEffect = '';
  function renderInspector() {
    renderInspectorContent();
    organizeInspector();
  }
  function organizeInspector() {
    const key = state.selected ? state.selected.type + ':' + state.selected.id : 'canvas';
    if (key !== inspectorViewKey) { inspectorViewKey = key; inspectorTab = 'look'; inspectorEffect = ''; }
    const nodes = Array.from(inspector.children);
    const panes = Object.fromEntries(['look','layout','advanced'].map(name => {
      const pane = document.createElement('div'); pane.dataset.inspectorPane = name;
      pane.id = 'poster-inspector-pane-' + name; pane.setAttribute('role', 'tabpanel');
      pane.setAttribute('aria-labelledby', 'poster-inspector-tab-' + name); return [name,pane];
    }));
    const layoutSections = new Set(['TRANSFORM','CROP','WINDOW & CROP']);
    const lookSections = new Set(['BACKGROUND & PAPER','COLOR & TONALITY','IMAGE','APPEARANCE','TYPOGRAPHY','FRAME','CONNECTOR','LABEL']);
    nodes.forEach(node => {
      const section = node.querySelector(':scope > summary .acc-en')?.textContent;
      const pane = layoutSections.has(section) || node.matches('.poster-layer-order,.poster-section-label') ? 'layout' : lookSections.has(section) || node.querySelector('[data-prop="imageId"]') ? 'look' : 'advanced';
      panes[pane].append(node);
      if (node.matches('details')) node.open = pane !== 'advanced';
      if (section === 'STYLE') node.querySelectorAll('.poster-field').forEach(field => {
        if (field.querySelector('[data-prop="brightness"],[data-prop="contrast"],[data-prop="saturation"]')) panes.look.append(field);
      });
      if (section === 'TRANSFORM') node.querySelectorAll('.poster-field').forEach(field => {
        if (field.querySelector('input[type="number"]')) field.classList.add('inspector-coordinate');
      });
    });
    if (state.selected?.type === 'text') {
      const fine = document.createElement('details'); fine.className='poster-accordion';
      fine.innerHTML='<summary><span class="acc-zh">文字细节</span><span class="acc-en">TEXT DETAILS</span></summary><div class="poster-accordion-body"></div>';
      panes.look.querySelectorAll('.poster-field').forEach(field=>{
        if(field.querySelector('[data-prop="weight"],[data-prop="letterSpacing"],[data-prop="lineHeight"],[data-prop="align"],[data-segmented-for="writingMode"]')) fine.lastElementChild.append(field);
      });
      panes.advanced.prepend(fine);
    }
    // Keep every existing control and binding, but separate canvas-only geometry.
    if (!state.selected) {
      const paper = document.createElement('details'); paper.className = 'poster-accordion';
      paper.innerHTML = '<summary><span class="acc-zh">纸框与外框</span><span class="acc-en">PAPER & BORDER</span></summary><div class="poster-accordion-body"></div>';
      const position=document.createElement('details');position.className='poster-accordion';position.open=true;
      position.innerHTML='<summary><span class="acc-zh">纸框位置</span><span class="acc-en">PAPER POSITION</span></summary><div class="poster-accordion-body"></div>';
      panes.look.querySelectorAll('.poster-field').forEach(field => {
        const control = field.querySelector('[data-global]'); const prop = control?.dataset.global || '';
        if (['paper_x','paper_y','paper_w','paper_h'].includes(prop)) {field.classList.add('inspector-coordinate');position.lastElementChild.append(field);}
        else if (prop.startsWith('paper_') || ['paperEnabled','border','borderColor','borderWidth'].includes(prop)) paper.lastElementChild.append(field);
      });
      panes.advanced.prepend(paper);
      if(position.lastElementChild.children.length)panes.layout.append(position);
      inspectorTitle.textContent = '画布'; inspectorSelection.textContent = '背景 · 纸框 · 外框';
      if (holdBeforeButton) holdBeforeButton.style.display = 'none';
    }
    const choices = [['canvas','画布背景']];
    if (state.image) choices.push(['main:'+state.main.id,'主图']);
    for (const [type,list,label] of [['secondary',state.secondaries,'辅图'],['fragment',state.fragments,'图像碎片'],['frame',state.frames,'索引框'],['detail',state.details,'局部图'],['text',state.texts,'文字'],['connector',state.details,'连接线']]) {
      list.forEach((object,i) => choices.push([type+':'+object.id,label+' '+String(i+1).padStart(2,'0')]));
    }
    const header = document.createElement('div'); header.className = 'poster-inspector-nav';
    header.innerHTML = '<label for="posterInspectorTarget">当前调整</label><select id="posterInspectorTarget">'+choices.map(([value,label])=>'<option value="'+escapeHTML(value)+'" '+(value===key?'selected':'')+'>'+escapeHTML(label)+'</option>').join('')+'</select><p class="poster-help">'+(state.selected?'只调整当前对象；其他对象保留各自设置。':'只调整背景、纸框和外框。照片效果请选主图或辅图。')+'</p><div class="poster-inspector-tabs" role="tablist" aria-label="编辑分类">'+[['look','外观'],['layout','布局'],['advanced','高级']].map(([value,label])=>'<button type="button" role="tab" id="poster-inspector-tab-'+value+'" aria-controls="poster-inspector-pane-'+value+'" tabindex="'+(value===inspectorTab?'0':'-1')+'" data-inspector-tab="'+value+'" aria-selected="'+(value===inspectorTab)+'">'+label+'</button>').join('')+'</div>';
    const advanced = Array.from(panes.advanced.querySelectorAll(':scope > details'));
    if (advanced.length) {
      const picker = document.createElement('div'); picker.className = 'poster-field';
      picker.innerHTML = '<label for="posterInspectorEffect">选择效果或详细设置</label><select id="posterInspectorEffect"><option value="">请选择</option>'+advanced.map((node,i)=>{
        const code=node.querySelector(':scope > summary .acc-en')?.textContent || String(i);node.dataset.inspectorEffect=code;
        return '<option value="'+escapeHTML(code)+'" '+(code===inspectorEffect?'selected':'')+'>'+escapeHTML(node.querySelector(':scope > summary .acc-zh')?.textContent || code)+'</option>';
      }).join('')+'</select>';
      if (!advanced.some(node=>node.dataset.inspectorEffect===inspectorEffect)) inspectorEffect='';
      panes.advanced.prepend(picker);
      advanced.forEach(node=>{node.hidden=node.dataset.inspectorEffect!==inspectorEffect;node.open=true;});

    }
    for (const name of Object.keys(panes)) panes[name].hidden=name!==inspectorTab;
    if (!panes.layout.children.length) panes.layout.innerHTML='<p class="poster-help">在高级 → 纸框与外框开启内层纸框后，可在这里调整位置和尺寸。</p>';
    inspectorTitle.textContent=header.querySelector('select').selectedOptions[0].textContent;
    inspectorSelection.textContent=state.selected?'编辑当前对象':'背景 · 纸框 · 外框';
    inspector.replaceChildren(header,panes.look,panes.layout,panes.advanced);
    syncInspectorDependencies();
    const deselectBtn=$('#posterDeselectButton'); if(deselectBtn)deselectBtn.style.display='none';
  }
  function syncInspectorDependencies() {
      const dependencies=[['GRADIENT MAP','duotone',['duotoneDark','duotoneLight','gradientGamma']],['MOTION BLUR','motionDistance',['motionAngle']],['NOISE','grain',['noiseDistribution','noiseMonochrome','noiseSize']],['PERSON CUTOUT',null,['cutoutBorderWidth','cutoutBorderColor','cutoutShadow']],['WINDOW & CROP','windowFrame',['windowColor','windowStyle','windowTitle']],['TEXT EFFECT','textStyle',['balloonDepth','balloonShine'],'balloon'],['BADGE & BACKING','backgroundEnabled',['backgroundColor','backgroundOpacity','backgroundPaddingX','backgroundPaddingY']]];
      for(const [section,key,props,required] of dependencies){
        const group=Array.from(inspector.querySelectorAll('.poster-accordion')).find(node=>node.querySelector(':scope > summary .acc-en')?.textContent===section);if(!group)continue;
        const control=key?group.querySelector('[data-prop="'+key+'"],[data-global="'+key+'"]'):null;
        const enabled=required?control?.value===required:key?(control?.type==='checkbox'?control.checked:Number(control?.value)>0):!!selectedObject()?.cutout;
        for(const prop of props) group.querySelectorAll('[data-prop="'+prop+'"],[data-global="'+prop+'"]').forEach(input=>{input.disabled=!enabled;input.title=enabled?'':'先启用该效果或增加强度';});
      }
  }
  function renderInspectorContent() {
    syncLeftControls();
    const o = selectedObject();
    const photoSelected = !!o && ['main','secondary'].includes(state.selected?.type);
    const photo = photoSelected ? o : state.main;
    const secondary = photoSelected && state.selected.type === 'secondary';
    const asset = imageAssets.get(secondary ? photo.imageId : state.mainImageId);
    const enabled = !!(photo?.cutout && asset?.cutoutImage);
    const entry = $('#posterCutoutEntry'), restoreButton = $('#posterCutoutRestore'), targetLabel = $('#posterCutoutTarget');
    if (targetLabel) {
      targetLabel.textContent = cutoutBusy ? '正在处理：'+cutoutLabel : '当前照片：' + (secondary ? `辅图 ${state.secondaries.indexOf(photo)+1}` : photoSelected ? '主图' : '主图（默认）');
      targetLabel.title = asset?.name || '请先上传照片';
    }
    if (entry) { entry.textContent = cutoutBusy ? '正在抠图…' : enabled ? '✓ 已抠图' : '✂ 自动抠图'; entry.disabled = cutoutBusy || enabled || !asset?.image; }
    if (restoreButton) { restoreButton.hidden = !enabled; restoreButton.disabled = cutoutBusy; }
    const deselectBtn = $('#posterDeselectButton');
    if (deselectBtn) {
      deselectBtn.style.display = o ? 'inline-block' : 'none';
    }
    if (!o) {
      if (holdBeforeButton) holdBeforeButton.style.display = 'flex';
      inspectorSelection.textContent = 'FILTERS · TEXTURE';
      inspectorTitle.innerHTML = '滤镜与质感 <small>FILTERS & TEXTURE</small>';

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

      const bgPresetsContent =
        field('画布底色','Background Color','background',state.background,'color',true)
      + select('背景样式','Background Style','backgroundStyle',state.backgroundStyle||'solid',[['blue-valentine','蓝色情绪拼贴','Blue Valentine'],['electric-tiger','电光虎纹','Electric Tiger'],['liquid-chrome','酸性全息水银','Liquid Chrome'],['solid','纯色基底','Solid'],['grid','坐标网格','Index Grid'],['chrome','金属渐变','Chrome Gradient'],['pink-paper','淡粉扫描纸','Pink Paper'],['scan','复印扫描纸','Scan Paper'],['dots','点阵印刷','Dot Matrix'],['soft-y2k','柔和 Y2K','Soft Y2K'],['blueprint','工程蓝图','Blue Print']],true)
      + bgStyleControls + bgImageControls
      + toggle('内层纸框','Inner Paper','paperEnabled',!!state.posterPaper,true)
      + (state.posterPaper ? field('纸框 X','Paper X','paper_x',state.posterPaper.x,'number',true)+field('纸框 Y','Paper Y','paper_y',state.posterPaper.y,'number',true)+field('纸框宽度','Paper Width','paper_w',state.posterPaper.w,'number',true)+field('纸框高度','Paper Height','paper_h',state.posterPaper.h,'number',true)+field('纸框颜色','Paper Color','paper_color',state.posterPaper.color||'#fafaff','color',true)+field('标题栏颜色','Header Color','paper_headerColor',state.posterPaper.headerColor||'#3152ed','color',true)+range('标题栏高度','Header Height','paper_headerH',state.posterPaper.headerH??178,0,400,1,true) : '')
      + toggle('海报外框','Poster Border','border',state.border,true)
      + field('外框颜色','Border Color','borderColor',state.borderColor,'color',true)
      + range('外框线宽','Border Width','borderWidth',state.borderWidth,1,18,1,true);
      const bgAccordion = accordion('背景与纸张', 'BACKGROUND & PAPER', bgPresetsContent, true);


      inspector.innerHTML = bgAccordion;
      return;
    }
    if (state.selected.type === 'main') {
      if (holdBeforeButton) holdBeforeButton.style.display = 'flex';
      inspectorSelection.textContent = `SELECTED · MAIN IMAGE / ${o.layoutMode || 'CUSTOM'}`;
      inspectorTitle.innerHTML = '主图 <small>MAIN IMAGE · 核心视觉</small>';
      inspector.innerHTML = cutoutControls(o,state.mainImageId)
        + accordion('变换', 'TRANSFORM', `${field('水平位置','X','x',Math.round(o.x),'number')}${field('垂直位置','Y','y',Math.round(o.y),'number')}${field('宽度','Width','w',Math.round(o.w),'number')}${field('高度','Height','h',Math.round(o.h),'number')}${range('旋转角度','Rotation','rotation',o.rotation||0,-12,12,.5)}${range('主图透明度','Opacity','opacity',o.opacity??100,0,100)}`, true)
        + accordion('裁切', 'CROP', `${select('照片适配','Image Fit','fit',o.fit||'cover',[['cover','填满画框','Cover'],['contain','完整照片','Contain']])}${range('画面缩放','Image Zoom','zoom',o.zoom??1,.7,2.4,.02)}${range('裁切水平偏移','Crop X','panX',o.panX??0,-350,350,1)}${range('裁切垂直偏移','Crop Y','panY',o.panY??0,-450,450,1)}`, true)
        + accordion('图像调色', 'COLOR & TONALITY', `${range('黑白','B&W','bw',state.filters.bw??0,0,100,1,true)}${range('亮度','Brightness','brightness',state.filters.brightness??0,-70,80,1,true)}${range('对比度','Contrast','contrast',state.filters.contrast??0,-50,120,1,true)}${range('饱和度','Saturation','saturation',state.filters.saturation??100,0,200,1,true)}`, true)
        + inspectorImagePatterns(state.filters,true)
        + inspectorMotionNoise(state.filters,true)
        + inspectorGradientControls(state.filters,true)
        + accordion('扫描纹','SCANLINES',range('扫描线','Scanline','scan',state.filters.scan??0,0,100,1,true)+segmented('扫描方向','Direction','scanAngle',state.filters.scanAngle??0,[[0,'横向','Horizontal'],[90,'纵向','Vertical']],true))
        + accordion('质感','TEXTURE',range('粗糙度','Roughness','rough',state.filters.rough??0,0,100,1,true)+range('纸张纹理','Paper','paper',state.filters.paper??0,0,100,1,true)+range('脏版印刷','Dirty','dirty',state.filters.dirty??0,0,100,1,true)+range('压缩损坏','Compression','compression',state.filters.compression??0,0,100,1,true))
        + accordion('风格化','STYLIZE',range('轮廓','Outline','outline',state.filters.outline??0,0,100,1,true)+range('反相','Invert','invert',state.filters.invert??0,0,100,1,true)+range('色阶压缩','Posterize','posterize',state.filters.posterize??0,0,100,1,true))
        + accordion('边缘融合','EDGE BLEND',range('底图边缘融合','Edge Blend','mainEdgeFade',state.mainEdgeFade??0,0,100,1,true))
        + accordion('重置主图','RESET MAIN','<button type="button" class="poster-action" data-poster-action="reset-filters">重置主图取景与效果</button>')
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
        + accordion('风格滤镜', 'STYLE', select('滤镜类型','Filter Type','filterType',o.filterType ?? 'original',[...inspectorPatternTypes,['bw','黑白','B&W'],['highbw','高对比黑白','Threshold'],['duotone','双色映射','Duotone'],['gradient_map','渐变映射','Gradient Map'],['rough','粗糙复印','Rough'],['outline','轮廓描边','Outline'],['invert','反相','Invert'],['posterize','色阶压缩','Posterize']]) + (['halftone','color_halftone','dot_halftone','circle_halftone','line_halftone'].includes(o.filterType) ? inspectorPatternControls(o) : '') + (o.filterType === 'highbw' ? range('二值化阈值','Threshold Level','thresholdLevel',o.thresholdLevel ?? 128,0,255) : ''), true)
        + inspectorMotionNoise(o)
        + inspectorGradientControls(o)
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

      inspector.innerHTML = cutoutControls(o,o.imageId)
        + select('照片来源','Image Source','imageId',o.imageId,state.assets.filter(a=>imageAssets.has(a.id)).map(a=>[a.id,escapeHTML(a.name),escapeHTML(imageAssets.get(a.id)?.libraryId || '当前素材')]),false,'从已上传的照片中替换这一格；位置、尺寸与滤镜保留。')
        + accordion('变换', 'TRANSFORM', `${field('水平位置','X','x',Math.round(o.x),'number')}${field('垂直位置','Y','y',Math.round(o.y),'number')}${field('宽度','Width','w',Math.round(o.w),'number')}${field('高度','Height','h',Math.round(o.h),'number')}${range('旋转角度','Rotation','rotation',o.rotation||0,-180,180)}${range('透明度','Opacity','opacity',o.opacity??100,0,100)}`, true)
        + accordion('窗口与取景','WINDOW & CROP', `${toggle('复古窗口边框','Desktop Window','windowFrame',!!o.windowFrame)}${field('标题栏颜色','Window Color','windowColor',o.windowColor||'#e88fb9','color')}${select('照片框样式','Photo Frame','windowStyle',o.windowStyle||'desktop',[['desktop','复古窗口','Desktop'],['photo-booth','Photo Booth','Photo Booth'],['airdrop','AirDrop','AirDrop'],['polaroid','拍立得','Polaroid'],['circle','圆形','Circle']])}${field('窗口标题','Window Title','windowTitle',o.windowTitle||'portrait.jpg','textarea')}${select('照片适配','Image Fit','fit',o.fit||'cover',[['cover','填满画框','Cover'],['contain','完整照片／人物','Contain']])}${range('照片虚化','Photo Blur','blur',o.filters?.blur||0,0,30)}${range('照片缩放','Photo Zoom','zoom',o.zoom||1,1,3,.05)}${range('取景水平偏移','Crop X','panX',o.panX||0,-200,200)}${range('取景垂直偏移','Crop Y','panY',o.panY||0,-200,200)}`)
        + accordion('外观', 'APPEARANCE', `${select('风格预设','Appearance','secAppearance',currentAppearance,[['original','原图色彩','Original'],['bw','黑白基调','B&W'],['highbw','高对比黑白','High Contrast B&W']])}${range('黑白','B&W','bw',o.filters.bw??0,0,100)}${range('亮度','Brightness','brightness',o.filters.brightness??0,-70,80)}${range('对比度','Contrast','contrast',o.filters.contrast??0,-50,120)}${range('饱和度','Saturation','saturation',o.filters.saturation??100,0,200)}`, true)
        + inspectorImagePatterns(o.filters)
        + inspectorMotionNoise(o.filters)
        + inspectorGradientControls(o.filters)
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
        ['original', '原图基调', 'Original Base'],
        ['color_halftone', '彩色半调 (像素化)', 'Color Halftone'],
        ['dot_halftone', '半调图案「点状」', 'Dot Halftone'],
        ['circle_halftone', '半调图案「圆形」', 'Circle Halftone'],
        ['line_halftone', '半调图案「线条」', 'Line Halftone'],
        ['glass', '玻璃「块状」(折射)', 'Glass Brick'],
        ['mosaic_sharp', '马赛克 (像素化)', 'Mosaic Pixelate'],
        ['mosaic_tile', '马赛克拼贴', 'Mosaic Tiles'],
        ['duotone', '渐变映射 (双色调)', 'Duotone'],
        ['gradient_map', '渐变映射 (柔和氛围)', 'Soft Gradient Map'],
        ['dither', '位图 / 抖动', 'Bitmap / Dither'],
        ['threshold', '阈值 + 颗粒 (复印高反差)', 'Threshold + Grain'],
        ['bw', '黑白基调', 'B&W'],
        ['outline', '轮廓描边', 'Outline / Edge'],
        ['rough', '粗糙复印', 'Rough / Xerox'],
        ['invert', '底片反相', 'Invert'],
        ['posterize', '色阶压缩', 'Posterize']
      ];

      let filterExtraSliders = '';
      if (['color_halftone', 'dot_halftone', 'circle_halftone', 'line_halftone', 'halftone'].includes(o.filterType)) {
        filterExtraSliders += inspectorPatternControls(o);
      } else if (o.filterType === 'glass') {
        filterExtraSliders += range('玻璃方块尺寸','Glass Block Size','glassSize',o.glassSize??32,12,72);
      } else if (o.filterType === 'mosaic_sharp' || o.filterType === 'mosaic_tile') {
        filterExtraSliders += range('马赛克块尺寸','Mosaic Block Size','mosaicSize',o.mosaicSize??18,4,64);
      } else if (o.filterType === 'dither') {
        filterExtraSliders += select('位图方法','Bitmap Method','bitmapMethod',o.bitmapMethod??'diffusion',[['diffusion','误差扩散抖动','Diffusion Dither'],['ordered','有序抖动','Ordered Dither'],['threshold','阈值二值化','Threshold']]);
        filterExtraSliders += range('位图像素步长','Bitmap Step','ditherStep',o.ditherStep??1,1,16);
        if ((o.bitmapMethod ?? 'diffusion') !== 'ordered') filterExtraSliders += range('二值化阈值','Threshold Level','thresholdLevel',o.thresholdLevel??128,0,255);
      } else if (o.filterType === 'threshold' || o.filterType === 'highbw') {
        filterExtraSliders += range('二值化阈值','Threshold Level','thresholdLevel',o.thresholdLevel??124,0,255);
      }

      inspector.innerHTML = accordion('变换', 'TRANSFORM', `${field('水平位置','X','x',Math.round(o.x),'number')}${field('垂直位置','Y','y',Math.round(o.y),'number')}${field('宽度','Width','w',Math.round(o.w),'number')}${field('高度','Height','h',Math.round(o.h),'number')}${range('旋转角度','Rotation','rotation',o.rotation||0,-180,180)}${range('透明度','Opacity','opacity',o.opacity??100,0,100)}`, true)
        + accordion('风格滤镜', 'STYLE', `${select('滤镜效果','Filter Effect','filterType',o.filterType??'original',filterList)}${filterExtraSliders}${range('画面对比度','Contrast','contrast',o.contrast??0,-40,100)}${range('亮度','Brightness','brightness',o.brightness??0,-70,80)}${range('饱和度','Saturation','saturation',o.saturation??100,0,200)}`, true)
        + inspectorMotionNoise(o)
        + inspectorGradientControls(o)
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
      + accordion('排版文字', 'TYPOGRAPHY', `${field('文字内容','Text Content','content',o.content,'textarea')}${select('字体','Font Family','font',o.font,[['Comic Sans MS, Arial Rounded MT Bold, sans-serif','气球圆体','Balloon'],['Arial Rounded MT Bold, Arial Black, sans-serif','圆润粗体','Rounded'],['Segoe Script, cursive','手写字体','Script'],['Arial, sans-serif','Arial','Sans-Serif'],["Comic Sans MS, cursive", "手写圆体", "Handwriting"],["Segoe UI Emoji", "彩色表情", "Emoji"],["Segoe UI Symbol", "符号字体", "Symbols"],["Arial Black, Arial", "粗标题", "Display"],["Arial Black, Arial, sans-serif", "粗标题回退", "Display"],["Arial, Helvetica, sans-serif", "经典无衬线", "Sans"],["Impact, Arial Black", "窄粗标题", "Impact"],["Impact, Arial Black, sans-serif", "窄粗标题回退", "Impact"],['Arial Black, Impact, sans-serif','Arial Black','Display'],['Georgia, serif','Georgia','Serif'],['Impact, "Arial Black", sans-serif','Impact','Display'],['system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif','系统字体','System'],['ui-monospace, Consolas, monospace','Monospace','Technical']])}${range('字号','Font Size','size',o.size,6,240,.5)}${select('字重','Weight','weight',o.weight,[['400','常规','Regular'],['500','中等','Medium'],['600','半粗','Semibold'],['700','加粗','Bold'],['800','超重','Black'],['900','特粗','Heavy']])}${range('字距','Tracking','letterSpacing',o.letterSpacing||0,-20,100,.5)}${range('行距','Line Height','lineHeight',o.lineHeight,.35,4,.05)}${select('对齐方式','Alignment','align',o.align||'left',[['left','左对齐','Left'],['center','居中','Center'],['right','右对齐','Right']])}${o.kind !== 'repeat' ? segmented('排版方向','Text Direction','writingMode',o.writingMode||'horizontal',[['horizontal','横排','Horizontal'],['vertical','竖排','Vertical']]) : ''}${field('文字颜色','Color','color',o.color,'color')}`, true)
      + accordion('文字效果','TEXT EFFECT', select('文字效果','Text Effect','textStyle',o.textStyle||'plain',[['plain','普通文字','Plain'],['balloon','立体气球字','Balloon']])+range('气球立体厚度','Balloon Depth','balloonDepth',o.balloonDepth??7,0,16)+range('气球高光','Balloon Shine','balloonShine',o.balloonShine??75,0,100)+field('描边颜色','Outline Color','strokeColor',o.strokeColor||'#ffffff','color')+range('描边宽度','Outline Width','strokeWidth',o.strokeWidth||0,0,16))
      + accordion('徽章与文字底色','BADGE & BACKING', select('徽章形状','Badge Shape','badgeShape',o.badgeShape||'none',[['none','无','None'],['pick','拨片','Pick'],['heart','心形线框','Heart'],['checker-heart','棋盘心形','Checker Heart'],['heart-arrow','箭头格纹心','Heart Arrow'],['burst','爆炸贴纸','Burst'],['bunny','小兔贴纸','Bunny'],['star','星星贴纸','Star'],['flower','小花贴纸','Flower'],['butterfly','蝴蝶贴纸','Butterfly'],['book','手绘书本','Book'],['folder','文件夹','Folder'],['globe','网络球','Internet'],['computer','电脑','Computer'],['ribbon','彩虹条','Ribbon'],['panel','桌面面板','Panel'],['grid','网格纸','Grid'],['dock','应用程序栏','Dock'],['focus','专注模式栏','Focus'],['printer','照片打印机','Printer'],['sparkle','四角闪光','Sparkle'],['doodle','手绘花线','Doodle'],['outline-box','索引线框','Outline Box'],['sketch-arrow','手绘箭头','Sketch Arrow'],['connector-path','折线连接','Connector Path'],['retro-window','复古信息窗口','Retro Window'],['profile-card','照片档案卡','Profile Card'],['speech','聊天气泡','Speech'],['checker-panel','棋盘块','Checker Panel'],['recycle-bin','回收站','Recycle Bin']])+field('徽章颜色','Badge Color','badgeColor',o.badgeColor||'#3152ed','color')+range('徽章宽度','Badge Width','badgeWidth',o.badgeWidth||(o.badgeShape==='heart'?164:116),40,900)+range('徽章高度','Badge Height','badgeHeight',o.badgeHeight||(o.badgeShape==='heart'?134:128),40,1200)+range('面板圆角','Panel Radius','cornerRadius',o.cornerRadius??Math.min(24,(o.badgeHeight||100)*.35),0,60)+toggle('文字底色','Text Backing','backgroundEnabled',o.backgroundEnabled??!!o.backgroundColor)+field('底色颜色','Backing Color','backgroundColor',o.backgroundColor||'#3152ed','color')+range('底色透明度','Backing Opacity','backgroundOpacity',o.backgroundOpacity??100,0,100)+range('底色横向留边','Backing X','backgroundPaddingX',o.backgroundPaddingX??8,0,60)+range('底色纵向留边','Backing Y','backgroundPaddingY',o.backgroundPaddingY??4,0,60))
      + repeatControls + objectActions();
  }

  function ensureKarinaMultiAssets(callback) {
    const urls = {
      close: (typeof window !== 'undefined' && window.KARINA_CLOSE_DATA) || 'assets/karina-close.jpg',
      hands: (typeof window !== 'undefined' && window.KARINA_HANDS_DATA) || 'assets/karina-hands.jpg',
      crouch: (typeof window !== 'undefined' && window.KARINA_CROUCH_DATA) || 'assets/karina-crouch.jpg',
      sky: (typeof window !== 'undefined' && window.KARINA_SKY_DATA) || 'assets/karina-sky.jpg'
    };
    const loadedImages = {};
    const keys = Object.keys(urls);
    let count = 0;
    keys.forEach(k => {
      const assetId = 'asset-karina-' + k;
      const expectedSrc = urls[k];
      const existing = imageAssets.get(assetId);
      if (existing?.image && existing.src === expectedSrc && (typeof Image === 'undefined' || existing.image.complete)) {
        loadedImages[k] = existing.image;
        count++;
        if (count === keys.length) callback(loadedImages);
        return;
      }
      if (typeof Image === 'undefined') {
        const fakeImg = existing?.image || state.image || {};
        loadedImages[k] = fakeImg;
        count++;
        if (count === keys.length) callback(loadedImages);
        return;
      }
      const img = new Image();
      img.onload = () => {
        imageAssets.set(assetId, { id: assetId, name: 'karina-' + k + '.jpg', image: img, src: img.src, origin:'demo' });
        loadedImages[k] = img;
        count++;
        if (count === keys.length) callback(loadedImages);
      };
      img.onerror = () => {
        console.warn('Failed to load asset', k);
        count++;
        if (count === keys.length) callback(loadedImages);
      };
      img.src = expectedSrc;
    });
  }

  function ensureModelTechwearAsset(callback) {
    const rawSrc = (typeof window !== 'undefined' && window.MODEL_TECHWEAR_DATA) || 'assets/model-techwear.jpg';
    const assetId = 'asset-model-techwear';
    const existing = imageAssets.get(assetId);
    if (existing?.image && (typeof Image === 'undefined' || existing.image.complete)) {
      if (typeof callback === 'function') callback(existing.image);
      return;
    }
    if (typeof Image === 'undefined') {
      const fakeImg = existing?.image || state.image || {};
      if (typeof callback === 'function') callback(fakeImg);
      return;
    }
    const img = new Image();
    img.onload = () => {
      imageAssets.set(assetId, { id: assetId, name: 'model-techwear.jpg', image: img, src: img.src, origin:'demo' });
      if (typeof callback === 'function') callback(img);
    };
    img.onerror = () => {
      console.warn('Failed to load techwear model asset');
      if (typeof callback === 'function') callback(null);
    };
    img.src = rawSrc;
  }

  async function ensureBlueValentineAssets(callback) {
    const photos = [
      ['main','aespa-14','929ca399e19e398bf092cd383d7da8d4.jpg'],
      ['support','aespa-15','959ac3d300b94737c8fdfa40c3b6affc.jpg'],
      ['knit','aespa-02','1276d75c472be714899e57210bfa6838.jpg'],
      ['camera','aespa-09','5561874c188110984eb60e0366b53bef.jpg']
    ];
    toast('正在载入图库示范与本地人像抠图…');
    try {
      for (const [key,libraryId,name] of photos) {
        const id = 'asset-valentine-'+key;
        let asset = imageAssets.get(id);
        if (asset?.libraryId !== libraryId || !asset.image?.complete) {
          const image = new Image(); image.src = 'samples/aespa/originals/'+name; await image.decode();
          asset = { id,name,libraryId,image,src:image.src,origin:'demo' }; imageAssets.set(id,asset);
        }
        if (key === 'main' && !asset.cutoutImage) asset.cutoutImage = await window.posterCutout.removeBackground(asset.image);
      }
      callback();
    } catch (error) { console.warn('Library demo failed',error); toast('图库示范未完成：'+error.message+'。请通过本地预览服务打开并重试。'); }
  }
  async function preparePinkDesktop(callback,isReset=false,templateLabel='模板四',fourPhotos=false) {
    const requested=snapshot(),userMode=!isReset && !!state.image;
    const mainId=userMode?state.mainImageId:'asset-pink-hero';
    try {
      if(!userMode){
        for(const [key,libraryId,name] of [['hero','aespa-20','d794141e2aa031b6a919dfddf078b2d0.jpg'],['portrait','aespa-03','1c79f7a79b1d81ef67bfaacf07db06e5.jpg'],['camera','aespa-09','5561874c188110984eb60e0366b53bef.jpg'],...(fourPhotos?[['outdoor','aespa-15','959ac3d300b94737c8fdfa40c3b6affc.jpg']]:[])]){
          const id='asset-pink-'+key;
          if(!imageAssets.get(id)?.image?.complete){
            const image=new Image();image.src='samples/aespa/originals/'+name;await image.decode();
            imageAssets.set(id,{id,name,libraryId,image,src:image.src,origin:'demo'});
          }
        }
      }
      if(snapshot()!==requested){toast('作品已修改，未替换成'+templateLabel+'。');return;}
      const asset=imageAssets.get(mainId);
      if(!asset.cutoutImage){toast('正在本地抠出'+templateLabel+'的前景人像…');asset.cutoutImage=await window.posterCutout.removeBackground(asset.image);}
      if(snapshot()!==requested){toast('作品已修改，未替换成'+templateLabel+'。');return;}
      callback();
    }catch(error){console.warn('Desktop preparation failed',error);toast(templateLabel+'未载入：'+error.message+'。原作品保留，请重试。');}
  }
  function pinkDesktopReady(isReset=false,fourPhotos=false) {
    return !isReset && !!state.image
      ? !!imageAssets.get(state.mainImageId)?.cutoutImage
      : !!imageAssets.get('asset-pink-hero')?.cutoutImage && ['portrait','camera',...(fourPhotos?['outdoor']:[])].every(key=>imageAssets.get('asset-pink-'+key)?.image?.complete);
  }
  const narrativeDemoPhotos={
    6:[['main','aespa-05','29dfc7b07cb3b0d9e5605ebaf5590904.jpg'],['support','aespa-04','22d5f781dd29715f2453d731a52720e2.jpg'],['third','aespa-20','d794141e2aa031b6a919dfddf078b2d0.jpg']],
    7:[['main','aespa-12','84baabc702a5a862d97e3158ec2fc92c.jpg'],['support','aespa-05','29dfc7b07cb3b0d9e5605ebaf5590904.jpg'],['avatar','aespa-03','1c79f7a79b1d81ef67bfaacf07db06e5.jpg'],['extra','aespa-18','bb0e239ead798c31dc84a901bd29c4c0.jpg']]
  };
  function narrativeReady(index,isReset=false) {
    const userMode=!isReset && !!state.image;
    if(index===6 && userMode)return true;
    if(!userMode && !narrativeDemoPhotos[index].every(([key])=>imageAssets.get('asset-story-'+index+'-'+key)?.image?.complete))return false;
    if(index===6)return true;
    const ids=userMode?[state.mainImageId,state.assets.find(a=>a.id!==state.mainImageId && imageAssets.has(a.id))?.id || state.mainImageId]:['asset-story-7-main','asset-story-7-support'];
    return ids.every(id=>!!imageAssets.get(id)?.cutoutImage);
  }
  async function prepareNarrative(callback,index,isReset=false) {
    const requested=snapshot(),userMode=!isReset && !!state.image;
    try {
      if(!userMode)for(const [key,libraryId,name] of narrativeDemoPhotos[index]){
        const id='asset-story-'+index+'-'+key;
        if(!imageAssets.get(id)?.image?.complete){const image=new Image();image.src='samples/aespa/originals/'+name;await image.decode();imageAssets.set(id,{id,name,libraryId,image,src:image.src,origin:'demo'});}
      }
      if(snapshot()!==requested){toast('作品已修改，未替换成模板'+(index+1)+'。');return;}
      if(index===7){
        const ids=userMode?[state.mainImageId,state.assets.find(a=>a.id!==state.mainImageId && imageAssets.has(a.id))?.id || state.mainImageId]:['asset-story-7-main','asset-story-7-support'];
        for(const id of new Set(ids)){const asset=imageAssets.get(id);if(!asset.cutoutImage){toast('正在本地抠出模板八的人像…');asset.cutoutImage=await window.posterCutout.removeBackground(asset.image);}}
      }
      if(snapshot()!==requested){toast('作品已修改，未替换成模板'+(index+1)+'。');return;}
      callback();
    }catch(error){console.warn('Narrative collage preparation failed',error);toast('模板'+(index+1)+'未载入：'+error.message+'。原作品保留，请重试。');}
  }
  function hasUserUploadedImages() {
    const hasUserAsset = (state.assets || []).some(a => !isDemoAsset(a) && imageAssets.has(a.id));
    const hasUserMain = Boolean(state.image && state.mainImageId && !isDemoAsset({ id:state.mainImageId }));
    return hasUserAsset || hasUserMain;
  }

  function isDemoAsset(asset) {
    const origin = imageAssets.get(asset?.id)?.origin ?? asset?.origin;
    if (origin) return origin === 'demo';
    // Legacy scenes lack provenance. Their reserved IDs are reliable; filenames
    // are user-controlled and must never decide whether an upload is preserved.
    return !asset?.id || ['asset-karina-close','asset-karina-hands','asset-karina-crouch','asset-karina-sky','main-demo','asset-model-techwear'].includes(asset.id);
  }

  // ==========================================
  // 8 组精选滤镜模板 (FILTER TEMPLATES 01 - 08)
  // 纯视觉调色、底纸材质与印刷质感，不改动任何空间几何坐标
  // ==========================================

  // ==========================================
  // 8 组精选滤镜模板 (FILTER TEMPLATES 01 - 08)
  // 纯视觉调色、底纸材质与印刷质感，不改动任何空间几何坐标
  // ==========================================

  // ==========================================
  // 8 组精选滤镜模板 (FILTER TEMPLATES 01 - 08)
  // 纯视觉调色、底纸材质与印刷质感，不改动任何空间几何坐标
  // ==========================================

  function applyFilterTemplate01(showToast = true, toastMsg = '') {
    const previousPoster = historyTransactionDepth ? null : motion.capture();
    state.mainEdgeFade = 0;
    state.background = '#001fd4';
    state.backgroundStyle = 'electric-tiger';
    state.backgroundImageId = null;
    state.border = true;
    state.borderColor = '#ffffff';
    state.borderWidth = 4;
    state.filters = {
      ...cleanFilters(),
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
    render(); renderInspector(); commit(); markManuallyEdited(); motion.play(previousPoster, 'filter');
    if (showToast) toast(toastMsg || `🎨 滤镜 REMIX [1/${filterRemixList.length}] (滤镜模板 01)：Aespa 电光虎纹与胶印色彩`);
  }


  // Keep the face and central body clearer than the peripheral effect windows.
  const template02DetailOpacities = [56, 34, 50, 44, 50, 30, 48];
  const template02MainFinish = Object.freeze({ grain: 7, motionDistance: 4, motionAngle: 0 });

  function applyFilterTemplate02(showToast = true, toastMsg = '') {
    const previousPoster = historyTransactionDepth ? null : motion.capture();
    state.background = '#101010';
    state.backgroundStyle = 'solid';
    state.backgroundImageId = null;
    state.mainEdgeFade = 78;
    state.border = false;
    state.borderColor = '#1f2430';
    state.borderWidth = 0;
    state.filters = {
      ...cleanFilters(),
      bw: 100, brightness: -4, contrast: 12, saturation: 100,
      halftone: 0, halftoneSize: 6, halftoneDensity: 55, halftoneAngle: 15,
      ...template02MainFinish, rough: 0, outline: 0, scan: 0, scanAngle: 0, paper: 0, dirty: 0,
      compression: 0, invert: 0, posterize: 0
    };

    (state.details || []).forEach((d, idx) => {
      d.opacity = template02DetailOpacities[idx] ?? 50;
      d.color = '#fbcfe8';
      d.lineWidth = 1.2;
      d.showHandles = true;
      d.handleColor = '#ffffff';
      d.handleStrokeColor = '#fbcfe8';
      d.handleSize = 6.5;
      d.showTag = false;
      d.lineOpacity = 0;
      d.backingColor = 'transparent';
      d.hasShadow = false;
      d.tape = null;
      if (d.duotone) {
        d.duotoneDark = '#0d226b';
        d.duotoneLight = (idx === 5) ? '#f5deee' : '#eed4eb';
      }
    });

    (state.frames || []).forEach((f) => {
      f.color = '#fbcfe8';
      f.lineWidth = 1.2;
      f.showHandles = true;
      f.handleColor = '#ffffff';
      f.handleStrokeColor = '#fbcfe8';
      f.handleSize = 6.5;
      f.showLabel = false;
    });

    (state.texts || []).forEach(t => {
      if (t.id === 't-hero' || t.kind === 'ps-title') {
        t.color = t.kind === 'hero' ? '#c2d4ff' : '#ffffff';
      } else if (t.id === 't-sub') {
        t.color = '#cbd5e1';
      } else if (t.id === 't-issue') {
        t.color = '#c2d4ff';
      } else if (t.kind === 'ps-recipe') {
        t.color = '#ffffff';
      } else if (t.id === 't-watermark') {
        t.color = '#64748b';
      }
    });

    render(); renderInspector(); commit(); markManuallyEdited(); motion.play(previousPoster, 'filter');
    if (showToast) toast(toastMsg || `🎨 滤镜 REMIX [2/${filterRemixList.length}] (滤镜模板 02)：多维色度与深邃暗调滤镜`);
  }

  function applyFilterTemplate03(showToast = true, toastMsg = '') {
    const previousPoster = historyTransactionDepth ? null : motion.capture();
    state.background = '#a8afd2'; state.backgroundStyle = 'blue-valentine';
    state.backgroundTextureOpacity = 100; state.backgroundImageId = null;
    state.border = false; state.mainEdgeFade = 0;
    const cool = { ...cleanFilters(), saturation:70, contrast:5, grain:2, noiseSize:1,
      duotone:true, duotoneDark:'#16203d', duotoneLight:'#e6e0f4', gradientGamma:1 };
    state.filters = { ...cool };
    state.secondaries.forEach((card,index) => {
      card.filters = { ...cool, grain:3, ...(index === 0 ? {filterType:'dot_halftone',halftone:40,halftoneSize:3} : {}) };
    });
    if (state.posterPaper) state.posterPaper.headerColor = '#3152ed';
    render();renderInspector();commit();markManuallyEdited();motion.play(previousPoster, 'filter');
    if (showToast) toast(toastMsg || '滤镜 REMIX [3/' + filterRemixList.length + '] · 蓝紫冷调与细颗粒');
  }
  function applyFilterTemplate04(showToast=true,toastMsg='') {
    const previousPoster=historyTransactionDepth ? null : motion.capture();
    state.background='#f6f1f4';state.backgroundStyle='pink-paper';state.backgroundTextureOpacity=80;state.backgroundImageId=null;
    state.border=false;state.mainEdgeFade=0;
    state.filters={...cleanFilters(),saturation:72,contrast:-9,brightness:4,grain:3,noiseMonochrome:false};
    state.secondaries.forEach((s,i)=>{s.filters={...cleanFilters(),saturation:i?85:76,contrast:-5,grain:2,noiseMonochrome:false};});
    render();renderInspector();commit();markManuallyEdited();motion.play(previousPoster, 'filter');
    if(showToast)toast(toastMsg || '滤镜 REMIX [4/'+filterRemixList.length+'] · 柔和粉调与细颗粒');
  }
  function applyFilterDesktop(index,showToast=true,toastMsg='') {
    const previousPoster=historyTransactionDepth ? null : motion.capture();
    state.background=index===4?'#7095a6':'#65978c';state.backgroundStyle='solid';state.backgroundImageId=null;
    state.border=false;state.mainEdgeFade=0;
    state.filters={...cleanFilters(),saturation:90,contrast:-3,grain:1,noiseMonochrome:false};
    state.secondaries.forEach(s=>{s.filters=s.id==='desktop-background'
      ? {...cleanFilters(),saturation:index===4?55:78,brightness:4,contrast:-8,blur:index===4?3:14,...(index===4?{duotone:true,duotoneDark:'#375b68',duotoneLight:'#d5e7e9'}:{})}
      : {...cleanFilters(),saturation:94,contrast:-3,grain:1,noiseMonochrome:false};});
    render();renderInspector();commit();markManuallyEdited();motion.play(previousPoster, 'filter');
    if(showToast)toast(toastMsg || '滤镜 REMIX ['+(index+1)+'/'+filterRemixList.length+'] · '+(index===4?'海蓝桌面与自然肤色':'柔焦背景与清晰照片'));
  }
  function applyFilterNarrative(index,showToast=true,toastMsg='') {
    const previousPoster=historyTransactionDepth ? null : motion.capture();state.background=index===6?'#201b16':'#ffffff';state.backgroundStyle='solid';state.backgroundImageId=null;state.border=false;state.mainEdgeFade=0;
    state.filters=index===6?{...cleanFilters(),saturation:55,brightness:-30,contrast:-5,grain:2}:{...cleanFilters(),bw:100,contrast:12,grain:1};
    state.secondaries.forEach(s=>{s.filters=index===6?{...cleanFilters(),saturation:80,brightness:3,contrast:-4,grain:2,noiseMonochrome:false}
      : {...cleanFilters(),...(s.cutout?{bw:100,contrast:12,grain:1}:{saturation:85})};});
    render();renderInspector();commit();markManuallyEdited();motion.play(previousPoster, 'filter');
    if(showToast)toast(toastMsg || '滤镜 REMIX ['+(index+1)+'/'+filterRemixList.length+'] · '+(index===6?'暖暗相册与清晰肤色':'黑白人物与电蓝图形'));
  }
  const filterRemixList = [
    { id: 'filter-01', nameZh: 'Aespa 电光虎纹与胶印色彩', apply: applyFilterTemplate01 },
    { id: 'filter-02', nameZh: '多维色度与深邃暗调滤镜', apply: applyFilterTemplate02 },
    { id: 'filter-03', nameZh: '蓝紫冷调与细颗粒', apply: applyFilterTemplate03 },
    { id: 'filter-04', nameZh: '柔和粉调与细颗粒', apply: applyFilterTemplate04 },
    { id: 'filter-05', nameZh: '海蓝桌面与自然肤色', apply: (...args)=>applyFilterDesktop(4,...args) },
    { id: 'filter-06', nameZh: '柔焦背景与清晰照片', apply: (...args)=>applyFilterDesktop(5,...args) },
    { id: 'filter-07', nameZh: '暖暗相册与清晰肤色', apply: (...args)=>applyFilterNarrative(6,...args) },
    { id: 'filter-08', nameZh: '黑白人物与电蓝图形', apply: (...args)=>applyFilterNarrative(7,...args) }
  ];

  // ==========================================
  // 通用用户图片/示范素材卡片槽位分配器
  // ==========================================
  function resolveSlotAssetIds(images, isReset) {
    // REMIX retains current photos regardless of provenance; only explicit demo resets replace them.
    const isUserMode = !isReset && !!state.image;
    let slot0Id, slot1Id, slot2Id, slot3Id;

    if (isUserMode) {
      let userAssets = (state.assets || []).filter(a => imageAssets.has(a.id));

      if (state.image && state.mainImageId) {
        const mid = state.mainImageId || makeId();
        if (!imageAssets.has(mid)) {
          imageAssets.set(mid, { id: mid, name: state.imageName || 'user-image.jpg', image: state.image, src: state.image.src || '', origin:'upload' });
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
      const rawUrls = {
        close: (typeof window !== 'undefined' && window.KARINA_CLOSE_DATA) || 'assets/karina-close.jpg',
        hands: (typeof window !== 'undefined' && window.KARINA_HANDS_DATA) || 'assets/karina-hands.jpg',
        crouch: (typeof window !== 'undefined' && window.KARINA_CROUCH_DATA) || 'assets/karina-crouch.jpg',
        sky: (typeof window !== 'undefined' && window.KARINA_SKY_DATA) || 'assets/karina-sky.jpg'
      };

      function resolveDemoImg(key, assetId, fileName) {
        const expectedSrc = rawUrls[key];
        if (images && images[key]) {
          const img = images[key];
          imageAssets.set(assetId, { id: assetId, name: fileName, image: img, src: img.src || expectedSrc });
          return img;
        }
        const existing = imageAssets.get(assetId);
        if (existing?.image && existing.src === expectedSrc) {
          return existing.image;
        }
        if (typeof Image !== 'undefined') {
          const img = new Image();
          img.src = expectedSrc;
          imageAssets.set(assetId, { id: assetId, name: fileName, image: img, src: expectedSrc });
          return img;
        }
        return existing?.image || state.image;
      }

      const imgClose = resolveDemoImg('close', 'asset-karina-close', 'karina-close.jpg');
      const imgHands = resolveDemoImg('hands', 'asset-karina-hands', 'karina-hands.jpg');
      const imgCrouch = resolveDemoImg('crouch', 'asset-karina-crouch', 'karina-crouch.jpg');
      const imgSky = resolveDemoImg('sky', 'asset-karina-sky', 'karina-sky.jpg');

      const assetClose = imageAssets.get('asset-karina-close') || { id: 'asset-karina-close', name: 'karina-close.jpg', image: imgClose, src: imgClose?.src || rawUrls.close };
      const assetHands = imageAssets.get('asset-karina-hands') || { id: 'asset-karina-hands', name: 'karina-hands.jpg', image: imgHands, src: imgHands?.src || rawUrls.hands };
      const assetCrouch = imageAssets.get('asset-karina-crouch') || { id: 'asset-karina-crouch', name: 'karina-crouch.jpg', image: imgCrouch, src: imgCrouch?.src || rawUrls.crouch };
      const assetSky = imageAssets.get('asset-karina-sky') || { id: 'asset-karina-sky', name: 'karina-sky.jpg', image: imgSky, src: imgSky?.src || rawUrls.sky };

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
  // 8 组精选排版模板 (LAYOUT TEMPLATES 01 - 08)
  // 纯空间几何构图，不覆盖用户已选定的滤镜或背景调色
  // ==========================================

  function applyLayoutTemplate01(images, isReset = false, showToast = true, toastMsg = '') {
    state.posterPaper = null;
    remixBaseSnapshot = null; remixLastResultSnapshot = null; lastRemixCopyName = ''; lastRemixAnchorName = ''; lastRemixFramePatternName = '';
    const previousPoster = historyTransactionDepth ? null : motion.capture();

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
      x: 65,
      y: 915,
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
      x: 620,
      y: 665,
      w: 240,
      h: 90,
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
        x: 620, y: 780, size: 11, weight: 600,
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
      anchorZh: isUserMode ? `排版 REMIX [1/${layoutRemixList.length}] · Aespa 电光档案 (用户图片)` : `排版 REMIX [1/${layoutRemixList.length}] · Aespa 电光档案 (多图版)`,
      anchorEn: `Layout REMIX [1/${layoutRemixList.length}] · Electric Archive`,
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
      ? `LAYOUT [1/${layoutRemixList.length}] · ${(state.imageName || 'CUSTOM IMAGE').toUpperCase()}`
      : `LAYOUT [1/${layoutRemixList.length}] / AESPA RICH MAN (MULTI-IMAGE)`;

    syncAllChildFramesOf('main');
    (state.secondaries || []).forEach(s => syncAllChildFramesOf(s.id));
    renderImageTray(); renderInspector(); render();
    if (isReset) { history = []; historyIndex = -1; }
    commit(); updateRemixCard();
    if (zoomMode === 'fit') requestAnimationFrame(fitWorkspace);
    motion.play(previousPoster);
    if (showToast) {
      const resolvedToast = toastMsg || (isUserMode
        ? `📐 排版 REMIX [1/${layoutRemixList.length}] (排版模板 01)：已应用 Aespa 电光档案构图 (已适配您的专属图片)`
        : `📐 排版 REMIX [1/${layoutRemixList.length}] (排版模板 01)：Aespa 电光档案构图`);
      toast(resolvedToast);
    }
  }


  function applyLayoutTemplate02(images, isReset = false, showToast = true, toastMsg = '') {
    state.posterPaper = null;
    remixBaseSnapshot = null; remixLastResultSnapshot = null; lastRemixCopyName = ''; lastRemixAnchorName = ''; lastRemixFramePatternName = '';
    const previousPoster = historyTransactionDepth ? null : motion.capture();

    const isUserMode = !isReset && !!state.image;
    let slot0Id, slot1Id, slot2Id, slot3Id;

    if (isUserMode) {
      const slotData = resolveSlotAssetIds(images, isReset);
      slot0Id = slotData.slot0Id;
      slot1Id = slotData.slot1Id;
      slot2Id = slotData.slot2Id;
      slot3Id = slotData.slot3Id;
    } else {
      const rawSrc = (typeof window !== 'undefined' && window.MODEL_TECHWEAR_DATA) || 'assets/model-techwear.jpg';
      let techAsset = imageAssets.get('asset-model-techwear');
      if (!techAsset?.image) {
        if (images && images.techwear) {
          techAsset = { id: 'asset-model-techwear', name: 'model-techwear.jpg', image: images.techwear, src: images.techwear.src || rawSrc };
          imageAssets.set('asset-model-techwear', techAsset);
        } else if (typeof Image !== 'undefined') {
          const img = new Image();
          img.src = rawSrc;
          techAsset = { id: 'asset-model-techwear', name: 'model-techwear.jpg', image: img, src: rawSrc };
          imageAssets.set('asset-model-techwear', techAsset);
        }
      }
      const modelImg = techAsset?.image || state.image;
      state.image = modelImg;
      state.imageName = 'model-techwear.jpg';
      state.mainImageId = 'asset-model-techwear';
      state.assets = [{ id: 'asset-model-techwear', name: 'model-techwear.jpg' }];
      state.secondaries = [];
    }

    // 参考图：中性近黑纸底、柔和黑白人物与蓝粉局部特效。
    state.background = '#101010';
    state.backgroundStyle = 'solid';
    state.backgroundImageId = null;
    state.mainEdgeFade = 78;
    state.border = false;
    state.borderWidth = 0;
    state.filters = {
      ...cleanFilters(),
      bw: 100, brightness: -4, contrast: 12, saturation: 100, ...template02MainFinish
    };

    // 1. 主图空间定位 (居中模特暗调底图，全幅沉浸)
    state.main = {
      id: 'main-image',
      x: 35,
      y: 95,
      w: 830,
      h: 1090,
      rotation: 0,
      opacity: 100,
      zoom: 0.92,
      panX: 20,
      panY: -180,
      lineWidth: 0,
      color: '#ffffff',
      layoutMode: '7 IMAGE EFFECT SHOWCASE'
    };

    // 2. 多图辅图卡片结构与智能装填 (支持单图/多图自由创作，各视窗自动关联不同素材)
    const hasMultipleAssets = Boolean(isUserMode && slot0Id && (slot0Id !== state.mainImageId || (slot1Id && slot1Id !== state.mainImageId)));

    let secHeroId = 'main', secConcentricId = 'main', secScanlineId = 'main', secDitherId = 'main';
    if (hasMultipleAssets) {
      const secHero = {
        id: makeId(),
        imageId: slot0Id || state.mainImageId,
        x: 485, y: 265, w: 355, h: 280,
        rotation: 0, opacity: 0,
        color: '#fbcfe8', lineWidth: 1.2, backingColor: 'transparent',
        filters: cleanFilters()
      };
      const secConcentric = {
        id: makeId(),
        imageId: slot1Id || state.mainImageId,
        x: 135, y: 300, w: 245, h: 195,
        rotation: 0, opacity: 0,
        color: '#fbcfe8', lineWidth: 1.2, backingColor: 'transparent',
        filters: cleanFilters()
      };
      const secScanline = {
        id: makeId(),
        imageId: slot2Id || state.mainImageId,
        x: 590, y: 655, w: 240, h: 125,
        rotation: 0, opacity: 0,
        panY: 55,
        color: '#fbcfe8', lineWidth: 1.2, backingColor: 'transparent',
        filters: cleanFilters()
      };
      const secDither = {
        id: makeId(),
        imageId: (slot3Id && slot3Id !== state.mainImageId) ? slot3Id : (slot0Id || state.mainImageId),
        x: 55, y: 675, w: 150, h: 205,
        zoom: 1.8, panY: -10,
        rotation: 0, opacity: 0,
        color: '#fbcfe8', lineWidth: 1.2, backingColor: 'transparent',
        filters: cleanFilters()
      };
      secHeroId = secHero.id;
      secConcentricId = secConcentric.id;
      secScanlineId = secScanline.id;
      secDitherId = secDither.id;
      state.secondaries = [secHero, secConcentric, secScanline, secDither];
    } else {
      state.secondaries = [];
    }
    state.fragments = [];

    // 3. 七大选区特效视窗 (完全正交 rotation: 0，粉色边界框，白色八控点手柄，经典 PS 教程质感)
    // 视窗 1：顶部居中发带/额头 · 马赛克 + 细半调 (Mosaic Pixelate + Halftone)
    const f1 = makeFrame(1, {
      sourceId: 'main',
      x: 285, y: 185, w: 135, h: 175,
      strokeOpacity: 0, lineWidth: 0, showLabel: false
    });
    const d1 = makeDetail(f1, 0, {
      x: 285, y: 185, w: 135, h: 175, rotation: 0,
      opacity: template02DetailOpacities[0],
      color: '#fbcfe8', lineWidth: 1.2, backingColor: 'transparent',
      filterType: 'mosaic_sharp', mosaicSize: 10, contrast: 28, brightness: 5, bw: 100, grain: 0,
      showHandles: true, handleColor: '#ffffff', handleStrokeColor: '#fbcfe8', handleSize: 6.5,
      showTag: false, lineOpacity: 0, connectorType: 'none',
      hasShadow: false, tape: null
    });

    // 视窗 2：核心面部/墨镜/眼眸 · 彩色半调 + 经典渐变映射 (Hero Color Halftone + Gradient Map)
    const f2 = makeFrame(2, {
      sourceId: secHeroId,
      x: 485, y: 265, w: 355, h: 280,
      strokeOpacity: 0, lineWidth: 0, showLabel: false
    });
    const d2 = makeDetail(f2, 1, {
      x: 485, y: 265, w: 355, h: 280, rotation: 0,
      opacity: template02DetailOpacities[1],
      color: '#fbcfe8', lineWidth: 1.2, backingColor: 'transparent',
      filterType: 'color_halftone', bw: 100, halftoneStrength: 90, halftoneContrast: 45, halftoneSize: 3, grain: 4,
      duotoneDark: '#0d226b', duotoneLight: '#eed4eb', duotone: true,
      showHandles: true, handleColor: '#ffffff', handleStrokeColor: '#fbcfe8', handleSize: 6.5,
      showTag: false, lineOpacity: 0, connectorType: 'none',
      hasShadow: false, tape: null
    });

    // 视窗 3：左上发侧/蝴蝶 · 同心圆水波半调 + 颗粒 + 渐变映射 (Circle Halftone + Grain + Gradient Map)
    const f3 = makeFrame(3, {
      sourceId: secConcentricId,
      x: 135, y: 300, w: 245, h: 195,
      strokeOpacity: 0, lineWidth: 0, showLabel: false
    });
    const d3 = makeDetail(f3, 2, {
      x: 135, y: 300, w: 245, h: 195, rotation: 0,
      opacity: template02DetailOpacities[2],
      color: '#fbcfe8', lineWidth: 1.2, backingColor: 'transparent',
      filterType: 'circle_halftone', halftoneStrength: 85, halftoneSize: 2, halftoneContrast: 0, contrast: -15,
      halftoneOriginX: -50, halftoneOriginY: 50, grain: 10,
      duotoneDark: '#0d226b', duotoneLight: '#eed4eb', duotone: true,
      showHandles: true, handleColor: '#ffffff', handleStrokeColor: '#fbcfe8', handleSize: 6.5,
      showTag: false, lineOpacity: 0, connectorType: 'none',
      hasShadow: false, tape: null
    });

    // 视窗 4：右侧袖身/手臂 · 线性半调 + 动感模糊 + 渐变映射 (Line Halftone + Motion Blur + Gradient Map)
    const f4 = makeFrame(4, {
      sourceId: secScanlineId,
      x: 590, y: 655, w: 240, h: 125,
      strokeOpacity: 0, lineWidth: 0, showLabel: false
    });
    const d4 = makeDetail(f4, 3, {
      x: 590, y: 655, w: 240, h: 125, rotation: 0,
      opacity: template02DetailOpacities[3],
      color: '#fbcfe8', lineWidth: 1.2, backingColor: 'transparent',
      filterType: 'line_halftone', halftoneStrength: 90, halftoneSize: 3, halftoneContrast: 45, halftoneAngle: 0,
      motionDistance: 18, motionAngle: 0, grain: 4,
      duotoneDark: '#0d226b', duotoneLight: '#eed4eb', duotone: true,
      showHandles: true, handleColor: '#ffffff', handleStrokeColor: '#fbcfe8', handleSize: 6.5,
      showTag: false, lineOpacity: 0, connectorType: 'none',
      hasShadow: false, tape: null
    });

    // 视窗 5：中左侧袖/腰侧 · 扩散抖动位图 + 渐变映射 (Diffusion Dither + Gradient Map)
    const f5 = makeFrame(5, {
      sourceId: secDitherId,
      x: 55, y: 675, w: 150, h: 205,
      strokeOpacity: 0, lineWidth: 0, showLabel: false
    });
    const d5 = makeDetail(f5, 4, {
      x: 55, y: 675, w: 150, h: 205, rotation: 0,
      opacity: template02DetailOpacities[4],
      color: '#fbcfe8', lineWidth: 1.2, backingColor: 'transparent',
      filterType: 'dither', bitmapMethod: 'diffusion', ditherStep: 2, contrast: 30, grain: 0,
      duotoneDark: '#0d226b', duotoneLight: '#eed4eb', duotone: true,
      showHandles: true, handleColor: '#ffffff', handleStrokeColor: '#fbcfe8', handleSize: 6.5,
      showTag: false, lineOpacity: 0, connectorType: 'none',
      hasShadow: false, tape: null
    });

    // 视窗 6：胸腹居中图案 · 2 阶调阈值 + 颗粒 + 渐变映射 (Threshold + Grain + Gradient Map)
    const f6 = makeFrame(6, {
      sourceId: 'main',
      x: 445, y: 690, w: 170, h: 405,
      strokeOpacity: 0, lineWidth: 0, showLabel: false
    });
    const d6 = makeDetail(f6, 5, {
      x: 445, y: 690, w: 170, h: 405, rotation: 0,
      opacity: template02DetailOpacities[5],
      color: '#fbcfe8', lineWidth: 1.2, backingColor: 'transparent',
      filterType: 'threshold', thresholdLevel: 132, grain: 14,
      duotoneDark: '#0d226b', duotoneLight: '#f5deee', duotone: true,
      showHandles: true, handleColor: '#ffffff', handleStrokeColor: '#fbcfe8', handleSize: 6.5,
      showTag: false, lineOpacity: 0, connectorType: 'none',
      hasShadow: false, tape: null
    });

    // 视窗 7：左下角腹/胯部 · 45° 点状半调 + 渐变映射 (Dot Halftone + Gradient Map)
    const f7 = makeFrame(7, {
      sourceId: 'main',
      x: 70, y: 925, w: 295, h: 115,
      strokeOpacity: 0, lineWidth: 0, showLabel: false
    });
    const d7 = makeDetail(f7, 6, {
      x: 70, y: 925, w: 295, h: 115, rotation: 0,
      opacity: template02DetailOpacities[6],
      color: '#fbcfe8', lineWidth: 1.2, backingColor: 'transparent',
      filterType: 'dot_halftone', halftoneStrength: 90, halftoneAngle: 45, halftoneContrast: 45, halftoneSize: 3, grain: 8,
      duotoneDark: '#0d226b', duotoneLight: '#eed4eb', duotone: true,
      showHandles: true, handleColor: '#ffffff', handleStrokeColor: '#fbcfe8', handleSize: 6.5,
      showTag: false, lineOpacity: 0, connectorType: 'none',
      hasShadow: false, tape: null
    });

    state.frames = [f1, f2, f3, f4, f5, f6, f7];
    state.details = [d1, d2, d3, d4, d5, d6, d7];

    // 4. 先锋艺术标题；局部视窗保留日英双语特效配方。
    state.texts = [
      // 大字、紧字距、描边与轻微倾斜，呼应模板 01 的标题层次。
      {
        id: 't-hero',
        kind: 'hero',
        content: 'AFTER IMAGE',
        x: 40, y: 14,
        size: 82, weight: 900,
        font: 'Impact, "Arial Black", sans-serif',
        color: '#c2d4ff',
        strokeColor: '#071540', strokeWidth: 3.5,
        rotation: -1.25, scaleX: 1.2,
        letterSpacing: -1.5,
        opacity: 100
      },
      // 期刊式副标与数字索引，不再使用软件图标或教程标题。
      {
        id: 't-sub',
        kind: 'subtitle',
        content: 'VISUAL EXPERIMENT / VOL. 02',
        x: 42, y: 100,
        size: 11, weight: 700,
        font: 'ui-monospace, Consolas, monospace',
        color: '#cbd5e1',
        letterSpacing: 1.8,
        opacity: 95
      },
      {
        id: 't-issue',
        kind: 'caption',
        content: '07',
        x: 855, y: 17,
        size: 78, weight: 900,
        font: 'Impact, "Arial Black", sans-serif',
        color: '#c2d4ff',
        strokeColor: '#071540', strokeWidth: 3,
        align: 'right', rotation: 1.5,
        opacity: 100
      },
      // Recipe 1 (Top Center Headband - Mosaic + Halftone)
      {
        id: 't-recipe-1',
        kind: 'ps-recipe',
        content: 'モザイク（ピクセルレート）\nMosaic (Pixelate)\n+\nカラーハーフトーン（ピクセルレート）\nColor Halftone (Pixelate)',
        x: 270, y: 188,
        size: 11, weight: 700,
        font: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif',
        color: '#ffffff',
        align: 'right',
        lineHeight: 1.35,
        opacity: 100
      },
      // Recipe 2 (Top Right HERO - Color Halftone + Gradient Map)
      {
        id: 't-recipe-2',
        kind: 'ps-recipe',
        content: 'カラーハーフトーン（ピクセルレート）\nColor Halftone (Pixelate)\n+\nグラデーションマップ（調整レイヤー）\nGradient Map (Adjustment Layer)',
        x: 840, y: 172,
        size: 11, weight: 700,
        font: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif',
        color: '#ffffff',
        align: 'right',
        lineHeight: 1.35,
        opacity: 100
      },
      // Recipe 3 (Upper Left - Circle Halftone + Grain + Gradient Map)
      {
        id: 't-recipe-3',
        kind: 'ps-recipe',
        content: 'ハーフトーンパターン「円」（フィルターギャラリー）\nHalftone Pattern \'Circle\' (Filter Gallery)\n+\n粒子（調整レイヤー）\nGrain Effect (Adjustment Layer)\n+\nグラデーションマップ（調整レイヤー）\nGradient Map (Adjustment Layer)',
        x: 75, y: 512,
        size: 10.5, weight: 700,
        font: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif',
        color: '#ffffff',
        align: 'left',
        lineHeight: 1.35,
        opacity: 100
      },
      // Recipe 4 (Middle Right - Line Halftone + Motion Blur + Gradient Map)
      {
        id: 't-recipe-4',
        kind: 'ps-recipe',
        content: 'ハーフトーンパターン「線」\n（フィルターギャラリー）\nHalftone Pattern \'Line\' (Filter Gallery)\n+\nぼかし（移動）\nMotion Blur\n+\nグラデーションマップ（調整レイヤー）\nGradient Map (Adjustment Layer)',
        x: 830, y: 798,
        size: 10.5, weight: 700,
        font: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif',
        color: '#ffffff',
        align: 'right',
        lineHeight: 1.35,
        opacity: 100
      },
      // Recipe 5 (Middle Left - Bitmap 20px Dither + Gradient Map)
      {
        id: 't-recipe-5',
        kind: 'ps-recipe',
        content: 'モノクロ 2 階調 (拡散)\nDiffusion Dither (Bitmap)\n+\nグラデーションマップ（調整レイヤー）\nGradient Map (Adjustment Layer)',
        x: 218, y: 765,
        size: 10.5, weight: 700,
        font: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif',
        color: '#ffffff',
        align: 'left',
        lineHeight: 1.35,
        opacity: 100
      },
      // Recipe 6 (Center Torso - Threshold + Grain + Gradient Map)
      {
        id: 't-recipe-6',
        kind: 'ps-recipe',
        content: '2 階調化（調整レイヤー）\nThreshold (Adjustment Layer)\n+\n粒子（調整レイヤー）\nGrain Effect (Adjustment Layer)\n+\nグラデーションマップ（調整レイヤー）\nGradient Map (Adjustment Layer)',
        x: 630, y: 980,
        size: 10.5, weight: 700,
        font: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif',
        color: '#ffffff',
        align: 'left',
        lineHeight: 1.35,
        opacity: 100
      },
      // Recipe 7 (Bottom Left - Dot Halftone + Gradient Map)
      {
        id: 't-recipe-7',
        kind: 'ps-recipe',
        content: 'ハーフトーンパターン「ドット」（フィルターギャラリー）\nHalftone Pattern \'Dot\' (Filter Gallery)\n+\nグラデーションマップ（調整レイヤー）\nGrain Effect (Adjustment Layer)',
        x: 70, y: 1058,
        size: 10.5, weight: 700,
        font: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif',
        color: '#ffffff',
        align: 'left',
        lineHeight: 1.35,
        opacity: 100
      },
      // Watermark (Bottom Left vertical text)
      {
        id: 't-watermark',
        kind: 'micro',
        content: 'tamesan_design',
        x: 24, y: 1180,
        rotation: -90,
        size: 10, weight: 500,
        font: 'ui-monospace, Consolas, monospace',
        color: '#64748b',
        align: 'left',
        opacity: 85
      }
    ];

    state.layers = [
      { type: 'main', id: 'main-image' },
      ...state.secondaries.map(s => ({ type: 'secondary', id: s.id })),
      { type: 'detail', id: d1.id },
      { type: 'detail', id: d2.id },
      { type: 'detail', id: d3.id },
      { type: 'detail', id: d4.id },
      { type: 'detail', id: d5.id },
      { type: 'detail', id: d6.id },
      { type: 'detail', id: d7.id },
      ...state.texts.map(t => ({ type: 'text', id: t.id }))
    ];

    state.remixInfo = {
      anchorZh: `排版 REMIX [2/${layoutRemixList.length}] · 先锋艺术多图拼贴`,
      anchorEn: `Layout REMIX [2/${layoutRemixList.length}] · Avant-Garde Multi-Image Collage`,
      mainLayoutZh: '黑白人物底图 · 七组透明特效视窗',
      mainLayoutEn: 'Monochrome Portrait & Seven Transparent Effect Windows',
      typographyZh: '先锋大标题与 FIG 特效规格排版',
      typographyEn: 'Hero Avant-Garde Typography & Specimen Metadata',
      backgroundZh: '近黑纸底 · 黑白人物边缘融合',
      backgroundEn: 'Near-Black Paper / Blended Monochrome Portrait',
      strengthZh: isUserMode ? '专属多图装填' : '多图拼贴排版',
      strengthEn: isUserMode ? 'Custom Multi-Image Populated' : 'Multi-Image Specimen Layout',
      isManuallyEdited: false
    };

    state.selected = null;
    emptyState.classList.add('is-hidden');
    status.textContent = isUserMode
      ? `LAYOUT [2/${layoutRemixList.length}] · ${(state.imageName || 'CUSTOM IMAGE').toUpperCase()}`
      : `LAYOUT [2/${layoutRemixList.length}] / DYNAMIC COLLAGE 7`;

    syncAllChildFramesOf('main');
    (state.secondaries || []).forEach(s => syncAllChildFramesOf(s.id));
    renderImageTray(); renderInspector(); render();
    if (isReset) { history = []; historyIndex = -1; }
    commit(); updateRemixCard();
    if (zoomMode === 'fit') requestAnimationFrame(fitWorkspace);
    motion.play(previousPoster);
    if (showToast) {
      const resolvedToast = toastMsg || (isUserMode
        ? `📐 排版 REMIX [2/${layoutRemixList.length}] (排版模板 02)：已应用错落微旋拼贴构图 (面部留空)`
        : `📐 排版 REMIX [2/${layoutRemixList.length}] (排版模板 02)：错落微旋拼贴构图 (面部留空)`);
      toast(resolvedToast);
    }
  }

  function applyLayoutTemplate03(images, isReset = false, showToast = true, toastMsg = '') {
    const isUserMode = !isReset && !!state.image;
    if (!isUserMode && (!imageAssets.get('asset-valentine-main')?.cutoutImage || !imageAssets.get('asset-valentine-camera')?.image?.complete)) {
      ensureBlueValentineAssets(() => applyLayoutTemplate03(null,isReset,showToast,toastMsg)); return;
    }
    const previousPoster = historyTransactionDepth ? null : motion.capture();
    remixBaseSnapshot = null; remixLastResultSnapshot = null;
    let ids;
    if (isUserMode) {
      resolveSlotAssetIds(null,false);
      const others=state.assets.filter(asset=>asset.id!==state.mainImageId);
      ids=Array.from({length:6},(_,i)=>others[i%Math.max(1,others.length)]?.id || state.mainImageId);
      ids.splice(3,0,state.mainImageId);
    } else {
      const names=['main','support','knit','camera'];
      state.assets=names.map(key=>{const asset=imageAssets.get('asset-valentine-'+key);return {id:asset.id,name:asset.name};});
      state.mainImageId='asset-valentine-main';state.image=imageAssets.get(state.mainImageId).image;
      state.imageName=imageAssets.get(state.mainImageId).name;
      ids=['main','support','knit','camera','support','support','knit'].map(key=>'asset-valentine-'+key);
    }
    state.posterPaper={x:124,y:98,w:652,h:1002,headerColor:'#3152ed'};
    state.main={id:'main-image',x:216,y:340,w:552,h:384,rotation:0,opacity:100,zoom:1,panX:0,panY:0,fit:'contain',lineWidth:0,cutout:!!imageAssets.get(state.mainImageId)?.cutoutImage};
    const cards=[
      [138,300,204,209],[351,300,200,209],[560,300,202,209],
      [138,518,624,217],[138,625,289,358],[436,744,119,239],[564,744,198,239]
    ];
    state.secondaries=cards.map(([x,y,w,h],i)=>({id:makeId(),imageId:ids[i],x,y,w,h,rotation:0,opacity:100,lineWidth:0,filters:cleanFilters(),cutout:isUserMode && i===4 && !!imageAssets.get(ids[i])?.cutoutImage}));
    state.fragments=[];state.frames=[];state.details=[];
    const caption=(content,x,y,size,extra={})=>({id:makeId(),kind:'caption',content,x,y,size,font:'Arial, sans-serif',weight:'700',color:'#fafaff',opacity:100,rotation:0,align:'left',lineHeight:1.05,letterSpacing:-.5,...extra});
    state.texts=[
      caption('so done with love',169,153,29),
      caption('so done with hurt',166,195,40),
      caption('Blue\nValentine',662,152,20,{font:'Georgia, serif',weight:'400',align:'center',rotation:-15,badgeShape:'heart',badgeColor:'#cbd9ed',letterSpacing:0,lineHeight:1.05}),
      caption('should I keep on loving you or not?',155,1008,11,{weight:'400',letterSpacing:0,backgroundColor:'#3152ed',backgroundPaddingX:8,backgroundPaddingY:2}),
      caption('↻   ♫   ⓘ',158,1038,33,{weight:'400',color:'#81858c',letterSpacing:1}),
      caption("SPINNIN'\nON IT",684,1032,23,{align:'center',backgroundColor:'#3152ed',backgroundPaddingX:24,backgroundPaddingY:10,lineHeight:.96,letterSpacing:-1})
    ];
    state.layers=[];
    [0,1,2,3,5,6].forEach(i=>state.layers.push({type:'secondary',id:state.secondaries[i].id}));
    state.layers.push({type:'main',id:'main-image'},{type:'secondary',id:state.secondaries[4].id});
    state.texts.forEach(item=>state.layers.push({type:'text',id:item.id}));
    state.selected=null;
    state.remixInfo={anchorZh:'排版 REMIX [3/'+layoutRemixList.length+'] · 蓝色情绪拼贴',anchorEn:'Layout REMIX [3/'+layoutRemixList.length+'] · Blue Valentine',
      mainLayoutZh:'白色唱片封套 · 前景叠压',mainLayoutEn:'White sleeve / foreground overlap',
      typographyZh:'双行蓝底标题 · 唱片信息条',typographyEn:'Two-line headline / record footer',
      backgroundZh:'蓝紫冷调撕纸背景',backgroundEn:'Periwinkle torn-paper backdrop',
      strengthZh:isUserMode?'用户照片拼贴':'图库照片与自动抠图',strengthEn:isUserMode?'Uploaded photographs':'Library photos / automatic cutout',
      narrativeZh:'主体跨格 · 照片分镜',narrativeEn:'Foreground / photo sequence',isManuallyEdited:false};
    emptyState.classList.add('is-hidden');
    renderImageTray();renderInspector();render();
    if(isReset){history=[];historyIndex=-1;}
    commit();updateRemixCard();updateMasterRemixControls();
    if(zoomMode==='fit')requestAnimationFrame(fitWorkspace);
    motion.play(previousPoster);
    if(showToast)toast(toastMsg || '排版 REMIX [3/'+layoutRemixList.length+'] · 蓝色情绪拼贴');
  }
  function applyLayoutTemplate04(images,isReset=false,showToast=true,toastMsg='') {
    if(typeof window!=='undefined' && window.posterCutout?.removeBackground && !pinkDesktopReady(isReset)){
      preparePinkDesktop(()=>applyLayoutTemplate04(null,isReset,showToast,toastMsg),isReset);return;
    }
    const previousPoster=historyTransactionDepth ? null : motion.capture(),isUserMode=!isReset && !!state.image;
    remixBaseSnapshot=null;remixLastResultSnapshot=null;
    let support,third;
    if(isUserMode){resolveSlotAssetIds(null,false);const others=state.assets.filter(a=>a.id!==state.mainImageId);support=others[0]?.id || state.mainImageId;third=others[1]?.id || state.mainImageId;}
    else {
      state.assets=['hero','portrait','camera'].map(key=>{const a=imageAssets.get('asset-pink-'+key);return {id:a.id,name:a.name};});
      state.mainImageId='asset-pink-hero';state.image=imageAssets.get(state.mainImageId).image;state.imageName=imageAssets.get(state.mainImageId).name;support='asset-pink-portrait';third='asset-pink-camera';
    }
    state.posterPaper=null;state.backgroundImageId=null;
    state.main={id:'main-image',x:0,y:70,w:900,h:1130,rotation:0,opacity:100,zoom:1,panX:0,panY:0,fit:'cover',cutout:false};
    state.secondaries=[
      {id:makeId(),imageId:state.mainImageId,x:92,y:710,w:460,h:614,rotation:-5,cutout:!!imageAssets.get(state.mainImageId)?.cutoutImage},
      {id:makeId(),imageId:support,x:677,y:609,w:202,h:264,rotation:0,windowFrame:true,windowTitle:'@yongyong',windowColor:'#e793bd',zoom:1.05,panY:92},
      {id:makeId(),imageId:third,x:655,y:897,w:223,h:278,rotation:0,windowFrame:true,windowTitle:'little_star.jpg',windowColor:'#e793bd',zoom:third===state.mainImageId?1.65:1,panY:third===state.mainImageId?160:60}
    ].map(s=>({opacity:100,lineWidth:0,filters:cleanFilters(),...s}));
    state.fragments=[];state.frames=[];state.details=[];
    const text=(content,x,y,size,extra={})=>({id:makeId(),kind:'caption',content,x,y,size,font:'Arial, sans-serif',weight:'700',color:'#da8eb3',opacity:100,rotation:0,align:'left',lineHeight:1.05,letterSpacing:0,...extra});
    const sticker=(shape,x,y,w,h,content='',extra={})=>text(content,x,y,17,{badgeShape:shape,badgeWidth:w,badgeHeight:h,badgeColor:'#e99ac2',...extra});
    state.texts=[
      text('AESPA LOVE',30,20,116,{kind:'hero',font:'Comic Sans MS, Arial Rounded MT Bold, sans-serif',textStyle:'balloon',balloonDepth:5,balloonShine:95,letterSpacing:2,scaleX:1.08,scaleY:1.15,color:'#df91b8'}),
      sticker('burst',23,259,230,158,'Wish you\nwere here!',{size:20,rotation:-8}),
      sticker('heart-arrow',41,448,122,110,'',{rotation:-12}),
      text('Good luck ☆\nin everything',35,567,21,{strokeColor:'#ffffff',strokeWidth:6}),
      text('Little Star',30,644,43,{font:'Segoe Script, cursive',strokeColor:'#ffffff',strokeWidth:8,rotation:-4}),
      sticker('folder',32,790,104,110,'FOLDERS',{size:13,color:'#263741'}),
      sticker('globe',40,946,91,108,'INTERNET',{size:12,color:'#263741'}),
      sticker('computer',29,1080,111,109,'MY COMPUTER',{size:11,color:'#263741'}),
      sticker('folder',806,204,55,57),text('No.1',797,272,38,{strokeColor:'#ffffff',strokeWidth:6}),
      sticker('ribbon',650,342,229,33,'今日もかわいい ★',{size:13,color:'#7896a4'}),
      text('YONGYONG CLUB',669,557,19,{strokeColor:'#ffffff',strokeWidth:6,backgroundEnabled:true,backgroundColor:'#ebb4cf',backgroundPaddingX:6,backgroundPaddingY:5}),
      sticker('checker-heart',846,649,48,46,'LOVE\nCLUB',{size:7,color:'#b06c97'}),sticker('checker-heart',633,1040,74,68,'LOVE\nYOU',{size:9,color:'#b06c97',rotation:10}),
      ...[['star',309,171,26,28,-14,'#c6afd9'],['bunny',355,167,26,34,12,'#a4dbe9'],['checker-heart',398,178,28,27,-9,'#eaa6c8'],['flower',448,169,31,32,11,'#e79cc5'],['bunny',500,165,25,34,8,'#f5e8dc'],['flower',553,184,30,31,-8,'#b0d8dc'],['butterfly',318,223,37,32,-8,'#afd9df'],['bunny',377,216,25,35,9,'#e99ac2'],['checker-heart',449,221,30,29,-5,'#adcfdf'],['flower',505,230,30,30,6,'#eaa6c8'],['checker-heart',562,233,40,38,13,'#e99ac2']].map(([shape,x,y,w,h,rotation,badgeColor])=>sticker(shape,x,y,w,h,'',{rotation,badgeColor})),
      text('友',192,560,42,{color:'#e28bb4',strokeColor:'#e3f2ed',strokeWidth:3,backgroundEnabled:true,backgroundColor:'#f8d5e7',backgroundPaddingX:8,backgroundPaddingY:5,rotation:4}),
      text('☆',25,643,26,{strokeColor:'#ffffff',strokeWidth:5}),text('☆',232,657,25,{strokeColor:'#ffffff',strokeWidth:5}),
      sticker('ribbon',744,315,135,23,'きみの夢をみるよ',{size:10,color:'#72aeb8'}),
      sticker('book',760,438,109,80,'',{rotation:-7}),
      sticker('checker-heart',637,765,62,58,'LOVE\nYOU',{size:8,color:'#b06c97',rotation:-8}),
      sticker('checker-heart',838,1121,55,53,'LOVE\nCLUB',{size:7,color:'#b06c97',rotation:8})
    ];
    state.layers=[{type:'main',id:'main-image'},...state.secondaries.map(s=>({type:'secondary',id:s.id})),...state.texts.map(t=>({type:'text',id:t.id}))];
    state.selected=null;state.remixInfo={anchorZh:'排版 REMIX [4/'+layoutRemixList.length+'] · 粉色桌面拼贴',anchorEn:'Pink Desktop',mainLayoutZh:'满版肖像 · 抠图前景 · 双窗口',mainLayoutEn:'Portrait / cutout / two windows',typographyZh:'气球标题与贴纸',typographyEn:'Balloon title / stickers',backgroundZh:'淡粉纸面',backgroundEn:'Pale pink paper',strengthZh:isUserMode?'用户照片拼贴':'自有图库与本地人像抠图',strengthEn:'Local portrait collage',isManuallyEdited:false};
    emptyState.classList.add('is-hidden');renderImageTray();renderInspector();render();
    if(isReset){history=[];historyIndex=-1;}commit();updateRemixCard();updateMasterRemixControls();
    if(zoomMode==='fit')requestAnimationFrame(fitWorkspace);motion.play(previousPoster);
    if(showToast)toast(toastMsg || '排版 REMIX [4/'+layoutRemixList.length+'] · 粉色桌面拼贴');
  }
  function applyLayoutDesktop(index,images,isReset=false,showToast=true,toastMsg='') {
    if(typeof window!=='undefined' && window.posterCutout?.removeBackground && !pinkDesktopReady(isReset,index===5)){
      preparePinkDesktop(()=>applyLayoutDesktop(index,null,isReset,showToast,toastMsg),isReset,index===4?'模板五':'模板六',index===5);return;
    }
    const previousPoster=historyTransactionDepth ? null : motion.capture(),userMode=!isReset && !!state.image;
    remixBaseSnapshot=null;remixLastResultSnapshot=null;
    if(userMode)resolveSlotAssetIds(null,false);
    else {
      state.assets=['hero','portrait','camera',...(index===5?['outdoor']:[])].map(key=>{const a=imageAssets.get('asset-pink-'+key);return {id:a.id,name:a.name};});
      state.mainImageId='asset-pink-hero';state.image=imageAssets.get(state.mainImageId).image;state.imageName=imageAssets.get(state.mainImageId).name;
    }
    const others=state.assets.filter(a=>a.id!==state.mainImageId),source=i=>others.length?others[i%others.length].id:state.mainImageId;
    state.posterPaper=null;state.backgroundImageId=null;state.fragments=[];state.frames=[];state.details=[];state.texts=[];state.secondaries=[];state.layers=[];
    const text=(content,x,y,size,extra={})=>{
      const t={id:makeId(),kind:'caption',content,x,y,size,font:'Arial, sans-serif',weight:'400',color:'#f9fbfa',opacity:100,rotation:0,align:'left',lineHeight:1.15,...extra};
      state.texts.push(t);state.layers.push({type:'text',id:t.id});return t;
    };
    const sticker=(shape,x,y,w,h,extra={})=>text('',x,y,14,{badgeShape:shape,badgeWidth:w,badgeHeight:h,badgeColor:'#f7f8f5',...extra});
    const card=(imageId,x,y,w,h,extra={})=>{
      const s={id:makeId(),imageId,x,y,w,h,opacity:100,rotation:0,lineWidth:0,filters:cleanFilters(),...extra};
      state.secondaries.push(s);state.layers.push({type:'secondary',id:s.id});return s;
    };
    card(state.mainImageId,-35,-35,970,1270,{id:'desktop-background'});
    state.main={id:'main-image',x:index===4?610:102,y:index===4?412:125,w:index===4?345:450,h:index===4?815:980,fit:'contain',cutout:!!imageAssets.get(state.mainImageId)?.cutoutImage,lineWidth:0,opacity:100,rotation:0,zoom:1,panX:0,panY:index===4?-140:-180};
    const foregroundScale=Math.min(state.main.w/state.image.naturalWidth,state.main.h/state.image.naturalHeight);
    // Align short portraits upward without clipping the head of a tall source.
    state.main.panY=Math.max(-(state.main.h-state.image.naturalHeight*foregroundScale)/2,state.main.panY);
    if(index===4){
      sticker('doodle',570,36,330,550,{color:'#e7f0ec',opacity:70});
      sticker('grid',52,531,704,565,{badgeColor:'#f1f0e7',color:'#77807a'});
      card(source(0),106,696,277,357,{windowFrame:true,windowStyle:'polaroid',windowColor:'#f8f7f1',panY:100});
      card(state.mainImageId,373,628,176,265,{windowFrame:true,windowStyle:'polaroid',windowColor:'#f8f7f1'});
      card(source(1),393,900,160,154,{windowFrame:true,windowStyle:'polaroid',windowColor:'#f8f7f1',panY:60});
      card(state.mainImageId,568,688,146,157,{windowFrame:true,windowStyle:'circle',windowColor:'#fbfaf1',zoom:1.5,panY:65});
      card(source(2),564,866,146,157,{windowFrame:true,windowStyle:'circle',windowColor:'#fbfaf1'});
      sticker('panel',23,84,235,169,{content:'Recent',color:'#262d30',size:15,weight:700,cornerRadius:8,badgeColor:'#e9eae4'});
      card(state.mainImageId,41,125,533,556,{windowFrame:true,windowStyle:'photo-booth',windowTitle:'Photo Booth ›\n1043 PHOTOS 521 VIDEOS',windowColor:'#f8f8f2',panY:75});
      const stripSources=[state.mainImageId,...others.map(a=>a.id)];
      for(let i=0;i<5;i++)card(stripSources[i%stripSources.length],53+i*103,579,92,68,{lineWidth:1,color:'#6b7879',zoom:i===2?1.4:1});
      card(source(0),599,76,267,324,{windowFrame:true,windowStyle:'airdrop',windowTitle:'AirDrop\nYongyong would like to share a photo.',windowColor:'#fafaf7'});
      text('[INSTAGRAM] TODAY\nMY PHOTO DIARY',590,492,11,{weight:700});
      state.layers.push({type:'main',id:'main-image'});
      sticker('panel',25,24,189,25,{content:'Yongyong                 ⌕',color:'#74818a',size:11,badgeColor:'#f8f8f3'});
      text('Home    Gallery    Events    Personal Photos    ≡',236,30,11,{letterSpacing:1});
      text('DESIGNED BY\nYONGYONG',803,23,7,{weight:700});
      text('⌂\n\n♟\n\n◎\n\n◇\n\n✎\n\n♥\n\nⓘ',867,852,18,{font:'Segoe UI Symbol',align:'center',lineHeight:1.15,strokeColor:'rgba(35,65,65,.35)',strokeWidth:1.2});
      sticker('dock',254,1115,385,61,{badgeColor:'#e5e6df'});
      text('PHOTO ARCHIVE / 05',24,1087,10,{rotation:-90});
    }else {
      sticker('focus',105,222,212,301,{size:13,content:'☾   Do Not Disturb\n♟   Personal\n♥\n▱   Sleep\n▣   Work',badgeColor:'#f7f7f2'});
      state.layers.push({type:'main',id:'main-image'});
      sticker('printer',455,172,354,63,{badgeColor:'#e1e3e2'});
      sticker('panel',503,203,252,817,{badgeColor:'#fff',cornerRadius:0});
      [0,1,2].forEach(i=>card(i===0?state.mainImageId:source(i-1),519,231+i*245,220,223,{panY:i===0?75:0}));
      card(source(2),160,551,326,407,{rotation:-6,windowFrame:true,windowStyle:'airdrop',windowTitle:'AirDrop\nYongyong would like to share a photo.',windowColor:'#fafaf7'});
      sticker('panel',441,659,174,31,{content:"God you're so pretty.",color:'#262b2a',size:12,badgeColor:'#fff'});
      sticker('panel',146,43,610,64,{content:'▦     My Account    ›    Posts    ›    Today',color:'#979c9b',size:16,badgeColor:'#fff',cornerRadius:32});
      sticker('flower',174,172,82,80,{badgeColor:'#fff'});
      sticker('sparkle',23,336,53,87,{badgeColor:'#d1eee8'});
      sticker('sparkle',777,464,64,112,{badgeColor:'#d1eee8'});
      sticker('sparkle',822,533,31,53,{badgeColor:'#d1eee8'});
      sticker('sparkle',95,674,30,67,{badgeColor:'#e3f4ef'});
      text('📷',691,422,58,{rotation:-12,font:'Segoe UI Emoji'});
      text('Aa\n\n∞\n\n▣\n\n◎\n\n⊖\n\n⌄',44,568,31,{font:'Segoe UI Symbol',lineHeight:1.08,strokeColor:'rgba(35,65,65,.35)',strokeWidth:1.2});
      sticker('dock',157,1100,595,85,{badgeColor:'#e5e7df'});
    }
    const name=index===4?'Photo Booth':'AirDrop Diary';
    state.selected=null;state.remixInfo={anchorZh:'排版 REMIX ['+(index+1)+'/'+layoutRemixList.length+'] · '+name,anchorEn:name,mainLayoutZh:index===4?'照片窗口 · 网格拼贴 · 右侧前景':'虚化背景 · 左侧前景 · 竖向照片条',mainLayoutEn:name,typographyZh:'桌面栏与照片信息',typographyEn:'Desktop / photo diary',backgroundZh:index===4?'海蓝照片桌面':'柔焦照片背景',backgroundEn:'Photo desktop',strengthZh:userMode?'用户照片拼贴':'自有图库与本地人像抠图',strengthEn:'Local portrait collage',isManuallyEdited:false};
    emptyState.classList.add('is-hidden');renderImageTray();renderInspector();render();
    if(isReset){history=[];historyIndex=-1;}commit();updateRemixCard();updateMasterRemixControls();
    if(zoomMode==='fit')requestAnimationFrame(fitWorkspace);motion.play(previousPoster);
    if(showToast)toast(toastMsg || '排版 REMIX ['+(index+1)+'/'+layoutRemixList.length+'] · '+name);
  }
  function applyLayoutNarrative(index,images,isReset=false,showToast=true,toastMsg='') {
    if(typeof window!=='undefined' && window.posterCutout?.removeBackground && !narrativeReady(index,isReset)){
      prepareNarrative(()=>applyLayoutNarrative(index,null,isReset,showToast,toastMsg),index,isReset);return;
    }
    const previousPoster=historyTransactionDepth ? null : motion.capture(),userMode=!isReset && !!state.image;
    remixBaseSnapshot=null;remixLastResultSnapshot=null;
    if(userMode)resolveSlotAssetIds(null,false);
    else {
      state.assets=narrativeDemoPhotos[index].map(([key])=>{const a=imageAssets.get('asset-story-'+index+'-'+key);return {id:a.id,name:a.name};});
      state.mainImageId='asset-story-'+index+'-main';state.image=imageAssets.get(state.mainImageId).image;state.imageName=imageAssets.get(state.mainImageId).name;
    }
    const others=state.assets.filter(a=>a.id!==state.mainImageId),source=i=>others[i%Math.max(1,others.length)]?.id || state.mainImageId;
    state.posterPaper=null;state.backgroundImageId=null;state.fragments=[];state.frames=[];state.details=[];state.secondaries=[];state.texts=[];state.layers=[];
    const text=(content,x,y,size,extra={})=>{
      const t={id:makeId(),kind:'caption',content,x,y,size,font:'Arial, sans-serif',weight:'400',color:index===6?'#fff':'#2222ff',rotation:0,opacity:100,align:'left',lineHeight:1.13,...extra};
      state.texts.push(t);state.layers.push({type:'text',id:t.id});return t;
    };
    const sticker=(shape,x,y,w,h,extra={})=>text('',x,y,16,{badgeShape:shape,badgeWidth:w,badgeHeight:h,badgeColor:index===6?'#fff':'#2113ff',...extra});
    const card=(imageId,x,y,w,h,extra={})=>{
      const s={id:makeId(),imageId,x,y,w,h,rotation:0,opacity:100,lineWidth:0,filters:cleanFilters(),...extra};state.secondaries.push(s);state.layers.push({type:'secondary',id:s.id});return s;
    };
    const emoji=(content,x,y,size,extra={})=>text(content,x,y,size,{font:'Segoe UI Emoji',...extra});
    const hand=(content,x,y,size,extra={})=>text(content,x,y,size,{font:'Comic Sans MS, cursive',weight:700,strokeColor:'#202018',strokeWidth:4,...extra});
    if(index===6){
      state.main={id:'main-image',x:0,y:0,w:900,h:1200,opacity:100,rotation:0,zoom:1,panX:0,panY:0,fit:'cover',cutout:false,lineWidth:0};state.layers.push({type:'main',id:'main-image'});
      card(state.mainImageId,28,139,655,311,{lineWidth:4,color:'#fff',panY:65});
      card(source(0),210,498,650,310,{lineWidth:4,color:'#fff',panY:100});
      card(source(1),35,833,652,303,{lineWidth:4,color:'#fff',panY:115});
      text('‹ Albums',28,20,34);text('Recents',64,82,41,{weight:700});
      sticker('panel',625,13,142,49,{content:'Select',size:26,color:'#fff',badgeColor:'#74736c',cornerRadius:24});
      sticker('panel',791,14,62,49,{content:'•••',size:24,color:'#fff',badgeColor:'#74736c',cornerRadius:24});
      text('Aa   Create\n\n∞    Boomerang\n\n▣    Layout\n\n◎    Hands-Free\n\n◉    Multi-Capture\n\n⊖    Level\n\n⌃    Close',54,160,15,{lineHeight:1.06,strokeColor:'rgba(10,10,10,.5)',strokeWidth:1.2,backgroundColor:'#171717',backgroundOpacity:45,backgroundPaddingX:8,backgroundPaddingY:8});
      emoji('🫶',659,96,78);
      hand('Fancy\ndinner',723,212,28,{backgroundColor:'#80601d',backgroundPaddingX:5,backgroundPaddingY:1});
      sticker('sketch-arrow',807,293,88,77,{rotation:92,strokeWidth:4});
      hand('Small moments,\none photo at a time.\nKeep the good ones.',33,538,17);
      sticker('sketch-arrow',80,611,92,70,{rotation:-14,strokeWidth:4});
      emoji('🧸',75,731,101);
      sticker('speech',768,519,71,58,{color:'#a4a4a0',badgeColor:'#fff',content:'•••',size:17});
      hand('*yum yum',700,706,13);
      hand('One more photo\nbefore heading home.',59,860,16);
      emoji('🤎',91,964,78);emoji('🥢',647,847,91,{rotation:-17});
      hand('Hot\nramen',717,923,29,{backgroundColor:'#80601d',backgroundPaddingX:5,backgroundPaddingY:0});
      sticker('outline-box',711,915,76,39,{badgeColor:'#c63522',rotation:-4,strokeWidth:4});
      sticker('sketch-arrow',833,985,53,43,{rotation:92,strokeWidth:4});emoji('🍜',695,1045,120);
      text('Inicio    Galería    Sobre    Contacto    Perfil',68,1160,25);
    }else {
      const blue='#2113ff';state.main={id:'main-image',x:476,y:73,w:386,h:488,opacity:100,rotation:0,zoom:1,panX:0,panY:0,fit:'contain',cutout:!!imageAssets.get(state.mainImageId)?.cutoutImage,lineWidth:0,cutoutBorderWidth:11,cutoutBorderColor:'#fff',cutoutShadow:13};
      sticker('panel',15,14,194,121,{badgeColor:'#d5d5d2',content:'this       like\nis           it,\nmy post',color:'#292a29',size:15,cornerRadius:0});
      sticker('retro-window',80,45,203,103,{badgeColor:blue,content:'Photo archive\n01   02   03   04',size:10,color:'#dadfff'});
      sticker('checker-panel',157,87,195,61,{badgeColor:'#171719'});
      sticker('profile-card',41,140,465,267,{rotation:-6,badgeColor:blue,color:'#191919',content:'@yongyong\n'+state.assets.length+' posts | 21 photos | 08 templates\nMy personal photo archive\nTiny moments / kept close\nyongyong.visual',size:18});
      card(source(1),76,176,107,111,{windowFrame:true,windowStyle:'circle',windowColor:'#fff',rotation:-6});
      sticker('retro-window',678,83,207,189,{rotation:7,badgeColor:'#075ebc',content:'Window\n\n?????',size:22,color:'#161719'});
      sticker('retro-window',25,624,272,241,{rotation:3,badgeColor:'#17137e',content:'Recycle Bin\nFile   Edit   View\nName               Size',size:15,color:'#444'});
      card(source(2),47,706,167,109,{rotation:3,lineWidth:2,color:'#777'});
      sticker('profile-card',458,733,390,250,{rotation:5,badgeColor:blue,color:'#191919',content:'PHOTO DIARY\n'+state.assets.length+' posts | 21 photos | 08 templates\nSaved on this device\nMy people / my memories\nFrom the photo archive',size:17});
      card(source(0),464,775,83,94,{windowFrame:true,windowStyle:'circle',windowColor:'#fff',filters:{...cleanFilters(),bw:100}});
      text('PERSONAL ARCHIVE',304,38,15,{color:'#77729b',letterSpacing:1.1});
      text('Keep the moments.\nMake them yours.',222,485,17,{color:'#77729b',lineHeight:1.4});
      text('A PHOTO DIARY',583,681,16,{color:'#77729b',letterSpacing:1});
      text('Saved for later.',550,1018,20,{color:'#77729b'});
      sticker('connector-path',393,328,181,301,{badgeColor:blue,strokeWidth:4});
      text('?',74,439,99,{font:'Georgia, serif',weight:900,color:blue,rotation:-14});text('?',172,423,58,{font:'Georgia, serif',weight:900,color:blue,rotation:13});
      state.layers.push({type:'main',id:'main-image'});
      card(source(0),53,664,475,432,{fit:'contain',cutout:!!imageAssets.get(source(0))?.cutoutImage,cutoutBorderWidth:12,cutoutBorderColor:'#fff',cutoutShadow:13});
      sticker('outline-box',444,69,334,273,{badgeColor:blue,strokeWidth:4});
      sticker('outline-box',77,646,333,294,{badgeColor:blue,strokeWidth:4});
      text('OH WOW',625,30,27,{font:'Arial Black, Arial',weight:900,color:'#fff',backgroundColor:blue,backgroundPaddingX:17,backgroundPaddingY:9});
      text("WHO’S THIS?",246,609,22,{font:'Arial Black, Arial',weight:900,color:'#fff',backgroundColor:blue,backgroundPaddingX:13,backgroundPaddingY:8});
      text('COOLEST',532,578,28,{font:'Arial Black, Arial',weight:900,color:'#fff',backgroundColor:blue,backgroundPaddingX:2,backgroundPaddingY:0});
      [[779,267,43],[387,469,36],[57,596,46],[788,1020,48],[64,1112,36]].forEach(([x,y,size],i)=>text(i===2?'↻':i===3?'js':'!!!',x,y,size,{font:i===2||i===3?'Impact, Arial Black':'Arial, sans-serif',weight:i===2||i===3?900:700,letterSpacing:i===2||i===3?0:2,color:'#fff',backgroundColor:blue,backgroundPaddingX:10,backgroundPaddingY:4}));
      sticker('computer',766,580,109,95,{badgeColor:'#acf2fa',color:blue});
      sticker('retro-window',33,1106,232,94,{badgeColor:'#101c87',content:'ABC To: F\nDo you still think\nof me every day?',size:16,color:'#1e2391'});
      sticker('recycle-bin',710,1044,158,147,{badgeColor:'#75aaff'});
    }
    const name=index===6?'After Hours Album':'Electric Blue Archive';
    state.selected=null;state.remixInfo={anchorZh:'排版 REMIX ['+(index+1)+'/'+layoutRemixList.length+'] · '+name,anchorEn:name,mainLayoutZh:index===6?'暗色相册 · 三张错落照片':'黑白双人像 · 电蓝索引框',mainLayoutEn:name,typographyZh:index===6?'白色手写标注与箭头':'复古窗口与蓝色标签',typographyEn:'Photo diary / editable graphics',backgroundZh:index===6?'暖暗满版照片':'纯白桌面',backgroundEn:index===6?'Warm photo backdrop':'White desktop',strengthZh:userMode?'用户照片拼贴':'自有图库多图示范',strengthEn:'Local library collage',isManuallyEdited:false};
    emptyState.classList.add('is-hidden');renderImageTray();renderInspector();render();
    if(isReset){history=[];historyIndex=-1;}commit();updateRemixCard();updateMasterRemixControls();
    if(zoomMode==='fit')requestAnimationFrame(fitWorkspace);motion.play(previousPoster);if(showToast)toast(toastMsg || '排版 REMIX ['+(index+1)+'/'+layoutRemixList.length+'] · '+name);
  }
  const layoutRemixList = [
    { id: 'layout-01', nameZh: 'Aespa 电光档案构图', apply: applyLayoutTemplate01 },
    { id: 'layout-02', nameZh: '图像选区采样 7 选构图', apply: applyLayoutTemplate02 },
    { id: 'layout-03', nameZh: '蓝色情绪拼贴构图', apply: applyLayoutTemplate03 },
    { id: 'layout-04', nameZh: '粉色桌面拼贴构图', apply: applyLayoutTemplate04 },
    { id: 'layout-05', nameZh: 'Photo Booth 照片桌面构图', apply: (...args)=>applyLayoutDesktop(4,...args) },
    { id: 'layout-06', nameZh: 'AirDrop 照片日记构图', apply: (...args)=>applyLayoutDesktop(5,...args) },
    { id: 'layout-07', nameZh: '夜晚相册叙事构图', apply: (...args)=>applyLayoutNarrative(6,...args) },
    { id: 'layout-08', nameZh: '电蓝黑白档案构图', apply: (...args)=>applyLayoutNarrative(7,...args) }
  ];

  const masterRemixList = [
    { nameZh: 'Aespa 电光档案', shortZh: 'Aespa 电光', layoutIdx: 0, filterIdx: 0 },
    { nameZh: '图像特效搭配 7 选', shortZh: '特效 7 选', layoutIdx: 1, filterIdx: 1 },
    { nameZh: '蓝色情绪拼贴', shortZh: 'Blue Valentine', layoutIdx: 2, filterIdx: 2 },
    { nameZh: '粉色桌面拼贴', shortZh: 'Pink Desktop', layoutIdx: 3, filterIdx: 3 },
    { nameZh: 'Photo Booth 照片桌面', shortZh: 'Photo Booth', layoutIdx: 4, filterIdx: 4 },
    { nameZh: 'AirDrop 照片日记', shortZh: 'AirDrop Diary', layoutIdx: 5, filterIdx: 5 },
    { nameZh: '夜晚相册叙事', shortZh: 'After Hours Album', layoutIdx: 6, filterIdx: 6 },
    { nameZh: '电蓝黑白档案', shortZh: 'Electric Blue Archive', layoutIdx: 7, filterIdx: 7 }
  ];

  let currentLayoutIndex = 0;
  let currentFilterIndex = 0;
  let currentMasterIndex = -1;
  let historyTransactionDepth = 0;

  function updateMasterRemixControls() {
    const total = masterRemixList.length;
    const m = masterRemixList[currentMasterIndex];
    if (state.image) {
      status.textContent = 'LAYOUT [' + (currentLayoutIndex + 1) + '/' + layoutRemixList.length + '] · '
        + (state.imageName || layoutRemixList[currentLayoutIndex]?.nameZh || 'IMAGE').toUpperCase();
    }
    const dockSub = document.querySelector('#posterMasterRemixSub');
    const dockTag = document.querySelector('#posterMasterRemixTag');
    const toplineText = document.querySelector('#posterMasterRemixToplineText');
    document.querySelectorAll('[data-poster-action="master-remix"]').forEach(button => {
      button.title = `总 REMIX：保留当前图片，切换 ${total} 组模板的排版与滤镜`;
    });
    if (dockSub) dockSub.textContent = m
      ? `保留当前图片 · 排版 0${m.layoutIdx + 1} + 滤镜 0${m.filterIdx + 1}`
      : masterRemixList.map((item, idx) => `[${idx + 1}/${total}] ${item.shortZh}`).join(' + ');
    if (dockTag) dockTag.textContent = m ? `[${currentMasterIndex + 1}/${total}] ↻` : `${total} 组全套 ↻`;
    if (toplineText) toplineText.textContent = m ? `[${currentMasterIndex + 1}/${total}] ${m.shortZh}` : `${total} 组全套轮播`;
  }

  function cycleLayoutRemix() {
    if (!state.image) { toast('请先上传图片，或选择一组示范作品。'); return; }
    const total = layoutRemixList.length;
    currentLayoutIndex = (currentLayoutIndex + 1) % total;
    const item = layoutRemixList[currentLayoutIndex];
    item?.apply(null, false, true, `📐 排版 REMIX [${currentLayoutIndex + 1}/${total}]：${item.nameZh}`);
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
    if(index>=6 && typeof window!=='undefined' && window.posterCutout?.removeBackground && !narrativeReady(index,isReset)){
      prepareNarrative(()=>applyMasterRemixByIndex(index,images,isReset,customMsg),index,isReset);return;
    }
    if(index>=3 && index<=5 && typeof window!=='undefined' && window.posterCutout?.removeBackground && !pinkDesktopReady(isReset,index===5)){
      preparePinkDesktop(()=>applyMasterRemixByIndex(index,images,isReset,customMsg),isReset,'模板'+(index+1),index===5);return;
    }
    // Flush a pending adjustment before the composed layout + filter operation.
    commit();
    const total = masterRemixList.length;
    const resolvedIndex = ((index % total) + total) % total;
    const m = masterRemixList[resolvedIndex];
    currentMasterIndex = resolvedIndex;
    currentLayoutIndex = m.layoutIdx;
    currentFilterIndex = m.filterIdx;

    // One snapshot for the composed operation, rather than two intermediate transitions.
    const previousPoster = motion.capture();
    historyTransactionDepth++;
    try {
      layoutRemixList[m.layoutIdx].apply(images, isReset, false);
      filterRemixList[m.filterIdx].apply(false);
    } finally {
      historyTransactionDepth--;
    }
    updateMasterRemixControls();
    commit();
    motion.play(previousPoster);

    const isUserMode = !isReset && !!state.image;
    const resolvedToast = customMsg || (isUserMode
      ? `⚡ 总 REMIX [${resolvedIndex + 1}/${total}] 已生效：已为您的图片应用模板 0${resolvedIndex + 1} (${m.nameZh})`
      : `⚡ 总 REMIX [${resolvedIndex + 1}/${total}] 已生效：${m.nameZh} (排版 0${m.layoutIdx + 1} + 滤镜 0${m.filterIdx + 1})`);
    toast(resolvedToast);
  }

  function cycleMasterRemix() {
    if (!state.image) { toast('请先上传图片，或选择一组示范作品。'); return; }
    const nextIndex = (currentMasterIndex + 1 + masterRemixList.length) % masterRemixList.length;
    applyMasterRemixByIndex(nextIndex, null, false);
  }

  function applyTemplate01(images, isReset = false, toastMsg = '') {
    applyMasterRemixByIndex(0, images, isReset, toastMsg);
  }

  function applyTemplate02(images, isReset = false, toastMsg = '') {
    applyMasterRemixByIndex(1, images, isReset, toastMsg);
  }

  function applyDemo(image) {
    ensureKarinaMultiAssets(images => {
      applyMasterRemixByIndex(0, images, true);
    });
  }

  function loadDemo(show = true) {
    if (show && (hasUserUploadedImages() || hasSecondaryImages() || state.remixInfo?.isManuallyEdited || history.length > 1) && !window.confirm('恢复示范模板会替换当前海报及历史记录。确定恢复吗？')) return;
    if(show && typeof draftHasEdits !== 'undefined') draftHasEdits=true;
    ensureKarinaMultiAssets(images => {
      if (!show && hasUserUploadedImages()) return;
      applyMasterRemixByIndex(0, images, true, show ? '示范模板已恢复为 Aespa 多图精选档案。' : '');
    });
  }

  function loadDemo02(show = true) {
    if (show && (hasUserUploadedImages() || hasSecondaryImages() || state.remixInfo?.isManuallyEdited || history.length > 1) && !window.confirm('切换示范模板会替换当前海报及历史记录。确定切换吗？')) return;
    if(show && typeof draftHasEdits !== 'undefined') draftHasEdits=true;
    ensureModelTechwearAsset(() => {
      if (!show && hasUserUploadedImages()) return;
      applyMasterRemixByIndex(1, null, true, show ? '已切换至示范模板 02：先锋暗调机能拆解。' : '');
    });
  }

  function loadDemo03(show = true) {
    if (show && (hasUserUploadedImages() || hasSecondaryImages() || state.remixInfo?.isManuallyEdited || history.length > 1)
      && !window.confirm('切换示范模板会替换当前海报及历史记录。确定切换吗？')) return;
    if(show && typeof draftHasEdits !== 'undefined') draftHasEdits=true;
    const requestedScene = snapshot();
    ensureBlueValentineAssets(() => {
      if (snapshot() !== requestedScene) {toast('作品已修改，未替换成示范。');return;}
      if (!show && hasUserUploadedImages()) return;
      applyMasterRemixByIndex(2,null,true,show ? '示范 03 · 蓝色情绪拼贴' : '');
    });
  }
  function loadDemo04(show=true) {
    if(show && (hasUserUploadedImages() || hasSecondaryImages() || state.remixInfo?.isManuallyEdited || history.length>1)
      && !window.confirm('切换示范模板会替换当前海报及历史记录。确定切换吗？'))return;
    if(show)draftHasEdits=true;
    preparePinkDesktop(()=>applyMasterRemixByIndex(3,null,true,show?'示范 04 · 粉色桌面拼贴':''),true);
  }
  function loadDemoDesktop(index,show=true) {
    if(show && (hasUserUploadedImages() || hasSecondaryImages() || state.remixInfo?.isManuallyEdited || history.length>1)
      && !window.confirm('切换示范模板会替换当前海报及历史记录。确定切换吗？'))return;
    if(show)draftHasEdits=true;
    const apply=()=>applyMasterRemixByIndex(index,null,true,'示范 0'+(index+1)+' · '+masterRemixList[index].shortZh);
    if(index>=6)prepareNarrative(apply,index,true);else preparePinkDesktop(apply,true,'模板'+(index+1),index===5);
  }
  const layoutTemplates = [
    { id: 'template-01-richman', nameZh: '模板 01 · Aespa 电光档案', apply: applyLayoutTemplate01 },
    { id: 'template-02-ps7', nameZh: '模板 02 · 图像特效搭配 7 选', apply: applyLayoutTemplate02 },
    { id: 'template-03-blue-valentine', nameZh: '模板 03 · 蓝色情绪拼贴', apply: applyLayoutTemplate03 },
    { id: 'template-04-pink-desktop', nameZh: '模板 04 · 粉色桌面拼贴', apply: applyLayoutTemplate04 },
    { id: 'template-05-photo-booth', nameZh: '模板 05 · Photo Booth 照片桌面', apply: (...args)=>applyLayoutDesktop(4,...args) },
    { id: 'template-06-airdrop-diary', nameZh: '模板 06 · AirDrop 照片日记', apply: (...args)=>applyLayoutDesktop(5,...args) },
    { id: 'template-07-after-hours', nameZh: '模板 07 · 夜晚相册叙事', apply: (...args)=>applyLayoutNarrative(6,...args) },
    { id: 'template-08-electric-blue', nameZh: '模板 08 · 电蓝黑白档案', apply: (...args)=>applyLayoutNarrative(7,...args) }
  ];

  function applyLayoutTemplate(templateId) {
    if (!templateId) {
      cycleLayoutRemix();
      return true;
    }
    const idx = layoutRemixList.findIndex((item, index) => item.id === templateId
      || layoutTemplates[index]?.id === templateId || item.nameZh === templateId
      || layoutTemplates[index]?.nameZh === templateId);
    if (idx === -1) {
      toast(`未找到排版模板：${templateId}`);
      return false;
    }
    currentLayoutIndex = idx;
    layoutRemixList[idx].apply(null, false, true);
    return true;
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

  function renderExportCanvas(width, height) {
    const out = document.createElement('canvas');
    out.width = width; out.height = height;
    const previousContext = ctx, previousScale = renderScale, previousBefore = isBeforePreviewActive;
    // Use a readback surface for repeatable image and gradient-text exports.
    const exportContext = out.getContext('2d', {willReadFrequently:true});
    if (!exportContext) throw new Error('无法创建高清导出画布。');
    ctx = exportContext;
    renderScale = width / W;
    isBeforePreviewActive = false;
    exportContext.save();
    try {
      exportContext.scale(width / W, height / H);
      render(false);
      return out;
    } finally {
      exportContext.restore();
      ctx = previousContext;
      renderScale = previousScale;
      isBeforePreviewActive = previousBefore;
    }
  }
  function exportPoster() {
    if (!state.image) return toast('请先上传主图。');
    try {
      const [targetW, targetH] = state.exportResolution || [1200, 1600];
      const out = renderExportCanvas(targetW, targetH);
      const link = document.createElement('a');
      link.download = `collage-poster-${targetW}x${targetH}-${Date.now()}.png`;
      link.href = out.toDataURL('image/png');
      const savedExport = $('#posterLastExportLink');
      if (savedExport) {
        savedExport.href = link.href;
        savedExport.download = link.download;
        savedExport.textContent = `保存刚导出的 PNG · ${targetW} × ${targetH}`;
        savedExport.hidden = false;
      }
      link.click();
      render();
      toast(`PNG 海报已导出 · ${targetW} × ${targetH}`);
    } catch(e) {
      render();
      console.error(e);
      toast('导出失败，请通过 localhost 打开或重新上传图片。');
    }
  }

  document.querySelectorAll('.poster-tools, .poster-action-dock').forEach(node => node.addEventListener('click', (e) => {
    const targetItem = e.target.closest('[data-poster-action]');
    const a = targetItem?.dataset.posterAction, elemId = targetItem?.dataset.id;
    if (!a) return;
    if (a === 'demo') loadDemo();
    if (a === 'demo-02') loadDemo02();
    if (a === 'demo-03') loadDemo03();
    if (a === 'demo-04') loadDemo04();
    if (a === 'demo-05') loadDemoDesktop(4);
    if (a === 'demo-06') loadDemoDesktop(5);
    if (a === 'demo-07') loadDemoDesktop(6);
    if (a === 'demo-08') loadDemoDesktop(7);
    if (a === 'frame') addFrame();
    if (a === 'detail') addDetail();
    if (a === 'connector') toast('每张局部图已自动拥有连接线。');
    if (a === 'undo') undo();
    if (a === 'redo') redo();
    if (a === 'duplicate') duplicateSelected();
    if (a === 'master-remix') { triggerMasterRemix(); return; }
    if (a === 'filter-remix') { remixFilters(); return; }
    if (a === 'remix') remixLayout($('#posterRemixStrength')?.value || 'medium');
    if (a === 'cutout-current' || a === 'cutout-restore') {
      if (cutoutBusy) return;
      if (!state.image) { toast('请先上传一张人像照片。'); return; }
      const type = state.selected?.type;
      if (['main','secondary'].includes(type) && selectedObject()) setSelected(type, selectedObject());
      else setSelected('main', state.main);
      const object = selectedObject(), asset = imageAssets.get(state.selected.type === 'secondary' ? object.imageId : state.mainImageId);
      const enabled = !!(object.cutout && asset?.cutoutImage);
      if (a === 'cutout-current' ? !enabled : enabled) togglePersonCutout();
      return;
    }
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
  }));
  $('.poster-tools').addEventListener('input', handleInspectorInput);
  $('.poster-tools').addEventListener('change', handleInspectorInput);
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
        scheduleDraftSave();
        toast(`海报导出分辨率已设为 ${w} × ${h} (${tag})`);
      }
    });
  }
  function handleInspectorInput(e) {
    const c = e.target; let p = c.dataset.prop || c.dataset.global;
    if (!p) return;
    let root = c.dataset.global ? (inspectorFilterKeys.has(p) || p in state.filters ? state.filters : state) : selectedObject();
    if (p === 'paperEnabled') {state.posterPaper=c.checked?{x:124,y:98,w:652,h:1002,color:'#fafaff',headerColor:'#3152ed',headerH:178}:null;renderInspector();render();commit();markManuallyEdited();return;}
    if (p.startsWith('paper_')) {root=state.posterPaper;p=p.slice(6);}
    if (!root) return;
    if (p === 'backgroundEnabled' && c.checked && !root.backgroundColor) root.backgroundColor='#3152ed';

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

    if (p === 'bw' && c.dataset.global) {
      const val = Number(c.value);
      state.filters.bw = val;
      if (val < 100 && (state.filters.saturation === 0 || !state.filters.saturation)) {
        state.filters.saturation = 100;
        const satInput = inspector.querySelector('input[data-global="saturation"]');
        if (satInput) {
          satInput.value = 100;
          const satOut = satInput.closest('.poster-field')?.querySelector('output');
          if (satOut) satOut.textContent = '100';
        }
      }
      scheduleRender();
      const out = c.closest('.poster-field')?.querySelector('output');
      if (out) out.textContent = c.value;
      commit(false);
      markManuallyEdited();
      return;
    }

    if (p === 'saturation' && c.dataset.global) {
      const val = Number(c.value);
      state.filters.saturation = val;
      if (val > 0 && state.filters.bw === 100) {
        state.filters.bw = 0;
        const bwInput = inspector.querySelector('input[data-global="bw"]');
        if (bwInput) {
          bwInput.value = 0;
          const bwOut = bwInput.closest('.poster-field')?.querySelector('output');
          if (bwOut) bwOut.textContent = '0';
        }
      }
      scheduleRender();
      const out = c.closest('.poster-field')?.querySelector('output');
      if (out) out.textContent = c.value;
      commit(false);
      markManuallyEdited();
      return;
    }

    if (state.selected?.type === 'secondary' && !c.dataset.global) {
      if (p === 'imageId') {
        if (root.imageId === c.value || !imageAssets.has(c.value) || !state.assets.some(a=>a.id===c.value)) return;
        root.imageId = c.value; root.cutout = false;
        renderImageTray(); renderInspector(); render(); commit(); markManuallyEdited();
        return;
      }
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
      if (inspectorFilterKeys.has(p)) {
        if (!root.filters) root.filters = cleanFilters();
        root = root.filters;
      }
    }
    if (c.type === 'number' && (c.value === '' || !Number.isFinite(c.valueAsNumber))) return;
    root[p] = c.type === 'checkbox' ? c.checked : (c.type === 'range' || c.type === 'number' ? Number(c.value) : c.value);
    if (['duotone','motionDistance','grain','windowFrame','backgroundEnabled','textStyle'].includes(p)) syncInspectorDependencies();
    if (['w', 'h'].includes(p)) root[p] = Math.max(20, root[p]);
    if (['x','y','w','h','rotation'].includes(p)) {
      if (state.selected?.type === 'secondary' || state.selected?.type === 'main') {
        syncAllChildFramesOf(root.id);
      } else if (state.selected?.type === 'frame') {
        syncFrameRelativeToParent(root);
      }
    }
    if (p === 'filterType') {
      const strengthKey = c.dataset.global || state.selected?.type === 'secondary' ? 'halftone' : 'halftoneStrength';
      if (['color_halftone','dot_halftone','circle_halftone','line_halftone','halftone'].includes(root.filterType) && (root[strengthKey] ?? 0) === 0) {
        root[strengthKey] = 75;
      } else if (root.filterType === 'original') {
        root[strengthKey] = 0;
      }
      if (['duotone','gradient_map'].includes(root.filterType)) root.duotone = true;
      renderInspector();
    }
    if (p === 'bitmapMethod' || p === 'backgroundStyle') renderInspector();
    scheduleRender();
    const out = c.closest('.poster-field')?.querySelector('output');
    if (out) out.textContent = c.value;
    commit(false);
    markManuallyEdited();
  }
  inspector.addEventListener('click', e => {
    const tab = e.target.closest('[data-inspector-tab]');
    if (tab && tab.dataset.inspectorTab !== inspectorTab) {
      inspectorTab=tab.dataset.inspectorTab; renderInspector();
      inspector.querySelector('[aria-selected="true"]').focus({preventScroll:true});
      motion.reveal(inspector.querySelector('[data-inspector-pane]:not([hidden])'));
    }
  });
  inspector.addEventListener('keydown', e => {
    const tab = e.target.closest('[data-inspector-tab]');
    if (!tab || !['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return;
    e.preventDefault();
    const tabs = Array.from(inspector.querySelectorAll('[data-inspector-tab]'));
    const index = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (tabs.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[index].click();
  });
  inspector.addEventListener('change', e => {
    if (e.target.id==='posterInspectorEffect') { inspectorEffect=e.target.value; renderInspector(); }
    if (e.target.id==='posterInspectorTarget') {
      const value=e.target.value;
      if (value==='canvas') setSelected(null,null);
      else {
        const split=value.indexOf(':'), type=value.slice(0,split), id=value.slice(split+1);
        const lists={main:[state.main],secondary:state.secondaries,fragment:state.fragments,frame:state.frames,detail:state.details,text:state.texts,connector:state.details};
        const object=lists[type]?.find(item=>item.id===id);if(object)setSelected(type,object);
      }
      render();
    }
  });
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
    if (a === 'cutout') { togglePersonCutout(); return; }
    if (a === 'reset-filters') {
      state.filters = cleanFilters();
      state.mainEdgeFade = 0;
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
          state.main.cutout = false;
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
              sec.cutout = false;
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
              state.main.cutout = false;
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
          newlyLoaded[index] = { id, name: file.name, image, src: reader.result, origin:'upload' };
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
    if (e.pointerType !== 'touch' && $('#posterWorkspace').dataset.motion === 'on' && !drag && !pan) {
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
    finishCanvasDrag();
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

  window.addEventListener('beforeunload',e=>{if(draftDirty){e.preventDefault();e.returnValue='';}});
  $('#posterSaveDraftButton')?.addEventListener('click',()=>{saveDraftNow();});
  window.posterSaveDraft = saveDraftNow;
  window.posterDraftPending = () => draftDirty;
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
  window.posterApplyTemplate02 = applyTemplate02;
  window.posterLoadDemo = loadDemo;
  window.posterLoadDemo02 = loadDemo02;
  window.posterLoadDemo03 = loadDemo03;
  window.posterApplyLayoutTemplate03 = applyLayoutTemplate03;
  window.posterApplyFilterTemplate03 = applyFilterTemplate03;
  window.posterApplyLayoutTemplate01 = applyLayoutTemplate01;
  window.posterApplyFilterTemplate01 = applyFilterTemplate01;
  window.posterApplyLayoutTemplate02 = applyLayoutTemplate02;
  window.posterApplyFilterTemplate02 = applyFilterTemplate02;
  Object.defineProperty(window, 'posterHistory', { get: () => history, configurable: true });
  window.posterSyncAllChildFramesOf = syncAllChildFramesOf;
  window.posterRender = render;
  renderInspector();render();initializePoster();requestAnimationFrame(fitWorkspace);updateRemixCard();setupPosterResizers();
})();
