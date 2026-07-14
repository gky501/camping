import type { CamperProfile, CamperType } from '../types';

export const CAMPER_TYPES: Array<{ value: CamperType; label: string }> = [
  { value: 'travel-trailer', label: 'Travel trailer' },
  { value: 'fifth-wheel', label: 'Fifth wheel' },
  { value: 'motorhome', label: 'Motorhome' },
  { value: 'popup', label: 'Pop-up camper' },
  { value: 'truck-camper', label: 'Truck camper' },
  { value: 'van', label: 'Camper van' },
  { value: 'tent', label: 'Tent camping' },
  { value: 'other', label: 'Other setup' },
];

export const DEFAULT_TENT_PROFILE: CamperProfile = {
  id: 'camper-tent',
  name: 'Tent Camping',
  type: 'tent',
  notes: '',
};

export function camperTypeLabel(type: CamperType): string {
  return CAMPER_TYPES.find((item) => item.value === type)?.label ?? 'Camping setup';
}

export function camperSubtitle(camper: CamperProfile): string {
  if (camper.type === 'tent') return [camper.make, camper.model, camper.tentStyle].filter(Boolean).join(' · ') || 'Tent setup';
  return [camper.year, camper.make, camper.model].filter(Boolean).join(' ') || camperTypeLabel(camper.type);
}
