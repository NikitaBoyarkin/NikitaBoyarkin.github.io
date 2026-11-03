import { describe, it, expect } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// The real-data badge is the site's answer to the question every number here
// invites: "is this real or made up?".
//
// Why this file exists: the catalogue used to render all 27 cases identically,
// so the two that run on real UCI Online Retail II rows — the strongest evidence
// in the portfolio — were visually indistinguishable from the twenty-five
// synthetic ones. The badge fixes that, but a badge is only worth anything if it
// is *earned*: the moment a synthetic case gets one, the marker stops meaning
// anything and the honesty it buys turns into the opposite.
//
// What fails when the claim stops being true:
//   - the `dataset` field is dropped from the schema, and every card silently
//     falls back to `synthetic` with no way to mark a real one
//   - a case is relabelled `real` without real data behind it — the two slugs
//     below are the complete allow-list, so a third fails this test on purpose
//   - the badge is rendered unconditionally, and 27 cards all claim real data
//
// The rendered side is asserted by `tests/built/projects-board.test.ts`: it counts
// the badge in the built HTML and pins which two cards carry it. Source-string
// matching alone cannot catch "rendered unconditionally" — only the output can.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

/** The complete set of cases allowed to carry a non-synthetic badge. */
const REAL_DATA_CASES = ['gmv-drop-rca', 'oss-catalog', 'sql'] as const;

/** Per-case evidence the badge must be able to point at: a real dataset by name,
 *  not just a `dataset:` field. `oss-catalog` reads the GitHub API; the other two
 *  run on UCI Online Retail II rows. */
const REAL_DATA_EVIDENCE: Record<(typeof REAL_DATA_CASES)[number], RegExp> = {
  'gmv-drop-rca': /UCI Online Retail II/,
  'oss-catalog': /GitHub API/,
  sql: /UCI Online Retail II/,
};

describe('project dataset provenance', () => {
  it('is a closed set with `synthetic` as the default', () => {
    const schema = read('src/content.config.ts');
    expect(schema).toMatch(
      /dataset: z\.enum\(\['synthetic', 'real', 'mixed'\]\)\.default\('synthetic'\)/,
    );
  });

  it('marks exactly the real-data cases, in both locales', () => {
    for (const collection of ['projects', 'projects-en']) {
      const dir = join(ROOT, 'src', 'content', collection);
      const marked: string[] = [];
      for (const file of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
        const body = readFileSync(join(dir, file), 'utf8');
        const match = /^dataset:\s*(\S+)$/m.exec(body);
        if (match && match[1] !== 'synthetic') marked.push(file.replace(/\.md$/, ''));
      }
      expect(marked.sort(), `${collection}: wrong set of non-synthetic cases`).toEqual([
        ...REAL_DATA_CASES,
      ]);
    }
  });

  it('names the real dataset on each marked case, not just the field', () => {
    // A `dataset: real` with no dataset named in the body would be a claim with
    // no evidence — the exact failure this badge is meant to prevent.
    for (const slug of REAL_DATA_CASES) {
      for (const rel of [`src/content/projects/${slug}.md`, `src/content/projects-en/${slug}.md`]) {
        expect(read(rel), `${rel} claims real data without naming it`).toMatch(
          REAL_DATA_EVIDENCE[slug],
        );
      }
    }
  });

  it('derives the badge label from the value instead of hardcoding one', () => {
    // The rendered mapping is pinned by `tests/built/projects-board.test.ts`; this
    // only guards the shape that makes that mapping possible — a per-value label
    // rather than one constant string, which the built test would also catch but
    // would report as "two identical labels", far from the cause.
    const card = read('src/components/ProjectCard.astro');
    expect(card).toMatch(/dataset = 'synthetic'/);
    expect(card).toMatch(/dataset === 'real' \? i18n\.datasetReal/);
    expect(card).toMatch(/dataset === 'mixed' \? i18n\.datasetMixed/);
  });
});
