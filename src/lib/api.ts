import { seedState } from '../data/seed';
import type { AppState, Campsite, PreferenceProfile, Stay, StayDraft } from '../types';

const STORAGE_KEY = 'camp-ledger-state-v1';

function normalizeState(state: AppState): AppState {
  return {
    ...state,
    sites: state.sites.map((site) => ({
      ...site,
      // Older versions called wish-list records "saved". Convert them on load.
      status: String(site.status) === 'saved' ? 'wishlist' : site.status,
    })),
  };
}

function cloneSeed(): AppState {
  return normalizeState(structuredClone(seedState));
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

export async function createStayRemote(draft: StayDraft, stay: Stay): Promise<void> {
  await request('/api/stays', {
    method: 'POST',
    body: JSON.stringify({ ...draft, id: stay.id, createdAt: stay.createdAt }),
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
