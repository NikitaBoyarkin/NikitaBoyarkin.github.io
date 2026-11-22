# Decisions — red-exporter: TypeScript (Bun) → Rust

One ADR per decision, numbered in order, never renumbered. A changed decision gets a new ADR that
supersedes the old one. Port root is this repository package (`monitoring/exporter`).

## ADR-001: Shape — a server, ported as an axum front door

Status: accepted (2026-11-22)

Context: `analyze --whole-app` reports shape **server**, entered through `src/app.ts`
(`createServer`) and `src/index.ts`. The app answers three routes on one port plus an optional
background poller; it has no CLI arguments, no stdin, no files besides an optional SQLite file.

Decision: port every entry point in that shape. `rust/app` owns the port and listens on
`BEACON_PORT`; the original stays runnable until the lift.

Consequences: the port is judged at the HTTP edge (status, headers, body) plus two out-of-process
effects (the SQLite dump, the outbound PostHog request). No trycmd CLI cases.

## ADR-002: Scope — all seven units, nothing dropped

Status: accepted (2026-11-22)

Context: `BEACON_DB` → `bun:sqlite` sink is wired in `docker-compose.yml` (volume `beacon-data`);
`START_POLLER=1` → `portfolio_lcp_seconds` et al. is read by the provisioned Grafana dashboard.
Neither is dead code.

Decision: port `config`, `metrics`, `db`, `beacon`, `posthog-pull`, `app`, `index`. Keep the
optional SQLite sink (`rusqlite`, bundled) and the background poller.

Consequences: the port needs a SQLite crate and an HTTP client crate; the Docker image must carry
a SQLite-capable binary, which a bundled rusqlite satisfies without system libraries.

## ADR-003: Equivalence bar — byte-for-byte at the HTTP edge

Status: accepted (2026-11-22)

Context: the bodies are machine-read (Prometheus scrape, Grafana, `beacon` JS). Sample order in
`/metrics` follows insertion order; label order follows `labelNames`; labels are escaped
(`\\`, `\"`, `\n`); the text ends with a newline.

Decision: byte-identical status line, the headers we set (exact values, no added header of our
own), and body for **every** route: `/healthz` → `{"ok":true}`, `/metrics` →
`text/plain; version=0.0.4; charset=utf-8` with family order = `FAMILIES`, sample order =
insertion order, `/beacon` → 204 with an empty body, invalid JSON → 400 empty body, anything else
→ 404 with body `Not found`.

Exception, agreed with the user: the startup line on stdout
(`red-exporter (bun) listening on :9100`) becomes `(rust)`; nothing parses it.

Consequences: `metrics` renders through `IndexMap` (never `HashMap`); a recorded case pins the
exact byte order of a multi-sample render.

## ADR-004: Compatibility — env names, defaults, routes and CORS stay 1:1

Status: accepted (2026-11-22)

Context: `docker-compose.yml`, `.env.example`, Prometheus and the browser beacon all depend on the
current names.

Decision: `POSTHOG_API_KEY` (default ""), `POSTHOG_PROJECT_ID` (""), `POSTHOG_HOST`
(`https://us.posthog.com`), `POSTHOG_PULL_INTERVAL` (`15`), `POSTHOG_PULL_WINDOW` (`30m`),
`SITE_ORIGIN` (`*`), `BEACON_PORT` (`9100`), `BEACON_DB` ("" = sink off), `START_POLLER` (only the
literal `"1"` enables it). `OPTIONS *` → 204 with `access-control-allow-origin` (SITE_ORIGIN),
`access-control-allow-methods: POST, OPTIONS`, `access-control-allow-headers: *`. The HogQL body,
`INTERVAL {window:raw}` and the 10 s timeout stay symbol-for-symbol.

Consequences: no `PORT` fallback is added; the poller interval is read in seconds, not ms; a missing
`POSTHOG_API_KEY` still produces a failed pull (and a counter), not a startup error.

## ADR-005: Crates — axum, tokio, reqwest(rustls), rusqlite(bundled), serde_json, indexmap

Status: accepted (2026-11-22)

Context: `app front-door` scaffolds axum and `app wire --route` speaks axum route syntax; alpine
images have no OpenSSL or libsqlite3; the risky semantics (order, escaping) are documented in
`rust/research/`.

