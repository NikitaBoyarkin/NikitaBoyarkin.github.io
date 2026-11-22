//! JavaScript number semantics, shared by the ported units.
//!
//! Two rules of the language reach the exporter's observable output, and Rust's own conversions
//! answer differently for both:
//!
//! * `String(number)` (a template literal, the `/metrics` exposition line): exponent form above
//!   1e21 and below 1e-6, and `-0` prints as `0`.
//! * `Number(value)` (`Number(env.BEACON_PORT)`): trims Unicode whitespace, accepts `0x`/`0o`/`0b`
//!   and a bare `Infinity`, and rejects `inf`, `NaN`, `1_000` and anything with trailing text.
//!
//! Sources: ECMAScript §7.1.4 (ToNumber), §7.1.4.1 (StringToNumber / StringNumericLiteral) and
//! §6.1.6.1.20 (Number::toString).

#![forbid(unsafe_code)]

use serde_json::Value;

/// JavaScript's `Number::toString` — what `String(value)` and a template literal produce.
pub fn number_to_string(v: f64) -> String {
    if v.is_nan() {
        return "NaN".to_string();
    }
    if v.is_infinite() {
        return if v > 0.0 { "Infinity" } else { "-Infinity" }.to_string();
    }
    if v == 0.0 {
        // Both `0` and `-0`: `String(-0)` is `"0"`.
        return "0".to_string();
    }
    // `{:e}` gives the shortest round-tripping digits, the same sequence ECMAScript asks for;
    // only the layout of those digits differs between the two languages.
    let scientific = format!("{:e}", v.abs());
    let Some((mantissa, exponent)) = scientific.split_once('e') else {
        return scientific;
    };
    let exponent: i32 = exponent.parse().unwrap_or(0);
    let digits: String = mantissa.chars().filter(|c| *c != '.').collect();
    let (k, n) = (digits.len() as i32, exponent + 1);
    let mut out = String::new();
    if k <= n && n <= 21 {
        out.push_str(&digits);
        out.extend(std::iter::repeat_n('0', (n - k) as usize));
    } else if 0 < n && n <= 21 {
        out.push_str(&format!(
            "{}.{}",
            &digits[..n as usize],
            &digits[n as usize..]
        ));
    } else if -6 < n && n <= 0 {
        out.push_str("0.");
        out.extend(std::iter::repeat_n('0', (-n) as usize));
        out.push_str(&digits);
    } else {
        out.push_str(&digits[..1]);
        if k > 1 {
            out.push('.');
            out.push_str(&digits[1..]);
        }
        out.push('e');
        out.push(if n > 0 { '+' } else { '-' });
        out.push_str(&(n - 1).abs().to_string());
    }
    if v < 0.0 { format!("-{}", out) } else { out }
}

/// JavaScript `Number("…")`: `StringNumericLiteral` — trimmed, no `inf`/`nan` spellings, and the
/// `0x`/`0o`/`0b` prefixes.
pub fn from_string(s: &str) -> f64 {
    let t = s.trim_matches(|c: char| c.is_whitespace() || c == '\u{feff}');
    if t.is_empty() {
        return 0.0;
    }
    for (prefix, radix) in [
        ("0x", 16),
        ("0X", 16),
        ("0o", 8),
        ("0O", 8),
        ("0b", 2),
        ("0B", 2),
    ] {
        if let Some(rest) = t.strip_prefix(prefix) {
            return u128::from_str_radix(rest, radix).map_or(f64::NAN, |n| n as f64);
        }
    }
    match t {
        "Infinity" | "+Infinity" => return f64::INFINITY,
        "-Infinity" => return f64::NEG_INFINITY,
        _ => {}
    }
    if !is_decimal_literal(t) {
        return f64::NAN;
    }
    t.parse::<f64>().unwrap_or(f64::NAN)
}

