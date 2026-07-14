import type { Stay } from '../types';

export type TripStatus = 'upcoming' | 'active' | 'completed';

function localIsoDate(date = new Date()): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export function tripStatus(stay: Pick<Stay, 'arrivalDate' | 'departureDate'>, today = localIsoDate()): TripStatus {
  if (stay.arrivalDate > today) return 'upcoming';
  if (stay.departureDate > today) return 'active';
  return 'completed';
}

export function tripStatusLabel(status: TripStatus): string {
  if (status === 'upcoming') return 'Upcoming';
  if (status === 'active') return 'Camping now';
  return 'Completed';
}

export function sortDiaryStays(stays: Stay[]): Stay[] {
  return [...stays].sort((left, right) => {
    const leftStatus = tripStatus(left);
    const rightStatus = tripStatus(right);
    const order: Record<TripStatus, number> = { active: 0, upcoming: 1, completed: 2 };
    if (order[leftStatus] !== order[rightStatus]) return order[leftStatus] - order[rightStatus];
    if (leftStatus === 'completed') return right.arrivalDate.localeCompare(left.arrivalDate);
    return left.arrivalDate.localeCompare(right.arrivalDate);
  });
}
