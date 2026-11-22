//! JS bindings for `src/metrics.ts`: generated from the signatures in `port.rs` by rust-anything.
//! Regenerate with `rust-anything refresh` after changing them.

use wasm_bindgen::prelude::*;

pub mod port;

/// `resetAll`.
fn reset_all_inner() -> Result<(), String> {
    port::reset_all()?;
    Ok(())
}

#[wasm_bindgen(js_name = "resetAll")]
pub fn reset_all() -> Result<(), JsError> {
    reset_all_inner().map_err(|e| JsError::new(&e))
}

/// `escapeLabel`.
fn escape_label_inner(v: String) -> Result<String, String> {
    let out = port::escape_label(v)?;
    Ok(out)
}

#[wasm_bindgen(js_name = "escapeLabel")]
pub fn escape_label(v: String) -> Result<String, JsError> {
    escape_label_inner(v).map_err(|e| JsError::new(&e))
}

/// `render`.
fn render_inner() -> Result<String, String> {
    let out = port::render()?;
    Ok(out)
}

#[wasm_bindgen(js_name = "render")]
pub fn render() -> Result<String, JsError> {
    render_inner().map_err(|e| JsError::new(&e))
}
