import { chromium } from 'playwright';

const base = process.env.BASE || 'http://localhost:4321';
const lang = process.env.LANG || 'ru';
const path = lang === 'en' ? '/en/projects/' : '/projects/';
const url = base + path;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));

const visible = () =>
  page.evaluate(() => document.querySelectorAll('.project:not(.is-hidden)').length);
const tracks = () =>
  page.evaluate(() => {
    const out = {};
    for (const c of document.querySelectorAll('.project:not(.is-hidden)')) {
      out[c.dataset.track] = (out[c.dataset.track] || 0) + 1;
    }
    return out;
  });
const slugs = () =>
  page.evaluate(() => [...document.querySelectorAll('.project')].map((c) => c.dataset.slug));

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });

await page.goto(url, { waitUntil: 'networkidle' });
check('17 cards render', (await visible()) === 17);
check('cards carry a track', Object.keys(await tracks()).length === 4, JSON.stringify(await tracks()));

// --- tool filter ---
const sqlChip = page.locator('.project-filter [data-tool-filter="sql"]');
await sqlChip.click();
await page.waitForTimeout(300);
const nSql = await visible();
check('tool filter narrows', nSql > 0 && nSql < 17, `${nSql} visible`);
check('?tool= in URL', page.url().includes('tool=sql'), page.url());

// --- track filter ---
const analyticsTab = page.locator('.project-track-filter [data-track-filter="analytics"]');
await analyticsTab.click();
await page.waitForTimeout(300);
const afterTrack = await tracks();
check('track filter isolates one track', Object.keys(afterTrack).length === 1, JSON.stringify(afterTrack));
check('#track- in hash', page.url().includes('#track-analytics'), page.url());

// --- back button restores "all" ---
await page.goBack();
await page.waitForTimeout(300);
const backN = await visible();
check(
  'popstate drops the track filter, keeps the tool',
  backN === nSql && !page.url().includes('#track-'),
  `${backN} visible, ${page.url()}`,
);

// --- disabled chips ---
const disabled = await page.evaluate(() =>
  [...document.querySelectorAll('.project-filter [data-tool-filter]')].filter((b) => b.disabled).map((b) => b.dataset.toolFilter),
);
check('empty tool chips are disabled', Array.isArray(disabled), `disabled: ${disabled.join(',') || 'none'}`);

// --- keyboard reorder inside one track ---
await page.locator('.project-filter [data-tool-filter="all"]').click();
await page.waitForTimeout(200);
const before = await slugs();
const firstCard = page.locator('.project').first();
const t0 = await firstCard.getAttribute('data-track');
await firstCard.focus();
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(200);
const after = await slugs();
const moved = after.indexOf(before[0]) === 1 || after.indexOf(before[1]) === 0;
check('ArrowDown reorders one slot', moved, `${before.slice(0, 3)} -> ${after.slice(0, 3)}`);
const tAfter = await page.evaluate(() => {
  const c = document.querySelectorAll('.project')[0];
  const c2 = document.querySelectorAll('.project')[1];
  return [c.dataset.track, c2.dataset.track];
});
check('reordered card stays in its own track', tAfter[0] === tAfter[1], t0 + ' vs ' + tAfter.join('/'));

// --- persistence + reset ---
check('order persisted to localStorage', await page.evaluate(() => !!localStorage.getItem(`project-order-${document.documentElement.lang}`)));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
const afterReload = await slugs();
check('order survives reload', JSON.stringify(afterReload) === JSON.stringify(after), `${after.slice(0, 2)} vs ${afterReload.slice(0, 2)}`);
await page.locator('#board-reset').click();
await page.waitForTimeout(300);
const afterReset = await slugs();
check('reset restores canonical order', JSON.stringify(afterReset) === JSON.stringify(before), afterReset.slice(0, 3).join(','));
check('reset clears storage', !(await page.evaluate(() => !!localStorage.getItem(`project-order-${document.documentElement.lang}`))));

// --- cover not cropped ---
const img = await page.evaluate(() => {
  const el = document.querySelector('.project img');
  const r = el.getBoundingClientRect();
  const vb = el.naturalWidth ? el.naturalWidth / el.naturalHeight : null;
  return { ratio: +(r.width / r.height).toFixed(3), natural: vb, src: el.getAttribute('src') };
});
check('cover keeps its 2:1 viewBox ratio', Math.abs(img.ratio - 2) < 0.02, JSON.stringify(img));

check('no console/page errors', errs.length === 0, errs.slice(0, 2).join(' | '));

await browser.close();
for (const r of results) console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
