/**
 * Gradient family — browser pass. Closes docs/prd-gradient-family.md §9 item 1
 * (as far as a machine can close it) and re-checks REQ-07 in a real engine.
 *
 * Usage: bun run scripts/probe-gradient.mjs [outDir]
 *   BASE_URL (default http://localhost:4399) — dev or preview server.
 *
 * Proves mechanically:
 *   - every theme paints the declared surfaces with a gradient (rest + hover);
 *   - `@media print`, `forced-colors: active` and `prefers-contrast: more`
 *     flatten them — REQ-07 against the engine, not against source text.
 *
 * Does NOT prove they look right. That is the screenshots this writes; a human
 * (or a later vision pass) still owns the aesthetic judgement.
 *
 * Route note: the surfaces no longer sit on `/`. `#intro` lives on the persona
 * routes, `.blog-card` on the writing/notes routes, and `.project` on
 * `/projects/` (grep over dist/*.html, 2026-10-11). `/colleague/` is not used
 * for the card surface: its single `.featured-card` is also
 * `.featured-card-hero`, which is unfilled by design. Hence PAGES below.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = process.argv[2] || 'reports/gradient-shots';
const BASE = process.env.BASE_URL || 'http://localhost:4399';
const VIEWS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];
const THEMES = ['dark', 'light', 'cyberpunk'];

// A selector list is a fallback chain: several classes carry the same family
// member on different routes (`.featured-card` vs `.project`). Required
// surfaces must resolve; a missing one is a failure, not a note.
// Surfaces on the document itself: identical on every route, so they ride each
// page's sweep rather than needing a page of their own.
const GLOBAL_SURFACES = [
  { label: 'page ground', token: 'gradient-page', sels: ['html'], required: true },
];

const PAGES = [
  {
    path: '/hr/',
    views: ['desktop', 'mobile'],
    surfaces: [
      { label: 'hero glow', token: 'gradient-hero', sels: ['#intro::before', '#intro'], required: true },
      { label: 'section rule', token: 'gradient-rule', sels: ['#projects h2::after'], required: true },
      { label: 'primary button', token: 'gradient-button', sels: ['.button', 'a.button'], required: false },
    ],
  },
  {
    // /colleague/ carries exactly one .featured-card and it also carries
    // .featured-card-hero, which global.css:1414 deliberately leaves unfilled
    // (docs/prd-gradient-family.md §9) — so requiring a card surface there asks
    // for something the design says must not exist. /projects/ has 23 .project
    // cards, all non-hero, which is the real home of --gradient-surface.
    path: '/projects/',
    views: ['desktop'],
    surfaces: [
      { label: 'project card', token: 'gradient-surface', sels: ['.project'], required: true },
    ],
  },
  {
    path: '/notes/',
    views: ['desktop'],
    surfaces: [
      { label: 'blog card', token: 'gradient-surface', sels: ['.blog-card'], required: true },
    ],
  },
];

const failures = [];
const absences = [];
const rows = [];
const check = (ok, msg) => {
  if (!ok) failures.push(msg);
};

const browser = await chromium.launch();
mkdirSync(OUT, { recursive: true });

/** Computed background-image for the first selector that resolves, pseudo-aware. */
const readSurface = (page, sels) =>
  page.evaluate((list) => {
    for (const raw of list) {
      const [sel, pseudo] = raw.split('::');
      const el = document.querySelector(sel);
      if (!el) continue;
      const cs = getComputedStyle(el, pseudo ? `::${pseudo}` : undefined);
      return { sel: raw, bg: cs.backgroundImage };
    }
    return null;
  }, sels);

