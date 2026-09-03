// Yongyong Visual Lab — deliberately written without frameworks.
// Read this file in this order: STATE → RENDER → EVENTS → EXPORT.

const $ = (selector) => document.querySelector(selector);

// file:// pages and older browsers may not expose crypto.randomUUID().
const makeId = () => window.crypto?.randomUUID?.() ?? `layer-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const ui = {
  canvas: $("#previewCanvas"),
  dropZone: $("#dropZone"),
  imageInput: $("#imageInput"),
  backgroundImageInput: $("#backgroundImageInput"),
  recipeInput: $("#recipeInput"),
  layerList: $("#layerList"),
  recipeName: $("#recipeName"),
  imageStatus: $("#imageStatus"),
  toast: $("#toast"),
};

const ctx = ui.canvas.getContext("2d", { alpha: false });

const BLEND_MODES = {
  normal: "source-over",
  "soft-light": "soft-light",
  overlay: "overlay",
  color: "color",
  "color-dodge": "color-dodge",
  "hard-light": "hard-light",
  darken: "darken",
  hue: "hue",
  multiply: "multiply",
  screen: "screen",
};

const BLEND_LABELS = {
  normal: "Normal",
  "soft-light": "Soft Light",
  overlay: "Overlay",
  color: "Color",
  "color-dodge": "Color Dodge",
  "hard-light": "Hard Light",
  darken: "Darken",
  hue: "Hue",
  multiply: "Multiply",
  screen: "Screen",
};

const CARD_ARTBOARDS = {
  "3:4": [900, 1200],
  "1:1": [1200, 1200],
  "2:3": [900, 1350],
  "16:9": [1600, 900],
};

const EXPORT_PRESETS = {
  "3:4": [
    [1080, 1440, "社媒"], [1500, 2000, "高清"], [768, 1024, "1K"],
    [1536, 2048, "2K"], [2304, 3072, "3K"], [3072, 4096, "4K"],
  ],
  "1:1": [[1080, 1080, "社媒"], [1024, 1024, "1K"], [2048, 2048, "2K"], [3072, 3072, "3K"], [4096, 4096, "4K"]],
  "2:3": [[1000, 1500, "社媒"], [683, 1024, "1K"], [1365, 2048, "2K"], [2048, 3072, "3K"], [2731, 4096, "4K"]],
  "16:9": [[1920, 1080, "Full HD"], [1024, 576, "1K"], [2048, 1152, "2K"], [3072, 1728, "3K"], [4096, 2304, "4K"]],
};

const BLOOM_LAYERS = [
  { id: makeId(), color: "#F58F9B", mode: "soft-light", opacity: 40, visible: true },
  { id: makeId(), color: "#F3B8D4", mode: "color-dodge", opacity: 39, visible: true },
  { id: makeId(), color: "#C7DCF4", mode: "color", opacity: 32, visible: true },
  { id: makeId(), color: "#FFF9F1", mode: "normal", opacity: 20, visible: true },
];

// These presets use only solid-color layers. Camera-named entries are visual
// directions inspired by those looks, not replacements for in-camera profiles.
const COLOR_PRESETS = {
  bloom: {
    label: "Bloom 柔雾",
    note: "粉色柔光、浅粉颜色减淡与淡蓝综合色偏。",
    layers: BLOOM_LAYERS,
  },
  "canon-portrait": {
    label: "Canon 人像暖肤 · 灵感",
    note: "轻暖肤色、奶油高光，保留自然反差。",
    layers: [
      { color: "#F1A58F", mode: "soft-light", opacity: 18 },
      { color: "#FFE7CA", mode: "screen", opacity: 9 },
      { color: "#D9B8A6", mode: "color", opacity: 7 },
    ],
  },
  "fuji-classic-chrome": {
    label: "Fuji Classic Chrome · 灵感",
    note: "低饱和、冷灰阴影与克制的暖高光。",
    layers: [
      { color: "#9FB3B3", mode: "color", opacity: 18 },
      { color: "#5F6767", mode: "soft-light", opacity: 16 },
      { color: "#E2D5C3", mode: "soft-light", opacity: 8 },
    ],
  },
  "fuji-nostalgic-neg": {
    label: "Fuji Nostalgic Neg. · 灵感",
    note: "琥珀暖高光配一点青灰阴影，偏怀旧印刷感。",
    layers: [
      { color: "#D7A36A", mode: "soft-light", opacity: 24 },
      { color: "#6E8790", mode: "color", opacity: 10 },
      { color: "#F3D4AA", mode: "screen", opacity: 8 },
    ],
  },
  "fuji-acros": {
    label: "Fuji ACROS 黑白 · 灵感",
    note: "灰色综合色彩并加深层次，模拟细腻黑白反差。",
    layers: [
      { color: "#808080", mode: "color", opacity: 100 },
      { color: "#2C2C2C", mode: "soft-light", opacity: 28 },
      { color: "#F2F0E9", mode: "screen", opacity: 6 },
    ],
  },
  "ref-yellow-flash": {
    label: "黄油闪光粉",
    note: "按参考图方向：黄调压暗、奶油柔光、粉色强光。",
    layers: [
      { color: "#FFE89A", mode: "multiply", opacity: 75 },
      { color: "#FFF8D8", mode: "soft-light", opacity: 31 },
      { color: "#F3A6C4", mode: "hard-light", opacity: 65 },
    ],
  },
  "ref-candy-pink": {
    label: "糖果高亮粉",
    note: "按参考图方向：高纯度玫粉与白色柔光叠加。",
    layers: [
      { color: "#FF5BAD", mode: "soft-light", opacity: 73 },
      { color: "#FFFFFF", mode: "soft-light", opacity: 100 },
    ],
  },
  "ref-sakura-pink": {
    label: "樱花旧相机",
    note: "按参考图方向：淡粉柔光、玫粉色相与轻微泛白。",
    layers: [
      { color: "#F5D4E1", mode: "soft-light", opacity: 55 },
      { color: "#FF5D9E", mode: "hue", opacity: 65 },
      { color: "#FFF7F3", mode: "screen", opacity: 18 },
    ],
  },
};

const ATMOSPHERE_PRESETS = {
  clean: { motionBlur: 0, motionAngle: 0, noiseAmount: 0, noiseSize: 1 },
  motion: { motionBlur: 6.5, motionAngle: -12, noiseAmount: 4, noiseSize: 1 },
  grain: { motionBlur: 0, motionAngle: 0, noiseAmount: 18, noiseSize: 1 },
  mixed: { motionBlur: 3.5, motionAngle: 8, noiseAmount: 12, noiseSize: 2 },
};

function instantiatePresetLayers(layers) {
  return layers.map(({ color, mode, opacity }) => ({ id: makeId(), color, mode, opacity, visible: true }));
}

// STATE: the whole app is described by one small object.
const state = {
  name: "bloom study",
  image: null,
  fileName: "",
  cardStyle: "pink-dot",
  backgroundColor: "#F6F6F2",
  backgroundImage: null,
  backgroundDataUrl: null,
  backgroundFileName: "",
  photoRatio: "four-five",
  photoScale: 1,
  crop: { zoom: 1, x: 0, y: 0 },
  layout: {
    before: { x: 0, y: 0 },
    after: { x: 0, y: 0 },
    panel: { x: 0, y: 0 },
    arrow: { x: 0, y: 0 },
  },
  cardRatio: "3:4",
  exportSize: { width: 1080, height: 1440 },
  showTitle: true,
  showArrows: true,
  showLabels: false,
  swapPhotos: false,
  effects: { ...ATMOSPHERE_PRESETS.clean },
  layers: structuredClone(BLOOM_LAYERS), // bottom layer first
};

function createDemoImage() {
  const image = new Image();
  image.onload = () => {
    state.image = image;
    state.fileName = "demo-karina.jpg";
    ui.dropZone.classList.remove("is-empty");
    ui.imageStatus.textContent = `预设照片 · ${image.naturalWidth} × ${image.naturalHeight} · 可随时替换`;
    renderPreview();
  };
  image.onerror = () => {
    ui.dropZone.classList.add("is-empty");
    ui.imageStatus.textContent = "预设照片未找到 · 请上传照片";
  };
  image.src = "assets/demo-karina.jpg";
}

// RENDER: draw image with a centered "cover" crop, then blend solid-color layers.
function drawCover(targetCtx, image, x, y, width, height, crop = state.crop) {
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const boxRatio = width / height;
  let sourceWidth = image.naturalWidth;
  let sourceHeight = image.naturalHeight;
  let sourceX = 0;
  let sourceY = 0;

  if (imageRatio > boxRatio) {
    sourceWidth = image.naturalHeight * boxRatio;
  } else {
    sourceHeight = image.naturalWidth / boxRatio;
  }

  // A perfectly matching image/frame ratio has no spare pixels to pan at 100%.
  // Add a small, proportional overscan only while the user pans, so X/Y always respond.
  const panAmount = Math.max(Math.abs(crop.x), Math.abs(crop.y)) / 100;
  const effectiveZoom = crop.zoom * (1 + panAmount * 0.24);
  sourceWidth /= effectiveZoom;
  sourceHeight /= effectiveZoom;
  const horizontalRoom = (image.naturalWidth - sourceWidth) / 2;
  const verticalRoom = (image.naturalHeight - sourceHeight) / 2;
  sourceX = horizontalRoom + horizontalRoom * (crop.x / 100);
  sourceY = verticalRoom + verticalRoom * (crop.y / 100);

  targetCtx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function applyLayers(targetCtx, layers, x, y, width, height) {
  for (const layer of layers) {
    if (!layer.visible) continue;
    targetCtx.save();
    targetCtx.globalCompositeOperation = BLEND_MODES[layer.mode] ?? "source-over";
    targetCtx.globalAlpha = layer.opacity / 100;
    targetCtx.fillStyle = layer.color;
    targetCtx.fillRect(x, y, width, height);
    targetCtx.restore();
  }
}

function applyMotionBlur(targetCtx, width, height, effects) {
  if (effects.motionBlur <= 0) return;
  const snapshot = document.createElement("canvas");
  snapshot.width = width;
  snapshot.height = height;
  snapshot.getContext("2d").drawImage(targetCtx.canvas, 0, 0, width, height);
  const radians = effects.motionAngle * Math.PI / 180;
  const distance = Math.min(width, height) * (effects.motionBlur / 10) * .045;
  const samples = 10;
  targetCtx.save();
  targetCtx.globalAlpha = .075;
  for (let index = 1; index <= samples; index += 1) {
    const offset = (index / samples - .5) * distance * 2;
    targetCtx.drawImage(snapshot, Math.cos(radians) * offset, Math.sin(radians) * offset, width, height);
  }
  targetCtx.restore();
}

const noiseTiles = new Map();
function getNoiseTile(size) {
  if (noiseTiles.has(size)) return noiseTiles.get(size);
  const baseSize = 96;
  const base = document.createElement("canvas");
  base.width = base.height = baseSize;
  const baseCtx = base.getContext("2d");
  const pixels = baseCtx.createImageData(baseSize, baseSize);
  let seed = 9137;
  for (let index = 0; index < pixels.data.length; index += 4) {
    seed = (seed * 16807) % 2147483647;
    const value = seed % 2 ? 255 : 0;
    pixels.data[index] = value;
    pixels.data[index + 1] = value;
    pixels.data[index + 2] = value;
    pixels.data[index + 3] = 72 + (seed % 70);
  }
  baseCtx.putImageData(pixels, 0, 0);
  if (size === 1) {
    noiseTiles.set(size, base);
    return base;
  }
  const scaled = document.createElement("canvas");
  scaled.width = scaled.height = baseSize * size;
  const scaledCtx = scaled.getContext("2d");
  scaledCtx.imageSmoothingEnabled = false;
  scaledCtx.drawImage(base, 0, 0, scaled.width, scaled.height);
  noiseTiles.set(size, scaled);
  return scaled;
}

function applyNoise(targetCtx, x, y, width, height, effects) {
  if (effects.noiseAmount <= 0) return;
  targetCtx.save();
  targetCtx.beginPath();
  targetCtx.rect(x, y, width, height);
  targetCtx.clip();
  targetCtx.globalCompositeOperation = "soft-light";
  targetCtx.globalAlpha = (effects.noiseAmount / 35) * .72;
  targetCtx.fillStyle = targetCtx.createPattern(getNoiseTile(effects.noiseSize), "repeat");
  targetCtx.fillRect(x, y, width, height);
  targetCtx.restore();
}

function renderImage(targetCtx, image, x, y, width, height, withFilter = true) {
  targetCtx.save();
  targetCtx.beginPath();
  targetCtx.rect(x, y, width, height);
  targetCtx.clip();
  drawCover(targetCtx, image, x, y, width, height);
  if (withFilter) applyLayers(targetCtx, state.layers, x, y, width, height);
  targetCtx.restore();
}

function drawDotBackground(targetCtx, background, dotColor, width, height, spacing = 52, radius = 7) {
  targetCtx.fillStyle = background;
  targetCtx.fillRect(0, 0, width, height);
  if (!dotColor) return;
  targetCtx.fillStyle = dotColor;
  for (let y = 18; y < height; y += spacing) {
    for (let x = 20; x < width; x += spacing) {
      targetCtx.beginPath();
      targetCtx.arc(x, y, radius, 0, Math.PI * 2);
      targetCtx.fill();
    }
  }
}

function drawPresetBackground(targetCtx, style, width, height) {
  if (style === "pink-dot") return drawDotBackground(targetCtx, "#F5DCE6", "#372521", width, height);
  if (style === "gray-dot") return drawDotBackground(targetCtx, "#FAF8F9", "#DEDCDF", width, height);
  if (style === "yellow-dot") return drawDotBackground(targetCtx, "#FFE7A3", "#FFFFFF", width, height, 56, 8);
  if (style === "blush-dot") return drawDotBackground(targetCtx, "#F9E9EF", "#EACDD8", width, height, 62, 7);
  if (style === "candy-gradient") {
    const gradient = targetCtx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#FFF9FC");
    gradient.addColorStop(.48, "#F8DDEB");
    gradient.addColorStop(1, "#F2AFD3");
    drawDotBackground(targetCtx, gradient, "rgba(238, 103, 167, .42)", width, height, 56, 7);
    return;
  }
  if (style === "checker") {
    const size = 64;
    targetCtx.fillStyle = "#FFF0D8";
    targetCtx.fillRect(0, 0, width, height);
    targetCtx.fillStyle = "#F4D2DC";
    for (let y = 0; y < height; y += size) {
      for (let x = 0; x < width; x += size) {
        if ((x / size + y / size) % 2 === 0) targetCtx.fillRect(x, y, size, size);
      }
    }
    return;
  }
  if (style === "grid") {
    targetCtx.fillStyle = "#F5F2EA";
    targetCtx.fillRect(0, 0, width, height);
    targetCtx.strokeStyle = "rgba(135, 167, 172, .55)";
    targetCtx.lineWidth = 1.5;
    for (let x = 0; x < width; x += 42) {
      targetCtx.beginPath(); targetCtx.moveTo(x, 0); targetCtx.lineTo(x, height); targetCtx.stroke();
    }
    for (let y = 0; y < height; y += 42) {
      targetCtx.beginPath(); targetCtx.moveTo(0, y); targetCtx.lineTo(width, y); targetCtx.stroke();
    }
    return;
  }
  drawDotBackground(targetCtx, style === "custom" ? state.backgroundColor : "#F6F6F2", null, width, height);
}

function drawEye(targetCtx, x, y) {
  targetCtx.save();
  targetCtx.strokeStyle = "#7b7f82";
  targetCtx.lineWidth = 3;
  targetCtx.beginPath();
  targetCtx.ellipse(x, y, 15, 9, 0, 0, Math.PI * 2);
  targetCtx.stroke();
  targetCtx.fillStyle = "#7b7f82";
  targetCtx.beginPath();
  targetCtx.arc(x, y, 5, 0, Math.PI * 2);
  targetCtx.fill();
  targetCtx.restore();
}

function drawLayerPanel(targetCtx, x, y, width) {
  const displayedLayers = [...state.layers].reverse();
  const items = [...displayedLayers, { base: true }];
  const rowHeight = Math.min(104, 560 / items.length);
  const panelHeight = rowHeight * items.length + 54;

  targetCtx.save();
  targetCtx.fillStyle = "rgba(20, 17, 16, .28)";
  targetCtx.fillRect(x + 10, y + 12, width, panelHeight);
  targetCtx.fillStyle = "#ededed";
  targetCtx.fillRect(x, y, width, panelHeight);
  targetCtx.strokeStyle = "#7c7c7c";
  targetCtx.lineWidth = 2;
  targetCtx.strokeRect(x, y, width, panelHeight);

  items.forEach((item, displayIndex) => {
    const rowY = y + displayIndex * rowHeight;
    const isBase = item.base;
    targetCtx.fillStyle = isBase ? "#c7dbef" : displayIndex % 2 ? "#e7e7e7" : "#f1f1f1";
    targetCtx.fillRect(x + 1, rowY + 1, width - 2, rowHeight - 1);
    targetCtx.strokeStyle = "#9c9c9c";
    targetCtx.lineWidth = 1.5;
    targetCtx.beginPath();
    targetCtx.moveTo(x, rowY + rowHeight);
    targetCtx.lineTo(x + width, rowY + rowHeight);
    targetCtx.stroke();

    const swatchSize = rowHeight - 18;
    const swatchX = x + 12;
    const swatchY = rowY + 9;
    if (isBase) renderImage(targetCtx, state.image, swatchX, swatchY, swatchSize, swatchSize, false);
    else {
      targetCtx.fillStyle = item.color;
      targetCtx.fillRect(swatchX, swatchY, swatchSize, swatchSize);
    }
    targetCtx.strokeStyle = isBase ? "#2583cf" : "#777";
    targetCtx.lineWidth = isBase ? 4 : 2;
    targetCtx.strokeRect(swatchX, swatchY, swatchSize, swatchSize);

    const textX = swatchX + swatchSize + 48;
    const number = isBase ? 1 : state.layers.length - displayIndex + 1;
    drawEye(targetCtx, textX - 24, rowY + rowHeight * .52);
    targetCtx.fillStyle = "#171717";
    targetCtx.font = `500 ${Math.max(15, rowHeight * .22)}px Arial`;
    targetCtx.fillText(String(number), swatchX + swatchSize + 9, rowY + rowHeight * .28);
    targetCtx.fillText(isBase ? "100%" : `${item.opacity}%`, textX, rowY + rowHeight * .48);
    targetCtx.font = `500 ${Math.max(13, rowHeight * .2)}px Arial`;
    targetCtx.fillText(isBase ? "Normal" : BLEND_LABELS[item.mode], textX, rowY + rowHeight * .76);

    targetCtx.strokeStyle = "#aaa";
    targetCtx.lineWidth = 3;
    for (let line = 0; line < 3; line += 1) {
      targetCtx.beginPath();
      targetCtx.moveTo(x + width - 34, rowY + rowHeight * .4 + line * 8);
      targetCtx.lineTo(x + width - 12, rowY + rowHeight * .4 + line * 8);
      targetCtx.stroke();
    }
  });

  const footerY = y + rowHeight * items.length;
  targetCtx.fillStyle = "#ececec";
  targetCtx.fillRect(x + 1, footerY, width - 2, 53);
  targetCtx.fillStyle = "#222";
  targetCtx.font = "500 17px Arial";
  targetCtx.fillText("Background", x + 14, footerY + 33);
  ["#ffffff", "#dddddd", "#777777"].forEach((color, index) => {
    targetCtx.fillStyle = color;
    targetCtx.fillRect(x + width - 116 + index * 34, footerY + 12, 28, 28);
    targetCtx.strokeStyle = index === 0 ? "#1685dc" : "#333";
    targetCtx.lineWidth = 2;
    targetCtx.strokeRect(x + width - 116 + index * 34, footerY + 12, 28, 28);
  });
  targetCtx.restore();
}

function drawArrowSticker(targetCtx, photoRight, gapY, panelX, panelY) {
  targetCtx.save();
  targetCtx.translate(state.layout.arrow.x, state.layout.arrow.y);
  targetCtx.strokeStyle = "#171717";
  targetCtx.fillStyle = "#171717";
  targetCtx.lineWidth = 8;
  targetCtx.lineCap = "round";
  targetCtx.beginPath();
  const arrowEndX = panelX + 65;
  const arrowEndY = panelY + 390;
  targetCtx.moveTo(photoRight, gapY);
  targetCtx.bezierCurveTo(photoRight + 70, gapY - 5, arrowEndX - 55, arrowEndY - 12, arrowEndX, arrowEndY);
  targetCtx.stroke();
  targetCtx.beginPath();
  targetCtx.moveTo(arrowEndX, arrowEndY);
  targetCtx.lineTo(arrowEndX - 26, arrowEndY - 18);
  targetCtx.lineTo(arrowEndX - 24, arrowEndY + 16);
  targetCtx.closePath();
  targetCtx.fill();

  targetCtx.strokeStyle = state.cardStyle === "pink-dot" ? "#f0aeca" : "#d4ccd5";
  targetCtx.lineWidth = 12;
  targetCtx.beginPath();
  targetCtx.arc(660 + state.layout.panel.x * .35, 1045 + state.layout.panel.y * .2, 58, .3, Math.PI * 1.7);
  targetCtx.stroke();
  targetCtx.fillStyle = state.cardStyle === "pink-dot" ? "#f0aeca" : "#d4ccd5";
  targetCtx.beginPath();
  targetCtx.moveTo(705 + state.layout.panel.x * .35, 995 + state.layout.panel.y * .2);
  targetCtx.lineTo(748 + state.layout.panel.x * .35, 1000 + state.layout.panel.y * .2);
  targetCtx.lineTo(716 + state.layout.panel.x * .35, 1034 + state.layout.panel.y * .2);
  targetCtx.closePath();
  targetCtx.fill();
  targetCtx.restore();
}

function renderRecipeCard(targetCtx, width, height) {
  const [artboardWidth, artboardHeight] = CARD_ARTBOARDS[state.cardRatio] ?? CARD_ARTBOARDS["3:4"];
  const scaleX = width / artboardWidth;
  const scaleY = height / artboardHeight;
  targetCtx.save();
  targetCtx.setTransform(scaleX, 0, 0, scaleY, 0, 0);

  if (state.backgroundImage) {
    targetCtx.fillStyle = state.backgroundColor;
    targetCtx.fillRect(0, 0, artboardWidth, artboardHeight);
    drawCover(targetCtx, state.backgroundImage, 0, 0, artboardWidth, artboardHeight, { zoom: 1, x: 0, y: 0 });
  } else {
    drawPresetBackground(targetCtx, state.cardStyle, artboardWidth, artboardHeight);
  }

  const contentScale = Math.min(artboardWidth / 900, artboardHeight / 1200);
  const contentX = (artboardWidth - 900 * contentScale) / 2;
  const contentY = (artboardHeight - 1200 * contentScale) / 2;
  targetCtx.save();
  targetCtx.translate(contentX, contentY);
  targetCtx.scale(contentScale, contentScale);
  const basePhotoWidth = 390;
  const basePhotoHeights = { square: 390, "four-five": 488, "three-four": 520 };
  const basePhotoHeight = basePhotoHeights[state.photoRatio] ?? basePhotoHeights["four-five"];
  const photoWidth = basePhotoWidth * state.photoScale;
  const photoHeight = basePhotoHeight * state.photoScale;
  const scaleOffsetX = (photoWidth - basePhotoWidth) / 2;
  const scaleOffsetY = (photoHeight - basePhotoHeight) / 2;
  const beforeX = 60 + state.layout.before.x - scaleOffsetX;
  const topY = 55;
  const bottomY = 1145 - basePhotoHeight;
  const beforeY = (state.swapPhotos ? bottomY : topY) + state.layout.before.y - scaleOffsetY;
  const afterX = 60 + state.layout.after.x - scaleOffsetX;
  const afterY = (state.swapPhotos ? topY : bottomY) + state.layout.after.y - scaleOffsetY;
  const panelX = 500 + state.layout.panel.x;
  const panelY = 235 + state.layout.panel.y;
  renderImage(targetCtx, state.image, beforeX, beforeY, photoWidth, photoHeight, false);
  renderImage(targetCtx, state.image, afterX, afterY, photoWidth, photoHeight, true);

  targetCtx.fillStyle = "#171717";
  if (state.showTitle) {
    targetCtx.font = "italic 36px Georgia";
    targetCtx.fillText(`+ filter : ${state.name}`, 500, 155, 350);
  }
  if (state.showLabels) {
    targetCtx.font = "600 13px Arial";
    targetCtx.fillText("BEFORE", beforeX, beforeY - 12);
    targetCtx.fillText("AFTER", afterX, afterY - 12);
  }

  drawLayerPanel(targetCtx, panelX, panelY, 340);
  if (state.showArrows) drawArrowSticker(targetCtx, beforeX + photoWidth, (beforeY + photoHeight + afterY) / 2, panelX, panelY);
  targetCtx.restore();
  targetCtx.restore();
  applyMotionBlur(targetCtx, width, height, state.effects);
  applyNoise(targetCtx, 0, 0, width, height, state.effects);
}

function renderPreview() {
  ctx.fillStyle = "#f5dce6";
  ctx.fillRect(0, 0, ui.canvas.width, ui.canvas.height);
  if (!state.image) return;
  renderRecipeCard(ctx, ui.canvas.width, ui.canvas.height);
}

function layerTemplate(layer, index) {
  const options = Object.entries(BLEND_LABELS)
    .map(([value, label]) => `<option value="${value}" ${layer.mode === value ? "selected" : ""}>${label}</option>`)
    .join("");

  return `
    <li class="layer-item" data-id="${layer.id}">
      <div class="layer-main">
        <input class="layer-toggle" data-action="visible" type="checkbox" ${layer.visible ? "checked" : ""} aria-label="显示图层 ${index + 1}" />
        <div class="color-pair">
          <input class="color-picker" data-action="color" type="color" value="${layer.color}" aria-label="图层颜色" />
          <input class="hex-input" data-action="hex" type="text" value="${layer.color}" maxlength="7" spellcheck="false" aria-label="十六进制颜色" />
        </div>
        <output class="opacity-output">${layer.opacity}%</output>
      </div>
      <div class="layer-controls">
        <select data-action="mode" aria-label="混合模式">${options}</select>
        <input class="opacity-range" data-action="opacity" type="range" min="0" max="100" value="${layer.opacity}" aria-label="不透明度" />
      </div>
      <div class="layer-tools">
        <button data-command="up" type="button">上移</button>
        <button data-command="down" type="button">下移</button>
        <button data-command="duplicate" type="button">复制</button>
        <button data-command="delete" type="button">删除</button>
      </div>
    </li>`;
}

function renderLayers() {
  // Reverse only for display: Photoshop-like panels show the top layer first.
  ui.layerList.innerHTML = [...state.layers]
    .reverse()
    .map((layer) => layerTemplate(layer, state.layers.indexOf(layer)))
    .join("");
}

function syncExportOptions() {
  const presets = EXPORT_PRESETS[state.cardRatio] ?? EXPORT_PRESETS["3:4"];
  const currentValue = `${state.exportSize.width}x${state.exportSize.height}`;
  $("#exportSize").innerHTML = presets
    .map(([width, height, label]) => `<option value="${width}x${height}">${label} · ${width} × ${height}</option>`)
    .join("");
  const isCurrentValid = presets.some(([width, height]) => `${width}x${height}` === currentValue);
  if (!isCurrentValid) {
    const [width, height] = presets[0];
    state.exportSize = { width, height };
  }
  $("#exportSize").value = `${state.exportSize.width}x${state.exportSize.height}`;
}

function syncAtmosphereControls() {
  const controls = {
    motionBlur: ["#motionBlur", "#motionBlurOutput", ""],
    motionAngle: ["#motionAngle", "#motionAngleOutput", "°"],
    noiseAmount: ["#noiseAmount", "#noiseAmountOutput", ""],
    noiseSize: ["#noiseSize", "#noiseSizeOutput", ""],
  };
  for (const [key, [inputId, outputId, suffix]] of Object.entries(controls)) {
    $(inputId).value = state.effects[key];
    $(outputId).textContent = `${state.effects[key]}${suffix}`;
  }
  document.querySelectorAll("[data-atmosphere-preset]").forEach((button) => {
    const preset = ATMOSPHERE_PRESETS[button.dataset.atmospherePreset];
    const matches = preset && Object.keys(preset).every((key) => preset[key] === state.effects[key]);
    button.classList.toggle("is-active", matches);
  });
}

function renderAll() {
  const [artboardWidth, artboardHeight] = CARD_ARTBOARDS[state.cardRatio] ?? CARD_ARTBOARDS["3:4"];
  ui.canvas.width = artboardWidth;
  ui.canvas.height = artboardHeight;
  ui.dropZone.style.aspectRatio = `${artboardWidth} / ${artboardHeight}`;
  ui.recipeName.value = state.name;
  document.querySelectorAll(".style-option").forEach((button) => {
    button.classList.toggle("is-active", !state.backgroundImage && button.dataset.cardStyle === state.cardStyle);
  });
  document.querySelectorAll("[data-photo-ratio]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.photoRatio === state.photoRatio);
  });
  $("#cropZoom").value = Math.round(state.crop.zoom * 100);
  $("#photoScale").value = Math.round(state.photoScale * 100);
  $("#cropX").value = state.crop.x;
  $("#cropY").value = state.crop.y;
  $("#zoomOutput").textContent = `${Math.round(state.crop.zoom * 100)}%`;
  $("#photoScaleOutput").textContent = `${Math.round(state.photoScale * 100)}%`;
  $("#cropXOutput").textContent = state.crop.x;
  $("#cropYOutput").textContent = state.crop.y;
  $("#showTitle").checked = state.showTitle;
  $("#showArrows").checked = state.showArrows;
  $("#showLabels").checked = state.showLabels;
  $("#swapPhotosButton").classList.toggle("is-active", state.swapPhotos);
  $("#swapPhotosButton").textContent = state.swapPhotos ? "恢复上下 ⇅" : "上下对调 ⇅";
  syncAtmosphereControls();
  $("#backgroundColor").value = state.backgroundColor;
  const backgroundNames = {
    "pink-dot": "粉色波点", "gray-dot": "灰白波点", clean: "纯色留白",
    "yellow-dot": "黄油白点", "candy-gradient": "糖果渐变", "blush-dot": "淡粉小点",
    checker: "奶油棋盘", grid: "方格纸", custom: "自定义颜色",
  };
  $("#backgroundStatus").textContent = state.backgroundImage ? `当前背景图：${state.backgroundFileName}` : `当前使用：${backgroundNames[state.cardStyle] ?? "自定义"}`;
  for (const [prefix, group] of [["before", state.layout.before], ["after", state.layout.after], ["panel", state.layout.panel], ["arrow", state.layout.arrow]]) {
    for (const axis of ["X", "Y"]) {
      const key = axis.toLowerCase();
      $(`#${prefix}${axis}`).value = group[key];
      $(`#${prefix}${axis}Output`).textContent = group[key];
    }
  }
  $("#cardRatio").value = state.cardRatio;
  syncExportOptions();
  $("#exportResolutionText").textContent = `${state.cardRatio} · 导出 ${state.exportSize.width} × ${state.exportSize.height}`;
  renderLayers();
  renderPreview();
}

