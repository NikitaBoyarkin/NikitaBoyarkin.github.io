// Contact-form contract — the one place the shape of a submission is written
// down for the client. Pure and DOM-free so it can be imported by the browser
// island and read against the Edge Function and the DB CHECK constraints.
//
// The endpoint and the booking URL are constants, not env vars, on purpose: an
// env var that is missing from CI fails *silently* — this repo already carries
// that bug with `PUBLIC_BEACON_ENDPOINT` (`BeaconMetrics.astro` renders nothing
// at all when it is unset, so the beacon simply disappears). A constant with a
// placeholder is greppable and its TODO is visible in review; a missing env var
// is invisible in both.

// TODO(Phase 0): replace PROJECT_REF with the owner's Supabase project ref.
export const CONTACT_ENDPOINT =
  'https://PROJECT_REF.supabase.co/functions/v1/contact';

export const CAL_BOOKING_URL = 'https://cal.com/lofinibo/30min';

/**
 * Off-screen field name that only a bot fills. Shared so the markup, the
 * honeypot rule and the Edge Function cannot drift apart on the spelling.
 */
export const CONTACT_HONEYPOT_FIELD = 'website';

/**
 * Length caps, mirrored from the `contact_messages` CHECK constraints
 * (`supabase/migrations/20260926000000_contact_messages.sql`).
 */
export const CONTACT_LIMITS = {
  name: 120,
  contact: 200,
  company: 160,
  message: 4000,
} as const;

export interface ContactValues {
  name: string;
  contact: string;
  company: string;
  message: string;
}

export interface ContactValidation {
  ok: boolean;
  /** Offending field names, in render order (contact, then message). */
  fields: string[];
  /** Trimmed, capped values — what should actually be sent. */
  value: ContactValues;
}

type ContactInput = Partial<Record<keyof ContactValues, string>>;

function cap(raw: string | undefined, max: number): string {
  return (raw ?? '').trim().slice(0, max);
}

/**
 * Validate and normalize a submission for client-side UX.
 *
 * This is a *mirror*, not the enforcement point. The Edge Function re-validates
 * every field and the DB CHECK constraints are the last line of defence; the
 * caps are duplicated here deliberately, because the browser cannot be trusted
 * and a round trip is far too slow for inline field errors.
 */
export function validateContact(input: ContactInput): ContactValidation {
  const value: ContactValues = {
    name: cap(input.name, CONTACT_LIMITS.name),
    contact: cap(input.contact, CONTACT_LIMITS.contact),
    company: cap(input.company, CONTACT_LIMITS.company),
    message: cap(input.message, CONTACT_LIMITS.message),
  };

  const fields: string[] = [];
  if (value.contact.length < 3) fields.push('contact');
  if (value.message.length < 5) fields.push('message');

  return { ok: fields.length === 0, fields, value };
}
