import { describe, it, expect } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

/**
 * Binds the `star:` frontmatter contract (D21 in `docs/prd-readability.md`) to a
 * mechanism. `scripts/content-drift-audit.mjs` excludes `star:` from the numeric
 * freeze because it restates numbers that are frozen in the file body — this file is
 * what makes that exclusion safe rather than a hole: every token in `star` must
 * already exist in the file's own baseline (or its `description`, which D20 excludes
 * for the same reason), and `star.result` must come from the file's own Result
 * section. That second assertion is what makes filling 80 files in parallel batches
 * safe: a number pasted from a neighbouring project passes the first check only if it
 * happens to appear anyway, but never the second.
 *
 * What fails when the claim stops being true: an invented number, a number borrowed
 * from another project, a digit in `star.task` (mirrors the `## Задача` rule in
 * `content-skeleton.test.ts`), a locale-parity gap, an invisible NBSP, and a `star:`
 * key pushed off column 0 — which the audit's strip would silently stop excluding.
 *
 * NOT bound here: whether the four values read well, and whether they honour the STAR
 * proportions (S 15–20% / T 10–15% / A 50–60% / R 10–15%). Intended, not enforced.
 */

const CONTENT = path.resolve(import.meta.dir, '../../src/content');
const BASELINE = path.resolve(import.meta.dir, '../../docs/content-baseline.json');

const DIRS = ['projects', 'projects-en', 'volta-parts', 'volta-parts-en'];
const KEYS = ['action', 'result', 'situation', 'task'];

// The volta hub is a dossier, not a project page: its Result lives in `## Итог в
// 30 секунд` and `## Вердикт` rather than a `## Результат` section (frozen by
// docs/prd-volta-structure.md D10). Every other file uses the standard heading.
const RESULT_HEADINGS: Record<string, string[]> = {
  'projects/volta.md': ['Итог в 30 секунд', 'Вердикт'],
  'projects-en/volta.md': ['The 30-second version', 'The Verdict'],
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The audit's own regex + normalization — the test must not disagree with the guard
 *  it is binding, or a green test would mean nothing. */
function tokens(text: string): string[] {
  const raw = (text ?? '').match(/\d(?:[\d\s.,_]*\d)?/g) || [];
  return raw.map((t) => t.replace(/[\s,_]/g, '')).filter((t) => /\d/.test(t));
}

/** Strip Markdown ordered-list markers, as the audit does before tokenizing. */
const stripListMarkers = (md: string) => md.replace(/^[ \t]*\d+[.)][ \t]+/gm, '');

function frontmatter(md: string): string | null {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? m[1] : null;
}

/** Body with the frontmatter and fenced code removed — the shape the audit sees. */
function body(md: string): string {
  return md.replace(/^---\r?\n[\s\S]*?\r?\n---/, '').replace(/```[\s\S]*?```/g, ' ');
}

