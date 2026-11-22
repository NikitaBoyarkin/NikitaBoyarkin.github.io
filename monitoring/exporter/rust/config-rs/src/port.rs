//! The Rust port of `src/config.ts`.
//!
//! Two doors: `settings_from_env` is the typed path the Rust app uses (every value is a string),
//! and `get_settings` reproduces the recorded behaviour for an arbitrary JS object, where `??`
//! keeps a non-string value as it is and `Number()` runs over whatever it found. With no argument
//! the original reads `Bun.env`; there is no Bun here, so that call answers the error it throws.

#![forbid(unsafe_code)]

use std::collections::BTreeMap;

use serde_json::{Map, Value};

const HOST_DEFAULT: &str = "https://us.posthog.com";
const INTERVAL_DEFAULT: &str = "15";
const WINDOW_DEFAULT: &str = "30m";
const PORT_DEFAULT: &str = "9100";

/// `Settings`: the nine env-derived settings.
#[derive(Debug, Clone, PartialEq)]
pub struct Settings {
    pub posthog_api_key: String,
    pub posthog_project_id: String,
    pub posthog_host: String,
    pub posthog_pull_interval: f64,
    pub posthog_pull_window: String,
    pub site_origin: String,
    pub beacon_port: f64,
    pub beacon_db_path: String,
    pub start_poller: bool,
}

/// The typed settings the Rust app uses, built from a real process environment.
pub fn settings_from_env(env: &BTreeMap<String, String>) -> Settings {
    let text =
        |key: &str, default: &str| env.get(key).cloned().unwrap_or_else(|| default.to_string());
    Settings {
        posthog_api_key: text("POSTHOG_API_KEY", ""),
        posthog_project_id: text("POSTHOG_PROJECT_ID", ""),
        posthog_host: text("POSTHOG_HOST", HOST_DEFAULT),
        posthog_pull_interval: jsnum::from_string(&text("POSTHOG_PULL_INTERVAL", INTERVAL_DEFAULT)),
        posthog_pull_window: text("POSTHOG_PULL_WINDOW", WINDOW_DEFAULT),
        site_origin: text("SITE_ORIGIN", "*"),
        beacon_port: jsnum::from_string(&text("BEACON_PORT", PORT_DEFAULT)),
        beacon_db_path: text("BEACON_DB", ""),
        start_poller: env.get("START_POLLER").map(String::as_str) == Some("1"),
    }
}

/// `env.KEY ?? "default"`: only `null` and `undefined` fall through, and the value is not coerced.
fn or_default(env: &Map<String, Value>, key: &str, default: &'static str) -> Value {
    let undefined = |v: &Value| {
        v.as_object()
            .is_some_and(|o| o.get("$undefined") == Some(&Value::Bool(true)))
    };
    match env.get(key) {
        Some(v) if !v.is_null() && !undefined(v) => v.clone(),
        _ => Value::String(default.to_string()),
    }
}

/// The object the original returns, built from the raw env values.
fn settings_value(env: &Map<String, Value>) -> Value {
    let text = |key: &str, default: &'static str| or_default(env, key, default);
    let num = |key: &str, default: &'static str| {
        crate::js::number(jsnum::from_value(&or_default(env, key, default)))
    };
    [
        ("posthogApiKey", text("POSTHOG_API_KEY", "")),
        ("posthogProjectId", text("POSTHOG_PROJECT_ID", "")),
        ("posthogHost", text("POSTHOG_HOST", HOST_DEFAULT)),
        (
            "posthogPullInterval",
            num("POSTHOG_PULL_INTERVAL", INTERVAL_DEFAULT),
        ),
        (
            "posthogPullWindow",
            text("POSTHOG_PULL_WINDOW", WINDOW_DEFAULT),
        ),
        ("siteOrigin", text("SITE_ORIGIN", "*")),
        ("beaconPort", num("BEACON_PORT", PORT_DEFAULT)),
        ("beaconDbPath", text("BEACON_DB", "")),
        (
            "startPoller",
            Value::Bool(
                env.get("START_POLLER")
                    .is_some_and(|v| v.as_str() == Some("1")),
            ),
        ),
    ]
    .into_iter()
    .map(|(key, value)| (key.to_string(), value))
    .collect::<Map<_, _>>()
    .into()
}

/// Port of `getSettings` (`src/config.ts:13`).
pub fn get_settings(env: Option<Value>) -> Result<Value, String> {
    let map = match env {
        Some(Value::Null) => {
            return Err("Cannot read properties of null (reading 'POSTHOG_API_KEY')".to_string());
        }
        // A primitive env boxes to an object with no own properties, so every setting defaults.
        Some(Value::Object(o)) if o.get("$undefined").is_none() => o,
        Some(Value::Object(_)) | None => return Err("Bun is not defined".to_string()),
        Some(_) => Map::new(),
    };
    Ok(settings_value(&map))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn strings(pairs: &[(&str, &str)]) -> BTreeMap<String, String> {
        pairs
            .iter()
            .map(|(k, v)| ((*k).to_string(), (*v).to_string()))
            .collect()
    }

    #[test]
    fn both_doors_answer_like_the_original() {
        let s = settings_from_env(&strings(&[("BEACON_PORT", "0x10"), ("START_POLLER", "1")]));
        assert_eq!(
            (s.beacon_port, s.start_poller, s.posthog_host.as_str()),
            (16.0, true, HOST_DEFAULT)
        );
        assert!(!settings_from_env(&strings(&[("START_POLLER", "01")])).start_poller);
        let raw: Map<String, Value> = [("SITE_ORIGIN".to_string(), json!(42.5))]
            .into_iter()
            .collect();
        let out = settings_value(&raw);
        assert_eq!(
            (out.get("siteOrigin"), out.get("posthogHost")),
            (Some(&json!(42.5)), Some(&json!(HOST_DEFAULT)))
        );
        assert!(get_settings(Some(Value::Null)).is_err() && get_settings(None).is_err());
    }
}
