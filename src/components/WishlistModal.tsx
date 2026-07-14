import { useState } from 'react';
import { Crosshair, MapPinned, X } from 'lucide-react';
import type { WishlistSiteDraft } from '../types';

export function WishlistModal({ onClose, onSave }: {
  onClose: () => void;
  onSave: (draft: WishlistSiteDraft) => void;
}) {
  const [park, setPark] = useState('');
  const [state, setState] = useState('Arkansas');
  const [loop, setLoop] = useState('');
  const [siteNumber, setSiteNumber] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [notes, setNotes] = useState('');
  const [locationMessage, setLocationMessage] = useState('');

  const latitudeNumber = Number(latitude);
  const longitudeNumber = Number(longitude);
  const validCoordinates = Number.isFinite(latitudeNumber) && Number.isFinite(longitudeNumber) && latitudeNumber >= -90 && latitudeNumber <= 90 && longitudeNumber >= -180 && longitudeNumber <= 180;
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
      () => setLocationMessage('Unable to access your location. You can paste the coordinates instead.'),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSave) return;
    onSave({
      park: park.trim(),
      state: state.trim() || 'Unknown',
      loop: loop.trim(),
      siteNumber: siteNumber.trim(),
      latitude: latitudeNumber,
      longitude: longitudeNumber,
      notes: notes.trim(),
    });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="modal-card wishlist-modal" role="dialog" aria-modal="true" aria-labelledby="wishlist-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div><p className="eyebrow">Places to try</p><h2 id="wishlist-title">Add to wish list</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="Close"><X /></button>
        </div>
        <form onSubmit={submit}>
          <section className="form-section">
            <div className="section-heading-row"><div><h3>Campsite</h3><p>Add the exact site rather than only the campground.</p></div><MapPinned size={24} /></div>
            <div className="form-grid">
              <label className="field"><span>Campground</span><input value={park} onChange={(event) => setPark(event.target.value)} placeholder="Maumelle Park" required /></label>
              <label className="field"><span>State</span><input value={state} onChange={(event) => setState(event.target.value)} placeholder="Arkansas" /></label>
              <label className="field"><span>Loop or area</span><input value={loop} onChange={(event) => setLoop(event.target.value)} placeholder="B Loop" /></label>
              <label className="field"><span>Site number</span><input value={siteNumber} onChange={(event) => setSiteNumber(event.target.value)} placeholder="A1" required /></label>
            </div>
          </section>
          <section className="form-section">
            <div className="section-heading-row"><div><h3>Map location</h3><p>Use your current location while standing at the site, or paste coordinates from another map.</p></div><button type="button" className="secondary-button" onClick={useCurrentLocation}><Crosshair size={17} /> Use my location</button></div>
            {locationMessage && <p className="form-help">{locationMessage}</p>}
            <div className="form-grid">
              <label className="field"><span>Latitude</span><input type="number" step="any" value={latitude} onChange={(event) => setLatitude(event.target.value)} placeholder="34.8295754" required /></label>
              <label className="field"><span>Longitude</span><input type="number" step="any" value={longitude} onChange={(event) => setLongitude(event.target.value)} placeholder="-92.4314041" required /></label>
            </div>
            <label className="field"><span>Why this site?</span><textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Waterfront, full hookups, good space for the dogs…" /></label>
          </section>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-button" disabled={!canSave}>Save to wish list</button>
          </div>
        </form>
      </div>
    </div>
  );
}
