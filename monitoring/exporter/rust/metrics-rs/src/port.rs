//! The Rust port of `src/metrics.ts`.
//!
//! The original keeps one module-level `Metric` per family and mutates it in place; this port
//! keeps the same state in a process-wide `Mutex<IndexMap<..>>` so `render()` answers without a
//! handle. Sample order is insertion order, because that order reaches the exposition text and
//! Prometheus clients read it.
//!
//! Numbers print through `jsnum::number_to_string`: the exposition text is compared byte-for-byte
//! with the Bun build, and JavaScript's `String(number)` disagrees with Rust's `Display` on
//! exponent form, small magnitudes and `-0`.

#![forbid(unsafe_code)]

use std::sync::{Mutex, MutexGuard, OnceLock};

use indexmap::IndexMap;

/// `MetricType`: `"counter"` or `"gauge"`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MetricType {
    Counter,
    Gauge,
}

impl MetricType {
    fn as_str(self) -> &'static str {
        match self {
            MetricType::Counter => "counter",
            MetricType::Gauge => "gauge",
        }
    }
}

/// `Family`: name, help, type and label names of one metric.
#[derive(Debug)]
pub struct Family {
    pub name: &'static str,
    pub help: &'static str,
    pub type_: MetricType,
    pub label_names: &'static [&'static str],
}

/// `Sample`: one set of label values and its value.
#[derive(Debug, Clone, PartialEq)]
pub struct Sample {
    pub labels: LabelValues,
    pub value: f64,
}

/// `LabelValues`: `Record<string, string>`, insertion-ordered like a JS object.
pub type LabelValues = IndexMap<String, String>;

/// `labels({path: "/", locale: "ru"})`: build label values in the order given.
pub fn labels<const N: usize>(pairs: [(&str, &str); N]) -> LabelValues {
    pairs
        .iter()
        .map(|(k, v)| (k.to_string(), v.to_string()))
        .collect()
}

/// One `Metric`: a family plus its samples, keyed as the original keys them
/// (`labelNames.map(n => "n=value").join("\u{0}")`).
#[derive(Debug)]
pub struct Metric {
    pub family: &'static Family,
    samples: IndexMap<String, Sample>,
}

impl Metric {
    fn new(family: &'static Family) -> Self {
        Metric {
            family,
            samples: IndexMap::new(),
        }
    }

    /// `key(labels)`: `n1=v1\u{0}n2=v2`, a missing label contributing an empty value.
    fn key(&self, values: &LabelValues) -> String {
        self.family
            .label_names
            .iter()
            .map(|n| format!("{}={}", n, values.get(*n).map(String::as_str).unwrap_or("")))
            .collect::<Vec<_>>()
            .join("\u{0}")
    }

    /// `inc`: add `n` (default 1) to the sample `values` selects.
    pub fn inc(&mut self, values: &LabelValues, n: f64) {
        let sample = self
            .samples
            .entry(self.key(values))
            .or_insert_with(|| Sample {
                labels: values.clone(),
                value: 0.0,
            });
        sample.value += n;
    }

    /// `set`: replace the sample's value, creating it when absent.
    pub fn set(&mut self, value: f64, values: &LabelValues) {
        self.samples.insert(
            self.key(values),
            Sample {
                labels: values.clone(),
                value,
            },
        );
    }

    /// `get`: the sample's value, `None` where the original is `undefined`.
    pub fn get(&self, values: &LabelValues) -> Option<f64> {
        self.samples.get(&self.key(values)).map(|s| s.value)
    }

    /// `clear`.
    pub fn clear(&mut self) {
        self.samples.clear();
    }

    /// `snapshot`: the samples in insertion order.
    pub fn snapshot(&self) -> Vec<Sample> {
        self.samples.values().cloned().collect()
    }
}

macro_rules! families {
    ($($ident:ident = $name:literal, $help:literal, $kind:ident, [$($label:literal),*];)*) => {
        $(pub const $ident: Family =
            Family { name: $name, help: $help, type_: MetricType::$kind, label_names: &[$($label),*] };)*
        /// `FAMILIES`: every family, in the order `render` writes them.
        pub const FAMILIES: &[&Family] = &[$(&$ident),*];
    };
}

families! {
    PAGEVIEWS = "portfolio_pageviews_total", "Total pageviews", Counter, ["path", "locale"];
    SESSIONS = "portfolio_sessions_total", "Total sessions", Counter, [];
    ACTIVE_SESSIONS = "portfolio_active_sessions", "Active sessions", Gauge, [];
    JS_ERRORS = "portfolio_js_errors_total", "JS errors", Counter, ["path", "type"];
    BEACON_FAILURES = "portfolio_beacon_failures_total", "Beacon ingestion failures", Counter, ["reason"];
    LCP = "portfolio_lcp_seconds", "LCP p75 (seconds)", Gauge, ["path"];
    INP = "portfolio_inp_seconds", "INP p75 (seconds)", Gauge, ["path"];
    CLS = "portfolio_cls", "CLS p75", Gauge, ["path"];
    FCP = "portfolio_fcp_seconds", "FCP p75 (seconds)", Gauge, ["path"];
    POSTHOG_PAGEVIEWS_30D = "portfolio_posthog_pageviews_30d", "PostHog pageviews last 30d", Gauge, [];
    POSTHOG_PULL_ERRORS = "portfolio_posthog_pull_errors_total", "PostHog pull errors", Counter, [];
    POSTHOG_PULL_DURATION = "portfolio_posthog_pull_duration_seconds", "PostHog pull duration (s)", Gauge, [];
    EXPORTER_UP = "portfolio_exporter_up", "Exporter up", Gauge, [];
}

