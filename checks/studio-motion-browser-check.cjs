// UI-only loops: verify visible phases, editing pause, exports and bounded idle work.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const packages = 'C:/Users/24369/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const { chromium } = require(packages + 'playwright'), sharp = require(packages + 'sharp');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'samples/results/studio-motion/20261012');
const samples = JSON.parse(fs.readFileSync(path.join(root, 'samples/aespa/manifest.json'))).images.filter(a => ['aespa-03', 'aespa-20'].includes(a.id));
const report = { checks: [], exports: [], performance: [], errors: [] }; let browser, page;
const loops = () => page.evaluate(() => document.getAnimations().filter(a => /^(studio-|lab-)/.test(a.animationName)).map(a => ({ name: a.animationName, state: a.playState, duration: a.effect.getTiming().duration, frames: a.effect.getKeyframes() })));
const ready = () => page.waitForFunction(() => document.body.dataset.ambient === 'on' && document.body.dataset.ambientEditing === 'false' && !document.querySelector('.poster-paper-transition'));
async function png(name) {
  const pending = page.waitForEvent('download'); await page.locator('#posterExportButton').click();
  const file = path.join(out, name + '.png'); await (await pending).saveAs(file);
  assert.equal((await sharp(file).metadata()).width, 1200); report.exports.push(name);
  return crypto.createHash('sha256').update(await sharp(file).raw().toBuffer()).digest('hex');
}
async function probe(mode, enabled) {
  await page.locator('#posterMotionPreference').selectOption(enabled ? 'on' : 'off');
  if (enabled) await ready();
  return page.evaluate(async ({ mode, enabled }) => {
    const create = document.createElement.bind(document), read = CanvasRenderingContext2D.prototype.getImageData;
    const times = [], tasks = []; let canvases = 0, reads = 0;
    document.createElement = (tag, ...args) => { if (tag === 'canvas') canvases++; return create(tag, ...args); };
    CanvasRenderingContext2D.prototype.getImageData = function (...args) { reads++; return read.apply(this, args); };
    const observer = new PerformanceObserver(list => tasks.push(...list.getEntries().map(e => e.duration))); observer.observe({ type: 'longtask' });
    try {
      const start = performance.now(); let previous = start;
      await new Promise(resolve => { function tick(now) { times.push(now - previous); previous = now; if (now - start < 1500) requestAnimationFrame(tick); else resolve(); } requestAnimationFrame(tick); });
      return { mode, enabled, intervals: times, longTasks: tasks, canvases, reads };
    } finally { observer.disconnect(); document.createElement = create; CanvasRenderingContext2D.prototype.getImageData = read; }
  }, { mode, enabled });
}
(async () => {
  fs.mkdirSync(out, { recursive: true });
  browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  page = await browser.newPage({ viewport: { width: 1280, height: 900 }, acceptDownloads: true }); page.setDefaultTimeout(60000);
  page.on('dialog', d => d.accept()); page.on('pageerror', e => report.errors.push(e.message));
  await page.goto('http://localhost:8089/?check=studio-motion#poster'); await page.evaluate(() => window.visualLab?.enterEdit()); await page.waitForFunction(() => window.posterState?.image?.complete);
  await page.locator('#posterMotionPreference').selectOption('on'); await ready();
  assert.equal((await loops()).length, 13);
  for (const loop of await loops()) for (const frame of loop.frames) assert.ok(Object.keys(frame).every(k => ['offset', 'computedOffset', 'easing', 'composite', 'transform', 'opacity'].includes(k)), loop.name);
  const bounds = await page.locator('#posterCanvas').boundingBox(), history = await page.evaluate(() => JSON.stringify(posterHistory));
  const sweep = () => page.locator('#posterFilterRemixButton').evaluate(e => getComputedStyle(e, '::after').transform);
  const phase = await sweep(); await page.waitForTimeout(1200); assert.notEqual(await sweep(), phase);
  assert.deepEqual(await page.locator('#posterCanvas').boundingBox(), bounds); assert.equal(await page.evaluate(() => JSON.stringify(posterHistory)), history);
  const header = await page.locator('#posterStatus').boundingBox(); await page.mouse.move(header.x + 4, header.y + 4); await page.mouse.down(); await page.waitForTimeout(1400);
  const paused = await loops(); assert.ok(paused.filter(a => a.name.startsWith('studio-')).every(a => a.state === 'paused'));
  assert.equal(paused.filter(a => a.state === 'paused').length, 11); await page.mouse.up(); await ready(); assert.ok((await loops()).every(a => a.state === 'running'));
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.locator('#posterMotionPreference').selectOption('auto'); assert.equal((await loops()).length, 0);
  await page.locator('#posterMotionPreference').selectOption('on'); await ready(); assert.equal((await loops()).length, 13); assert.ok((await loops()).every(a => a.duration >= 6000));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  for (const mode of ['poster', 'filter']) {
    await page.locator(`[data-mode="${mode}"]`).click(); await page.locator('#posterMotionPreference').selectOption('on'); await ready();
    assert.equal((await loops()).length, mode === 'poster' ? 13 : 8);
    for (const enabled of [false, true, true, false]) {
      const result = await probe(mode, enabled); report.performance.push(result); assert.equal(result.canvases, 0); assert.equal(result.reads, 0);
    }
  }
  report.checks.push('13 poster / 8 filter bounded CSS loops; transform/opacity only, stable canvas/history, 11 surfaces pause when editing, system/off and explicit On');
  await page.locator('[data-mode="poster"]').click();
  for (const [name, list] of [['single-03', [samples[0]]], ['single-20', [samples[1]]], ['pair', samples]]) {
    await page.locator('#posterMotionPreference').selectOption('off'); await page.locator('[data-poster-action="demo"]').click();
    await page.waitForFunction(() => !posterHasUserUploadedImages() && document.querySelector('#posterMasterRemixTag').textContent.includes('[1/8]'));
    await page.locator('#posterImageInput').setInputFiles(list.map(a => path.join(root, 'samples/aespa', a.original)));
    await page.waitForFunction(n => posterHasUserUploadedImages() && posterState.assets.length === n, list.length);
    const before = await png(name + '-off'); await page.locator('#posterMotionPreference').selectOption('on'); await ready(); assert.equal(await png(name + '-on'), before);
    if (name === 'pair') {
      const pool = await page.evaluate(() => JSON.stringify(posterState.assets));
      for (let i = 0; i < 8; i++) {
        const tag = await page.locator('#posterMasterRemixTag').textContent(); await page.locator('#posterMasterRemixDock').click();
        await page.waitForFunction(tag => document.querySelector('#posterMasterRemixTag').textContent !== tag, tag); await ready();
        assert.equal(await page.evaluate(() => JSON.stringify(posterState.assets)), pool);
      }
      const secondary = await page.evaluate(() => posterState.assets.find(a => a.id !== posterState.mainImageId).id); await page.evaluate(id => posterSetMainImage(id), secondary);
      await page.locator('#posterMotionPreference').selectOption('off'); const swapped = await png('swapped-off');
      await page.locator('#posterMotionPreference').selectOption('on'); await ready(); assert.equal(await png('swapped-on'), swapped);
    }
  }
  for (const mode of ['poster', 'filter']) {
    await page.locator(`[data-mode="${mode}"]`).click();
    for (const width of [1280, 968, 390]) {
      await page.setViewportSize({ width, height: 900 }); if (mode === 'poster') await page.locator('[data-zoom-action="fit"]').click();
      await page.locator('.topbar').scrollIntoViewIfNeeded(); await ready();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.equal((await loops()).length, mode === 'poster' ? width === 390 ? 11 : 13 : width === 390 ? 6 : 8);
      await page.screenshot({ path: path.join(out, `${mode}-${width}.png`) });
    }
  }
  await page.locator('[data-mode="poster"]').click(); await page.setViewportSize({ width: 1280, height: 900 });
  await page.locator('[data-poster-action="demo"]').click(); await page.waitForFunction(() => !posterHasUserUploadedImages()); await page.locator('[data-zoom-action="fit"]').click(); await ready();
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#toast')).opacity === '0');
  for (const time of [0, 2500]) {
    await page.evaluate(time => { for (const a of document.getAnimations().filter(a => /^(studio-|lab-)/.test(a.animationName))) { a.pause(); a.currentTime = time; } }, time);
    await page.screenshot({ path: path.join(out, `phase-${time}.png`) });
  }
  for (const sample of samples) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'samples/aespa', sample.original))).digest('hex'), sample.sha256);
  assert.deepEqual(report.errors, []); report.checks.push('Eight real PNGs identical On/Off, 03/20 single/pair/swapped, eight master groups retain uploads, both modes at three widths, no errors or source changes');
  console.log('PASS expanded studio motion');
})().catch(error => { report.failure = error.stack; console.error(error); process.exitCode = 1; }).finally(async () => {
  fs.writeFileSync(path.join(out, 'verification.json'), JSON.stringify(report, null, 2)); await browser?.close();
});
