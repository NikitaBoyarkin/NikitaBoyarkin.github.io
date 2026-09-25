// The contact validator is the browser's copy of the caps that the Edge Function
// and the table's CHECK constraints actually enforce. If it drifts, the form
// starts rejecting valid input (or accepting input the server will refuse), and
// nothing else in the pipeline notices — hence this file.

import { describe, it, expect } from 'bun:test';
import {
  CAL_BOOKING_URL,
  CONTACT_ENDPOINT,
  CONTACT_HONEYPOT_FIELD,
  CONTACT_LIMITS,
  validateContact,
} from '../../src/lib/contact';

describe('contact constants', () => {
  it('points at a Supabase function over https', () => {
    expect(CONTACT_ENDPOINT.startsWith('https://')).toBe(true);
    expect(CONTACT_ENDPOINT).toMatch(/\/functions\/v1\/contact$/);
  });

  it('points the booking link at cal.com over https', () => {
    expect(CAL_BOOKING_URL.startsWith('https://cal.com/')).toBe(true);
  });

  it('uses the honeypot field name the Edge Function checks', () => {
    expect(CONTACT_HONEYPOT_FIELD).toBe('website');
  });
});

describe('validateContact', () => {
  const valid = { contact: 'a@b.co', message: 'привет, есть роль?' };

  it('accepts a minimal valid submission and trims the values', () => {
    const result = validateContact({ ...valid, name: '  Nikita  ' });
    expect(result.ok).toBe(true);
    expect(result.fields).toEqual([]);
    expect(result.value.name).toBe('Nikita');
  });

  it('rejects an empty or whitespace-only required field', () => {
    expect(validateContact({ contact: '   ', message: '   ' }).fields).toEqual(['contact', 'message']);
    expect(validateContact({}).ok).toBe(false);
  });

  it('rejects a one-character contact and a four-character message', () => {
    const result = validateContact({ contact: 'a@', message: 'прив' });
    expect(result.ok).toBe(false);
    expect(result.fields).toEqual(['contact', 'message']);
  });

  it('accepts the boundary values exactly', () => {
    const result = validateContact({
      contact: 'abc',
      message: '12345',
      name: 'n'.repeat(CONTACT_LIMITS.name),
      company: 'c'.repeat(CONTACT_LIMITS.company),
    });
    expect(result.ok).toBe(true);
  });

  it('caps oversized fields instead of failing them', () => {
    const result = validateContact({ ...valid, message: 'm'.repeat(CONTACT_LIMITS.message + 500) });
    expect(result.ok).toBe(true);
    expect(result.value.message.length).toBe(CONTACT_LIMITS.message);
  });

  it('ignores unknown fields — the honeypot never reaches the value', () => {
    const result = validateContact({ ...valid, website: 'http://spam.example' } as never);
    expect(result.ok).toBe(true);
    expect(result.value).toEqual({ name: '', contact: 'a@b.co', company: '', message: 'привет, есть роль?' });
  });
});
