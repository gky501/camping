import { ensureDiarySchema, error, updateStay, type Env, type JsonObject } from '../../_lib/diary';

export const onRequestPatch: PagesFunction<Env> = async ({ env, request, params }) => {
  if (!env.DB) return error('D1 binding DB is not configured.', 503);
  try {
    return await updateStay(env.DB, String(params.id || ''), await request.json<JsonObject>());
  } catch (cause) {
    return error(cause instanceof Error ? cause.message : 'Unexpected error', 500);
  }
};

export const onRequestDelete: PagesFunction<Env> = async ({ env, request, params }) => {
  if (!env.DB) return error('D1 binding DB is not configured.', 503);
  try {
    await ensureDiarySchema(env.DB);
    const id = String(params.id || '');
    const stay = await env.DB.prepare('SELECT site_id FROM stays WHERE id=?').bind(id).first<{ site_id: string }>();
    if (!stay) return error('Diary entry not found.', 404);

    const siteId = String(stay.site_id);
    const remaining = await env.DB.prepare('SELECT COUNT(*) AS count FROM stays WHERE site_id=? AND id<>?')
      .bind(siteId, id)
      .first<{ count: number }>();
    const isOrphan = Number(remaining?.count ?? 0) === 0;
    const deleteOrphanSite = new URL(request.url).searchParams.get('deleteOrphanSite') === 'true' && isOrphan;

    const statements: D1PreparedStatement[] = [
      env.DB.prepare('DELETE FROM stay_observations WHERE stay_id=?').bind(id),
      env.DB.prepare('DELETE FROM site_fact_history WHERE stay_id=?').bind(id),
      env.DB.prepare('DELETE FROM stays WHERE id=?').bind(id),
    ];

    if (deleteOrphanSite) {
      statements.push(
        env.DB.prepare('DELETE FROM site_facts WHERE site_id=?').bind(siteId),
        env.DB.prepare('DELETE FROM site_seasonal_ratings WHERE site_id=?').bind(siteId),
        env.DB.prepare('DELETE FROM site_fact_history WHERE site_id=?').bind(siteId),
        env.DB.prepare('DELETE FROM sites WHERE id=?').bind(siteId),
      );
    } else if (isOrphan) {
      statements.push(env.DB.prepare("UPDATE sites SET status='wishlist', updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(siteId));
    }

    await env.DB.batch(statements);
    return Response.json({ ok: true, deletedSite: deleteOrphanSite, siteId });
  } catch (cause) {
    return error(cause instanceof Error ? cause.message : 'Unexpected error', 500);
  }
};
