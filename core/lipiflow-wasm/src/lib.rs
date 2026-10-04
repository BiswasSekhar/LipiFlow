use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn encode_legacy(text: &str) -> String {
    serde_json::to_string(&lipiflow_core::encode_legacy(text)).expect("serializable encoder result")
}

#[wasm_bindgen]
pub fn transliterate(text: &str) -> String {
    lipiflow_core::transliterate(text)
}

#[wasm_bindgen]
pub fn engine_version() -> String {
    lipiflow_core::ENGINE_VERSION.to_owned()
}

#[wasm_bindgen]
pub fn scheme_version() -> String {
    lipiflow_core::SCHEME_VERSION.to_owned()
}
