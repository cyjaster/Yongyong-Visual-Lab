// Local person segmentation; runtime and model are loaded only when requested.
(() => {
  let model;
  async function getModel() {
    if (!model) model = (async () => {
      const { FilesetResolver, ImageSegmenter } = await import('./vendor/mediapipe/vision_bundle.js');
      const files = await FilesetResolver.forVisionTasks('vendor/mediapipe/wasm');
      return ImageSegmenter.createFromOptions(files, {
        baseOptions: { modelAssetPath:'vendor/mediapipe/selfie_segmenter.tflite', delegate:'CPU' },
        runningMode:'IMAGE', outputConfidenceMasks:true, outputCategoryMask:false
      });
    })().catch(error => { model = null; throw error; });
    return model;
  }
  async function removeBackground(image) {
    image = window.PosterPixels?.normalize(image) || image;
    const segmenter = await getModel();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法创建人像画布。');
    let pixels = window.PosterPixels?.copyPixels(image);
    if (pixels) ctx.putImageData(pixels,0,0);
    else {
      ctx.drawImage(image,0,0);
      pixels = ctx.getImageData(0,0,canvas.width,canvas.height);
    }
    segmenter.segment(canvas, result => {
      // This pinned selfie model returns one foreground confidence mask.
      const mask = result.confidenceMasks[0], confidence = mask.getAsFloat32Array();
      if (mask.width !== canvas.width || mask.height !== canvas.height) throw new Error('人像蒙版尺寸不匹配。');
      let foreground = 0;
      for (let i=0;i<confidence.length;i++) {
        if (confidence[i] > .5) foreground++;
        const alpha = Math.max(0,Math.min(1,(confidence[i]-.15)/.7));
        pixels.data[i*4+3] = Math.round(pixels.data[i*4+3] * alpha * alpha * (3-2*alpha));
      }
      if (foreground < confidence.length*.005) throw new Error('没有检测到清晰人像，请换一张人物更明显的照片。');
    });
    ctx.putImageData(pixels,0,0);
    const cutout = new Image(); cutout.src = canvas.toDataURL('image/png'); await cutout.decode();
    return cutout;
  }
  window.posterCutout = { removeBackground };
})();