/// `[+-]?(digits[.digits?] | .digits)([eE][+-]?digits)?`, which is what JavaScript accepts.
fn is_decimal_literal(t: &str) -> bool {
    let bytes = t.as_bytes();
    let mut i = 0;
    if matches!(bytes.first(), Some(b'+' | b'-')) {
        i += 1;
    }
    let int_start = i;
    while i < bytes.len() && bytes[i].is_ascii_digit() {
        i += 1;
    }
    let int_digits = i - int_start;
    let mut frac_digits = 0;
    if i < bytes.len() && bytes[i] == b'.' {
        i += 1;
        let frac_start = i;
        while i < bytes.len() && bytes[i].is_ascii_digit() {
            i += 1;
        }
        frac_digits = i - frac_start;
    }
    if int_digits == 0 && frac_digits == 0 {
        return false;
    }
    if i < bytes.len() && (bytes[i] == b'e' || bytes[i] == b'E') {
        i += 1;
        if i < bytes.len() && (bytes[i] == b'+' || bytes[i] == b'-') {
            i += 1;
        }
        let exp_start = i;
        while i < bytes.len() && bytes[i].is_ascii_digit() {
            i += 1;
        }
        if i == exp_start {
            return false;
        }
    }
    i == bytes.len()
}

/// JavaScript truthiness: what decides `if (event.session_id)` and `if (!path) continue`.
pub fn truthy(v: &Value) -> bool {
    match v {
        Value::Null => false,
        Value::Bool(b) => *b,
        Value::Number(n) => n.as_f64().is_some_and(|x| x != 0.0 && !x.is_nan()),
        Value::String(s) => !s.is_empty(),
        Value::Array(_) => true,
        // The bindings carry `undefined` as a marker, and `undefined` is falsy.
        Value::Object(o) => !o.get("$undefined").is_some_and(Value::is_boolean),
    }
}

/// JavaScript `Number(value)` for a value that arrived as JSON.
pub fn from_value(v: &Value) -> f64 {
    match v {
        Value::Number(n) => n.as_f64().unwrap_or(f64::NAN),
        Value::Bool(b) => {
            if *b {
                1.0
            } else {
                0.0
            }
        }
        Value::Null => 0.0,
        Value::String(s) => from_string(s),
        Value::Array(_) => from_string(&to_string(v)),
        Value::Object(_) => f64::NAN,
    }
}

/// JavaScript `String(value)` for the values an env object can hold (arrays join with commas,
/// `null` elements becoming empty).
pub fn to_string(v: &Value) -> String {
    match v {
        Value::Null => "null".to_string(),
        Value::Bool(true) => "true".to_string(),
        Value::Bool(false) => "false".to_string(),
        Value::String(s) => s.clone(),
        Value::Number(n) => number_to_string(n.as_f64().unwrap_or(f64::NAN)),
        Value::Array(items) => items
            .iter()
            .map(|x| {
                if x.is_null() {
                    String::new()
                } else {
                    to_string(x)
                }
            })
            .collect::<Vec<_>>()
            .join(","),
        Value::Object(_) => "[object Object]".to_string(),
    }
}

/// `JSON.stringify(value)`: the bytes the original stores in its payload column.
///
/// Two JavaScript habits are not serde_json's: numbers print through `Number::toString`, and a
/// key that is an array index (`"0"` … `"4294967294"`) moves to the front, ascending, before the
/// rest keep their insertion order.
pub fn stringify(value: &Value) -> String {
    match value {
        Value::Null => "null".to_string(),
        Value::Bool(b) => b.to_string(),
        Value::Number(n) => match n.as_f64().filter(|x| x.is_finite()) {
            Some(x) => number_to_string(x),
            // `JSON.stringify(NaN)` and of an infinity is `null`.
            None => "null".to_string(),
        },
        Value::String(s) => serde_json::to_string(s).unwrap_or_else(|_| "\"\"".to_string()),
        Value::Array(items) => {
            let parts: Vec<String> = items.iter().map(stringify).collect();
            format!("[{}]", parts.join(","))
        }
        Value::Object(entries) => {
            let mut indexes: Vec<(u64, &String)> = Vec::new();
            let mut rest: Vec<&String> = Vec::new();
            for key in entries.keys() {
                match array_index(key) {
                    Some(n) => indexes.push((n, key)),
                    None => rest.push(key),
                }
            }
            indexes.sort_by_key(|(n, _)| *n);
            let ordered = indexes.into_iter().map(|(_, key)| key).chain(rest);
            let parts: Vec<String> = ordered
                .map(|key| {
                    let name = serde_json::to_string(key).unwrap_or_else(|_| "\"\"".to_string());
                    let value = entries
                        .get(key)
                        .map(stringify)
                        .unwrap_or_else(|| "null".to_string());
                    format!("{name}:{value}")
                })
                .collect();
            format!("{{{}}}", parts.join(","))
        }
    }
}

