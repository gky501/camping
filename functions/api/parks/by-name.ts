import { ensureDiarySchema, error, json, type Env, type JsonObject } from '../../_lib/diary';

function key(name: unknown, state: unknown): string {
  return `${String(name ?? '').trim().toLowerCase()}::${String(state ?? '').trim().toLowerCase()}`;
}

export const onRequestPatch: PagesFunction<Env> = async ({ env, request }) => {
  if (!env.DB) return error('D1 binding DB is not configured.', 503);
  try {
    await ensureDiarySchema(env.DB);
    const body = await request.json<JsonObject>();
    const originalName = String(body.originalName ?? '').trim();
    const originalState = String(body.originalState ?? '').trim() || 'Unknown';
    const name = String(body.name ?? '').trim();
    const state = String(body.state ?? '').trim() || 'Unknown';
    if (!originalName || !name) return error('Original and updated park names are required.');

    const current = await env.DB.prepare('SELECT * FROM park_profiles WHERE LOWER(name)=LOWER(?) AND LOWER(state)=LOWER(?)').bind(originalName, originalState).first<Record<string, unknown>>();
    if (!current) return error('Park not found.', 404);
    const id = String(current.id);

    const duplicate = await env.DB.prepare('SELECT id FROM park_profiles WHERE LOWER(name)=LOWER(?) AND LOWER(state)=LOWER(?) AND id<>?').bind(name, state, id).first();
    if (duplicate) return error('A park with that name and state already exists.', 409);

    const stayRows = await env.DB.prepare('SELECT id,site_snapshot_json FROM stays WHERE site_snapshot_json IS NOT NULL').all();
    const statements: D1PreparedStatement[] = [
      env.DB.prepare(`UPDATE park_profiles SET name=?,state=?,check_in_time=?,check_out_time=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
        .bind(name, state, body.checkInTime ? String(body.checkInTime) : null, body.checkOutTime ? String(body.checkOutTime) : null, String(body.notes ?? ''), id),
      env.DB.prepare('UPDATE sites SET park=?,state=?,updated_at=CURRENT_TIMESTAMP WHERE LOWER(park)=LOWER(?) AND LOWER(state)=LOWER(?)').bind(name, state, originalName, originalState),
    ];

    for (const row of stayRows.results as Array<Record<string, unknown>>) {
      try {
        const snapshot = JSON.parse(String(row.site_snapshot_json)) as Record<string, unknown>;
        if (key(snapshot.park, snapshot.state) !== key(originalName, originalState)) continue;
        snapshot.park = name;
        snapshot.state = state;
        statements.push(env.DB.prepare('UPDATE stays SET site_snapshot_json=? WHERE id=?').bind(JSON.stringify(snapshot), row.id));
      } catch {
        // Ignore malformed legacy snapshots.
      }
    }

    await env.DB.batch(statements);
    return json({ ok: true, id });
  } catch (cause) {
    return error(cause instanceof Error ? cause.message : 'Unexpected error', 500);
  }
};
