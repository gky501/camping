import { importBackup } from '../../_lib/importData';
import type { Env } from '../../_lib/diary';

async function tableExists(db: D1Database, name: string): Promise<boolean> {
  const row = await db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
    .bind(name)
    .first();
  return Boolean(row);
}

async function tableCount(db: D1Database, name: string): Promise<number> {
  if (!await tableExists(db, name)) return 0;
  const row = await db.prepare(`SELECT COUNT(*) AS count FROM ${name}`).first<{ count: number }>();
  return Number(row?.count ?? 0);
}

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  if (!env.DB) return Response.json({ error: 'D1 binding DB is not configured.' }, { status: 503 });

  try {
    const sitesTable = await tableExists(env.DB, 'sites');
    if (sitesTable) {
      const [siteCount, stayCount, profileCount, factCount, seasonalCount, visitedCount, resetMarker] = await Promise.all([
        tableCount(env.DB, 'sites'),
        tableCount(env.DB, 'stays'),
        tableCount(env.DB, 'preference_profiles'),
        tableCount(env.DB, 'site_facts'),
        tableCount(env.DB, 'site_seasonal_ratings'),
        env.DB.prepare("SELECT COUNT(*) AS count FROM sites WHERE status NOT IN ('wishlist','saved')").first<{ count: number }>(),
        tableExists(env.DB, 'app_migrations').then(async (exists) => exists
          ? env.DB.prepare("SELECT key FROM app_migrations WHERE key='wishlist-only-reset-v1'").first()
          : null),
      ]);

      const databaseIsEmpty = siteCount === 0 && stayCount === 0 && profileCount === 0;
      const databaseMatchesResetDamage = Boolean(resetMarker)
        && stayCount === 0
        && factCount === 0
        && seasonalCount === 0
        && Number(visitedCount?.count ?? 0) === 0;

      if (!databaseIsEmpty && !databaseMatchesResetDamage) {
        return Response.json(
          { error: 'This D1 database already contains Camp Ledger data. The importer will not overwrite it.' },
          { status: 409 },
        );
      }
    }

    return await importBackup(env, await request.json<unknown>());
  } catch (cause) {
    return Response.json(
      { error: cause instanceof Error ? cause.message : 'Unable to import the backup.' },
      { status: 500 },
    );
  }
};
