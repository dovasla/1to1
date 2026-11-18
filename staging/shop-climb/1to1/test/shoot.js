// Screenshots at 390px, deviceScaleFactor 2. Run from this folder: node shoot.js
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const url = v => 'file://' + path.join(__dirname, 'climb-harness.html') + '?v=' + v;
  const out = p => path.join(__dirname, 'shots', p);
  await page.goto(url('tree')); await page.waitForSelector('.sc-tree');
  await page.screenshot({ path: out('climb-tree-390.png') });
  await page.goto(url('path')); await page.waitForSelector('.sc-path');
  await page.screenshot({ path: out('climb-path-390.png') });
  await page.goto(url('pick')); await page.waitForSelector('.sc-go');
  await page.click('.sc-go'); await page.waitForSelector('.sc-opt');
  await page.click('.sc-opt >> nth=1'); // Title
  await page.screenshot({ path: out('climb-pick-390.png') });
  await page.goto(url('respec')); await page.waitForSelector('.sc-respec');
  await page.click('[data-act="respec-open"]'); await page.waitForSelector('.sc-sheet');
  await page.screenshot({ path: out('climb-respec-390.png') });
  await page.goto(url('cel')); await page.waitForSelector('.sc-cel');
  await page.waitForTimeout(400);
  await page.screenshot({ path: out('climb-celebrate-390.png') });
  // Tap a pick end to end: open pick, choose Simple, lock in
  await page.goto(url('pick')); await page.waitForSelector('.sc-go');
  await page.click('.sc-go'); await page.waitForSelector('.sc-opt');
  await page.click('.sc-opt >> nth=0'); await page.click('[data-act="lock"]');
  await page.waitForSelector('.sc-node.is-done');
  const done = await page.$$eval('.sc-node.is-done', n => n.length);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  console.log(JSON.stringify({ doneNodesAfterLockIn: done, horizontalOverflow: overflow, errors }));
  await browser.close();
})().catch(e => { console.error('FAILED', e); process.exit(1); });
