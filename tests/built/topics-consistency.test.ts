// The topic hub prints a count per topic and links to a page that lists the
// items behind that count. They were computed by two different rules: the hub
// counted tag *hits* (a post with three matching tags counted three times) while
// the page filtered posts with `.some()`. A/B-testing read "9" on the hub and
// showed 4 cards when clicked. Both sides now call `postMatchesTopic` /
// `projectMatchesTopic`, and this test proves the numbers agree in the build.
//
// Requires `bun run build` first (reads dist/).

import { describe, it, expect, beforeAll } from 'bun:test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const DIST = resolve(__dirname, '../../dist');
const HUB = resolve(DIST, 'topics/index.html');

interface Row {
  key: string;
  count: number;
}

let rows: Row[] = [];

beforeAll(() => {
  if (!existsSync(HUB)) throw new Error('dist/topics/index.html missing — run `bun run build` first');
  const html = readFileSync(HUB, 'utf8');
  rows = [
    ...html.matchAll(
      /class="topic-card" href="\/topics\/([a-z-]+)\/".*?class="topic-count"[^>]*>(\d+)</gs,
    ),
  ].map((m) => ({ key: m[1], count: Number(m[2]) }));
});

describe('built topic hubs', () => {
  it('lists at least one topic', () => {
    expect(rows.length).toBeGreaterThan(0);
  });

  it('prints the number of items its page actually lists', () => {
    for (const { key, count } of rows) {
      const page = readFileSync(resolve(DIST, 'topics', key, 'index.html'), 'utf8');
      const posts = new Set([...page.matchAll(/href="\/posts\/([a-z0-9-]+)\/"/g)].map((m) => m[1]));
      const projects = new Set(
        [...page.matchAll(/href="\/projects\/([a-z0-9-]+)\/"/g)].map((m) => m[1]),
      );
      expect({ key, count }).toEqual({ key, count: posts.size + projects.size });
    }
  });

  it('links every hub row to a built page', () => {
    for (const { key } of rows) {
      expect(existsSync(resolve(DIST, 'topics', key, 'index.html'))).toBe(true);
    }
  });
});
