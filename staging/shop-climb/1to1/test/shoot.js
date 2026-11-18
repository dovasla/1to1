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
  // 1. First entry: tree picker with Skip for now at the top
  await page.goto(url('tree')); await page.waitForSelector('.sc-skip');
  await page.screenshot({ path: out('climb-entry-skip-390.png') });
  // 2. Skill tree (gold, level 15 with 3 picks done, 3 pending)
  await page.goto(url('path')); await page.waitForSelector('.sc-map');
  await page.screenshot({ path: out('climb-tree-390.png') });
  // 3. Tapped node: the first offer on the ready row
  await page.goto(url('pick')); await page.waitForSelector('.sc-tile--offer');
  await page.click('.sc-tile--offer >> nth=0');
  await page.waitForSelector('.sc-sheet');
  await page.screenshot({ path: out('climb-node-sheet-390.png') });
  // 4. Respec sheet
  await page.goto(url('respec')); await page.waitForSelector('.sc-map');
  await page.click('[data-act="respec-open"]'); await page.waitForSelector('.sc-sheet');
  await page.screenshot({ path: out('climb-respec-390.png') });
  // 5. Celebration (level 45+)
  await page.goto(url('cel')); await page.waitForSelector('.sc-cel');
  await page.waitForTimeout(400);
  await page.screenshot({ path: out('climb-celebrate-390.png') });
  // End to end: skip, then pick a tree, then lock a reward, then check respec is one-time
  await page.goto(url('entry')); await page.waitForSelector('.sc-skip');
  await page.click('.sc-skip'); await page.waitForSelector('.sc-bar');
  await page.click('.sc-bar .sc-btn-sm'); await page.waitForSelector('.sc-tree');
  await page.click('.sc-tree >> nth=2'); await page.waitForSelector('.sc-map');
  await page.click('.sc-tile--offer >> nth=0'); await page.click('.sc-sheet [data-act="lock"]');
  await page.waitForSelector('.sc-tile--done');
  const done = await page.$$eval('.sc-tile--done', n => n.length);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  console.log(JSON.stringify({ doneTilesAfterLockIn: done, horizontalOverflow: overflow, errors }));
  await browser.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
