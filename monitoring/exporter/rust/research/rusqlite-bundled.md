# rusqlite + `bundled` as a drop-in for `bun:sqlite`

Port of the beacon exporter from Bun to Rust. Governing constraint: the written file must stay
byte-compatible with what `sqlite3 <db> .dump` prints today.

**Bottom line.** `rusqlite = { version = "0.43.0", features = ["bundled"] }` vendors SQLite 3.54.1
and compiles it with `cc`; no system `libsqlite3` involved. The format is the one every SQLite since
3.0.0 writes, so `.dump` is stable. `CREATE TABLE IF NOT EXISTS` on an existing file is a real no-op
leaving `sqlite_schema.sql` byte-identical. `Option<&str>` / `&str` / `i64` bind as NULL / TEXT /
INTEGER, no quoting surprises. `Connection` is `Send` but `!Sync` → exactly one owner. musl static
works, though the README never says so (issue #914 + the `cc` build). The hazards are outside
rusqlite: `.dump` is rendered by the *CLI*, and `sqlite_sequence` makes a reused file diverge.

## 1. Version and the self-contained feature set

- **rusqlite 0.43.0** (2026-11-15, MSRV 1.89.0, edition 2024) — <https://crates.io/crates/rusqlite>,
  <https://docs.rs/rusqlite/0.43.0/rusqlite/>. Only feature needed: `bundled`, i.e.
  `rusqlite = { version = "0.43.0", features = ["bundled"] }`. README: *"`bundled` causes us to
  automatically compile and link in an up to date version of SQLite for you. This avoids …
  depending on the version of SQLite on the users system"*. It implies `modern_sqlite`
  (`bundled = ["libsqlite3-sys?/bundled", "modern_sqlite"]`) and vendors SQLite 3.54.1, compiled by
  `cc` from source inside `libsqlite3-sys` (rusqlite 0.43.0 / libsqlite3-sys 0.40.0) —
  <https://github.com/rusqlite/rusqlite/blob/master/README.md>,
  <https://github.com/rusqlite/rusqlite/blob/master/Cargo.toml>
- Build host needs one thing: a working **C compiler** (`cc` shells out to it) — no `pkg-config`, no
  headers, no system sqlite. Flags: <https://github.com/rusqlite/rusqlite/blob/master/libsqlite3-sys/build.rs>.
  Avoid `session` and `buildtime_bindgen` (the latter needs libclang at build time).
- **musl:** the README says **nothing** about `cargo build --target x86_64-unknown-linux-musl`. What
  it establishes is that `bundled` removes the host-SQLite dependency — precisely the musl failure
  mode: <https://github.com/rusqlite/rusqlite/issues/914>. Cross-compiling *without* `bundled`
  segfaults on startup; the accepted workaround is `libsqlite3-sys = { features = ["bundled"] }`,
  maintainer thomcc: *"I think this comes from a dynamic/static C runtime mismatch"*. Cross-compiling
  means the C compiler must itself target musl (e.g. `musl-gcc`).

## 2. Same file format, same `.dump`?

- One format: *"This document describes and defines the on-disk database file format used by all
  releases of SQLite since version 3.0.0 (2004-06-18)"* — <https://sqlite.org/fileformat2.html>.
- Fresh-file defaults (measured on 3.51.0: `delete` / `2` / `4096`). `journal_mode` — *"The DELETE
  journaling mode is the default."*; `synchronous` — *"FULL is the default synchronous mode for a
  rollback journal"* (= 2); `page_size` — *"the default page size increased to 4096"* (since 3.12.0) —
  <https://sqlite.org/pragma.html#pragma_journal_mode>, <https://sqlite.org/pragma.html#pragma_synchronous>,
  <https://sqlite.org/pragma.html#pragma_page_size>.
- **None of the three appear in `.dump`**, which renders schema + rows only
  (<https://sqlite.org/cli.html#dump>), so they cannot produce a diff by themselves. `page_size`
  sits in the header; `journal_mode=WAL` adds `-wal`/`-shm` and flips a header bit.
- **Bun's default:** no journal-mode switch — WAL is opt-in, *"To enable WAL mode, run this pragma
  query at the beginning of your application: `PRAGMA journal_mode = WAL;`"*. Same page: macOS *"uses
  the system-provided SQLite, which Apple builds with persistent WAL enabled"*, Linux/Windows
  *"statically links its own SQLite build, which follows upstream defaults"*. Effective default is
  upstream `delete`; the macOS note only concerns sidecar survival after `close()` —
  <https://bun.com/docs/api/sqlite>.
- To match: **set nothing** — injecting `journal_mode`/`synchronous`/`page_size` adds pragmas Bun
  never ran. If Bun ever opts into WAL the mode is stored in the file and Rust inherits it; only then
  checkpoint before dumping.

## 3. `CREATE TABLE IF NOT EXISTS` on every start

- *"if the `IF NOT EXISTS` clause is specified as part of the CREATE TABLE statement and a table or
  view of the same name already exists, the CREATE TABLE command simply has no effect (and no error
  message is returned)"* — <https://sqlite.org/lang_createtable.html>
- `sqlite_schema.sql` = normalized original text: keywords uppercased, `TEMP` dropped, db-qualifier
  dropped, *leading* spaces removed, *spaces following the first two keywords* collapsed —
  <https://sqlite.org/fileformat2.html> (§2.6). Indentation after line 1 survives, so the multi-line
  DDL is dumped exactly as written.
- Measured (3.51.0): stored text begins `CREATE TABLE beacon_events (\n  id INTEGER PRIMARY KEY
  AUTOINCREMENT, …` — SQLite itself **strips** the `IF NOT EXISTS` clause, so tables created with and
  without it store the *same* string. Two DBs made either way had identical MD5; a second
  `IF NOT EXISTS` run changed neither `sql` nor `rootpage`. Invisible to `.dump`; see trap 2 for the
  flip side.

## 4. NULL vs TEXT, and `i64` as INTEGER

```rust
// ts: i64, type/path/locale/session_id: Option<&str>, payload: &str
conn.execute(INSERT_SQL, rusqlite::params![ts, r#type, path, locale, session_id, payload])?;
```

- `impl<T: ToSql> ToSql for Option<T>` → `None => Ok(ToSqlOutput::from(Null))` —
  <https://github.com/rusqlite/rusqlite/blob/master/src/types/to_sql.rs>. `None::<&str>` is SQL NULL;
  `.dump` prints bare `NULL`. `impl ToSql for str` is TEXT (`ValueRef::Text`), dumped as `'…'` with
  `''` escaping — <https://github.com/rusqlite/rusqlite/blob/master/src/types/value_ref.rs>.
- `to_sql_self!(i64)` → `ValueRef::Integer(i64)` → `sqlite3_bind_int64` → INTEGER storage class,
  dumped as an unquoted number. **`Date.now()` as `i64` is written as an integer, no quotes** —
  storage class is per value, not per declared column type (<https://sqlite.org/datatype3.html>).
- The TS `typeof e.type === "string" ? e.type : null` maps exactly to `Option<&str>`; don't use
  `String` + `""` for the missing case (that dumps `''`, not `NULL`).

## 5. Threading

- `Connection`: **`impl Send`, `impl !Sync`** —
  <https://docs.rs/rusqlite/latest/rusqlite/struct.Connection.html>. It opens with
  `SQLITE_OPEN_NO_MUTEX`: *"Disables the use of a per-connection mutex. Rusqlite enforces
  thread-safety at compile time, so additional locking is not needed and provides no benefit"*
  (same page, `open_with_flags`). The library is threadsafe — `build.rs` passes `-DSQLITE_THREADSAFE=1`
  (<https://github.com/rusqlite/rusqlite/blob/master/libsqlite3-sys/build.rs>) — and *"The default
  mode is serialized … If no `SQLITE_THREADSAFE` compile-time parameter is present, then serialized
  mode is used"* (<https://sqlite.org/threadsafe.html>). Serialized mode would tolerate sharing, but
  `!Sync` forbids it at compile time anyway.
- In tokio, for a single writer, in order of preference:
  1. `tokio::task::spawn_blocking(move || { … })` — the documented home for blocking calls
     (<https://docs.rs/tokio/latest/tokio/task/fn.spawn_blocking.html>); move an owned `Connection`
     in, or clone an `Arc<Mutex<Connection>>` and lock inside.
  2. A dedicated OS thread owning the `Connection`, fed by `tokio::sync::mpsc` — best for a hot
     insert path (no lock contention, easy batching). Or `Arc<std::sync::Mutex<Connection>>` around
     per-call `spawn_blocking`, simplest, but never hold the guard across `.await`.

## 6. musl + static, and size

- Works: `bundled` embeds and compiles SQLite, so the target needs no `libsqlite3`; the only extra
  requirement is a C compiler targeting musl (README bundled section, issue #914). The target is
  `+crt-static` by default, so no extra rustflags are required.
- **Binary size: unknown.** Neither README, CHANGELOG, nor the 0.43.0 release notes state a size. A
  third-party post reports ~16.8 MB before strip / ~6.5 MB after for a bundled musl binary — *not* a
  primary source (<https://stout.neullabs.com/articles/cross-compiling-rust-cli-macos-linux>), so
  unverified; measure your own build (`strip`, `panic = "abort"`, `lto`).

## 7. AUTOINCREMENT across runs

- With `INTEGER PRIMARY KEY AUTOINCREMENT` the high-water mark lives in `sqlite_sequence`: *"A row in
  the sqlite_sequence table … is created the first time the AUTOINCREMENT table is written and
  updated on any subsequent writes that increase the maximum rowid"*, and ids are *"guaranteed to
  have ROWIDs that have never been used before by the same table in the same database"* —
  <https://sqlite.org/autoinc.html>. Deletes do not reset it.
- `sqlite_sequence` is an ordinary table, so `.dump` emits it (measured, fresh file, one row):
  `INSERT INTO sqlite_sequence VALUES('beacon_events',1);`.
- Therefore **a reused file is not dump-equal to a fresh file**: ids keep climbing (2, 3, …) and the
  `sqlite_sequence` line changes every run, even after `DELETE FROM beacon_events`; a fresh file
  always starts at 1. If the CI diff must be deterministic, delete the DB before each run. Don't
  "fix" it by dropping `AUTOINCREMENT` — that changes the stored DDL text and thus the dump.

## Semantic traps

1. **`.dump` is the CLI's output, not the library's.** The `sqlite3` binary formats values with its
   own linked SQLite, so version skew changes text — 3.51.0 no longer emits the `DELETE FROM
   sqlite_sequence;` line older shells printed. Pin the CLI version; bundled 3.54.1 is irrelevant.
2. **`IF NOT EXISTS` hides DDL drift.** Being a no-op on an existing file, a changed `CREATE TABLE`
   in the Rust port never lands and the check passes against the *old* stored text. Validate DDL
   edits on a deleted DB.
3. **JSON payload bytes.** `JSON.stringify(e)` (compact, insertion order) vs `serde_json::to_string`
   (compact, struct field order): key-order or float-format drift is a row diff — ordered struct,
   and watch `1.0` vs `1`.
4. **Bun silently binds a missing parameter as NULL** (*"By default, `bun:sqlite` does not throw an
   error if a parameter is missing: it binds NULL"*; `strict: true` opts out —
   <https://bun.com/docs/api/sqlite>), whereas a wrong count in `params![]` is a hard error in
   rusqlite — port implicit-NULL call sites explicitly.
5. **Foreign keys are ON in the bundled build** (`build.rs` passes `-DSQLITE_DEFAULT_FOREIGN_KEYS=1`),
   unlike the system SQLite Bun uses. Inert for this schema; it will reject inserts Bun accepted once
   an FK appears. `.dump` always opens with `PRAGMA foreign_keys=OFF;`, so it cannot reveal this.
6. **`Connection::open` creates the file**, like Bun's `create: true` (which errors with `readonly` —
   <https://bun.com/docs/api/sqlite>); no `SQLITE_OPEN_READ_ONLY` on the writer path. And the
   `sqlite_sequence` row appears only after the first write, so "no events" and "one event" runs
   differ structurally, not just in values.
