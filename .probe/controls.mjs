// Probe: reader carousel arrow/dot controls in a real browser.
// Read-only against dist/; writes only screenshots into .probe/shots/.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE = 'http://localhost:4399';
const SHOTS = '.probe/shots';

// Discovery (scan of dist/**/*.html, 80 pages carry data-carousel-track="reader"):
//   slide counts present: 7, 8, 9, 10, 11, 14. No page has 2-4 slides.
//   >12 slides: /projects/volta/ (ru, 14) and /en/projects/volta/ (en, 14).
const TARGETS = [
  { n: 1, url: '/posts/bayesian-ab-testing/', role: 'FEW (smallest available: 7 slides; no 2-4 page exists)' },
  { n: 2, url: '/projects/volta/', role: 'MANY (14 slides > MAX_DOTS=12)' },
  { n: 3, url: '/projects/ab/', role: 'RU project (7 slides)' },
];

function readState(page) {
  return page.evaluate(() => {
    const track = document.querySelector('[data-carousel-track="reader"]');
    const nav = document.querySelector('[data-carousel="reader"]');
    const dotsWrap = nav ? nav.querySelector('[data-carousel-dots]') : null;
    const dots = Array.from(document.querySelectorAll('.carousel-dot'));
    const prev = nav ? nav.querySelector('[data-carousel-prev]') : null;
    const next = nav ? nav.querySelector('[data-carousel-next]') : null;
    const slides = track ? Array.from(track.querySelectorAll('.reader-slide')) : [];
    const trackRect = track ? track.getBoundingClientRect() : { left: 0 };
    return {
      lang: document.documentElement.lang,
      slides: slides.length,
      navExists: !!nav,
      navHiddenAttr: nav ? nav.hasAttribute('hidden') : null,
      navDisplay: nav ? getComputedStyle(nav).display : null,
      navVisibleBox: nav && nav.getBoundingClientRect().height > 0,
      dots: dots.length,
      dotsHiddenAttr: dotsWrap ? dotsWrap.hasAttribute('hidden') : null,
      dotsHiddenProp: dotsWrap ? dotsWrap.hidden : null,
      dotsDisplay: dotsWrap ? getComputedStyle(dotsWrap).display : null,
      dotPageAttrs: dots.map((d) => d.dataset.page),
      activeDot: dots.findIndex((d) => d.getAttribute('aria-current') === 'true'),
      statusText: nav ? (nav.querySelector('[role="status"]')?.textContent ?? null) : null,
      scrollLeft: Math.round(track ? track.scrollLeft : -1),
      clientWidth: track ? Math.round(track.clientWidth) : -1,
      scrollWidth: track ? Math.round(track.scrollWidth) : -1,
      overflow: track ? Math.round(track.scrollWidth - track.clientWidth) : -1,
      computedPages: track ? Math.max(1, Math.ceil(track.scrollWidth / track.clientWidth)) : -1,
      slideStride: slides.length > 1 ? Math.round(slides[1].getBoundingClientRect().left - slides[0].getBoundingClientRect().left) : -1,
      space4: getComputedStyle(document.documentElement).getPropertyValue('--space-4').trim(),
      dotLabels: dots.map((d) => d.getAttribute('aria-label')),
      prevDisabled: prev ? prev.disabled : null,
      prevExists: !!prev,
      nextDisabled: next ? next.disabled : null,
      slideOffsets: slides.map((s) => Math.round(s.getBoundingClientRect().left - trackRect.left + track.scrollLeft)),
      trackRect: track ? (({ top, height, width }) => ({ top: Math.round(top), height: Math.round(height), width: Math.round(width) }))(track.getBoundingClientRect()) : null,
      slideHeights: slides.map((s) => Math.round(s.getBoundingClientRect().height)),
      slideTextLen: slides.map((s) => (s.textContent || '').trim().length),
      docScrollY: Math.round(window.scrollY),
      trackCount: document.querySelectorAll('[data-carousel-track="reader"]').length,
      navCount: document.querySelectorAll('[data-carousel="reader"]').length,
      navSiblingOfTrack: !!(document.querySelector('[data-carousel-track="reader"]') && document.querySelector('[data-carousel="reader"]') && document.querySelector('[data-carousel-track="reader"]').parentElement === document.querySelector('[data-carousel="reader"]').parentElement),
    };
  });
}

