// Regression check for the glossary ("Словарь") filter — the twin of
// `verify-writing-filter.mjs` for `/glossary/` and `/en/glossary/`.
//
// `GlossaryFilter.astro` hides `#glossary-static` and renders matches into
// `#glossary-results`, re-grouped by category. That depends on the UA
// `[hidden] { display: none }` rule actually winning on the static container —
// the exact class of CSS-cascade bug that bit the writing filter once (see the
// `.blog-list[hidden]` guard in `src/styles/blog.css`). A static-markup grep
// cannot see that failure, so this drives a real browser against the build.
//
// Run against a served build (dist):
//   bun run serve-dist &                      # http://localhost:4321
//   bun run verify:glossary-filter
// Or point BASE_URL anywhere:
//   BASE_URL=http://localhost:4330/ bun run verify:glossary-filter
import { chromium } from 'playwright';

const baseUrl = process.env.BASE_URL || 'http://localhost:4321/';
// Per-locale tag used to exercise the tag axis; both are real content tags.
const TAGS = { ru: 'retention', en: 'statistics' };
const LOCALES = [
  ['ru', 'glossary/'],
  ['en', 'en/glossary/'],
];

const failures = [];
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(name);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

const visible = (sel) => page.locator(sel).isVisible();
const count = (sel) => page.locator(sel).count();

try {
  for (const [lang, path] of LOCALES) {
    const tag = TAGS[lang];

    await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(400);

    check(`[${lang}] static sections visible on load`, await visible('#glossary-static'));
    check(`[${lang}] results container hidden on load`, !(await visible('#glossary-results')));
    const staticCards = await count('#glossary-static .term-card');
    check(`[${lang}] static term cards rendered`, staticCards > 0, `${staticCards} cards`);

    // Category axis: one group, heading count == cards in it.
    await page.locator('.filter-tag[data-filter="statistics"]').click();
    await page.waitForTimeout(250);
    check(`[${lang}] static list actually hidden after category click`, !(await visible('#glossary-static')));
    check(`[${lang}] results visible after category click`, await visible('#glossary-results'));
    const catCards = await count('#glossary-results .term-card');
    const catGroups = await count('#glossary-results .level-group');
    const catHeading = await page.locator('#glossary-results .level-blurb').first().textContent();
    check(
      `[${lang}] category filter yields 1 group whose count matches its cards`,
      catGroups === 1 && Number(catHeading) === catCards && catCards > 0,
      `${catGroups} group(s), heading=${catHeading}, cards=${catCards}`,
    );
    const status = await page.locator('#glossary-filter-status').textContent();
    check(`[${lang}] status region announces a count`, /\d/.test(status || ''), status?.trim());

    // Tag axis: grouping must survive — the per-group counts sum to the cards.
    await page.locator(`.filter-tag[data-tag="${tag}"]`).click();
    await page.waitForTimeout(250);
    const tagCards = await count('#glossary-results .term-card');
    const blurbSum = await page
      .locator('#glossary-results .level-blurb')
      .evaluateAll((els) => els.reduce((n, e) => n + Number(e.textContent || 0), 0));
    check(
      `[${lang}] tag filter keeps results grouped by category`,
      tagCards > 0 && blurbSum === tagCards,
      `${tagCards} cards, group counts sum=${blurbSum}`,
    );

    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    check(`[${lang}] Esc restores the static view`, await visible('#glossary-static'));

    // Hash restore. A same-hash `goto` is a no-op navigation and would not
    // re-run the bundled script, so bounce through about:blank first.
    await page.goto('about:blank');
    await page.goto(`${baseUrl}${path}#tag-${tag}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(400);
    check(`[${lang}] URL hash restores the tag filter`, await visible('#glossary-results'));

    // Long-tail toggle.
    await page.locator('.tag-more').click();
    await page.waitForTimeout(200);
    check(
      `[${lang}] "all tags" toggle reveals the long tail`,
      (await count('.tag-chip.tag-hidden:not([hidden])')) > 0,
    );

    // --- Search + A–Z ------------------------------------------------------
    // The query is derived from the page itself rather than hard-coded, so
    // editing a description can't silently turn this into a search for nothing.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);

    const alphaBtns = await count('#glossary-alpha .alpha-btn');
    check(`[${lang}] A–Z strip renders letter buttons`, alphaBtns > 1, `${alphaBtns} letters`);

    const probe =
      (await page.locator('#glossary-static .term-blurb').first().textContent())?.trim().slice(0, 30) || '';
    await page.locator('#glossary-search').fill(probe);
    await page.waitForTimeout(300);
    check(`[${lang}] search hides the static list`, !(await visible('#glossary-static')));
    const searchCards = await count('#glossary-results .term-card');
    check(
      `[${lang}] search narrows to matching terms`,
      searchCards >= 1 && searchCards < staticCards,
      `"${probe}" → ${searchCards} of ${staticCards}`,
    );

    // Letter axis on its own: clears the query, narrows, and toggles back off.
    await page.locator('#glossary-search').fill('');
    await page.waitForTimeout(200);
    await page.locator('#glossary-alpha .alpha-btn').first().click();
    await page.waitForTimeout(250);
    const letterCards = await count('#glossary-results .term-card');
    check(
      `[${lang}] letter filter narrows to that letter`,
      letterCards >= 1 && letterCards < staticCards,
      `${letterCards} of ${staticCards}`,
    );
    await page.locator('#glossary-alpha .alpha-btn').first().click();
    await page.waitForTimeout(250);
    check(
      `[${lang}] clicking the active letter restores the static view`,
      await visible('#glossary-static'),
    );

    // Esc must clear the search field, not just the chip facets.
    await page.locator('#glossary-search').fill(probe);
    await page.waitForTimeout(300);
    check(`[${lang}] typing a query hides the static list`, !(await visible('#glossary-static')));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    check(
      `[${lang}] Esc clears the query and restores the static view`,
      (await visible('#glossary-static')) &&
        (await page.locator('#glossary-search').inputValue()) === '',
    );
  }

  check('no console or page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
} finally {
  await browser.close();
}

console.log(failures.length ? `\n${failures.length} FAILURE(S)` : '\nALL PASS');
process.exit(failures.length ? 1 : 0);
