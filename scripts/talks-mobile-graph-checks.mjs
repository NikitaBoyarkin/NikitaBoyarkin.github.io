// Graph- and tab-level phone checks for /talks/, split out of
// verify-talks-mobile.mjs to keep that entry point under the repo's file-size
// budget. Same contract: each `check()` prints PASS/FAIL and records a failure.
//
// Five claims are bound here, all of them invisible to a DOM assertion:
//   (d) on a narrow canvas the ring is numbers + a legend: no two drawn labels
//       touch, every number has a key row, and no digit is missing;
//   (e) the zoom controls exist, are finger-sized, and actually zoom;
//   (f) the page-level tab strip stays one wrapped row with nothing hidden
//       sideways, while the nested track/theme strip is ONE scrolling row —
//       a deliberate reversal of the old "no strip may scroll" rule, because
//       twelve Russian track names wrap into a 175–289px wall above the
//       content (measured) and the reader pays for it on every panel;
//   (g) the theme cards on a phone hold all three fields with no horizontal
//       scroll: the time used to be clipped to «11:00–1» at 390px.
//
// NARROW (320px) runs the same geometry claims as PHONE (390px): the defects
// this file exists for were all worse at 320 and the old version only checked
// the document width there.

export async function checkGraphLabelsAndTabs({ openPhone, settle, sleep, check, PHONE, NARROW }) {
  const viewports = [
    { label: '[390px]', viewport: PHONE, path: 'talks/' },
    { label: '[320px]', viewport: NARROW, path: 'talks/' },
  ];

  // --- (d) compact ring: labels, numbers and the key -----------------------
  for (const { label, viewport, path } of viewports) {
    const page = await openPhone(viewport, path);
    await settle(page);

    const ring = await page.evaluate(() => {
      const root = document.querySelector('#talks-overview-svg')?.closest('.pg-root');
      if (!root) return null;
      const boxes = [...root.querySelectorAll('.pg-label')].map((el) => {
        const r = el.getBoundingClientRect();
        return { t: el.textContent.trim(), x1: r.left, y1: r.top, x2: r.right, y2: r.bottom };
      });
      const nums = [...root.querySelectorAll('.pg-num')].map((el) => el.textContent.trim());
      const keyRows = [...root.querySelectorAll('.pg-key a')];
      return {
        compact: root.classList.contains('pg-compact'),
        canvas: Math.round(root.querySelector('svg').getBoundingClientRect().width),
        boxes,
        nums,
        keyRows: keyRows.length,
        keyText: keyRows.map((a) => (a.textContent || '').trim()),
        keyVisible: keyRows.length > 0 ? keyRows[0].getBoundingClientRect().height > 0 : false,
        keySmallest: keyRows.reduce(
          (min, a) => Math.min(min, a.getBoundingClientRect().height),
          Infinity,
        ),
      };
    });

    if (!ring) {
      check(`${label} the overview ring renders`, false, 'no .pg-root around #talks-overview-svg');
      await page.close();
      continue;
    }

    // Labels: on a phone the only drawn label is the centre's. Whatever is
    // drawn must not overlap another drawn label — the old defect class.
    const drawn = ring.boxes;
    const hits = [];
    for (let i = 0; i < drawn.length; i += 1) {
      for (let j = i + 1; j < drawn.length; j += 1) {
        const a = drawn[i];
        const b = drawn[j];
        if (a.x1 < b.x2 - 1 && b.x1 < a.x2 - 1 && a.y1 < b.y2 - 1 && b.y1 < a.y2 - 1) {
          hits.push(`«${a.t}» × «${b.t}»`);
        }
      }
    }
    check(
      `${label} drawn labels do not overlap`,
      hits.length === 0,
      `${drawn.length} label(s), ${hits.length} overlapping pair(s)${hits.length ? `: ${hits.slice(0, 3).join(', ')}` : ''}`,
    );

    // Compact mode is the whole point: names too long for the ring become
    // digits, and the digits must be complete and paired with a key row.
    if (ring.compact) {
      const expected = ring.keyRows;
      const unique = new Set(ring.nums);
      check(
        `${label} the compact ring numbers every keyed node`,
        expected > 0 && ring.nums.length === expected && unique.size === expected,
        `${ring.nums.length} digit(s) / ${expected} key row(s) on a ${ring.canvas}px canvas: ${ring.nums.join(',')}`,
      );
      check(
        `${label} the key under the graph is readable`,
        ring.keyVisible && ring.keyText.every((t) => t.replace(/^\d+\s*/, '').length > 1),
        `${ring.keyRows} row(s), smallest ${Number.isFinite(ring.keySmallest) ? ring.keySmallest.toFixed(0) : 0}px`,
      );
      check(
        `${label} a key row is a finger-sized link`,
        ring.keySmallest >= 24,
        `smallest row ${Number.isFinite(ring.keySmallest) ? ring.keySmallest.toFixed(0) : 0}px`,
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
      return [...root.querySelectorAll('.pg-btn')]
        .map((b) => {
          const r = b.getBoundingClientRect();
          return { name: b.getAttribute('aria-label') || '', w: r.width, h: r.height };
        })
        // Compact rings hide the «Aa» toggle (`display:none` → a 0×0 box): it
        // has no labels to reveal, and a hidden control must not fail a
        // finger-size assertion.
        .filter((b) => b.w > 0 && b.h > 0);
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

  /** Open one page-level panel and describe its nested dashboard on a phone:
   *  is the tablist out of the layout, and is the select a finger-sized control
   *  carrying exactly the tabs? */
  const auditNested = async (page, panelTab) => {
    await page.evaluate((tab) => {
      [...document.querySelectorAll('[role="tab"]')].find((t) => t.dataset.tab === tab)?.click();
    }, panelTab);
    await sleep(800);
    return page.evaluate(() => {
      const lists = [...document.querySelectorAll('.section-tabs--sm .section-tablist')].map((el) => ({
        visible: !!el.offsetParent,
        tabs: el.querySelectorAll('.section-tab').length,
      }));
      const root = [...document.querySelectorAll('.section-tabs--sm')].find(
        (el) => el.querySelector('[data-section-select]')?.offsetParent,
      );
      if (!root) return { lists, select: null };
      const select = root.querySelector('[data-section-select] select');
      const box = select.getBoundingClientRect();
      const options = [...select.options];
      const activeTab = root.querySelector('[role="tab"][aria-selected="true"]');
      return {
        lists,
        select: {
          h: Math.round(box.height),
          w: Math.round(box.width),
          font: parseFloat(getComputedStyle(select).fontSize),
          opts: options.length,
          tabs: root.querySelectorAll('.section-tablist .section-tab').length,
          texts: options.map((o) => (o.text || '').trim()),
          values: options.map((o) => o.value),
          value: select.value,
          activeTab: activeTab?.dataset.tab || null,
          scrolls: select.scrollWidth - select.clientWidth,
          aria: select.getAttribute('aria-label') || '',
        },
      };
    });
  };

  // --- (f) tab strips ------------------------------------------------------
  // The page-level strip (five sections) must still wrap with nothing hidden
  // sideways. The nested strips (twelve tracks / eleven themes) must not be a
  // strip at all on a phone: twelve Russian names measure 2147px against a
  // 358px row, so they collapse into a native select — no sideways scroll,
  // every option one tap away, the current one always named on the control.
  for (const { label, viewport } of [viewports[0], viewports[1]]) {
    const page = await openPhone(viewport);
    await settle(page);
    const measure = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('.section-tablist')]
          .filter((el) => el.offsetParent)
          .map((el) => ({
            nested: !!el.closest('.section-tabs--sm'),
            label: el.getAttribute('aria-label') || '',
            overflow: el.scrollWidth - el.clientWidth,
            tabs: el.querySelectorAll('.section-tab').length,
            h: Math.round(el.getBoundingClientRect().height),
          })),
      );

    const pageStrips = (await measure()).filter((s) => !s.nested);
    const bad = pageStrips.filter((s) => s.overflow > 1);
    check(
      `${label} the page tab strip shows every tab, no sideways scroll`,
      pageStrips.length > 0 && bad.length === 0,
      pageStrips.map((s) => `${s.tabs} tab(s) h=${s.h}px overflow=${s.overflow}`).join('; '),
    );

    // Both nested dashboards are audited, not just the first one: the theme
    // strip had its own wall (289px at 320) and a fix that only reached the
    // track strip would leave it behind.
    for (const panelTab of ['tracks', 'themes']) {
      const nested = await auditNested(page, panelTab);
      const name = panelTab === 'tracks' ? 'track' : 'theme';

      check(
        `${label} the nested ${name} tablist leaves the phone layout`,
        nested.lists.length > 0 && nested.lists.every((l) => !l.visible && l.tabs > 5),
        nested.lists.map((l) => `${l.tabs} tab(s) visible=${l.visible}`).join('; '),
      );
      check(
        `${label} the ${name} select carries every tab, 44px tall, 16px text`,
        !!nested.select &&
          nested.select.opts === nested.select.tabs &&
          nested.select.h >= 44 &&
          nested.select.font >= 16 &&
          nested.select.scrolls <= 1,
        nested.select
          ? `${nested.select.opts}/${nested.select.tabs} option(s), ${nested.select.w}×${nested.select.h}px, ${nested.select.font}px text, sideways ${nested.select.scrolls}px`
          : 'no select rendered',
      );
      check(
        `${label} the ${name} select names the active tab`,
        !!nested.select &&
          nested.select.value === nested.select.activeTab &&
          nested.select.texts.every((t) => t.length > 1),
        nested.select
          ? `select «${nested.select.value}» / active tab «${nested.select.activeTab}», «${nested.select.texts[0]}»`
          : 'no select',
      );

      // Changing the select must open that panel and write its anchor — the
      // same path a chip click takes. A control that only looks right is the
      // failure mode this check is for.
      if (!nested.select || nested.select.opts < 2) continue;
      const target = { value: nested.select.values[1], text: nested.select.texts[1] };
      const anchor = await page.evaluate((value) => {
        const tab = [...document.querySelectorAll('[role="tab"]')].find((t) => t.dataset.tab === value);
        return tab?.dataset.anchor || null;
      }, target.value);
      await page.evaluate((value) => {
        const root = [...document.querySelectorAll('.section-tabs--sm')].find(
          (el) => el.querySelector('[data-section-select]')?.offsetParent,
        );
        const select = root.querySelector('[data-section-select] select');
        select.value = value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }, target.value);
      await sleep(500);
      const after = await page.evaluate((value) => {
        const panel = document.querySelector(`[data-panel="${value}"]`);
        return {
          hash: location.hash,
          open: !!panel && !panel.hidden,
          selected: document.querySelector(`[role="tab"][data-tab="${value}"]`)?.getAttribute('aria-selected'),
        };
      }, target.value);
      check(
        `${label} picking a ${name} in the select opens that panel`,
        after.open && after.selected === 'true' && (!anchor || after.hash === `#${anchor}`),
        `«${target.text}» → hash «${after.hash || 'none'}», panel open=${after.open}, aria-selected=${after.selected}`,
      );
    }

    // Desktop keeps the chips: a wide viewport on the same page must not show a
    // select at all. Width-based rules are what switch, so resizing is enough.
    await page.setViewportSize({ width: 1024, height: 800 });
    await sleep(600);
    const wide = await page.evaluate(() => ({
      selects: [...document.querySelectorAll('.section-select')].filter((el) => el.offsetParent).length,
      chips: [...document.querySelectorAll('.section-tabs--sm .section-tab')].filter((el) => el.offsetParent).length,
    }));
    check(
      `${label} a wide viewport shows chips, never the select`,
      wide.selects === 0 && wide.chips > 5,
      `${wide.chips} chip(s), ${wide.selects} visible select(s) at 1024px`,
    );

    await page.close();
  }

  // --- (g) theme cards: every field present, nothing clipped ---------------
  for (const { label, viewport } of [viewports[0], viewports[1]]) {
    const page = await openPhone(viewport);
    await settle(page);
    await page.evaluate(() =>
      document.querySelector('[role="tab"][data-tab="themes"]')?.click(),
    );
    await sleep(700);
    const cards = await page.evaluate(() => {
      const table = document.querySelector('#theme-ai table') || document.querySelector('.talks-theme-table');
      if (!table) return null;
      const wrap = table.closest('.talks-tablewrap');
      const panel = table.closest('.section-panel');
      const cells = [...table.querySelectorAll('tbody tr:first-child td')];
      const row = table.querySelector('tbody tr');
      const box = (el) => el.getBoundingClientRect();
      const p = box(panel);
      return {
        tableOverflow: table.scrollWidth - table.clientWidth,
        wrapOverflow: wrap ? wrap.scrollWidth - wrap.clientWidth : 0,
        cells: cells.map((c) => ({
          text: (c.textContent || '').trim().slice(0, 40),
          inside: box(c).right <= p.right + 1 && box(c).left >= p.left - 1,
        })),
        rowH: Math.round(box(row).height),
        rows: table.querySelectorAll('tbody tr').length,
        timeFull: (cells[2]?.textContent || '').trim(),
      };
    });
    if (!cards) {
      check(`${label} the theme table renders`, false, 'no .talks-theme-table');
    } else {
      check(
        `${label} the theme cards keep all three fields on the card`,
        cards.cells.length === 3 && cards.cells.every((c) => c.inside),
        cards.cells.map((c) => `«${c.text}» inside=${c.inside}`).join('; '),
      );
      check(
        `${label} the theme list never scrolls sideways`,
        cards.tableOverflow <= 1 && cards.wrapOverflow <= 1,
        `table ${cards.tableOverflow}px, wrapper ${cards.wrapOverflow}px`,
      );
      // «11:00–11:35», not «11:00–1»: the old table cut the last column.
      check(
        `${label} the time on a theme card is the whole range`,
        /^\d{2}:\d{2}–\d{2}:\d{2}$/.test(cards.timeFull),
        `«${cards.timeFull}» across ${cards.rows} row(s)`,
      );
    }
    await page.close();
  }
}
