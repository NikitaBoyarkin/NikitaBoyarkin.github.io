#!/usr/bin/env node
/**
 * content-drift-audit.mjs — numeric-token drift guard for content rewrites.
 *
 * The readability PRD (docs/prd-readability.md) freezes every metric token in
 * src/content/**: a rewrite changes presentation, never a number. This script
 * makes that rule mechanical.
 *
 *   bun run audit:content:snapshot   # write docs/content-baseline.json
 *   bun run audit:content            # diff current content vs baseline, exit 1 on drift
 *   bun run audit:content -- --json  # machine-readable report
 *
 * Method: extract every numeric token from each .md file, normalizing thousands
 * separators and intra-number spaces ("2,682" and "2 682" → "2682"), keeping
 * decimal points ("6.24"). Fenced code blocks are stripped so code samples are
 * not treated as metrics. Comparison is a per-file multiset diff.
 *
 * The `description:` field is excluded (decision D20 in docs/prd-readability.md):
 * Phase 1 rewrites descriptions to a 120-200 char result-first spec, which
 * necessarily changes which narrative numbers appear there. Everything else —
 * bodies, `impact`, `faq`, titles, `excerpt` — stays frozen.
 *
 * Markdown ordered-list markers (`1.`, `2)`) are stripped as formatting, not
 * content: converting a numbered list to bullets is a valid readability edit.
 *
 * Known limitation: the numeric regex is deliberately greedy, so false
 * positives (e.g. reformatting "6,24" → "6.24") are possible and expected to be
 * reviewed by a human. Under-capture is the risk that matters, so nothing is
 * silently dropped except fenced code.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'src', 'content');
const BASELINE_FILE = path.join(ROOT, 'docs', 'content-baseline.json');

const args = new Set(process.argv.slice(2));
const SNAPSHOT = args.has('--snapshot') || args.has('--write');
const JSON_OUT = args.has('--json');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

function stripFencedCode(md) {
  return md.replace(/```[\s\S]*?```/g, ' ');
}

/**
 * Remove a key (and any folded/indented continuation) from the leading YAML
 * frontmatter block, leaving the rest of the file intact.
 */
function stripFrontmatterField(md, field) {
  const block = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!block) return md;
  const fm = block[1];
  const cleaned = fm.replace(new RegExp(`^${field}:.*(?:\\n[ \\t]+.*)*`, 'm'), '');
  if (cleaned === fm) return md;
  return md.replace(block[0], block[0].replace(fm, cleaned));
}

function numericTokens(md) {
  const text = stripFrontmatterField(stripFencedCode(md), 'description')
    .replace(/^[ \t]*\d+[.)][ \t]+/gm, '');
  const raw = text.match(/\d(?:[\d\s.,_]*\d)?/g) || [];
  return raw.map((token) => token.replace(/[\s,_]/g, '')).filter((token) => /\d/.test(token));
}

function collect() {
  const files = {};
  for (const file of walk(CONTENT_DIR)) {
    const rel = path.relative(CONTENT_DIR, file).split(path.sep).join('/');
    files[rel] = numericTokens(fs.readFileSync(file, 'utf8')).sort();
  }
  return files;
}

function counts(list) {
  const map = new Map();
  for (const value of list) map.set(value, (map.get(value) || 0) + 1);
  return map;
}

function multisetDiff(before, after) {
  const b = counts(before);
  const a = counts(after);
  const added = [];
  const removed = [];
  for (const [value, n] of a) {
    const delta = n - (b.get(value) || 0);
    for (let i = 0; i < delta; i++) added.push(value);
  }
  for (const [value, n] of b) {
    const delta = n - (a.get(value) || 0);
    for (let i = 0; i < delta; i++) removed.push(value);
  }
  return { added: added.sort(), removed: removed.sort() };
}

function main() {
  if (!fs.existsSync(CONTENT_DIR)) {
    console.error(`Content directory not found: ${CONTENT_DIR}`);
    process.exit(2);
  }

  const current = collect();

  if (SNAPSHOT) {
    const payload = {
      generatedAt: new Date().toISOString(),
      root: 'src/content',
      files: current,
    };
    fs.mkdirSync(path.dirname(BASELINE_FILE), { recursive: true });
    fs.writeFileSync(BASELINE_FILE, JSON.stringify(payload, null, 2) + '\n');
    const total = Object.values(current).reduce((sum, list) => sum + list.length, 0);
    console.log(
      `Baseline written → ${path.relative(ROOT, BASELINE_FILE)} ` +
        `(${Object.keys(current).length} files, ${total} numeric tokens)`,
    );
    return;
  }

  if (!fs.existsSync(BASELINE_FILE)) {
    console.error(
      `Baseline not found: ${path.relative(ROOT, BASELINE_FILE)}\n` +
        'Run: bun run audit:content:snapshot',
    );
    process.exit(2);
  }

  const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')).files || {};
  const report = { filesChanged: [], filesAdded: [], filesRemoved: [], drift: {} };

  for (const rel of Object.keys(current)) {
    if (!(rel in baseline)) report.filesAdded.push(rel);
  }
  for (const rel of Object.keys(baseline)) {
    if (!(rel in current)) report.filesRemoved.push(rel);
  }
  for (const rel of Object.keys(current)) {
    if (!(rel in baseline)) continue;
    const { added, removed } = multisetDiff(baseline[rel], current[rel]);
    if (added.length || removed.length) {
      report.filesChanged.push(rel);
      report.drift[rel] = { added, removed };
    }
  }

  const drifted = report.filesChanged.length > 0;
  const structural = report.filesAdded.length > 0 || report.filesRemoved.length > 0;

  if (JSON_OUT) {
    console.log(JSON.stringify(report, null, 2));
  } else if (drifted || structural) {
    console.log('\n=== CONTENT DRIFT ===');
    for (const rel of report.filesAdded) console.log(`  + added file   ${rel}`);
    for (const rel of report.filesRemoved) console.log(`  - removed file ${rel}`);
    for (const rel of report.filesChanged) {
      const { added, removed } = report.drift[rel];
      console.log(`\n  ${rel}`);
      if (removed.length) console.log(`    lost:    ${removed.join(', ')}`);
      if (added.length) console.log(`    gained:  ${added.join(', ')}`);
    }
    console.log(
      '\nNumbers are frozen by docs/prd-readability.md. If a change is intentional, ' +
        're-run `bun run audit:content:snapshot` and say so in the PR.\n',
    );
  } else {
    console.log('No content drift — every numeric token matches the baseline.');
  }

  process.exit(drifted || structural ? 1 : 0);
}

main();