function updateLayer(id, changes) {
  const layer = state.layers.find((item) => item.id === id);
  if (!layer) return;
  Object.assign(layer, changes);
  renderPreview();
}

// EVENTS: DOM events change state, then ask the renderer to redraw.
ui.layerList.addEventListener("input", (event) => {
  const item = event.target.closest(".layer-item");
  if (!item) return;
  const id = item.dataset.id;
  const action = event.target.dataset.action;

  if (action === "visible") updateLayer(id, { visible: event.target.checked });
  if (action === "mode") updateLayer(id, { mode: event.target.value });
  if (action === "opacity") {
    updateLayer(id, { opacity: Number(event.target.value) });
    item.querySelector(".opacity-output").textContent = `${event.target.value}%`;
  }
  if (action === "color") {
    const color = event.target.value.toUpperCase();
    updateLayer(id, { color });
    item.querySelector(".hex-input").value = color;
  }
  if (action === "hex" && /^#[0-9A-Fa-f]{6}$/.test(event.target.value)) {
    const color = event.target.value.toUpperCase();
    updateLayer(id, { color });
    item.querySelector(".color-picker").value = color;
  }
});

ui.layerList.addEventListener("click", (event) => {
  const command = event.target.dataset.command;
  const item = event.target.closest(".layer-item");
  if (!command || !item) return;

  const index = state.layers.findIndex((layer) => layer.id === item.dataset.id);
  if (command === "delete" && state.layers.length > 1) state.layers.splice(index, 1);
  if (command === "duplicate") state.layers.splice(index + 1, 0, { ...state.layers[index], id: makeId() });
  if (command === "up" && index < state.layers.length - 1) [state.layers[index], state.layers[index + 1]] = [state.layers[index + 1], state.layers[index]];
  if (command === "down" && index > 0) [state.layers[index], state.layers[index - 1]] = [state.layers[index - 1], state.layers[index]];
  renderLayers();
  renderPreview();
});

