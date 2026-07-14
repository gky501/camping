export const MONTHS = [
  { key: 'jan', label: 'January', short: 'JAN' },
  { key: 'feb', label: 'February', short: 'FEB' },
  { key: 'mar', label: 'March', short: 'MAR' },
  { key: 'apr', label: 'April', short: 'APR' },
  { key: 'may', label: 'May', short: 'MAY' },
  { key: 'jun', label: 'June', short: 'JUN' },
  { key: 'jul', label: 'July', short: 'JUL' },
  { key: 'aug', label: 'August', short: 'AUG' },
  { key: 'sep', label: 'September', short: 'SEP' },
  { key: 'oct', label: 'October', short: 'OCT' },
  { key: 'nov', label: 'November', short: 'NOV' },
  { key: 'dec', label: 'December', short: 'DEC' },
] as const;

export const CRITERIA = [
  { key: 'levelness', label: 'Levelness', hint: 'How easy the camper is to level' },
  { key: 'seatingArea', label: 'Seating area', hint: 'Usable outdoor living space' },
  { key: 'cellReception', label: 'Cell reception', hint: 'Calling, data, and hotspot usefulness' },
  { key: 'view', label: 'View', hint: 'Scenery from the campsite' },
  { key: 'privacy', label: 'Privacy', hint: 'Separation from neighbors and traffic' },
  { key: 'windBreak', label: 'Wind break', hint: 'Protection from wind and exposure' },
  { key: 'treeCover', label: 'Tree cover', hint: 'Shade and canopy around the site' },
  { key: 'pets', label: 'Pets walk/run', hint: 'Room and comfort for the dogs' },
  { key: 'rainWater', label: 'Rainwater drainage', hint: 'How well water drains after rain' },
] as const;

export type MonthKey = (typeof MONTHS)[number]['key'];
export type CriterionKey = (typeof CRITERIA)[number]['key'];
export type RatingMap = Partial<Record<CriterionKey, number>>;
export type MonthRatingMap = Partial<Record<MonthKey, number>>;
export type CampsiteStatus = 'visited' | 'wishlist' | 'avoid' | 'reserved' | 'saved';

export type ElectricService = '30amp' | '50amp' | 'none';
export type WaterService = 'yes' | 'partial' | 'none';
export type SewerService = 'site' | 'station' | 'none';
export type YesNo = 'yes' | 'no';
export type ParkingSurface = 'asphalt' | 'concrete' | 'gravel' | 'dirt' | 'grass';
export type ParkingEntry = 'back-in' | 'pull-through';
export type ShadeLevel = 'full' | 'partial' | 'open';
export type GeneratorPolicy = 'allowed' | 'restricted' | 'not-allowed';
export type SiteFeature = 'picnic-table' | 'fire-ring' | 'grill' | 'waterfront' | 'bathhouse-nearby';

export interface SiteAmenities {
  electric?: ElectricService;
  water?: WaterService;
  sewer?: SewerService;
  wifi?: YesNo;
  surface?: ParkingSurface;
  entry?: ParkingEntry;
  shade?: ShadeLevel;
  generator?: GeneratorPolicy;
  siteLengthFeet?: number;
  features?: SiteFeature[];
}

export interface SiteLocation {
  park: string;
  state: string;
  area?: string;
  loop: string;
  siteNumber: string;
  latitude: number;
  longitude: number;
}

export interface SiteSnapshot extends SiteLocation {
  amenities?: SiteAmenities;
}

export interface Campsite extends SiteLocation {
  id: string;
  notes: string;
  amenities?: SiteAmenities;
  viewTypes: string[];
  currentFacts: RatingMap;
  seasonalRatings: MonthRatingMap;
  legacyStayCount: number;
  importedRating?: number;
  favorite?: boolean;
  status?: CampsiteStatus;
}

export interface WishlistSiteDraft extends SiteLocation {
  notes: string;
  amenities: SiteAmenities;
}

export type CamperType = 'travel-trailer' | 'fifth-wheel' | 'motorhome' | 'popup' | 'truck-camper' | 'van' | 'tent' | 'other';

export interface CamperProfile {
  id: string;
  name: string;
  type: CamperType;
  year?: number;
  make?: string;
  model?: string;
  lengthFeet?: number;
  sleeps?: number;
  slideOuts?: number;
  dryWeightLbs?: number;
  gvwrLbs?: number;
  tentStyle?: string;
  notes: string;
}

export interface Stay {
  id: string;
  siteId: string;
  camperId?: string;
  siteSnapshot?: SiteSnapshot;
  arrivalDate: string;
  departureDate: string;
  nights: number;
  nightlyRate?: number;
  journal: string;
  weather?: string;
  wouldReturn?: boolean;
  observations: RatingMap;
  createdAt: string;
}

export interface ParkProfile {
  id: string;
  name: string;
  state: string;
  checkInTime?: string;
  checkOutTime?: string;
  notes: string;
}

export interface PreferenceProfile {
  id: string;
  name: string;
  criterionWeights: Record<CriterionKey, number>;
  monthWeights: Record<MonthKey, number>;
  siteQualityShare: number;
  seasonalShare: number;
}

export interface AppState {
  sites: Campsite[];
  stays: Stay[];
  profiles: PreferenceProfile[];
  parks?: ParkProfile[];
  campers?: CamperProfile[];
}

export interface StayDraft extends Omit<Stay, 'id' | 'createdAt' | 'siteSnapshot'> {
  siteSnapshot: SiteSnapshot;
  updateCurrentKeys: CriterionKey[];
  createSite?: Campsite;
  updateSiteDetails?: Campsite;
}
