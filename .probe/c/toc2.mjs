import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:4399';
const browser = await chromium.launch();
const res = {};

async function open(path) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(700);
  return { ctx, page };
}

// 1) post page: click two TOC links whose heading sits in a later slide
{
  const { ctx, page } = await open('/posts/churn-uplift-discount/');
  const info = await page.evaluate(() => {
    const track = document.querySelector('[data-carousel-track="reader"]');
    const hs = [...track.querySelectorAll('h2,h3')];
    return {
      slides: track.querySelectorAll(':scope > .reader-slide').length,
      headings: hs.map((h) => ({ id: h.id, offsetTop: h.offsetTop, slide: h.closest('.reader-slide')?.dataset.slide ?? null })),
      tocCount: document.querySelectorAll('#inner-toc a').length,
    };
  });
  const clicks = [];
  for (const id of ['выводы', 'uplift-таргетинг-кому-дать-скидку']) {
    const before = await page.evaluate(() => {
      const t = document.querySelector('[data-carousel-track="reader"]');
      return { scrollLeft: t.scrollLeft, windowY: window.scrollY, hash: location.hash };
    });
    await page.evaluate((id) => [...document.querySelectorAll('#inner-toc a')].find((a) => a.dataset.id === id)?.click(), id);
    await page.waitForTimeout(1100);
    const after = await page.evaluate((id) => {
      const t = document.querySelector('[data-carousel-track="reader"]');
      const h = document.getElementById(id);
      const tr = t.getBoundingClientRect();
      const hr = h.getBoundingClientRect();
      return {
        scrollLeft: t.scrollLeft, windowY: window.scrollY, hash: location.hash,
        hLeft: Math.round(hr.left), trackL: Math.round(tr.left), trackR: Math.round(tr.right),
        inside: hr.left >= tr.left - 2 && hr.right <= tr.right + 2,
        active: [...document.querySelectorAll('#inner-toc a.active')].map((a) => a.dataset.id),
      };
    }, id);
    clicks.push({ id, before, after });
  }
  res.post = { info, clicks };
  await ctx.close();
}

// 2) native hash navigation (JS handler bypassed): does the browser scroll the TRACK?
{
  const { ctx, page } = await open('/projects/ab/');
  const before = await page.evaluate(() => document.querySelector('[data-carousel-track="reader"]').scrollLeft);
  await page.evaluate(() => { window.scrollTo(0, 0); location.hash = '#документация'; });
  await page.waitForTimeout(900);
  const after = await page.evaluate(() => {
    const t = document.querySelector('[data-carousel-track="reader"]');
    const tr = t.getBoundingClientRect();
    const hr = document.getElementById('документация').getBoundingClientRect();
    return { scrollLeft: t.scrollLeft, windowY: window.scrollY, hLeft: Math.round(hr.left), trackL: Math.round(tr.left), inside: hr.left >= tr.left - 2 && hr.right <= tr.right + 2 };
  });
  // also focus() a heading in slide 4 (what the handler does at InnerTOC:119)
  const focusRes = await page.evaluate(async () => {
    const t = document.querySelector('[data-carousel-track="reader"]');
    const target = document.getElementById('ограничения');
    const s0 = t.scrollLeft;
    target.tabIndex = -1;
    target.focus({ preventScroll: false });
    await new Promise((r) => setTimeout(r, 700));
    return { s0, s1: t.scrollLeft };
  });
  res.nativeHash = { before, after, focusRes };
  await ctx.close();
}

// 3) non-carousel page that still shows the TOC (glossary / about)
{
  for (const p of ['/glossary/', '/about/', '/contact/']) {
    const { ctx, page } = await open(p);
    res['plain:' + p] = await page.evaluate(() => {
      const track = document.querySelector('[data-carousel-track="reader"]');
      const toc = document.getElementById('inner-toc');
      return {
        track: !!track,
        slideChildren: track ? track.querySelectorAll(':scope > .reader-slide').length : 0,
        trackScrollable: track ? track.scrollWidth - track.clientWidth : null,
        tocLinks: document.querySelectorAll('#inner-toc a').length,
        tocVisible: toc ? getComputedStyle(toc).display !== 'none' : false,
      };
    });
    await ctx.close();
  }
}

await browser.close();
console.log(JSON.stringify(res, null, 1));