$("#addLayerButton").addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  document.querySelector(".layers-section").open = true;
  state.layers.push({ id: makeId(), color: "#F4D7D0", mode: "soft-light", opacity: 35, visible: true });
  renderLayers();
  renderPreview();
});

function applyColorPreset(presetKey, showFeedback = true) {
  const preset = COLOR_PRESETS[presetKey];
  if (!preset) return;
  state.layers = instantiatePresetLayers(preset.layers);
  $("#colorPreset").value = presetKey;
  $("#colorPresetNote").textContent = `${preset.label}：${preset.note}`;
  renderLayers();
  renderPreview();
  if (showFeedback) showToast(`已应用 ${preset.label}`);
}

$("#applyColorPresetButton").addEventListener("click", () => applyColorPreset($("#colorPreset").value));

$("#colorPreset").addEventListener("change", (event) => {
  const preset = COLOR_PRESETS[event.target.value];
  if (preset) $("#colorPresetNote").textContent = `${preset.label}：${preset.note}`;
});

const RANDOM_TITLES = [
  "night flash", "soft chrome", "candy haze", "after rain",
  "pink noise", "blue hour", "cream film", "city memory",
  "slow bloom", "midnight diary", "peach static", "dream exposure",
];
const RANDOM_BACKGROUNDS = ["pink-dot", "gray-dot", "clean", "yellow-dot", "candy-gradient", "blush-dot", "checker", "grid"];
const RANDOM_PHOTO_RATIOS = ["square", "four-five", "three-four"];

