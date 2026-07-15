import { error, json, saveSetting, type Env, type JsonObject } from '../../_lib/diary';

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  if (!env.DB) return error('D1 binding DB is not configured.', 503);
  try {
    const row = await env.DB.prepare("SELECT value_json FROM app_settings WHERE key='trip_details'").first<Record<string, unknown>>();
    return json(row?.value_json ? JSON.parse(String(row.value_json)) : {});
  } catch (cause) {
    return error(cause instanceof Error ? cause.message : 'Unable to load trip details.', 500);
  }
};

export const onRequestPut: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.DB) return error('D1 binding DB is not configured.', 503);
  try {
    const body = await request.json() as JsonObject;
    return await saveSetting(env.DB, 'trip_details', body);
  } catch (cause) {
    return error(cause instanceof Error ? cause.message : 'Unable to save trip details.', 500);
  }
};
