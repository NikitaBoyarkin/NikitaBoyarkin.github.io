# serde_json vs JSON.stringify — byte-parity for stored event payloads

Port of the beacon exporter from Bun to Rust. Constraint: the SQLite `TEXT` column already holds
`JSON.stringify(event)` output for every historical row, so the Rust writer must emit the same bytes,
and `/metrics` must keep the same sample and label ordering.

**Bottom line.** Key order is a feature flag, escaping is already identical, and **all** remaining
divergence is numeric. `serde_json` prints floats with `zmij` (Rust conventions: `1.0`, `1e+16`,
`1e-6`, `-0.0`) and keeps integer literals as `u64`/`i64`; JS has one `f64` type and
`Number::toString` (fixed notation for −5 ≤ n ≤ 21, `e±` outside). Byte parity needs three changes:
`preserve_order`, coerce every parsed number to `f64`, and override `Formatter::write_f64` with an
ECMAScript-compliant formatter (`ryu-js`). With those three, a recorded probe reproduced Bun's output
byte for byte. Two traps survive and no formatter fixes them: JS re-sorts integer-like object keys,
and `serde_json` *errors* where JS silently yields `Infinity` → `null`.

Versions: `serde_json` 1.0.154 (2026-10-11) <https://docs.rs/serde_json/1.0.154/serde_json/>,
`indexmap` 2.14.2 <https://docs.rs/indexmap/2.14.2/indexmap/>, `ryu-js` 1.0.3
<https://docs.rs/ryu-js/1.0.3/ryu_js/>, `zmij` 1.0.23 <https://docs.rs/zmij/1.0.23/zmij/>.

## 1. `preserve_order`: what it changes

- `serde_json::Map` is a `BTreeMap` by default, an `IndexMap` under the feature: *"By default the map
  is backed by a `BTreeMap`. Enable the `preserve_order` feature of serde_json to use `IndexMap`
  instead"* — <https://github.com/serde-rs/json/blob/master/src/map.rs>. Feature definition and the
  round-trip promise: *"maintains insertion order. This allows data to be read into a Value and written
  back to a JSON string while preserving the order of map keys in the input"*; it pulls `indexmap`,
  `alloc`, `dep:foldhash` — <https://github.com/serde-rs/json/blob/master/Cargo.toml> (lines 62–65).
- **Correction to the premise:** current README has **no** "Preserve order of map keys" section; the
  feature lives only in `Cargo.toml` and the `Map` rustdoc —
  <https://github.com/serde-rs/json/blob/master/README.md>,
  <https://docs.rs/serde_json/1.0.154/serde_json/struct.Map.html>.
- `from_str` → `Value` → `to_string` preserves input order, nested objects included (recorded). Without
  the feature keys come out **sorted**, silently corrupting every payload; `Map::sort_keys` is the
  explicit opt-in for that (*"destroys the original source order or insertion order"*).

## 2. Numbers — where the bytes actually diverge

`serde_json` decimalises through `zmij`, not `ryu`: its `write_f64` is
`zmij::Buffer::new().format_finite(value)` — <https://github.com/serde-rs/json/blob/master/src/ser.rs>
(`write_f64`, ~line 1716), overridable via
<https://docs.rs/serde_json/1.0.154/serde_json/ser/trait.Formatter.html>. `zmij` is a Schubfach/yy
port of Victor Zverovich's C++ implementation — <https://docs.rs/zmij/1.0.23/zmij/>.

ECMAScript rule: `-0` → `"0"`; with `n,k,s` the shortest digit string where `F(s × 10^(n−k)) = x`,
**if `n` ∈ [−5, 21]** use fixed notation, else scientific `d.ddde±n` —
<https://tc39.es/ecma262/multipage/ecmascript-data-types-and-values.html#sec-numeric-types-number-tostring>.

Recorded side by side (`serde_json` 1.0.154 / `zmij` 1.0.23 vs Bun 1.4.2 / JavaScriptCore):

| value | `serde_json` | `JSON.stringify` |
|---|---|---|
| `1.0` | `1.0` | `1` |
| `-0.0` | `-0.0` | `0` |
| `1e-6` | `1e-6` | `0.000001` |
| `9007199254740992.0` | `9007199254740992.0` | `9007199254740992` |
| `u64 9007199254740993` | `9007199254740993` | `9007199254740992` |
| `u64::MAX` | `18446744073709551615` | `18446744073709552000` |

