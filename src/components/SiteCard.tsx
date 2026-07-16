import { Bookmark, MapPin, Moon, Trees } from 'lucide-react';
import { summarizeAmenities } from '../lib/amenities';
import { calculateOverall } from '../lib/scoring';
import type { Campsite, PreferenceProfile, Stay } from '../types';
import { ScoreBadge } from './ScoreBadge';

interface SiteCardProps {
  site: Campsite;
  profile: PreferenceProfile;
  stays: Stay[];
  selected?: boolean;
  actionLabel?: string;
  onSelect: () => void;
  onLogStay: () => void;
}

export function SiteCard({ site, profile, stays, selected, actionLabel, onSelect, onLogStay }: SiteCardProps) {
  const siteStays = stays.filter((stay) => stay.siteId === site.id);
  const score = calculateOverall(site, profile);
  const totalNights = siteStays.reduce((sum, stay) => sum + stay.nights, 0);
  const totalStays = site.legacyStayCount + siteStays.length;
  const isWishlist = site.status === 'wishlist';
  const locationLine = [site.area, site.loop ? `Loop ${site.loop}` : '', `Site ${site.siteNumber}`].filter(Boolean).join(' · ');
  const amenitySummary = summarizeAmenities(site.amenities).slice(0, 5);
  const resolvedActionLabel = actionLabel ?? (isWishlist ? 'Log first stay' : 'Log another stay');

  return (
    <article className={`site-card ${selected ? 'site-card-selected' : ''} ${isWishlist ? 'site-card-wishlist' : ''}`} onClick={onSelect}>
      <div className="site-card-main">
        <div>
          <p className="eyebrow">{site.state}</p>
          <h3>{site.park}</h3>
          <p className="site-location"><MapPin size={15} /> {locationLine}</p>
        </div>
        <ScoreBadge score={score} />
      </div>
      <p className="site-note">{site.notes || (isWishlist ? 'Saved to the wish list.' : 'No campsite notes yet.')}</p>
      <div className="chip-row">
        {isWishlist && <span className="chip wishlist-chip"><Bookmark size={13} fill="currentColor" /> Wish list</span>}
        {amenitySummary.map((amenity) => <span className="chip amenity-chip" key={amenity}>{amenity}</span>)}
        {site.viewTypes.slice(0, 3).map((view) => <span className="chip" key={view}><Trees size={13} /> {view}</span>)}
        {totalStays > 0 && <span className="chip"><Moon size={13} /> {totalStays} {totalStays === 1 ? 'stay' : 'stays'}{totalNights ? ` · ${totalNights} nights` : ''}</span>}
      </div>
      <button className={`text-button ${isWishlist && resolvedActionLabel === 'Add stay' ? 'wishlist-add-stay' : ''}`} onClick={(event) => { event.stopPropagation(); onLogStay(); }}>{resolvedActionLabel}</button>
    </article>
  );
}
