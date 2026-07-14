-- One-time reset requested July 14, 2026: keep only wish-list campsite records.
-- The marker makes this safe if the Pages middleware has already performed the reset.
CREATE TABLE IF NOT EXISTS app_migrations (
  key TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DELETE FROM stay_observations
WHERE NOT EXISTS (SELECT 1 FROM app_migrations WHERE key = 'wishlist-only-reset-v1');
DELETE FROM site_fact_history
WHERE NOT EXISTS (SELECT 1 FROM app_migrations WHERE key = 'wishlist-only-reset-v1');
DELETE FROM stays
WHERE NOT EXISTS (SELECT 1 FROM app_migrations WHERE key = 'wishlist-only-reset-v1');
DELETE FROM sites
WHERE status NOT IN ('wishlist', 'saved')
  AND NOT EXISTS (SELECT 1 FROM app_migrations WHERE key = 'wishlist-only-reset-v1');
DELETE FROM site_facts
WHERE NOT EXISTS (SELECT 1 FROM app_migrations WHERE key = 'wishlist-only-reset-v1');
DELETE FROM site_seasonal_ratings
WHERE NOT EXISTS (SELECT 1 FROM app_migrations WHERE key = 'wishlist-only-reset-v1');
UPDATE sites
SET status = 'wishlist', legacy_stay_count = 0, imported_rating = NULL, updated_at = CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM app_migrations WHERE key = 'wishlist-only-reset-v1');

INSERT OR IGNORE INTO app_migrations (key) VALUES ('wishlist-only-reset-v1');
