import { describe, it, expect } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Binds the STAR skeleton documented in `CLAUDE.md` («Readability conventions») and
 * `docs/prd-readability.md` D11 to a mechanism. Source of the framework:
 * `Obsidian/Z-core/STAR method.md` in the vault.
 *
 * What fails when the claim stops being true: a file whose H2 sequence leaves the
 * skeleton, a missing required section, or a digit inside `## Задача` / `## Task`
 * (which would also drift `bun run audit:content`, whose numeric baseline is a
 * per-file multiset — a repeated digit counts as an addition).
 *
 * NOT bound here: the STAR proportions (A 50–60% of the body) and the «card = hoisted
 * Result» rule — no test measures section length. Both are «intended, not enforced».
 */

const CONTENT = path.resolve(import.meta.dir, '../../src/content');

const PROJECT_RU = ['Ситуация', 'Задача', 'Действия', 'Результат', 'Ограничения', 'Документация'];
const PROJECT_EN = ['Situation', 'Task', 'Actions', 'Result', 'Limitations', 'Documentation'];

const PART_RU = ['Ситуация', 'Задача', 'Действия', 'Результат', 'Рекомендации', 'Документация'];
const PART_EN = ['Situation', 'Task', 'Actions', 'Result', 'Recommendations', 'Documentation'];

// The hub is a dossier, not a project page. Order frozen by `docs/prd-volta-structure.md` D10.
// `## Вердикт` (the R) sits after `## Рекомендации и гейты` — intended, not enforced.
const HUB_RU = [
  'Итог в 30 секунд',
  'Ситуация',
  'Задача',
  'Действия',
  'Карта проекта',
  'Улики №1–4',
  'Слой RAT v2 — валидация собственного аудита',
  'Рекомендации и гейты',
  'Вердикт',
  'Ограничения',
  'Остальные проекты',
  'Документация',
];
const HUB_EN = [
  'The 30-second version',
  'Situation',
  'Task',
  'Actions',
  'Project map',
  'Evidence #1–4',
  'The RAT v2 Layer — validating the audit itself',
  'Recommendations & gates',
  'The Verdict',
  'Limitations',
  'Other projects',
  'Documentation',
];

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Body with the YAML frontmatter and fenced code stripped. */
function body(file: string): string {
  const raw = fs.readFileSync(file, 'utf8');
  const fm = raw.match(/^---\n[\s\S]*?\n---\n/);
  return (fm ? raw.slice(fm[0].length) : raw).replace(/^```[\s\S]*?^```/gm, '');
}

function h2s(md: string): string[] {
  return md
    .split('\n')
    .filter((l) => /^## /.test(l))
    .map((l) => l.slice(3).trim());
}

function filesOf(dir: string, exclude: string[] = []): string[] {
  return fs
    .readdirSync(path.join(CONTENT, dir))
    .filter((f) => f.endsWith('.md') && !exclude.includes(f))
    .sort();
}

function mdOf(dir: string, file: string): string {
  return body(path.join(CONTENT, dir, file));
}

/** Text between `## <heading>` and the next H2, or null when the section is absent. */
function sectionBody(md: string, heading: string): string | null {
  const m = md.match(new RegExp(`^## ${escapeRe(heading)}[ \\t]*$`, 'm'));
  if (!m || m.index === undefined) return null;
  const rest = md.slice(m.index + m[0].length);
  const next = rest.search(/^## /m);
  return next < 0 ? rest : rest.slice(0, next);
}

/** `[{file, h2}]` for every file whose H2 sequence differs from `expected`. */
function drift(dir: string, expected: string[], exclude: string[] = []) {
  return filesOf(dir, exclude)
    .map((f) => ({ file: f, h2: h2s(mdOf(dir, f)) }))
    .filter((x) => JSON.stringify(x.h2) !== JSON.stringify(expected));
}

/** `[{file, body}]` for every file whose Task section contains a digit. */
function taskDigits(dir: string, heading: string, exclude: string[] = []) {
  return filesOf(dir, exclude)
    .map((f) => ({ file: f, body: sectionBody(mdOf(dir, f), heading) ?? '' }))
    .filter((x) => /\d/.test(x.body));
}

describe('STAR skeleton — projects', () => {
  it('RU files follow the frozen H2 order (hub excluded)', () => {
    expect(drift('projects', PROJECT_RU, ['volta.md'])).toEqual([]);
  });

  it('EN files follow the frozen H2 order (hub excluded)', () => {
    expect(drift('projects-en', PROJECT_EN, ['volta.md'])).toEqual([]);
  });

  it('## Задача / ## Task carry no digits, hub included (binds audit:content)', () => {
    expect(taskDigits('projects', 'Задача')).toEqual([]);
    expect(taskDigits('projects-en', 'Task')).toEqual([]);
  });

  it('RU and EN collections have the same slugs', () => {
    expect(filesOf('projects')).toEqual(filesOf('projects-en'));
  });
});

describe('STAR skeleton — volta parts', () => {
  it('RU parts follow the frozen H2 order (Рекомендации retained)', () => {
    expect(drift('volta-parts', PART_RU)).toEqual([]);
  });

  it('EN parts follow the frozen H2 order (Recommendations retained)', () => {
    expect(drift('volta-parts-en', PART_EN)).toEqual([]);
  });

  it('## Задача / ## Task carry no digits (binds audit:content)', () => {
    expect(taskDigits('volta-parts', 'Задача')).toEqual([]);
    expect(taskDigits('volta-parts-en', 'Task')).toEqual([]);
  });

  it('RU and EN collections have the same slugs', () => {
    expect(filesOf('volta-parts')).toEqual(filesOf('volta-parts-en'));
  });
});

describe('Volta hub — D10 order', () => {
  it('RU hub matches the frozen D10 sequence', () => {
    expect({ h2: h2s(mdOf('projects', 'volta.md')) }).toEqual({ h2: HUB_RU });
  });

  it('EN hub matches the frozen D10 sequence', () => {
    expect({ h2: h2s(mdOf('projects-en', 'volta.md')) }).toEqual({ h2: HUB_EN });
  });
});
