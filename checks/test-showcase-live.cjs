const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const packages = 'C:/Users/24369/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const { chromium } = require(packages + 'playwright');

(async () => {
  const outDir = path.resolve(__dirname, '../samples/results/showcase-live-20261013');
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
  });

  const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, acceptDownloads: true });
  const errors = [];

  page.on('pageerror', err => {
    console.error('Page error:', err.message);
    errors.push(err.message);
  });
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error('Console error:', msg.text());
      errors.push('Console error: ' + msg.text());
    }
  });
  page.on('response', resp => {
    if (resp.status() >= 400 && !resp.url().endsWith('favicon.ico')) {
      console.log('HTTP Error:', resp.status(), resp.url());
      errors.push(`HTTP ${resp.status()} ${resp.url()}`);
    }
  });

  console.log('1. Navigating to root entrance http://127.0.0.1:8090/ ...');
  await page.goto('http://127.0.0.1:8090/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // 1.1 Assert root entrance defaults to showcase presentation
  const isShowcase = await page.evaluate(() => document.body.classList.contains('is-showcase'));
  assert.equal(isShowcase, true, 'Root entry must have is-showcase class on body');

  const toolsVisible = await page.locator('.poster-tools').isVisible();
  const inspectorVisible = await page.locator('.poster-inspector').isVisible();
  assert.equal(await page.locator('.poster-action-dock').count(), 1, 'Toolbar selector matches the real element');
  const toolbarVisible = await page.locator('.poster-action-dock').isVisible();
  assert.equal(await page.locator('.workspace').isVisible(), false, 'Inactive Filter workspace stays hidden');
  const dockVisible = await page.locator('#showcaseFloatingDock').isVisible();
  const enterBtnVisible = await page.locator('#showcaseEnterButton').isVisible();

  assert.equal(toolsVisible, false, 'Left tools sidebar hidden in showcase mode');
  assert.equal(inspectorVisible, false, 'Right inspector sidebar hidden in showcase mode');
  assert.equal(toolbarVisible, false, 'Toolbar hidden in showcase mode');
  assert.equal(dockVisible, true, 'Showcase floating dock visible');
  assert.equal(enterBtnVisible, true, 'Topbar enter button visible');
  await page.locator('#showcaseDockAction').click();
  await page.goBack();
  assert.equal(await page.locator('#showcaseFloatingDock').isVisible(), true, 'Back restores showcase');
  await page.goForward();
  assert.equal(await page.locator('.poster-action-dock').isVisible(), true, 'Forward restores editor');
  await page.locator('#showcaseBackButton').click();

  await page.screenshot({ path: path.join(outDir, '01-showcase-desktop-poster.png') });
  console.log('PASS: Root entrance defaults to centered showcase without edit panels');

  // 1.2 Test double click on canvas entering edit mode
  console.log('2. Testing double click on artwork to enter edit mode ...');
  const canvasWrap = page.locator('#posterCanvasWrap');
  await canvasWrap.dblclick({ force: true });
  await page.waitForTimeout(500);

  const isEditAfterDblClick = await page.evaluate(() => !document.body.classList.contains('is-showcase'));
  const toolsVisibleEdit = await page.locator('.poster-tools').isVisible();
  const currentHash = await page.evaluate(() => window.location.hash);

  assert.equal(isEditAfterDblClick, true, 'Double-click leaves showcase mode');
  assert.equal(toolsVisibleEdit, true, 'Left tools sidebar visible in edit mode');
  assert.equal(currentHash, '#poster', 'Hash is #poster in poster edit mode');

  await page.screenshot({ path: path.join(outDir, '02-edit-mode-after-dblclick.png') });
  console.log('PASS: Double click enters edit mode seamlessly');

  // 1.3 Test return to showcase via poster toolbar button
  console.log('3. Testing return to showcase via poster toolbar button ...');
  const posterBackBtn = page.locator('#posterShowcaseBackButton');
  await posterBackBtn.click();
  await page.waitForTimeout(500);

  const isShowcaseAfterReturn = await page.evaluate(() => document.body.classList.contains('is-showcase'));
  assert.equal(isShowcaseAfterReturn, true, 'Returned to showcase mode');
  assert.equal(await page.locator('.poster-tools').isVisible(), false, 'Sidebars hidden again');
  console.log('PASS: Poster toolbar button returns to showcase cleanly');

  // 1.4 Test Enter key entering edit mode
  console.log('4. Testing Enter key entering edit mode ...');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => !document.body.classList.contains('is-showcase')), true, 'Enter key entered edit mode');

  // 1.5 Test topbar return button
  console.log('5. Testing topbar return button ...');
  await page.locator('#showcaseBackButton').click();
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => document.body.classList.contains('is-showcase')), true, 'Topbar back button returned to showcase');
  console.log('PASS: Enter key and Topbar return button work seamlessly');

  // 1.6 Test brand click return
  console.log('6. Testing brand logo return ...');
  await page.locator('#showcaseDockAction').click(); // Enter edit
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => !document.body.classList.contains('is-showcase')), true);
  await page.locator('.brand').click(); // Click brand
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => document.body.classList.contains('is-showcase')), true, 'Brand logo click returned to showcase');
  console.log('PASS: Brand logo returns to showcase');

  // 1.7 Test Filter Lab in showcase mode
  console.log('7. Testing 01 Filter Lab in showcase mode ...');
  await page.locator('.mode-tab[data-mode="filter"]').click();
  await page.waitForTimeout(500);

  const filterVisible = await page.locator('.workspace').isVisible();
  const filterInspectorVisible = await page.locator('.inspector').isVisible();
  const filterHeadingVisible = await page.locator('.stage-heading').isVisible();

  assert.equal(filterVisible, true, 'Filter workspace visible');
  assert.equal(await page.locator('#posterWorkspace').isVisible(), false, 'Inactive Poster workspace stays hidden');
  assert.equal(filterInspectorVisible, false, 'Filter inspector hidden in showcase');
  assert.equal(filterHeadingVisible, false, 'Filter heading hidden in showcase');

  await page.screenshot({ path: path.join(outDir, '03-showcase-desktop-filter.png') });

  // Test Filter double click to edit
  await page.locator('.canvas-frame').dblclick({ force: true });
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => !document.body.classList.contains('is-showcase')), true, 'Filter double click entered edit');
  assert.equal(await page.locator('.inspector').isVisible(), true, 'Filter inspector visible in edit');

  // Return to showcase
  await page.locator('#showcaseBackButton').click();
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => document.body.classList.contains('is-showcase')), true);

  // Switch back to Poster
  await page.locator('.mode-tab[data-mode="poster"]').click();
  await page.waitForTimeout(500);

  // 1.8 Test responsive viewports (968px and 390px)
  console.log('8. Testing responsive viewports: 968px tablet & 390px mobile ...');
  await page.setViewportSize({ width: 968, height: 760 });
  await page.waitForTimeout(400);

  const scrollWidth968 = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth968 = await page.evaluate(() => document.documentElement.clientWidth);
  assert.ok(scrollWidth968 <= clientWidth968 + 1, 'No horizontal overflow at 968px');
  await page.screenshot({ path: path.join(outDir, '04-showcase-968-tablet.png') });

  // 390px Mobile Viewport
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);

  const scrollWidth390 = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth390 = await page.evaluate(() => document.documentElement.clientWidth);
  assert.ok(scrollWidth390 <= clientWidth390 + 1, 'No horizontal overflow at 390px mobile');

  const dockBox = await page.locator('#showcaseFloatingDock').boundingBox();
  assert.ok(dockBox && dockBox.y + dockBox.height <= 844, 'Floating dock visible in 390px viewport');
  const cardBox = await page.locator('#posterCanvasWrap').boundingBox();
  assert.ok(cardBox && cardBox.x >= 0 && cardBox.x + cardBox.width <= 390 && cardBox.y >= 0 && cardBox.y + cardBox.height <= dockBox.y, 'Poster card is fully visible above the controls on the first mobile screen');

  await page.screenshot({ path: path.join(outDir, '05-showcase-390-mobile.png') });
  console.log('PASS: 968px and 390px responsive viewports verified without horizontal overflow');

  // 1.9 Test PNG export consistency across showcase toggle
  console.log('9. Testing PNG export parity before and after showcase toggle ...');
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.keyboard.press('Enter'); // enter edit mode
  await page.waitForTimeout(500);

  // Export 1
  const downloadPromise1 = page.waitForEvent('download');
  await page.locator('#posterExportButton').click();
  const download1 = await downloadPromise1;
  const file1 = path.join(outDir, 'export-before-toggle.png');
  await download1.saveAs(file1);

  // Toggle to showcase and back
  await page.locator('#posterShowcaseBackButton').click();
  await page.waitForTimeout(500);
  await page.locator('#showcaseEnterButton').click();
  await page.waitForTimeout(500);

  // Export 2
  const downloadPromise2 = page.waitForEvent('download');
  await page.locator('#posterExportButton').click();
  const download2 = await downloadPromise2;
  const file2 = path.join(outDir, 'export-after-toggle.png');
  await download2.saveAs(file2);

  const buf1 = fs.readFileSync(file1);
  const buf2 = fs.readFileSync(file2);
  assert.ok(buf1.equals(buf2), 'Exported PNG bytes match identically before and after showcase toggle');
  console.log('PASS: Exported PNG bytes are bit-for-bit identical across showcase toggling');

  for (const mode of ['poster', 'filter']) {
    await page.goto(`http://127.0.0.1:8090/?entry=${mode}#${mode}`);
    assert.equal(await page.locator('#showcaseFloatingDock').isVisible(), true, 'Old editing links start in showcase');
    assert.ok(page.url().endsWith('#showcase'));
    await page.locator('#showcaseDockAction').click();
    assert.ok(page.url().endsWith('#' + mode));
    await page.reload();
    assert.equal(await page.locator('#showcaseFloatingDock').isVisible(), true, 'Reloading an editor returns to showcase');
  }

  // Error check
  console.log('Observed errors during entire live session:', errors);
  assert.equal(errors.length, 0, 'No console or page errors allowed');

  await browser.close();
  console.log('ALL LIVE SHOWCASE BROWSER ACCEPTANCE TESTS PASSED!');
})();
