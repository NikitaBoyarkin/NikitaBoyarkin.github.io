// Entry point for the `feedback` Edge Function. Reads the deployment's config
// once and hands every request to handleFeedback(); the logic lives in
// ./handler.ts so `deno test` can import it without starting a server.

import { type Env, handleFeedback, unexpectedError } from './handler.ts';

const ENV: Env = {
  supabaseUrl: Deno.env.get('SUPABASE_URL') ?? '',
  serviceRole: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  // A distinct salt from ingest on purpose: a shared one would join a feedback
  // answer to analytics_events by ip_hash. No default, so a missing secret fails
  // loudly instead of producing a reversible hash.
  ipSalt: Deno.env.get('FEEDBACK_IP_SALT') ?? '',
};

Deno.serve((req: Request): Promise<Response> =>
  handleFeedback(req, ENV).catch((error: unknown) => {
    console.error('feedback: unhandled', error instanceof Error ? error.name : typeof error);
    return unexpectedError();
  })
);
