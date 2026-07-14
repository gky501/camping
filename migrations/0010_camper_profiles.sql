CREATE TABLE IF NOT EXISTS camper_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  year INTEGER,
  make TEXT,
  model TEXT,
  length_feet REAL,
  sleeps INTEGER,
  slide_outs INTEGER,
  dry_weight_lbs INTEGER,
  gvwr_lbs INTEGER,
  tent_style TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO camper_profiles (id,name,type,notes)
VALUES ('camper-tent','Tent Camping','tent','');

-- The Pages Function adds stays.camper_id only when the column is missing.
