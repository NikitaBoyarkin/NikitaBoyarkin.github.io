#!/usr/bin/env node
// Export a machine-readable registry of every project to public/projects.json.
//
// Deterministic and idempotent: a re-run with unchanged content writes a
// byte-identical file (`generated_at` is preserved). Reads the RU project case
// studies, their EN twins, and the Volta parts, skips
// anything marked `draft: true`, and writes a single JSON document consumed by
// external tools (analytics, feeds, agents).
//
// The registry is bilingual and symmetric: every text field carries both the RU
// value (`title` / `description`) and its EN twin (`title_en` / `description_en`,
// each falling back to the RU value when the twin is absent). The RU/EN split
// mirrors the site's own collections — an EN twin is authored independently for
// meaning parity, not a literal translation — so a consumer can render either
// language without a second fetch.
//
// Usage:
//   node scripts/export-projects-registry.mjs
//   bun run scripts/export-projects-registry.mjs     (same output)

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';

const ROOT = process.cwd();
const PROJECTS_DIR = path.join(ROOT, 'src/content/projects');
const PROJECTS_EN_DIR = path.join(ROOT, 'src/content/projects-en');
const VOLTA_DIR = path.join(ROOT, 'src/content/volta-parts');
const VOLTA_EN_DIR = path.join(ROOT, 'src/content/volta-parts-en');
const OUT_FILE = path.join(ROOT, 'public/projects.json');

const SITE_URL = 'https://nikitaboyarkin.github.io';
const TRACK_ORDER = ['experiments', 'analytics', 'product', 'engineering'];

// --- frontmatter -----------------------------------------------------------
// The `---`-delimited block, parsed with `yaml` so quoting/escaping is handled.
function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  return YAML.parse(m[1]) ?? {};
}

// Collapse a value to a single plain line: no newlines, no tab runs.
function oneLine(value) {
  return String(value ?? '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function asUrlOrNull(value) {
  const s = oneLine(value);
  return s === '' ? null : s;
}

function asStringList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((v) => oneLine(v)).filter((v) => v !== '');
}

async function readCollection(dir) {
  const entries = new Map();
  let names;
  try {
    names = await readdir(dir);
  } catch {
    return entries;
  }
  for (const name of names) {
    if (!name.endsWith('.md')) continue;
    const slug = name.replace(/\.md$/, '');
    const text = await readFile(path.join(dir, name), 'utf8');
    const fm = parseFrontmatter(text);
    if (!fm) continue;
    entries.set(slug, fm);
  }
  return entries;
}

// --- registry --------------------------------------------------------------
async function buildProjects() {
  const ru = await readCollection(PROJECTS_DIR);
  const en = await readCollection(PROJECTS_EN_DIR);

  const projects = [];
  for (const [slug, fm] of ru) {
    if (fm.draft === true) continue;
    const enFm = en.get(slug);
    projects.push({
      slug,
      track: oneLine(fm.track),
      title: oneLine(fm.title),
      title_en: enFm && oneLine(enFm.title) !== '' ? oneLine(enFm.title) : oneLine(fm.title),
      description: oneLine(fm.description),
      description_en:
        enFm && oneLine(enFm.description) !== '' ? oneLine(enFm.description) : oneLine(fm.description),
      tools: asStringList(fm.tools),
      github: asUrlOrNull(fm.github),
      demo: asUrlOrNull(fm.demo),
      private: fm.private === true,
      href: `${SITE_URL}/projects/${slug}/`,
    });
  }

  projects.sort((a, b) => {
    const ta = TRACK_ORDER.indexOf(a.track);
    const tb = TRACK_ORDER.indexOf(b.track);
    const ra = ta === -1 ? TRACK_ORDER.length : ta;
    const rb = tb === -1 ? TRACK_ORDER.length : tb;
    if (ra !== rb) return ra - rb;
    return a.title.localeCompare(b.title);
  });

  return projects;
}

async function buildVoltaCases() {
  const parts = await readCollection(VOLTA_DIR);
  const enParts = await readCollection(VOLTA_EN_DIR);
  // EN twins are keyed by `part`, not by filename slug, so a renamed file cannot
  // silently detach a case from its translation.
  const enByPart = new Map();
  for (const fm of enParts.values()) enByPart.set(oneLine(fm.part), fm);
  const cases = [];
  for (const fm of parts.values()) {
    if (fm.draft === true) continue;
    const part = oneLine(fm.part);
    const enFm = enByPart.get(part);
    cases.push({
      slug: part,
      order: Number(fm.order),
      layer: oneLine(fm.layer),
      title: oneLine(fm.title),
      title_en: enFm && oneLine(enFm.title) !== '' ? oneLine(enFm.title) : oneLine(fm.title),
      description: oneLine(fm.description),
      description_en:
        enFm && oneLine(enFm.description) !== '' ? oneLine(enFm.description) : oneLine(fm.description),
      github: asUrlOrNull(fm.github),
      href: `${SITE_URL}/projects/volta/${part}/`,
    });
  }
  cases.sort((a, b) => a.order - b.order);
  return cases;
}

const payload = {
  site_url: SITE_URL,
  projects: await buildProjects(),
  volta_cases: await buildVoltaCases(),
};

// Idempotent committed artifact: when the payload is unchanged, keep the previous
// `generated_at` so a re-run is byte-identical and the deploy drift guard
// (which diffs this file) stays green instead of churning on the timestamp.
async function stableTimestamp() {
  try {
    const prev = JSON.parse(await readFile(OUT_FILE, 'utf8'));
    const same =
      prev.site_url === payload.site_url &&
      JSON.stringify(prev.projects) === JSON.stringify(payload.projects) &&
      JSON.stringify(prev.volta_cases) === JSON.stringify(payload.volta_cases);
    if (same && typeof prev.generated_at === 'string') return prev.generated_at;
  } catch {
    // missing or malformed previous file → treat as a fresh export
  }
  return new Date().toISOString();
}

const registry = { generated_at: await stableTimestamp(), ...payload };

await mkdir(path.dirname(OUT_FILE), { recursive: true });
await writeFile(OUT_FILE, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');

console.log(
  `exported ${registry.projects.length} projects + ${registry.volta_cases.length} volta cases → ${path.relative(ROOT, OUT_FILE)}`,
);