function randomChoice(items) {
  return items[Math.floor(Math.random() * items.length)];
}

$("#randomAllButton").addEventListener("click", () => {
  state.name = randomChoice(RANDOM_TITLES);
  state.cardStyle = randomChoice(RANDOM_BACKGROUNDS);
  state.backgroundImage = null;
  state.backgroundDataUrl = null;
  state.backgroundFileName = "";
  state.photoRatio = randomChoice(RANDOM_PHOTO_RATIOS);
  state.photoScale = Math.round(85 + Math.random() * 40) / 100;
  state.crop = {
    zoom: Math.round((1 + Math.random() * .18) * 100) / 100,
    x: Math.round(Math.random() * 40 - 20),
    y: Math.round(Math.random() * 40 - 20),
  };
  state.cardRatio = randomChoice(Object.keys(CARD_ARTBOARDS));
  const exportChoices = EXPORT_PRESETS[state.cardRatio].slice(0, 3);
  const [width, height] = randomChoice(exportChoices);
  state.exportSize = { width, height };
  state.showTitle = true;
  state.showArrows = Math.random() > .15;
  state.showLabels = Math.random() > .45;
  state.swapPhotos = Math.random() > .65;

  const colorPresetKey = randomChoice(Object.keys(COLOR_PRESETS));
  const colorPreset = COLOR_PRESETS[colorPresetKey];
  state.layers = instantiatePresetLayers(colorPreset.layers);
  $("#colorPreset").value = colorPresetKey;
  $("#colorPresetNote").textContent = `${colorPreset.label}：${colorPreset.note}`;

  const atmosphereKey = randomChoice(Object.keys(ATMOSPHERE_PRESETS));
  state.effects = { ...ATMOSPHERE_PRESETS[atmosphereKey] };
  randomizeLayout(false);
  renderAll();
  showToast(`已抽到：${state.name}`);
});

