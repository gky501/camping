export interface Env {
  DB: D1Database;
}

export type JsonObject = Record<string, unknown>;

export const json = (data: unknown, status = 200) => Response.json(data, { status });
export const error = (message: string, status = 400) => json({ error: message }, status);

export async function ensureDiarySchema(db: D1Database) {
  const siteColumns = await db.prepare('PRAGMA table_info(sites)').all();
  const siteNames = new Set((siteColumns.results as Array<Record<string, unknown>>).map((row) => String(row.name)));
  if (!siteNames.has('area')) {
    await db.prepare("ALTER TABLE sites ADD COLUMN area TEXT NOT NULL DEFAULT ''").run();
    await db.prepare("UPDATE sites SET area='Crystal Springs', loop='C' WHERE id='lake-ouachita-crystal-springs-c-55' AND loop='Crystal Springs C'").run();
  }
  if (!siteNames.has('amenities_json')) {
    await db.prepare("ALTER TABLE sites ADD COLUMN amenities_json TEXT NOT NULL DEFAULT '{}'").run();
  }
  const stayColumns = await db.prepare('PRAGMA table_info(stays)').all();
  const stayNames = new Set((stayColumns.results as Array<Record<string, unknown>>).map((row) => String(row.name)));
  if (!stayNames.has('site_snapshot_json')) await db.prepare('ALTER TABLE stays ADD COLUMN site_snapshot_json TEXT').run();
}

export async function loadBootstrap(db: D1Database) {
  await ensureDiarySchema(db);
  const [sitesResult, factsResult, seasonsResult, staysResult, observationsResult, profilesResult, criterionWeightsResult, monthWeightsResult] = await Promise.all([
    db.prepare('SELECT * FROM sites ORDER BY park, area, loop, site_number').all(),
    db.prepare('SELECT site_id, criterion_key, rating FROM site_facts').all(),
    db.prepare('SELECT site_id, month_key, rating FROM site_seasonal_ratings').all(),
    db.prepare('SELECT * FROM stays ORDER BY arrival_date DESC').all(),
    db.prepare('SELECT stay_id, criterion_key, rating FROM stay_observations').all(),
    db.prepare('SELECT * FROM preference_profiles ORDER BY created_at').all(),
    db.prepare('SELECT profile_id, criterion_key, weight FROM profile_criterion_weights').all(),
    db.prepare('SELECT profile_id, month_key, weight FROM profile_month_weights').all(),
  ]);

  const factsBySite = new Map<string, Record<string, number>>();
  for (const row of factsResult.results as Array<Record<string, unknown>>) {
    const id = String(row.site_id); const ratings = factsBySite.get(id) ?? {};
    ratings[String(row.criterion_key)] = Number(row.rating); factsBySite.set(id, ratings);
  }
  const seasonsBySite = new Map<string, Record<string, number>>();
  for (const row of seasonsResult.results as Array<Record<string, unknown>>) {
    const id = String(row.site_id); const ratings = seasonsBySite.get(id) ?? {};
    ratings[String(row.month_key)] = Number(row.rating); seasonsBySite.set(id, ratings);
  }
  const observationsByStay = new Map<string, Record<string, number>>();
  for (const row of observationsResult.results as Array<Record<string, unknown>>) {
    const id = String(row.stay_id); const ratings = observationsByStay.get(id) ?? {};
    ratings[String(row.criterion_key)] = Number(row.rating); observationsByStay.set(id, ratings);
  }
  const criterionByProfile = new Map<string, Record<string, number>>();
  for (const row of criterionWeightsResult.results as Array<Record<string, unknown>>) {
    const id = String(row.profile_id); const weights = criterionByProfile.get(id) ?? {};
    weights[String(row.criterion_key)] = Number(row.weight); criterionByProfile.set(id, weights);
  }
  const monthsByProfile = new Map<string, Record<string, number>>();
  for (const row of monthWeightsResult.results as Array<Record<string, unknown>>) {
    const id = String(row.profile_id); const weights = monthsByProfile.get(id) ?? {};
    weights[String(row.month_key)] = Number(row.weight); monthsByProfile.set(id, weights);
  }

  return {
    sites: (sitesResult.results as Array<Record<string, unknown>>).map((row) => ({
      id: row.id, park: row.park, state: row.state, area: row.area ?? '', loop: row.loop, siteNumber: row.site_number,
      latitude: Number(row.latitude), longitude: Number(row.longitude), notes: row.notes,
      amenities: JSON.parse(String(row.amenities_json || '{}')),
      viewTypes: JSON.parse(String(row.view_types_json || '[]')), legacyStayCount: Number(row.legacy_stay_count || 0),
      importedRating: row.imported_rating === null ? undefined : Number(row.imported_rating), favorite: Boolean(row.favorite), status: row.status,
      currentFacts: factsBySite.get(String(row.id)) ?? {}, seasonalRatings: seasonsBySite.get(String(row.id)) ?? {},
    })),
    stays: (staysResult.results as Array<Record<string, unknown>>).map((row) => ({
      id: row.id, siteId: row.site_id,
      siteSnapshot: row.site_snapshot_json ? JSON.parse(String(row.site_snapshot_json)) : undefined,
      arrivalDate: row.arrival_date, departureDate: row.departure_date, nights: Number(row.nights),
      nightlyRate: row.nightly_rate === null ? undefined : Number(row.nightly_rate), journal: row.journal,
      weather: row.weather ?? undefined, wouldReturn: row.would_return === null ? undefined : Boolean(row.would_return),
      observations: observationsByStay.get(String(row.id)) ?? {}, createdAt: row.created_at,
    })),
    profiles: (profilesResult.results as Array<Record<string, unknown>>).map((row) => ({
      id: row.id, name: row.name, siteQualityShare: Number(row.site_quality_share), seasonalShare: Number(row.seasonal_share),
      criterionWeights: criterionByProfile.get(String(row.id)) ?? {}, monthWeights: monthsByProfile.get(String(row.id)) ?? {},
    })),
  };
}

