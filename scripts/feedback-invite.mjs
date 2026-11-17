#!/usr/bin/env node
// Create a feedback invite and print its personal URL.
//
// The raw token exists only in the printed URL; the table stores sha256(token),
// so a leaked table yields no working links. Dry run by default — `--apply`
// writes, and only then.
//
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
//   bun run feedback:invite --role colleague --label "Аня, Яндекс" --apply

import { createHash, randomBytes } from 'node:crypto';

export const SITE = 'https://nikitaboyarkin.github.io';

export function inviteUrl(token, role) {
  return `${SITE}/feedback/?t=${token}&r=${role}`;
}

export const tokenHash = (token) => createHash('sha256').update(token).digest('hex');

function arg(name, fallback) {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? fallback : process.argv[at + 1];
}

async function main() {
  const role = arg('role', 'other');
  const label = arg('label', '');
  const maxResponses = Number(arg('max', '3'));
  const apply = process.argv.includes('--apply');

  if (!['hr', 'manager', 'colleague', 'other'].includes(role)) {
    console.error(`unknown role: ${role}`);
    process.exit(1);
  }
  if (label === '') {
    console.error('--label is required (private note: who this invite is for)');
    process.exit(1);
  }

  const token = randomBytes(8).toString('hex');
  const row = { token_hash: tokenHash(token), role, label, max_responses: maxResponses };

  if (!apply) {
    console.log('dry run — nothing written. Re-run with --apply.');
    console.log(JSON.stringify({ ...row, token_hash: '<sha256>', token }, null, 2));
    console.log(inviteUrl(token, role));
    return;
  }

  const url = process.env.SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (url === '' || key === '') {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    process.exit(1);
  }

  const res = await fetch(`${url}/rest/v1/feedback_invites`, {
    method: 'POST',
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      prefer: 'return=minimal',
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    console.error(`insert failed ${res.status}: ${await res.text()}`);
    process.exit(1);
  }

  console.log(inviteUrl(token, role));
}

if (import.meta.main) await main();
