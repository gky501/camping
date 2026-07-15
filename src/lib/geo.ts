import type { HomeBase, SiteLocation } from '../types';

export const DEFAULT_HOME_BASE: HomeBase = {
  name: 'Little Rock, Arkansas',
  latitude: 34.7465,
  longitude: -92.2896,
};

const EARTH_RADIUS_MILES = 3958.8;

export function distanceMiles(
  origin: Pick<HomeBase, 'latitude' | 'longitude'>,
  destination: Pick<SiteLocation, 'latitude' | 'longitude'>,
): number {
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = toRadians(destination.latitude - origin.latitude);
  const longitudeDelta = toRadians(destination.longitude - origin.longitude);
  const latitude1 = toRadians(origin.latitude);
  const latitude2 = toRadians(destination.latitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2;
  return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
