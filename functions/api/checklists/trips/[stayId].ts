import { error, saveTripChecklist, type Env, type JsonObject } from '../../../_lib/diary';

export const onRequestPut: PagesFunction<Env> = async ({ env, request, params }) => {
  if (!env.DB) return error('D1 binding DB is not configured.', 503);
  try {
    return await saveTripChecklist(env.DB, String(params.stayId || ''), await request.json<JsonObject>());
  } catch (cause) {
    return error(cause instanceof Error ? cause.message : 'Unexpected error', 500);
  }
};
