import { describe, it, expect } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

/**
 * Binds the F6 fix: `datePublished` on a project page is `date ?? updated`
 * (`src/pages/projects/[slug].astro`), so a project without `date` silently
 * publishes its last-edit date as if it were its publication date. 13 of 17
 * projects were in that state.
 *
 * What fails when the claim stops being true: a new project added without
 * `date`, a translation dated differently from its RU original, or a `date`
 * that postdates the file's own `updated` stamp.
 *
 * NOT bound here: whether the value matches the real-world project date — the
 * field is only checked for presence, locale parity and ordering. The values
 * come from each file's first commit (`git log --follow`), or from `updated`
 * where that stamp precedes the first commit.
 */

const CONTENT = path.resolve(import.meta.dir, '../../src/content');
const PAIRS: Array<[string, string]> = [
  ['projects', 'projects-en'],
  ['volta-parts', 'volta-parts-en'],
];

/** `YYYY-MM-DD` for a content file, or null when the key is absent. */
function datesOf(dir: string, file: string): { date: string | null; updated: string | null } {
  const raw = fs.readFileSync(path.join(CONTENT, dir, file), 'utf8');
  const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
  const data = (parseYaml(fm) ?? {}) as { date?: unknown; updated?: unknown };
  const iso = (v: unknown) =>
    v instanceof Date ? v.toISOString().slice(0, 10) : typeof v === 'string' ? v.slice(0, 10) : null;
  return { date: iso(data.date), updated: iso(data.updated) };
}

const filesIn = (dir: string) =>
  fs
    .readdirSync(path.join(CONTENT, dir))
    .filter((f) => f.endsWith('.md'))
    .sort();

describe('project dates', () => {
  it('declares date on every project file in both locales', () => {
    const missing: string[] = [];
    for (const dir of ['projects', 'projects-en']) {
      for (const file of filesIn(dir)) {
        if (!datesOf(dir, file).date) missing.push(`${dir}/${file}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('dates a translation the same as its RU original', () => {
    const drift: string[] = [];
    for (const [ru, en] of PAIRS) {
      for (const file of filesIn(ru)) {
        if (!fs.existsSync(path.join(CONTENT, en, file))) continue;
        const a = datesOf(ru, file).date;
        const b = datesOf(en, file).date;
        if (a !== b) drift.push(`${file}: ${ru}=${a} ${en}=${b}`);
      }
    }
    expect(drift).toEqual([]);
  });

  it('never dates a project after its own last update', () => {
    const offenders: string[] = [];
    for (const dir of ['projects', 'projects-en', 'volta-parts', 'volta-parts-en']) {
      for (const file of filesIn(dir)) {
        const { date, updated } = datesOf(dir, file);
        if (date && updated && date > updated) offenders.push(`${dir}/${file}: ${date} > ${updated}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
