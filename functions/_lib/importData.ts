import type { Env } from './diary';

interface RatingMap { [key: string]: number | undefined }
interface SiteAmenities { [key: string]: unknown }
interface SiteLocation {
  park: string;
  state: string;
  area?: string;
  loop: string;
  siteNumber: string;
  latitude: number;
  longitude: number;
}
interface Campsite extends SiteLocation {
  id: string;
  notes?: string;
  amenities?: SiteAmenities;
  viewTypes?: string[];
  currentFacts?: RatingMap;
  seasonalRatings?: RatingMap;
  legacyStayCount?: number;
  importedRating?: number;
  favorite?: boolean;
  status?: string;
}
interface Stay {
  id: string;
  siteId: string;
  camperId?: string;
  siteSnapshot?: SiteLocation & { amenities?: SiteAmenities };
  arrivalDate: string;
  departureDate: string;
  nights: number;
  nightlyRate?: number;
  journal?: string;
  weather?: string;
  wouldReturn?: boolean;
  observations?: RatingMap;
  createdAt?: string;
}
interface PreferenceProfile {
  id: string;
  name: string;
  criterionWeights?: RatingMap;
  monthWeights?: RatingMap;
  siteQualityShare?: number;
  seasonalShare?: number;
}
interface ParkProfile {
  id: string;
  name: string;
  state: string;
  checkInTime?: string;
  checkOutTime?: string;
  notes?: string;
}
interface CamperProfile {
  id: string;
  name: string;
  type: string;
  year?: number;
  make?: string;
  model?: string;
  lengthFeet?: number;
  sleeps?: number;
  slideOuts?: number;
  dryWeightLbs?: number;
  gvwrLbs?: number;
  tentStyle?: string;
  notes?: string;
}
interface BackupState {
  sites: Campsite[];
  stays: Stay[];
  profiles: PreferenceProfile[];
  parks?: ParkProfile[];
  campers?: CamperProfile[];
}

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS sites (
    id TEXT PRIMARY KEY,
    park TEXT NOT NULL,
    state TEXT NOT NULL,
    area TEXT NOT NULL DEFAULT '',
    loop TEXT NOT NULL DEFAULT '',
    site_number TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    amenities_json TEXT NOT NULL DEFAULT '{}',
    view_types_json TEXT NOT NULL DEFAULT '[]',
    legacy_stay_count INTEGER NOT NULL DEFAULT 0,
    imported_rating REAL,
    favorite INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'wishlist',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS site_facts (
    site_id TEXT NOT NULL,
    criterion_key TEXT NOT NULL,
    rating REAL NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (site_id, criterion_key)
  )`,
  `CREATE TABLE IF NOT EXISTS site_seasonal_ratings (
    site_id TEXT NOT NULL,
    month_key TEXT NOT NULL,
    rating REAL NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (site_id, month_key)
  )`,
  `CREATE TABLE IF NOT EXISTS stays (
    id TEXT PRIMARY KEY,
    site_id TEXT NOT NULL,
    camper_id TEXT,
    site_snapshot_json TEXT,
    arrival_date TEXT NOT NULL,
    departure_date TEXT NOT NULL,
    nights INTEGER NOT NULL,
    nightly_rate REAL,
    journal TEXT NOT NULL DEFAULT '',
    weather TEXT,
    would_return INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS stay_observations (
    stay_id TEXT NOT NULL,
    criterion_key TEXT NOT NULL,
    rating REAL NOT NULL,
    PRIMARY KEY (stay_id, criterion_key)
  )`,
  `CREATE TABLE IF NOT EXISTS site_fact_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id TEXT NOT NULL,
    stay_id TEXT,
    criterion_key TEXT NOT NULL,
    rating REAL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS preference_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    site_quality_share REAL NOT NULL DEFAULT 0.7,
    seasonal_share REAL NOT NULL DEFAULT 0.3,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS profile_criterion_weights (
    profile_id TEXT NOT NULL,
    criterion_key TEXT NOT NULL,
    weight REAL NOT NULL,
    PRIMARY KEY (profile_id, criterion_key)
  )`,
  `CREATE TABLE IF NOT EXISTS profile_month_weights (
    profile_id TEXT NOT NULL,
    month_key TEXT NOT NULL,
    weight REAL NOT NULL,
    PRIMARY KEY (profile_id, month_key)
  )`,
  `CREATE TABLE IF NOT EXISTS park_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    state TEXT NOT NULL,
    check_in_time TEXT,
    check_out_time TEXT,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, state)
  )`,
  `CREATE TABLE IF NOT EXISTS camper_profiles (
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
  )`,
];

function isBackupState(value: unknown): value is BackupState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<BackupState>;
  return Array.isArray(state.sites) && Array.isArray(state.stays) && Array.isArray(state.profiles);
}

function finite(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function runChunks(db: D1Database, statements: D1PreparedStatement[], size = 75) {
  for (let index = 0; index < statements.length; index += size) {
    await db.batch(statements.slice(index, index + size));
  }
}

async function initializeSchema(db: D1Database) {
  for (const sql of schemaStatements) await db.prepare(sql).run();
}

function normalizedParks(state: BackupState): ParkProfile[] {
  const parks = new Map<string, ParkProfile>();
  const keyOf = (name: string, region: string) => `${name.trim().toLowerCase()}::${region.trim().toLowerCase()}`;
  for (const park of state.parks ?? []) {
    if (!park?.name?.trim()) continue;
    parks.set(keyOf(park.name, park.state || 'Unknown'), { ...park, state: park.state || 'Unknown' });
  }
  const sites = new Map(state.sites.map((site) => [site.id, site]));
  for (const stay of state.stays) {
    const location = stay.siteSnapshot ?? sites.get(stay.siteId);
    if (!location?.park?.trim()) continue;
    const region = location.state?.trim() || 'Unknown';
    const key = keyOf(location.park, region);
    if (!parks.has(key)) parks.set(key, { id: `park-${crypto.randomUUID()}`, name: location.park.trim(), state: region, notes: '' });
  }
  return [...parks.values()];
}

export async function importBackup(env: Env, value: unknown): Promise<Response> {
  if (!env.DB) return Response.json({ error: 'D1 binding DB is not configured.' }, { status: 503 });
  if (!isBackupState(value)) return Response.json({ error: 'That file is not a valid Camp Ledger backup.' }, { status: 400 });

  const state = value;
  await initializeSchema(env.DB);

  await env.DB.batch([
    env.DB.prepare('DELETE FROM stay_observations'),
    env.DB.prepare('DELETE FROM site_fact_history'),
    env.DB.prepare('DELETE FROM stays'),
    env.DB.prepare('DELETE FROM site_facts'),
    env.DB.prepare('DELETE FROM site_seasonal_ratings'),
    env.DB.prepare('DELETE FROM sites'),
    env.DB.prepare('DELETE FROM profile_criterion_weights'),
    env.DB.prepare('DELETE FROM profile_month_weights'),
    env.DB.prepare('DELETE FROM preference_profiles'),
    env.DB.prepare('DELETE FROM park_profiles'),
    env.DB.prepare('DELETE FROM camper_profiles'),
  ]);

  const statements: D1PreparedStatement[] = [];

  for (const site of state.sites) {
    if (!site?.id || !site.park?.trim() || !site.siteNumber?.trim()) continue;
    const latitude = finite(site.latitude); const longitude = finite(site.longitude);
    if (latitude === null || longitude === null) continue;
    statements.push(env.DB.prepare(`INSERT INTO sites
      (id,park,state,area,loop,site_number,latitude,longitude,notes,amenities_json,view_types_json,legacy_stay_count,imported_rating,favorite,status)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
        site.id, site.park.trim(), site.state?.trim() || 'Unknown', site.area?.trim() || '', site.loop?.trim() || '', site.siteNumber.trim(),
        latitude, longitude, site.notes ?? '', JSON.stringify(site.amenities ?? {}), JSON.stringify(site.viewTypes ?? []),
        Number(site.legacyStayCount ?? 0), site.importedRating === undefined ? null : finite(site.importedRating), site.favorite ? 1 : 0,
        site.status === 'saved' ? 'wishlist' : (site.status ?? 'wishlist'),
      ));
    for (const [key, ratingValue] of Object.entries(site.currentFacts ?? {})) {
      const rating = finite(ratingValue); if (rating !== null) statements.push(env.DB.prepare('INSERT INTO site_facts (site_id,criterion_key,rating) VALUES (?,?,?)').bind(site.id, key, rating));
    }
    for (const [key, ratingValue] of Object.entries(site.seasonalRatings ?? {})) {
      const rating = finite(ratingValue); if (rating !== null) statements.push(env.DB.prepare('INSERT INTO site_seasonal_ratings (site_id,month_key,rating) VALUES (?,?,?)').bind(site.id, key, rating));
    }
  }

  for (const profile of state.profiles) {
    if (!profile?.id || !profile.name?.trim()) continue;
    statements.push(env.DB.prepare('INSERT INTO preference_profiles (id,name,site_quality_share,seasonal_share) VALUES (?,?,?,?)').bind(
      profile.id, profile.name.trim(), finite(profile.siteQualityShare) ?? 0.7, finite(profile.seasonalShare) ?? 0.3,
    ));
    for (const [key, weightValue] of Object.entries(profile.criterionWeights ?? {})) {
      const weight = finite(weightValue); if (weight !== null) statements.push(env.DB.prepare('INSERT INTO profile_criterion_weights (profile_id,criterion_key,weight) VALUES (?,?,?)').bind(profile.id, key, weight));
    }
    for (const [key, weightValue] of Object.entries(profile.monthWeights ?? {})) {
      const weight = finite(weightValue); if (weight !== null) statements.push(env.DB.prepare('INSERT INTO profile_month_weights (profile_id,month_key,weight) VALUES (?,?,?)').bind(profile.id, key, weight));
    }
  }

  const campers = [...(state.campers ?? [])];
  if (!campers.some((camper) => camper.id === 'camper-tent' || camper.type === 'tent')) campers.push({ id: 'camper-tent', name: 'Tent Camping', type: 'tent', notes: '' });
  for (const camper of campers) {
    if (!camper?.id || !camper.name?.trim() || !camper.type?.trim()) continue;
    statements.push(env.DB.prepare(`INSERT INTO camper_profiles
      (id,name,type,year,make,model,length_feet,sleeps,slide_outs,dry_weight_lbs,gvwr_lbs,tent_style,notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
        camper.id, camper.name.trim(), camper.type, camper.year ?? null, camper.make ?? null, camper.model ?? null,
        camper.lengthFeet ?? null, camper.sleeps ?? null, camper.slideOuts ?? null, camper.dryWeightLbs ?? null,
        camper.gvwrLbs ?? null, camper.tentStyle ?? null, camper.notes ?? '',
      ));
  }

  for (const park of normalizedParks(state)) {
    statements.push(env.DB.prepare('INSERT OR IGNORE INTO park_profiles (id,name,state,check_in_time,check_out_time,notes) VALUES (?,?,?,?,?,?)').bind(
      park.id || `park-${crypto.randomUUID()}`, park.name.trim(), park.state?.trim() || 'Unknown', park.checkInTime ?? null, park.checkOutTime ?? null, park.notes ?? '',
    ));
  }

  const knownSiteIds = new Set(state.sites.map((site) => site.id));
  for (const stay of state.stays) {
    if (!stay?.id || !knownSiteIds.has(stay.siteId) || !stay.arrivalDate || !stay.departureDate || Number(stay.nights) < 1) continue;
    statements.push(env.DB.prepare(`INSERT INTO stays
      (id,site_id,camper_id,site_snapshot_json,arrival_date,departure_date,nights,nightly_rate,journal,weather,would_return,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
        stay.id, stay.siteId, stay.camperId ?? null, stay.siteSnapshot ? JSON.stringify(stay.siteSnapshot) : null,
        stay.arrivalDate, stay.departureDate, Number(stay.nights), stay.nightlyRate ?? null, stay.journal ?? '',
        stay.weather ?? null, stay.wouldReturn === undefined ? null : stay.wouldReturn ? 1 : 0, stay.createdAt ?? new Date().toISOString(),
      ));
    for (const [key, ratingValue] of Object.entries(stay.observations ?? {})) {
      const rating = finite(ratingValue); if (rating !== null) statements.push(env.DB.prepare('INSERT INTO stay_observations (stay_id,criterion_key,rating) VALUES (?,?,?)').bind(stay.id, key, rating));
    }
  }

  await runChunks(env.DB, statements);

  return Response.json({
    ok: true,
    counts: {
      sites: state.sites.length,
      stays: state.stays.length,
      profiles: state.profiles.length,
      parks: normalizedParks(state).length,
      campers: campers.length,
    },
  });
}
