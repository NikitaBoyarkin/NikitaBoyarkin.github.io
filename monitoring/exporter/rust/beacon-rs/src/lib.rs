//! JS bindings for `src/beacon.ts`: generated from the signatures in `port.rs` by rust-anything.
//! Regenerate with `rust-anything refresh` after changing them.

use wasm_bindgen::prelude::*;

pub mod js;
pub mod port;
pub mod wire;

#[allow(unused_imports)]
use serde_json::Value;

/// `parseBeacon`.
fn parse_beacon_inner(body: String) -> Result<String, String> {
    let body = crate::js::from_json(&body)?;
    let out = port::parse_beacon(body)?;
    crate::js::to_json(&out)
}

#[wasm_bindgen(js_name = "parseBeacon")]
pub fn parse_beacon(body: String) -> Result<String, JsError> {
    parse_beacon_inner(body).map_err(|e| JsError::new(&e))
}

/// `ingestEvent`.
fn ingest_event_inner(event: String) -> Result<(), String> {
    let event = crate::js::from_json(&event)?;
    port::ingest_event(event)?;
    Ok(())
}

#[wasm_bindgen(js_name = "ingestEvent")]
pub fn ingest_event(event: String) -> Result<(), JsError> {
    ingest_event_inner(event).map_err(|e| JsError::new(&e))
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

static S_PARSE_BEACON_0: wire::Schema = wire::Schema::Dyn;
static S_PARSE_BEACON_OUT: wire::Schema =
    wire::Schema::List(&wire::Schema::Map16(&wire::Schema::Dyn));

/// `parseBeacon` over the binary wire.
#[wasm_bindgen(js_name = "parseBeaconWire")]
pub fn parse_beacon_wire(len: u32) -> Result<u32, JsError> {
    wire_io(len, |r, w| {
        let body: serde_json::Value = wire::read_value(r, &S_PARSE_BEACON_0)?;
        let out = &port::parse_beacon(body)?;
        w.tag(1);
        w.count(out.len());
        for x0 in out.iter() {
            wire::write_value(w, x0, S_PARSE_BEACON_OUT.inner())?;
        }
        Ok(())
    })
}

static S_INGEST_EVENT_0: wire::Schema = wire::Schema::Dyn;

/// `ingestEvent` over the binary wire.
#[wasm_bindgen(js_name = "ingestEventWire")]
pub fn ingest_event_wire(len: u32) -> Result<u32, JsError> {
    // The generated body writes nothing back: `ingestEvent` returns void.
    wire_io(len, |r, _w| {
        let event: serde_json::Value = wire::read_value(r, &S_INGEST_EVENT_0)?;
        let () = port::ingest_event(event)?;
        Ok(())
    })
}
