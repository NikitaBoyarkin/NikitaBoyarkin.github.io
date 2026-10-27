// Mobile/tablet rendering probe for the reader carousel.
// Read-only: measures built pages served from dist/ at :4399, writes screenshots only.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:4399';
const OUT = path.resolve('.probe/shots');
mkdirSync(OUT, { recursive: true });

const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const VIEWPORTS = [
  { vp: '390x844', width: 390, height: 844, deviceScaleFactor: 3, mobile: true },
  { vp: '768x1024', width: 768, height: 1024, deviceScaleFactor: 1, mobile: false },
];

// case (a) paged + has ##; case (c) outside the four paged collections.
// case (b) = paged page with no ## -> none exists in dist (verified by grep),
// so /about/ + /glossary/ are exercised as guard evidence.
const PAGES = [
  { case: 'a', slug: 'posts-volta', url: '/posts/volta-neobank-case-study/' },
  { case: 'a', slug: 'projects-volta', url: '/projects/volta/' },
  { case: 'c', slug: 'about', url: '/about/' },
  { case: 'c', slug: 'glossary', url: '/glossary/' },
];

const measure = () => {
  const track = document.querySelector('.reader-track');
  const de = document.documentElement;
  const vw = de.clientWidth;
  const out = {
    vw,
    trackExists: !!track,
    slides: 0,
    display: null,
    flexDirection: null,
    overflowX: null,
    scrollWidth: de.scrollWidth,
    clientWidth: de.clientWidth,
    overflowers: [],
    slideW: null,
    trackW: null,
    dots: 0,
    navVisible: false,
  };
  if (track) {
    const cs = getComputedStyle(track);
    out.slides = track.querySelectorAll(':scope > .reader-slide').length;
    out.display = cs.display;
    out.flexDirection = cs.flexDirection;
    out.overflowX = cs.overflowX;
    out.trackW = Math.round(track.clientWidth);
    out.trackScrollW = Math.round(track.scrollWidth);
    out.trackChildren = track.children.length;
    const first = track.querySelector(':scope > .reader-slide');
    if (first) out.slideW = Math.round(first.getBoundingClientRect().width);
    // does the track really scroll?
    track.scrollLeft = 99999;
    out.scrolledTo = Math.round(track.scrollLeft);
    track.scrollLeft = 0;
    const dotsBox = document.querySelector('.carousel-nav[data-carousel="reader"] [data-carousel-dots]');
    out.dotsBoxExists = !!dotsBox;
  }
  const seen = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (r.right <= vw + 1) continue;
    if (el.closest('pre, table, .katex, .carousel-nav')) continue;
    const cls = (el.className && typeof el.className === 'string')
      ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
      : '';
    // Is the element inside its own horizontal scroller (track, tab strip, etc.)?
    let scroller = null;
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const acs = getComputedStyle(a);
      if (['auto', 'scroll', 'hidden'].includes(acs.overflowX)) {
        scroller = (a.className && typeof a.className === 'string'
          ? '.' + a.className.trim().split(/\s+/).slice(0, 2).join('.')
          : a.tagName.toLowerCase()) + `:${acs.overflowX}`;
        break;
      }
    }
    seen.push(
      `${el.tagName.toLowerCase()}${cls} right=${Math.round(r.right)}` +
        (scroller ? ` [in ${scroller}]` : ' [PAGE-LEVEL]'),
    );
  }
  out.overflowers = [...new Set(seen)].slice(0, 8);
  out.pageLevelOverflow = [...new Set(seen)].filter((s) => s.includes('[PAGE-LEVEL]')).length;
  out.dots = document.querySelectorAll('.carousel-dot').length;
  out.tracks = [...document.querySelectorAll('[data-carousel-track]')]
    .map((t) => t.getAttribute('data-carousel-track'))
    .join('+') || 'none';
  const nav = document.querySelector('.carousel-nav[data-carousel="reader"]');
  if (nav) {
    const cs = getComputedStyle(nav);
    const r = nav.getBoundingClientRect();
    out.navVisible = !nav.hasAttribute('hidden') && cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0;
    out.readerDots = nav.querySelectorAll('.carousel-dot').length;
  } else {
    out.readerDots = 0;
  }
  out.navs = [...document.querySelectorAll('.carousel-nav')]
    .map((n) => {
      const cs = getComputedStyle(n);
      const r = n.getBoundingClientRect();
      const vis = !n.hasAttribute('hidden') && cs.display !== 'none' && r.width > 0 && r.height > 0;
      return `${n.getAttribute('data-carousel') || '?'}(${n.querySelectorAll('.carousel-dot').length}d,vis=${vis ? 'y' : 'n'})`;
    })
    .join(',') || 'none';
  return out;
};

