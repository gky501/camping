import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronDown, Moon, X } from 'lucide-react';
import { calculateNights } from '../lib/dates';
import { CRITERIA, type Campsite, type CriterionKey, type RatingMap, type StayDraft } from '../types';

interface StayModalProps {
  sites: Campsite[];
  initialSite?: Campsite;
  onClose: () => void;
  onSave: (draft: StayDraft) => void;
}

const todayDate = new Date();
const today = todayDate.toISOString().slice(0, 10);
const tomorrowDate = new Date(todayDate);
tomorrowDate.setDate(tomorrowDate.getDate() + 1);
const tomorrow = tomorrowDate.toISOString().slice(0, 10);

export function StayModal({ sites, initialSite, onClose, onSave }: StayModalProps) {
  const [siteId, setSiteId] = useState(initialSite?.id ?? sites[0]?.id ?? '');
  const [arrivalDate, setArrivalDate] = useState(today);
  const [departureDate, setDepartureDate] = useState(tomorrow);
  const [nightlyRate, setNightlyRate] = useState('');
  const [journal, setJournal] = useState('');
  const [weather, setWeather] = useState('');
  const [wouldReturn, setWouldReturn] = useState<boolean | undefined>(undefined);
  const [observations, setObservations] = useState<RatingMap>({});
  const [updateKeys, setUpdateKeys] = useState<CriterionKey[]>([]);

  const site = useMemo(() => sites.find((item) => item.id === siteId), [siteId, sites]);
  const nights = calculateNights(arrivalDate, departureDate);

  useEffect(() => {
    if (!site) return;
    setObservations({ ...site.currentFacts });
    setUpdateKeys([]);
  }, [site]);

  function setRating(key: CriterionKey, raw: string) {
    setObservations((current) => {
      const next = { ...current };
      if (raw === '') delete next[key];
      else next[key] = Number(raw);
      return next;
    });
  }

  function toggleUpdate(key: CriterionKey) {
    setUpdateKeys((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!site || nights < 1) return;
    onSave({
      siteId: site.id,
      arrivalDate,
      departureDate,
      nights,
      nightlyRate: nightlyRate ? Number(nightlyRate) : undefined,
      journal: journal.trim(),
      weather: weather.trim() || undefined,
      wouldReturn,
      observations,
      updateCurrentKeys: updateKeys,
    });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="stay-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">Camping diary</p>
            <h2 id="stay-title">Log a stay</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close"><X /></button>
        </div>
        <form onSubmit={submit}>
          <section className="form-section">
            <h3>Where and when</h3>
            <label className="field span-2">
              <span>Campsite</span>
              <div className="select-wrap">
                <select value={siteId} onChange={(event) => setSiteId(event.target.value)}>
                  {sites.map((item) => <option key={item.id} value={item.id}>{item.park} · {item.loop} {item.siteNumber}</option>)}
                </select>
                <ChevronDown size={17} />
              </div>
            </label>
            <div className="form-grid">
              <label className="field"><span>Arrival</span><input type="date" value={arrivalDate} onChange={(event) => setArrivalDate(event.target.value)} required /></label>
              <label className="field"><span>Departure</span><input type="date" value={departureDate} min={arrivalDate} onChange={(event) => setDepartureDate(event.target.value)} required /></label>
            </div>
            <div className={`night-summary ${nights < 1 ? 'night-summary-warning' : ''}`}><Moon size={18} /> {nights > 0 ? `${nights} ${nights === 1 ? 'night' : 'nights'}` : 'Departure must be after arrival'}</div>
            <div className="form-grid">
              <label className="field"><span>Nightly rate</span><input type="number" min="0" step="0.01" value={nightlyRate} onChange={(event) => setNightlyRate(event.target.value)} placeholder="$0.00" /></label>
              <label className="field"><span>Weather</span><input value={weather} onChange={(event) => setWeather(event.target.value)} placeholder="Cool, rainy, windy…" /></label>
            </div>
          </section>

          <section className="form-section">
            <div className="section-heading-row">
              <div><h3>What was the site like?</h3><p>Previous physical information is prefilled. Check “update profile” only when the campsite itself changed.</p></div>
              <CalendarDays size={22} />
            </div>
            <div className="observation-table">
              {CRITERIA.map((criterion) => {
                const previous = site?.currentFacts[criterion.key];
                const current = observations[criterion.key];
                const changed = previous !== current;
                return (
                  <div className="observation-row" key={criterion.key}>
                    <div><strong>{criterion.label}</strong><small>{previous === undefined ? 'No previous rating' : `Previous: ${previous}/5`}</small></div>
                    <select aria-label={`${criterion.label} rating`} value={current ?? ''} onChange={(event) => setRating(criterion.key, event.target.value)}>
                      <option value="">Did not check</option>
                      {[0, 1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating} — {rating === 0 ? 'Terrible/none' : rating === 5 ? 'Excellent' : 'Rated'}</option>)}
                    </select>
                    <label className={`update-check ${!changed ? 'update-check-disabled' : ''}`}>
                      <input type="checkbox" disabled={!changed || current === undefined} checked={updateKeys.includes(criterion.key)} onChange={() => toggleUpdate(criterion.key)} />
                      Update site profile
                    </label>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="form-section">
            <h3>Diary entry</h3>
            <label className="field"><span>Notes from this stay</span><textarea rows={5} value={journal} onChange={(event) => setJournal(event.target.value)} placeholder="What happened, what worked, what would you do differently?" /></label>
            <fieldset className="return-field">
              <legend>Would you book this exact site again?</legend>
              <button type="button" className={wouldReturn === true ? 'choice active' : 'choice'} onClick={() => setWouldReturn(true)}>Yes</button>
              <button type="button" className={wouldReturn === false ? 'choice active' : 'choice'} onClick={() => setWouldReturn(false)}>No</button>
              <button type="button" className={wouldReturn === undefined ? 'choice active' : 'choice'} onClick={() => setWouldReturn(undefined)}>Unsure</button>
            </fieldset>
          </section>

          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-button" disabled={!site || nights < 1}>Save diary entry</button>
          </div>
        </form>
      </div>
    </div>
  );
}
