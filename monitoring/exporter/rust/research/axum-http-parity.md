# axum / hyper HTTP parity with Bun.serve

What a Rust stack (axum 0.8 + tokio + hyper 1) can and cannot reproduce of a `Bun.serve` handler's wire output: status codes, header names and values, bodies.

## Summary

- Header **values** survive byte-for-byte: `from_static` never copies or normalises, and hyper writes `value.as_bytes()` verbatim.
- Header **names** never do: `http::HeaderName` lowercases everything, so `Content-Type` is unreachable through axum.
- hyper adds `date` (default on) and `content-length` (implicit `0` for empty bodies on permitted statuses); `date` is unreachable from `axum::serve`.
- 204/304 are the only statuses where hyper refuses a `content-length`/body outright.
- A bare `StatusCode` return yields `content-length: 0` (hyper short-circuits on `is_end_stream()`), never `chunked` — but reach for `Body::empty()` anyway.

Versions verified on crates.io 2026-11-22: axum **0.8.9**, tokio **1.54.1**, tower **0.5.3**, tower-http **0.7.1**, hyper **1.12.0**, hyper-util **0.1.21**, http **1.5.0**, mime **0.3.17** (<https://crates.io/api/v1/crates/axum>, same endpoint per crate).

## 1. Minimal server

```toml
[dependencies]
axum  = "0.8.9"
tokio = { version = "1.54", features = ["rt-multi-thread", "macros", "net"] }
bytes = "1"
```

Compiles as printed against the versions above (checked with rustc 1.99) and was run to produce the dump under *Observed on the wire*.

```rust
use axum::{body::Body, extract::{DefaultBodyLimit, Request, State},
    http::{header, HeaderValue, Method, StatusCode}, middleware::{self, Next},
    response::Response, routing::{get, post}, Router};
use std::sync::{Arc, Mutex};

const PROM_CT: &str = "text/plain; version=0.0.4; charset=utf-8";
#[derive(Default)]
struct Metrics { beacons: u64 }
type Shared = Arc<Mutex<Metrics>>;

fn build(status: StatusCode, ctype: Option<&'static str>, body: Body) -> Response {
    let mut res = Response::new(body);
    *res.status_mut() = status;
    if let Some(ct) = ctype {
        res.headers_mut().insert(header::CONTENT_TYPE, HeaderValue::from_static(ct));
    }
    res
}
async fn healthz() -> Response {
    build(StatusCode::OK, Some("application/json"), Body::from(r#"{"ok":true}"#))
}
async fn metrics() -> Response {
    let text = "# TYPE beacons_total counter\nbeacons_total 0\n".to_owned();
    build(StatusCode::OK, Some(PROM_CT), Body::from(text))
}
async fn beacon(State(st): State<Shared>, body: bytes::Bytes) -> Response {
    { st.lock().unwrap().beacons += body.len() as u64; }   // guard dies before any .await
    build(StatusCode::NO_CONTENT, None, Body::empty())
}
async fn not_found() -> Response {
    build(StatusCode::NOT_FOUND, Some("text/plain; charset=utf-8"), Body::from("Not found"))
}
async fn cors(req: Request, next: Next) -> Response {
    let mut res = if req.method() == Method::OPTIONS {
        build(StatusCode::NO_CONTENT, None, Body::empty())
    } else {
        next.run(req).await
    };
    let h = res.headers_mut();
    h.insert(header::ACCESS_CONTROL_ALLOW_ORIGIN,  HeaderValue::from_static("*"));
    h.insert(header::ACCESS_CONTROL_ALLOW_METHODS, HeaderValue::from_static("GET, POST, OPTIONS"));
    h.insert(header::ACCESS_CONTROL_ALLOW_HEADERS, HeaderValue::from_static("content-type"));
    res
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/healthz", get(healthz))
        .route("/metrics", get(metrics))
        .route("/beacon", post(beacon))
        .fallback(not_found)
        .method_not_allowed_fallback(not_found)   // else: 405 + `allow`
        .layer(DefaultBodyLimit::disable())
        .layer(middleware::from_fn(cors))
        .with_state(Arc::new(Mutex::new(Metrics::default())) as Shared);
    let listener = tokio::net::TcpListener::bind("0.0.0.0:9464").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
```

`Router::fallback` is **not** consulted when the path matches but the method does not — that goes to the `MethodRouter`, defaulting to `405` plus an `allow` header (<https://docs.rs/axum/0.8.9/axum/struct.Router.html#method.fallback>, `#method.method_not_allowed_fallback`, <https://github.com/tokio-rs/axum/blob/main/axum/src/routing/method_routing.rs#L813-L817>). `Router::layer` covers "routes (and / or fallback)", so one `from_fn` reaches 404s too (<https://docs.rs/axum/0.8.9/axum/struct.Router.html#method.layer>).

Caveat, measured on 0.8.9: `method_not_allowed_fallback` **still appends `allow`** to its response (an `OPTIONS /metrics` returns our `204` plus `allow: GET,HEAD`), and a `from_fn` layer that calls `headers_mut().remove(header::ALLOW)` did not strip it. The only public opt-out is registering the route with `any(handler)` — `any()` is `MethodRouter::new().fallback(handler).skip_allow_header()`, and `skip_allow_header` itself is private (<https://github.com/tokio-rs/axum/blob/main/axum/src/routing/method_routing.rs#L505-L516>, `#L1195-L1198`). Verified live: an `any()` route emits no `allow` for `GET`, `POST` or `OPTIONS`.

## 2. Header casing: what survives

**Values are preserved.** `from_static` neither copies nor normalises; it only rejects bytes outside visible ASCII 32–127, so `text/plain; version=0.0.4; charset=utf-8` is legal. hyper writes `extend(dst, b": ")` then `extend(dst, value.as_bytes())` — <https://docs.rs/http/1.5.0/http/header/struct.HeaderValue.html#method.from_static>, <https://github.com/hyperium/hyper/blob/v1.12.0/src/proto/h1/role.rs#L918-L921>.

**Names are always lowercase.** `HeaderName` stores standard names as an enum, lowercases custom ones, `as_str` "will always be lower case", and `from_static` *panics* on uppercase input — so hyper's default writer emits `content-type:`. `title_case_headers` = "write header names as title case at the socket level. Default is `false`" (<https://docs.rs/http/1.5.0/http/header/struct.HeaderName.html>, <https://docs.rs/hyper/1.12.0/hyper/server/conn/http1/struct.Builder.html#method.title_case_headers>).

Headers hyper adds on its own:

| header | when | suppressible? |
|---|---|---|
| `content-length` | `Known(n)`, or implicit `0` for an empty body on a permitted status | only via 1xx/204/304, `HEAD`, or a body hyper treats as non-empty (→ chunked) |
| `transfer-encoding: chunked` | body not in end-of-stream state **and** no exact `size_hint` (e.g. `Body::from_stream`) | yes — give the body an exact size hint (`Body::from(String/Vec<u8>/Bytes)`) |
| `date` | every response; `auto_date_header` default `true` | **not via `axum::serve`** |

Write path: <https://github.com/hyperium/hyper/blob/v1.12.0/src/proto/h1/role.rs#L930-L995>; the length decision is `if body.is_end_stream() { None } else { size_hint().exact() … or Unknown }` — <https://github.com/hyperium/hyper/blob/v1.12.0/src/proto/h1/dispatch.rs#L367-L375>.

`axum::serve` builds `hyper_util::server::conn::auto::Builder` and sets only `.http1().timer(TokioTimer::new())`; its public surface is `local_addr` + `with_graceful_shutdown`, so casing and `date` are not options through axum (<https://github.com/tokio-rs/axum/blob/main/axum/src/serve/mod.rs#L837-L847>, <https://docs.rs/axum/0.8.9/axum/serve/struct.Serve.html>):

```rust
let mut b = hyper_util::server::conn::auto::Builder::new(TokioExecutor::new());
b.http1().auto_date_header(false);            // .title_case_headers(true) if needed
// b.serve_connection_with_upgrades(TokioIo::new(stream), TowerToHyperService::new(app))
```

(`auto_date_header` is <https://github.com/hyperium/hyper-util/blob/main/src/server/conn/auto/mod.rs#L734-L736>.)

## 3. 204 with zero bytes; 400 with an empty body

```rust
build(StatusCode::NO_CONTENT, None, Body::empty())   // no body, no content-length at all
build(StatusCode::BAD_REQUEST,  None, Body::empty()) // body empty, `content-length: 0`
```

For 1xx/204/304 (and `HEAD`, `CONNECT`-2xx) `can_have_content_length` is false, the length arm is skipped and the encoder is forced to `length(0)`; `can_have_implicit_zero_content_length` additionally excludes `HEAD`. No configuration puts `content-length` on a 204 (<https://github.com/hyperium/hyper/blob/v1.12.0/src/proto/h1/role.rs#L539-L549>, `#L944-L980`).

RFC 9110 §15.3.5: "A 204 response is terminated by the end of the header section; it cannot contain content or trailers". §8.6: "A server MUST NOT send a Content-Length header field in any response with a status code of 1xx (Informational) or 204 (No Content)" — <https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.5>, `#section-8.6`.

Neither header *nor* body on a 400 is reachable: `Body::empty()` → `content-length: 0`, and `Body::unknown()` produces the same bytes on the wire (trap 1).

## 4. Body to bytes without the 2 MB surprise

`Bytes`, `String`, `Json`, `Form` buffer through `Bytes` and inherit a **2 MB** cap; over it axum's rejection answers `413 Payload Too Large` before your handler runs.

```rust
.layer(DefaultBodyLimit::disable())             // no cap
.layer(DefaultBodyLimit::max(64 * 1024 * 1024)) // explicit cap
.layer(tower_http::limit::RequestBodyLimitLayer::new(64 * 1024 * 1024)) // extractor-independent
```

<https://docs.rs/axum/0.8.9/axum/extract/struct.DefaultBodyLimit.html> (`disable()`, `max()`, the `get(|body: Bytes| …)` example, and the `DefaultBodyLimit` vs `RequestBodyLimit` difference); `#[status = PAYLOAD_TOO_LARGE]` on `LengthLimitError` is <https://github.com/tokio-rs/axum/blob/main/axum-core/src/extract/rejection.rs#L35-L49>.

## 5. CORS: `CorsLayer` vs exactly three headers

`CorsLayer::new()` sends **no** headers until configured, and `vary` is derived: "If none of those values are request-dependent, no `Vary` header is added". So `Any` origin plus static method/header lists yields only the three `access-control-allow-*` headers on normal responses:

```rust
use tower_http::cors::{Any, CorsLayer};
app.layer(CorsLayer::new()
    .allow_origin(Any)
    .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
    .allow_headers([header::CONTENT_TYPE]));
```

Caveats: the layer answers preflight itself with **200** and an empty body (hence `content-length: 0`), and `allow_headers(Any)` mirrors `access-control-request-headers`, which then does add `vary`. For byte-exactness the manual middleware in §1 is the controllable path (<https://docs.rs/tower-http/0.7.1/tower_http/cors/struct.CorsLayer.html#method.new>, `#method.vary`, `#method.allow_headers`).

Version skew: axum 0.8.9 depends on `tower-http ^0.6.8`; using 0.7.1 directly is fine (a `Layer`, not a type axum names), but enabling axum's `tower-http` feature compiles two copies (<https://docs.rs/axum/0.8.9/axum/> dependency table).

## 6. Binding and shared state

`tokio::net::TcpListener::bind("0.0.0.0:PORT").await` then `axum::serve(listener, app)`; `app` must be `Router<()>`, which is what `with_state` produces. `State<T>` clones `T` per request, so `Arc<Mutex<_>>` keeps that cheap; body-consuming extractors (`Bytes`) go last (<https://docs.rs/axum/0.8.9/axum/index.html#sharing-state-with-handlers>, <https://docs.rs/axum/0.8.9/axum/struct.Router.html#method.with_state>).

The gotcha: `std::sync::MutexGuard` is **not `Send`** and handler futures must be `Send`, so holding the guard across `.await` is a compile error — not a runtime surprise. `drop(lock)` does not fix it (`Send`-ness is computed per scope); only a block scope or a non-async method does. `tokio::sync::Mutex` permits holding across `.await`, at a cost (<https://doc.rust-lang.org/std/sync/struct.MutexGuard.html> — trait list shows `!Send`; <https://tokio.rs/tokio/tutorial/shared-state> — "Holding a `MutexGuard` across an `.await`").

## 7. Plain hyper instead of axum — facts only

- `axum::serve` is a thin wrapper over `hyper_util::server::conn::auto::Builder` + `TowerToHyperService`. Without it you write the accept loop, `service_fn`, a `match (method, path)` router, `BodyExt::collect()` for the body, and the fallback/405 logic by hand — <https://github.com/tokio-rs/axum/blob/main/axum/src/serve/mod.rs#L820-L850>, <https://github.com/hyperium/hyper/blob/master/examples/hello.rs>.
- Non-optional deps axum adds: `axum-core`, `matchit`, `tower`, `tower-layer`, `tower-service`, `mime`, `sync_wrapper`, `itoa`, `memchr`, `percent-encoding`, `futures-util`, `serde_core` (<https://docs.rs/axum/0.8.9/axum/>).
- hyper-only makes `auto_date_header` / `title_case_headers` reachable without a custom builder, since you construct `http1::Builder` yourself (<https://docs.rs/hyper/1.12.0/hyper/server/conn/http1/struct.Builder.html>).
- Lost: typed extractors, `State`, path matching, the `fallback` / `method_not_allowed_fallback` split. No binary-size figure is claimed — not measured.

## Observed on the wire (this snippet, axum 0.8.9 / hyper 1.12.0, `curl -D -`)

```
GET /healthz          200 | content-type: application/json | content-length: 11 | date
GET /metrics          200 | content-type: text/plain; version=0.0.4; charset=utf-8 | content-length: 45
POST /beacon          204 | (no content-type, no content-length, no body)
OPTIONS /metrics      204 | + allow: GET,HEAD        <- stray header, see trap 6
GET /nope             404 | content-type: text/plain; charset=utf-8 | content-length: 9 | body `Not found`
GET /beacon           404 | + allow: POST             (method_not_allowed_fallback)
```

Every response also carried the three `access-control-allow-*` headers, in insertion order, before `content-length`/`date`.

## Semantic traps (silent Bun.serve ↔ axum/hyper differences)

1. **Bare `StatusCode` gives `content-length: 0`, not `chunked`.** `impl IntoResponse for StatusCode` returns `Body::unknown()`, whose `is_end_stream()` is `true`; hyper's length decision short-circuits on that flag, so no `transfer-encoding` appears (measured: `GET` a handler returning `StatusCode::OK` → `content-length: 0`). Chunked appears only for a body that is *not* at end-of-stream with no exact `size_hint`. `Body::unknown()` still differs from `Body::empty()` in `size_hint` upper bound — relevant to `HEAD` and to intermediaries (<https://github.com/tokio-rs/axum/blob/main/axum-core/src/response/into_response.rs>, <https://github.com/tokio-rs/axum/blob/main/axum-core/src/body.rs>, <https://github.com/hyperium/hyper/blob/v1.12.0/src/proto/h1/dispatch.rs#L367-L375>).
2. **`&'static str` injects axum's spelling, not Bun's.** axum inserts `mime::TEXT_PLAIN_UTF_8`, literally `"text/plain; charset=utf-8"` (space after `;`, lowercase) — confirmed in the 404 above; Bun writes `text/plain;charset=UTF-8`. Set the header explicitly (<https://github.com/tokio-rs/axum/blob/main/axum-core/src/response/into_response.rs> `impl IntoResponse for Cow<'static, str>`; mime 0.3.17 `src/lib.rs:751`).
3. **`date` is always present** and cannot be disabled through `axum::serve`; any header diff against the Bun original shows it.
4. **Header names are lowercase on the wire**, always. `Content-Type` is unreachable without `title_case_headers(true)` on a hand-built `http1::Builder`.
5. **2 MB body cap → 413**, before the handler; `DefaultBodyLimit::disable()` is required to mimic an unbounded Bun read.
6. **`405`/`allow` leaks past your handler.** Wrong method on an existing path never reaches `Router::fallback` (you get `405` + `allow`), and even `method_not_allowed_fallback` re-adds `allow` — visible above as `allow: GET,HEAD` / `allow: POST`. Only `any(handler)` (`skip_allow_header`) suppresses it, and that method is private.
7. **hyper's own error responses bypass handlers** — malformed request 400, too many headers 431, oversized headers 414/431 — and carry no CORS headers (<https://docs.rs/hyper/1.12.0/hyper/server/conn/http1/struct.Builder.html#method.max_headers>, `#method.max_header_size`).
8. **Header order is `HeaderMap` iteration order**, not insertion order, so a raw byte diff differs even with identical header sets.
9. **`CorsLayer` answers preflight with 200**, not the 204 a Bun handler may return, and `Any` mirrors request headers (adding `vary`).
10. **A 204 silently discards any body you attach** — hyper forces `length(0)` rather than erroring.
11. **`HEAD` drops the implicit `content-length: 0`** that an equivalent empty 200 gets (`can_have_implicit_zero_content_length` excludes `HEAD`), so HEAD/GET headers differ by exactly that line.
