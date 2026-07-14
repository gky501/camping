import type { SiteAmenities } from '../types';

const labels = {
  electric: {
    '30amp': '30 amp electric',
    '50amp': '50 amp electric',
    none: 'No electric',
  },
  water: {
    yes: 'Water at site',
    partial: 'Shared/partial water',
    none: 'No water',
  },
  sewer: {
    site: 'Sewer at site',
    station: 'Dump station',
    none: 'No sewer',
  },
  wifi: {
    yes: 'Wi-Fi',
    no: 'No Wi-Fi',
  },
  surface: {
    asphalt: 'Asphalt pad',
    concrete: 'Concrete pad',
    gravel: 'Gravel pad',
    dirt: 'Dirt pad',
    grass: 'Grass pad',
  },
  entry: {
    'back-in': 'Back-in',
    'pull-through': 'Pull-through',
  },
  shade: {
    full: 'Full shade',
    partial: 'Partial shade',
    open: 'Open/no shade',
  },
  generator: {
    allowed: 'Generator allowed',
    restricted: 'Generator restricted',
    'not-allowed': 'No generators',
  },
  features: {
    'picnic-table': 'Picnic table',
    'fire-ring': 'Fire ring',
    grill: 'Grill',
    waterfront: 'Waterfront',
    'bathhouse-nearby': 'Bathhouse nearby',
  },
} as const;

export function summarizeAmenities(amenities?: SiteAmenities): string[] {
  if (!amenities) return [];
  const summary: string[] = [];
  if (amenities.electric) summary.push(labels.electric[amenities.electric]);
  if (amenities.water) summary.push(labels.water[amenities.water]);
  if (amenities.sewer) summary.push(labels.sewer[amenities.sewer]);
  if (amenities.wifi) summary.push(labels.wifi[amenities.wifi]);
  if (amenities.surface) summary.push(labels.surface[amenities.surface]);
  if (amenities.entry) summary.push(labels.entry[amenities.entry]);
  if (amenities.shade) summary.push(labels.shade[amenities.shade]);
  if (amenities.generator) summary.push(labels.generator[amenities.generator]);
  if (amenities.siteLengthFeet) summary.push(`${amenities.siteLengthFeet} ft site`);
  for (const feature of amenities.features ?? []) summary.push(labels.features[feature]);
  return summary;
}

export function amenitiesMatch(left?: SiteAmenities, right?: SiteAmenities): boolean {
  const normalize = (value?: SiteAmenities) => ({
    ...(value ?? {}),
    features: [...(value?.features ?? [])].sort(),
  });
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}