The integer rows are the real trap: `serde_json` keeps an integer literal as `u64`/`i64` and prints
exact digits (`parse_long_integer`, <https://github.com/serde-rs/json/blob/master/src/de.rs>), while JS
rounds at `2^53` — above that the two disagree *while both look like integers*. `1e999` is an error in
`serde_json` (`f64_from_parts` → `NumberOutOfRange` on an infinite result, same file) but `Infinity` →
`null` in JS (§5). Rust-side forms are pinned by the crate's own tests (`3.0` → `"3.0"`) —
<https://github.com/serde-rs/json/blob/master/tests/test.rs>.

## 3. String escaping — already identical

`QuoteJSONString` escapes `\b \t \n \f \r \" \\` (Table 78), then any code point `< 0x0020` **or a
lone surrogate** as `\uXXXX` (lowercase, 4 digits), everything else verbatim —
<https://tc39.es/ecma262/multipage/structured-data.html#sec-quotejsonstring>.

`serde_json` escapes exactly `0x00–0x1F` (same short forms), `"` and `\`, nothing else: `static
ESCAPE: [u8; 256]` has `QU` only at `0x22` and `BS` only at `0x5C`, hex from `b"0123456789abcdef"` —
<https://github.com/serde-rs/json/blob/master/src/ser.rs>. Recorded identical: `/`, `DEL` (`0x7F`),
`U+2028`, `U+2029` are **not** escaped; control chars are `\u0000`…`\u001f` lowercase; emoji pass
through (JS emits the UTF-16 pair, identical bytes once UTF-8 encoded). The sole escaping difference
is lone surrogates — unreachable in Rust (§4).

## 4. Lone surrogates

- `JSON.stringify` escapes them (`QuoteJSONString`, leading/trailing surrogate → `UnicodeEscape`), so
  `"\ud800"` stays `"\ud800"`; `JSON.parse` accepts them (any `\uXXXX` is grammatical; RFC 8259 notes
  *"unpredictable"* behaviour for unpaired surrogates but does not forbid them) —
  <https://tc39.es/ecma262/multipage/structured-data.html#sec-quotejsonstring>,
  <https://www.rfc-editor.org/rfc/rfc8259#section-8.2>.
- Rust `String` is UTF-8 by invariant, so an unpaired surrogate has no representation —
  <https://doc.rust-lang.org/std/string/struct.String.html>. So it *can* arrive as valid JSON on the
  wire, and it breaks the port: recorded, `from_str::<Value>(r#""\ud800""#)` →
  `Err("unexpected end of hex escape at line 1 column 8")`, while `"\ud83d\ude00"` parses to `😀`.
- Policy must be explicit (reject, or `from_utf8_lossy`-style replacement); both change bytes relative
  to existing rows. **Whether any stored row contains one needs a recorded query.**

## 5. Parse-side differences

- **Duplicate keys.** JS: *"lexically preceding values for the same key shall be overwritten"* —
  <https://tc39.es/ecma262/multipage/structured-data.html#sec-json.parse> (Note 2). `serde_json`:
  `visit_map` loops `values.insert(key, value)`, and `Map::insert` updates the value —
  <https://github.com/serde-rs/json/blob/master/src/value/de.rs>,
  <https://docs.rs/serde_json/1.0.154/serde_json/struct.Map.html>. Both last-wins; with
  `preserve_order` the survivor keeps the **first** slot (*"the key remains and retains in its place in
  the order"*) — <https://docs.rs/indexmap/2.14.2/indexmap/map/struct.IndexMap.html>. Recorded
  identical: `{"a":1,"b":2,"a":3}` → `{"a":3,"b":2}`.
- **`NaN` / `Infinity`.** Absent from the JSON grammar, both reject (recorded `SyntaxError` in Bun) —
  <https://www.rfc-editor.org/rfc/rfc8259#section-6>.
- **Big integers.** Rust: exact `u64`/`i64`, then `f64` fallback
  (`123456789012345678901234567890` → `1.2345678901234568e+29`); JS: always nearest `f64`, then
  JS-style printing (same mantissa here, different notation in general — §2).
- **`1.0e999`.** Rust `Err("number out of range")`; JS `Infinity`, and *"If value is a finite Number,
  return ToString(value). Return `"null`"* maps it to `null` —
  <https://tc39.es/ecma262/multipage/structured-data.html#sec-serializejsonproperty>. Recorded:
  `1e999` → `null`; `1e-999` → `0.0` (Rust) vs `0` (JS). Also `1E3`: Rust `1000.0`, JS `1000`.
- **Depth.** `serde_json` stops at 128 (`recursion limit exceeded`, recorded; only `unbounded_depth` +
  `disable_recursion_limit` lifts it); `JSON.parse` handled 10 000 nested arrays in Bun (recorded).

## 6. Prometheus label maps: `IndexMap`, not `HashMap`

```toml
indexmap = { version = "2.14.2", features = ["serde"] }
```
`serde` is a real feature (`default`, `serde`, `std`, `test_debug`) —
<https://crates.io/crates/indexmap/2.14.2>. Order and cost: *"a consistent order that is determined by
the sequence of insertion and removal calls… All iterators traverse the map in the order"*,
`insert`/`get` *"O(1) time (amortized average)"* —
<https://docs.rs/indexmap/2.14.2/indexmap/map/struct.IndexMap.html>. `HashMap` order is unspecified and
per-process randomized, so labels would reorder between scrapes. The exposition format only mandates
one group per metric family plus `le`/`quantile` *"in increasing numerical order"* —
<https://prometheus.io/docs/instrumenting/exposition_formats/> — so label-name order is free, but it
must match the TS renderer. Never `sort_keys`.

## 7. Recommendation table

| case | verdict |
|---|---|
| object key order | **identical** with `preserve_order` (without it `BTreeMap` sorts) — except integer-like keys (trap 1) |
| integer ≤ 2^53 | **identical** |
| integer > 2^53 | **differs** — Rust exact, JS rounds to nearest double |
| float with `.0` (`1.0`) | **differs** — Rust `1.0`, JS `1` |
| `-0` / `-0.0` | **differs** — Rust `-0.0`, JS `0` |
| `1e16`…`1e20` | **differs** — Rust `1e+16`, JS `10000000000000000` |
| `1e21`+ and `1e-7`+ | **identical** (`e+`/`e-`, unpadded) |
| `0.000001`…`0.1` | **differs** — Rust `1e-6`, JS `0.000001` |
| control chars, `"`, `\`, `/`, DEL, `U+2028/9`, emoji | **identical**, byte for byte |
| lone surrogate in input | **differs** — Rust parse error, JS stores `"\ud800"` |
| duplicate keys | **identical** — last wins, first position |
| `NaN` / `Infinity` literals | **identical** — both reject |
| `1e999` / `1e-999` | **differs** — Rust error / `0.0`, JS `null` / `0` |
| nesting > 128 | **differs** — Rust errors, JS parses |
| label order in `/metrics` | **identical** with `IndexMap` + same insertion sequence |

**The fix for every float row** (recorded byte-identical to Bun): `preserve_order` + coerce each
`Value::Number` via `as_f64()` + custom `Formatter` delegating `write_f64` to `ryu_js::Buffer`
(*"ECMAScript compliant pure Rust implementation of Ryū"* — <https://docs.rs/ryu-js/1.0.3/ryu_js/>),
rendering non-finite floats as `null`. Recorded agreement on
`{"b":1,"a":2.0,"big":9007199254740993,"f":1.0,"z":1e-7,"big2":123456789012345678901234567890,"neg":-0}`
→ `{"b":1,"a":2,"big":9007199254740992,"f":1,"z":1e-7,"big2":1.2345678901234568e+29,"neg":0}` both
sides. `zmij_ecma` 1.0.23 is an alternative (same upstream, ECMA output) —
<https://crates.io/crates/zmij_ecma>.

## Semantic traps

1. **JS re-sorts integer-like keys before `stringify`.** `OrdinaryOwnPropertyKeys` emits array-index
   keys ascending, then other strings in creation order —
   <https://tc39.es/ecma262/multipage/ordinary-and-exotic-objects-behaviours.html#sec-ordinaryownpropertykeys>.
   Recorded: `{"b":1,"2":2,"1":3,"10":4,"a":5}` → JS `{"1":3,"2":2,"10":4,"b":1,"a":5}`, Rust
   `{"b":1,"2":2,"1":3,"10":4,"a":5}`. Numeric property names (query params, numeric tag ids) never
   match without re-implementing that ordering; whether the schema has any **needs a recorded check**.
   Corollary: `preserve_order` preserves *text* order, so it coincides with JS only for non-numeric
   keys — §1 is not "order is solved".
2. **Coercing to `f64` is what reproduces *stored* bytes** — skipping it makes Rust "more correct" and
   therefore wrong.
3. **`serde_json` fails closed where JS failed open** (`1e999`, lone surrogates), and
   **`arbitrary_precision` is not a byte-preserving escape hatch** — it keeps digits but normalises
   spelling (`1E000` → `"1e+000"`, `1e999` → `"1e+999"`,
   <https://github.com/serde-rs/json/blob/master/tests/test.rs>) and drops the `f64` type.
4. **`/metrics` has ordering obligations of its own** (family grouping, `le`/`quantile` ascending) that
   no map choice gives you — <https://prometheus.io/docs/instrumenting/exposition_formats/>.

## Recorded evidence

Re-runnable probes: `serde_json` 1.0.154 + `indexmap` 2.14.2 + `ryu-js` 1.0.3 on rustc 1.99.1; JS side
Bun 1.4.2 (JavaScriptCore). Rust harness = `cargo` bins printing `serde_json::to_string` (plain and
with the custom `Formatter`) over a fixed case list; JS side = `bun -e 'JSON.stringify(JSON.parse(s))'`
over the same strings. Still open, **needs a recorded experiment**: payloads with integer-like keys,
lone surrogates or numbers > 2^53 (query the existing DB before choosing reject-vs-lossy); `zmij`
notation outside the sampled values; non-finite label values in the TS renderer.