document.querySelector(".atmosphere-presets").addEventListener("click", (event) => {
  const button = event.target.closest("[data-atmosphere-preset]");
  if (!button) return;
  state.effects = { ...ATMOSPHERE_PRESETS[button.dataset.atmospherePreset] };
  syncAtmosphereControls();
  renderPreview();
  showToast(`${button.textContent}已应用`);
});

for (const [id, key, suffix] of [
  ["#motionBlur", "motionBlur", ""], ["#motionAngle", "motionAngle", "°"],
  ["#noiseAmount", "noiseAmount", ""], ["#noiseSize", "noiseSize", ""],
]) {
  $(id).addEventListener("input", (event) => {
    state.effects[key] = Number(event.target.value);
    $(`${id}Output`).textContent = `${event.target.value}${suffix}`;
    document.querySelectorAll("[data-atmosphere-preset]").forEach((button) => button.classList.remove("is-active"));
    renderPreview();
  });
}

ui.recipeName.addEventListener("input", () => {
  state.name = ui.recipeName.value.trim() || "untitled filter";
  renderPreview();
});

document.querySelector(".style-options").addEventListener("click", (event) => {
  const button = event.target.closest("[data-card-style]");
  if (!button) return;
  state.cardStyle = button.dataset.cardStyle;
  state.backgroundImage = null;
  state.backgroundDataUrl = null;
  state.backgroundFileName = "";
  document.querySelectorAll(".style-option").forEach((item) => item.classList.toggle("is-active", item === button));
  renderAll();
});

