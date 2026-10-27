import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:4399';
const PAGES = process.argv.slice(2);
if (!PAGES.length) PAGES.push('/posts/churn-uplift-discount/', '/projects/ab/');

const browser = await chromium.launch();
const out = [];

for (const path of PAGES) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(800);

  const shape = await page.evaluate(() => {
    const track = document.querySelector('[data-carousel-track="reader"]');
    const slides = track ? [...track.querySelectorAll(':scope > .reader-slide')] : [];
    const tocLinks = [...document.querySelectorAll('#inner-toc a')];
    const insideToc = document.getElementById('inner-toc');
    const tocVisible = insideToc ? getComputedStyle(insideToc).display !== 'none' && insideToc.getClientRects().length > 0 : false;
    return {
      hasTrack: !!track,
      slides: slides.length,
      trackScrollWidth: track?.scrollWidth ?? null,
      trackClientWidth: track?.clientWidth ?? null,
      tocLinks: tocLinks.length,
      tocVisible,
      headings: [...document.querySelectorAll('#project-content h2, #project-content h3')].map((h) => ({
        id: h.id,
        tag: h.tagName,
        slide: h.closest('.reader-slide')?.dataset.slide ?? null,
        offsetTop: h.offsetTop,
        scrollLeftParent: track?.scrollLeft ?? null,
      })),
      tocHrefs: tocLinks.map((a) => ({ href: a.getAttribute('href'), id: a.dataset.id, text: a.textContent.slice(0, 30) })),
    };
  });

  // pick three links whose target heading lives in slides 2+, spread out
  const picks = [];
  for (const link of shape.tocHrefs) {
    const h = shape.headings.find((x) => x.id === link.id);
    if (!h || h.slide === null) continue;
    const slideNo = Number(h.slide);
    if (slideNo >= 2) picks.push({ ...link, slide: slideNo });
  }
  const chosen = picks.length ? [picks[0], picks[Math.floor(picks.length / 2)], picks[picks.length - 1]] : [];

  const clicks = [];
  for (const c of chosen) {
    const before = await page.evaluate(() => {
      const t = document.querySelector('[data-carousel-track="reader"]');
      return { scrollLeft: t.scrollLeft, windowY: window.scrollY, hash: location.hash };
    });
    // click the real anchor from the DOM (Cyrillic/percent-encoded safe)
    await page.evaluate((id) => {
      const a = [...document.querySelectorAll('#inner-toc a')].find((x) => x.dataset.id === id);
      a.click();
    }, c.id);
    await page.waitForTimeout(1200);
    const after = await page.evaluate((id) => {
      const t = document.querySelector('[data-carousel-track="reader"]');
      const h = document.getElementById(id);
      const tr = t.getBoundingClientRect();
      const hr = h ? h.getBoundingClientRect() : null;
      const active = [...document.querySelectorAll('#inner-toc a.active')].map((a) => a.dataset.id);
      const focusId = document.activeElement?.id ?? null;
      return {
        scrollLeft: t.scrollLeft,
        windowY: window.scrollY,
        hash: location.hash,
        headingRect: hr ? { left: Math.round(hr.left), top: Math.round(hr.top) } : null,
        trackRect: { left: Math.round(tr.left), right: Math.round(tr.right) },
        headingInsideTrack: hr ? hr.left >= tr.left - 2 && hr.right <= tr.right + 2 : null,
        active,
        focusId,
      };
    }, c.id);
    clicks.push({ target: c, before, after });
  }

  // active-follow test: scroll the track manually, see if highlight changes
  const manual = await page.evaluate(async () => {
    const t = document.querySelector('[data-carousel-track="reader"]');
    const beforeActive = [...document.querySelectorAll('#inner-toc a.active')].map((a) => a.dataset.id);
    const before = t.scrollLeft;
    t.scrollLeft = t.clientWidth * 2;
    await new Promise((r) => setTimeout(r, 900));
    const midActive = [...document.querySelectorAll('#inner-toc a.active')].map((a) => a.dataset.id);
    return { before, after: t.scrollLeft, beforeActive, midActive };
  });

  out.push({ path, shape, clicks, manual });
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify(out, null, 1));
