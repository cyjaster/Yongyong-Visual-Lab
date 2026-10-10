// Run: node checks/filter-engine-regression.cjs
// Behavioral pixel tests: no canvas, browser, image fixtures, or dependencies.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const enginePath = path.join(__dirname, '../poster-filter-engine.js');
const engine = require(enginePath);

let passed = 0, failed = 0;
function test(name, run) {
  try { run(); passed++; console.log(`PASS: ${name}`); }
  catch (error) { failed++; console.error(`FAIL: ${name}\n  ${error.message}`); }
}
function image(width, height, pixel) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    data.set(typeof pixel === 'function' ? pixel(x, y) : pixel, (y * width + x) * 4);
  }
  return { width, height, data };
}
function grayRamp(width = 256, height = 32) {
  return image(width, height, x => {
    const value = Math.round(x / (width - 1) * 255);
    return [value, value, value, 255];
  });
}
function complexFixture(width = 64, height = 48) {
  return image(width, height, (x, y) => [
    (x * 17 + y * 31) % 256, (x * 37 + y * 11) % 256,
    (x * 7 + y * 43) % 256, 255
  ]);
}
function meanChannel(src, channel = 0, x0 = 0, x1 = src.width) {
  let total = 0, count = 0;
  for (let y = 0; y < src.height; y++) for (let x = x0; x < x1; x++) {
    total += src.data[(y * src.width + x) * 4 + channel]; count++;
  }
  return total / count;
}
function meanDifference(a, b) {
  let total = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    total += Math.abs(a.data[i] - b.data[i]);
    total += Math.abs(a.data[i + 1] - b.data[i + 1]);
    total += Math.abs(a.data[i + 2] - b.data[i + 2]);
  }
  return total / (a.width * a.height * 3);
}
function assertChanged(a, b, message) {
  assert.ok(meanDifference(a, b) > 0.1, message);
}
function assertAlphaEqual(a, b) {
  for (let i = 3; i < a.data.length; i += 4) assert.equal(b.data[i], a.data[i], `alpha at pixel ${(i - 3) / 4}`);
}
function assertBinary(src) {
  let white = 0;
  for (let i = 0; i < src.data.length; i += 4) {
    assert.ok(src.data[i] === 0 || src.data[i] === 255, `pixel ${i / 4} is truly binary`);
    assert.equal(src.data[i + 1], src.data[i], 'binary green channel');
    assert.equal(src.data[i + 2], src.data[i], 'binary blue channel');
    if (src.data[i] === 255) white++;
  }
  return white / (src.width * src.height);
}
function lightMoments(src) {
  let energy = 0, xSum = 0, ySum = 0;
  for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
    const value = src.data[(y * src.width + x) * 4];
    energy += value; xSum += x * value; ySum += y * value;
  }
  assert.ok(energy > 0, 'impulse retains energy');
  const cx = xSum / energy, cy = ySum / energy;
  let xx = 0, yy = 0, xy = 0;
  for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
    const value = src.data[(y * src.width + x) * 4];
    xx += (x - cx) ** 2 * value; yy += (y - cy) ** 2 * value;
    xy += (x - cx) * (y - cy) * value;
  }
  return { energy, cx, cy, xx: xx / energy, yy: yy / energy, xy: xy / energy };
}
const clean = { grain: 0, motionDistance: 0, contrast: 0, duotone: false };

test('CommonJS API and browser UMD expose the same operations', () => {
  const names = ['apply', 'motionBlur', 'addNoise', 'halftone', 'bitmap', 'gradientMap'];
  names.forEach(name => assert.equal(typeof engine[name], 'function', `${name} export`));
  const context = {};
  vm.runInNewContext(fs.readFileSync(enginePath, 'utf8'), context, { filename: 'poster-filter-engine.js' });
  names.forEach(name => assert.equal(typeof context.PosterFilterEngine?.[name], 'function', `${name} UMD global`));
});