$("#backgroundColor").addEventListener("input", (event) => {
  state.backgroundColor = event.target.value.toUpperCase();
  state.cardStyle = "custom";
  state.backgroundImage = null;
  state.backgroundDataUrl = null;
  state.backgroundFileName = "";
  renderAll();
});

ui.backgroundImageInput.addEventListener("change", () => {
  const file = ui.backgroundImageInput.files[0];
  if (!file?.type.startsWith("image/")) return showToast("请选择一张背景图片");
  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      state.backgroundImage = image;
      state.backgroundDataUrl = reader.result;
      state.backgroundFileName = file.name;
      renderAll();
      showToast("背景图片已更换");
    };
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
});

$("#clearBackgroundButton").addEventListener("click", () => {
  state.backgroundImage = null;
  state.backgroundDataUrl = null;
  state.backgroundFileName = "";
  state.cardStyle = "pink-dot";
  renderAll();
});

document.querySelector(".ratio-options").addEventListener("click", (event) => {
  const button = event.target.closest("[data-photo-ratio]");
  if (!button) return;
  state.photoRatio = button.dataset.photoRatio;
  document.querySelectorAll("[data-photo-ratio]").forEach((item) => item.classList.toggle("is-active", item === button));
  renderPreview();
});

for (const [id, key] of [["#cropX", "x"], ["#cropY", "y"]]) {
  $(id).addEventListener("input", (event) => {
    state.crop[key] = Number(event.target.value);
    $(`${id}Output`).textContent = event.target.value;
    renderPreview();
  });
}