fn registry() -> &'static Mutex<IndexMap<&'static str, Metric>> {
    static REGISTRY: OnceLock<Mutex<IndexMap<&'static str, Metric>>> = OnceLock::new();
    REGISTRY.get_or_init(|| Mutex::new(IndexMap::new()))
}

/// The registry, locked. A poisoned lock means a previous holder panicked; the original has no
/// equivalent state, so it is a bug in the port, never a request outcome.
fn guard() -> MutexGuard<'static, IndexMap<&'static str, Metric>> {
    // INFALLIBLE: every mutation under this lock is a plain map update that cannot panic, so a
    // poisoned lock cannot arise from valid input.
    registry().lock().unwrap_or_else(|e| e.into_inner())
}

fn with_metric<R>(family: &'static Family, f: impl FnOnce(&mut Metric) -> R) -> R {
    f(guard()
        .entry(family.name)
        .or_insert_with(|| Metric::new(family)))
}

/// `pageviews.inc({path, locale})`.
pub fn inc(family: &'static Family, values: &LabelValues) {
    inc_by(family, values, 1.0);
}

/// `sessions.inc(3)`.
pub fn inc_by(family: &'static Family, values: &LabelValues, n: f64) {
    with_metric(family, |m| m.inc(values, n));
}

/// `lcp.set(1.25, {path})`.
pub fn set(family: &'static Family, value: f64, values: &LabelValues) {
    with_metric(family, |m| m.set(value, values));
}

/// `pageviews.get({path, locale})`.
pub fn get(family: &'static Family, values: &LabelValues) -> Option<f64> {
    with_metric(family, |m| m.get(values))
}

/// `snapshot` of one family.
pub fn snapshot(family: &'static Family) -> Vec<Sample> {
    with_metric(family, |m| m.snapshot())
}

/// Port of `resetAll` (`src/metrics.ts:112`).
pub fn reset_all() -> Result<(), String> {
    for m in guard().values_mut() {
        m.clear();
    }
    Ok(())
}

/// Port of `escapeLabel` (`src/metrics.ts:116`).
pub fn escape_label(v: String) -> Result<String, String> {
    Ok(escape_label_str(&v))
}

fn escape_label_str(v: &str) -> String {
    let mut out = String::with_capacity(v.len());
    for c in v.chars() {
        match c {
            '\\' => out.push_str("\\\\"),
            '"' => out.push_str("\\\""),
            '\n' => out.push_str("\\n"),
            other => out.push(other),
        }
    }
    out
}

/// Port of `render` (`src/metrics.ts:120`).
pub fn render() -> Result<String, String> {
    let state = guard();
    let mut lines: Vec<String> = Vec::new();
    for family in FAMILIES {
        lines.push(format!("# HELP {} {}", family.name, family.help));
        lines.push(format!("# TYPE {} {}", family.name, family.type_.as_str()));
        let Some(metric) = state.get(family.name) else {
            continue;
        };
        for sample in metric.snapshot() {
            let labels: Vec<String> = family
                .label_names
                .iter()
                .map(|n| {
                    format!(
                        "{}=\"{}\"",
                        n,
                        escape_label_str(sample.labels.get(*n).map(String::as_str).unwrap_or(""))
                    )
                })
                .collect();
            let suffix = if labels.is_empty() {
                String::new()
            } else {
                format!("{{{}}}", labels.join(","))
            };
            lines.push(format!(
                "{}{} {}",
                family.name,
                suffix,
                jsnum::number_to_string(sample.value)
            ));
        }
    }
    Ok(lines.join("\n") + "\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    /// One test at a time touches the process-wide registry.
    static TEST_LOCK: Mutex<()> = Mutex::new(());

    fn exclusive() -> MutexGuard<'static, ()> {
        // INFALLIBLE: a panicking test only poisons this test-only lock.
        TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner())
    }

    #[test]
    fn escape_label_matches_the_original() {
        assert_eq!(escape_label_str("a\"b\\c\nd"), "a\\\"b\\\\c\\nd");
        assert_eq!(escape_label_str("таб\tраздел"), "таб\tраздел");
    }

    #[test]
    fn inc_get_set_follow_insertion_order() {
        let _g = exclusive();
        reset_all().unwrap_or_default();
        let ru = labels([("path", "/"), ("locale", "ru")]);
        inc(&PAGEVIEWS, &ru);
        inc(&PAGEVIEWS, &ru);
        inc(&PAGEVIEWS, &labels([("path", "/a"), ("locale", "en")]));
        assert_eq!(get(&PAGEVIEWS, &ru), Some(2.0));
        assert_eq!(get(&PAGEVIEWS, &labels([("path", "/")])), None);
        set(&LCP, 1.25, &labels([("path", "/")]));
        let out = render().unwrap_or_default();
        assert!(out.contains(
            "portfolio_pageviews_total{path=\"/\",locale=\"ru\"} 2\nportfolio_pageviews_total{path=\"/a\",locale=\"en\"} 1\n"
        ));
        assert!(out.contains("portfolio_lcp_seconds{path=\"/\"} 1.25\n"));
        assert!(out.starts_with("# HELP portfolio_pageviews_total Total pageviews\n# TYPE portfolio_pageviews_total counter\n"));
        assert!(out.ends_with(
            "# HELP portfolio_exporter_up Exporter up\n# TYPE portfolio_exporter_up gauge\n"
        ));
        reset_all().unwrap_or_default();
    }

    #[test]
    fn a_missing_label_renders_empty_like_the_original() {
        let _g = exclusive();
        reset_all().unwrap_or_default();
        inc(&PAGEVIEWS, &labels([("path", "/x")]));
        assert!(
            render()
                .unwrap_or_default()
                .contains("portfolio_pageviews_total{path=\"/x\",locale=\"\"} 1\n")
        );
        reset_all().unwrap_or_default();
    }
}