/// Whether a key is an array index, as `JSON.stringify` orders them: the canonical decimal form of
/// an integer below 2^32-1.
fn array_index(key: &str) -> Option<u64> {
    if key.is_empty() || key.len() > 10 || !key.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    if key.len() > 1 && key.starts_with('0') {
        return None;
    }
    let n: u64 = key.parse().ok()?;
    (n < 4_294_967_295).then_some(n)
}

/// Every number in the tree as a double, which is what JavaScript holds after `JSON.parse`:
/// `9007199254740993` becomes `9007199254740992` and `1.0` prints as `1`.
pub fn as_js_numbers(value: Value) -> Value {
    match value {
        Value::Number(n) => match n.as_f64() {
            Some(x) if x.is_finite() => match serde_json::Number::from_f64(x) {
                Some(number) => Value::Number(number),
                None => Value::Null,
            },
            _ => Value::Null,
        },
        Value::Array(items) => Value::Array(items.into_iter().map(as_js_numbers).collect()),
        Value::Object(entries) => Value::Object(
            entries
                .into_iter()
                .map(|(k, v)| (k, as_js_numbers(v)))
                .collect(),
        ),
        other => other,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn number_to_string_follows_javascript() {
        for (value, text) in [
            (1.0, "1"),
            (0.5, "0.5"),
            (0.001, "0.001"),
            (1e-7, "1e-7"),
            (1e21, "1e+21"),
            (1.2345678901234567e19, "12345678901234567000"),
            (-0.0, "0"),
            (-2.5, "-2.5"),
        ] {
            assert_eq!(number_to_string(value), text);
        }
    }

    #[test]
    fn from_string_follows_javascript() {
        for (text, want) in [
            ("30", 30.0),
            ("", 0.0),
            (" 12 ", 12.0),
            ("0x10", 16.0),
            ("0o10", 8.0),
            ("0b101", 5.0),
            ("1e3", 1000.0),
            (".5", 0.5),
            ("1.", 1.0),
            ("-5.5", -5.5),
            ("Infinity", f64::INFINITY),
            ("-Infinity", f64::NEG_INFINITY),
        ] {
            assert_eq!(from_string(text), want, "for {text:?}");
        }
        for bad in ["abc", "12abc", "inf", "NaN", "1_000", "1e", "0x", " 1 2 "] {
            assert!(from_string(bad).is_nan(), "for {bad:?}");
        }
    }

    #[test]
    fn truthiness_is_javascript() {
        for falsy in [
            json!(null),
            json!(false),
            json!(0),
            json!(""),
            json!({"$undefined": true}),
        ] {
            assert!(!truthy(&falsy), "for {falsy}");
        }
        for truthy_value in [json!(1), json!("x"), json!([]), json!({}), json!(-0.0)] {
            let expect_falsy = truthy_value == json!(-0.0);
            assert_eq!(truthy(&truthy_value), !expect_falsy, "for {truthy_value}");
        }
        assert!(!truthy(&json!(-0.0)));
    }

    #[test]
    fn from_value_follows_to_number() {
        assert_eq!(from_value(&json!(7)), 7.0);
        assert_eq!(from_value(&json!(true)), 1.0);
        assert_eq!(from_value(&Value::Null), 0.0);
        assert_eq!(from_value(&json!([30])), 30.0);
        assert_eq!(from_value(&json!([])), 0.0);
        assert!(from_value(&json!([1, 2])).is_nan());
        assert!(from_value(&json!({})).is_nan());
    }
}
