import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { readFileSync } from "node:fs";
import {
  buildIngestEvent,
  INGEST_ENABLED,
  INGEST_PROPS,
  sanitizeIngestProps,
  sendIngest,
  setIngestEnabledForTests,
} from "../../src/lib/ingest";

describe("ingest payload", () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => setIngestEnabledForTests(INGEST_ENABLED));

  it("is inert until PROJECT_REF is replaced", () => {
    expect(INGEST_ENABLED).toBe(false);
  });

  it("keeps only allowlisted scalar props", () => {
    const props = sanitizeIngestProps({
      slug: "volta",
      surface: "card",
      url: "https://github.com/x?token=secret",
      nested: { a: 1 },
      depth: 50,
      answer_matched: false,
    });
    expect(props).toEqual({ slug: "volta", surface: "card", depth: 50, answer_matched: false });
  });

  it("caps query at 100 characters and other strings at 300", () => {
    const props = sanitizeIngestProps({ query: "q".repeat(150), href: "h".repeat(400) });
    expect((props.query as string).length).toBe(100);
    expect((props.href as string).length).toBe(300);
  });

  it("adds session, path, locale and timestamp", () => {
    const event = buildIngestEvent("pageview", { surface: "page" }, 1700000000000);
    expect(event.event_name).toBe("pageview");
    expect(event.path).toBe("/");
    expect(event.locale).toBe("ru");
    expect(event.ts).toBe(1700000000000);
    expect(event.session_id).toBeTruthy();
  });

  it("does not send while disabled", () => {
    let called = 0;
    const original = globalThis.fetch;
    globalThis.fetch = (() => {
      called++;
      return Promise.resolve(new Response(null, { status: 204 }));
    }) as unknown as typeof fetch;
    try {
      sendIngest("pageview");
      expect(called).toBe(0);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("falls back to a keepalive fetch when sendBeacon refuses", () => {
    setIngestEnabledForTests(true);
    let body: string | null = null;
    const originalFetch = globalThis.fetch;
    const originalBeacon = navigator.sendBeacon;
    navigator.sendBeacon = (() => false) as typeof navigator.sendBeacon;
    globalThis.fetch = ((_url: string, init: RequestInit) => {
      body = String(init.body);
      return Promise.resolve(new Response(null, { status: 204 }));
    }) as unknown as typeof fetch;
    try {
      sendIngest("cta_click", { surface: "hero" });
      expect(body).not.toBeNull();
      expect(JSON.parse(body as unknown as string).events[0].event_name).toBe("cta_click");
    } finally {
      globalThis.fetch = originalFetch;
      navigator.sendBeacon = originalBeacon;
    }
  });
});

describe("ingest prop allowlist", () => {
  it("matches the Edge Function's allowlist", () => {
    const limits = readFileSync(
      new URL("../../supabase/functions/ingest/limits.ts", import.meta.url),
      "utf8",
    );
    const block = limits.slice(limits.indexOf("export const PROPS = ["), limits.indexOf("] as const;"));
    const serverProps = [...block.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    expect(serverProps).toEqual([...INGEST_PROPS]);
  });
});