test('none is a value-preserving copy; all effects retain odd dimensions and input bytes', () => {
  const source = image(19, 11, (x, y) => [x * 13, y * 23, (x + y) * 7, (x * 19 + y * 29) % 256]);
  const original = new Uint8ClampedArray(source.data);
  const untouched = engine.apply(source, { ...clean, effect: 'none' });
  assert.deepEqual(untouched.data, original);
  assert.notEqual(untouched, source); assert.notEqual(untouched.data, source.data);
  for (const effect of ['none', 'circle', 'line', 'dot', 'color', 'mosaic', 'bitmap', 'threshold']) {
    const out = engine.apply(source, { ...clean, effect, halftoneStrength: 80, halftoneSize: 4, noiseSeed: 42 });
    assert.equal(out.width, 19, `${effect}: width`); assert.equal(out.height, 11, `${effect}: height`);
    assert.ok(out.data instanceof Uint8ClampedArray, `${effect}: typed pixel data`);
    assert.equal(out.data.length, original.length, `${effect}: byte length`);
    assert.notEqual(out.data, source.data, `${effect}: owns its output`);
    assert.deepEqual(source.data, original, `${effect}: input is unchanged`);
    assertAlphaEqual(source, out);
  }
});

test('individual exported operations return independent images without mutating their input', () => {
  for (const name of ['motionBlur', 'addNoise', 'halftone', 'bitmap', 'gradientMap']) {
    const source = complexFixture(27, 13), original = new Uint8ClampedArray(source.data);
    const out = engine[name](source, { effect: 'dot', motionDistance: 7, motionAngle: 28,
      grain: 25, noiseSeed: 33, halftoneStrength: 80, halftoneSize: 5, bitmapMethod: 'diffusion',
      duotoneDark: '#132345', duotoneLight: '#eacdea' });
    assert.equal(out.width, source.width, `${name}: width`);
    assert.equal(out.height, source.height, `${name}: height`);
    assert.equal(out.data.length, original.length, `${name}: byte length`);
    assert.ok(out.data instanceof Uint8ClampedArray, `${name}: typed pixel data`);
    assert.notEqual(out.data, source.data, `${name}: independent pixel buffer`);
    assert.deepEqual(source.data, original, `${name}: source bytes intact`);
  }
});

for (const effect of ['circle', 'line', 'dot', 'color']) {
  test(`${effect} halftone responds to dark, light, and photograph luminance`, () => {
    const opts = { ...clean, effect, halftoneStrength: 100, halftoneSize: 6, halftoneAngle: 15 };
    const black = engine.halftone(image(96, 64, [0, 0, 0, 255]), opts);
    const white = engine.halftone(image(96, 64, [255, 255, 255, 255]), opts);
    assert.ok(meanChannel(white) - meanChannel(black) > 160, 'black and white do not produce the same fixed pattern');
    const gradient = engine.halftone(grayRamp(256, 64), opts);
    const left = meanChannel(gradient, 0, 0, 48), right = meanChannel(gradient, 0, 208, 256);
    assert.ok(right - left > 120, `preserves dark/light regions (${left.toFixed(1)} -> ${right.toFixed(1)})`);
    const variation = new Set();
    for (let i = 0; i < gradient.data.length; i += 4) variation.add(gradient.data[i]);
    assert.ok(variation.size >= 2, 'contains meaningful tonal variation');
  });
}

