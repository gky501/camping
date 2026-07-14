import { useState } from 'react';
import { Crosshair, MapPinned, X } from 'lucide-react';
import type { Campsite, SiteAmenities, WishlistSiteDraft } from '../types';
import { AmenityCards } from './AmenityCards';
import { SiteLocationPicker } from './SiteLocationPicker';

export function WishlistModal({ site, onClose, onSave }: {
  site?: Campsite;
  onClose: () => void;
  onSave: (draft: WishlistSiteDraft) => void;
}) {
  const editing = Boolean(site);
  const [park, setPark] = useState(site?.park ?? '');
  const [state, setState] = useState(site?.state ?? 'Arkansas');
  const [area, setArea] = useState(site?.area ?? '');
  const [loop, setLoop] = useState(site?.loop ?? '');
  const [siteNumber, setSiteNumber] = useState(site?.siteNumber ?? '');
  const [latitude, setLatitude] = useState(site ? String(site.latitude) : '');
  const [longitude, setLongitude] = useState(site ? String(site.longitude) : '');
  const [notes, setNotes] = useState(site?.notes ?? '');
  const [amenities, setAmenities] = useState<SiteAmenities>(site?.amenities ?? { features: [] });
  const [locationMessage, setLocationMessage] = useState('');

  const latitudeNumber = Number(latitude);
  const longitudeNumber = Number(longitude);
  const validCoordinates = latitude.trim() !== '' && longitude.trim() !== '' && Number.isFinite(latitudeNumber) && Number.isFinite(longitudeNumber) && latitudeNumber >= -90 && latitudeNumber <= 90 && longitudeNumber >= -180 && longitudeNumber <= 180;
  const canSave = Boolean(park.trim() && siteNumber.trim() && validCoordinates);

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationMessage('Location is not available in this browser.');
      return;
    }
    setLocationMessage('Getting your location…');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(7));
        setLongitude(position.coords.longitude.toFixed(7));
        setLocationMessage(`Location added · accuracy about ${Math.round(position.coords.accuracy)} m`);
      },
      () => setLocationMessage('Unable to access your location. You can pick the site on the map or paste coordinates.'),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSave) return;
    onSave({
      park: park.trim(),
      state: state.trim() || 'Unknown',
      area: area.trim(),
      loop: loop.trim(),
      siteNumber: siteNumber.trim(),
      latitude: latitudeNumber,
      longitude: longitudeNumber,
      notes: notes.trim(),
      amenities,
    });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="modal-card wishlist-modal" role="dialog" aria-modal="true" aria-labelledby="wishlist-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div><p className="eyebrow">Places to try</p><h2 id="wishlist-title">{editing ? 'Edit wish-list site' : 'Add to wish list'}</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="Close"><X /></button>
        </div>
        <form onSubmit={submit}>
          <section className="form-section">
            <div className="section-heading-row"><div><h3>Campsite</h3><p>{editing ? 'Update the saved campsite details.' : 'Add the exact site rather than only the campground.'}</p></div><MapPinned size={24} /></div>
            <div className="form-grid">
              <label className="field"><span>Park</span><input value={park} onChange={(event) => setPark(event.target.value)} placeholder="Lake Ouachita" required /></label>
              <label className="field"><span>State</span><input value={state} onChange={(event) => setState(event.target.value)} placeholder="Arkansas" /></label>
              <label className="field"><span>Area</span><input value={area} onChange={(event) => setArea(event.target.value)} placeholder="Crystal Springs" /></label>
              <label className="field"><span>Loop</span><input value={loop} onChange={(event) => setLoop(event.target.value)} placeholder="C" /></label>
              <label className="field"><span>Site</span><input value={siteNumber} onChange={(event) => setSiteNumber(event.target.value)} placeholder="55" required /></label>
            </div>
          </section>

          <section className="form-section">
            <div className="section-heading-row"><div><h3>Hookups and site setup</h3><p>Select only what you know. These details will carry forward when you log a stay.</p></div></div>
            <AmenityCards value={amenities} onChange={setAmenities} />
          </section>

          <section className="form-section">
            <div className="section-heading-row"><div><h3>Map location</h3><p>Click the exact location, use your current position, or enter coordinates.</p></div><button type="button" className="secondary-button" onClick={useCurrentLocation}><Crosshair size={17} /> Use my location</button></div>
            {locationMessage && <p className="form-help">{locationMessage}</p>}
            <SiteLocationPicker latitude={validCoordinates ? latitudeNumber : undefined} longitude={validCoordinates ? longitudeNumber : undefined} onPick={(lat, lng) => { setLatitude(lat.toFixed(7)); setLongitude(lng.toFixed(7)); }} />
            <div className="form-grid">
              <label className="field"><span>Latitude</span><input type="number" step="any" value={latitude} onChange={(event) => setLatitude(event.target.value)} placeholder="34.5432355" required /></label>
              <label className="field"><span>Longitude</span><input type="number" step="any" value={longitude} onChange={(event) => setLongitude(event.target.value)} placeholder="-93.3564893" required /></label>
            </div>
            <label className="field"><span>Why this site?</span><textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Waterfront, full hookups, good space for the dogs…" /></label>
          </section>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-button" disabled={!canSave}>{editing ? 'Save changes' : 'Save to wish list'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
