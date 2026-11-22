//! The Rust port of `src/beacon.ts`.
//!
//! Two functions the HTTP handler calls for every beacon: `parse_beacon` turns the body into a
//! list of events (one object or an array), `ingest_event` folds one event into the metric
//! families it belongs to. Both keep the original's coercions — `String(path ?? "/")`, a JS
//! truthiness test for `session_id`, `typeof error === "object" && error !== null` — because the
//! labels they produce are the exposition text a Prometheus scrape reads.

#![forbid(unsafe_code)]

use serde_json::Value;

/// `String(value)` with the original's `??` fallbacks: `null` and a missing key take the default,
/// a `{"$undefined": true}` marker does too.
fn text_or(value: Option<&Value>, default: &str) -> String {
    match value {
        None | Some(Value::Null) => default.to_string(),
        Some(v) if crate::js::is_undefined(v) => default.to_string(),
        Some(v) => jsnum::to_string(v),
    }
}

/// Port of `parseBeacon` (`src/beacon.ts:3`).
pub fn parse_beacon(body: Value) -> Result<Vec<Value>, String> {
    let text = match &body {
        Value::String(s) => s.clone(),
        // `new TextDecoder().decode(...)`: the bridge hands an ArrayBuffer over as its bytes.
        other => String::from_utf8_lossy(&bytes_of(other)).into_owned(),
    };
    let parsed: Value = serde_json::from_str(&text).map_err(|e| syntax_error(&text, &e))?;
    Ok(events_of(parsed))
}

/// `JSON.parse` leaves every number a double; the payload column and the labels read them that way.
fn events_of(parsed: Value) -> Vec<Value> {
    match parsed {
        Value::Array(items) => items.into_iter().map(jsnum::as_js_numbers).collect(),
        single => vec![jsnum::as_js_numbers(single)],
    }
}

/// The body as the HTTP layer hands it over: bytes decoded with `TextDecoder` (lossy, like the
/// original's non-string branch), then parsed.
pub fn parse_beacon_bytes(bytes: &[u8]) -> Result<Vec<Value>, String> {
    let text = String::from_utf8_lossy(bytes).into_owned();
    let parsed: Value = serde_json::from_str(&text).map_err(|e| syntax_error(&text, &e))?;
    Ok(events_of(parsed))
}

fn bytes_of(value: &Value) -> Vec<u8> {
    let bytes = match value {
        Value::Array(items) => items,
        Value::Object(o) => match o.get("$bytes").and_then(Value::as_array) {
            Some(items) => items,
            None => return Vec::new(),
        },
        _ => return Vec::new(),
    };
    bytes
        .iter()
        .filter_map(|b| b.as_u64().and_then(|b| u8::try_from(b).ok()))
        .collect()
}

/// The message `JSON.parse` throws, which the handler never shows (it answers 400) but `diff`
/// compares against the recorded cases.
fn syntax_error(text: &str, error: &serde_json::Error) -> String {
    let at = error.column();
    let trimmed = text.trim_start();
    if trimmed.is_empty() {
        return "Unexpected end of JSON input".to_string();
    }
    let snippet: String = text.chars().take(20).collect();
    match text.chars().nth(at.saturating_sub(1)) {
        Some(c) => format!("Unexpected token '{c}', \"{snippet}\" is not valid JSON"),
        None => "Unexpected end of JSON input".to_string(),
    }
}

/// Port of `ingestEvent` (`src/beacon.ts:10`).
pub fn ingest_event(event: Value) -> Result<(), String> {
    let Some(object) = event.as_object() else {
        // `event.type` on `null` is the original's TypeError; on a primitive it reads `undefined`.
        return match event {
            Value::Null => Err("Cannot read properties of null (reading 'type')".to_string()),
            Value::String(_) | Value::Number(_) | Value::Bool(_) | Value::Array(_) => {
                metrics_rs::port::inc(&metrics_rs::port::BEACON_FAILURES, &reason("bad_shape"));
                Ok(())
            }
            Value::Object(_) => Ok(()),
        };
    };
    let etype = object.get("type");
    let path = text_or(object.get("path"), "/");
    let locale = text_or(object.get("locale"), "unknown");
    match etype.and_then(Value::as_str) {
        Some("pageview") => {
            metrics_rs::port::inc(
                &metrics_rs::port::PAGEVIEWS,
                &metrics_rs::port::labels([("path", &path), ("locale", &locale)]),
            );
            if object.get("session_id").is_some_and(jsnum::truthy) {
                metrics_rs::port::inc(&metrics_rs::port::SESSIONS, &metrics_rs::port::labels([]));
            }
            Ok(())
        }
        Some("error") => {
            let error_type = match object.get("error") {
                Some(Value::Object(e)) => text_or(e.get("type"), "unknown"),
                Some(Value::Array(_)) => "unknown".to_string(),
                _ => "unknown".to_string(),
            };
            metrics_rs::port::inc(
                &metrics_rs::port::JS_ERRORS,
                &metrics_rs::port::labels([("path", &path), ("type", &error_type)]),
            );
            Ok(())
        }
        _ => {
            metrics_rs::port::inc(&metrics_rs::port::BEACON_FAILURES, &reason("bad_shape"));
            Ok(())
        }
    }
}

fn reason(value: &str) -> metrics_rs::port::LabelValues {
    metrics_rs::port::labels([("reason", value)])
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn a_body_becomes_one_event_or_many() {
        assert_eq!(
            parse_beacon(json!("{\"type\":\"pageview\"}")).unwrap_or_default(),
            vec![json!({"type": "pageview"})]
        );
        assert_eq!(parse_beacon(json!("[{},{}]")).map(|v| v.len()), Ok(2));
        assert_eq!(
            parse_beacon(json!("null")).unwrap_or_default(),
            vec![Value::Null]
        );
        assert!(parse_beacon(json!("")).is_err());
        assert!(parse_beacon(json!("not json")).is_err());
        assert_eq!(parse_beacon(json!([123, 125])).map(|v| v.len()), Ok(1));
    }

    #[test]
    fn ingest_follows_the_original_coercions() {
        metrics_rs::port::reset_all().unwrap_or_default();
        ingest_event(json!({"type": "pageview", "path": "/", "locale": "ru", "session_id": ""}))
            .unwrap_or_default();
        assert_eq!(
            metrics_rs::port::get(&metrics_rs::port::SESSIONS, &metrics_rs::port::labels([])),
            None
        );
        ingest_event(json!({"type": "pageview", "path": 42, "session_id": 0})).unwrap_or_default();
        assert_eq!(
            metrics_rs::port::get(&metrics_rs::port::SESSIONS, &metrics_rs::port::labels([])),
            None
        );
        ingest_event(json!({"type": "pageview", "session_id": []})).unwrap_or_default();
        assert_eq!(
            metrics_rs::port::get(&metrics_rs::port::SESSIONS, &metrics_rs::port::labels([])),
            Some(1.0)
        );
        assert!(ingest_event(Value::Null).is_err());
        assert!(ingest_event(json!({"type": "click"})).is_ok());
        assert!(ingest_event(json!({"type": "error", "error": {"type": "TypeError"}})).is_ok());
        metrics_rs::port::reset_all().unwrap_or_default();
    }
}