test('halftone strength zero preserves source; strength, scale, angle, and origin affect the result', () => {
  const source = grayRamp(96, 64);
  const base = { ...clean, effect: 'line', halftoneStrength: 75, halftoneSize: 6, halftoneAngle: 0, halftoneOriginX: 50, halftoneOriginY: 50 };
  assert.deepEqual(engine.halftone(source, { ...base, halftoneStrength: 0 }).data, source.data);
  const out = engine.halftone(source, base);
  for (const [key, value] of [['halftoneStrength', 35], ['halftoneSize', 12], ['halftoneAngle', 47], ['halftoneContrast', 70]]) {
    assertChanged(out, engine.halftone(source, { ...base, [key]: value }), `${key} has an observable effect`);
  }
  const radial = { ...base, effect: 'circle', halftoneSize: 7 };
  assertChanged(engine.halftone(source, radial), engine.halftone(source, { ...radial, halftoneOriginX: 13, halftoneOriginY: 24 }), 'circle origin moves the pattern');
});

test('motion blur spreads an impulse horizontally, vertically, and diagonally', () => {
  const impulse = image(49, 49, (x, y) => x === 24 && y === 24 ? [255, 255, 255, 255] : [0, 0, 0, 255]);
  const horizontal = lightMoments(engine.motionBlur(impulse, { motionDistance: 16, motionAngle: 0 }));
  const vertical = lightMoments(engine.motionBlur(impulse, { motionDistance: 16, motionAngle: 90 }));
  const diagonal = lightMoments(engine.motionBlur(impulse, { motionDistance: 16, motionAngle: 45 }));
  assert.ok(horizontal.xx > 4 && horizontal.yy < 0.2, '0 degrees disperses along x');
  assert.ok(vertical.yy > 4 && vertical.xx < 0.2, '90 degrees disperses along y');
  assert.ok(diagonal.xx > 2 && diagonal.yy > 2, '45 degrees disperses along both axes');
  assert.ok(Math.abs(diagonal.xy) / Math.sqrt(diagonal.xx * diagonal.yy) > 0.7, 'diagonal spread follows a line');
  for (const moments of [horizontal, vertical, diagonal]) {
    assert.ok(Math.abs(moments.energy - 255) <= 25, 'approximately preserves impulse light energy');
    assert.ok(Math.abs(moments.cx - 24) < 1 && Math.abs(moments.cy - 24) < 1, 'centered blur preserves impulse location');
  }
});

test('motion blur preserves flat RGBA through all borders and distance zero preserves pixels', () => {
  const source = image(17, 9, [73, 151, 211, 117]);
  for (const angle of [0, 37, 90]) {
    const out = engine.motionBlur(source, { motionDistance: 30, motionAngle: angle });
    for (let i = 0; i < source.data.length; i++) assert.ok(Math.abs(out.data[i] - source.data[i]) <= 1, `flat pixel byte ${i}`);
  }
  const detailed = complexFixture();
  assert.deepEqual(engine.motionBlur(detailed, { motionDistance: 0, motionAngle: 37 }).data, detailed.data);
});

test('motion blur uses alpha correctly and leaves no dark fringe around transparent color', () => {
  const source = image(35, 21, (x, y) => x >= 14 && x <= 20 && y >= 7 && y <= 13 ? [220, 120, 40, 255] : [0, 0, 0, 0]);
  const out = engine.motionBlur(source, { motionDistance: 12, motionAngle: 0 });
  let fractional = 0;
  for (let i = 0; i < out.data.length; i += 4) if (out.data[i + 3] > 0) {
    if (out.data[i + 3] < 255) fractional++;
    for (let channel = 0; channel < 3; channel++) {
      assert.ok(Math.abs(out.data[i + channel] - [220, 120, 40][channel]) <= 3, `premultiplied color at pixel ${i / 4}`);
    }
  }
  assert.ok(fractional > 0, 'transparent boundary actually blurs');
  assert.deepEqual(source.data.slice(0, 4), new Uint8ClampedArray([0, 0, 0, 0]), 'source unchanged');
});

