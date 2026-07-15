import type { CamperProfile, SiteAmenities, Stay, TripDetail, TripDetailsMap } from '../types';

export interface SiteFitSummary {
  tone: 'good' | 'watch' | 'unknown';
  title: string;
  detail: string;
}

export function normalizeTripDetails(value?: TripDetailsMap): TripDetailsMap {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(Object.entries(value).flatMap(([stayId, raw]) => {
    if (!raw || typeof raw !== 'object') return [];
    const detail = raw as TripDetail;
    return [[stayId, {
      gateCode: detail.gateCode?.trim() || undefined,
      photos: Array.isArray(detail.photos)
        ? detail.photos.filter((photo) => Boolean(photo?.id && photo?.key && photo?.url)).map((photo) => ({
          id: String(photo.id),
          key: String(photo.key),
          url: String(photo.url),
          name: String(photo.name || 'Trip photo'),
          uploadedAt: String(photo.uploadedAt || new Date().toISOString()),
          caption: photo.caption?.trim() || undefined,
        }))
        : [],
    }]];
  }));
}

function dateAtNoon(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

export function countdownCopy(stay: Stay, parkName: string, now = new Date()): { eyebrow: string; headline: string; detail: string } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const arrival = dateAtNoon(stay.arrivalDate);
  const departure = dateAtNoon(stay.departureDate);
  const daysUntil = Math.round((arrival.getTime() - today.getTime()) / 86_400_000);
  const daysRemaining = Math.round((departure.getTime() - today.getTime()) / 86_400_000);

  if (daysUntil > 1) return { eyebrow: 'Upcoming trip', headline: `${daysUntil} days until ${parkName}`, detail: `${stay.nights} nights planned` };
  if (daysUntil === 1) return { eyebrow: 'Leaving tomorrow', headline: `1 day until ${parkName}`, detail: `${stay.nights} nights planned` };
  if (daysUntil === 0) return { eyebrow: 'Check-in day', headline: `Today: ${parkName}`, detail: 'Safe travels and enjoy the campsite.' };
  if (daysRemaining > 0) return { eyebrow: 'Camping now', headline: `${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} left at ${parkName}`, detail: `${stay.nights} nights total` };
  if (daysRemaining === 0) return { eyebrow: 'Checkout day', headline: `Last day at ${parkName}`, detail: 'Complete the departure checklist before pulling out.' };
  return { eyebrow: 'Completed trip', headline: parkName, detail: `${stay.nights} nights recorded in the diary` };
}

export function wazeDirectionsUrl(latitude: number, longitude: number): string {
  return `https://waze.com/ul?ll=${encodeURIComponent(`${latitude},${longitude}`)}&navigate=yes&utm_source=camp-ledger`;
}

function hookupSummary(amenities?: SiteAmenities): string {
  if (!amenities) return 'Hookup details have not been recorded.';
  const details = [
    amenities.electric === '50amp' ? '50 amp' : amenities.electric === '30amp' ? '30 amp' : amenities.electric === 'none' ? 'No electric' : '',
    amenities.water === 'yes' ? 'Water at site' : amenities.water === 'partial' ? 'Shared water' : amenities.water === 'none' ? 'No water' : '',
    amenities.sewer === 'site' ? 'Sewer at site' : amenities.sewer === 'station' ? 'Dump station' : amenities.sewer === 'none' ? 'No sewer' : '',
    amenities.entry === 'pull-through' ? 'Pull-through' : amenities.entry === 'back-in' ? 'Back-in' : '',
  ].filter(Boolean);
  return details.length ? details.join(' · ') : 'Hookup details have not been recorded.';
}

export function camperSiteFit(camper?: CamperProfile, amenities?: SiteAmenities): SiteFitSummary {
  if (!camper) return { tone: 'unknown', title: 'Camper not assigned', detail: hookupSummary(amenities) };
  if (camper.type === 'tent') return { tone: 'good', title: `${camper.name} selected`, detail: hookupSummary(amenities) };

  const camperLength = camper.lengthFeet;
  const siteLength = amenities?.siteLengthFeet;
  if (!camperLength || !siteLength) {
    return { tone: 'unknown', title: `${camper.name} selected`, detail: `${hookupSummary(amenities)} · Add camper and site length to check fit.` };
  }

  const clearance = siteLength - camperLength;
  if (clearance >= 8) return { tone: 'good', title: 'Length fit looks comfortable', detail: `${camper.name}: ${camperLength} ft · Site: ${siteLength} ft · ${hookupSummary(amenities)}` };
  if (clearance >= 0) return { tone: 'watch', title: 'Length fit may be tight', detail: `${camper.name}: ${camperLength} ft · Site: ${siteLength} ft · Verify tow vehicle and slide clearance.` };
  return { tone: 'watch', title: 'Camper may be longer than the recorded site', detail: `${camper.name}: ${camperLength} ft · Site: ${siteLength} ft · Confirm the reservation before departure.` };
}

export function weatherCodeLabel(code: number): string {
  if (code === 0) return 'Clear';
  if ([1, 2].includes(code)) return 'Partly cloudy';
  if (code === 3) return 'Cloudy';
  if ([45, 48].includes(code)) return 'Fog';
  if ([51, 53, 55, 56, 57].includes(code)) return 'Drizzle';
  if ([61, 63, 65, 66, 67].includes(code)) return 'Rain';
  if ([71, 73, 75, 77].includes(code)) return 'Snow';
  if ([80, 81, 82].includes(code)) return 'Rain showers';
  if ([85, 86].includes(code)) return 'Snow showers';
  if ([95, 96, 99].includes(code)) return 'Thunderstorms';
  return 'Forecast';
}
