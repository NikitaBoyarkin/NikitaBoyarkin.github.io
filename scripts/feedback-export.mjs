#!/usr/bin/env node
// Export feedback responses to a JSON + CSV pair outside the repo.
//
// Never overwrites, never exports ip_hash / invite_id / the invite label, and
// requires `--apply`: reading private answers should be a deliberate act.
//
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… bun run feedback:export --apply

import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const EXPORT_COLUMNS = [
  'id',
  'created_at',
  'role',
  'source',
  'locale',
  'q_task',
  'q_helps',
  'q_friction',
  'q_gap',
  'q_more',
  'signature',
];

const cell = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export function toCsv(rows) {
  const lines = [EXPORT_COLUMNS.join(',')];
  for (const row of rows) lines.push(EXPORT_COLUMNS.map((column) => cell(row[column])).join(','));
  return `${lines.join('\n')}\n`;
}

const flatten = (row) => ({
  ...row,
  ...(row.answers ?? {}),
  answers: undefined,
});

async function main() {
  if (!process.argv.includes('--apply')) {
    console.error('refusing to read private answers without --apply');
    process.exit(1);
  }

  const url = process.env.SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (url === '' || key === '') {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    process.exit(1);
  }

  const res = await fetch(`${url}/rest/v1/feedback_responses?select=*&order=created_at.asc`, {
    headers: { apikey: key, authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    console.error(`fetch failed ${res.status}: ${await res.text()}`);
    process.exit(1);
  }

  const rows = (await res.json()).map(flatten);
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const dir = process.env.FEEDBACK_EXPORT_DIR ?? join(homedir(), 'Desktop/00 ide/00 portfolio/_feedback-export');
  await mkdir(dir, { recursive: true });

  const base = join(dir, `feedback-${stamp}`);
  for (const path of [`${base}.json`, `${base}.csv`]) {
    if (existsSync(path)) {
      console.error(`refusing to overwrite ${path}`);
      process.exit(1);
    }
  }

  // The JSON keeps every column except the ones that identify a person or a
  // device; the CSV keeps only EXPORT_COLUMNS, so a spreadsheet is safe to open.
  const safe = rows.map(({ ip_hash: _ip, invite_id: _invite, ...rest }) => rest);
  await writeFile(`${base}.json`, `${JSON.stringify(safe, null, 2)}\n`);
  await writeFile(`${base}.csv`, toCsv(rows));
  console.log(`${rows.length} responses → ${base}.json, ${base}.csv`);
}

if (import.meta.main) await main();
