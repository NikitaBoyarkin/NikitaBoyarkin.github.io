// `/search/` — the addressable results page — checked on SERVED HTML, not on the
// source. The whole point of the page is that a reader without JavaScript (and a
// crawler, and a `curl`) gets real, filtered links, so the assertions below go
// through `scripts/serve-dist.mjs` over HTTP and parse what came back.
//
// Two distinct claims are separated on purpose, because they have different
// mechanisms and only one of them can be true on a static host:
//
//   1. The server HTML carries the results. `/search/` renders the whole index;
//      `/search/tag/<tag>/` and `/search/collection/<type>/` render a genuinely
//      filtered subset, built by `tagFacets`/`filterRecords`. Asserted here.
//   2. A free-text `?q=` ranks in the browser. A static host ignores the query
//      string, so `/search/?q=…` is the same file — the island re-ranks it. The
//      tests below therefore assert the *fallback* is intact (≥3 real links) and
//      never claim the server ranked the query.
//
// Requires `bun run build` first (reads dist/).

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { request } from "node:http";
import { resolve } from "node:path";
import type { Subprocess } from "bun";
import { tagKey, tagSlug } from "../../src/lib/search-page";

const ROOT = resolve(__dirname, "../..");
const DIST = resolve(ROOT, "dist");
const PORT = 4900 + Math.floor(Math.random() * 300);
const BASE = `http://localhost:${PORT}`;

type IndexEntry = { type: string; locale: string; title: string; tags?: string[]; href: string };

let entries: IndexEntry[] = [];
let server: Subprocess | null = null;

/** happy-dom (tests/preload.ts) replaces global fetch with a CORS shim that
 *  refuses same-host requests from a test file; plain node:http is outside it. */
function get(path: string): Promise<{ status: number; body: string }> {
  return new Promise((done, fail) => {
    const req = request(`${BASE}${path}`, { timeout: 4000 }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => done({ status: res.statusCode ?? 0, body }));
    });
    req.on("error", fail);
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.end();
  });
}

/** Hrefs of the server-rendered results, in document order. */
function resultHrefs(html: string): string[] {
  const container = /<div id="search-page-results"[^>]*>([\s\S]*?)<p class="srch-foot"/.exec(html)?.[1];
  if (!container) return [];
  return [...container.matchAll(/<a class="srch-hit-link" href="([^"]+)"/g)].map((m) => m[1]);
}

/** A served href is "working" only if the file it points at was built. */
const hrefBuilds = (href: string) =>
  existsSync(resolve(DIST, href.replace(/^\//, "").replace(/\/$/, "") + "/index.html"));

beforeAll(async () => {
  if (!existsSync(resolve(DIST, "search/index.html"))) {
    throw new Error("dist/search missing — run `bun run build` first");
  }
  entries = JSON.parse(readFileSync(resolve(DIST, "search-index.json"), "utf8"));
  server = Bun.spawn(["bun", "scripts/serve-dist.mjs"], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT) },
    stdout: "ignore",
    stderr: "ignore",
  });
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const { status } = await get("/__health");
      if (status === 200) return;
    } catch {
      /* not up yet */
    }
    await Bun.sleep(100);
  }
  throw new Error("scripts/serve-dist.mjs did not come up");
}, 15_000);

afterAll(() => {
  server?.kill();
});

describe('served /search/ with a query string', () => {
  it("answers ?q=когорты with 200 and at least three real result links", async () => {
    const { status, body } = await get(`/search/?q=${encodeURIComponent("когорты")}`);
    expect(status).toBe(200);
    const hrefs = resultHrefs(body);
    // The static fallback: the full index is on the page, so the shared link
    // never lands on an empty document. The island narrows it to the query.
    expect(hrefs.length).toBeGreaterThanOrEqual(3);
    expect(hrefs.every(hrefBuilds)).toBe(true);
  });

  it("answers /en/search/?q=cohort with 200 and EN-scoped links", async () => {
    const { status, body } = await get("/en/search/?q=cohort");
    expect(status).toBe(200);
    const hrefs = resultHrefs(body);
    expect(hrefs.length).toBeGreaterThanOrEqual(3);
    expect(hrefs.every(hrefBuilds)).toBe(true);
    // EN pool = EN records + the RU-only topic hubs; nothing else RU.
    expect(hrefs.every((href) => href.startsWith("/en/") || href.startsWith("/topics/"))).toBe(
      true,
    );
  });

  it("does not mark the page noindex (it is meant to be shared and crawled)", async () => {
    for (const path of ["/search/", "/en/search/", "/search/tag/retention/"]) {
      const { body } = await get(path);
      expect(/<meta[^>]+name="robots"[^>]*noindex/.test(body)).toBe(false);
    }
  });
});

