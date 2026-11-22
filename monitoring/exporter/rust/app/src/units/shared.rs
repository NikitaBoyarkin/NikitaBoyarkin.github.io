//! Response helpers every route shares: the CORS headers the original adds to every answer, the
//! 204 for `OPTIONS`, and the 404 for anything unrouted.

use axum::body::Body;
use axum::http::{HeaderValue, Method, StatusCode, header};
use axum::response::{IntoResponse, Response};

use crate::state;

/// `cors(res)`: the three headers, with the configured origin.
pub fn cors(mut response: Response) -> Response {
    let headers = response.headers_mut();
    let origin = HeaderValue::from_str(&state::settings().site_origin)
        .unwrap_or_else(|_| HeaderValue::from_static("*"));
    headers.insert(header::ACCESS_CONTROL_ALLOW_ORIGIN, origin);
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_METHODS,
        HeaderValue::from_static("POST, OPTIONS"),
    );
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_HEADERS,
        HeaderValue::from_static("*"),
    );
    response
}

/// `OPTIONS` anywhere: 204 with no body.
pub async fn preflight() -> Response {
    cors((StatusCode::NO_CONTENT, Body::empty()).into_response())
}

/// The original's catch-all answer: status 404, body `Not found`, body type `octet-stream`.
pub async fn not_found() -> Response {
    cors(
        (
            StatusCode::NOT_FOUND,
            [(
                header::CONTENT_TYPE,
                HeaderValue::from_static("application/octet-stream"),
            )],
            Body::from("Not found"),
        )
            .into_response(),
    )
}

/// `Response.json({ ok: true })`, which Bun stamps as `application/json;charset=utf-8`.
pub async fn healthz() -> Response {
    cors(
        (
            StatusCode::OK,
            [(
                header::CONTENT_TYPE,
                HeaderValue::from_static("application/json;charset=utf-8"),
            )],
            Body::from("{\"ok\":true}"),
        )
            .into_response(),
    )
}

/// Whether the request is a preflight, which the router answers before any route.
pub fn is_preflight(method: &Method) -> bool {
    *method == Method::OPTIONS
}
