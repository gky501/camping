interface Env {
  DB?: D1Database;
}

async function resetToWishlistOnce(db: D1Database): Promise<void> {
  const sitesTable = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sites'").first();
  if (!sitesTable) return;

  await db.prepare(`CREATE TABLE IF NOT EXISTS app_migrations (
    key TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();

  const applied = await db.prepare("SELECT key FROM app_migrations WHERE key='wishlist-only-reset-v1'").first();
  if (applied) return;

  await db.batch([
    db.prepare('DELETE FROM stay_observations'),
    db.prepare('DELETE FROM site_fact_history'),
    db.prepare('DELETE FROM stays'),
    db.prepare("DELETE FROM sites WHERE status NOT IN ('wishlist','saved')"),
    db.prepare('DELETE FROM site_facts'),
    db.prepare('DELETE FROM site_seasonal_ratings'),
    db.prepare("UPDATE sites SET status='wishlist', legacy_stay_count=0, imported_rating=NULL, updated_at=CURRENT_TIMESTAMP"),
    db.prepare("INSERT INTO app_migrations (key) VALUES ('wishlist-only-reset-v1')"),
  ]);
}

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.env.DB) await resetToWishlistOnce(context.env.DB);
  return context.next();
};
