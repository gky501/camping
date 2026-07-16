import { ensureDiarySchema, error, saveSetting, type Env, type JsonObject } from '../../_lib/diary';

const CONDITIONS = new Set(['good', 'watch', 'attention']);
const ACTIONS = new Set(['checked', 'maintained', 'warrantied']);

function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00`).getTime());
}

function normalize(value: unknown) {
  const body = value && typeof value === 'object' ? value as JsonObject : {};
  const result: Record<string, unknown> = {};
  for (const [camperId, raw] of Object.entries(body)) {
    if (!raw || typeof raw !== 'object') continue;
    const camper = raw as JsonObject;
    const reminders = Array.isArray(camper.maintenance) ? camper.maintenance : [];
    result[camperId] = {
      active: camper.active !== false,
      maintenance: reminders.flatMap((entry) => {
        if (!entry || typeof entry !== 'object') return [];
        const item = entry as JsonObject;
        const id = String(item.id || '').trim();
        const label = String(item.label || '').trim();
        const intervalDays = Math.round(Number(item.intervalDays));
        if (!id || !label || !Number.isFinite(intervalDays) || intervalDays < 1) return [];
        const date = String(item.lastCompletedDate || '').trim();
        const condition = String(item.condition || 'good');
        const action = String(item.lastAction || 'checked');
        return [{
          id,
          label,
          intervalDays,
          lastCompletedDate: validDate(date) ? date : undefined,
          lastAction: ACTIONS.has(action) ? action : undefined,
          condition: CONDITIONS.has(condition) ? condition : 'good',
          note: String(item.note || '').trim() || undefined,
        }];
      }),
    };
  }
  return result;
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  if (!env.DB) return error('D1 binding DB is not configured.', 503);
  try {
    await ensureDiarySchema(env.DB);
    const row = await env.DB.prepare("SELECT value_json FROM app_settings WHERE key='camper_maintenance'").first<{ value_json: string }>();
    if (!row?.value_json) return Response.json({});
    try { return Response.json(normalize(JSON.parse(row.value_json))); }
    catch { return Response.json({}); }
  } catch (cause) {
    return error(cause instanceof Error ? cause.message : 'Unexpected error', 500);
  }
};

export const onRequestPut: PagesFunction<Env> = async ({ env, request }) => {
  if (!env.DB) return error('D1 binding DB is not configured.', 503);
  try {
    return await saveSetting(env.DB, 'camper_maintenance', normalize(await request.json<unknown>()));
  } catch (cause) {
    return error(cause instanceof Error ? cause.message : 'Unexpected error', 500);
  }
};
