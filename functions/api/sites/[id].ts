import { error, updateSite, type Env, type JsonObject } from '../../_lib/diary';

export const onRequestPatch: PagesFunction<Env> = async ({ env, request, params }) => {
  if (!env.DB) return error('D1 binding DB is not configured.', 503);
  try {
    return await updateSite(env.DB, String(params.id || ''), await request.json<JsonObject>());
  } catch (cause) {
    return error(cause instanceof Error ? cause.message : 'Unexpected error', 500);
  }
};

export const onRequestDelete: PagesFunction<Env> = async ({ env, params }) => {
  if (!env.DB) return error('D1 binding DB is not configured.', 503);

  try {
    const id = String(params.id || '');
    const site = await env.DB.prepare('SELECT id FROM sites WHERE id=?').bind(id).first();
    if (!site) return error('Campsite not found.', 404);

    const stayCount = await env.DB
      .prepare('SELECT COUNT(*) AS count FROM stays WHERE site_id=?')
      .bind(id)
      .first<{ count: number }>();

    if (Number(stayCount?.count ?? 0) > 0) {
      return error('Delete the campsite’s trips before deleting its map marker.', 409);
    }

    await env.DB.batch([
      env.DB.prepare('DELETE FROM site_fact_history WHERE site_id=?').bind(id),
      env.DB.prepare('DELETE FROM site_facts WHERE site_id=?').bind(id),
      env.DB.prepare('DELETE FROM site_seasonal_ratings WHERE site_id=?').bind(id),
      env.DB.prepare('DELETE FROM sites WHERE id=?').bind(id),
    ]);

    return Response.json({ ok: true });
  } catch (cause) {
    return error(cause instanceof Error ? cause.message : 'Unexpected error', 500);
  }
};