test('noise zero is neutral; equal seeds repeat and different seeds produce different noise', () => {
  const source = image(64, 48, [128, 128, 128, 193]);
  assert.deepEqual(engine.addNoise(source, { grain: 0, noiseSeed: 71 }).data, source.data);
  const opts = { grain: 35, noiseSeed: 71, noiseDistribution: 'uniform', noiseMonochrome: true, noiseSize: 1 };
  const first = engine.addNoise(source, opts), second = engine.addNoise(source, opts);
  assert.deepEqual(first.data, second.data, 'seeded output is reproducible');
  assertChanged(first, engine.addNoise(source, { ...opts, noiseSeed: 72 }), 'different seed changes noise');
  assertAlphaEqual(source, first);
});

test('noise supports monochrome and color channels, distributions, size, and amount', () => {
  const source = image(64, 48, [128, 128, 128, 255]);
  const opts = { grain: 40, noiseSeed: 11, noiseDistribution: 'uniform', noiseMonochrome: true, noiseSize: 1 };
  const mono = engine.addNoise(source, opts), color = engine.addNoise(source, { ...opts, noiseMonochrome: false });
  let chromatic = 0;
  for (let i = 0; i < mono.data.length; i += 4) {
    assert.equal(mono.data[i], mono.data[i + 1], 'monochrome noise has equal R/G');
    assert.equal(mono.data[i], mono.data[i + 2], 'monochrome noise has equal R/B');
    if (color.data[i] !== color.data[i + 1] || color.data[i] !== color.data[i + 2]) chromatic++;
  }
  assert.ok(chromatic > source.width * source.height / 3, 'color noise varies channels independently');
  assertChanged(mono, engine.addNoise(source, { ...opts, noiseDistribution: 'gaussian' }), 'distribution changes noise');
  assertChanged(mono, engine.addNoise(source, { ...opts, noiseSize: 4 }), 'noise size changes pattern');
  assert.ok(meanDifference(source, mono) > meanDifference(source, engine.addNoise(source, { ...opts, grain: 10 })) * 2, 'larger amount produces stronger variation');
});

for (const method of ['diffusion', 'ordered', 'threshold']) {
  test(`bitmap ${method} is binary and retains gray-ramp white area`, () => {
    const ramp = grayRamp(512, 32);
    const out = engine.bitmap(ramp, { bitmapMethod: method, ditherStep: 1, thresholdLevel: 128 });
    const coverage = assertBinary(out);
    assert.ok(Math.abs(coverage - 0.5) < 0.08, `approximately half white: ${coverage.toFixed(3)}`);
    assertAlphaEqual(ramp, out);
  });
}

test('diffusion preserves gray levels through area coverage instead of one threshold', () => {
  const coverages = [64, 128, 192].map(gray => assertBinary(engine.bitmap(image(128, 96, [gray, gray, gray, 255]), { bitmapMethod: 'diffusion', ditherStep: 1 })));
  coverages.forEach((coverage, i) => assert.ok(Math.abs(coverage - [0.25, 0.5, 0.75][i]) < 0.08, `gray ${[64, 128, 192][i]} coverage ${coverage.toFixed(3)}`));
  assert.ok(coverages[0] < coverages[1] && coverages[1] < coverages[2], 'white area tracks source gray levels');
});

test('bitmap method and pixel step have visible effects; threshold level shifts coverage', () => {
  const ramp = grayRamp(127, 43);
  const ordered = engine.bitmap(ramp, { bitmapMethod: 'ordered', ditherStep: 1 });
  assertChanged(ordered, engine.bitmap(ramp, { bitmapMethod: 'diffusion', ditherStep: 1 }), 'diffusion is distinct from ordered pattern');
  assertChanged(ordered, engine.bitmap(ramp, { bitmapMethod: 'ordered', ditherStep: 6 }), 'bitmap step changes the pattern scale');
  const low = assertBinary(engine.apply(ramp, { ...clean, effect: 'threshold', thresholdLevel: 64 }));
  const high = assertBinary(engine.apply(ramp, { ...clean, effect: 'threshold', thresholdLevel: 192 }));
  assert.ok(low - high > 0.4, 'threshold level changes white coverage');
});

