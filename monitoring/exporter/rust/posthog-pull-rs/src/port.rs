//! The Rust port of `src/posthog-pull.ts`.
//!
//! One pull: build the HogQL request, send it, read the p75 web vitals out of whatever envelope
//! PostHog answered with, and set four gauges. Every failure path — DNS, TLS, timeout, a non-2xx
//! status, a body that is not JSON — ends in the same place the original's single `catch` does:
//! the `portfolio_posthog_pull_errors_total` counter. Nothing is rethrown.
//!
//! The network calls are blocking (`reqwest::blocking`) on purpose: the crate carries no runtime,
//! so the exported `async fn`s answer an already-finished future, and the Rust app calls the same
//! blocking function from a worker thread. `AbortSignal.timeout(10_000)` becomes a 10 s client
//! timeout, which — unlike a connect timeout — covers the whole exchange up to the last body byte.

#![forbid(unsafe_code)]

use std::time::{Duration, Instant};

use metrics_rs::port as metrics;
use serde_json::{Map, Value, json};

const VITALS_QUERY: &str = r#"
SELECT
  properties.$pathname AS path,
  quantile(0.75)(properties.$web_vitals_LCP_value / 1000.0) AS lcp,
  quantile(0.75)(properties.$web_vitals_INP_value / 1000.0) AS inp,
  quantile(0.75)(properties.$web_vitals_CLS_value) AS cls,
  quantile(0.75)(properties.$web_vitals_FCP_value / 1000.0) AS fcp
FROM events
WHERE event = '$web_vitals'
  AND timestamp > now() - INTERVAL {window:raw}
GROUP BY path
"#;

const TIMEOUT: Duration = Duration::from_secs(10);

/// Port of `queryPayload` (`src/posthog-pull.ts:32`).
pub fn query_payload(window: String) -> Result<Value, String> {
    Ok(json!({
        "query": { "kind": "HogQLQuery", "query": VITALS_QUERY, "values": { "window": window } }
    }))
}

/// A settings field as a template literal reads it: a missing key is the string `undefined`.
fn setting<'a>(settings: &'a Value, key: &str) -> &'a str {
    settings
        .get(key)
        .and_then(Value::as_str)
        .unwrap_or("undefined")
}

/// The one authenticated POST; blocking, so the caller decides which thread it runs on.
pub fn post_to_posthog_blocking(settings: &Value) -> Result<Value, String> {
    let url = format!(
        "{}/api/projects/{}/query",
        setting(settings, "posthogHost"),
        setting(settings, "posthogProjectId")
    );
    // The two messages `fetch` raises in the original; they never reach a caller (the poller
    // swallows them) but the recorded cases compare them.
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err(format!("Failed to parse URL from {url}"));
    }
    let client = reqwest::blocking::Client::builder()
        .timeout(TIMEOUT)
        .build()
        .map_err(|e| e.to_string())?;
    let response = client
        .post(url)
        .header(
            "Authorization",
            format!("Bearer {}", setting(settings, "posthogApiKey")),
        )
        .header("content-type", "application/json")
        .body(
            query_payload(setting(settings, "posthogPullWindow").to_string())
                .map(|body| body.to_string())
                .unwrap_or_default(),
        )
        .send()
        .map_err(|_| "fetch failed".to_string())?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!("PostHog query failed: {}", status.as_u16()));
    }
    response
        .json::<Value>()
        .map_err(|_| "fetch failed".to_string())
}

/// Port of `postToPosthog` (`src/posthog-pull.ts:42`).
pub async fn post_to_posthog(settings: Value) -> Result<Value, String> {
    post_to_posthog_blocking(&settings)
}

/// One row's four vitals, in the original's field order.
fn row_vitals(
    lcp: Option<&Value>,
    inp: Option<&Value>,
    cls: Option<&Value>,
    fcp: Option<&Value>,
) -> Value {
    let mut out = Map::new();
    for (key, value) in [("lcp", lcp), ("inp", inp), ("cls", cls), ("fcp", fcp)] {
        // `row[1]` on a short row is `undefined`, not `null`: the key exists and holds
        // `undefined`, which the bindings carry as a marker.
        let value = value.filter(|v| !crate::js::is_undefined(v));
        out.insert(
            key.to_string(),
            value.cloned().unwrap_or_else(crate::js::undefined),
        );
    }
    Value::Object(out)
}

/// Port of `parseVitals` (`src/posthog-pull.ts:64`).
pub fn parse_vitals(resp: Value) -> Result<Value, String> {
    let mut results = resp.get("results").cloned().unwrap_or(Value::Null);
    if matches!(results, Value::Object(_)) {
        results = results.get("results").cloned().unwrap_or(Value::Null);
    }
    let Value::Array(rows) = results else {
        return Ok(json!({}));
    };
    let mut out = Map::new();
    for row in rows {
        let (path, vitals) = match &row {
            Value::Array(cells) => (
                cells.first().cloned().unwrap_or(Value::Null),
                row_vitals(cells.get(1), cells.get(2), cells.get(3), cells.get(4)),
            ),
            Value::Object(o) => (
                o.get("path").cloned().unwrap_or_else(crate::js::undefined),
                row_vitals(o.get("lcp"), o.get("inp"), o.get("cls"), o.get("fcp")),
            ),
            // `null.path` is the original's TypeError; a primitive reads `undefined` instead.
            Value::Null => {
                return Err("Cannot read properties of null (reading 'path')".to_string());
            }
            _ => (crate::js::undefined(), Value::Null),
        };
        if !jsnum::truthy(&path) {
            continue;
        }
        out.insert(jsnum::to_string(&path), vitals);
    }
    Ok(Value::Object(out))
}

