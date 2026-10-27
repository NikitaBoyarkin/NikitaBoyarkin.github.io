import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, 'shots');

const PAGES = [
  { n: 1, label: 'RU post',    url: 'http://localhost:4399/posts/github-actions-automation/' },
  { n: 2, label: 'RU project', url: 'http://localhost:4399/projects/volta/' },
  { n: 3, label: 'EN post',    url: 'http://localhost:4399/en/posts/cohort-triangles-retention/' },
  { n: 4, label: 'EN project', url: 'http://localhost:4399/en/projects/volta/' },
];

mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const results = [];

for (const p of PAGES) {
  const page = await ctx.newPage();
  await page.goto(p.url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  const m = await page.evaluate(() => {
    const track = document.querySelector('[data-carousel-track="reader"]');
    if (!track) return { missing: 'no [data-carousel-track="reader"]' };
    const cs = getComputedStyle(track);
    const slides = [...track.querySelectorAll('.reader-slide')];
    const s0 = slides[0] || null;
    const s0cs = s0 ? getComputedStyle(s0) : null;
    const tr = track.getBoundingClientRect();
    const s0r = s0 ? s0.getBoundingClientRect() : null;

    // descendants overflowing the track's right edge
    const over = [];
    for (const el of track.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > tr.right + 1) {
        over.push({ tag: el.tagName.toLowerCase(), cls: el.className && el.className.toString ? el.className.toString() : '', right: +r.right.toFixed(1), over: +(r.right - tr.right).toFixed(1) });
      }
    }
    // dedupe by tag+class, keep the worst
    const byKey = new Map();
    for (const o of over) {
      const k = o.tag + '|' + o.cls;
      if (!byKey.has(k) || byKey.get(k).over < o.over) byKey.set(k, o);
    }

    // content overflowing SLIDE 0 itself (the meaningful case: content wider than snap width)
    const overSlide0 = [];
    if (s0 && s0r) {
      for (const el of s0.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.right > s0r.right + 1) {
          overSlide0.push({ tag: el.tagName.toLowerCase(), cls: el.className && el.className.toString ? el.className.toString() : '', over: +(r.right - s0r.right).toFixed(1) });
        }
      }
    }
    const s0ByKey = new Map();
    for (const o of overSlide0) {
      const k = o.tag + '|' + o.cls;
      if (!s0ByKey.has(k) || s0ByKey.get(k).over < o.over) s0ByKey.set(k, o);
    }

    // per-slide width spread: does any slide deviate from clientWidth?
    const slideDeltas = slides.map((s, i) => ({ i, dataSlide: s.getAttribute('data-slide'), d: +(s.getBoundingClientRect().width - track.clientWidth).toFixed(2) })).filter((x) => Math.abs(x.d) > 1);

    // browser-default h1 baseline (same document, outside prose) for comparison
    let baselineH1 = null;
    const probe = document.createElement('div');
    probe.setAttribute('data-probe-baseline', '');
    probe.innerHTML = '<h1>baseline</h1>';
    document.body.appendChild(probe);
    const bh = getComputedStyle(probe.querySelector('h1'));
    baselineH1 = { fontSize: bh.fontSize, fontWeight: bh.fontWeight, lineHeight: bh.lineHeight, letterSpacing: bh.letterSpacing };
    probe.remove();

    const rootFontSize = getComputedStyle(document.documentElement).fontSize;

    // h1 inside slide 0
    let h1 = null;
    const s0h1 = s0 ? s0.querySelector('h1') : null;
    if (s0h1) {
      const h = getComputedStyle(s0h1);
      h1 = {
        text: (s0h1.textContent || '').trim().slice(0, 60),
        fontSize: h.fontSize, fontWeight: h.fontWeight,
        lineHeight: h.lineHeight, letterSpacing: h.letterSpacing, fontFamily: h.fontFamily.slice(0, 40),
      };
    }
    // fallback: any h1 inside the track
    let h1Any = null;
    const tH1 = track.querySelector('h1');
    if (tH1 && !s0h1) {
      const h = getComputedStyle(tH1);
      h1Any = { text: (tH1.textContent || '').trim().slice(0, 60), fontSize: h.fontSize, fontWeight: h.fontWeight, lineHeight: h.lineHeight, letterSpacing: h.letterSpacing };
    }

    const nums = slides.map((s) => Number(s.getAttribute('data-slide')));
    let ascending = true, contiguous = true;
    for (let i = 1; i < nums.length; i++) {
      if (!(nums[i] > nums[i - 1])) ascending = false;
      if (nums[i] !== nums[i - 1] + 1) contiguous = false;
    }

    return {
      slideCount: slides.length,
      trackScrollWidth: track.scrollWidth,
      trackClientWidth: track.clientWidth,
      overflowPresent: track.scrollWidth > track.clientWidth,
      display: cs.display,
      overflowX: cs.overflowX,
      scrollSnapType: cs.scrollSnapType,
      gap: cs.gap,
      slideFlex: s0cs ? s0cs.flex : null,
      slideFlexBasis: s0cs ? s0cs.flexBasis : null,
      slideScrollSnapAlign: s0cs ? s0cs.scrollSnapAlign : null,
      slideMinWidth: s0cs ? s0cs.minWidth : null,
      slide0Width: s0r ? +s0r.width.toFixed(2) : null,
      widthDelta: s0r ? +(s0r.width - track.clientWidth).toFixed(2) : null,
      dataSlides: nums,
      ascending, contiguous,
      h1, h1Any,
      overflowing: [...byKey.values()].slice(0, 12),
      overflowingCount: byKey.size,
      overSlide0: [...s0ByKey.values()],
      slideDeltas,
      baselineH1,
      rootFontSize,
      docScrollsX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      docScrollWidth: document.documentElement.scrollWidth,
      docClientWidth: document.documentElement.clientWidth,
    };
  });

  // bring the track into the viewport so a viewport screenshot actually shows it
  await page.evaluate(() => {
    const t = document.querySelector('[data-carousel-track="reader"]');
    if (t) t.scrollIntoView({ block: 'start', inline: 'nearest' });
  });
  await page.waitForTimeout(250);

  const initialPath = path.join(SHOTS, `desktop-${p.n}-initial.png`);
  await page.screenshot({ path: initialPath });
  if (!existsSync(initialPath)) throw new Error('screenshot not written: ' + initialPath);

  // scroll track to slide 1
  await page.evaluate(async () => {
    const t = document.querySelector('[data-carousel-track="reader"]');
    if (t) { t.scrollLeft = t.clientWidth; }
  });
  await page.waitForTimeout(400);
  // re-pin the track to the top of the viewport so the screenshot shows slide 1's head
  await page.evaluate(() => {
    const t = document.querySelector('[data-carousel-track="reader"]');
    if (t) t.scrollIntoView({ block: 'start', inline: 'nearest' });
  });
  await page.waitForTimeout(250);
  const after = await page.evaluate(() => {
    const t = document.querySelector('[data-carousel-track="reader"]');
    const all = document.querySelectorAll('[data-carousel-track="reader"]').length;
    const slides = t ? [...t.querySelectorAll('.reader-slide')] : [];
    const s1 = slides[1] || null;
    const vp = (el) => { const r = el.getBoundingClientRect(); return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1), right: +r.right.toFixed(1), bottom: +r.bottom.toFixed(1) }; };
    return {
      scrollLeft: t ? t.scrollLeft : null,
      clientWidth: t ? t.clientWidth : null,
      tracksOnPage: all,
      windowScrollY: window.scrollY,
      trackRect: t ? vp(t) : null,
      slide0Rect: slides[0] ? vp(slides[0]) : null,
      slide1Rect: s1 ? vp(s1) : null,
      slide1Text: s1 ? (s1.textContent || '').trim().slice(0, 80) : null,
      slide1H2: s1 ? (s1.querySelector('h2')?.textContent || '').trim() : null,
      trackH: t ? t.getBoundingClientRect().height : null,
      maxScrollLeft: t ? t.scrollWidth - t.clientWidth : null,
    };
  });
  const slide1Path = path.join(SHOTS, `desktop-${p.n}.png`);
  await page.screenshot({ path: slide1Path });
  if (!existsSync(slide1Path)) throw new Error('screenshot not written: ' + slide1Path);

  results.push({ ...p, m, afterScroll: after });
  await page.close();
}