/** Text between `## <heading>` and the next H2, or '' when the section is absent. */
function section(md: string, heading: string): string {
  const m = md.match(new RegExp(`^## ${escapeRe(heading)}[ \\t]*$`, 'm'));
  if (!m || m.index === undefined) return '';
  const rest = md.slice(m.index + m[0].length);
  const next = rest.search(/^## /m);
  return next < 0 ? rest : rest.slice(0, next);
}

function files(dir: string): string[] {
  return fs
    .readdirSync(path.join(CONTENT, dir))
    .filter((f) => f.endsWith('.md'))
    .sort();
}

interface Entry {
  rel: string;
  raw: string;
  fm: string;
  description: string;
  star: Record<string, string> | null;
}

function entry(dir: string, file: string): Entry {
  const raw = fs.readFileSync(path.join(CONTENT, dir, file), 'utf8');
  const fm = frontmatter(raw) ?? '';
  const data = (fm ? parseYaml(fm) : {}) ?? {};
  return {
    rel: `${dir}/${file}`,
    raw,
    fm,
    description: typeof data.description === 'string' ? data.description : '',
    star: (data.star ?? null) as Record<string, string> | null,
  };
}

const ALL: Entry[] = DIRS.flatMap((dir) => files(dir).map((file) => entry(dir, file)));
const STARRED = ALL.filter((e) => e.star !== null);

const BASELINE_FILES: Record<string, string[]> = JSON.parse(
  fs.readFileSync(BASELINE, 'utf8'),
).files;

describe('star frontmatter — shape', () => {
  it('has exactly the four STAR keys, non-empty and on one line each', () => {
    const offenders: string[] = [];
    for (const e of STARRED) {
      const keys = Object.keys(e.star!).sort();
      if (JSON.stringify(keys) !== JSON.stringify(KEYS)) {
        offenders.push(`${e.rel}: keys=${JSON.stringify(keys)}`);
        continue;
      }
      for (const key of KEYS) {
        const value = e.star![key];
        if (typeof value !== 'string' || value.trim() === '') {
          offenders.push(`${e.rel}: ${key} is empty or not a string`);
        } else if (value.includes('\n')) {
          offenders.push(`${e.rel}: ${key} spans more than one line`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('carries no digits in task (mirrors the ## Задача / ## Task rule)', () => {
    const offenders = STARRED.filter((e) => tokens(e.star!.task).length > 0).map(
      (e) => `${e.rel}: ${tokens(e.star!.task).join(', ')}`,
    );
    expect(offenders).toEqual([]);
  });

  it('uses plain spaces only — no U+00A0 / U+202F', () => {
    const offenders: string[] = [];
    for (const e of STARRED) {
      for (const key of KEYS) {
        if (/[  ]/.test(e.star![key])) offenders.push(`${e.rel}: ${key}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('is anchored at column 0 of the frontmatter (binds the audit strip)', () => {
    const offenders = STARRED.filter((e) => !/^star:/m.test(e.fm)).map((e) => e.rel);
    expect(offenders).toEqual([]);
  });
});

describe('star frontmatter — the numbers are the file’s own', () => {
  it('every token already exists in the file baseline or its description', () => {
    const offenders: string[] = [];
    for (const e of STARRED) {
      const baseline = BASELINE_FILES[e.rel];
      if (!baseline) {
        offenders.push(`${e.rel}: absent from docs/content-baseline.json`);
        continue;
      }
      const allowed = new Set([...baseline, ...tokens(e.description)]);
      for (const key of KEYS) {
        for (const token of tokens(e.star![key])) {
          if (!allowed.has(token)) offenders.push(`${e.rel}: ${key} → ${token}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('result tokens come from the file’s own Result section or its description', () => {
    const offenders: string[] = [];
    for (const e of STARRED) {
      const dir = e.rel.slice(0, e.rel.lastIndexOf('/'));
      const headings = RESULT_HEADINGS[e.rel] ?? [dir.endsWith('-en') ? 'Result' : 'Результат'];
      const allowed = new Set([
        ...tokens(stripListMarkers(headings.map((h) => section(body(e.raw), h)).join('\n'))),
        ...tokens(e.description),
      ]);
      for (const token of tokens(e.star!.result)) {
        if (!allowed.has(token)) offenders.push(`${e.rel} → ${token}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('star frontmatter — RU/EN parity', () => {
  it('a slug carries star in both locales, or in neither', () => {
    const pairs: Array<[string, string]> = [
      ['projects', 'projects-en'],
      ['volta-parts', 'volta-parts-en'],
    ];
    const starred = (dir: string) =>
      new Set(files(dir).filter((f) => entry(dir, f).star !== null).map((f) => f.replace(/\.md$/, '')));

    const offenders: string[] = [];
    for (const [ru, en] of pairs) {
      const ruStarred = starred(ru);
      const enStarred = starred(en);
      for (const slug of ruStarred) {
        if (!enStarred.has(slug)) offenders.push(`${ru}/${slug}.md is starred, ${en} is not`);
      }
      for (const slug of enStarred) {
        if (!ruStarred.has(slug)) offenders.push(`${en}/${slug}.md is starred, ${ru} is not`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
