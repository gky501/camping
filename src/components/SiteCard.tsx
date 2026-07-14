import { MapPin, Moon, Trees } from 'lucide-react';
import { calculateOverall } from '../lib/scoring';
import type { Campsite, PreferenceProfile, Stay } from '../types';
import { ScoreBadge } from './ScoreBadge';

interface SiteCardProps {
  site: Campsite;
  profile: PreferenceProfile;
  stays: Stay[];
  selected?: boolean;
  onSelect: () => void;
  onLogStay: () => void;
}

export function SiteCard({ site, profile, stays, selected, onSelect, onLogStay }: SiteCardProps) {
  const siteStays = stays.filter((stay) => stay.siteId === site.id);
  const score = calculateOverall(site, profile);
  const totalNights = siteStays.reduce((sum, stay) => sum + stay.nights, 0);
  const totalStays = site.legacyStayCount + siteStays.length;

  return (
    <article className={`site-card ${selected ? 'site-card-selected' : ''}`} onClick={onSelect}>
      <div className="site-card-main">
        <div>
          <p className="eyebrow">{site.state}</p>
          <h3>{site.park}</h3>
          <p className="site-location"><MapPin size={15} /> {site.loop} · Site {site.siteNumber}</p>
        </div>
        <ScoreBadge score={score} />
      </div>
      <p className="site-note">{site.notes || 'No campsite notes yet.'}</p>
      <div className="chip-row">
        {site.viewTypes.slice(0, 3).map((view) => <span className="chip" key={view}><Trees size={13} /> {view}</span>)}
        {totalStays > 0 && <span className="chip"><Moon size={13} /> {totalStays} {totalStays === 1 ? 'stay' : 'stays'}{totalNights ? ` · ${totalNights} nights` : ''}</span>}
      </div>
      <button className="text-button" onClick={(event) => { event.stopPropagation(); onLogStay(); }}>Log another stay</button>
    </article>
  );
}
