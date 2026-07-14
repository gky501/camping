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
    const result = await env.DB.prepare("DELETE FROM sites WHERE id=? AND status IN ('wishlist','saved')")
      .bind(String(params.id || ''))
      .run();
    return result.meta.changes
      ? Response.json({ ok: true })
      : error('Wish-list site not found.', 404);
  } catch (cause) {
    return error(cause instanceof Error ? cause.message : 'Unexpected error', 500);
  }
};
