import { Save, TentTree, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CAMPER_TYPES } from '../lib/campers';
import { createId } from '../lib/id';
import type { CamperProfile, CamperType } from '../types';

function numberValue(raw: string): number | undefined {
  if (!raw.trim()) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

export function CamperEditModal({ camper, onClose, onSave }: {
  camper?: CamperProfile;
  onClose: () => void;
  onSave: (camper: CamperProfile) => void;
}) {
  const [name, setName] = useState(camper?.name ?? '');
  const [type, setType] = useState<CamperType>(camper?.type ?? 'travel-trailer');
  const [year, setYear] = useState(camper?.year === undefined ? '' : String(camper.year));
  const [make, setMake] = useState(camper?.make ?? '');
  const [model, setModel] = useState(camper?.model ?? '');
  const [lengthFeet, setLengthFeet] = useState(camper?.lengthFeet === undefined ? '' : String(camper.lengthFeet));
  const [sleeps, setSleeps] = useState(camper?.sleeps === undefined ? '' : String(camper.sleeps));
  const [slideOuts, setSlideOuts] = useState(camper?.slideOuts === undefined ? '' : String(camper.slideOuts));
  const [dryWeightLbs, setDryWeightLbs] = useState(camper?.dryWeightLbs === undefined ? '' : String(camper.dryWeightLbs));
  const [gvwrLbs, setGvwrLbs] = useState(camper?.gvwrLbs === undefined ? '' : String(camper.gvwrLbs));
  const [tentStyle, setTentStyle] = useState(camper?.tentStyle ?? '');
  const [notes, setNotes] = useState(camper?.notes ?? '');

  useEffect(() => {
    setName(camper?.name ?? '');
    setType(camper?.type ?? 'travel-trailer');
    setYear(camper?.year === undefined ? '' : String(camper.year));
    setMake(camper?.make ?? '');
    setModel(camper?.model ?? '');
    setLengthFeet(camper?.lengthFeet === undefined ? '' : String(camper.lengthFeet));
    setSleeps(camper?.sleeps === undefined ? '' : String(camper.sleeps));
    setSlideOuts(camper?.slideOuts === undefined ? '' : String(camper.slideOuts));
    setDryWeightLbs(camper?.dryWeightLbs === undefined ? '' : String(camper.dryWeightLbs));
    setGvwrLbs(camper?.gvwrLbs === undefined ? '' : String(camper.gvwrLbs));
    setTentStyle(camper?.tentStyle ?? '');
    setNotes(camper?.notes ?? '');
  }, [camper?.id]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    onSave({
      id: camper?.id ?? createId('camper'),
      name: name.trim(),
      type,
      year: numberValue(year),
      make: make.trim() || undefined,
      model: model.trim() || undefined,
      lengthFeet: numberValue(lengthFeet),
      sleeps: numberValue(sleeps),
      slideOuts: type === 'tent' ? undefined : numberValue(slideOuts),
      dryWeightLbs: type === 'tent' ? undefined : numberValue(dryWeightLbs),
      gvwrLbs: type === 'tent' ? undefined : numberValue(gvwrLbs),
      tentStyle: type === 'tent' ? tentStyle.trim() || undefined : undefined,
      notes: notes.trim(),
    });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="modal-card camper-edit-modal" role="dialog" aria-modal="true" aria-labelledby="camper-edit-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div><p className="eyebrow">Camping setup</p><h2 id="camper-edit-title">{camper ? 'Edit camper' : 'Add a camper'}</h2></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X /></button>
        </div>
        <form onSubmit={submit}>
          <section className="form-section">
            <div className="section-heading-row"><div><h3>Profile</h3><p>Name the setup the way you refer to it in your trip history.</p></div><TentTree size={23} /></div>
            <label className="field"><span>Profile name</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Vintage, Delta RE250, Tent Camping…" required /></label>
            <fieldset className="camper-type-field">
              <legend>Setup type</legend>
              <div className="camper-type-grid">
                {CAMPER_TYPES.map((option) => <button key={option.value} type="button" className={type === option.value ? 'camper-type-card active' : 'camper-type-card'} onClick={() => setType(option.value)}>{option.label}</button>)}
              </div>
            </fieldset>
          </section>

          <section className="form-section">
            <h3>Data sheet</h3>
            <div className="form-grid camper-spec-grid">
              <label className="field"><span>Year</span><input type="number" min="1900" max="2100" value={year} onChange={(event) => setYear(event.target.value)} placeholder="2027" /></label>
              <label className="field"><span>Make</span><input value={make} onChange={(event) => setMake(event.target.value)} placeholder={type === 'tent' ? 'Coleman' : 'Alliance RV'} /></label>
              <label className="field"><span>Model</span><input value={model} onChange={(event) => setModel(event.target.value)} placeholder={type === 'tent' ? 'Skydome' : 'Delta RE250'} /></label>
              {type === 'tent' && <label className="field"><span>Tent style</span><input value={tentStyle} onChange={(event) => setTentStyle(event.target.value)} placeholder="Cabin, dome, backpacking…" /></label>}
              <label className="field"><span>{type === 'tent' ? 'Footprint length' : 'Length'} in feet</span><input type="number" min="0" step="0.1" value={lengthFeet} onChange={(event) => setLengthFeet(event.target.value)} /></label>
              <label className="field"><span>Sleeps</span><input type="number" min="0" step="1" value={sleeps} onChange={(event) => setSleeps(event.target.value)} /></label>
              {type !== 'tent' && <label className="field"><span>Slide-outs</span><input type="number" min="0" step="1" value={slideOuts} onChange={(event) => setSlideOuts(event.target.value)} /></label>}
              {type !== 'tent' && <label className="field"><span>Dry weight (lbs)</span><input type="number" min="0" step="1" value={dryWeightLbs} onChange={(event) => setDryWeightLbs(event.target.value)} /></label>}
              {type !== 'tent' && <label className="field"><span>GVWR (lbs)</span><input type="number" min="0" step="1" value={gvwrLbs} onChange={(event) => setGvwrLbs(event.target.value)} /></label>}
            </div>
            <label className="field"><span>Profile notes</span><textarea rows={5} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Modifications, setup reminders, equipment, towing notes, or anything unique to this camper." /></label>
          </section>
          <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button" disabled={!name.trim()}><Save size={17} /> Save profile</button></div>
        </form>
      </div>
    </div>
  );
}
