// The icon contract against the code that consumes it.
//
// Why this file exists: adding an icon is a two-part change — a NAME in
// `src/lib/icons.ts` and a reference to it in a component. Nothing in the
// runtime joins the two halves, and the failure is silent: `ICON.descriptive-
// name-i-did-not-define` is `undefined`, so `<Icon name=…>` renders an empty
// `<svg>` and the button simply has no glyph. It shipped exactly that way once
// (`ICON.tag`, referenced by five filter components, absent from the map) and
// the whole `bun test` suite stayed green — `astro check` was the only thing
// that caught it, and it is not in the fast loop.
//
// Two cheap guards, both reading source rather than a build:
//   1. every glyph value is non-empty markup;
//   2. every LITERAL reference in `src/` (`ICON.name`, `ICON['name']`,
//      `<Icon name="…" />`) resolves to a key of one of the two maps.
//
// Dynamic lookups (`ICON[card.role]`, `ICON[audience]`, a `name={cond ? … : …}`
// expression) cannot be resolved statically and are deliberately skipped — for
// those, `astro check` is the mechanism, because the maps are `as const` and a
// missing key is a type error.
import { describe, it, expect } from 'bun:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { ICON, BRAND_ICON } from '../../src/lib/icons';

const SRC = resolve(__dirname, '../../src');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const FILES = walk(SRC).filter((f) => /\.(astro|ts)$/.test(f));

/**
 * Comments are stripped before scanning: the module docs write metavariables
 * like `` `ICON.name` `` and `` `<Icon name="…" />` `` as prose, and matching
 * those would flag the documentation itself as an unresolved icon.
 */
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

/** `ICON.name` | `ICON['name']` | `<Icon name="name"` — literal forms only. */
const REFERENCE =
  /ICON\.([A-Za-z_$][\w$]*)|ICON\[\s*['"]([^'"]+)['"]\s*\]|<Icon[^>]*\bname="([^"]+)"/g;

describe('icon contract (src/lib/icons.ts ↔ src/)', () => {
  it('declares every glyph as non-empty markup', () => {
    for (const [name, markup] of Object.entries(ICON)) {
      expect(markup.trim().length, `ICON.${name} is empty`).toBeGreaterThan(0);
    }
    for (const [name, markup] of Object.entries(BRAND_ICON)) {
      expect(markup.trim().length, `BRAND_ICON.${name} is empty`).toBeGreaterThan(0);
    }
  });

  it('resolves every literal reference in src/', () => {
    const missing: string[] = [];
    for (const file of FILES) {
      const text = stripComments(readFileSync(file, 'utf8'));
      for (const m of text.matchAll(REFERENCE)) {
        const name = m[1] ?? m[2] ?? m[3];
        if (name === undefined) continue;
        if (!(name in ICON) && !(name in BRAND_ICON)) {
          missing.push(`${file.replace(`${SRC}/`, '')}: ${name}`);
        }
      }
    }
    expect(missing, `unresolved icon names:\n  ${missing.join('\n  ')}`).toEqual([]);
  });
});