test('gradient map respects endpoints, source luminance, alpha, and gamma', () => {
  const source = image(256, 3, x => [x, x, x, 61 + x % 195]);
  const opts = { duotoneDark: '#102060', duotoneLight: '#ffd0e8', gradientGamma: 1 };
  const out = engine.gradientMap(source, opts);
  assert.deepEqual(Array.from(out.data.slice(0, 3)), [16, 32, 96], 'dark endpoint');
  assert.deepEqual(Array.from(out.data.slice(255 * 4, 255 * 4 + 3)), [255, 208, 232], 'light endpoint');
  assert.ok(out.data[192 * 4] > out.data[64 * 4] + 80, 'different source luminance stays distinguishable');
  assertAlphaEqual(source, out);
  assertChanged(out, engine.gradientMap(source, { ...opts, gradientGamma: 2 }), 'gamma changes intermediate tones');
  assertChanged(out, engine.gradientMap(source, { ...opts, duotoneLight: '#66ff77' }), 'color endpoints affect mapping');
});

test('mosaic preserves light/dark regions and changing tile size changes a photograph', () => {
  const source = complexFixture(63, 47);
  const small = engine.apply(source, { ...clean, effect: 'mosaic', mosaicSize: 3 });
  const large = engine.apply(source, { ...clean, effect: 'mosaic', mosaicSize: 12 });
  assertChanged(small, large, 'mosaic size changes pixel grouping');
  const ramp = engine.apply(grayRamp(128, 32), { ...clean, effect: 'mosaic', mosaicSize: 8 });
  assert.ok(meanChannel(ramp, 0, 100, 128) - meanChannel(ramp, 0, 0, 28) > 150, 'mosaic follows source tones');
});

test('combined pipeline is deterministic, changes the source, preserves alpha, and never mutates input', () => {
  const source = complexFixture(71, 39), original = new Uint8ClampedArray(source.data);
  const opts = { effect: 'dot', halftoneStrength: 85, halftoneSize: 5, halftoneAngle: 32,
    contrast: 20, motionDistance: 5, motionAngle: 25, grain: 24, noiseSeed: 901,
    noiseDistribution: 'gaussian', noiseMonochrome: true, noiseSize: 2, duotone: true,
    duotoneDark: '#08236e', duotoneLight: '#f4c2df', gradientGamma: 1.2 };
  const out = engine.apply(source, opts);
  assert.deepEqual(out.data, engine.apply(source, opts).data, 'combined output repeats for the same options');
  assertChanged(source, out, 'effects are applied');
  assert.deepEqual(source.data, original, 'pipeline input is unchanged');
  assertAlphaEqual(source, out);
});

test('line angle zero is horizontal and circle origins can move outside the crop', () => {
  const source = image(37, 31, [128, 128, 128, 255]);
  const horizontal = engine.halftone(source, { effect:'line', halftoneStrength:100, halftoneSize:4, halftoneAngle:0 });
  const vertical = engine.halftone(source, { effect:'line', halftoneStrength:100, halftoneSize:4, halftoneAngle:90 });
  for (let y=0; y<source.height; y++) for (let x=1; x<source.width; x++) {
    assert.equal(horizontal.data[(y*source.width+x)*4], horizontal.data[y*source.width*4], 'horizontal line is constant within a row');
  }
  for (let x=0; x<source.width; x++) for (let y=1; y<source.height; y++) {
    assert.equal(vertical.data[(y*source.width+x)*4], vertical.data[x*4], 'vertical line is constant within a column');
  }
  const opts={effect:'circle',halftoneStrength:100,halftoneSize:4};
  assertChanged(engine.halftone(source,{...opts,halftoneOriginX:0}),engine.halftone(source,{...opts,halftoneOriginX:-50}), 'outside origin must not be silently clamped to the edge');
});

console.log(`\nFilter engine regression: ${passed} passed, ${failed} failed.`);
if (failed) process.exitCode = 1;
