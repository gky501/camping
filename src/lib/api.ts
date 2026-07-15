import { seedState } from '../data/seed';
import { DEFAULT_TENT_PROFILE } from './campers';
import { DEFAULT_CHECKLIST_TEMPLATE } from './checklistDefaults';
import { DEFAULT_EQUIPMENT_INVENTORY, normalizeEquipmentInventory } from './equipment';
import { DEFAULT_HOME_BASE } from './geo';
import { mergeParkProfiles } from './parks';
import { normalizeTripDetails } from './tripDashboard';
import type { AppState, CamperProfile, Campsite, ChecklistTemplate, EquipmentInventory, HomeBase, ParkProfile, PreferenceProfile, Stay, StayDraft, TripChecklist, TripDetailsMap, TripPhoto } from '../types';

const STORAGE_KEY = 'camp-ledger-state-v2-wishlist-only';

function normalizeState(state: AppState): AppState {
  const sites = state.sites.map((site) => {
    const splitCrystalSprings = site.id === 'lake-ouachita-crystal-springs-c-55' && !site.area && site.loop === 'Crystal Springs C';
    return {
      ...site,
      status: String(site.status) === 'saved' ? 'wishlist' as const : site.status,
      area: splitCrystalSprings ? 'Crystal Springs' : (site.area ?? ''),
      loop: splitCrystalSprings ? 'C' : site.loop,
      amenities: { ...(site.amenities ?? {}), features: site.amenities?.features ?? [] },
      legacyStayCount: 0,
    };
  });
  const stays = state.stays ?? [];
  const campers = [...(state.campers ?? [])];
  if (!campers.some((camper) => camper.id === DEFAULT_TENT_PROFILE.id || camper.type === 'tent')) campers.push(DEFAULT_TENT_PROFILE);
  return {
    ...state,
    sites,
    stays,
    campers,
    parks: mergeParkProfiles(state.parks, sites, stays),
    checklistTemplate: state.checklistTemplate ?? structuredClone(DEFAULT_CHECKLIST_TEMPLATE),
    tripChecklists: state.tripChecklists ?? [],
    equipmentInventory: normalizeEquipmentInventory(state.equipmentInventory ?? DEFAULT_EQUIPMENT_INVENTORY),
    homeBase: state.homeBase ?? DEFAULT_HOME_BASE,
    tripDetails: normalizeTripDetails(state.tripDetails),
  };
}

function cloneSeed(): AppState {
  const cloned = normalizeState(structuredClone(seedState));
  return {
    ...cloned,
    sites: cloned.sites.filter((site) => site.status === 'wishlist'),
    stays: [],
    parks: [],
    campers: [DEFAULT_TENT_PROFILE],
    checklistTemplate: structuredClone(DEFAULT_CHECKLIST_TEMPLATE),
    tripChecklists: [],
    equipmentInventory: structuredClone(DEFAULT_EQUIPMENT_INVENTORY),
    homeBase: DEFAULT_HOME_BASE,
    tripDetails: {},
  };
}

function readLocal(): AppState | null {
  try { const stored = localStorage.getItem(STORAGE_KEY); return stored ? normalizeState(JSON.parse(stored) as AppState) : null; }
  catch { return null; }
}

