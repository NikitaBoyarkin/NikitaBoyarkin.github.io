#!/usr/bin/env node
/**
 * gen-volta-map.mjs — derives the Volta hub "Project map" section from the
 * volta-parts collections, so the map can never drift from the parts.
 *
 * The hub (src/content/projects/volta.md + projects-en/volta.md) keeps
 * `<!-- volta-map:start -->` / `<!-- volta-map:end -->` markers; this script
 * replaces everything between them with a layer-grouped list of all parts.
 *
 *   bun run volta:map
 */
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

const ROOT = path.resolve(import.meta.dirname, '..');
const CONTENT = path.join(ROOT, 'src', 'content');

const LAYERS = [
  {
    key: 'core',
    ru: 'Core — петля discover → validate → measure → optimize',
    en: 'Core — the discover → validate → measure → optimize loop',
  },
  {
    key: 'extended',
    ru: 'Extended — расширенное портфолио',
    en: 'Extended — expanded portfolio',
  },
  {
    key: 'market-jobs',
    ru: 'Market & Jobs — JTBD-сегменты',
    en: 'Market & Jobs — JTBD segments',
  },
  {
    key: 'rat-v2',
    ru: 'RAT v2 — валидация аудита деньгами',
    en: 'RAT v2 — pricing the audit in money',
  },
  {
    key: 'causal',
    ru: 'Causal — причинная проверка',
    en: 'Causal — causal validation',
  },
];

function readParts(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const md = fs.readFileSync(path.join(dir, f), 'utf8');
      const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!m) throw new Error(`No frontmatter in ${f}`);
      return YAML.parse(m[1]);
    });
}

const shortTitle = (title) => title.replace(/^Volta — /, '');

function buildBlock(parts, lang) {
  const lines = [];
  for (const layer of LAYERS) {
    const group = parts
      .filter((p) => p.layer === layer.key)
      .sort((a, b) => a.order - b.order);
    if (group.length === 0) continue;
    lines.push(`### ${layer[lang]}`, '');
    for (const p of group) {
      lines.push(`- [${shortTitle(p.title)}](${p.part}/) — ${p.description}`);
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

function inject(file, block) {
  const md = fs.readFileSync(file, 'utf8');
  const re = /(<!-- volta-map:start -->)[\s\S]*?(<!-- volta-map:end -->)/;
  if (!re.test(md)) throw new Error(`Map markers not found in ${file}`);
  const out = md.replace(re, `$1\n${block}\n$2`);
  fs.writeFileSync(file, out);
  const rel = path.relative(ROOT, file);
  console.log(`Map written → ${rel}`);
}

const ruParts = readParts(path.join(CONTENT, 'volta-parts'));
const enParts = readParts(path.join(CONTENT, 'volta-parts-en'));

inject(path.join(CONTENT, 'projects', 'volta.md'), buildBlock(ruParts, 'ru'));
inject(path.join(CONTENT, 'projects-en', 'volta.md'), buildBlock(enParts, 'en'));
