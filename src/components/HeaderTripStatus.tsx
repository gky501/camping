import { CalendarDays, TentTree } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AppState, Stay } from '../types';

const STORAGE_KEY = 'camp-ledger-state-v2-wishlist-only';

interface HeaderTrip {
  mode: 'active' | 'next';
  park: string;
  site?: string;
  days?: number;
}

function localDate(value = new Date()): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function dayDifference(from: string, to: string): number {
  const start = new Date(`${from}T12:00:00`).getTime();
  const end = new Date(`${to}T12:00:00`).getTime();
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

function locationForStay(state: AppState, stay: Stay) {
  const site = stay.siteSnapshot ?? state.sites.find((item) => item.id === stay.siteId);
  return {
    park: site?.park || 'Upcoming trip',
    site: site?.siteNumber ? `Site ${site.siteNumber}` : undefined,
  };
}

function readTrip(): HeaderTrip | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const state = JSON.parse(raw) as AppState;
    const today = localDate();
    const active = state.stays
      .filter((stay) => stay.arrivalDate <= today && stay.departureDate > today)
      .sort((a, b) => a.departureDate.localeCompare(b.departureDate))[0];
    if (active) return { mode: 'active', ...locationForStay(state, active) };

    const next = state.stays
      .filter((stay) => stay.arrivalDate > today)
      .sort((a, b) => a.arrivalDate.localeCompare(b.arrivalDate))[0];
    if (!next) return undefined;
    return { mode: 'next', days: dayDifference(today, next.arrivalDate), ...locationForStay(state, next) };
  } catch {
    return undefined;
  }
}

export function HeaderTripStatus() {
  const [trip, setTrip] = useState<HeaderTrip | undefined>(() => readTrip());

  useEffect(() => {
    const refresh = () => setTrip(readTrip());
    window.addEventListener('storage', refresh);
    window.addEventListener('camp-ledger-state-change', refresh);
    const timer = window.setInterval(refresh, 60_000);
    refresh();
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('camp-ledger-state-change', refresh);
      window.clearInterval(timer);
    };
  }, []);

  if (!trip) return null;
  return (
    <div className={`header-trip-status ${trip.mode}`} title={trip.mode === 'active' ? `Camping now at ${trip.park}` : `Next trip: ${trip.park}`}>
      <span>{trip.mode === 'active' ? <TentTree size={16} /> : <CalendarDays size={16} />}</span>
      <div>
        <small>{trip.mode === 'active' ? 'Camping now' : 'Next trip'}</small>
        <strong>{trip.mode === 'active' ? trip.park : `${trip.days === 0 ? 'Today' : `${trip.days} ${trip.days === 1 ? 'day' : 'days'}`} · ${trip.park}`}</strong>
        {trip.site && <em>{trip.site}</em>}
      </div>
    </div>
  );
}