await browser.close();

// ---- print ----
const pad = (s, n) => String(s).padEnd(n);
console.log('\n=== URLS ===');
for (const r of results) console.log(`${r.n} ${pad(r.label, 12)} ${r.url}`);

console.log('\n=== GEOMETRY ===');
console.log(pad('page', 14) + pad('slides', 8) + pad('trackW', 9) + pad('trackSW', 9) + pad('overflow', 10) + pad('slideW', 9) + pad('delta', 8) + pad('display', 12) + pad('overflow-x', 12) + 'scroll-snap-type');
for (const r of results) {
  const m = r.m;
  if (m.missing) { console.log(pad(r.label, 14) + 'MISSING: ' + m.missing); continue; }
  console.log(
    pad(r.label, 14) + pad(m.slideCount, 8) + pad(m.trackClientWidth, 9) + pad(m.trackScrollWidth, 9) +
    pad(m.overflowPresent, 10) + pad(m.slide0Width, 9) + pad(m.widthDelta, 8) +
    pad(m.display, 12) + pad(m.overflowX, 12) + m.scrollSnapType
  );
}

console.log('\n=== SLIDE 0 COMPUTED ===');
console.log(pad('page', 14) + pad('flex', 22) + pad('flex-basis', 14) + pad('snap-align', 12) + 'min-width');
for (const r of results) {
  const m = r.m;
  if (m.missing) continue;
  console.log(pad(r.label, 14) + pad(m.slideFlex, 22) + pad(m.slideFlexBasis, 14) + pad(m.slideScrollSnapAlign, 12) + m.slideMinWidth);
}

