CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trip_checklists (
  stay_id TEXT PRIMARY KEY,
  data_json TEXT NOT NULL DEFAULT '{"checkedItemIds":[],"customSections":[]}',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
