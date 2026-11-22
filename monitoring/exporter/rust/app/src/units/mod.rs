//! The front door's router. Scaffolded by `rust-anything app wire`, then taken over: every route
//! is answered in Rust, and the two places the original differs from axum's defaults (405 for a
//! known path with the wrong method, 200 for `HEAD /metrics`) are pinned to the recorded behaviour.

use axum::Router;
use axum::extract::Request;
use axum::middleware::{self, Next};
use axum::response::Response;
use axum::routing::{MethodFilter, get, on};

mod beacon;
mod metrics;
mod shared;

pub fn router() -> Router {
    Router::new()
        .route("/healthz", get(shared::healthz))
        // Only `GET /metrics` exists: the original answers `HEAD` and `POST` on it with a 404.
        .route(
            "/metrics",
            on(MethodFilter::GET, route_metrics).fallback(shared::not_found),
        )
        .route(
            "/beacon",
            on(MethodFilter::POST, route_beacon).fallback(shared::not_found),
        )
        .fallback(shared::not_found)
        .layer(middleware::from_fn(cors_and_preflight))
}

/// Every answer carries the three CORS headers, and `OPTIONS` is answered before any route.
async fn cors_and_preflight(req: Request, next: Next) -> Response {
    if shared::is_preflight(req.method()) {
        return shared::preflight().await;
    }
    shared::cors(next.run(req).await)
}

async fn route_metrics(req: Request) -> Response {
    if req.method() != axum::http::Method::GET {
        return shared::not_found().await;
    }
    metrics::handle(req).await
}

async fn route_beacon(req: Request) -> Response {
    if req.method() != axum::http::Method::POST {
        return shared::not_found().await;
    }
    beacon::handle(req).await
}