console.log('\n=== data-slide ORDER ===');
for (const r of results) {
  const m = r.m;
  if (m.missing) continue;
  console.log(`${pad(r.label, 14)} [${m.dataSlides.join(',')}]  ascending=${m.ascending} contiguous=${m.contiguous}`);
}

console.log('\n=== H1 IN SLIDE 0 ===');
for (const r of results) {
  const m = r.m;
  if (m.missing) continue;
  const h = m.h1 || m.h1Any;
  if (!h) { console.log(`${pad(r.label, 14)} NO-H1`); continue; }
  console.log(`${pad(r.label, 14)} size=${h.fontSize} weight=${h.fontWeight} lh=${h.lineHeight} ls=${h.letterSpacing} src=${m.h1 ? 'slide0' : 'track-fallback'} text="${h.text}"`);
}
console.log(`root font-size=${results[0]?.m?.rootFontSize}  browser-baseline h1=${JSON.stringify(results[0]?.m?.baselineH1)}`);

console.log('\n=== SLIDE 0 CONTENT OVERFLOW (child right > slide0 right, >1px) ===');
for (const r of results) {
  const m = r.m;
  if (m.missing) continue;
  if (!m.overSlide0.length) { console.log(`${pad(r.label, 14)} none`); continue; }
  console.log(`${pad(r.label, 14)} ${m.overSlide0.length} unique:`);
  for (const o of m.overSlide0) console.log(`   ${o.tag}.${o.cls} over=+${o.over}px`);
}

