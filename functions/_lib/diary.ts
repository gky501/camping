export interface Env {
  DB: D1Database;
}

export type JsonObject = Record<string, unknown>;

export const json = (data: unknown, status = 200) => Response.json(data, { status });
export const error = (message: string, status = 400) => json({ error: message }, status);

function parkKey(name: unknown, state: unknown): string {
  return `${String(name ?? '').trim().toLowerCase()}::${String(state ?? '').trim().toLowerCase()}`;
}

async function ensureParkProfiles(db: D1Database) {
  const [siteRows, parkRows] = await Promise.all([
    db.prepare(`SELECT DISTINCT s.park, s.state FROM sites s INNER JOIN stays st ON st.site_id=s.id WHERE TRIM(s.park)<>''`).all(),
    db.prepare('SELECT id,name,state FROM park_profiles').all(),
  ]);
  const known = new Set((parkRows.results as Array<Record<string, unknown>>).map((row) => parkKey(row.name, row.state)));
  const statements: D1PreparedStatement[] = [];
  for (const row of siteRows.results as Array<Record<string, unknown>>) {
    const name = String(row.park ?? '').trim();
    const state = String(row.state ?? '').trim() || 'Unknown';
    const key = parkKey(name, state);
    if (!name || known.has(key)) continue;
    known.add(key);
    statements.push(db.prepare(`INSERT INTO park_profiles (id,name,state,notes) VALUES (?,?,?,'')`).bind(crypto.randomUUID(), name, state));
  }
  if (statements.length) await db.batch(statements);
}

