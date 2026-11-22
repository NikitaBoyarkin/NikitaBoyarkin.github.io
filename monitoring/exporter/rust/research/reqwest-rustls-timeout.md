# reqwest + rustls: matching `fetch` + `AbortSignal.timeout`

Port of one outbound `POST` per pull (Bun `fetch` → Rust `reqwest`) keeping the same observable
behaviour: every failure hits one counter, nothing escapes the pull, nothing that used to fail
starts succeeding.

## Summary

- **reqwest 0.13.5**; rustls is the default backend since 0.13, `rustls-tls` was renamed `rustls`,
  OpenSSL is not in the default tree. `http2` is default, so the wire speaks HPACK, not text.
- `AbortSignal.timeout` covers DNS+connect+TLS+headers+**body**; `ClientBuilder::timeout` is the
  equivalent, `.connect_timeout` is not, and reqwest's default is **no timeout**.
- reqwest adds exactly one header the original lacks: `accept: */*`; both JSON paths fail on
  non-JSON *and* empty bodies, so neither yields an `Ok(null)`.
- 7 error families + 1 panic must funnel into the same counter; the `Client` is built once.

## 1. Version, features, wire format

**reqwest 0.13.5** (2026-09-08, MSRV 1.85) — <https://crates.io/api/v1/crates/reqwest>.
Manifest (<https://raw.githubusercontent.com/seanmonstar/reqwest/v0.13.5/Cargo.toml>):
`default = ["default-tls", "charset", "http2", "system-proxy"]`, `default-tls = ["rustls"]`,
`rustls = ["__rustls-aws-lc-rs", "dep:rustls-platform-verifier", "__rustls"]`.
CHANGELOG 0.13.0: *"`rustls` is now the default TLS backend"*, *"`rustls-tls` has been renamed to
`rustls`"*, roots via `rustls-platform-verifier`.
<https://raw.githubusercontent.com/seanmonstar/reqwest/master/CHANGELOG.md>
Minimal no-OpenSSL set: `default-features = false, features = ["rustls", "json"]` — though plain
`features = ["json"]` is already OpenSSL-free, since `native-tls` is opt-in now; a `rustls-tls`
feature copied from a 0.12-era snippet is a hard cargo error. Dropping defaults also drops
`charset`, `http2`, and **`system-proxy`** (trap 8). `http2` being default means ALPN negotiates h2
against PostHog: HPACK frames with `:method`/`:path`/`:authority`/`:scheme`, no `Connection`.
`.http1_only()` restores text framing; HTTP/3 is opt-in (`http3` + `http3_prior_knowledge`,
`reqwest_unstable`), never default.
<https://docs.rs/reqwest/0.13.5/reqwest/struct.ClientBuilder.html>

## 2. Timeout semantics

DOM spec: *"Returns an AbortSignal instance which will be aborted in milliseconds milliseconds.
Its abort reason will be set to a `TimeoutError` DOMException."*
<https://dom.spec.whatwg.org/#dom-abortsignal-timeout>
Fetch spec, what the abort reaches: `fetch()` adds abort steps to the signal, and *"To abort a
fetch() call … Reject promise with error … If response's body is non-null and its stream is
readable, then **error response's body's stream** with error."*
<https://fetch.spec.whatwg.org/#fetch-method>
→ DNS, connect, TLS, upload, headers **and full body read**: a `res.json()` still streaming at 10 s
rejects. The clock starts at `AbortSignal.timeout()` construction, not at `fetch`.
reqwest, `ClientBuilder::timeout`: *"Enables a total request timeout. The timeout is applied from
when the request starts connecting until the response body has finished. Also considered a total
deadline. **Default is no timeout.**"*
<https://docs.rs/reqwest/0.13.5/reqwest/struct.ClientBuilder.html#method.timeout>
`connect_timeout`: *"Set a timeout for only the connect phase of a Client. Default is None."* —
TCP/DNS only, not TLS/upload/body; `read_timeout` resets per read. Neither substitutes, and
`RequestBuilder::timeout` only overrides per request.
<https://docs.rs/reqwest/0.13.5/reqwest/struct.RequestBuilder.html#method.timeout>

## 3. Extra headers

`ClientBuilder::new()` seeds exactly one default header —
`headers.insert(ACCEPT, HeaderValue::from_static("*/*"))`, src/async_impl/client.rs:283-285
<https://raw.githubusercontent.com/seanmonstar/reqwest/v0.13.5/src/async_impl/client.rs>
**`accept: */*` is always sent** (TS sends none). **`user-agent` is not** — only via
`.user_agent()` (`config.headers.insert(USER_AGENT, …)`, :1141), so Bun's `User-Agent: Bun/…` has no
Rust counterpart unless you add one. **`accept-encoding` is not**, unless
`gzip`/`brotli`/`zstd`/`deflate` is enabled: *"if the request's headers do not already contain an
Accept-Encoding … the Accept-Encoding header is set to gzip."*
<https://docs.rs/reqwest/0.13.5/reqwest/struct.ClientBuilder.html#method.gzip>
**`connection` is not**; `host`/`:authority` comes from the protocol layer, as in Bun.
Defaults fill **vacant** slots only (`Entry::Vacant`, client.rs:2631-2637) and `default_headers()`
*inserts* into the same map instead of replacing it (:1172-1177), so `accept` cannot be removed —
only overridden; byte-exact "two headers" is unreachable via the public API.
`client.post(url).bearer_auth(&key).json(&payload)` carries your two: `.json()` sets
`content-type` via `.entry(CONTENT_TYPE).or_insert_with(|| "application/json")`
(src/async_impl/request.rs:466-474), so an explicit type survives — same precedence as the TS
literal. Casing: `HeaderName::from_static` *"requires the static string to only contain lowercase
characters … as per the HTTP/2.0 specification"*, so the wire says `content-type:
application/json`, not `Content-Type`.
<https://docs.rs/http/1.4.0/http/header/struct.HeaderName.html#method.from_static>
Only observable under `.http1_only()`; h2 lowercases regardless.

## 4. JSON parsing

Fetch: *"The json() method steps are to return the result of running consume body with this and
parse JSON from bytes. **The above method can reject with a SyntaxError.**"*
<https://fetch.spec.whatwg.org/#dom-body-json>
Non-JSON → `JSON.parse` throws → rejects with `SyntaxError` (Bun and undici both implement this).
Empty body → *"If object's body is null, then run successSteps with an empty byte sequence"* →
`JSON.parse("")` throws → **rejects**. A `204` is a rejection, not `null`.
reqwest: `Response::json` buffers then deserialises —
`serde_json::from_slice(&full).map_err(|err| crate::error::decode(err).with_url(*url))`; docs:
*"This method fails whenever the response body is not in JSON format, or it cannot be properly
deserialized."*
<https://raw.githubusercontent.com/seanmonstar/reqwest/v0.13.5/src/async_impl/response.rs>
Non-JSON and empty body both give `Err` with `is_decode()` (serde_json `EOF while parsing a
value`); it never panics and never yields `Value::Null`. They agree **only if you call `.json()`** —
`.text()` + lenient parsing would succeed on empty bodies where TS threw, dropping the increment.

## 5. Error mapping

Everything the TS `catch` swallowed, per `struct Error` predicates:
<https://docs.rs/reqwest/0.13.5/reqwest/struct.Error.html>

| # | Failure | Predicate |
|---|---|---|
| 1 | URL/header/body build | `is_builder()` |
| 2 | DNS | `is_dns()` (new in 0.13.5) |
| 3 | TCP connect / TLS handshake | `is_connect()` |
| 4 | total deadline (incl. body) | `is_timeout()` |
| 5 | body read, truncation/reset | `is_body()` |
| 6 | JSON decode | `is_decode()` |
| 7 | 4xx/5xx | `is_status()` — **only via `error_for_status`** |
| 8 | client construction | `Client::new()` **panics**; `builder().build()` → `Err` |

`error_for_status`: *"Turn a response into an error if the server returned an error"* (400..=599).
<https://docs.rs/reqwest/0.13.5/reqwest/struct.Response.html#method.error_for_status>
`Client::new()` panics *"if a TLS backend cannot be initialized, or the resolver cannot load the
system configuration"* — `builder().build()` returns it instead.
<https://docs.rs/reqwest/0.13.5/reqwest/struct.Client.html#method.new>

```rust
let res = client.post(url).bearer_auth(&key).json(&payload).send().await?;
res.error_for_status()?.json::<Value>().await   // status, then body+decode
// match: Ok(v) => Some(v), Err(e) => { errors.inc(); None }  ← the only exit
```
No `?` may escape the block, no `unwrap`/`expect` on any of the eight paths, no `Client::new()`
inside the pull.

## 6. PostHog `/query`

*"To create a query, you make a POST request to the `/api/projects/:project_id/query/` endpoint. The
body of the request should be a JSON object with a `query` property with a `kind` and `query
property"* — here `Authorization: Bearer $POSTHOG_PERSONAL_API_KEY` and
`{"query":{"kind":"HogQLQuery","query":"…"},"name":"…"}`.
<https://posthog.com/docs/api/queries> · endpoints: <https://posthog.com/docs/api/query>
Key needs **Query Read**; `name` shows up in `query_log`. Private endpoints live on
`https://us.posthog.com` / `https://eu.posthog.com` (the `i.` hosts are capture-only) — a wrong host
is just another counted non-2xx. <https://posthog.com/docs/api>
Envelope: `Response(result.model_dump(by_alias=True))` over `QueryResponse` — `results: DataT` plus
`timings/types/columns/error/hogql/hasMore/limit/offset/modifiers`.
<https://raw.githubusercontent.com/PostHog/posthog/master/posthog/api/query.py>,
<https://raw.githubusercontent.com/PostHog/posthog/master/posthog/hogql_queries/query_runner.py>
For `kind:"HogQLQuery"` `results` is **top-level**: rows as arrays of values, order in `columns`.
The `{"results":{"results":…}}` nesting is not produced on this path — it belongs to async-status /
endpoint-run surfaces. If the TS read it defensively, keep the fallback but log when it fires.
A still-running async query answers **`202`** with `query_status.complete == false` and no
`results`, and `/query` is explicitly not for repeat use — *"If your code, script, scheduled job …
runs a query more than once, use Endpoints instead of /query"*, rate limit 2400/hour, `OFFSET` →
**400** for personal keys.

## 7. One `Client`, reused

*"The Client holds a connection pool internally … so it is advised that you create one and reuse
it … because it already uses an Arc internally."*
<https://docs.rs/reqwest/0.13.5/reqwest/struct.Client.html>
Defaults: `pool_idle_timeout: Some(90s)`, `pool_max_idle_per_host: usize::MAX` (client.rs:302-303).
A `Client` per pull means, every pull: new TCP+TLS handshake (fresh pool); a fresh
`rustls::ClientConfig` built inside `Client::build` (client.rs:728), hence an empty resumption store
(`ClientConfig::resumption` is per-config, no ticket reuse —
<https://docs.rs/rustls/0.23.46/rustls/client/client_conn/struct.ClientConfig.html>); a
re-instantiated `rustls-platform-verifier` (trust-store read); and a `new()` panic instead of a
counted error. Build once, pass `&Client` (cloning is `Arc`).

## Semantic traps

1. **No timeout by default** — dropping `.timeout(10s)` hangs forever where TS aborted.
2. **`accept: */*` is unavoidable**; "exactly two headers" is unachievable, don't chase it.
3. **`send()` never fails on 4xx/5xx** — without `error_for_status()` a 401 body becomes a `Value`.
4. **`res.ok` vs `error_for_status` differ on 3xx** (ok=false; error only on 400..=599) — silent.
5. **202 is "ok" in both** but carries no `results` — check for `results`, not just status.
6. **Empty body must stay an error** — `.text()`/`.bytes()` would silently succeed.
7. **`Client::new()` panics**; use `build()` and route the `Err` into the counter.
8. **`system-proxy` is a default feature** — with `HTTPS_PROXY` set, reqwest takes a different
   network path than an unconfigured Bun service. Choose explicitly.
9. **Deadline starts a hair earlier in TS** (at signal construction) — don't assert exact timing.
10. **h2 by default** — different bytes; pin `.http1_only()` if a test asserts raw request text.
