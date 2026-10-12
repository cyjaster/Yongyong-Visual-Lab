const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const packages = 'C:/Users/24369/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const { chromium } = require(packages + 'playwright'), sharp = require(packages + 'sharp');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'samples/results/studio/20261012');
const samples = JSON.parse(fs.readFileSync(path.join(root, 'samples/aespa/manifest.json'))).images.filter(a => ['aespa-03', 'aespa-20'].includes(a.id));
const report = { baseline: 'd00c288', checks: [], exports: [], errors: [], performance: [] };
let browser, page;
const idle = p => p.waitForFunction(() => !document.querySelector('.poster-paper-transition'));
const settle = p => p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const pixels = async file => crypto.createHash('sha256').update(await sharp(file).raw().toBuffer()).digest('hex');
async function png(p, name) {
  const pending = p.waitForEvent('download'); await p.locator('#posterExportButton').click();
  const file = path.join(out, name + '.png'); await (await pending).saveAs(file);
  assert.equal((await sharp(file).metadata()).width, 1200); report.exports.push(name); return pixels(file);
}
async function template(p, n) {
  for (let i = 0; i < 8 && !(await p.locator('#posterMasterRemixTag').textContent()).includes(`[${n}/8]`); i++) {
    const tag = await p.locator('#posterMasterRemixTag').textContent(); await p.locator('#posterMasterRemixDock').click();
    await p.waitForFunction(tag => document.querySelector('#posterMasterRemixTag').textContent !== tag, tag);
  }
  assert.ok((await p.locator('#posterMasterRemixTag').textContent()).includes(`[${n}/8]`)); await idle(p);
}
async function upload(p, list) {
  await p.locator('[data-poster-action="demo"]').click();
  await p.waitForFunction(() => !posterHasUserUploadedImages() && document.querySelector('#posterMasterRemixTag').textContent.includes('[1/8]'));
  await p.locator('#posterImageInput').setInputFiles(list.map(a => path.join(root, 'samples/aespa', a.original)));
  await p.waitForFunction(n => posterHasUserUploadedImages() && posterState.assets.length === n, list.length); await idle(p);
}
(async () => {
  fs.mkdirSync(out, { recursive: true });
  browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, acceptDownloads: true });
  const old = await browser.newPage({ viewport: { width: 1280, height: 1000 }, acceptDownloads: true });
  const prior = Object.fromEntries(['index.html', 'styles.css', 'poster.css', 'poster.js'].map(file => [file, execFileSync('git', ['show', 'd00c288:' + file], { cwd: root, encoding: 'utf8' })]));
  await old.route('**/*', route => {
    const file = new URL(route.request().url()).pathname.slice(1) || 'index.html';
    return prior[file] ? route.fulfill({ body: prior[file], contentType: file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'application/javascript' : 'text/html' }) : route.continue();
  });
  for (const p of [page, old]) {
    p.setDefaultTimeout(60000); p.on('dialog', d => d.accept()); p.on('pageerror', e => report.errors.push(e.message));
    await p.goto('http://localhost:8089/?check=studio#poster'); await p.waitForFunction(() => window.posterState?.image?.complete);
    await p.locator('#posterMotionPreference').selectOption('off');
  }
  for (const card of await page.locator('.poster-demo-button').all()) {
    await card.scrollIntoViewIfNeeded();
    await card.locator('.poster-demo-art > img').evaluate(img => img.decode());
    assert.equal(await card.locator('.poster-demo-art > img').evaluate(img => img.naturalWidth), 240);
  }
  assert.equal(await page.locator('.poster-demo-button[aria-current="true"]').count(), 1);
  await page.locator('.poster-demo-button').first().scrollIntoViewIfNeeded();
  await page.locator('#posterMotionPreference').selectOption('on');
  await page.waitForFunction(() => document.body.dataset.ambientEditing === 'false');
  const history = await page.evaluate(() => JSON.stringify(posterHistory));
  const art = page.locator('.poster-demo-art').first(), box = await art.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await settle(page);
  await page.mouse.move(box.x + box.width / 2 + 2, box.y + box.height / 2 + 2); await settle(page);
  assert.equal(await art.locator('.poster-demo-lens').evaluate(e => getComputedStyle(e).opacity), '1');
  await page.screenshot({ path: path.join(out, 'gallery-lens.png') });
  for (const enabled of [false, true]) {
    report.performance.push(await page.evaluate(async enabled => {
      document.body.dataset.ambient = enabled ? 'on' : 'off';
      const create = document.createElement.bind(document), read = CanvasRenderingContext2D.prototype.getImageData;
      let canvases = 0, reads = 0; const intervals = [], tasks = [];
      document.createElement = (tag, ...args) => { if (tag === 'canvas') canvases++; return create(tag, ...args); };
      CanvasRenderingContext2D.prototype.getImageData = function (...args) { reads++; return read.apply(this, args); };
      const observer = new PerformanceObserver(list => tasks.push(...list.getEntries().map(e => e.duration))); observer.observe({ type: 'longtask' });
      try {
        const start = performance.now(); let previous = start;
        await new Promise(resolve => { function tick(now) { intervals.push(now - previous); previous = now; if (now - start < 1500) requestAnimationFrame(tick); else resolve(); } requestAnimationFrame(tick); });
        return { enabled, canvases, reads, intervals, longTasks: tasks };
      } finally { observer.disconnect(); document.createElement = create; CanvasRenderingContext2D.prototype.getImageData = read; }
    }, enabled));
  }
  assert.ok(report.performance.every(p => p.canvases === 0 && p.reads === 0));
  assert.equal(await page.evaluate(() => JSON.stringify(posterHistory)), history);
  await page.locator('#posterMotionPreference').selectOption('off'); assert.equal(await art.locator('.poster-demo-lens').evaluate(e => getComputedStyle(e).opacity), '0');
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.locator('#posterMotionPreference').selectOption('auto');
  assert.equal(await page.evaluate(() => document.body.dataset.ambient), 'off'); await page.emulateMedia({ reducedMotion: 'no-preference' });
  report.checks.push('Eight real thumbnails, one active template, pointer lens, no history/pixel work during idle, Off and system reduced motion');
  for (const [name, list] of [['single-03', [samples[0]]], ['single-20', [samples[1]]], ['pair', samples]]) {
    for (const p of [page, old]) { await p.locator('#posterMotionPreference').selectOption('off'); await upload(p, list); }
    for (const n of name === 'pair' ? [1, 6, 8] : [1]) {
      for (const p of [page, old]) await template(p, n);
      assert.equal(await png(page, `${name}-${n}-new`), await png(old, `${name}-${n}-old`));
      assert.equal(await page.evaluate(() => posterState.assets.length), list.length);
    }
  }
  for (const p of [page, old]) {
    await template(p, 1); const secondary = await p.evaluate(() => posterState.assets.find(a => a.id !== posterState.mainImageId).id);
    await p.evaluate(id => posterSetMainImage(id), secondary);
  }
  assert.equal(await png(page, 'swapped-new'), await png(old, 'swapped-old'));
  await page.locator('#posterInspectorTarget').selectOption('main:main-image'); await page.locator('[data-inspector-tab="look"]').click();
  const before = await png(page, 'adjustment-before');
  await page.locator('[data-global="brightness"]').press('End'); await page.locator('[data-global="brightness"]').press('Tab'); await settle(page);
  const adjusted = await png(page, 'adjustment-after'); assert.notEqual(adjusted, before);
  await page.locator('[data-poster-action="undo"]').click(); assert.equal(await png(page, 'adjustment-undo'), before);
  await page.locator('[data-poster-action="redo"]').click(); assert.equal(await png(page, 'adjustment-redo'), adjusted);
  await page.locator('#posterSaveDraftButton').click(); await page.waitForFunction(() => !posterDraftPending());
  await page.reload(); await page.waitForFunction(() => window.posterState?.image?.complete && posterHasUserUploadedImages());
  assert.equal(await png(page, 'draft-restored'), adjusted);
  report.checks.push('03/20 singles, pair, swapped main: 12 baseline PNGs identical; brightness visibly changes PNG, undo/redo and draft preserved');
  await page.locator('#posterMotionPreference').selectOption('on');
  await page.locator('#posterInspectorTarget').selectOption('main:main-image');
  await page.locator('[data-poster-action="frame"]').click();
  async function position(values) {
    await page.locator('[data-inspector-tab="layout"]').click();
    for (const [key, value] of Object.entries(values)) {
      const field = page.locator(`[data-prop="${key}"]`);
      if (key === 'rotation') await field.evaluate((e, value) => { e.value = String(value); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, value);
      else { await field.fill(String(value)); await field.press('Tab'); }
    }
    await settle(page);
  }
  await position({ x: 260, y: 260, w: 100, h: 110, rotation: 0 });
  await page.locator('[data-poster-action="detail"]').first().click(); await position({ x: 650, y: 780, w: 200, h: 230, rotation: 0 });
  const frameId = await page.evaluate(() => posterState.frames.at(-1).id);
  await page.locator('#posterInspectorTarget').selectOption('frame:' + frameId);
  const startPNG = await png(page, 'drag-before');
  const detailHash = () => page.evaluate(async () => {
    const d = posterState.details.at(-1), data = document.querySelector('#posterCanvas').getContext('2d').getImageData(d.x + 10, d.y + 10, d.w - 20, d.h - 20).data;
    return [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].join(',');
  });
  const beforeDetail = await detailHash(), geometry = await page.evaluate(() => {
    const f = posterState.frames.at(-1), r = document.querySelector('#posterCanvas').getBoundingClientRect();
    return { x: r.x + (f.x + 25) * r.width / 900, y: r.y + (f.y + 25) * r.height / 1200, sx: r.width / 900, sy: r.height / 1200 };
  });
  await page.mouse.move(geometry.x, geometry.y); await page.mouse.down();
  assert.equal(await page.evaluate(() => posterState.selected.id), frameId);
  for (let i = 1; i <= 3; i++) {
    await page.mouse.move(geometry.x + i * 18 * geometry.sx, geometry.y + i * 12 * geometry.sy); await settle(page);
    assert.equal(await detailHash(), beforeDetail); assert.equal(await page.evaluate(() => document.body.dataset.ambientEditing), 'true');
  }
  await page.mouse.up(); await settle(page); assert.notEqual(await detailHash(), beforeDetail);
  const releasedPNG = await png(page, 'drag-released'); assert.notEqual(releasedPNG, startPNG);
  await page.locator('[data-poster-action="undo"]').click(); assert.equal(await png(page, 'drag-undo'), startPNG);
  await page.locator('[data-poster-action="redo"]').click(); assert.equal(await png(page, 'drag-redo'), releasedPNG);
  report.checks.push('Actual index-frame drag: linked detail frozen while moving, updates on release; decorations pause and PNG undo/redo are exact');
  for (const mode of ['poster', 'filter']) {
    await page.locator(`[data-mode="${mode}"]`).click();
    for (const width of [1280, 968, 390]) {
      await page.setViewportSize({ width, height: 1000 }); if (mode === 'poster') await page.locator('[data-zoom-action="fit"]').click();
      await page.locator('.topbar').scrollIntoViewIfNeeded(); await settle(page);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      if (mode === 'poster') assert.equal(await page.locator('.poster-stage').evaluate(e => e.scrollLeft), 0);
      await page.screenshot({ path: path.join(out, `${mode}-${width}.png`) });
    }
  }
  for (const sample of samples) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'samples/aespa', sample.original))).digest('hex'), sample.sha256);
  await page.locator('[data-mode="poster"]').click(); await page.setViewportSize({ width: 1280, height: 1000 });
  await page.locator('[data-poster-action="demo-06"]').click();
  await page.waitForFunction(() => !posterHasUserUploadedImages() && document.querySelector('#posterMasterRemixTag').textContent.includes('[6/8]'));
  await page.locator('[data-zoom-action="fit"]').click(); await page.locator('#posterMotionPreference').selectOption('on');
  await page.locator('.poster-demo-button[aria-current="true"]').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#toast')).opacity === '0' && document.body.dataset.ambientEditing === 'false' && !document.querySelector('.poster-paper-transition'));
  assert.equal(await page.locator('.poster-stage').evaluate(e => e.scrollLeft), 0);
  await page.screenshot({ path: path.join(out, 'studio-preview.png') });
  assert.deepEqual(report.errors, []); report.checks.push('Two modes at 1280/968/390, no horizontal overflow, originals unchanged, no page errors');
  console.log('PASS studio browser check');
})().catch(async error => { report.failure = error.stack; console.error(error); process.exitCode = 1;
  if (page) { report.dom = await page.evaluate(() => ({ ambient: document.body.dataset, cards: [...document.querySelectorAll('.poster-demo-art')].map(e => ({ classes: e.className, style: e.getAttribute('style'), hover: e.matches(':hover'), rect: e.getBoundingClientRect().toJSON() })) })); await page.screenshot({ path: path.join(out, 'failure.png') }); console.log(JSON.stringify(report.dom)); }
}).finally(async () => {
  fs.writeFileSync(path.join(out, 'verification.json'), JSON.stringify(report, null, 2)); await browser?.close();
});
