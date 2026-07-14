import { useState } from 'react';
import { Clock3, X } from 'lucide-react';
import type { ParkProfile } from '../types';

export function ParkEditModal({ park, onClose, onSave }: {
  park: ParkProfile;
  onClose: () => void;
  onSave: (park: ParkProfile) => void;
}) {
  const [name, setName] = useState(park.name);
  const [state, setState] = useState(park.state);
  const [checkInTime, setCheckInTime] = useState(park.checkInTime ?? '');
  const [checkOutTime, setCheckOutTime] = useState(park.checkOutTime ?? '');
  const [notes, setNotes] = useState(park.notes);
  const canSave = Boolean(name.trim());

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSave) return;
    onSave({
      ...park,
      name: name.trim(),
      state: state.trim() || 'Unknown',
      checkInTime: checkInTime || undefined,
      checkOutTime: checkOutTime || undefined,
      notes: notes.trim(),
    });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="modal-card park-edit-modal" role="dialog" aria-modal="true" aria-labelledby="park-edit-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div><p className="eyebrow">Park profile</p><h2 id="park-edit-title">Edit park</h2></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X /></button>
        </div>
        <form onSubmit={submit}>
          <section className="form-section">
            <h3>Park identity</h3>
            <p className="form-help">Correcting the park name or state updates every campsite and dated stay connected to it.</p>
            <div className="form-grid">
              <label className="field"><span>Park name</span><input value={name} onChange={(event) => setName(event.target.value)} required /></label>
              <label className="field"><span>State</span><input value={state} onChange={(event) => setState(event.target.value)} /></label>
            </div>
          </section>
          <section className="form-section">
            <div className="section-heading-row"><div><h3>Arrival information</h3><p>Use the park's standard times so they are easy to find before a trip.</p></div><Clock3 size={22} /></div>
            <div className="form-grid">
              <label className="field"><span>Check-in time</span><input type="time" value={checkInTime} onChange={(event) => setCheckInTime(event.target.value)} /></label>
              <label className="field"><span>Check-out time</span><input type="time" value={checkOutTime} onChange={(event) => setCheckOutTime(event.target.value)} /></label>
            </div>
          </section>
          <section className="form-section">
            <h3>Park notes</h3>
            <label className="field"><span>General notes about the park</span><textarea rows={7} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Gate codes, road conditions, bathhouse notes, reservation tips, favorite loops…" /></label>
          </section>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-button" disabled={!canSave}>Save park</button>
          </div>
        </form>
      </div>
    </div>
  );
}
