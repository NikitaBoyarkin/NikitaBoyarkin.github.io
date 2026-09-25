#!/usr/bin/env bun
/**
 * Sync contact-form submissions from Supabase into docs/contact-log.md.
 *
 * The log is the source of truth for *outcome* stages (docs/contact-log.md
 * rules 1–4); PostHog only ever sees a click. This closes the loop in one
 * direction: one `contact` row per inbound form submission, nothing else.
 *
 *   bun run sync:contacts          # dry run — prints the rows it would add
 *   bun run sync:contacts:apply    # writes them
 *
 * Idempotent by the message's short id, which is written into the `evidence`
 * cell (`#ab12cd34 …`): a row is appended only when its id is absent from the
 * log. ponytail: the log is its own state — a separate committed state file
 * would be one more thing to drift. Ceiling: delete a row by hand and the next
 * run re-adds it.
 *
 * Never rewrites or reorders a data row: `segment`, `next action` and the stage
 * progression (screening → offer) are edited by hand and stay untouched. The
 * only line it removes is the "no rows yet" placeholder, once a real row exists.
 */

import { readFileSync, writeFileSync } from 'node:fs';

const LOG_PATH = 'docs/contact-log.md';
const TABLE_HEADER = '| date | source | company | segment | stage | evidence | next action |';
const PLACEHOLDER = '_no rows yet — awaiting first inbound contact_';

// Values the log's own schema allows; anything else is a bug upstream.
const SOURCES = new Set(['linkedin', 'hh', 'telegram', 'github', 'referral', 'direct', 'other']);

const APPLY = process.argv.includes('--apply');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Collapse whitespace, cap the length, and escape pipes — a raw `|` splits the row. */
export function cell(value, max = 0) {
  let text = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (max && text.length > max) text = `${text.slice(0, max - 1)}…`;
  return text.replace(/\|/g, '\\|') || '—';
}

/** One message → one `contact` row. `segment` is unknowable from a form, so it stays `other`. */
export function buildRow(message) {
  const name = cell(message.name, 40);
  const handle = cell(message.contact, 60);
  const who = name === '—' ? handle : `${name} (${handle})`;
  const quote = cell(message.message, 80);
  return `| ${[
    message.created_at.slice(0, 10),
    cell(message.source),
    cell(message.company),
    'other',
    'contact',
    `#${message.id.slice(0, 8)} ${who}: «${quote}»`,
    'reply',
  ].join(' | ')} |`;
}

/** Ids already present in the log, as 8-char prefixes. */
export function seenIds(log) {
  return new Set([...log.matchAll(/#([0-9a-f]{8})\b/g)].map((match) => match[1]));
}

/** Append rows after the last data row of the Log table; drop the placeholder if real rows exist. */
export function insertRows(log, newRows) {
  const lines = log.split('\n');
  const head = lines.findIndex((line) => line.trim() === TABLE_HEADER);
  if (head === -1) throw new Error(`log table header not found in ${LOG_PATH}`);

  let end = head + 2; // header + separator
  const existing = [];
  let placeholderSeen = false;
  while (end < lines.length && lines[end].startsWith('|')) {
    if (lines[end].includes(PLACEHOLDER)) placeholderSeen = true;
    else existing.push(lines[end]);
    end += 1;
  }

  const merged = [...existing, ...newRows];
  if (merged.length === 0) return { log, added: 0, droppedPlaceholder: false };

  return {
    log: [...lines.slice(0, head + 2), ...merged, ...lines.slice(end)].join('\n'),
    added: newRows.length,
    droppedPlaceholder: placeholderSeen,
  };
}

async function fetchMessages() {
  const query = 'select=id,created_at,name,contact,company,message,source&order=created_at.asc';
  const res = await fetch(`${SUPABASE_URL}/rest/v1/contact_messages?${query}`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase responded ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('[warn] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (Bun loads .env.local)');
    process.exit(1);
  }

  const log = readFileSync(LOG_PATH, 'utf8');
  const messages = await fetchMessages();
  const seen = seenIds(log);
  const fresh = messages.filter((message) => !seen.has(message.id.slice(0, 8)));

  for (const message of fresh) {
    if (!SOURCES.has(message.source)) console.warn(`[warn] ${message.id}: unknown source "${message.source}" → check the row by hand`);
    if (!message.contact?.trim()) console.warn(`[warn] ${message.id}: empty contact field`);
  }

  if (fresh.length === 0) {
    console.log(`[skip] ${LOG_PATH} is up to date (${messages.length} message(s) in the table)`);
    return;
  }

  const rows = fresh.map(buildRow);
  if (!APPLY) {
    console.log(`[ok] dry run — ${rows.length} row(s) would be added to ${LOG_PATH}:`);
    for (const row of rows) console.log(`  ${row}`);
    console.log('[warn] re-run with --apply to write');
    return;
  }

  const { log: next, droppedPlaceholder } = insertRows(log, rows);
  writeFileSync(LOG_PATH, next);
  console.log(`[ok] added ${rows.length} row(s) to ${LOG_PATH}`);
  if (droppedPlaceholder) console.log('[ok] removed the "no rows yet" placeholder');
  console.log('[warn] fill in `segment` and confirm `next action` for each new row');
}

if (import.meta.main) {
  await main();
}