export function persistLocal(state: AppState): void { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

export async function loadAppState(): Promise<{ state: AppState; mode: 'cloud' | 'local' }> {
  try {
    const response = await fetch('/api/bootstrap', { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Bootstrap failed: ${response.status}`);
    const rawState = (await response.json()) as AppState;
    try {
      const [equipmentResponse, tripDetailsResponse] = await Promise.all([
        fetch('/api/settings/equipment', { headers: { Accept: 'application/json' } }),
        fetch('/api/settings/trip-details', { headers: { Accept: 'application/json' } }),
      ]);
      if (equipmentResponse.ok) rawState.equipmentInventory = await equipmentResponse.json() as EquipmentInventory;
      if (tripDetailsResponse.ok) rawState.tripDetails = await tripDetailsResponse.json() as TripDetailsMap;
    } catch { /* settings fall back to local/default values */ }
    const state = normalizeState(rawState);
    persistLocal(state);
    return { state, mode: 'cloud' };
  } catch {
    const state = readLocal() ?? cloneSeed();
    persistLocal(state);
    return { state, mode: 'local' };
  }
}

async function request(path: string, init: RequestInit): Promise<void> {
  const response = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) } });
  if (!response.ok) { const message = await response.text().catch(() => ''); throw new Error(message || `Request failed: ${response.status}`); }
}

function stayPayload(draft: StayDraft, stay: Stay) {
  return {
    id: stay.id,
    siteId: draft.siteId,
    camperId: draft.camperId,
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

export async function createStayRemote(draft: StayDraft, stay: Stay): Promise<void> { await request('/api/stays', { method: 'POST', body: JSON.stringify(stayPayload(draft, stay)) }); }
export async function updateStayRemote(draft: StayDraft, stay: Stay): Promise<void> { await request(`/api/stays/${encodeURIComponent(stay.id)}`, { method: 'PATCH', body: JSON.stringify(stayPayload(draft, stay)) }); }
export async function deleteStayRemote(stayId: string, deleteOrphanSite: boolean): Promise<void> {
  const query = deleteOrphanSite ? '?deleteOrphanSite=true' : '';
  await request(`/api/stays/${encodeURIComponent(stayId)}${query}`, { method: 'DELETE' });
}

export async function createCamperRemote(camper: CamperProfile): Promise<void> { await request('/api/campers', { method: 'POST', body: JSON.stringify(camper) }); }
export async function saveCamperRemote(camper: CamperProfile): Promise<void> { await request(`/api/campers/${encodeURIComponent(camper.id)}`, { method: 'PATCH', body: JSON.stringify(camper) }); }
export async function deleteCamperRemote(camperId: string): Promise<void> { await request(`/api/campers/${encodeURIComponent(camperId)}`, { method: 'DELETE' }); }

export async function saveParkRemote(original: ParkProfile, park: ParkProfile): Promise<void> {
  await request('/api/parks/by-name', { method: 'PATCH', body: JSON.stringify({ ...park, originalName: original.name, originalState: original.state }) });
}
export async function saveProfileRemote(profile: PreferenceProfile): Promise<void> { await request(`/api/profiles/${encodeURIComponent(profile.id)}`, { method: 'PATCH', body: JSON.stringify(profile) }); }
export async function deleteProfileRemote(profileId: string): Promise<void> { await request(`/api/profiles/${encodeURIComponent(profileId)}`, { method: 'DELETE' }); }
export async function createSiteRemote(site: Campsite): Promise<void> { await request('/api/sites', { method: 'POST', body: JSON.stringify(site) }); }
export async function saveSiteRemote(site: Campsite): Promise<void> { await request(`/api/sites/${encodeURIComponent(site.id)}`, { method: 'PATCH', body: JSON.stringify(site) }); }
export async function deleteSiteRemote(siteId: string): Promise<void> { await request(`/api/sites/${encodeURIComponent(siteId)}`, { method: 'DELETE' }); }

export async function saveChecklistTemplateRemote(template: ChecklistTemplate): Promise<void> {
  await request('/api/checklists/template', { method: 'PUT', body: JSON.stringify(template) });
}

export async function saveTripChecklistRemote(checklist: TripChecklist): Promise<void> {
  await request(`/api/checklists/trips/${encodeURIComponent(checklist.stayId)}`, { method: 'PUT', body: JSON.stringify(checklist) });
}

export async function saveEquipmentInventoryRemote(inventory: EquipmentInventory): Promise<void> {
  await request('/api/settings/equipment', { method: 'PUT', body: JSON.stringify(inventory) });
}

export async function saveHomeBaseRemote(homeBase: HomeBase): Promise<void> {
  await request('/api/settings/home-base', { method: 'PUT', body: JSON.stringify(homeBase) });
}

export async function saveTripDetailsRemote(tripDetails: TripDetailsMap): Promise<void> {
  await request('/api/settings/trip-details', { method: 'PUT', body: JSON.stringify(tripDetails) });
}

export async function uploadTripPhotoRemote(stayId: string, file: File): Promise<TripPhoto> {
  const form = new FormData();
  form.set('stayId', stayId);
  form.set('photo', file);
  const response = await fetch('/api/photos', { method: 'POST', body: form });
  const result = await response.json().catch(() => ({})) as TripPhoto & { error?: string };
  if (!response.ok) throw new Error(result.error || `Photo upload failed: ${response.status}`);
  return result;
}

export async function deleteTripPhotoRemote(key: string): Promise<void> {
  const response = await fetch(`/api/photos?key=${encodeURIComponent(key)}`, { method: 'DELETE' });
  const result = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(result.error || `Photo delete failed: ${response.status}`);
}
