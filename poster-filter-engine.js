/* Source-driven raster filters shared by the poster preview and PNG export. */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PosterFilterEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const number = (value, fallback, min, max) => {
    const parsed = Number(value);
    return clamp(value == null || !Number.isFinite(parsed) ? fallback : parsed, min, max);
  };
  const pixelScale = opts => number(opts.pixelScale, 1, 0.1, 8);
  const luma = (r, g, b) => r * 0.2126 + g * 0.7152 + b * 0.0722;

  function copy(image) {
    if (!image || !Number.isInteger(image.width) || !Number.isInteger(image.height)
      || image.width < 1 || image.height < 1 || !image.data
      || image.data.length < image.width * image.height * 4) {
      throw new TypeError("A nonempty RGBA imageData is required.");
    }
    return {
      width: image.width,
      height: image.height,
      data: new Uint8ClampedArray(image.data),
    };
  }

  // The rank of a radius in a square cell. Unlike a fixed dot overlay, this
  // makes dot area follow the photograph's local darkness across the full range.
  const radialRank = new Float32Array(2049);
  for (let i = 0; i < radialRank.length; i += 1) {
    const r = i / 2048 * Math.SQRT1_2;
    const r2 = r * r;
    radialRank[i] = r <= 0.5 ? Math.PI * r2 : Math.PI * r2
      - 4 * (r2 * Math.acos(0.5 / r) - 0.5 * Math.sqrt(r2 - 0.25));
  }

  function screenInk(rank, coverage, softness) {
    if (coverage <= 0) return 0;
    if (coverage >= 1) return 1;
    return clamp((coverage - rank) / softness + 0.5, 0, 1);
  }

  function halftone(image, options) {
    const opts = options || {};
    const output = copy(image);
    const strength = number(opts.halftoneStrength, 100, 0, 100) / 100;
    if (!strength) return output;
    const effect = opts.effect || "dot";
    if (!["circle", "line", "dot", "color"].includes(effect)) return output;
    const period = number(opts.halftoneSize, 6, 2, 32) * 2 * pixelScale(opts);
    const contrast = 1 + number(opts.halftoneContrast, 0, 0, 100) / 50;
    const angle = number(opts.halftoneAngle, 0, -3600, 3600) * Math.PI / 180;
    const originX = number(opts.halftoneOriginX, 50, -100, 200) / 100 * (image.width - 1);
    const originY = number(opts.halftoneOriginY, 50, -100, 200) / 100 * (image.height - 1);
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const softness = 1.4 / period;
    const source = image.data;
    const target = output.data;
    const channelAngles = [angle + Math.PI / 12, angle + Math.PI * 5 / 12, angle];
    const channelCos = channelAngles.map(Math.cos);
    const channelSin = channelAngles.map(Math.sin);

    function dotRank(x, y, cos, sin) {
      const u = (x * cos + y * sin) / period;
      const v = (-x * sin + y * cos) / period;
      const dx = u - Math.floor(u + 0.5);
      const dy = v - Math.floor(v + 0.5);
      const index = Math.min(2048, Math.round(Math.sqrt(dx * dx + dy * dy) * 2048 / Math.SQRT1_2));
      return radialRank[index];
    }

    for (let y = 0; y < image.height; y += 1) {
      const yy = y - originY;
      for (let x = 0; x < image.width; x += 1) {
        const i = (y * image.width + x) * 4;
        if (!source[i + 3]) continue;
        const xx = x - originX;
        if (effect === "color") {
          for (let channel = 0; channel < 3; channel += 1) {
            const brightness = clamp((source[i + channel] / 255 - 0.5) * contrast + 0.5, 0, 1);
            const ink = screenInk(dotRank(xx, yy, channelCos[channel], channelSin[channel]), 1 - brightness, softness);
            target[i + channel] = source[i + channel] * (1 - strength) + 255 * (1 - ink) * strength;
          }
          continue;
        }
        const brightness = clamp((luma(source[i], source[i + 1], source[i + 2]) / 255 - 0.5) * contrast + 0.5, 0, 1);
        let rank;
        if (effect === "dot") {
          rank = dotRank(xx, yy, cosine, sine);
        } else {
          const position = effect === "circle" ? Math.sqrt(xx * xx + yy * yy)
            : xx * sine + yy * cosine;
          const phase = position / period;
          rank = Math.abs((phase - Math.floor(phase)) - 0.5) * 2;
        }
        const tone = 255 * (1 - screenInk(rank, 1 - brightness, softness));
        target[i] = source[i] * (1 - strength) + tone * strength;
        target[i + 1] = source[i + 1] * (1 - strength) + tone * strength;
        target[i + 2] = source[i + 2] * (1 - strength) + tone * strength;
      }
    }
    return output;
  }

  // Axis-aligned line convolution uses prefix sums and replicated edge pixels.
  // RGB is accumulated premultiplied by alpha, then divided by summed alpha.
  function axisBlur(image, distance, vertical) {
    const output = copy(image);
    const source = image.data;
    const target = output.data;
    const length = vertical ? image.height : image.width;
    const lines = vertical ? image.width : image.height;
    const stride = vertical ? image.width * 4 : 4;
    const radius = Math.floor(distance / 2);
    const fraction = distance / 2 - radius;
    const divisor = radius * 2 + 1 + fraction * 2;
    const prefixes = Array.from({ length: 4 }, () => new Float64Array(length + 1));
    for (let line = 0; line < lines; line += 1) {
      const start = vertical ? line * 4 : line * image.width * 4;
      for (let j = 0; j < 4; j += 1) prefixes[j][0] = 0;
      for (let pos = 0; pos < length; pos += 1) {
        const i = start + pos * stride;
        const alpha = source[i + 3];
        prefixes[0][pos + 1] = prefixes[0][pos] + source[i] * alpha;
        prefixes[1][pos + 1] = prefixes[1][pos] + source[i + 1] * alpha;
        prefixes[2][pos + 1] = prefixes[2][pos] + source[i + 2] * alpha;
        prefixes[3][pos + 1] = prefixes[3][pos] + alpha;
      }
      const end = start + (length - 1) * stride;
      for (let pos = 0; pos < length; pos += 1) {
        const lo = Math.max(0, pos - radius);
        const hi = Math.min(length - 1, pos + radius);
        const leftCopies = Math.max(0, radius - pos);
        const rightCopies = Math.max(0, pos + radius - length + 1);
        const leftIndex = start + clamp(pos - radius - 1, 0, length - 1) * stride;
        const rightIndex = start + clamp(pos + radius + 1, 0, length - 1) * stride;
        const i = start + pos * stride;
        const alpha = prefixes[3][hi + 1] - prefixes[3][lo]
          + leftCopies * source[start + 3] + rightCopies * source[end + 3]
          + fraction * (source[leftIndex + 3] + source[rightIndex + 3]);
        for (let channel = 0; channel < 3; channel += 1) {
          const sum = prefixes[channel][hi + 1] - prefixes[channel][lo]
            + leftCopies * source[start + channel] * source[start + 3]
            + rightCopies * source[end + channel] * source[end + 3]
            + fraction * (source[leftIndex + channel] * source[leftIndex + 3]
              + source[rightIndex + channel] * source[rightIndex + 3]);
          target[i + channel] = alpha ? sum / alpha : 0;
        }
        target[i + 3] = alpha / divisor;
      }
    }
    return output;
  }

  // Repeated symmetric two-tap convolutions compose a uniformly sampled line
  // kernel. Bilinear sampling supports arbitrary angles in O(log(distance))
  // passes, so large photographs do not need 80 full-image sampling passes.
  function directionalBlur(image, distance, angle) {
    const width = image.width;
    const height = image.height;
    let source = new Float32Array(width * height * 4);
    let target = new Float32Array(source.length);
    for (let i = 0; i < source.length; i += 4) {
      const alpha = image.data[i + 3];
      source[i] = image.data[i] * alpha;
      source[i + 1] = image.data[i + 1] * alpha;
      source[i + 2] = image.data[i + 2] * alpha;
      source[i + 3] = alpha;
    }
    const passes = Math.max(1, Math.ceil(Math.log2(distance + 1)));
    const spacing = distance / (Math.pow(2, passes) - 1);
    const xOffsets = Array.from({ length: 4 }, () => new Int32Array(width));
    const yOffsets = Array.from({ length: 4 }, () => new Int32Array(height));
    const xWeights = [new Float32Array(width), new Float32Array(width)];
    const yWeights = [new Float32Array(height), new Float32Array(height)];
    for (let pass = 0; pass < passes; pass += 1) {
      const shift = spacing * Math.pow(2, pass) / 2;
      const dx = Math.cos(angle) * shift;
      const dy = Math.sin(angle) * shift;
      for (let x = 0; x < width; x += 1) {
        for (let direction = 0; direction < 2; direction += 1) {
          const sampleX = clamp(x + (direction ? dx : -dx), 0, width - 1);
          const floorX = Math.floor(sampleX);
          xOffsets[direction * 2][x] = floorX * 4;
          xOffsets[direction * 2 + 1][x] = Math.min(width - 1, floorX + 1) * 4;
          xWeights[direction][x] = sampleX - floorX;
        }
      }
      for (let y = 0; y < height; y += 1) {
        for (let direction = 0; direction < 2; direction += 1) {
          const sampleY = clamp(y + (direction ? dy : -dy), 0, height - 1);
          const floorY = Math.floor(sampleY);
          yOffsets[direction * 2][y] = floorY * width * 4;
          yOffsets[direction * 2 + 1][y] = Math.min(height - 1, floorY + 1) * width * 4;
          yWeights[direction][y] = sampleY - floorY;
        }
      }
      for (let y = 0; y < height; y += 1) {
        const wyMinus = yWeights[0][y];
        const wyPlus = yWeights[1][y];
        const ym0 = yOffsets[0][y];
        const ym1 = yOffsets[1][y];
        const yp0 = yOffsets[2][y];
        const yp1 = yOffsets[3][y];
        for (let x = 0; x < width; x += 1) {
          const i = (y * width + x) * 4;
          const wxMinus = xWeights[0][x];
          const wxPlus = xWeights[1][x];
          const m00 = ym0 + xOffsets[0][x];
          const m10 = ym0 + xOffsets[1][x];
          const m01 = ym1 + xOffsets[0][x];
          const m11 = ym1 + xOffsets[1][x];
          const p00 = yp0 + xOffsets[2][x];
          const p10 = yp0 + xOffsets[3][x];
          const p01 = yp1 + xOffsets[2][x];
          const p11 = yp1 + xOffsets[3][x];
          for (let channel = 0; channel < 4; channel += 1) {
            const minusTop = source[m00 + channel] * (1 - wxMinus) + source[m10 + channel] * wxMinus;
            const minusBottom = source[m01 + channel] * (1 - wxMinus) + source[m11 + channel] * wxMinus;
            const plusTop = source[p00 + channel] * (1 - wxPlus) + source[p10 + channel] * wxPlus;
            const plusBottom = source[p01 + channel] * (1 - wxPlus) + source[p11 + channel] * wxPlus;
            target[i + channel] = (minusTop * (1 - wyMinus) + minusBottom * wyMinus
              + plusTop * (1 - wyPlus) + plusBottom * wyPlus) / 2;
          }
        }
      }
      const swap = source;
      source = target;
      target = swap;
    }
    const output = copy(image);
    for (let i = 0; i < source.length; i += 4) {
      const alpha = source[i + 3];
      output.data[i] = alpha > 0 ? source[i] / alpha : 0;
      output.data[i + 1] = alpha > 0 ? source[i + 1] / alpha : 0;
      output.data[i + 2] = alpha > 0 ? source[i + 2] / alpha : 0;
      output.data[i + 3] = alpha;
    }
    return output;
  }

  function motionBlur(image, options) {
    const opts = options || {};
    const distance = number(opts.motionDistance, 0, 0, 80) * pixelScale(opts);
    if (!distance) return copy(image);
    const degrees = ((number(opts.motionAngle, 0, -3600, 3600) % 180) + 180) % 180;
    if (degrees < 0.001 || degrees > 179.999) return axisBlur(image, distance, false);
    if (Math.abs(degrees - 90) < 0.001) return axisBlur(image, distance, true);
    return directionalBlur(image, distance, degrees * Math.PI / 180);
  }

  function seededRandom(seed) {
    let state;
    if (typeof seed === "number" && Number.isFinite(seed)) state = seed >>> 0;
    else {
      state = 2166136261;
      const value = String(seed == null ? 1337 : seed);
      for (let i = 0; i < value.length; i += 1) state = Math.imul(state ^ value.charCodeAt(i), 16777619) >>> 0;
    }
    if (!state) state = 0x6d2b79f5;
    return function () {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return (state >>> 0) / 4294967296;
    };
  }

  function addNoise(image, options) {
    const opts = options || {};
    const output = copy(image);
    const grain = number(opts.grain, 0, 0, 100);
    if (!grain) return output;
    const amplitude = grain * 2.55;
    const size = Math.max(1, Math.round(number(opts.noiseSize, 1, 1, 8) * pixelScale(opts)));
    const random = seededRandom(opts.noiseSeed == null ? 1337 : opts.noiseSeed);
    const monochrome = opts.noiseMonochrome !== false;
    const gaussian = opts.noiseDistribution !== "uniform";
    let spare = null;
    function sample() {
      if (!gaussian) return (random() * 2 - 1) * amplitude;
      if (spare !== null) {
        const result = spare;
        spare = null;
        return result * amplitude / 3;
      }
      let u;
      let v;
      let squared;
      do {
        u = random() * 2 - 1;
        v = random() * 2 - 1;
        squared = u * u + v * v;
      } while (squared >= 1 || squared === 0);
      const scale = Math.sqrt(-2 * Math.log(squared) / squared);
      spare = v * scale;
      return u * scale * amplitude / 3;
    }
    for (let by = 0; by < image.height; by += size) {
      for (let bx = 0; bx < image.width; bx += size) {
        const red = sample();
        const green = monochrome ? red : sample();
        const blue = monochrome ? red : sample();
        const bottom = Math.min(image.height, by + size);
        const right = Math.min(image.width, bx + size);
        for (let y = by; y < bottom; y += 1) {
          for (let x = bx; x < right; x += 1) {
            const i = (y * image.width + x) * 4;
            if (!image.data[i + 3]) continue;
            output.data[i] = image.data[i] + red;
            output.data[i + 1] = image.data[i + 1] + green;
            output.data[i + 2] = image.data[i + 2] + blue;
          }
        }
      }
    }
    return output;
  }

  const BAYER8 = [
    0, 48, 12, 60, 3, 51, 15, 63,
    32, 16, 44, 28, 35, 19, 47, 31,
    8, 56, 4, 52, 11, 59, 7, 55,
    40, 24, 36, 20, 43, 27, 39, 23,
    2, 50, 14, 62, 1, 49, 13, 61,
    34, 18, 46, 30, 33, 17, 45, 29,
    10, 58, 6, 54, 9, 57, 5, 53,
    42, 26, 38, 22, 41, 25, 37, 21,
  ];

  function bitmap(image, options) {
    const opts = options || {};
    const output = copy(image);
    const step = Math.max(1, Math.round(number(opts.ditherStep, 1, 1, 16) * pixelScale(opts)));
    const width = Math.ceil(image.width / step);
    const height = Math.ceil(image.height / step);
    const tones = new Float32Array(width * height);
    const method = opts.bitmapMethod || "diffusion";
    const threshold = number(opts.thresholdLevel, 128, 0, 255);
    for (let by = 0; by < height; by += 1) {
      for (let bx = 0; bx < width; bx += 1) {
        let sum = 0;
        let weight = 0;
        const bottom = Math.min(image.height, (by + 1) * step);
        const right = Math.min(image.width, (bx + 1) * step);
        for (let y = by * step; y < bottom; y += 1) {
          for (let x = bx * step; x < right; x += 1) {
            const i = (y * image.width + x) * 4;
            const alpha = image.data[i + 3];
            sum += luma(image.data[i], image.data[i + 1], image.data[i + 2]) * alpha;
            weight += alpha;
          }
        }
        tones[by * width + bx] = weight ? sum / weight : 0;
      }
    }
    for (let y = 0; y < height; y += 1) {
      const reverse = method === "diffusion" && y % 2 === 1;
      const direction = reverse ? -1 : 1;
      for (let n = 0; n < width; n += 1) {
        const x = reverse ? width - 1 - n : n;
        const i = y * width + x;
        const limit = method === "ordered" ? (BAYER8[(y % 8) * 8 + x % 8] + 0.5) * 255 / 64 : threshold;
        const tone = tones[i] >= limit ? 255 : 0;
        if (method === "diffusion") {
          const error = tones[i] - tone;
          const ahead = x + direction;
          const behind = x - direction;
          if (ahead >= 0 && ahead < width) tones[i + direction] += error * 7 / 16;
          if (y + 1 < height) {
            if (behind >= 0 && behind < width) tones[i + width - direction] += error * 3 / 16;
            tones[i + width] += error * 5 / 16;
            if (ahead >= 0 && ahead < width) tones[i + width + direction] += error / 16;
          }
        }
        tones[i] = tone;
      }
    }
    for (let y = 0; y < image.height; y += 1) {
      for (let x = 0; x < image.width; x += 1) {
        const i = (y * image.width + x) * 4;
        const tone = tones[Math.floor(y / step) * width + Math.floor(x / step)];
        output.data[i] = tone;
        output.data[i + 1] = tone;
        output.data[i + 2] = tone;
      }
    }
    return output;
  }

  function mosaic(image, options) {
    const opts = options || {};
    const output = copy(image);
    const size = Math.max(1, Math.round(number(opts.mosaicSize, 12, 4, 64) * pixelScale(opts)));
    for (let by = 0; by < image.height; by += size) {
      for (let bx = 0; bx < image.width; bx += size) {
        const bottom = Math.min(image.height, by + size);
        const right = Math.min(image.width, bx + size);
        let red = 0;
        let green = 0;
        let blue = 0;
        let weight = 0;
        for (let y = by; y < bottom; y += 1) {
          for (let x = bx; x < right; x += 1) {
            const i = (y * image.width + x) * 4;
            const alpha = image.data[i + 3];
            red += image.data[i] * alpha;
            green += image.data[i + 1] * alpha;
            blue += image.data[i + 2] * alpha;
            weight += alpha;
          }
        }
        if (!weight) continue;
        red /= weight;
        green /= weight;
        blue /= weight;
        for (let y = by; y < bottom; y += 1) {
          for (let x = bx; x < right; x += 1) {
            const i = (y * image.width + x) * 4;
            if (!image.data[i + 3]) continue;
            output.data[i] = red;
            output.data[i + 1] = green;
            output.data[i + 2] = blue;
          }
        }
      }
    }
    return output;
  }

  function parseColor(value, fallback) {
    if (Array.isArray(value) && value.length >= 3) return value.slice(0, 3).map(v => number(v, 0, 0, 255));
    const text = String(value || fallback).trim();
    if (/^#[0-9a-f]{3}$/i.test(text)) return text.slice(1).split("").map(v => parseInt(v + v, 16));
    if (/^#[0-9a-f]{6}$/i.test(text)) return [1, 3, 5].map(i => parseInt(text.slice(i, i + 2), 16));
    const match = text.match(/^rgb\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/i);
    if (match) return match.slice(1).map(v => number(v, 0, 0, 255));
    return parseColor(fallback, "#000000");
  }

  function gradientMap(image, options) {
    const opts = options || {};
    const output = copy(image);
    const dark = parseColor(opts.duotoneDark, "#071548");
    const light = parseColor(opts.duotoneLight, "#f3bee5");
    const gamma = number(opts.gradientGamma, 1, 0.2, 3);
    const table = new Uint8ClampedArray(256 * 3);
    for (let tone = 0; tone < 256; tone += 1) {
      const amount = Math.pow(tone / 255, 1 / gamma);
      for (let channel = 0; channel < 3; channel += 1) table[tone * 3 + channel] = dark[channel] + (light[channel] - dark[channel]) * amount;
    }
    for (let i = 0; i < image.width * image.height * 4; i += 4) {
      if (!image.data[i + 3]) continue;
      const tone = Math.round(luma(image.data[i], image.data[i + 1], image.data[i + 2]));
      output.data[i] = table[tone * 3];
      output.data[i + 1] = table[tone * 3 + 1];
      output.data[i + 2] = table[tone * 3 + 2];
    }
    return output;
  }

  function apply(image, options) {
    const opts = options || {};
    let output;
    switch (opts.effect) {
      case "circle":
      case "line":
      case "dot":
      case "color": output = halftone(image, opts); break;
      case "bitmap": output = bitmap(image, opts); break;
      case "threshold": output = bitmap(image, Object.assign({}, opts, { bitmapMethod: "threshold", ditherStep: 1 })); break;
      case "mosaic": output = mosaic(image, opts); break;
      default: output = copy(image);
    }
    if (number(opts.motionDistance, 0, 0, 80) > 0) output = motionBlur(output, opts);
    if (number(opts.grain, 0, 0, 100) > 0) output = addNoise(output, opts);
    if (opts.duotone === true) output = gradientMap(output, opts);
    return output;
  }

  return Object.freeze({ apply, motionBlur, addNoise, halftone, bitmap, gradientMap, mosaic });
});
