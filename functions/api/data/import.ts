import { importBackup } from '../../_lib/importData';
import type { Env } from '../../_lib/diary';

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  if (!env.DB) return Response.json({ error: 'D1 binding DB is not configured.' }, { status: 503 });
  try {
    const sitesTable = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sites'").first();
    if (sitesTable) {
      const [sites, stays, profiles] = await Promise.all([
        env.DB.prepare('SELECT COUNT(*) AS count FROM sites').first<{ count: number }>(),
        env.DB.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name='stays'").first<{ count: number }>(),
        env.DB.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name='preference_profiles'").first<{ count: number }>(),
      ]);
      const siteCount = Number(sites?.count ?? 0);
      let stayCount = 0;
      let profileCount = 0;
      if (Number(stays?.count ?? 0) > 0) stayCount = Number((await env.DB.prepare('SELECT COUNT(*) AS count FROM stays').first<{ count: number }>())?.count ?? 0);
      if (Number(profiles?.count ?? 0) > 0) profileCount = Number((await env.DB.prepare('SELECT COUNT(*) AS count FROM preference_profiles').first<{ count: number }>())?.count ?? 0);
      if (siteCount > 0 || stayCount > 0 || profileCount > 0) {
        return Response.json({ error: 'This D1 database already contains Camp Ledger data. The one-time restore tool will not overwrite it.' }, { status: 409 });
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
