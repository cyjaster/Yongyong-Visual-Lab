// Capture real demo exports once; visitors load only eight small static WebP files.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const packages = 'C:/Users/24369/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const { chromium } = require(packages + 'playwright'), sharp = require(packages + 'sharp');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'assets/templates');
const evidence = path.join(root, 'samples/results/studio/20261012/thumbnails');
(async () => {
  fs.mkdirSync(out, { recursive: true }); fs.mkdirSync(evidence, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, acceptDownloads: true });
    page.setDefaultTimeout(120000); page.on('dialog', dialog => dialog.accept());
    await page.goto('http://localhost:8089/#poster');
    await page.waitForFunction(() => window.posterState?.image?.complete);
    await page.locator('#posterMotionPreference').selectOption('off');
    for (let i = 1; i <= 8; i++) {
      const number = String(i).padStart(2, '0');
      await page.locator(`[data-poster-action="${i === 1 ? 'demo' : 'demo-' + number}"]`).click();
      await page.waitForFunction(i => document.querySelector('#posterMasterRemixTag').textContent.includes(`[${i}/8]`), i);
      await page.waitForFunction(() => !document.querySelector('.poster-paper-transition'));
      const pending = page.waitForEvent('download'); await page.locator('#posterExportButton').click();
      const file = path.join(evidence, `demo-${number}.png`); await (await pending).saveAs(file);
      assert.equal((await sharp(file).metadata()).width, 1200);
      await sharp(file).resize(240, 320).webp({ quality: 76 }).toFile(path.join(out, `template-${number}.webp`));
      console.log('Captured demo ' + number);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