Decision: `axum` + `tokio` (multi-thread) for the server, `reqwest` with `rustls-tls` for the pull,
`rusqlite` with `bundled` for the sink, `serde_json` for bodies, `indexmap` for insertion-ordered
labels and payload keys, `serde` for the HogQL payload.

Consequences: first build takes minutes (SQLite C sources + rustls), the binary is several MB but
still far below the bun base image; no system `-dev` packages in either stage.

## ADR-006: Recording — one local PostHog stand-in, effects and a DB dump

Status: accepted (2026-11-22)

Context: the live PostHog API needs a personal key and the network, and the pull is the only
outbound request the app makes. `app record --http` can record outbound HTTP through a sink
(`--effects http`, `--effect-env POSTHOG_HOST=http-url`) and the database through `--db-dump`.

Decision: record with `--effects http`, `--effect-env POSTHOG_HOST=http-url`, `--db-reset`/`--db-dump`
via the `sqlite3` CLI on a temp file. Record all three response shapes the parser defends against
(flat `results`, nested `{results:{results}}`, non-array), a 401, and a garbage body — the sink
answers what a case declares, so the "server said 401" path is a recorded case, not a mock in Rust.

Consequences: the recorded cases pin the outbound request (method, URL path, two headers, body
shape) and the `.dump` of `beacon_events`; anything the sink answers deterministically stays out of
the port's logic.

## ADR-007: Files live under `monitoring/exporter/rust/`

Status: accepted (2026-11-22)

Context: the analyze root is the exporter package, but the git repository root is the Astro site,
which is a different app with its own `rust/`-free layout and its own build.

Decision: `MAP.md`, `DECISIONS.md`, `GLOSSARY.md`, `HANDOFF.md`, `research/`, `app-cases/`, the unit
crates and `rust/app` all live in `monitoring/exporter/rust/`. Nothing is written at the portfolio
root. The original `src/`, `tests/`, `package.json`, `Dockerfile` stay untouched as reference.

Consequences: `rust-anything` must be invoked with `monitoring/exporter` as `<repo>`; the crates are
not members of any workspace outside this folder (an optional local workspace may be added later).

## ADR-008: Packaging — a new `Dockerfile.rust`, compose switched only after the lift

Status: accepted (2026-11-22)

Context: `docker-compose.yml` builds `./exporter`; `oven/bun:1.4-alpine` is the current base.

Decision: add `monitoring/exporter/Dockerfile.rust` (multi-stage: `rust:1-slim` builder with a musl
target → `alpine` runtime carrying one static binary). Leave `Dockerfile` and `docker-compose.yml`
as they are until `replay` on the pure binary reports 100%, then switch the compose `build` stanza
in one commit the user approves.

Consequences: both images can be built side by side during the port; the cutover is a one-line
compose change with a one-line revert.

## ADR-009: Checkpoints — four stops, waves from the plan

Status: accepted (2026-11-22)

Context: the plan orders the units in three waves (0: `config`, `metrics`, `db`; 1: `beacon`,
`posthog-pull`; 2–3: `app`, `index`).

Decision: stop and report after wave 0, after wave 1, after the wiring of `app`+`index`, and once
more before the lift. Each stop reports `replay` (passed/total, fallback rate), `gate` per crate,
and `diff`/`bench` for every unit ported in that wave.

Consequences: the user can stop the port at any wave with a working app; `HANDOFF.md` is refreshed
at each stop.

## ADR-010: Keep the original and its tests until the user says otherwise

Status: accepted (2026-11-22)

Context: `whole-app.md` §7 requires the original as reference after the lift; the 24 bun tests are
the only existing description of the behaviour.

Decision: never edit `src/**` or `tests/**` of the original, and do not delete them at the lift.
The Rust build is proved by `app replay`, not by rewriting the bun tests.

Consequences: two implementations coexist; the README stays valid for the bun path until cutover,
and the Rust path gets its own short section at cutover.

## ADR-011: The sink (`src/db.ts`) and the routes (`src/app.ts`, `src/index.ts`) are hand-written in `rust/app`

Status: accepted (2026-11-22)