function printState(page) {
  return page.evaluate(() => {
    const track = document.querySelector('[data-carousel-track="reader"]');
    const slide = track ? track.querySelector('.reader-slide') : null;
    if (!track) return null;
    const cs = getComputedStyle(track);
    const ss = slide ? getComputedStyle(slide) : null;
    const trackW = track.clientWidth;
    const slideW = slide ? Math.round(slide.getBoundingClientRect().width) : -1;
    return {
      display: cs.display,
      overflowX: cs.overflowX,
      scrollSnapType: cs.scrollSnapType,
      slideFlex: ss ? ss.flex : null,
      slideFlexGrow: ss ? ss.flexGrow : null,
      slideFlexShrink: ss ? ss.flexShrink : null,
      slideFlexBasis: ss ? ss.flexBasis : null,
      slideWidth: slideW,
      trackWidth: trackW,
      slideWidthPctOfTrack: trackW ? Math.round((slideW / trackW) * 100) : -1,
      slideCount: track.querySelectorAll('.reader-slide').length,
    };
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Distinguishes "still animating" from "settled off-target": after the fixed
// wait the probe samples scrollLeft every 250ms for 3s.
async function settleSeries(page, label, ms = 3000) {
  const series = [];
  for (let t = 0; t <= ms; t += 250) {
    const v = await page.evaluate(() => {
      const tr = document.querySelector('[data-carousel-track="reader"]');
      return tr ? Math.round(tr.scrollLeft) : -1;
    });
    series.push([label, t, v]);
    await sleep(250);
  }
  return series;
}
const results = [];

const browser = await chromium.launch();
for (const target of TARGETS) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

  await page.goto(BASE + target.url, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-carousel-track="reader"]', { timeout: 20000 });
  await page.waitForTimeout(800);

  const s0 = await readState(page);
  const r = { ...target, s0, errors };

  if (s0.overflow <= 1) {
    r.outcome = s0.navHiddenAttr ? 'no-overflow, nav hidden' : 'no-overflow, nav NOT hidden';
    await page.screenshot({ path: `${SHOTS}/controls-${target.n}.png` });
  } else {
    // next click
    await page.click('[data-carousel-next]');
    await sleep(700);
    const s1 = await readState(page);
    r.s1 = s1;
    r.afterClick1 = await readState(page);
    await page.locator('[data-carousel="reader"]').scrollIntoViewIfNeeded();
    r.afterScrollIntoView = await readState(page);
    await page.screenshot({ path: `${SHOTS}/controls-${target.n}.png` });
    r.afterShot = await readState(page);
    r.renderCheck = await page.evaluate(() => {
      const track = document.querySelector('[data-carousel-track="reader"]');
      const tr = track.getBoundingClientRect();
      const slides = Array.from(track.querySelectorAll('.reader-slide'));
      const lefts = slides.map((s) => Math.round(s.getBoundingClientRect().left - tr.left));
      const covering = slides.findIndex((s, i) => lefts[i] <= 1 && lefts[i] + s.getBoundingClientRect().width > 1);
      return {
        scrollLeft: Math.round(track.scrollLeft),
        slideViewportLeft: lefts,
        coveringSlideIndex: covering,
        firstSlideHeading: (slides[0]?.querySelector('h2,h3')?.textContent || '').trim().slice(0, 40),
        coveringSlideHeading: covering >= 0 ? (slides[covering]?.querySelector('h2,h3')?.textContent || '').trim().slice(0, 40) : null,
      };
    });
    await page.locator('[data-carousel-track="reader"]').screenshot({ path: `${SHOTS}/controls-${target.n}-track.png` });
    // Second shot anchored on the slide body itself (the nav shot alone leaves
    // the track above the fold on tall slides).
    await page.evaluate(() => {
      const tr = document.querySelector('[data-carousel-track="reader"]');
      if (tr) window.scrollTo(0, Math.max(0, tr.getBoundingClientRect().top + window.scrollY - 120));
    });
    await sleep(300);
    r.afterScrollToTrack = await readState(page);
    await page.screenshot({ path: `${SHOTS}/controls-${target.n}-body.png` });

    // prev click back to origin
    await page.click('[data-carousel-prev]');
    await sleep(700);
    const s2 = await readState(page);
    r.s2 = s2;
    r.settleAfterPrev = await settleSeries(page, 'prev');
    const s2settled = await readState(page);
    r.s2settled = s2settled;

    // dot click (last dot), only if dots exist
    if (s2settled.dots > 0) {
      const mid = Math.min(3, s2settled.dots - 1);
      await page.click(`.carousel-dot[data-page="${mid}"]`);
      await sleep(1200);
      const sMid = await readState(page);
      r.dotClickMid = {
        index: mid,
        formulaTarget: mid * s2settled.clientWidth,
        slideOffset: s2settled.slideOffsets[mid] ?? null,
        actual: sMid.scrollLeft,
        deltaVsSlideOffset: s2settled.slideOffsets[mid] != null ? sMid.scrollLeft - s2settled.slideOffsets[mid] : null,
        activeDotAfter: sMid.activeDot,
      };

      const last = s2settled.dots - 1;
      await page.click(`.carousel-dot[data-page="${last}"]`);
      await sleep(1200);
      const s3 = await readState(page);
      r.s3 = s3;
      r.settleAfterDotLast = await settleSeries(page, 'dotLast');
      r.s3settled = await readState(page);
      r.dotClick = {
        lastIndex: last,
        dots: s2settled.dots,
        slides: s2settled.slides,
        formulaTarget: last * s2settled.clientWidth,
        maxScroll: s2settled.overflow,
        slideOffset: s2settled.slideOffsets[last] ?? null,
        actual: s3.scrollLeft,
        settled: r.s3settled.scrollLeft,
        deltaVsFormula: s3.scrollLeft - last * s2settled.clientWidth,
        deltaVsSlideOffset: s2settled.slideOffsets[last] != null ? s3.scrollLeft - s2settled.slideOffsets[last] : null,
        activeDotAfter: s3.activeDot,
        activeDotSettled: r.s3settled.activeDot,
      };
      await page.click('[data-carousel-prev]');
      await sleep(700);
    } else {
      r.dotClick = null;
    }
    r.outcome = 'overflow measured';

    // Does a forced controller refresh rebuild the dot ladder?
    await page.evaluate(() => document.dispatchEvent(new CustomEvent('carousel:refresh')));
    await sleep(800);
    r.afterRefresh = await readState(page);
    r.afterRefresh.dotLabelsLen = r.afterRefresh.dotLabels.length;
  }

  await page.emulateMedia({ media: 'print' });
  await sleep(300);
  r.print = await printState(page);
  await page.emulateMedia({ media: 'screen' });

  await ctx.close();
  results.push(r);
}
await browser.close();

await fs.mkdir(SHOTS, { recursive: true });
await fs.writeFile('.probe/controls.json', JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
