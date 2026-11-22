//! JS bindings for `src/config.ts`: generated from the signatures in `port.rs` by rust-anything.
//! Regenerate with `rust-anything refresh` after changing them.

use wasm_bindgen::prelude::*;

pub mod js;
pub mod port;
pub mod wire;

#[allow(unused_imports)]
use serde_json::Value;

/// `getSettings`.
fn get_settings_inner(env: String) -> Result<String, String> {
    let env = crate::js::from_json(&env)?;
    let out = port::get_settings(env)?;
    crate::js::to_json(&out)
}

#[wasm_bindgen(js_name = "getSettings")]
pub fn get_settings(env: String) -> Result<String, JsError> {
    get_settings_inner(env).map_err(|e| JsError::new(&e))
}

// ---- the binary wire ------------------------------------------------------------------------

thread_local! {
    static WIRE_IN: std::cell::RefCell<Vec<u8>> = const { std::cell::RefCell::new(Vec::new()) };
    static WIRE_OUT: std::cell::RefCell<Vec<u8>> = const { std::cell::RefCell::new(Vec::new()) };
}

/// This module's memory, where `index.cjs` reads and writes the wire buffers.
#[wasm_bindgen(js_name = "rustAnythingWireMemory")]
pub fn rust_anything_wire_memory() -> JsValue {
    wasm_bindgen::memory()
}

/// The address of an argument buffer of `len` bytes.
#[wasm_bindgen(js_name = "rustAnythingWireIn")]
pub fn rust_anything_wire_in(len: u32) -> u32 {
    WIRE_IN.with(|b| {
        let mut b = b.borrow_mut();
        b.resize(len as usize, 0);
        b.as_mut_ptr() as usize as u32
    })
}

/// The address of the last result.
#[wasm_bindgen(js_name = "rustAnythingWireOut")]
pub fn rust_anything_wire_out() -> u32 {
    WIRE_OUT.with(|b| b.borrow().as_ptr() as usize as u32)
}

/// Reads `len` argument bytes, runs `f`, and keeps its result for `rustAnythingWireOut`.
fn wire_io(
    len: u32,
    f: impl FnOnce(&mut wire::Reader, &mut wire::Writer) -> Result<(), String>,
) -> Result<u32, JsError> {
    let input = WIRE_IN.with(|b| std::mem::take(&mut *b.borrow_mut()));
    let mut w = wire::Writer::default();
    let result = f(
        &mut wire::Reader::new(&input[..(len as usize).min(input.len())]),
        &mut w,
    );
    WIRE_IN.with(|b| *b.borrow_mut() = input);
    match result {
        // A result of another shape than the TS type: JS runs the call through JSON.
        Err(e) if e.starts_with(wire::MISMATCH) => return Ok(u32::MAX),
        other => other.map_err(|e| JsError::new(&e))?,
    }
    let n = w.0.len();
    WIRE_OUT.with(|b| *b.borrow_mut() = w.0);
    Ok(u32::try_from(n).unwrap_or(u32::MAX))
}

static S_GET_SETTINGS_OUT: wire::Schema = wire::Schema::Obj(&[
    ("posthogApiKey", wire::Schema::Str16),
    ("posthogProjectId", wire::Schema::Str16),
    ("posthogHost", wire::Schema::Str16),
    ("posthogPullInterval", wire::Schema::Num),
    ("posthogPullWindow", wire::Schema::Str16),
    ("siteOrigin", wire::Schema::Str16),
    ("beaconPort", wire::Schema::Num),
    ("beaconDbPath", wire::Schema::Str16),
    ("startPoller", wire::Schema::Bool),
]);

/// `getSettings` over the binary wire.
#[wasm_bindgen(js_name = "getSettingsWire")]
pub fn get_settings_wire(len: u32) -> Result<u32, JsError> {
    wire_io(len, |r, w| {
        let env: Option<serde_json::Value> = wire::read_dyn_opt(r)?;
        let out = &port::get_settings(env)?;
        wire::write_value(w, out, &S_GET_SETTINGS_OUT)?;
        Ok(())
    })
}
