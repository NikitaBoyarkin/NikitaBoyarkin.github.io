// Feedback survey contract — the one place the five questions, their caps and
// the endpoint are written down for the client. Pure and DOM-free so the
// browser island renders from it and the Edge Function's drift test reads it
// against the SQL CHECK constraints.
//
// The caps here are a *mirror*, not the enforcement point: the function
// re-validates and the column CHECKs are the last line of defence.

export const FEEDBACK_ENDPOINT = 'https://geojpakugqlcwyhtnjvv.supabase.co/functions/v1/feedback';

/** Off-screen field name that only a bot fills. */
export const FEEDBACK_HONEYPOT_FIELD = 'website';

export const FEEDBACK_SIGNATURE_MAX = 120;

export const FEEDBACK_QUESTION_KEYS = ['task', 'helps', 'friction', 'gap', 'more'] as const;
export type FeedbackQuestionKey = (typeof FEEDBACK_QUESTION_KEYS)[number];

export interface FeedbackQuestion {
  key: FeedbackQuestionKey;
  label: string;
  cap: number;
  required: boolean;
}

export const FEEDBACK_QUESTIONS_RU: readonly FeedbackQuestion[] = [
  { key: 'task', label: 'С какой задачей вы бы позвали меня завтра?', cap: 600, required: true },
  { key: 'helps', label: 'Что в моей работе помогает вам больше всего?', cap: 600, required: true },
  { key: 'friction', label: 'Что мешает или вызывает трение?', cap: 600, required: true },
  { key: 'gap', label: 'Чего мне не хватает как продуктовому аналитику?', cap: 600, required: true },
  { key: 'more', label: 'Что-то ещё — необязательно', cap: 1000, required: false },
];

export const FEEDBACK_QUESTIONS_EN: readonly FeedbackQuestion[] = [
  { key: 'task', label: 'What task would you call me for tomorrow?', cap: 600, required: true },
  { key: 'helps', label: 'What about my work helps you the most?', cap: 600, required: true },
  { key: 'friction', label: 'What gets in the way or causes friction?', cap: 600, required: true },
  { key: 'gap', label: 'What am I missing as a product analyst?', cap: 600, required: true },
  { key: 'more', label: 'Anything else — optional', cap: 1000, required: false },
];

export const FEEDBACK_ROLES = ['hr', 'manager', 'colleague', 'other'] as const;
export type FeedbackRole = (typeof FEEDBACK_ROLES)[number];

export interface FeedbackValues {
  role: FeedbackRole;
  answers: Record<FeedbackQuestionKey, string>;
  signature: string;
}

export interface FeedbackValidation {
  ok: boolean;
  /** Offending field names, in render order. */
  fields: string[];
  /** Trimmed, capped values — what should actually be sent. */
  value: FeedbackValues;
}

type FeedbackInput = Partial<Record<FeedbackQuestionKey | 'signature' | 'role', string>>;

const CAPS: Record<FeedbackQuestionKey, number> = { task: 600, helps: 600, friction: 600, gap: 600, more: 1000 };
const REQUIRED: readonly FeedbackQuestionKey[] = ['task', 'helps', 'friction', 'gap'];

function cap(raw: string | undefined, max: number): string {
  return (raw ?? '').trim().slice(0, max);
}

export function validateFeedback(input: FeedbackInput): FeedbackValidation {
  const answers = {} as Record<FeedbackQuestionKey, string>;
  const fields: string[] = [];

  for (const key of FEEDBACK_QUESTION_KEYS) {
    answers[key] = cap(input[key], CAPS[key]);
    if (REQUIRED.includes(key) && answers[key].length === 0) fields.push(key);
  }

  const role = FEEDBACK_ROLES.includes(input.role as FeedbackRole) ? (input.role as FeedbackRole) : 'other';

  return {
    ok: fields.length === 0,
    fields,
    value: { role, answers, signature: cap(input.signature, FEEDBACK_SIGNATURE_MAX) },
  };
}

/** Flat field names for the no-JS `application/x-www-form-urlencoded` post. */
export function toFormFields(value: FeedbackValues): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const key of FEEDBACK_QUESTION_KEYS) fields[`q_${key}`] = value.answers[key];
  fields.role = value.role;
  fields.signature = value.signature;
  return fields;
}
