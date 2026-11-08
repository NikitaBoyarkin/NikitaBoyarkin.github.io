import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();

// happy-dom implements sendBeacon as a real cross-origin fetch. Since INGEST_ENABLED
// became true, any test that calls track() sends a live beacon to the Supabase
// endpoint; where the runner has network, the CORS rejection surfaces as an
// unhandled NetworkError between tests and `bun test` exits 1. Tests that assert on
// the transport stub it themselves (tests/lib/ingest.test.ts).
navigator.sendBeacon = (() => true) as typeof navigator.sendBeacon;

process.env.BASE_URL ??= "/";