console.log('\n=== SLIDE WIDTHS DEVIATING FROM clientWidth BY >1px ===');
for (const r of results) {
  const m = r.m;
  if (m.missing) continue;
  if (!m.slideDeltas.length) { console.log(`${pad(r.label, 14)} none (all slides == clientWidth)`); continue; }
  console.log(`${pad(r.label, 14)} ${JSON.stringify(m.slideDeltas)}`);
}

console.log('\n=== OVERFLOWING DESCENDANTS (>1px past track right edge) ===');
for (const r of results) {
  const m = r.m;
  if (m.missing) continue;
  if (!m.overflowingCount) { console.log(`${pad(r.label, 14)} none`); continue; }
  console.log(`${pad(r.label, 14)} ${m.overflowingCount} unique:`);
  for (const o of m.overflowing) console.log(`   ${o.tag}.${o.cls} right=${o.right} over=+${o.over}px`);
}

console.log('\n=== DOCUMENT HORIZONTAL SCROLL ===');
for (const r of results) {
  const m = r.m;
  if (m.missing) continue;
  console.log(`${pad(r.label, 14)} scrollsX=${m.docScrollsX} (scrollWidth=${m.docScrollWidth} clientWidth=${m.docClientWidth})`);
}

console.log('\n=== SCROLL TO SLIDE 1 ===');
for (const r of results) {
  const a = r.afterScroll;
  if (!a) { console.log(`${pad(r.label, 14)} n/a`); continue; }
  console.log(`${pad(r.label, 14)} scrollLeft=${a.scrollLeft}/${a.maxScrollLeft} clientWidth=${a.clientWidth} tracksOnPage=${a.tracksOnPage} windowScrollY=${a.windowScrollY}`);
  console.log(`${pad('', 14)} trackRect=${JSON.stringify(a.trackRect)}`);
  console.log(`${pad('', 14)} slide0Rect=${JSON.stringify(a.slide0Rect)}`);
  console.log(`${pad('', 14)} slide1Rect=${JSON.stringify(a.slide1Rect)} h2="${a.slide1H2}"`);
}

console.log('\n=== VERDICT ===');
for (const r of results) {
  const m = r.m;
  if (m.missing) { console.log(`${pad(r.label, 14)} NEED-INFO: ${m.missing}`); continue; }
  const fails = [];
  if (m.display !== 'flex') fails.push(`display=${m.display} (want flex)`);
  if (m.overflowX !== 'auto') fails.push(`overflow-x=${m.overflowX} (want auto)`);
  if (m.scrollSnapType !== 'x mandatory') fails.push(`scroll-snap-type=${m.scrollSnapType} (want x mandatory)`);
  if (Math.abs(m.widthDelta) > 1) fails.push(`slideW-clientW=${m.widthDelta} (want |d|<=1)`);
  if (!m.overflowPresent) fails.push(`no horizontal overflow (scrollWidth=clientWidth=${m.trackClientWidth})`);
  if (!m.ascending) fails.push(`data-slide not ascending: ${m.dataSlides.join(',')}`);
  if (!m.contiguous) fails.push(`data-slide not contiguous: ${m.dataSlides.join(',')}`);
  if (!m.overflowPresent) fails.push('');
  if (m.overflowingCount) {
    // real content overflow only counts if it happens inside slide 0 (other slides legitimately sit past the edge)
    if (m.overSlide0.length) fails.push(`slide0 content overflow: ${m.overSlide0.map((o) => `${o.tag}.${o.cls}+${o.over}px`).join(',')}`);
  }
  if (m.docScrollsX) fails.push(`document scrolls horizontally (${m.docScrollWidth}>${m.docClientWidth})`);
  const a = r.afterScroll;
  if (a && a.maxScrollLeft != null && a.scrollLeft <= 0) fails.push(`track did not scroll (scrollLeft=${a.scrollLeft})`);
  console.log(`${pad(r.label, 14)} ${fails.filter(Boolean).length ? 'FAIL — ' + fails.filter(Boolean).join('; ') : 'PASS'}`);
}
