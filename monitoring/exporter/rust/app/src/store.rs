//! The optional sink behind `BEACON_DB`: one append-only table, created on the first open.
//!
//! Port of `src/db.ts`. The original hands `bun:sqlite` a statement and runs it per event; the
//! schema, the column order and the payload bytes (`JSON.stringify`) are part of the contract,
//! because a `.dump` of the file is what a recorded case compares.

use rusqlite::Connection;

/// `BeaconStore`: the four string columns plus the raw event.
pub struct BeaconStore {
    connection: Connection,
}

impl BeaconStore {
    /// `openBeaconStore(path)`: create the file and the table when they do not exist yet.
    pub fn open(path: &str) -> Result<Self, String> {
        let connection = Connection::open(path).map_err(|e| e.to_string())?;
        connection
            .execute_batch(
                "CREATE TABLE IF NOT EXISTS beacon_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      type TEXT,
      path TEXT,
      locale TEXT,
      session_id TEXT,
      payload TEXT NOT NULL
    )",
            )
            .map_err(|e| e.to_string())?;
        Ok(BeaconStore { connection })
    }

    /// `store.append(event)`: `ts` is `Date.now()`, the four columns keep only string fields
    /// (`NULL` otherwise), and the payload is `JSON.stringify(event)`.
    pub fn append(&self, event: &serde_json::Value, ts: i64) -> Result<(), String> {
        let field = |key: &str| {
            event
                .get(key)
                .and_then(serde_json::Value::as_str)
                .map(str::to_string)
        };
        let payload = jsnum::stringify(event);
        self.connection
            .execute(
                "INSERT INTO beacon_events (ts, type, path, locale, session_id, payload)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                rusqlite::params![
                    ts,
                    field("type"),
                    field("path"),
                    field("locale"),
                    field("session_id"),
                    payload
                ],
            )
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}
