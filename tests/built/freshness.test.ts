// `test:built` reads whatever `dist/` happens to be on disk and never rebuilds
// it. That is how a hardcoded `18` outlived the four cards that made it 22
// (`docs/prd-v9.md` §2.1): locally green against a stale build, red only in CI,
// and the local green said nothing about what was published.
//
// Fixing the individual counters (each now derives its number from source) does
// not fix the class — the next assertion added here can still be written against
// a build from last week. This file makes staleness loud instead of silent: it
// compares the newest source mtime against the entry point of the build.
//
// Cost is one recursive walk of `src/`; no build is invoked, so `bun run
// test:built` keeps its ~2 s turnaround. `make check` is unaffected: it runs
// `build` before this suite, so `dist/` is always newer than its sources.
//
// Requires `bun run build` first — see the failure message when it was not.

import { describe, it, expect } from 'bun:test';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const SRC = resolve(ROOT, 'src');
const DIST_ENTRY = resolve(ROOT, 'dist', 'index.html');

// Config that can change the output without touching `src/`. `bun.lock` is
// deliberately absent: a dependency bump that changes nothing in the build would
// otherwise fail this test for no reason.
const ROOT_CONFIG = ['astro.config.mjs', 'package.json', 'tsconfig.json'];

function newestMtime(dir: string, newest = 0): number {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      newest = newestMtime(full, newest);
    } else if (entry.isFile()) {
      const { mtimeMs } = statSync(full);
      if (mtimeMs > newest) newest = mtimeMs;
    }
  }
  return newest;
}

describe('dist/ is not stale', () => {
  it('the build is newer than every file it was built from', () => {
    if (!existsSync(DIST_ENTRY)) {
      throw new Error('dist/index.html missing — run `bun run build` first');
    }

    const builtAt = statSync(DIST_ENTRY).mtimeMs;
    let sourceAt = newestMtime(SRC);

    for (const file of ROOT_CONFIG) {
      const full = resolve(ROOT, file);
      if (!existsSync(full)) continue;
      const { mtimeMs } = statSync(full);
      if (mtimeMs > sourceAt) sourceAt = mtimeMs;
    }

    // Whole milliseconds of slack: a build started in the same millisecond as a
    // source write is not meaningfully stale, and filesystem timestamp
    // granularity should not decide a test.
    const slackMs = 1000;
    const staleByMs = sourceAt - builtAt;

    expect(
      staleByMs,
      staleByMs > slackMs
        ? `dist/ predates its sources by ${(staleByMs / 1000).toFixed(1)} s — ` +
            'every assertion in tests/built/ is reading an old build. ' +
            'Run `bun run build` (or `make check`) before `bun run test:built`.'
        : ''
    ).toBeLessThanOrEqual(slackMs);
  });
});
