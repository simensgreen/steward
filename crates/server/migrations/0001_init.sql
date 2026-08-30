-- Bootstrap metadata for Steward instance (domain schema comes later).
CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
);

INSERT OR IGNORE INTO app_meta (key, value) VALUES ('schema_bootstrap', '1');
