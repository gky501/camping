interface Env {
  DB: D1Database;
}

type JsonObject = Record<string, unknown>;

const json = (data: unknown, status = 200) => Response.json(data, { status });
const error = (message: string, status = 400) => json({ error: message }, status);

function apiPath(request: Request): string[] {
  const pathname = new URL(request.url).pathname.replace(/^\/api\/?/, '');
  return pathname ? pathname.split('/').map(decodeURIComponent) : [];
}

async function bootstrap(db: D1Database) {
  const [sitesResult, factsResult, seasonsResult, staysResult, observationsResult, profilesResult, criterionWeightsResult, monthWeightsResult] = await Promise.all([
    db.prepare('SELECT * FROM sites ORDER BY park, loop, site_number').all(),
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
    const id = String(row.site_id);
    const facts = factsBySite.get(id) ?? {};
    facts[String(row.criterion_key)] = Number(row.rating);
    factsBySite.set(id, facts);
  }

  const seasonsBySite = new Map<string, Record<string, number>>();
  for (const row of seasonsResult.results as Array<Record<string, unknown>>) {
    const id = String(row.site_id);
    const ratings = seasonsBySite.get(id) ?? {};
    ratings[String(row.month_key)] = Number(row.rating);
    seasonsBySite.set(id, ratings);
  }

  const observationsByStay = new Map<string, Record<string, number>>();
  for (const row of observationsResult.results as Array<Record<string, unknown>>) {
    const id = String(row.stay_id);
    const ratings = observationsByStay.get(id) ?? {};
    ratings[String(row.criterion_key)] = Number(row.rating);
    observationsByStay.set(id, ratings);
  }

  const criterionByProfile = new Map<string, Record<string, number>>();
  for (const row of criterionWeightsResult.results as Array<Record<string, unknown>>) {
    const id = String(row.profile_id);
    const weights = criterionByProfile.get(id) ?? {};
    weights[String(row.criterion_key)] = Number(row.weight);
    criterionByProfile.set(id, weights);
  }

  const monthsByProfile = new Map<string, Record<string, number>>();
  for (const row of monthWeightsResult.results as Array<Record<string, unknown>>) {
    const id = String(row.profile_id);
    const weights = monthsByProfile.get(id) ?? {};
    weights[String(row.month_key)] = Number(row.weight);
    monthsByProfile.set(id, weights);
  }

  return {
    sites: (sitesResult.results as Array<Record<string, unknown>>).map((row) => ({
      id: row.id,
      park: row.park,
      state: row.state,
      loop: row.loop,
      siteNumber: row.site_number,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      notes: row.notes,
      viewTypes: JSON.parse(String(row.view_types_json || '[]')),
      legacyStayCount: Number(row.legacy_stay_count || 0),
      importedRating: row.imported_rating === null ? undefined : Number(row.imported_rating),
      favorite: Boolean(row.favorite),
      status: row.status,
      currentFacts: factsBySite.get(String(row.id)) ?? {},
      seasonalRatings: seasonsBySite.get(String(row.id)) ?? {},
    })),
    stays: (staysResult.results as Array<Record<string, unknown>>).map((row) => ({
      id: row.id,
      siteId: row.site_id,
      arrivalDate: row.arrival_date,
      departureDate: row.departure_date,
      nights: Number(row.nights),
      nightlyRate: row.nightly_rate === null ? undefined : Number(row.nightly_rate),
      journal: row.journal,
      weather: row.weather ?? undefined,
      wouldReturn: row.would_return === null ? undefined : Boolean(row.would_return),
      observations: observationsByStay.get(String(row.id)) ?? {},
      createdAt: row.created_at,
    })),
    profiles: (profilesResult.results as Array<Record<string, unknown>>).map((row) => ({
      id: row.id,
      name: row.name,
      siteQualityShare: Number(row.site_quality_share),
      seasonalShare: Number(row.seasonal_share),
      criterionWeights: criterionByProfile.get(String(row.id)) ?? {},
      monthWeights: monthsByProfile.get(String(row.id)) ?? {},
    })),
  };
}

async function saveStay(db: D1Database, body: JsonObject) {
  const id = String(body.id || crypto.randomUUID());
  const siteId = String(body.siteId || '');
  const arrivalDate = String(body.arrivalDate || '');
  const departureDate = String(body.departureDate || '');
  const nights = Number(body.nights || 0);
  if (!siteId || !arrivalDate || !departureDate || nights < 1) return error('Site, dates, and at least one night are required.');

  const observations = (body.observations ?? {}) as Record<string, number>;
  const updateCurrentKeys = Array.isArray(body.updateCurrentKeys) ? body.updateCurrentKeys.map(String) : [];
  const statements: D1PreparedStatement[] = [
    db.prepare(`INSERT INTO stays (id,site_id,arrival_date,departure_date,nights,nightly_rate,journal,weather,would_return,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(
        id, siteId, arrivalDate, departureDate, nights,
        body.nightlyRate === undefined ? null : Number(body.nightlyRate),
        String(body.journal || ''), body.weather ? String(body.weather) : null,
        body.wouldReturn === undefined ? null : body.wouldReturn ? 1 : 0,
        String(body.createdAt || new Date().toISOString()),
      ),
    db.prepare("UPDATE sites SET status='visited', updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(siteId),
  ];

  for (const [key, rawRating] of Object.entries(observations)) {
    const rating = Number(rawRating);
    if (!Number.isFinite(rating) || rating < 0 || rating > 5) continue;
    statements.push(db.prepare('INSERT OR REPLACE INTO stay_observations (stay_id,criterion_key,rating) VALUES (?,?,?)').bind(id, key, rating));
    if (updateCurrentKeys.includes(key)) {
      const prior = await db.prepare('SELECT rating FROM site_facts WHERE site_id=? AND criterion_key=?').bind(siteId, key).first<{ rating: number }>();
      statements.push(
        db.prepare('INSERT INTO site_fact_history (id,site_id,criterion_key,previous_rating,new_rating,changed_on,stay_id) VALUES (?,?,?,?,?,?,?)')
          .bind(crypto.randomUUID(), siteId, key, prior?.rating ?? null, rating, new Date().toISOString(), id),
        db.prepare(`INSERT INTO site_facts (site_id,criterion_key,rating,updated_at) VALUES (?,?,?,CURRENT_TIMESTAMP)
          ON CONFLICT(site_id,criterion_key) DO UPDATE SET rating=excluded.rating, updated_at=CURRENT_TIMESTAMP`).bind(siteId, key, rating),
      );
    }
  }

  await db.batch(statements);
  return json({ ok: true, id }, 201);
}

async function saveProfile(db: D1Database, id: string, body: JsonObject) {
  const criterionWeights = (body.criterionWeights ?? {}) as Record<string, number>;
  const monthWeights = (body.monthWeights ?? {}) as Record<string, number>;
  const statements: D1PreparedStatement[] = [
    db.prepare(`INSERT INTO preference_profiles (id,name,site_quality_share,seasonal_share,updated_at)
      VALUES (?,?,?,?,CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name, site_quality_share=excluded.site_quality_share,
      seasonal_share=excluded.seasonal_share, updated_at=CURRENT_TIMESTAMP`)
      .bind(id, String(body.name || 'Preference profile'), Number(body.siteQualityShare ?? 75), Number(body.seasonalShare ?? 25)),
    db.prepare('DELETE FROM profile_criterion_weights WHERE profile_id=?').bind(id),
    db.prepare('DELETE FROM profile_month_weights WHERE profile_id=?').bind(id),
  ];
  for (const [key, weight] of Object.entries(criterionWeights)) {
    statements.push(db.prepare('INSERT INTO profile_criterion_weights (profile_id,criterion_key,weight) VALUES (?,?,?)').bind(id, key, Number(weight)));
  }
  for (const [key, weight] of Object.entries(monthWeights)) {
    statements.push(db.prepare('INSERT INTO profile_month_weights (profile_id,month_key,weight) VALUES (?,?,?)').bind(id, key, Number(weight)));
  }
  await db.batch(statements);
  return json({ ok: true });
}

async function deleteProfile(db: D1Database, id: string) {
  const countRow = await db.prepare('SELECT COUNT(*) AS count FROM preference_profiles').first<{ count: number }>();
  if (Number(countRow?.count ?? 0) <= 1) return error('At least one preference profile is required.', 409);
  const result = await db.prepare('DELETE FROM preference_profiles WHERE id=?').bind(id).run();
  if (!result.meta.changes) return error('Preference profile not found.', 404);
  return json({ ok: true });
}

async function createSite(db: D1Database, body: JsonObject) {
  const id = String(body.id || crypto.randomUUID());
  const park = String(body.park || '').trim();
  const state = String(body.state || '').trim() || 'Unknown';
  const loop = String(body.loop || '').trim();
  const siteNumber = String(body.siteNumber || '').trim();
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  if (!park || !siteNumber || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return error('Campground, site number, latitude, and longitude are required.');
  }
  await db.prepare(`INSERT INTO sites (id,park,state,loop,site_number,latitude,longitude,notes,view_types_json,legacy_stay_count,imported_rating,favorite,status)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
      id, park, state, loop, siteNumber, latitude, longitude, String(body.notes || ''),
      JSON.stringify(body.viewTypes ?? []), Number(body.legacyStayCount || 0),
      body.importedRating === undefined ? null : Number(body.importedRating),
      body.favorite ? 1 : 0, String(body.status || 'wishlist'),
    ).run();
  return json({ ok: true, id }, 201);
}

async function saveSite(db: D1Database, id: string, body: JsonObject) {
  await db.prepare(`UPDATE sites SET park=?,state=?,loop=?,site_number=?,latitude=?,longitude=?,notes=?,view_types_json=?,favorite=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .bind(body.park, body.state, body.loop, body.siteNumber, body.latitude, body.longitude, body.notes ?? '', JSON.stringify(body.viewTypes ?? []), body.favorite ? 1 : 0, body.status ?? 'wishlist', id).run();
  return json({ ok: true });
}

export const onRequest: PagesFunction<Env> = async (context) => {
  if (!context.env.DB) return error('D1 binding DB is not configured.', 503);
  const path = apiPath(context.request);
  const method = context.request.method.toUpperCase();

  try {
    if (method === 'GET' && path[0] === 'bootstrap') return json(await bootstrap(context.env.DB));
    if (method === 'POST' && path[0] === 'stays') return await saveStay(context.env.DB, await context.request.json<JsonObject>());
    if (method === 'PATCH' && path[0] === 'profiles' && path[1]) return await saveProfile(context.env.DB, path[1], await context.request.json<JsonObject>());
    if (method === 'DELETE' && path[0] === 'profiles' && path[1]) return await deleteProfile(context.env.DB, path[1]);
    if (method === 'POST' && path[0] === 'sites' && !path[1]) return await createSite(context.env.DB, await context.request.json<JsonObject>());
    if (method === 'PATCH' && path[0] === 'sites' && path[1]) return await saveSite(context.env.DB, path[1], await context.request.json<JsonObject>());
    if (method === 'GET' && path[0] === 'export') return json(await bootstrap(context.env.DB));
    return error('Not found', 404);
  } catch (cause) {
    console.error(cause);
    return error(cause instanceof Error ? cause.message : 'Unexpected error', 500);
  }
};
