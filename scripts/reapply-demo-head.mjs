#!/usr/bin/env node
// Restore the site-owned `<head>` metadata that a `dct render` pass does not emit.
//
// `dct render` (dbt-charts 0.9.1) writes a board document with charset,
// viewport and `<title>` only. The description, the canonical link and the
// Open Graph block are not board data — they describe the page on *this* site,
// so they live in the committed copy of `public/demos/volta-board/index.html`
// (added in e3f6ed0, "weigh less on every page, describe more of the site").
//
// CI re-renders that board on every deploy, so without this step the committed
// head is overwritten by the bare render and two things break silently:
//
//   1. `scanDemos()` (`src/lib/demos.ts`) reads `<meta name="description">`
//      from the page and feeds it to the /demos/ card. No tag → empty card,
//      which `tests/lib/demos.test.ts` catches at the assertion on line 192.
//   2. The deployed board page ships with no description and no canonical,
//      i.e. the SEO block added in e3f6ed0 never reaches production.
//
// Usage:
//   node scripts/reapply-demo-head.mjs <rendered.html> <source.html> [out.html]
//   bun run scripts/reapply-demo-head.mjs ...        (same output)
//
// The merge is additive and idempotent: a tag the rendered document already
// carries is kept as-is, so a future dbt-charts release that starts emitting a
// description does not produce duplicates. A source with no description throws
// instead of falling back to `""` — that is the exact failure the hub test
// guards, and it must not be able to ship quietly.

import { readFileSync, writeFileSync } from 'node:fs';

/** Description, canonical and `og:*` — the tags the site owns, not the board. */
const SITE_OWNED_TAG =
  /<(?:meta|link)\b[^>]*?(?:name|property|rel)=["'](?:description|canonical|og:[a-z_:]+)["'][^>]*>/gi;

function headOf(html) {
  const match = /<head\b[^>]*>([\s\S]*?)<\/head>/i.exec(html);
  return match ? match[1] : null;
}

function attrOf(tag, name) {
  const match = new RegExp(`\\b${name}=["']([^"']*)["']`, 'i').exec(tag);
  return match ? match[1].trim() : null;
}

/** Identity of a tag, so the merge never writes a duplicate of one already present. */
function tagKey(tag) {
  return (attrOf(tag, 'property') ?? attrOf(tag, 'name') ?? attrOf(tag, 'rel') ?? tag).toLowerCase();
}

/** The site-owned tags inside `html`'s head, in document order. */
export function siteOwnedHeadTags(html) {
  const head = headOf(html);
  if (head === null) return [];
  return head.match(SITE_OWNED_TAG) ?? [];
}

/** `true` when the source carries a non-empty `<meta name="description">`. */
export function hasDescription(html) {
  return siteOwnedHeadTags(html).some(
    (tag) =>
      tag.toLowerCase().startsWith('<meta') &&
      attrOf(tag, 'name')?.toLowerCase() === 'description' &&
      (attrOf(tag, 'content') ?? '') !== '',
  );
}

/**
 * Copy every site-owned head tag the rendered document lacks out of `source`.
 * Throws when `source` has no description or `rendered` has no `</head>`:
 * a silent no-op here would ship a blank /demos/ card.
 */
export function reapplyHead(rendered, source) {
  const tags = siteOwnedHeadTags(source);
  if (!hasDescription(source)) {
    throw new Error('source document carries no <meta name="description"> — refusing to reapply an empty head');
  }

  const present = new Set(siteOwnedHeadTags(rendered).map(tagKey));
  const missing = tags.filter((tag) => !present.has(tagKey(tag)));
  if (missing.length === 0) return rendered;

  const closing = rendered.search(/<\/head>/i);
  if (closing === -1) throw new Error('rendered document has no </head> — cannot place the site-owned tags');

  const block = `${missing.join('\n')}\n`;
  return rendered.slice(0, closing) + block + rendered.slice(closing);
}

function main(argv) {
  const [renderedPath, sourcePath, outPath = renderedPath] = argv;
  if (!renderedPath || !sourcePath) {
    console.error('usage: reapply-demo-head.mjs <rendered.html> <source.html> [out.html]');
    return 2;
  }

  const rendered = readFileSync(renderedPath, 'utf8');
  const merged = reapplyHead(rendered, readFileSync(sourcePath, 'utf8'));
  const added = siteOwnedHeadTags(merged).length - siteOwnedHeadTags(rendered).length;
  writeFileSync(outPath, merged, 'utf8');
  console.log(`reapplied ${added} site-owned head tag(s) to ${outPath}`);
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
