import { describe, it, expect } from 'bun:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Contract tests for the analytics taxonomy. They exist because the drift they
// catch is invisible otherwise: `track()` has an open-ended `(string, props)`
// overload, so a typo'd, orphaned, or retired event name compiles and ships,
// and the docs' "keep the two lists in sync" was enforced by nobody.

const ROOT = join(__dirname, '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.astro', '.lighthouseci', 'lhci-reports', 'renders']);
const SCAN_EXT = /\.(astro|ts|js|mdx|html|svg|json)$/;

/** Source files that can contain an emitter (excludes build output and docs). */
function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (SKIP_DIRS.has(entry)) continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (SCAN_EXT.test(entry)) out.push(full);
    }
  };
  for (const top of ['src', 'public', 'tests/preload.ts']) {
    const full = join(ROOT, top);
    try {
      if (statSync(full).isDirectory()) walk(full);
      else out.push(full);
    } catch {
      // absent — skip
    }
  }
  return out;
}

/** Keys of the `AnalyticsEventMap` interface in src/lib/analytics.ts. */
function eventMapKeys(): string[] {
  const src = read('src/lib/analytics.ts');
  const start = src.indexOf('export interface AnalyticsEventMap');
  expect(start, 'AnalyticsEventMap not found in src/lib/analytics.ts').toBeGreaterThan(-1);
  const body = src.slice(start, src.indexOf('\n}', start));
  const keys = [...body.matchAll(/^ {2}([a-z_][a-z0-9_]*):/gm)].map((m) => m[1]);
  return [...new Set(keys)];
}

/** Slice a `## N.` section out of the canonical docs page. */
function docSection(n: number): string {
  const md = read('docs/analytics-events.md');
  const start = md.indexOf(`\n## ${n}.`);
  expect(start, `docs/analytics-events.md has no "## ${n}." section`).toBeGreaterThan(-1);
  // Stop at the next section heading, including a `###` sub-heading (the
  // super-properties table lives inside §1 but is not an event list).
  const rest = md.slice(start + 1);
  const stop = rest.search(/\n#{2,3} /);
  return stop === -1 ? rest : rest.slice(0, stop);
}

/** Event names in the first column of a markdown table inside a section. */
function sectionEventNames(n: number): string[] {
  const names: string[] = [];
  for (const line of docSection(n).split('\n')) {
    if (!line.startsWith('|')) continue;
    const firstCell = line.split('|')[1] ?? '';
    for (const m of firstCell.matchAll(/`([a-z_][a-z0-9_<>]*)`/g)) names.push(m[1]);
  }
  return [...new Set(names)];
}

const allSource = () => sourceFiles().map((f) => readFileSync(f, 'utf8')).join('\n');

describe('typed event map ↔ docs (REQ-A04)', () => {
  it('the first-class docs table and AnalyticsEventMap hold the same events', () => {
    const typed = eventMapKeys().sort();
    // docs/analytics-events.md §1 is the canonical first-class list.
    const documented = sectionEventNames(1).sort();
    const missingFromDocs = typed.filter((k) => !documented.includes(k));
    const missingFromCode = documented.filter((k) => !typed.includes(k));
    expect({ missingFromDocs, missingFromCode }).toEqual({
      missingFromDocs: [],
      missingFromCode: [],
    });
  });
});

describe('every typed event has an emitter', () => {
  it('each AnalyticsEventMap key appears as a literal in src/ or public/', () => {
    const src = allSource();
    const orphans = eventMapKeys().filter((key) => {
      // Either track('key') or a data-analytics="key" attribute counts.
      return !src.includes(`'${key}'`) && !src.includes(`"${key}"`);
    });
    expect(orphans).toEqual([]);
  });
});

describe('retired events have no emitter', () => {
  it('no retired or removed name is emitted anywhere', () => {
    const src = allSource();
    const retired = [
      'headline_all_projects',
      'more_project_',
      'bento_graph',
      'value_viewed',
      'whois_viewed',
      'case_study_read',
      'project_view_rfm',
      'project_view_volta',
    ];
    const live = retired.filter(
      (name) => src.includes(`track('${name}`) || src.includes(`data-analytics="${name}"`),
    );
    expect(live).toEqual([]);
  });
});

describe('delegated [data-analytics] names are declared somewhere', () => {
  it('every literal data-analytics value is a typed event, a frozen name, or a lang switch', () => {
    const src = allSource();
    const literals = [...src.matchAll(/data-analytics="([a-z_][a-z0-9_]*)"|track\('\/?([a-z_][a-z0-9_]*)'/g)]
      .map((m) => m[1] ?? m[2])
      .filter(Boolean);
    const unique = [...new Set(literals)];

    const typed = new Set(eventMapKeys());
    // Frozen names keep their historical event names (docs §2) and live in the
    // delegated handler's open-ended overload, not in AnalyticsEventMap.
    const frozen = new Set([
      ...sectionEventNames(2),
      'lang_switch_ru',
      'lang_switch_en',
    ]);

    const undeclared = unique.filter((name) => !typed.has(name) && !frozen.has(name));
    expect(undeclared).toEqual([]);
  });
});
