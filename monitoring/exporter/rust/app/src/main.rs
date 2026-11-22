//! The Rust front door: it owns the port, reads the settings, starts the optional PostHog poller
//! and answers every route from the ported units. The original is still started beside it — the
//! kill switches (`RUST_ANYTHING_UNIT_<NAME>=original`) and any route added later hand work back
//! to it until the lift removes both.

mod state;
mod store;
mod units;

use std::net::SocketAddr;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use axum::serve::ListenerExt;
use metrics_rs::port as metrics;
use posthog_pull_rs::port as posthog;

/// `settings.beaconPort`, falling back to `PORT` so replay can hand the build a free port.
fn listen_port() -> u16 {
    let beacon = state::settings().beacon_port;
    if beacon.is_finite()
        && (1.0..=65535.0).contains(&beacon)
        && std::env::var_os("BEACON_PORT").is_some()
    {
        return beacon as u16;
    }
    std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(9100)
}

/// `startPoller`: one pull now, then one every `posthogPullInterval` seconds.
async fn start_poller() {
    metrics::set(&metrics::EXPORTER_UP, 1.0, &metrics::labels([]));
    // `setTimeout(tick, 0)`: the first pull happens before the server answers anything. It blocks,
    // so it runs on a worker thread of its own.
    let first = posthog_settings();
    let _ = tokio::task::spawn_blocking(move || posthog::pull_once_blocking(&first)).await;
    let running = Arc::new(AtomicBool::new(false));
    tokio::task::spawn_blocking(move || {
        let settings = state::settings();
        let interval = Duration::from_secs_f64(if settings.posthog_pull_interval > 0.0 {
            settings.posthog_pull_interval
        } else {
            15.0
        });
        let payload = posthog_settings();
        loop {
            std::thread::sleep(interval);
            if !running.swap(true, Ordering::SeqCst) {
                let _ = posthog::pull_once_blocking(&payload);
                running.store(false, Ordering::SeqCst);
            }
        }
    });
}

/// The settings object `pullOnce` expects, keyed like the original's.
fn posthog_settings() -> serde_json::Value {
    let settings = state::settings();
    serde_json::json!({
        "posthogApiKey": settings.posthog_api_key,
        "posthogProjectId": settings.posthog_project_id,
        "posthogHost": settings.posthog_host,
        "posthogPullWindow": settings.posthog_pull_window,
    })
}

/// `SIGTERM`/`Ctrl-C`: stop accepting, finish in-flight requests, exit cleanly.
async fn shutdown_signal() {
    let ctrl_c = async {
        let _ = tokio::signal::ctrl_c().await;
    };
    let terminate = async {
        match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(mut signal) => {
                signal.recv().await;
            }
            Err(_) => std::future::pending::<()>().await,
        }
    };
    tokio::select! {
        () = ctrl_c => {},
        () = terminate => {},
    }
}

/// Tells `rust-anything app replay` this build counts its fallbacks, even when it makes none.
fn report_fallbacks() {
    if let Some(path) = std::env::var_os("RUST_ANYTHING_FALLBACK_LOG") {
        let _ = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(path);
    }
}

#[tokio::main]
async fn main() {
    report_fallbacks();
    // `index.ts` opens the sink before it starts serving, so the table exists even before the
    // first event arrives.
    let _ = state::store();
    let port = listen_port();
    let app = units::router();
    let listener = tokio::net::TcpListener::bind(SocketAddr::from(([0, 0, 0, 0], port)))
        .await
        .expect("binding the port");
    let listener = listener.tap_io(|tcp| {
        let _ = tcp.set_nodelay(true);
    });
    if state::settings().start_poller {
        start_poller().await;
    }
    println!("red-exporter (rust) listening on :{port}");
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .expect("serving");
}
