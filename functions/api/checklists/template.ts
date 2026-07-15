import { error, saveSetting, type Env, type JsonObject } from '../../_lib/diary';

export const onRequestPut: PagesFunction<Env> = async ({ env, request }) => {
  if (!env.DB) return error('D1 binding DB is not configured.', 503);
  try {
    const body = await request.json<JsonObject>();
    if (!Array.isArray(body.sections)) return error('Checklist sections are required.');
    return await saveSetting(env.DB, 'checklist_template', { sections: body.sections });
  } catch (cause) {
    return error(cause instanceof Error ? cause.message : 'Unexpected error', 500);
  }
};