export async function createSite(db: D1Database, body: JsonObject) {
  await ensureDiarySchema(db);
  const id = String(body.id || crypto.randomUUID());
  const park = String(body.park || '').trim(); const state = String(body.state || '').trim() || 'Unknown';
  const area = String(body.area || '').trim(); const loop = String(body.loop || '').trim(); const siteNumber = String(body.siteNumber || '').trim();
  const latitude = Number(body.latitude); const longitude = Number(body.longitude);
  if (!park || !siteNumber || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return error('Park, site, latitude, and longitude are required.');
  await db.prepare(`INSERT INTO sites (id,park,state,area,loop,site_number,latitude,longitude,notes,amenities_json,view_types_json,legacy_stay_count,imported_rating,favorite,status)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id, park, state, area, loop, siteNumber, latitude, longitude, String(body.notes || ''), JSON.stringify(body.amenities ?? {}), JSON.stringify(body.viewTypes ?? []), Number(body.legacyStayCount || 0), body.importedRating === undefined ? null : Number(body.importedRating), body.favorite ? 1 : 0, String(body.status || 'wishlist')).run();
  return json({ ok: true, id }, 201);
}

export async function updateSite(db: D1Database, id: string, body: JsonObject) {
  await ensureDiarySchema(db);
  await db.prepare(`UPDATE sites SET park=?,state=?,area=?,loop=?,site_number=?,latitude=?,longitude=?,notes=?,amenities_json=?,view_types_json=?,favorite=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .bind(body.park, body.state, body.area ?? '', body.loop, body.siteNumber, body.latitude, body.longitude, body.notes ?? '', JSON.stringify(body.amenities ?? {}), JSON.stringify(body.viewTypes ?? []), body.favorite ? 1 : 0, body.status ?? 'wishlist', id).run();
  return json({ ok: true });
}

function stayValues(body: JsonObject) {
  const siteId = String(body.siteId || '');
  const arrivalDate = String(body.arrivalDate || '');
  const departureDate = String(body.departureDate || '');
  const nights = Number(body.nights || 0);
  return { siteId, arrivalDate, departureDate, nights };
}

function observationStatements(db: D1Database, stayId: string, siteId: string, body: JsonObject) {
  const observations = (body.observations ?? {}) as Record<string, number>;
  const updateCurrentKeys = Array.isArray(body.updateCurrentKeys) ? body.updateCurrentKeys.map(String) : [];
  const statements: D1PreparedStatement[] = [];
  for (const [key, rawRating] of Object.entries(observations)) {
    const rating = Number(rawRating); if (!Number.isFinite(rating) || rating < 0 || rating > 5) continue;
    statements.push(db.prepare('INSERT OR REPLACE INTO stay_observations (stay_id,criterion_key,rating) VALUES (?,?,?)').bind(stayId, key, rating));
    if (updateCurrentKeys.includes(key)) statements.push(db.prepare(`INSERT INTO site_facts (site_id,criterion_key,rating,updated_at) VALUES (?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(site_id,criterion_key) DO UPDATE SET rating=excluded.rating,updated_at=CURRENT_TIMESTAMP`).bind(siteId, key, rating));
  }
  return statements;
}

export async function createStay(db: D1Database, body: JsonObject) {
  await ensureDiarySchema(db);
  const id = String(body.id || crypto.randomUUID());
  const { siteId, arrivalDate, departureDate, nights } = stayValues(body);
  if (!siteId || !arrivalDate || !departureDate || nights < 1) return error('Site, dates, and at least one night are required.');
  const statements: D1PreparedStatement[] = [
    db.prepare(`INSERT INTO stays (id,site_id,site_snapshot_json,arrival_date,departure_date,nights,nightly_rate,journal,weather,would_return,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(id, siteId, body.siteSnapshot ? JSON.stringify(body.siteSnapshot) : null, arrivalDate, departureDate, nights, body.nightlyRate === undefined ? null : Number(body.nightlyRate), String(body.journal || ''), body.weather ? String(body.weather) : null, body.wouldReturn === undefined ? null : body.wouldReturn ? 1 : 0, String(body.createdAt || new Date().toISOString())),
    db.prepare("UPDATE sites SET status='visited', updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(siteId),
    ...observationStatements(db, id, siteId, body),
  ];
  await db.batch(statements);
  return json({ ok: true, id }, 201);
}

export async function updateStay(db: D1Database, id: string, body: JsonObject) {
  await ensureDiarySchema(db);
  const existing = await db.prepare('SELECT id FROM stays WHERE id=?').bind(id).first();
  if (!existing) return error('Diary entry not found.', 404);

  const { siteId, arrivalDate, departureDate, nights } = stayValues(body);
  if (!siteId || !arrivalDate || !departureDate || nights < 1) return error('Site, dates, and at least one night are required.');

  const statements: D1PreparedStatement[] = [
    db.prepare(`UPDATE stays SET site_id=?,site_snapshot_json=?,arrival_date=?,departure_date=?,nights=?,nightly_rate=?,journal=?,weather=?,would_return=? WHERE id=?`)
      .bind(siteId, body.siteSnapshot ? JSON.stringify(body.siteSnapshot) : null, arrivalDate, departureDate, nights, body.nightlyRate === undefined ? null : Number(body.nightlyRate), String(body.journal || ''), body.weather ? String(body.weather) : null, body.wouldReturn === undefined ? null : body.wouldReturn ? 1 : 0, id),
    db.prepare('DELETE FROM stay_observations WHERE stay_id=?').bind(id),
    db.prepare("UPDATE sites SET status='visited', updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(siteId),
    ...observationStatements(db, id, siteId, body),
  ];
  await db.batch(statements);
  return json({ ok: true, id });
}
