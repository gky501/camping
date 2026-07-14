import { CalendarDays, MapPin, Moon, Pencil, TentTree, X } from 'lucide-react';
import { summarizeAmenities } from '../lib/amenities';
import { camperSubtitle, camperTypeLabel } from '../lib/campers';
import { formatDateRange } from '../lib/dates';
import { tripStatus } from '../lib/trips';
import { CRITERIA, type CamperProfile, type Campsite, type Stay } from '../types';
import { SiteLocationPicker } from './SiteLocationPicker';
import { TripMetaPills, TripStatusPill } from './TripPills';

export function StayDetailModal({ stay, site, camper, onEdit, onClose }: {
  stay: Stay;
  site?: Campsite;
  camper?: CamperProfile;
  onEdit: () => void;
  onClose: () => void;
}) {
  const location = stay.siteSnapshot ?? site;
  const status = tripStatus(stay);
  const locationLine = [location?.area, location?.loop ? `Loop ${location.loop}` : '', location?.siteNumber ? `Site ${location.siteNumber}` : ''].filter(Boolean).join(' · ');
  const observed = CRITERIA.filter((criterion) => stay.observations[criterion.key] !== undefined);
  const amenities = summarizeAmenities(stay.siteSnapshot?.amenities ?? site?.amenities);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="modal-card stay-detail-modal" role="dialog" aria-modal="true" aria-labelledby="stay-detail-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header"><div><p className="eyebrow">{status === 'upcoming' ? 'Upcoming trip plan' : status === 'active' ? 'Camping now' : 'Camping diary'}</p><h2 id="stay-detail-title">{location?.park ?? 'Stay details'}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X /></button></div>
        <section className={`form-section stay-detail-hero ${status}`}>
          <div><TripStatusPill stay={stay} /><p className="eyebrow">{location?.state}</p><h3>{locationLine || 'Campsite'}</h3><p className="stay-detail-date"><CalendarDays size={17} /> {formatDateRange(stay.arrivalDate, stay.departureDate)} <span><Moon size={16} /> {stay.nights} {stay.nights === 1 ? 'night' : 'nights'}</span></p></div>
          <TripMetaPills stay={stay} camper={camper} />
        </section>

        {status === 'upcoming' && <section className="form-section planned-trip-callout"><CalendarDays size={22} /><div><h3>This trip is still a plan.</h3><p>Edit it anytime to add reservation details now, then return after the stay to complete ratings and the final diary notes.</p></div></section>}

        {camper && <section className="form-section camper-used-section"><div className="section-heading-row"><div><h3>Camping setup</h3><p>The camper or tent profile tagged to this trip.</p></div><TentTree size={22} /></div><div className="camper-used-card"><div><strong>{camper.name}</strong><span>{camperSubtitle(camper) || camperTypeLabel(camper.type)}</span></div><span className="camper-type-badge">{camperTypeLabel(camper.type)}</span></div></section>}

        {amenities.length > 0 && <section className="form-section"><h3>Hookups and site setup</h3><div className="chip-row amenity-detail-chips">{amenities.map((amenity) => <span className="chip amenity-chip" key={amenity}>{amenity}</span>)}</div></section>}

        {location && <section className="form-section"><div className="section-heading-row"><div><h3>Location {status === 'upcoming' ? 'planned for this trip' : 'used for this stay'}</h3><p>The diary keeps the exact spot connected to this entry.</p></div><MapPin size={22} /></div><SiteLocationPicker latitude={location.latitude} longitude={location.longitude} readOnly /><div className="coordinate-line"><span>{location.latitude.toFixed(7)}, {location.longitude.toFixed(7)}</span><a href={`https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`} target="_blank" rel="noreferrer">Open directions</a></div></section>}

        {(observed.length > 0 || status !== 'upcoming') && <section className="form-section"><h3>What the site was like</h3>{observed.length ? <div className="stay-rating-grid">{observed.map((criterion) => <div key={criterion.key}><span>{criterion.label}</span><strong>{stay.observations[criterion.key]}/5</strong></div>)}</div> : <p className="form-help">No ratings were recorded for this stay.</p>}</section>}

        <section className="form-section"><h3>{status === 'upcoming' ? 'Planning notes' : 'Diary notes'}</h3><p className="diary-notes">{stay.journal || (status === 'upcoming' ? 'No planning notes have been added yet.' : 'No notes were added to this stay.')}</p></section>
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={onEdit}><Pencil size={16} /> Edit {status === 'upcoming' ? 'plan' : 'stay'}</button><button type="button" className="primary-button" onClick={onClose}>Done</button></div>
      </div>
    </div>
  );
}
