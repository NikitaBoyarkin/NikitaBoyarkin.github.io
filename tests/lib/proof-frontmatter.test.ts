import { describe, it, expect } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

/**
 * Binds the `proof:` frontmatter contract (D25 in `docs/prd-readability.md`).
 * `scripts/content-drift-audit.mjs` excludes `proof:` from the numeric freeze because
 * the strip restates numbers already frozen in the file body — this file is what makes
 * that exclusion safe rather than a hole: every token in `proof[].value` must already
 * exist in the file's own baseline (or its `description`, which D20 excludes for the
 * same reason), so an invented number or one lifted from a neighbouring case turns red
 * instead of shipping unpoliced. The locale-twin assertion catches the failure that
 * actually happened once — the strip authored on the EN side only.
 *
 * NOT bound here: whether the three claims are the right three, and their order.
 */

const CONTENT = path.resolve(import.meta.dir, '../../src/content');
const BASELINE = path.resolve(import.meta.dir, '../../docs/content-baseline.json');

const DIRS = ['projects', 'projects-en'];
const KINDS = ['measured', 'cited', 'derived'];

interface Claim {
  value?: unknown;
  label?: unknown;
  kind?: unknown;
}

interface Entry {
  rel: string;
  fm: string;
  description: string;
  proof: Claim[];
}

/** The audit's own regex + normalization — the test must not disagree with the guard
 *  it is binding, or a green test would mean nothing. */
function tokens(text: string): string[] {
  const raw = (text ?? '').match(/\d(?:[\d\s.,_]*\d)?/g) || [];
  return raw.map((t) => t.replace(/[\s,_]/g, '')).filter((t) => /\d/.test(t));
}

function entry(dir: string, file: string): Entry {
  const raw = fs.readFileSync(path.join(CONTENT, dir, file), 'utf8');
  const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
  const data = (fm ? parseYaml(fm) : {}) ?? {};
  return {
    rel: `${dir}/${file}`,
    fm,
    description: typeof data.description === 'string' ? data.description : '',
    proof: Array.isArray(data.proof) ? (data.proof as Claim[]) : [],
  };
}

const ALL: Entry[] = DIRS.flatMap((dir) =>
  fs
    .readdirSync(path.join(CONTENT, dir))
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((f) => entry(dir, f)),
);
const PROVED = ALL.filter((e) => e.proof.length > 0);

const BASELINE_FILES: Record<string, string[]> = JSON.parse(
  fs.readFileSync(BASELINE, 'utf8'),
).files;

describe('proof frontmatter — shape', () => {
  it('has a non-empty value and label on every claim, and a known kind', () => {
    const offenders: string[] = [];
    for (const e of PROVED) {
      e.proof.forEach((claim, i) => {
        for (const key of ['value', 'label'] as const) {
          const v = claim[key];
          if (typeof v !== 'string' || v.trim() === '') {
            offenders.push(`${e.rel}: claim ${i} ${key} is empty or not a string`);
          } else if (v.includes('\n')) {
            offenders.push(`${e.rel}: claim ${i} ${key} spans more than one line`);
          }
        }
        if (claim.kind !== undefined && !KINDS.includes(claim.kind as string)) {
          offenders.push(`${e.rel}: claim ${i} kind=${String(claim.kind)}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it('is anchored at column 0 of the frontmatter (binds the audit strip)', () => {
    const offenders = PROVED.filter((e) => !/^proof:/m.test(e.fm)).map((e) => e.rel);
    expect(offenders).toEqual([]);
  });
});

describe('proof frontmatter — the numbers are the file’s own', () => {
  it('every token already exists in the file baseline or its description', () => {
    const offenders: string[] = [];
    for (const e of PROVED) {
      const baseline = BASELINE_FILES[e.rel];
      if (!baseline) {
        offenders.push(`${e.rel}: absent from docs/content-baseline.json`);
        continue;
      }
      const allowed = new Set([...baseline, ...tokens(e.description)]);
      for (const claim of e.proof) {
        for (const token of tokens(String(claim.value ?? ''))) {
          if (!allowed.has(token)) offenders.push(`${e.rel}: ${claim.value} → ${token}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('each claim has a locale twin with the same number of claims', () => {
    const offenders: string[] = [];
    for (const e of PROVED) {
      const [dir, file] = e.rel.split('/');
      const twinDir = DIRS.find((d) => d !== dir)!;
      const twin = ALL.find((t) => t.rel === `${twinDir}/${file}`);
      if (!twin) offenders.push(`${e.rel}: no twin at ${twinDir}/${file}`);
      else if (twin.proof.length !== e.proof.length) {
        offenders.push(`${e.rel}: ${e.proof.length} claims vs ${twin.proof.length} at ${twin.rel}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
