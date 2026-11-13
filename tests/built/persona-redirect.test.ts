// The three persona landings moved under `/hire/` on 2026-11-13. Their old
// top-level URLs (`/hr/`, `/manager/`, `/colleague/` and the `/en/` twins) are
// linked from CVs and old chats, so each forwards instead of 404ing. Nothing
// else checks that: a dropped line in the `redirects` map of astro.config.mjs
// deletes the built page, and Astro emits no warning. `legacy-redirect.test.ts`
// only covers the `/Personal_Projects.github.io` prefix.
//
// Four layers are checked per rule — config declaration, built file, meta
// refresh target, noindex — because each fails silently on its own: the config
// line can be commented out, the target can be typo'd, and an indexable
// redirect page leaks the old URL into search results.
//
// Requires `bun run build` first (reads dist/).

import { describe, it, expect, beforeAll } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const DIST = resolve(ROOT, 'dist');
const CONFIG = resolve(ROOT, 'astro.config.mjs');

const RULES = [
  { from: '/hr/', to: '/hire/hr/', file: 'hr/index.html' },
  { from: '/manager/', to: '/hire/manager/', file: 'manager/index.html' },
  { from: '/colleague/', to: '/hire/colleague/', file: 'colleague/index.html' },
  { from: '/en/hr/', to: '/en/hire/hr/', file: 'en/hr/index.html' },
  { from: '/en/manager/', to: '/en/hire/manager/', file: 'en/manager/index.html' },
  { from: '/en/colleague/', to: '/en/hire/colleague/', file: 'en/colleague/index.html' },
] as const;

/**
 * The `redirects` object body, with `//` line comments stripped so a commented
 * out rule cannot satisfy the assertion. Read as text, not imported: importing
 * astro.config.mjs would pull in integrations and the Astro build graph.
 */
function redirectsBlock(source: string): string {
  const start = source.indexOf('redirects:');
  if (start === -1) throw new Error('astro.config.mjs has no `redirects` key');
  const end = source.indexOf('\n  integrations:', start);
  return source
    .slice(start, end === -1 ? undefined : end)
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
}

const CONFIG_BLOCK = redirectsBlock(readFileSync(CONFIG, 'utf8'));

beforeAll(() => {
  if (!existsSync(resolve(DIST, 'index.html'))) {
    throw new Error('dist/ missing — run `bun run build` first');
  }
});

describe('persona redirects (/hr/, /manager/, /colleague/ and EN twins)', () => {
  for (const rule of RULES) {
    describe(`${rule.from} -> ${rule.to}`, () => {
      it('is declared in the astro.config.mjs redirects map', () => {
        const pattern = new RegExp(
          `["']${rule.from.replace(/[/.]/g, '\\$&')}["']\\s*:\\s*["']${rule.to.replace(/[/.]/g, '\\$&')}["']`,
        );
        expect(CONFIG_BLOCK).toMatch(pattern);
      });

      it(`builds ${rule.file}`, () => {
        expect(existsSync(resolve(DIST, rule.file))).toBe(true);
      });

      it(`refreshes ${rule.file} to ${rule.to}`, () => {
        const html = readFileSync(resolve(DIST, rule.file), 'utf8');
        const meta = html.match(/<meta[^>]*http-equiv=["']refresh["'][^>]*>/i);
        expect(meta).not.toBeNull();
        expect(meta![0]).toContain(`url=${rule.to}`);
      });

      it(`marks ${rule.file} noindex`, () => {
        const html = readFileSync(resolve(DIST, rule.file), 'utf8');
        const robots = html.match(/<meta[^>]*name=["']robots["'][^>]*>/i);
        expect(robots).not.toBeNull();
        expect(robots![0]).toContain('noindex');
      });
    });
  }
});
