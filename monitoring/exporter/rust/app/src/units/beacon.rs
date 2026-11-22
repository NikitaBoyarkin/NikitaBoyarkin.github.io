//! Glue from the front door to `beacon-rs`: `POST /beacon` parses the body, folds every event
//! into the counters, appends to the optional sink, and answers 204 or 400.

use std::time::{SystemTime, UNIX_EPOCH};

use axum::body::Body;
use axum::extract::Request;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};

use beacon_rs::port as beacon;
use metrics_rs::port as metrics;

use crate::state;
use crate::units::shared;

pub async fn handle(req: Request) -> Response {
    let body = match axum::body::to_bytes(req.into_body(), usize::MAX).await {
        Ok(bytes) => bytes,
        Err(_) => return bad_request(),
    };
    let events = match beacon::parse_beacon_bytes(&body) {
        Ok(events) => events,
        Err(_) => {
            metrics::inc(
                &metrics::BEACON_FAILURES,
                &metrics::labels([("reason", "parse")]),
            );
            return bad_request();
        }
    };
    for event in &events {
        // `ingestEvent` throws on `null`, which the original's single `catch` turns into a 400.
        if beacon::ingest_event(event.clone()).is_err() {
            metrics::inc(
                &metrics::BEACON_FAILURES,
                &metrics::labels([("reason", "parse")]),
            );
            return bad_request();
        }
        if let Some(store) = state::store() {
            let ts = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_millis() as i64)
                .unwrap_or_default();
            let guard = store.lock().unwrap_or_else(|e| e.into_inner());
            if let Err(error) = guard.append(event, ts) {
                eprintln!("beacon store: {error}");
            }
        }
    }
    shared::cors((StatusCode::NO_CONTENT, Body::empty()).into_response())
}

fn bad_request() -> Response {
    shared::cors((StatusCode::BAD_REQUEST, Body::empty()).into_response())
}
