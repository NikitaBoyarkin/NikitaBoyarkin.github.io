// The contact form is the one interactive element on the site and it must work
// with JavaScript disabled — which is exactly the case a browser test would miss
// and a source test would not. Asserted against dist/ so a regression in the
// form's markup or its no-JS fallback turns red here.
//
// The pages ship one of two branches, chosen by `CONTACT_FORM_ENABLED` in
// `src/lib/contact.ts`: the live form, or a fallback pointing at channels that
// already work while `CONTACT_ENDPOINT` still carries the `PROJECT_REF`
// placeholder. Both branches are asserted here, against the same flag the pages
// read — so the test cannot drift from what was actually rendered, and enabling
// the form automatically switches this file back to the form contract.
//
// Requires `bun run build` first.

import { describe, it, expect, beforeAll } from 'bun:test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { CONTACT_FORM_ENABLED } from '../../src/lib/contact';

const DIST = resolve(__dirname, '../../dist');
const ENDPOINT_RE = /action="(https:\/\/[^"]+\/functions\/v1\/contact)"/;

function page(path: string): string {
  // `.${path}` — a leading slash would make resolve() absolute and drop DIST.
  const file = resolve(DIST, `.${path}`);
  if (!existsSync(file)) throw new Error(`dist${path} missing — run \`bun run build\` first`);
  return readFileSync(file, 'utf8');
}

const pages = [
  { label: 'RU', path: '/contact/index.html' },
  { label: 'EN', path: '/en/contact/index.html' },
];

describe.each(pages)('built contact page ($label)', ({ path }) => {
  let html = '';

  beforeAll(() => {
    html = page(path);
  });

  it('offers the booking CTA with its analytics attribute', () => {
    expect(html).toContain('https://cal.com/');
    expect(html).toContain('data-analytics="booking_click"');
  });

  it('states the data-processing disclaimer without linking a page that does not exist', () => {
    expect(html).not.toContain('/privacy/');
    expect(html.toLowerCase()).toMatch(/данн|data/);
  });

  if (CONTACT_FORM_ENABLED) {
    it('posts the form natively to the contact endpoint', () => {
      expect(html).toContain('<form');
      expect(html).toMatch(/method="post"/i);
      expect(html).toMatch(ENDPOINT_RE);
    });

    it('carries every field the Edge Function reads', () => {
      for (const field of ['name', 'contact', 'message', 'company', 'website']) {
        expect(html).toContain(`name="${field}"`);
      }
      expect(html).toContain('name="locale"');
      expect(html).toContain('name="source"');
    });

    it('hides the honeypot from assistive tech', () => {
      // The honeypot must be off-screen, never `display: none` — bots skip those.
      expect(html).toMatch(/aria-hidden="true"[^>]*>[\s\S]{0,400}?name="website"/);
    });
  } else {
    // Placeholder endpoint: the page must not ship a form whose submit button
    // points at nothing. It swaps in channels that already work instead.
    it('ships no inert form while the endpoint is a placeholder', () => {
      expect(html).not.toContain('<form');
      expect(html).not.toContain('id="contact-submit"');
      expect(html).toContain('https://t.me/lofinibo');
      expect(html).toContain('data-analytics="telegram_contact"');
    });
  }
});
