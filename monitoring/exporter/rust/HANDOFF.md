# HANDOFF — red-exporter → pure Rust

For the next session. Read `MAP.md` (plan), then this file, then `DECISIONS.md`. Root for every
`rust-anything` call: `monitoring/exporter` (ADR-007).

## Where the port stands

* **Parity: 46/46 app cases, fallback rate 0%.** The pure Rust binary answers every recorded
  request, effect and `.dump` byte-for-byte. The one exception is the startup line, which now says
  `(rust)` (ADR-003).
* **Units:** all four bridgeable units pass `gate` and `diff`:

  | Crate | Cases | Size |
  | --- | ---: | --- |
  | `rust/metrics-rs` | 230/230 | 2.7x |
  | `rust/config-rs` | 229/229 | 4.9x |
  | `rust/beacon-rs` | 34/34 | 1.1x |
  | `rust/posthog-pull-rs` | 35/35 | 0.9x |

* `rust/jsnum` — shared JavaScript number/JSON semantics (ADR-012), no bindings.
* Hand-written in `rust/app`: `store.rs` (the sink), `units/mod.rs` + `units/shared.rs` (router,
  CORS, `OPTIONS`, 404), `main.rs` (settings, port, poller). Reason: ADR-011.
* `Dockerfile.rust` builds and runs (29.2 MB image, 8.73 MB compressed) — ADR-014.

## The exact commands

```sh
# replay the production-shaped build (ADR-013)
rust-anything app replay . --build 'sh -c "START_POLLER=1 POSTHOG_PULL_INTERVAL=3600 \
  BEACON_DB=$PWD/rust/.tmp/beacon.sqlite BEACON_PORT=$PORT exec ./rust/app/target/release/index"'

# one unit
rust-anything gate rust/metrics-rs && rust-anything diff rust/metrics-rs

# the measured state of the port
rust-anything map . --write        # rust/PORT_MAP.md

# the original, for reference
bun test && bun run src/index.ts
```

Build the app with `cargo build --release --manifest-path rust/app/Cargo.toml`.

## What is left

1. **`app lift` (blocked by ADR-013).** It replays `cargo run` with no environment, so all 46 cases
   differ. Either teach it the wrapper, or do the lift by hand: the fallback is already gone
   (`original.rs` deleted), the crates keep their bindings — harmless, they compile natively — and
   the missing piece is a CI replay test (`rust/app/tests/app_cases.rs`) that starts the binary with
   the same environment and runs `rust/app-cases`.
2. **Cutover** — `rust/cutover.sh` walks it: build the image, replay, switch `docker-compose.yml`,
   verify the scrape, roll back. Nothing has been switched; `Dockerfile` and `docker-compose.yml`
   are untouched.
3. **README** — add the Rust path (build, image, the one-command replay) once the cutover is
   approved. The Bun section stays valid until then.

## Known behaviour differences (all accepted, none recorded as a mismatch)

* Startup line: `red-exporter (bun)` → `red-exporter (rust)` (ADR-003).
* A JSON body containing a **lone surrogate escape** (`"\ud800"`) is a 400 here and a 200 in the
  original: Rust strings cannot hold it and `serde_json` rejects the escape.
* An unparsable `BEACON_PORT` (e.g. `abc`) makes Bun fail to listen; the Rust binary falls back to
  `PORT`, then 9100.
* `getSettings()` **with no argument** answers `Bun is not defined` — the recorded behaviour outside
  Bun. The app always passes the real environment, so this path is unreachable in production.
* HTTP header **names** are lower-case and `date` is added by hyper; values and bodies match. The
  recorded cases compare values.
* `portfolio_posthog_pull_duration_seconds` is a wall-clock value and is wildcarded in the
  recorded metrics bodies.