/// Port of `updateGauges` (`src/posthog-pull.ts:99`).
pub fn update_gauges(vitals: Value) -> Result<(), String> {
    let Some(entries) = vitals.as_object() else {
        return Ok(());
    };
    for (path, row) in entries {
        let labels = metrics::labels([("path", path.as_str())]);
        for (family, key) in [
            (&metrics::LCP, "lcp"),
            (&metrics::INP, "inp"),
            (&metrics::CLS, "cls"),
            (&metrics::FCP, "fcp"),
        ] {
            // `v.lcp != null` is the loose check: `null` and a missing key are skipped, `0` is not.
            if let Some(value) = row
                .get(key)
                .filter(|v| !v.is_null() && !crate::js::is_undefined(v))
            {
                metrics::set(family, jsnum::from_value(value), &labels);
            }
        }
    }
    Ok(())
}

/// `pullOnce` for a caller that already owns a blocking thread.
pub fn pull_once_blocking(settings: &Value) -> Result<(), String> {
    let start = Instant::now();
    match post_to_posthog_blocking(settings) {
        Ok(resp) => {
            if let Ok(vitals) = parse_vitals(resp) {
                update_gauges(vitals)?;
            }
        }
        Err(_) => metrics::inc(&metrics::POSTHOG_PULL_ERRORS, &metrics::labels([])),
    }
    metrics::set(
        &metrics::POSTHOG_PULL_DURATION,
        start.elapsed().as_secs_f64(),
        &metrics::labels([]),
    );
    Ok(())
}

/// Port of `pullOnce` (`src/posthog-pull.ts:108`). The exported shape: no runtime needed, the
/// future is ready when it is polled.
pub async fn pull_once(settings: Value) -> Result<(), String> {
    pull_once_blocking(&settings)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn body(window: &str) -> String {
        query_payload(window.to_string())
            .map(|v| v.to_string())
            .unwrap_or_default()
    }

    #[test]
    fn the_query_is_the_original_one() {
        assert_eq!(
            body("30m"),
            r#"{"query":{"kind":"HogQLQuery","query":"\nSELECT\n  properties.$pathname AS path,\n  quantile(0.75)(properties.$web_vitals_LCP_value / 1000.0) AS lcp,\n  quantile(0.75)(properties.$web_vitals_INP_value / 1000.0) AS inp,\n  quantile(0.75)(properties.$web_vitals_CLS_value) AS cls,\n  quantile(0.75)(properties.$web_vitals_FCP_value / 1000.0) AS fcp\nFROM events\nWHERE event = '$web_vitals'\n  AND timestamp > now() - INTERVAL {window:raw}\nGROUP BY path\n","values":{"window":"30m"}}}"#
        );
    }

    #[test]
    fn vitals_are_read_from_every_envelope_shape() {
        let flat = json!({"results": [["/", 1.5, 0.2, 0.05, 1.1]]});
        assert_eq!(
            parse_vitals(flat).unwrap_or_default()["/"],
            json!({"lcp": 1.5, "inp": 0.2, "cls": 0.05, "fcp": 1.1})
        );
        let nested = json!({"results": {"results": [{"path": "/a", "lcp": 2}]}});
        assert_eq!(
            parse_vitals(nested).unwrap_or_default()["/a"]["lcp"],
            json!(2)
        );
        assert_eq!(
            parse_vitals(json!({"results": "nope"})).unwrap_or_default(),
            json!({})
        );
        assert_eq!(parse_vitals(json!({})).unwrap_or_default(), json!({}));
        // A falsy path is skipped; the object key is the JS string of the row's first cell.
        let skipped = json!({"results": [["", 1], [0, 2], ["/b", 3]]});
        assert_eq!(
            parse_vitals(skipped)
                .unwrap_or_default()
                .as_object()
                .map(Map::len),
            Some(1)
        );
    }

    #[test]
    fn gauges_skip_null_but_keep_zero() {
        metrics::reset_all().unwrap_or_default();
        update_gauges(json!({"/": {"lcp": 0, "inp": null, "cls": "0.5"}})).unwrap_or_default();
        let labels = metrics::labels([("path", "/")]);
        assert_eq!(metrics::get(&metrics::LCP, &labels), Some(0.0));
        assert_eq!(metrics::get(&metrics::INP, &labels), None);
        assert_eq!(metrics::get(&metrics::CLS, &labels), Some(0.5));
        metrics::reset_all().unwrap_or_default();
    }
}
