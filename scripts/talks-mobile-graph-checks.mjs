// Graph- and tab-level phone checks for /talks/, split out of
// verify-talks-mobile.mjs to keep that entry point under the repo's file-size
// budget. Same contract: each `check()` prints PASS/FAIL and records a failure.
//
// Three claims are bound here, all of them invisible to a DOM assertion:
//   (d) node labels do not sit on top of each other;
//   (e) the zoom controls exist, are finger-sized, and actually zoom;
//   (f) no tab strip hides its last tab behind a horizontal swipe.

export async function checkGraphLabelsAndTabs({ openPhone, settle, sleep, check, PHONE }) {
  // --- (d) labels do not overlap -------------------------------------------
  // The defect this gate exists for: at 390px the overview's 13 labels used to
  // pile onto each other («Без трека» over «АРХИТЕКТУРА»), which is invisible in
  // a DOM assertion and obvious on a phone. Every label is measured, including
  // the hover-only ones — their box is what collides, not their opacity.
  {
    const page = await openPhone(PHONE);
    await settle(page);
    const boxes = await page.evaluate(() => {
      const svg = document.querySelector('#talks-overview-svg');
      if (!svg) return null;
      return [...svg.querySelectorAll('.pg-label')].map((el) => {
        const r = el.getBoundingClientRect();
        return { t: el.textContent.trim(), x1: r.left, y1: r.top, x2: r.right, y2: r.bottom };
      });
    });
    if (!boxes || boxes.length < 2) {
      check('[390px] graph labels do not overlap', false, 'fewer than 2 labels rendered');
    } else {
      const hits = [];
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          const a = boxes[i];
          const b = boxes[j];
          // 1px of slack: sub-pixel kerning is not a collision.
          if (a.x1 < b.x2 - 1 && b.x1 < a.x2 - 1 && a.y1 < b.y2 - 1 && b.y1 < a.y2 - 1) {
            hits.push(`«${a.t}» × «${b.t}»`);
          }
        }
      }
      check(
        '[390px] graph labels do not overlap',
        hits.length === 0,
        `${boxes.length} label(s), ${hits.length} overlapping pair(s)${hits.length ? `: ${hits.slice(0, 3).join(', ')}` : ''}`,
      );
    }
    await page.close();
  }

  // --- (e) the zoom controls exist, are finger-sized and actually zoom ------
  {
    const page = await openPhone(PHONE);
    await settle(page);
    const btns = await page.evaluate(() => {
      const root = document.querySelector('[data-pg-root]');
      if (!root) return null;
      return [...root.querySelectorAll('.pg-btn')].map((b) => {
        const r = b.getBoundingClientRect();
        return { name: b.getAttribute('aria-label') || '', w: r.width, h: r.height };
      });
    });
    if (!btns || btns.length === 0) {
      check('[390px] the graph offers zoom controls a finger can hit', false, 'no .pg-btn rendered');
    } else {
      const smallest = btns.reduce((m, b) => Math.min(m, b.w, b.h), Infinity);
      check(
        '[390px] the graph offers zoom controls a finger can hit',
        smallest >= 24 && btns.length >= 3,
        `${btns.length} button(s), smallest ${smallest.toFixed(0)}px — ${btns.map((b) => b.name).join(', ')}`,
      );

      const transform = () =>
        page.evaluate(
          () =>
            document.querySelector('#talks-overview-svg .pg-viewport')?.getAttribute('transform') || '',
        );
      const before = await transform();
      await page.click('#talks-overview-svg ~ .pg-controls [data-pg-zoom="in"]').catch(() => {});
      await sleep(200);
      const after = await transform();
      check(
        '[390px] the «+» zoom button scales the graph',
        !!after && after !== before,
        `transform «${before || 'none'}» → «${after || 'none'}»`,
      );
      check(
        '[390px] zooming does not navigate',
        new URL(page.url()).pathname.endsWith('/talks/'),
        new URL(page.url()).pathname,
      );
    }
    await page.close();
  }

  // --- (f) no tab strip has to be swiped ------------------------------------
  // A strip that overflows by even a few pixels hides its last tab behind a
  // gesture the reader has no reason to expect, so the threshold is 1px, not
  // "looks fine".
  {
    const page = await openPhone(PHONE);
    await settle(page);
    const measure = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('.section-tablist')]
          .filter((el) => el.offsetParent)
          .map((el) => ({
            label: el.getAttribute('aria-label') || '',
            overflow: el.scrollWidth - el.clientWidth,
            tabs: el.querySelectorAll('.section-tab').length,
            h: Math.round(el.getBoundingClientRect().height),
          })),
      );
    const pageStrips = await measure();
    const bad = pageStrips.filter((s) => s.overflow > 1);
    check(
      '[390px] no tab strip scrolls sideways',
      pageStrips.length > 0 && bad.length === 0,
      pageStrips.map((s) => `${s.tabs} tab(s) h=${s.h}px overflow=${s.overflow}`).join('; '),
    );

    await page.evaluate(() =>
      [...document.querySelectorAll('[role="tab"]')].find((t) => t.dataset.tab === 'tracks')?.click(),
    );
    await sleep(800);
    const trackStrips = await measure();
    const badTracks = trackStrips.filter((s) => s.overflow > 1);
    check(
      '[390px] the twelve track tabs scroll sideways no more than the page tabs',
      trackStrips.length > 0 && badTracks.length === 0,
      trackStrips
        .filter((s) => s.tabs > 5)
        .map((s) => `${s.tabs} tab(s) h=${s.h}px overflow=${s.overflow}`)
        .join('; '),
    );
    await page.close();
  }
}