$("#cropZoom").addEventListener("input", (event) => {
  state.crop.zoom = Number(event.target.value) / 100;
  $("#zoomOutput").textContent = `${event.target.value}%`;
  renderPreview();
});

$("#photoScale").addEventListener("input", (event) => {
  state.photoScale = Number(event.target.value) / 100;
  $("#photoScaleOutput").textContent = `${event.target.value}%`;
  renderPreview();
});

for (const [id, key] of [["#showTitle", "showTitle"], ["#showArrows", "showArrows"], ["#showLabels", "showLabels"]]) {
  $(id).addEventListener("change", (event) => {
    state[key] = event.target.checked;
    renderPreview();
  });
}

$("#resetCropButton").addEventListener("click", () => {
  state.crop = { zoom: 1, x: 0, y: 0 };
  renderAll();
  showToast("照片裁切已重置");
});

for (const prefix of ["before", "after", "panel", "arrow"]) {
  for (const axis of ["X", "Y"]) {
    const key = axis.toLowerCase();
    $(`#${prefix}${axis}`).addEventListener("input", (event) => {
      state.layout[prefix][key] = Number(event.target.value);
      $(`#${prefix}${axis}Output`).textContent = event.target.value;
      renderPreview();
    });
  }
}

$("#resetLayoutButton").addEventListener("click", () => {
  state.layout = { before: { x: 0, y: 0 }, after: { x: 0, y: 0 }, panel: { x: 0, y: 0 }, arrow: { x: 0, y: 0 } };
  state.swapPhotos = false;
  renderAll();
  showToast("排版位置已重置");
});

$("#swapPhotosButton").addEventListener("click", () => {
  state.swapPhotos = !state.swapPhotos;
  renderAll();
  showToast(state.swapPhotos ? "原图与效果图已上下对调" : "已恢复原图在上");
});

const LAYOUT_PROFILES = [
  { before: [-70, -35], after: [55, 38], panel: [-105, 15], arrow: [35, -18] },
  { before: [72, -42], after: [-48, 62], panel: [-92, -72], arrow: [-42, 44] },
  { before: [-28, 54], after: [98, -68], panel: [-108, 55], arrow: [66, -46] },
  { before: [55, 22], after: [-82, -44], panel: [-104, 6], arrow: [-58, 18] },
  { before: [-88, 4], after: [84, 12], panel: [-70, -86], arrow: [18, 60] },
  { before: [18, -62], after: [-35, 76], panel: [-110, -12], arrow: [-12, -64] },
];

let lastLayoutProfile = -1;
function randomizeLayout(shouldRender = true) {
  // Curated collage profiles guarantee variety; small jitter keeps repeats from feeling identical.
  let profileIndex = Math.floor(Math.random() * LAYOUT_PROFILES.length);
  if (profileIndex === lastLayoutProfile) profileIndex = (profileIndex + 1) % LAYOUT_PROFILES.length;
  lastLayoutProfile = profileIndex;
  const profile = LAYOUT_PROFILES[profileIndex];
  const jitter = () => Math.round(Math.random() * 20 - 10);
  const point = ([x, y]) => ({ x: x + jitter(), y: y + jitter() });
  state.layout = {
    before: point(profile.before),
    after: point(profile.after),
    panel: point(profile.panel),
    arrow: point(profile.arrow),
  };
  if (shouldRender) {
    renderAll();
    showToast(`已生成拼贴排版 ${profileIndex + 1}`);
  }
}

$("#randomLayoutButton").addEventListener("click", () => randomizeLayout(true));

$("#cardRatio").addEventListener("change", (event) => {
  state.cardRatio = event.target.value;
  const [width, height] = EXPORT_PRESETS[state.cardRatio][0];
  state.exportSize = { width, height };
  renderAll();
});

$("#exportSize").addEventListener("change", (event) => {
  const [width, height] = event.target.value.split("x").map(Number);
  state.exportSize = { width, height };
  $("#exportResolutionText").textContent = `${state.cardRatio} · 导出 ${width} × ${height}`;
});

function loadImageFile(file) {
  if (!file?.type.startsWith("image/")) return showToast("请选择 JPG、PNG 或 WEBP 图片");
  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      state.image = image;
      state.fileName = file.name;
      ui.dropZone.classList.remove("is-empty");
      ui.imageStatus.textContent = `${file.name} · ${image.naturalWidth} × ${image.naturalHeight}`;
      renderPreview();
    };
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
}

