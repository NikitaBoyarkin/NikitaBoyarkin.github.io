#!/usr/bin/env node
// Repoint the 23 volta sub-project pages at their dedicated standalone repos.
//
// Each `volta-parts/<slug>.md` and its EN twin carries `github:` pointing at the
// umbrella `volta-banking` repo. GitHub also now holds one focused `case-<slug>`
// repo per part, so the page should lead the reader to the narrow artifact.
// The mapping is the file name: `volta-parts/ab.md` <-> `NikitaBoyarkin/case-ab`.
//
// Default is a dry run. Pass `--apply` to write.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIRS = ['src/content/volta-parts', 'src/content/volta-parts-en'];
const UMBRELLA = 'https://github.com/NikitaBoyarkin/volta-banking';
// Two sites carry the umbrella: the `github:` frontmatter key, and the
// `## Документация` bullet that renders as the page's own GitHub link. Both
// have to move together or the body contradicts the metadata.
const RULES = [
  { from: `github: ${UMBRELLA}`, to: (slug) => `github: https://github.com/NikitaBoyarkin/case-${slug}` },
  {
    from: `- [GitHub → volta-banking](${UMBRELLA})`,
    to: (slug) => `- [GitHub → case-${slug}](https://github.com/NikitaBoyarkin/case-${slug})`,
  },
];
const dryRun = !process.argv.includes('--apply');

let changed = 0;
const skipped = [];

for (const dir of DIRS) {
  const files = readdirSync(join(ROOT, dir))
    .filter((f) => f.endsWith('.md'))
    .sort();
  for (const file of files) {
    const slug = file.replace(/\.md$/, '');
    const path = join(ROOT, dir, file);
    const raw = readFileSync(path, 'utf8');
    let next = raw;
    for (const rule of RULES) {
      const target = rule.to(slug);
      next = next
        .split('\n')
        .map((line) => (line.trim() === rule.from ? target : line))
        .join('\n');
    }
    if (next === raw) {
      skipped.push(`${dir}/${file}`);
      continue;
    }
    changed += 1;
    console.log(`  ${dryRun ? 'plan' : 'edit'}  ${dir}/${file}  ->  case-${slug}`);
    if (!dryRun) writeFileSync(path, next);
  }
}

console.log(
  `\n${dryRun ? 'DRY RUN - nothing written.' : 'APPLIED.'} ` +
    `${changed} file(s) ${dryRun ? 'would change' : 'changed'}, ${skipped.length} untouched.`,
);
if (skipped.length) console.log(`Untouched (no umbrella link): ${skipped.join(', ')}`);
