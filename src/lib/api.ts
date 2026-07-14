import { seedState } from '../data/seed';
import { mergeParkProfiles } from './parks';
import type { AppState, Campsite, ParkProfile, PreferenceProfile, Stay, StayDraft } from '../types';

const STORAGE_KEY = 'camp-ledger-state-v2-wishlist-only';

function normalizeState(state: AppState): AppState {
  const sites = state.sites.map((site) => {
    const splitCrystalSprings = site.id === 'lake-ouachita-crystal-springs-c-55' && !site.area && site.loop === 'Crystal Springs C';
    return {
      ...site,
      // Older versions called wish-list records "saved". Convert them on load.
      status: String(site.status) === 'saved' ? 'wishlist' as const : site.status,
      area: splitCrystalSprings ? 'Crystal Springs' : (site.area ?? ''),
      loop: splitCrystalSprings ? 'C' : site.loop,
      amenities: {
        ...(site.amenities ?? {}),
        features: site.amenities?.features ?? [],
      },
      // Imported spreadsheet stay counts were intentionally cleared; dated diary entries are the source of truth.
      legacyStayCount: 0,
    };
  });
  const stays = state.stays ?? [];
  return {
    ...state,
    sites,
    stays,
    parks: mergeParkProfiles(state.parks, sites, stays),
  };
}

function cloneSeed(): AppState {
  const cloned = normalizeState(structuredClone(seedState));
  return {
    ...cloned,
    sites: cloned.sites.filter((site) => site.status === 'wishlist'),
    stays: [],
    parks: [],
  };
}

function readLocal(): AppState | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? normalizeState(JSON.parse(stored) as AppState) : null;
  } catch {
    return null;
  }
}

export function persistLocal(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export async function loadAppState(): Promise<{ state: AppState; mode: 'cloud' | 'local' }> {
  try {
    const response = await fetch('/api/bootstrap', { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Bootstrap failed: ${response.status}`);
    const state = normalizeState((await response.json()) as AppState);
    persistLocal(state);
    return { state, mode: 'cloud' };
  } catch {
    const local = readLocal();
    const state = local ?? cloneSeed();
    persistLocal(state);
    return { state, mode: 'local' };
  }
}

async function request(path: string, init: RequestInit): Promise<void> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw new Error(message || `Request failed: ${response.status}`);
  }
}

function stayPayload(draft: StayDraft, stay: Stay) {
  return {
    id: stay.id,
    siteId: draft.siteId,
    siteSnapshot: draft.siteSnapshot,
    arrivalDate: draft.arrivalDate,
    departureDate: draft.departureDate,
    nights: draft.nights,
    nightlyRate: draft.nightlyRate,
    journal: draft.journal,
    weather: draft.weather,
    wouldReturn: draft.wouldReturn,
    observations: draft.observations,
    updateCurrentKeys: draft.updateCurrentKeys,
    createdAt: stay.createdAt,
  };
}

export async function createStayRemote(draft: StayDraft, stay: Stay): Promise<void> {
  await request('/api/stays', {
    method: 'POST',
    body: JSON.stringify(stayPayload(draft, stay)),
  });
}

export async function updateStayRemote(draft: StayDraft, stay: Stay): Promise<void> {
  await request(`/api/stays/${encodeURIComponent(stay.id)}`, {
    method: 'PATCH',
    body: JSON.stringify(stayPayload(draft, stay)),
  });
}

export async function saveParkRemote(original: ParkProfile, park: ParkProfile): Promise<void> {
  await request(`/api/parks/${encodeURIComponent(original.id)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      ...park,
      originalName: original.name,
      originalState: original.state,
    }),
  });
}

export async function saveProfileRemote(profile: PreferenceProfile): Promise<void> {
  await request(`/api/profiles/${encodeURIComponent(profile.id)}`, {
    method: 'PATCH',
    body: JSON.stringify(profile),
  });
}

export async function deleteProfileRemote(profileId: string): Promise<void> {
  await request(`/api/profiles/${encodeURIComponent(profileId)}`, { method: 'DELETE' });
}

export async function createSiteRemote(site: Campsite): Promise<void> {
  await request('/api/sites', {
    method: 'POST',
    body: JSON.stringify(site),
  });
}

export async function saveSiteRemote(site: Campsite): Promise<void> {
  await request(`/api/sites/${encodeURIComponent(site.id)}`, {
    method: 'PATCH',
    body: JSON.stringify(site),
  });
}

export async function deleteSiteRemote(siteId: string): Promise<void> {
  await request(`/api/sites/${encodeURIComponent(siteId)}`, { method: 'DELETE' });
}
