import type { Campsite, ParkProfile, SiteLocation, Stay } from '../types';

function normalizeText(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

export function parkIdentity(name: string, state: string): string {
  return `${normalizeText(name)}::${normalizeText(state)}`;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'park';
}

export function parkProfileId(name: string, state: string): string {
  return `park-${slug(name)}-${slug(state)}`;
}

export function locationMatchesPark(location: Pick<SiteLocation, 'park' | 'state'> | undefined, park: ParkProfile): boolean {
  if (!location) return false;
  return parkIdentity(location.park, location.state) === parkIdentity(park.name, park.state);
}

export function siteMatchesPark(site: Campsite, park: ParkProfile): boolean {
  return locationMatchesPark(site, park);
}

export function stayLocation(stay: Stay, sites: Campsite[]): SiteLocation | undefined {
  return stay.siteSnapshot ?? sites.find((site) => site.id === stay.siteId);
}

export function mergeParkProfiles(
  existing: ParkProfile[] | undefined,
  sites: Campsite[],
  stays: Stay[],
): ParkProfile[] {
  const profiles = [...(existing ?? [])];
  const known = new Map(profiles.map((park) => [parkIdentity(park.name, park.state), park]));

  for (const stay of stays) {
    const location = stayLocation(stay, sites);
    if (!location?.park.trim()) continue;
    const key = parkIdentity(location.park, location.state);
    if (known.has(key)) continue;
    const park: ParkProfile = {
      id: parkProfileId(location.park, location.state),
      name: location.park.trim(),
      state: location.state.trim() || 'Unknown',
      notes: '',
    };
    known.set(key, park);
    profiles.push(park);
  }

  return profiles.sort((a, b) => a.name.localeCompare(b.name) || a.state.localeCompare(b.state));
}

export function renameParkRecords(
  sites: Campsite[],
  stays: Stay[],
  original: ParkProfile,
  updated: ParkProfile,
): { sites: Campsite[]; stays: Stay[] } {
  const sitesNext = sites.map((site) => (
    siteMatchesPark(site, original)
      ? { ...site, park: updated.name, state: updated.state }
      : site
  ));

  const staysNext = stays.map((stay) => {
    if (!locationMatchesPark(stay.siteSnapshot, original) || !stay.siteSnapshot) return stay;
    return {
      ...stay,
      siteSnapshot: {
        ...stay.siteSnapshot,
        park: updated.name,
        state: updated.state,
      },
    };
  });

  return { sites: sitesNext, stays: staysNext };
}