export async function ensureDiarySchema(db: D1Database) {
  const siteColumns = await db.prepare('PRAGMA table_info(sites)').all();
  const siteNames = new Set((siteColumns.results as Array<Record<string, unknown>>).map((row) => String(row.name)));
  if (!siteNames.has('area')) {
    await db.prepare("ALTER TABLE sites ADD COLUMN area TEXT NOT NULL DEFAULT ''").run();
    await db.prepare("UPDATE sites SET area='Crystal Springs', loop='C' WHERE id='lake-ouachita-crystal-springs-c-55' AND loop='Crystal Springs C'").run();
  }
  if (!siteNames.has('amenities_json')) await db.prepare("ALTER TABLE sites ADD COLUMN amenities_json TEXT NOT NULL DEFAULT '{}'").run();

  const stayColumns = await db.prepare('PRAGMA table_info(stays)').all();
  const stayNames = new Set((stayColumns.results as Array<Record<string, unknown>>).map((row) => String(row.name)));
  if (!stayNames.has('site_snapshot_json')) await db.prepare('ALTER TABLE stays ADD COLUMN site_snapshot_json TEXT').run();
  if (!stayNames.has('camper_id')) await db.prepare('ALTER TABLE stays ADD COLUMN camper_id TEXT').run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS park_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    state TEXT NOT NULL,
    check_in_time TEXT,
    check_out_time TEXT,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name,state)
  )`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS camper_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    year INTEGER,
    make TEXT,
    model TEXT,
    length_feet REAL,
    sleeps INTEGER,
    slide_outs INTEGER,
    dry_weight_lbs INTEGER,
    gvwr_lbs INTEGER,
    tent_style TEXT,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await db.prepare(`INSERT OR IGNORE INTO camper_profiles (id,name,type,notes) VALUES ('camper-tent','Tent Camping','tent','')`).run();
  await ensureParkProfiles(db);
}

export async function loadBootstrap(db: D1Database) {
  await ensureDiarySchema(db);
  const [sitesResult, factsResult, seasonsResult, staysResult, observationsResult, profilesResult, criterionWeightsResult, monthWeightsResult, parksResult, campersResult] = await Promise.all([
    db.prepare('SELECT * FROM sites ORDER BY park, area, loop, site_number').all(),
    db.prepare('SELECT site_id, criterion_key, rating FROM site_facts').all(),
    db.prepare('SELECT site_id, month_key, rating FROM site_seasonal_ratings').all(),
    db.prepare('SELECT * FROM stays ORDER BY arrival_date DESC').all(),
    db.prepare('SELECT stay_id, criterion_key, rating FROM stay_observations').all(),
    db.prepare('SELECT * FROM preference_profiles ORDER BY created_at').all(),
    db.prepare('SELECT profile_id, criterion_key, weight FROM profile_criterion_weights').all(),
    db.prepare('SELECT profile_id, month_key, weight FROM profile_month_weights').all(),
    db.prepare('SELECT * FROM park_profiles ORDER BY name,state').all(),
    db.prepare('SELECT * FROM camper_profiles ORDER BY CASE WHEN id=\'camper-tent\' THEN 1 ELSE 0 END, name').all(),
  ]);

  const factsBySite = new Map<string, Record<string, number>>();
  for (const row of factsResult.results as Array<Record<string, unknown>>) { const id = String(row.site_id); const ratings = factsBySite.get(id) ?? {}; ratings[String(row.criterion_key)] = Number(row.rating); factsBySite.set(id, ratings); }
  const seasonsBySite = new Map<string, Record<string, number>>();
  for (const row of seasonsResult.results as Array<Record<string, unknown>>) { const id = String(row.site_id); const ratings = seasonsBySite.get(id) ?? {}; ratings[String(row.month_key)] = Number(row.rating); seasonsBySite.set(id, ratings); }
  const observationsByStay = new Map<string, Record<string, number>>();
  for (const row of observationsResult.results as Array<Record<string, unknown>>) { const id = String(row.stay_id); const ratings = observationsByStay.get(id) ?? {}; ratings[String(row.criterion_key)] = Number(row.rating); observationsByStay.set(id, ratings); }
  const criterionByProfile = new Map<string, Record<string, number>>();
  for (const row of criterionWeightsResult.results as Array<Record<string, unknown>>) { const id = String(row.profile_id); const weights = criterionByProfile.get(id) ?? {}; weights[String(row.criterion_key)] = Number(row.weight); criterionByProfile.set(id, weights); }
  const monthsByProfile = new Map<string, Record<string, number>>();
  for (const row of monthWeightsResult.results as Array<Record<string, unknown>>) { const id = String(row.profile_id); const weights = monthsByProfile.get(id) ?? {}; weights[String(row.month_key)] = Number(row.weight); monthsByProfile.set(id, weights); }

  return {
    sites: (sitesResult.results as Array<Record<string, unknown>>).map((row) => ({
      id: row.id, park: row.park, state: row.state, area: row.area ?? '', loop: row.loop, siteNumber: row.site_number,
      latitude: Number(row.latitude), longitude: Number(row.longitude), notes: row.notes,
      amenities: JSON.parse(String(row.amenities_json || '{}')), viewTypes: JSON.parse(String(row.view_types_json || '[]')),
      legacyStayCount: Number(row.legacy_stay_count || 0), importedRating: row.imported_rating === null ? undefined : Number(row.imported_rating),
      favorite: Boolean(row.favorite), status: row.status, currentFacts: factsBySite.get(String(row.id)) ?? {}, seasonalRatings: seasonsBySite.get(String(row.id)) ?? {},
    })),
    stays: (staysResult.results as Array<Record<string, unknown>>).map((row) => ({
      id: row.id, siteId: row.site_id, camperId: row.camper_id ?? undefined,
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
    parks: (parksResult.results as Array<Record<string, unknown>>).map((row) => ({
      id: row.id, name: row.name, state: row.state, checkInTime: row.check_in_time ?? undefined, checkOutTime: row.check_out_time ?? undefined, notes: row.notes ?? '',
    })),
    campers: (campersResult.results as Array<Record<string, unknown>>).map((row) => ({
      id: row.id, name: row.name, type: row.type,
      year: row.year === null ? undefined : Number(row.year), make: row.make ?? undefined, model: row.model ?? undefined,
      lengthFeet: row.length_feet === null ? undefined : Number(row.length_feet), sleeps: row.sleeps === null ? undefined : Number(row.sleeps),
      slideOuts: row.slide_outs === null ? undefined : Number(row.slide_outs), dryWeightLbs: row.dry_weight_lbs === null ? undefined : Number(row.dry_weight_lbs),
      gvwrLbs: row.gvwr_lbs === null ? undefined : Number(row.gvwr_lbs), tentStyle: row.tent_style ?? undefined, notes: row.notes ?? '',
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
  await db.prepare(`INSERT INTO sites (id,park,state,area,loop,site_number,latitude,longitude,notes,amenities_json,view_types_json,legacy_stay_count,imported_rating,favorite,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id, park, state, area, loop, siteNumber, latitude, longitude, String(body.notes || ''), JSON.stringify(body.amenities ?? {}), JSON.stringify(body.viewTypes ?? []), Number(body.legacyStayCount || 0), body.importedRating === undefined ? null : Number(body.importedRating), body.favorite ? 1 : 0, String(body.status || 'wishlist')).run();
  return json({ ok: true, id }, 201);
}

