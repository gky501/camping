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

export interface SiteLocation {
  park: string;
  state: string;
  area?: string;
  loop: string;
  siteNumber: string;
  latitude: number;
  longitude: number;
}

export interface Campsite extends SiteLocation {
  id: string;
  notes: string;
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
}

export interface Stay {
  id: string;
  siteId: string;
  siteSnapshot?: SiteLocation;
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
}

export interface StayDraft extends Omit<Stay, 'id' | 'createdAt' | 'siteSnapshot'> {
  siteSnapshot: SiteLocation;
  updateCurrentKeys: CriterionKey[];
  createSite?: Campsite;
  updateSiteDetails?: Campsite;
}
