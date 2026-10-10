// Freeze decoded pixels before preview, segmentation and export share a photo.
(() => {
  const images = new WeakMap();
  function normalize(image) {
    if (!image || !image.naturalWidth || !image.naturalHeight) return image;
    if (images.has(image)) return images.get(image).canvas;
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently:true });
    if (!ctx) throw new Error('无法创建照片画布。');
    ctx.drawImage(image,0,0);
    const pixels = ctx.getImageData(0,0,canvas.width,canvas.height);
    ctx.putImageData(pixels,0,0);
    canvas.naturalWidth = canvas.width; canvas.naturalHeight = canvas.height;
    const decoded = {canvas,pixels};
    images.set(image,decoded); images.set(canvas,decoded);
    return canvas;
  }
  function copyPixels(image) {
    normalize(image);
    const pixels = images.get(image)?.pixels;
    if (!pixels) return null;
    return new ImageData(new Uint8ClampedArray(pixels.data),pixels.width,pixels.height);
  }
  window.PosterPixels = { normalize,copyPixels };
})();
