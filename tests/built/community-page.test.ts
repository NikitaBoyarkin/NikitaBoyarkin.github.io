// The `/nbxplay/` pages exist for one reason: Telegram owns the preview of
// `t.me/nbxplay`, so a custom share card needs a URL we control. Every claim
// that makes the card work is asserted here against the built HTML — the image
// URL, the title without the `· EN` SERP marker, and the CTA it sends readers to.
//
// Requires `bun run build` first.

import { describe, it, expect } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DIST = resolve(__dirname, '../../dist');
const page = (path: string): string => {
  const file = resolve(DIST, `.${path}`);
  if (!existsSync(file)) throw new Error(`dist${path} missing — run \`bun run build\` first`);
  return readFileSync(file, 'utf8');
};

const BANNER = '/images/og/community-nbxplay.png';
const pages = [
  { path: '/nbxplay/index.html', canonical: 'https://nikitaboyarkin.github.io/nbxplay/', lang: 'ru' },
  { path: '/en/nbxplay/index.html', canonical: 'https://nikitaboyarkin.github.io/en/nbxplay/', lang: 'en' },
];

describe('community share card', () => {
  it('points og:image at the built banner and busts the social cache with a hash', () => {
    expect(existsSync(resolve(DIST, `.${BANNER}`))).toBe(true);
    for (const { path } of pages) {
      const html = page(path);
      const image = new RegExp(`<meta property="og:image" content="([^"]+)">`).exec(html)?.[1] ?? '';
      expect(image).toContain(BANNER);
      expect(image).toMatch(/\?v=[0-9a-f]{8}$/);
      expect(html).toContain('<meta property="og:image:width" content="1200">');
      expect(html).toContain('<meta property="og:image:height" content="630">');
      expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    }
  });

  it('drops the `· EN` document-title marker from the social title', () => {
    const en = page('/en/nbxplay/index.html');
    expect(en).toContain('<title>NBxPlay — Telegram community · EN</title>');
    expect(en).toContain('<meta property="og:title" content="NBxPlay — Telegram community">');
    expect(en).not.toContain('<meta property="og:title" content="NBxPlay — Telegram community · EN">');
  });

  it('keeps the canonical URL and the locale pair', () => {
    for (const { path, canonical, lang } of pages) {
      const html = page(path);
      expect(html).toContain(`<link rel="canonical" href="${canonical}">`);
      expect(html).toContain(`hreflang="${lang}" href="${canonical}"`);
      expect(html).toContain('hreflang="x-default" href="https://nikitaboyarkin.github.io/nbxplay/"');
    }
  });

  it('sends the reader into the chat, not to a second copy of the page', () => {
    for (const { path } of pages) {
      const html = page(path);
      expect(html).toContain('href="https://t.me/nbxplay"');
      expect(html).toContain('data-analytics="community_join"');
    }
  });
});
