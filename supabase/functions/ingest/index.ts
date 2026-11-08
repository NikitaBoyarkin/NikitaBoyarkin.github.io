// Entry point for the `ingest` Edge Function. Reads the deployment's config
// once and hands every request to handle(); the logic lives in ./handler.ts so
// `deno test` can import it without a server starting as a side effect.

import { type Env, handle, unexpectedError } from './handler.ts';

const ENV: Env = {
  supabaseUrl: Deno.env.get('SUPABASE_URL') ?? '',
  serviceRole: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  // No default: see handler.ts. Missing IP_SALT must fail loudly.
  ipSalt: Deno.env.get('IP_SALT') ?? '',
};

Deno.serve((req: Request): Promise<Response> =>
  handle(req, ENV).catch((error: unknown) => {
    console.error('ingest: unhandled', error instanceof Error ? error.name : typeof error);
    return unexpectedError();
  })
);
