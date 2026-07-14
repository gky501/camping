import { CalendarDays, MapPin, Moon, X } from 'lucide-react';
import { formatDateRange } from '../lib/dates';
import { CRITERIA, type Campsite, type Stay } from '../types';
import { SiteLocationPicker } from './SiteLocationPicker';

export function StayDetailModal({ stay, site, onClose }: { stay: Stay; site?: Campsite; onClose: () => void }) {
  const location = stay.siteSnapshot ?? site;
  const locationLine = [location?.area, location?.loop ? `Loop ${location.loop}` : '', location?.siteNumber ? `Site ${location.siteNumber}` : ''].filter(Boolean).join(' · ');
  const observed = CRITERIA.filter((criterion) => stay.observations[criterion.key] !== undefined);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="modal-card stay-detail-modal" role="dialog" aria-modal="true" aria-labelledby="stay-detail-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div><p className="eyebrow">Camping diary</p><h2 id="stay-detail-title">{location?.park ?? 'Stay details'}</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="Close"><X /></button>
        </div>
        <section className="form-section stay-detail-hero">
          <div>
            <p className="eyebrow">{location?.state}</p>
            <h3>{locationLine || 'Campsite'}</h3>
            <p className="stay-detail-date"><CalendarDays size={17} /> {formatDateRange(stay.arrivalDate, stay.departureDate)} <span><Moon size={16} /> {stay.nights} {stay.nights === 1 ? 'night' : 'nights'}</span></p>
          </div>
          <div className="chip-row">
            {stay.weather && <span className="chip">{stay.weather}</span>}
            {stay.nightlyRate !== undefined && <span className="chip">${stay.nightlyRate.toFixed(2)}/night</span>}
            {stay.wouldReturn !== undefined && <span className="chip">{stay.wouldReturn ? 'Would book again' : 'Would not book again'}</span>}
          </div>
        </section>
        {location && (
          <section className="form-section">
            <div className="section-heading-row"><div><h3>Location used for this stay</h3><p>The diary keeps the place connected to this trip.</p></div><MapPin size={22} /></div>
            <SiteLocationPicker latitude={location.latitude} longitude={location.longitude} readOnly />
            <div className="coordinate-line"><span>{location.latitude.toFixed(7)}, {location.longitude.toFixed(7)}</span><a href={`https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`} target="_blank" rel="noreferrer">Open directions</a></div>
          </section>
        )}
        <section className="form-section">
          <h3>What the site was like</h3>
          {observed.length ? <div className="stay-rating-grid">{observed.map((criterion) => <div key={criterion.key}><span>{criterion.label}</span><strong>{stay.observations[criterion.key]}/5</strong></div>)}</div> : <p className="form-help">No ratings were recorded for this stay.</p>}
        </section>
        <section className="form-section">
          <h3>Diary notes</h3>
          <p className="diary-notes">{stay.journal || 'No notes were added to this stay.'}</p>
        </section>
        <div className="modal-actions"><button type="button" className="primary-button" onClick={onClose}>Done</button></div>
      </div>
    </div>
  );
}