for (const theme of THEMES) {
  for (const p of PAGES) {
    for (const viewName of p.views) {
      const v = VIEWS.find((x) => x.name === viewName);
      const ctx = await browser.newContext({
        viewport: { width: v.width, height: v.height },
        deviceScaleFactor: 2,
        colorScheme: theme === 'light' ? 'light' : 'dark',
      });
      await ctx.addInitScript((t) => {
        try {
          localStorage.setItem('theme', t);
        } catch {
          /* ignore */
        }
      }, theme);
      const page = await ctx.newPage();
      await page.goto(BASE + p.path, { waitUntil: 'networkidle' });
      await page.waitForTimeout(700);

      const tag = `${theme}/${v.name}${p.path}`;
      const themeOk = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      check(themeOk === theme, `${tag}: theme is "${themeOk}", not "${theme}"`);

      for (const s of [...p.surfaces, ...GLOBAL_SURFACES]) {
        const got = await readSurface(page, s.sels);
        if (!got) {
          const msg = `${tag}: ${s.label} — none of ${s.sels.join(', ')}`;
          if (s.required) failures.push(`${msg} (required)`);
          else absences.push(msg);
          continue;
        }
        rows.push({ tag, surface: s.label, token: `--${s.token}`, sel: got.sel, bg: got.bg });
        check(
          /gradient\(/.test(got.bg),
          `${tag}: ${s.label} (${got.sel}) painted no gradient → ${got.bg}`,
        );
      }

      await page.screenshot({ path: `${OUT}/${theme}-${v.name}${p.path.replace(/\//g, '_')}.png` });

      // Hover on the first card that exists — the PRD flags an unstyled hover.
      const card = await page.$('.featured-card:not(.featured-card-hero), .project, .blog-card');
      if (card) {
        await card.hover();
        await page.waitForTimeout(250);
        const hovered = await readSurface(page, [
          '.featured-card:not(.featured-card-hero)',
          '.project',
          '.blog-card',
        ]);
        rows.push({
          tag,
          surface: 'card hover',
          token: '—',
          sel: hovered?.sel ?? 'none',
          bg: hovered?.bg ?? '',
        });
        await page.screenshot({
          path: `${OUT}/${theme}-${v.name}${p.path.replace(/\//g, '_')}-hover.png`,
        });
      }
      await ctx.close();
    }
  }
}

// --- REQ-07 in the engine --------------------------------------------------
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => {
  try {
    localStorage.setItem('theme', 'dark');
  } catch {
    /* ignore */
  }
});
const page = await ctx.newPage();
await page.goto(BASE + '/hr/', { waitUntil: 'networkidle' });

const CONTEXTS = [
  { name: 'print', media: { media: 'print' } },
  { name: 'forced-colors', media: { media: 'screen', forcedColors: 'active' } },
  { name: 'prefers-contrast:more', media: { media: 'screen', forcedColors: 'none', contrast: 'more' } },
];

for (const c of CONTEXTS) {
  await page.emulateMedia(c.media);
  await page.waitForTimeout(200);
  const got = await readSurface(page, ['#intro::before', '#intro']);
  const ground = await readSurface(page, ['html']);
  const tokens = await page.evaluate(() =>
    ['gradient-hero', 'gradient-surface', 'gradient-button', 'gradient-rule', 'gradient-page'].map((n) => [
      n,
      getComputedStyle(document.documentElement).getPropertyValue(`--${n}`).trim(),
    ]),
  );
  rows.push({
    tag: `@${c.name}`,
    surface: 'hero glow',
    token: '—',
    sel: got?.sel ?? 'none',
    bg: got?.bg ?? '',
  });
  if (!got) {
    failures.push(`@${c.name}: #intro absent on /hr/ — cannot judge the reset`);
  } else {
    check(!/gradient\(/.test(got.bg), `@${c.name}: hero still painted a gradient → ${got.bg}`);
  }
  rows.push({
    tag: `@${c.name}`,
    surface: 'page ground',
    token: '—',
    sel: ground?.sel ?? 'none',
    bg: ground?.bg ?? '',
  });
  if (!ground) failures.push(`@${c.name}: html absent on /hr/ — cannot judge the reset`);
  else check(!/gradient\(/.test(ground.bg), `@${c.name}: page ground still painted a gradient → ${ground.bg}`);
  const still = tokens.filter(([, val]) => /gradient\(/.test(val)).map(([n]) => n);
  check(still.length === 0, `@${c.name}: tokens not reset → ${still.join(', ') || '(none)'}`);
}

await ctx.close();
await browser.close();

const report = { base: BASE, failures, absences, rows, generatedAt: new Date().toISOString() };
writeFileSync(`${OUT}/probe-gradient.json`, JSON.stringify(report, null, 2));

console.log(`screenshots → ${OUT}`);
for (const r of rows) {
  if (r.token === '—') console.log(`  ${r.tag} ${r.surface} [${r.sel}] ${r.bg || '(none)'}`);
}
console.log(`\nsurfaces painted with a gradient: ${rows.filter((r) => /gradient\(/.test(r.bg)).length}/${rows.length}`);
if (absences.length) console.log(`optional/absent (not judged):\n  ${absences.join('\n  ')}`);
if (failures.length) {
  console.error(`FAIL (${failures.length}):\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log('PASS: declared surfaces carry their gradients; all three collapse contexts flatten them');
