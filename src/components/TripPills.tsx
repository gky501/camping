import { CalendarDays, Cloud, Moon, TentTree, ThumbsDown, ThumbsUp } from 'lucide-react';
import { tripStatus, tripStatusLabel } from '../lib/trips';
import type { CamperProfile, Stay } from '../types';

export function TripStatusPill({ stay }: { stay: Stay }) {
  const status = tripStatus(stay);
  return <span className={`trip-status-pill ${status}`}><CalendarDays size={13} /> {tripStatusLabel(status)}</span>;
}

export function TripMetaPills({ stay, camper }: { stay: Stay; camper?: CamperProfile }) {
  const status = tripStatus(stay);
  return (
    <div className="trip-meta-row">
      {camper && <span className="meta-pill camper"><TentTree size={14} /> {camper.name}</span>}
      {stay.weather && <span className="meta-pill weather"><Cloud size={14} /> {stay.weather}</span>}
      {stay.nightlyRate !== undefined && <span className="meta-pill rate"><Moon size={14} /> ${stay.nightlyRate.toFixed(2)}/night</span>}
      {status === 'completed' && stay.wouldReturn === true && <span className="meta-pill return-yes"><ThumbsUp size={14} /> Would return</span>}
      {status === 'completed' && stay.wouldReturn === false && <span className="meta-pill return-no"><ThumbsDown size={14} /> Would not return</span>}
    </div>
  );
}
