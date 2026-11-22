//! Process state the routes share: the settings read once at startup and the optional beacon
//! sink. Both are process-wide in the original (a module-level constant and a closure capture), so
//! they are process-wide here too.

use std::collections::BTreeMap;
use std::sync::{Mutex, OnceLock};

use crate::store::BeaconStore;
use config_rs::port::{Settings, settings_from_env};

static SETTINGS: OnceLock<Settings> = OnceLock::new();
static STORE: OnceLock<Option<Mutex<BeaconStore>>> = OnceLock::new();

/// The environment as a map, the way `Bun.env` presents it.
pub fn process_env() -> BTreeMap<String, String> {
    std::env::vars().collect()
}

/// `getSettings()`: read once, then answer the same settings for the life of the process.
pub fn settings() -> &'static Settings {
    SETTINGS.get_or_init(|| settings_from_env(&process_env()))
}

/// `settings.beaconDbPath ? openBeaconStore(path) : null`.
pub fn store() -> Option<&'static Mutex<BeaconStore>> {
    STORE
        .get_or_init(|| {
            let path = settings().beacon_db_path.clone();
            if path.is_empty() {
                return None;
            }
            match BeaconStore::open(&path) {
                Ok(store) => Some(Mutex::new(store)),
                Err(error) => {
                    eprintln!("beacon store: {error}");
                    None
                }
            }
        })
        .as_ref()
}
