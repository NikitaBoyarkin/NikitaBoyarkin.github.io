// Build-time search index endpoint. Astro emits this to /search-index.json in
// static output. The SearchBox island and the hero search fetch it lazily on
// first focus and filter client-side — no backend, no runtime dependency.
//
// The record builder lives in `src/lib/search-index.ts` because `/search/` also
// renders the same records server-side; see the note there.
import { buildSearchIndex } from "../lib/search-index";

export async function GET() {
  const entries = await buildSearchIndex();
  return new Response(JSON.stringify(entries), {
    headers: { "content-type": "application/json" },
  });
}