export async function updateSite(db: D1Database, id: string, body: JsonObject) {
  await ensureDiarySchema(db);
  await db.prepare(`UPDATE sites SET park=?,state=?,area=?,loop=?,site_number=?,latitude=?,longitude=?,notes=?,amenities_json=?,view_types_json=?,favorite=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .bind(body.park, body.state, body.area ?? '', body.loop, body.siteNumber, body.latitude, body.longitude, body.notes ?? '', JSON.stringify(body.amenities ?? {}), JSON.stringify(body.viewTypes ?? []), body.favorite ? 1 : 0, body.status ?? 'wishlist', id).run();
  return json({ ok: true });
}

export async function createCamper(db: D1Database, body: JsonObject) {
  await ensureDiarySchema(db);
  const id = String(body.id || crypto.randomUUID());
  const name = String(body.name || '').trim(); const type = String(body.type || '').trim();
  if (!name || !type) return error('Camper name and type are required.');
  await db.prepare(`INSERT INTO camper_profiles (id,name,type,year,make,model,length_feet,sleeps,slide_outs,dry_weight_lbs,gvwr_lbs,tent_style,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id, name, type, body.year ?? null, body.make ?? null, body.model ?? null, body.lengthFeet ?? null, body.sleeps ?? null, body.slideOuts ?? null, body.dryWeightLbs ?? null, body.gvwrLbs ?? null, body.tentStyle ?? null, String(body.notes || '')).run();
  return json({ ok: true, id }, 201);
}

export async function updateCamper(db: D1Database, id: string, body: JsonObject) {
  await ensureDiarySchema(db);
  const name = String(body.name || '').trim(); const type = String(body.type || '').trim();
  if (!name || !type) return error('Camper name and type are required.');
  const result = await db.prepare(`UPDATE camper_profiles SET name=?,type=?,year=?,make=?,model=?,length_feet=?,sleeps=?,slide_outs=?,dry_weight_lbs=?,gvwr_lbs=?,tent_style=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .bind(name, type, body.year ?? null, body.make ?? null, body.model ?? null, body.lengthFeet ?? null, body.sleeps ?? null, body.slideOuts ?? null, body.dryWeightLbs ?? null, body.gvwrLbs ?? null, body.tentStyle ?? null, String(body.notes || ''), id).run();
  if (!result.meta.changes) return error('Camper profile not found.', 404);
  return json({ ok: true, id });
}

export async function deleteCamper(db: D1Database, id: string) {
  await ensureDiarySchema(db);
  if (id === 'camper-tent') return error('The Tent Camping profile is kept available.', 409);
  await db.batch([db.prepare('UPDATE stays SET camper_id=NULL WHERE camper_id=?').bind(id), db.prepare('DELETE FROM camper_profiles WHERE id=?').bind(id)]);
  return json({ ok: true });
}

export async function updatePark(db: D1Database, id: string, body: JsonObject) {
  await ensureDiarySchema(db);
  const current = await db.prepare('SELECT * FROM park_profiles WHERE id=?').bind(id).first<Record<string, unknown>>();
  if (!current) return error('Park not found.', 404);
  const name = String(body.name ?? '').trim(); const state = String(body.state ?? '').trim() || 'Unknown';
  if (!name) return error('Park name is required.');
  const duplicate = await db.prepare('SELECT id FROM park_profiles WHERE LOWER(name)=LOWER(?) AND LOWER(state)=LOWER(?) AND id<>?').bind(name, state, id).first();
  if (duplicate) return error('A park with that name and state already exists.', 409);
  const oldName = String(current.name); const oldState = String(current.state);
  const stayRows = await db.prepare('SELECT id,site_snapshot_json FROM stays WHERE site_snapshot_json IS NOT NULL').all();
  const statements: D1PreparedStatement[] = [
    db.prepare(`UPDATE park_profiles SET name=?,state=?,check_in_time=?,check_out_time=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(name, state, body.checkInTime ? String(body.checkInTime) : null, body.checkOutTime ? String(body.checkOutTime) : null, String(body.notes ?? ''), id),
    db.prepare('UPDATE sites SET park=?,state=?,updated_at=CURRENT_TIMESTAMP WHERE LOWER(park)=LOWER(?) AND LOWER(state)=LOWER(?)').bind(name, state, oldName, oldState),
  ];
  for (const row of stayRows.results as Array<Record<string, unknown>>) {
    try { const snapshot = JSON.parse(String(row.site_snapshot_json)) as Record<string, unknown>; if (parkKey(snapshot.park, snapshot.state) !== parkKey(oldName, oldState)) continue; snapshot.park = name; snapshot.state = state; statements.push(db.prepare('UPDATE stays SET site_snapshot_json=? WHERE id=?').bind(JSON.stringify(snapshot), row.id)); }
    catch { /* leave malformed legacy snapshot untouched */ }
  }
  await db.batch(statements);
  return json({ ok: true, id });
}

function stayValues(body: JsonObject) {
  const siteId = String(body.siteId || ''); const arrivalDate = String(body.arrivalDate || ''); const departureDate = String(body.departureDate || ''); const nights = Number(body.nights || 0);
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
  const id = String(body.id || crypto.randomUUID()); const { siteId, arrivalDate, departureDate, nights } = stayValues(body);
  if (!siteId || !arrivalDate || !departureDate || nights < 1) return error('Site, dates, and at least one night are required.');
  const statements: D1PreparedStatement[] = [
    db.prepare(`INSERT INTO stays (id,site_id,camper_id,site_snapshot_json,arrival_date,departure_date,nights,nightly_rate,journal,weather,would_return,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(id, siteId, body.camperId ? String(body.camperId) : null, body.siteSnapshot ? JSON.stringify(body.siteSnapshot) : null, arrivalDate, departureDate, nights, body.nightlyRate === undefined ? null : Number(body.nightlyRate), String(body.journal || ''), body.weather ? String(body.weather) : null, body.wouldReturn === undefined ? null : body.wouldReturn ? 1 : 0, String(body.createdAt || new Date().toISOString())),
    db.prepare("UPDATE sites SET status='visited', updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(siteId),
    ...observationStatements(db, id, siteId, body),
  ];
  await db.batch(statements); await ensureParkProfiles(db);
  return json({ ok: true, id }, 201);
}

export async function updateStay(db: D1Database, id: string, body: JsonObject) {
  await ensureDiarySchema(db);
  const existing = await db.prepare('SELECT id FROM stays WHERE id=?').bind(id).first();
  if (!existing) return error('Diary entry not found.', 404);
  const { siteId, arrivalDate, departureDate, nights } = stayValues(body);
  if (!siteId || !arrivalDate || !departureDate || nights < 1) return error('Site, dates, and at least one night are required.');
  const statements: D1PreparedStatement[] = [
    db.prepare(`UPDATE stays SET site_id=?,camper_id=?,site_snapshot_json=?,arrival_date=?,departure_date=?,nights=?,nightly_rate=?,journal=?,weather=?,would_return=? WHERE id=?`)
      .bind(siteId, body.camperId ? String(body.camperId) : null, body.siteSnapshot ? JSON.stringify(body.siteSnapshot) : null, arrivalDate, departureDate, nights, body.nightlyRate === undefined ? null : Number(body.nightlyRate), String(body.journal || ''), body.weather ? String(body.weather) : null, body.wouldReturn === undefined ? null : body.wouldReturn ? 1 : 0, id),
    db.prepare('DELETE FROM stay_observations WHERE stay_id=?').bind(id),
    db.prepare("UPDATE sites SET status='visited', updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(siteId),
    ...observationStatements(db, id, siteId, body),
  ];
  await db.batch(statements); await ensureParkProfiles(db);
  return json({ ok: true, id });
}