Context: `bridge` refuses `src/db.ts` — every export is JS-shaped (`openBeaconStore` returns an
object with `append`/`close` members), and `src/app.ts`/`src/index.ts` export a handler closure and
a server entry point, not data functions. `analyze` marks them `caution` for the same reason.

Decision: three pieces are written directly in the app instead of as bridged unit crates:

* `rust/app/src/store.rs` — the sink (rusqlite), a literal translation of the schema, the insert
  and the `JSON.stringify` payload;
* `rust/app/src/units/mod.rs` + `shared.rs` — the router, the three CORS headers, `OPTIONS`, the
  404, and the two method rules the original has and axum does not (`HEAD /metrics` → 404,
  `POST /metrics` → 404);
* `rust/app/src/main.rs` — settings, port, the poller loop and the first pull.

Consequences: their proof is `app replay` (46 cases, including the byte-for-byte `.dump` of
`beacon_events`), not `diff`. `rust-anything map` lists them as "not ported"; `MAP.md` says why.
The first attempt put the sink in `beacon-rs` and it broke that crate's wasm build (bundled SQLite
cannot compile for `wasm32-unknown-unknown`) — hence the separate file.

## ADR-012: One shared `jsnum` crate for JavaScript number and JSON semantics

Status: accepted (2026-11-22)

Context: a recorded case proved three divergences that are silent in Rust: `9007199254740993`
kept 17 digits where JS rounds it at 2^53, `1.0` printed as `1.0` where JS prints `1`, `-0` printed
as `-0.0` where JS prints `0`, and `0.000001` printed as `1e-6` where JS prints `0.000001`. The
same rules drive `Number(env.BEACON_PORT)` and the `/metrics` value column.

Decision: `rust/jsnum` owns `number_to_string` (ECMAScript Number::toString), `from_string`/
`from_value` (ToNumber), `truthy`, `stringify` (JSON.stringify, including the integer-key-first
order) and `as_js_numbers` (every number a double after parse). Every unit depends on it instead of
carrying a copy.

Consequences: payload bytes and exposition values match Bun exactly (proven by the `22-beacon-
number-formats` case); the crate has no bindings and is never ported back.

## ADR-013: The build must be started with the original's environment

Status: accepted (2026-11-22)

Context: the recorded cases came from a process with `START_POLLER=1`, `BEACON_DB=…`,
`POSTHOG_HOST=<sink>`. Those env vars are part of the recorded `run` command, so `app replay`
applies them to the original — but `--build` starts the Rust binary with `PORT` only, and the
documented defaults (no poller, no sink) then answer different bytes.

Decision: replay the Rust build behind the same `sh -c` wrapper the original uses:

```sh
rust-anything app replay . --build 'sh -c "START_POLLER=1 POSTHOG_PULL_INTERVAL=3600 \
  BEACON_DB=$PWD/rust/.tmp/beacon.sqlite BEACON_PORT=$PORT exec ./rust/app/target/release/index"'
```

The app itself keeps the documented defaults (ADR-004) — the wrapper is a test harness, not a
product default.

Consequences: `rust-anything app lift .` refuses, because it replays `cargo run` with no
environment and all 46 cases then differ. The lift's remaining jobs (drop the fallback, flatten the
crates, add an in-crate replay test) are listed in `HANDOFF.md` and are mechanical; the fallback
rate is already 0 and every unit passes `gate`.

## ADR-014: One alpine image, built on the target platform

Status: accepted (2026-11-22)

Context: the first `Dockerfile.rust` cross-compiled `x86_64-unknown-linux-musl` from an arm64
builder and aws-lc-sys (rustls' provider) failed with `unrecognized command-line option '-m64'` —
`musl-gcc` on arm64 cannot emit x86-64.

Decision: the build stage runs on `$TARGETPLATFORM` on `rust:1.99-alpine`, with `musl-dev gcc make
cmake perl linux-headers`; the runtime stage is `alpine:3.21` plus one static binary. amd64 is
produced with `docker buildx build --platform linux/amd64`.

Consequences: native builds are one command; a foreign-arch build needs buildx emulation (slow,
correct). Measured: image 29.2 MB (8.73 MB compressed) against the Bun image's 174 MB (58.2 MB).
