import { ensureDiarySchema, error, saveSetting, type Env, type JsonObject } from '../../_lib/diary';

const VALID_CONDITIONS = new Set(['good', 'watch', 'replace']);

function normalizeInventory(value: unknown) {
  const body = value && typeof value === 'object' ? value as JsonObject : {};
  const items = Array.isArray(body.items) ? body.items : [];
  return {
    items: items.flatMap((raw) => {
      if (!raw || typeof raw !== 'object') return [];
      const item = raw as JsonObject;
      const id = String(item.id || '').trim();
      const label = String(item.label || '').trim();
      if (!id || !label) return [];
      const condition = String(item.condition || 'good');
      return [{
        id,
        label,
        condition: VALID_CONDITIONS.has(condition) ? condition : 'good',
        note: String(item.note || '').trim() || undefined,
        updatedAt: String(item.updatedAt || '').trim() || undefined,
      }];
    }),
  };
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  if (!env.DB) return error('D1 binding DB is not configured.', 503);
  try {
    await ensureDiarySchema(env.DB);
    const row = await env.DB.prepare("SELECT value_json FROM app_settings WHERE key='equipment_inventory'").first<{ value_json: string }>();
    if (!row?.value_json) return Response.json({ items: [] });
    try { return Response.json(normalizeInventory(JSON.parse(row.value_json))); }
    catch { return Response.json({ items: [] }); }
  } catch (cause) {
    return error(cause instanceof Error ? cause.message : 'Unexpected error', 500);
  }
};

export const onRequestPut: PagesFunction<Env> = async ({ env, request }) => {
  if (!env.DB) return error('D1 binding DB is not configured.', 503);
  try {
    return await saveSetting(env.DB, 'equipment_inventory', normalizeInventory(await request.json<unknown>()));
  } catch (cause) {
    return error(cause instanceof Error ? cause.message : 'Unexpected error', 500);
  }
};
