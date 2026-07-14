import { createCamper, error, type Env, type JsonObject } from '../../_lib/diary';

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  if (!env.DB) return error('D1 binding DB is not configured.', 503);
  try { return await createCamper(env.DB, await request.json<JsonObject>()); }
  catch (cause) { return error(cause instanceof Error ? cause.message : 'Unexpected error', 500); }
};