ui.imageInput.addEventListener("change", () => loadImageFile(ui.imageInput.files[0]));

for (const eventName of ["dragenter", "dragover"]) {
  ui.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    ui.dropZone.classList.add("is-dragging");
  });
}

for (const eventName of ["dragleave", "drop"]) {
  ui.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    ui.dropZone.classList.remove("is-dragging");
  });
}

ui.dropZone.addEventListener("drop", (event) => loadImageFile(event.dataTransfer.files[0]));

$("#resetButton").addEventListener("click", () => window.location.reload());

// EXPORT: create a fresh canvas so the download does not depend on CSS layout.
function downloadCanvas(canvas, fileName) {
  const link = document.createElement("a");
  link.download = fileName;
  link.href = canvas.toDataURL("image/png", 1);
  link.click();
}

$("#exportImageButton").addEventListener("click", () => {
  if (!state.image) return showToast("请先上传一张照片");
  const output = document.createElement("canvas");
  output.width = 1080;
  output.height = 1350;
  renderImage(output.getContext("2d", { alpha: false }), state.image, 0, 0, output.width, output.height, true);
  downloadCanvas(output, `${safeFileName(state.name)}-after.png`);
});

$("#exportCardButton").addEventListener("click", () => {
  if (!state.image) return showToast("请先上传一张照片");
  const card = document.createElement("canvas");
  card.width = state.exportSize.width;
  card.height = state.exportSize.height;
  const cardCtx = card.getContext("2d", { alpha: false });
  renderRecipeCard(cardCtx, card.width, card.height);
  downloadCanvas(card, `${safeFileName(state.name)}-recipe-card.png`);
  showToast(`${state.cardRatio} 配方卡已导出`);
});

$("#saveRecipeButton").addEventListener("click", () => {
  const recipe = {
    version: 8,
    name: state.name,
    cardStyle: state.cardStyle,
    backgroundColor: state.backgroundColor,
    backgroundDataUrl: state.backgroundDataUrl,
    backgroundFileName: state.backgroundFileName,
    photoRatio: state.photoRatio,
    photoScale: state.photoScale,
    crop: state.crop,
    layout: state.layout,
    cardRatio: state.cardRatio,
    exportSize: state.exportSize,
    showTitle: state.showTitle,
    showArrows: state.showArrows,
    showLabels: state.showLabels,
    swapPhotos: state.swapPhotos,
    effects: state.effects,
    layers: state.layers.map(({ id, ...layer }) => layer),
  };
  const blob = new Blob([JSON.stringify(recipe, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.download = `${safeFileName(state.name)}.json`;
  link.href = URL.createObjectURL(blob);
  link.click();
  URL.revokeObjectURL(link.href);
  localStorage.setItem("yongyong-last-recipe", JSON.stringify(recipe));
  showToast("配方 JSON 已保存");
});

$("#importRecipeButton").addEventListener("click", () => ui.recipeInput.click());
ui.recipeInput.addEventListener("change", () => {
  const file = ui.recipeInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const recipe = JSON.parse(reader.result);
      if (!Array.isArray(recipe.layers)) throw new Error("Missing layers");
      state.name = recipe.name || "imported recipe";
      state.cardStyle = recipe.cardStyle || "pink-dot";
      state.backgroundColor = recipe.backgroundColor || "#F6F6F2";
      state.backgroundDataUrl = recipe.backgroundDataUrl || null;
      state.backgroundFileName = recipe.backgroundFileName || "";
      state.backgroundImage = null;
      state.photoRatio = recipe.photoRatio || "four-five";
      state.photoScale = Number(recipe.photoScale) || 1;
      state.crop = recipe.crop || { zoom: 1, x: 0, y: 0 };
      const savedLayout = recipe.layout || {};
      state.layout = {
        before: savedLayout.before || { x: 0, y: 0 },
        after: savedLayout.after || { x: 0, y: 0 },
        panel: savedLayout.panel || { x: 0, y: 0 },
        arrow: savedLayout.arrow || { x: 0, y: 0 },
      };
      state.cardRatio = recipe.cardRatio || "3:4";
      state.exportSize = recipe.exportSize || { width: 1080, height: 1440 };
      state.showTitle = recipe.showTitle !== false;
      state.showArrows = recipe.showArrows !== false;
      state.showLabels = recipe.showLabels === true;
      state.swapPhotos = recipe.swapPhotos === true;
      state.effects = { ...ATMOSPHERE_PRESETS.clean, ...(recipe.effects || {}) };
      state.effects.motionBlur = Math.min(10, Math.max(0, Number(state.effects.motionBlur) || 0));
      state.layers = recipe.layers.map((layer) => ({
        id: makeId(), color: layer.color, mode: layer.mode,
        opacity: Number(layer.opacity), visible: layer.visible !== false,
      }));
      if (state.backgroundDataUrl) {
        const backgroundImage = new Image();
        backgroundImage.onload = () => { state.backgroundImage = backgroundImage; renderAll(); };
        backgroundImage.src = state.backgroundDataUrl;
      } else {
        renderAll();
      }
      showToast("配方已导入");
    } catch {
      showToast("这个 JSON 不是有效的滤镜配方");
    }
  };
  reader.readAsText(file);
});

$("#copyReferenceButton").addEventListener("click", async () => {
  const lines = [...state.layers].reverse().map((layer, index) =>
    `Layer ${state.layers.length - index} — ${layer.color} — ${BLEND_LABELS[layer.mode]} — ${layer.opacity}%`
  );
  lines.push(`Motion Blur — ${state.effects.motionBlur} — ${state.effects.motionAngle}°`);
  lines.push(`Noise — ${state.effects.noiseAmount} — Size ${state.effects.noiseSize}`);
  try {
    await navigator.clipboard.writeText(`${state.name}\n${lines.join("\n")}`);
    showToast("PS 参数已复制");
  } catch {
    showToast("浏览器没有允许剪贴板权限");
  }
});

function safeFileName(name) {
  return name.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-") || "filter";
}

let toastTimer;
function showToast(message) {
  clearTimeout(toastTimer);
  ui.toast.textContent = message;
  ui.toast.classList.add("is-visible");
  toastTimer = setTimeout(() => ui.toast.classList.remove("is-visible"), 1800);
}

ui.dropZone.classList.add("is-empty");
randomizeLayout(false);
renderAll();
createDemoImage();
