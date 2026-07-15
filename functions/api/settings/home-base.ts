import { error, saveSetting, type Env, type JsonObject } from '../../_lib/diary';

export const onRequestPut: PagesFunction<Env> = async ({ env, request }) => {
  if (!env.DB) return error('D1 binding DB is not configured.', 503);
  try {
    const body = await request.json<JsonObject>();
    const name = String(body.name || '').trim() || 'Home';
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return error('Valid home-base coordinates are required.');
    return await saveSetting(env.DB, 'home_base', { name, latitude, longitude });
  } catch (cause) {
    return error(cause instanceof Error ? cause.message : 'Unexpected error', 500);
  }
};
