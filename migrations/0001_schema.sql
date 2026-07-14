PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  park TEXT NOT NULL,
  state TEXT NOT NULL,
  loop TEXT NOT NULL DEFAULT '',
  site_number TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  view_types_json TEXT NOT NULL DEFAULT '[]',
  legacy_stay_count INTEGER NOT NULL DEFAULT 0,
  imported_rating REAL,
  favorite INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'saved',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS site_facts (
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  criterion_key TEXT NOT NULL,
  rating REAL NOT NULL CHECK (rating >= 0 AND rating <= 5),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (site_id, criterion_key)
);

CREATE TABLE IF NOT EXISTS site_fact_history (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  criterion_key TEXT NOT NULL,
  previous_rating REAL,
  new_rating REAL,
  changed_on TEXT NOT NULL,
  stay_id TEXT
);

CREATE TABLE IF NOT EXISTS site_seasonal_ratings (
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  month_key TEXT NOT NULL,
  rating REAL NOT NULL CHECK (rating >= 0 AND rating <= 5),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (site_id, month_key)
);

CREATE TABLE IF NOT EXISTS stays (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  arrival_date TEXT NOT NULL,
  departure_date TEXT NOT NULL,
  nights INTEGER NOT NULL CHECK (nights > 0),
  nightly_rate REAL,
  journal TEXT NOT NULL DEFAULT '',
  weather TEXT,
  would_return INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stay_observations (
  stay_id TEXT NOT NULL REFERENCES stays(id) ON DELETE CASCADE,
  criterion_key TEXT NOT NULL,
  rating REAL NOT NULL CHECK (rating >= 0 AND rating <= 5),
  PRIMARY KEY (stay_id, criterion_key)
);

CREATE TABLE IF NOT EXISTS preference_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  site_quality_share REAL NOT NULL DEFAULT 75,
  seasonal_share REAL NOT NULL DEFAULT 25,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS profile_criterion_weights (
  profile_id TEXT NOT NULL REFERENCES preference_profiles(id) ON DELETE CASCADE,
  criterion_key TEXT NOT NULL,
  weight REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (profile_id, criterion_key)
);

CREATE TABLE IF NOT EXISTS profile_month_weights (
  profile_id TEXT NOT NULL REFERENCES preference_profiles(id) ON DELETE CASCADE,
  month_key TEXT NOT NULL,
  weight REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (profile_id, month_key)
);

CREATE INDEX IF NOT EXISTS idx_stays_site_date ON stays(site_id, arrival_date DESC);
CREATE INDEX IF NOT EXISTS idx_sites_location ON sites(latitude, longitude);
