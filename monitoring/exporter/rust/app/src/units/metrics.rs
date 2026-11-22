//! Glue from the front door to `metrics-rs`: `GET /metrics` answers the exposition text.

use axum::body::Body;
use axum::extract::Request;
use axum::http::{HeaderValue, StatusCode, header};
use axum::response::{IntoResponse, Response};

use crate::units::shared;

pub async fn handle(_req: Request) -> Response {
    let body = metrics_rs::port::render().unwrap_or_default();
    shared::cors(
        (
            StatusCode::OK,
            [(
                header::CONTENT_TYPE,
                HeaderValue::from_static("text/plain; version=0.0.4; charset=utf-8"),
            )],
            Body::from(body),
        )
            .into_response(),
    )
}