describe('prerendered filters are applied on the server', () => {
  it("serves exactly the entries carrying the tag on /search/tag/cohort-analysis/", async () => {
    const { status, body } = await get("/search/tag/cohort-analysis/");
    expect(status).toBe(200);
    const hrefs = resultHrefs(body);

    const expected = entries
      .filter((entry) => entry.locale === "ru" || entry.type === "topic")
      .filter((entry) => (entry.tags ?? []).some((tag) => tagKey(tagSlug(tag)) === "cohortanalysis"))
      .map((entry) => entry.href);

    expect(hrefs.length).toBe(expected.length);
    expect(new Set(hrefs)).toEqual(new Set(expected));
    expect(hrefs.length).toBeGreaterThanOrEqual(3);
  });

  it("serves only projects on /search/collection/projects/", async () => {
    const { status, body } = await get("/search/collection/projects/");
    expect(status).toBe(200);
    const hrefs = resultHrefs(body);
    expect(hrefs.length).toBe(entries.filter((e) => e.type === "project" && e.locale === "ru").length);
    expect(hrefs.every((href) => href.startsWith("/projects/"))).toBe(true);
    expect(hrefs.every(hrefBuilds)).toBe(true);
  });

  it("serves the EN tag twin with the EN pool", async () => {
    const { status, body } = await get("/en/search/tag/cohort-analysis/");
    expect(status).toBe(200);
    const hrefs = resultHrefs(body);
    expect(hrefs.length).toBeGreaterThanOrEqual(3);
    expect(hrefs.every((href) => href.startsWith("/en/") || href.startsWith("/topics/"))).toBe(
      true,
    );
  });
});

describe('head, sitemap and structured data', () => {
  it('is listed in the sitemap in both locales', () => {
    const sitemap = readFileSync(resolve(DIST, "sitemap-0.xml"), "utf8");
    expect(sitemap).toContain("<loc>https://nikitaboyarkin.github.io/search/</loc>");
    expect(sitemap).toContain("<loc>https://nikitaboyarkin.github.io/en/search/</loc>");
    // Filter pages are ordinary routes; losing one from the sitemap means the
    // route stopped being prerendered.
    expect(sitemap).toContain("/search/tag/retention/</loc>");
  });

  it('declares a SearchResultsPage whose item list matches the rendered list', async () => {
    const { body } = await get("/search/");
    const nodes = [...body.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
      (m) => JSON.parse(m[1]) as Record<string, any>,
    );
    const page = nodes.find((node) => node["@type"] === "SearchResultsPage");
    expect(page).toBeTruthy();
    const itemCount = page!.mainEntity.numberOfItems as number;
    expect(itemCount).toBe(resultHrefs(body).length);
    expect(page!.mainEntity.itemListElement.length).toBe(Math.min(itemCount, 20));
    expect(page!.inLanguage).toBe("ru");
  });

  it('advertises the search page as the site SearchAction target', async () => {
    for (const [path, template] of [
      ["/", "https://nikitaboyarkin.github.io/search/?q={search_term_string}"],
      ["/en/", "https://nikitaboyarkin.github.io/en/search/?q={search_term_string}"],
    ] as const) {
      const { body } = await get(path);
      const site = [...body.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
        .map((m) => JSON.parse(m[1]) as Record<string, any>)
        .find((node) => node["@type"] === "WebSite");
      expect(site?.potentialAction?.target?.urlTemplate).toBe(template);
    }
  });

  it('cross-links the locale twins', async () => {
    const { body } = await get("/search/");
    const alternates = [...body.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => [
      m[1],
      m[2],
    ]);
    expect(alternates).toContainEqual(["ru", "https://nikitaboyarkin.github.io/search/"]);
    expect(alternates).toContainEqual(["en", "https://nikitaboyarkin.github.io/en/search/"]);
  });
});