const browser = await chromium.launch();
const rows = [];

for (const v of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: v.width, height: v.height },
    deviceScaleFactor: v.deviceScaleFactor,
    isMobile: v.mobile,
    hasTouch: v.mobile,
    userAgent: v.mobile ? MOBILE_UA : undefined,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 90)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push('console:' + msg.text().slice(0, 80));
  });
  for (const p of PAGES) {
    errors.length = 0;
    const resp = await page.goto(BASE + p.url, { waitUntil: 'networkidle', timeout: 60000 });
    const m = await page.evaluate(measure);
    rows.push({ case: p.case, url: p.url, vp: v.vp, status: resp ? resp.status() : 0, ...m, errors: [...errors] });

    const shot = path.join(OUT, `mobile-${p.case}-${p.slug}-${v.vp}.png`);
    await page.screenshot({ path: shot, fullPage: false });

    // stand-in for the case-(b) fullPage shot: guard-evidence page at 390px
    if (p.case === 'c' && v.vp === '390x844') {
      await page.screenshot({ path: path.join(OUT, `mobile-b-${p.slug}-${v.vp}-fullpage.png`), fullPage: true });
    }
  }
  await ctx.close();
}
await browser.close();

// --- supplementary: the :has() guard clause, exercised on a live DOM only.
// No built page renders .reader-track without .reader-slide, so case (b) has no
// fixture. Inject both shapes into a page that loads reader.css and compare.
{
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: MOBILE_UA });
  const pg = await ctx.newPage();
  await pg.goto(BASE + '/posts/volta-neobank-case-study/', { waitUntil: 'networkidle' });
  const guard = await pg.evaluate(() => {
    const host = document.querySelector('main') || document.body;
    const read = (el) => {
      const cs = getComputedStyle(el);
      return { display: cs.display, flexDirection: cs.flexDirection, overflowX: cs.overflowX };
    };
    const empty = document.createElement('div');
    empty.className = 'reader-track';
    empty.innerHTML = '<p>one</p><p>two</p><p>three</p>';
    host.append(empty);
    const emptyRes = read(empty);
    empty.remove();

    const withSlide = document.createElement('div');
    withSlide.className = 'reader-track';
    withSlide.innerHTML = '<section class="reader-slide"><p>x</p></section><section class="reader-slide"><p>y</p></section>';
    host.append(withSlide);
    const slideRes = read(withSlide);
    withSlide.remove();
    return { emptyTrack: emptyRes, trackWithSlides: slideRes };
  });
  await b.close();
  console.log('\n--- runtime-injected guard control @390 (:has(> .reader-slide)) ---');
  console.log('track WITHOUT slide -> ' + JSON.stringify(guard.emptyTrack));
  console.log('track WITH 2 slides -> ' + JSON.stringify(guard.trackWithSlides));
}

const yes = (b) => (b ? 'yes' : 'NO');
const fmt = (r) =>
  [
    `case ${r.case}`,
    r.url,
    r.vp,
    `${r.status}`,
    `${yes(r.trackExists)}/${r.slides}`,
    r.trackExists ? `${r.display}/${r.flexDirection}/${r.overflowX}` : '-',
    `${r.scrollWidth}/${r.clientWidth}${r.scrollWidth > r.clientWidth ? ' SCROLLS' : ''}`,
    `${r.overflowers.length ? r.pageLevelOverflow + ' PAGE-LEVEL of ' + r.overflowers.length : 'none'}`,
    r.slideW != null ? `${r.slideW} vs ${r.trackW}` : '-',
    r.slideW != null ? `trackScrollW=${r.trackScrollW} children=${r.trackChildren} scrolledTo=${r.scrolledTo} dotsBox=${yes(r.dotsBoxExists)}` : '-',
    `allDots=${r.dots} readerDots=${r.readerDots} navs=${r.navs} tracks=${r.tracks}`,
    r.errors.length ? 'ERR:' + r.errors.join('|') : 'no-err',
  ].join(' | ');

console.log('\ncase | url | vp | http | track/slides | display/flexdir/overflow-x | scrollW/clientW | overflow(page/total) | slideW vs trackW | track scroll | dots & navs | errors');
console.log('-'.repeat(150));
for (const r of rows) console.log(fmt(r));
console.log('\n--- overflow detail ---');
for (const r of rows) {
  if (r.overflowers.length) console.log(`${r.case} ${r.url} @${r.vp}: ${r.overflowers.join(' ; ')}`);
}
console.log('\nscreenshots -> ' + OUT);
