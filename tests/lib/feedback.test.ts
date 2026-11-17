// The feedback contract is the browser's copy of the question keys and caps that
// the Edge Function and the table's CHECK constraints actually enforce. If it
// drifts, the page renders a field the server rejects, or the server accepts
// input the page called invalid — and nothing else in the pipeline notices.

import { describe, it, expect } from 'bun:test';
import { INGEST_ENDPOINT } from '../../src/lib/ingest';
import {
  FEEDBACK_ENDPOINT,
  FEEDBACK_HONEYPOT_FIELD,
  FEEDBACK_QUESTION_KEYS,
  FEEDBACK_QUESTIONS_EN,
  FEEDBACK_QUESTIONS_RU,
  FEEDBACK_ROLES,
  FEEDBACK_SIGNATURE_MAX,
  toFormFields,
  validateFeedback,
} from '../../src/lib/feedback';

describe('feedback questions', () => {
  it('asks exactly five questions in the order the form renders them', () => {
    expect(FEEDBACK_QUESTION_KEYS).toEqual(['task', 'helps', 'friction', 'gap', 'more']);
  });

  it('keeps the two locales on the same keys and caps', () => {
    expect(FEEDBACK_QUESTIONS_EN.map((q) => q.key)).toEqual(FEEDBACK_QUESTIONS_RU.map((q) => q.key));
    expect(FEEDBACK_QUESTIONS_RU.map((q) => q.cap)).toEqual([600, 600, 600, 600, 1000]);
    expect(FEEDBACK_QUESTIONS_EN.map((q) => q.cap)).toEqual([600, 600, 600, 600, 1000]);
  });

  it('offers the four roles the table accepts', () => {
    expect(FEEDBACK_ROLES).toEqual(['hr', 'manager', 'colleague', 'other']);
  });
});

describe('feedback endpoint', () => {
  it('lives on the same project as ingest and ends at the feedback function', () => {
    expect(new URL(FEEDBACK_ENDPOINT).host).toBe(new URL(INGEST_ENDPOINT).host);
    expect(FEEDBACK_ENDPOINT).toMatch(/\/functions\/v1\/feedback$/);
    expect(FEEDBACK_ENDPOINT).not.toContain('PROJECT_REF');
  });

  it('names the honeypot field and the signature cap', () => {
    expect(FEEDBACK_HONEYPOT_FIELD).toBe('website');
    expect(FEEDBACK_SIGNATURE_MAX).toBe(120);
  });
});

describe('validateFeedback', () => {
  const valid = { task: 'a', helps: 'b', friction: 'c', gap: 'd', role: 'hr' };

  it('rejects a submission missing the four required answers', () => {
    const result = validateFeedback({ task: 'x' });
    expect(result.ok).toBe(false);
    expect(result.fields).toEqual(['helps', 'friction', 'gap']);
  });

  it('accepts four answers without a signature and leaves "more" empty', () => {
    const result = validateFeedback(valid);
    expect(result.ok).toBe(true);
    expect(result.value.role).toBe('hr');
    expect(result.value.answers.more).toBe('');
  });

  it('caps an oversized answer instead of failing it', () => {
    const result = validateFeedback({ ...valid, friction: 'f'.repeat(601) });
    expect(result.ok).toBe(true);
    expect(result.value.answers.friction.length).toBe(600);
  });

  it('caps the signature', () => {
    const result = validateFeedback({ ...valid, signature: 's'.repeat(200) });
    expect(result.value.signature.length).toBe(FEEDBACK_SIGNATURE_MAX);
  });

  it('falls back to "other" for a role that is not on the list', () => {
    expect(validateFeedback({ ...valid, role: 'boss' }).value.role).toBe('other');
  });

  it('flattens the value into the field names the no-JS form posts', () => {
    const fields = toFormFields(validateFeedback(valid).value);
    expect(Object.keys(fields)).toEqual([
      'q_task',
      'q_helps',
      'q_friction',
      'q_gap',
      'q_more',
      'role',
      'signature',
    ]);
    expect(fields.q_task).toBe('a');
  });
});
