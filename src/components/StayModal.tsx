import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Crosshair, History, MapPinned, Moon, TentTree, X } from 'lucide-react';
import { amenitiesMatch } from '../lib/amenities';
import { camperSubtitle, camperTypeLabel } from '../lib/campers';
import { calculateNights } from '../lib/dates';
import { createId } from '../lib/id';
import { CRITERIA, type CamperProfile, type Campsite, type CriterionKey, type RatingMap, type SiteAmenities, type SiteLocation, type SiteSnapshot, type Stay, type StayDraft } from '../types';
import { AmenityCards } from './AmenityCards';
import { SiteLocationPicker } from './SiteLocationPicker';

interface StayModalProps {
  sites: Campsite[];
  campers: CamperProfile[];
  initialSite?: Campsite;
  initialStay?: Stay;
  onClose: () => void;
  onSave: (draft: StayDraft) => void;
}

const todayDate = new Date();
const today = todayDate.toISOString().slice(0, 10);
const tomorrowDate = new Date(todayDate);
tomorrowDate.setDate(tomorrowDate.getDate() + 1);
const tomorrow = tomorrowDate.toISOString().slice(0, 10);

function siteLabel(site: SiteLocation): string {
  return [site.park, site.area, site.loop ? `Loop ${site.loop}` : '', site.siteNumber ? `Site ${site.siteNumber}` : ''].filter(Boolean).join(' · ');
}

function sameLocation(site: Campsite, location: SiteLocation): boolean {
  return site.park.trim() === location.park.trim()
    && site.state.trim() === location.state.trim()
    && (site.area ?? '').trim() === (location.area ?? '').trim()
    && site.loop.trim() === location.loop.trim()
    && site.siteNumber.trim() === location.siteNumber.trim()
    && site.latitude === location.latitude
    && site.longitude === location.longitude;
}

export function StayModal({ sites, campers, initialSite, initialStay, onClose, onSave }: StayModalProps) {
  const editing = Boolean(initialStay);
  const initialLocation = initialStay?.siteSnapshot ?? initialSite;
  const [selectedSiteId, setSelectedSiteId] = useState(initialStay?.siteId ?? initialSite?.id ?? '');
  const [siteSearch, setSiteSearch] = useState(initialLocation ? siteLabel(initialLocation) : '');
  const [park, setPark] = useState(initialLocation?.park ?? '');
  const [region, setRegion] = useState(initialLocation?.state ?? 'Arkansas');
  const [area, setArea] = useState(initialLocation?.area ?? '');
  const [loop, setLoop] = useState(initialLocation?.loop ?? '');
  const [siteNumber, setSiteNumber] = useState(initialLocation?.siteNumber ?? '');
  const [latitude, setLatitude] = useState(initialLocation ? String(initialLocation.latitude) : '');
  const [longitude, setLongitude] = useState(initialLocation ? String(initialLocation.longitude) : '');
  const [siteNotes, setSiteNotes] = useState(initialSite?.notes ?? '');
  const [amenities, setAmenities] = useState<SiteAmenities>(initialStay?.siteSnapshot?.amenities ?? initialSite?.amenities ?? { features: [] });
  const [updateLocationRecord, setUpdateLocationRecord] = useState(!editing);
  const [locationMessage, setLocationMessage] = useState('');
  const [arrivalDate, setArrivalDate] = useState(initialStay?.arrivalDate ?? today);
  const [departureDate, setDepartureDate] = useState(initialStay?.departureDate ?? tomorrow);
  const [nightlyRate, setNightlyRate] = useState(initialStay?.nightlyRate === undefined ? '' : String(initialStay.nightlyRate));
  const [journal, setJournal] = useState(initialStay?.journal ?? '');
  const [weather, setWeather] = useState(initialStay?.weather ?? '');
  const [wouldReturn, setWouldReturn] = useState<boolean | undefined>(initialStay?.wouldReturn);
  const [observations, setObservations] = useState<RatingMap>(initialStay ? { ...initialStay.observations } : initialSite ? { ...initialSite.currentFacts } : {});
  const [updateKeys, setUpdateKeys] = useState<CriterionKey[]>([]);
  const [camperId, setCamperId] = useState(initialStay?.camperId ?? '');

  const selectedSite = useMemo(() => sites.find((item) => item.id === selectedSiteId), [selectedSiteId, sites]);
  const nights = calculateNights(arrivalDate, departureDate);
  const futureTrip = arrivalDate > today;
  const latitudeNumber = Number(latitude);
  const longitudeNumber = Number(longitude);
  const validCoordinates = latitude.trim() !== '' && longitude.trim() !== '' && Number.isFinite(latitudeNumber) && Number.isFinite(longitudeNumber)
    && latitudeNumber >= -90 && latitudeNumber <= 90 && longitudeNumber >= -180 && longitudeNumber <= 180;
  const location: SiteLocation = { park: park.trim(), state: region.trim() || 'Unknown', area: area.trim(), loop: loop.trim(), siteNumber: siteNumber.trim(), latitude: latitudeNumber, longitude: longitudeNumber };
  const detailsChanged = selectedSite ? !sameLocation(selectedSite, location) || selectedSite.notes !== siteNotes.trim() || !amenitiesMatch(selectedSite.amenities, amenities) : false;
  const canSave = Boolean(location.park && location.siteNumber && validCoordinates && nights > 0);

  function loadSite(site: Campsite) {
    setSelectedSiteId(site.id); setSiteSearch(siteLabel(site)); setPark(site.park); setRegion(site.state); setArea(site.area ?? ''); setLoop(site.loop); setSiteNumber(site.siteNumber);
    setLatitude(String(site.latitude)); setLongitude(String(site.longitude)); setSiteNotes(site.notes); setAmenities(site.amenities ?? { features: [] }); setObservations({ ...site.currentFacts });
    setUpdateKeys([]); setUpdateLocationRecord(true);
  }

  function loadExistingStay(stay: Stay) {
    const site = sites.find((item) => item.id === stay.siteId);
    const snapshot = stay.siteSnapshot ?? site;
    setSelectedSiteId(stay.siteId); setSiteSearch(snapshot ? siteLabel(snapshot) : site ? siteLabel(site) : '');
    if (snapshot) { setPark(snapshot.park); setRegion(snapshot.state); setArea(snapshot.area ?? ''); setLoop(snapshot.loop); setSiteNumber(snapshot.siteNumber); setLatitude(String(snapshot.latitude)); setLongitude(String(snapshot.longitude)); }
    setSiteNotes(site?.notes ?? ''); setAmenities(stay.siteSnapshot?.amenities ?? site?.amenities ?? { features: [] }); setArrivalDate(stay.arrivalDate); setDepartureDate(stay.departureDate);
    setNightlyRate(stay.nightlyRate === undefined ? '' : String(stay.nightlyRate)); setJournal(stay.journal); setWeather(stay.weather ?? ''); setWouldReturn(stay.wouldReturn);
    setObservations({ ...stay.observations }); setUpdateKeys([]); setUpdateLocationRecord(false); setCamperId(stay.camperId ?? '');
  }

  useEffect(() => {
    if (initialStay) loadExistingStay(initialStay); else if (initialSite) loadSite(initialSite);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSite?.id, initialStay?.id]);

  function handleSiteSearch(raw: string) {
    setSiteSearch(raw);
    const match = sites.find((site) => siteLabel(site).toLowerCase() === raw.trim().toLowerCase());
    if (match) { loadSite(match); return; }
    setSelectedSiteId(''); if (raw.trim() && !park.trim()) setPark(raw.trim()); setAmenities({ features: [] }); setObservations({}); setUpdateKeys([]);
  }

  function startNewSite() {
    setSelectedSiteId(''); setSiteSearch(''); setPark(''); setRegion('Arkansas'); setArea(''); setLoop(''); setSiteNumber(''); setLatitude(''); setLongitude(''); setSiteNotes(''); setAmenities({ features: [] }); setObservations({}); setUpdateKeys([]);
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) { setLocationMessage('Location is not available in this browser.'); return; }
    setLocationMessage('Getting your location…');
    navigator.geolocation.getCurrentPosition(
      (position) => { setLatitude(position.coords.latitude.toFixed(7)); setLongitude(position.coords.longitude.toFixed(7)); setLocationMessage(`Location added · accuracy about ${Math.round(position.coords.accuracy)} m`); },
      () => setLocationMessage('Unable to access your location. Pick the site on the map or enter coordinates.'),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  function setRating(key: CriterionKey, raw: string) { setObservations((current) => { const next = { ...current }; if (raw === '') delete next[key]; else next[key] = Number(raw); return next; }); }
  function toggleUpdate(key: CriterionKey) { setUpdateKeys((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]); }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSave) return;
    const siteId = selectedSite?.id ?? createId('site');
    const siteRecord: Campsite = {
      id: siteId, ...location, notes: siteNotes.trim(), amenities,
      viewTypes: selectedSite?.viewTypes ?? [], currentFacts: selectedSite?.currentFacts ?? {}, seasonalRatings: selectedSite?.seasonalRatings ?? {},
      legacyStayCount: selectedSite?.legacyStayCount ?? 0, importedRating: selectedSite?.importedRating, favorite: selectedSite?.favorite ?? false,
      status: futureTrip ? 'reserved' : 'visited',
    };
    const siteSnapshot: SiteSnapshot = { ...location, amenities };
    onSave({
      siteId, camperId: camperId || undefined, siteSnapshot, arrivalDate, departureDate, nights,
      nightlyRate: nightlyRate ? Number(nightlyRate) : undefined, journal: journal.trim(), weather: weather.trim() || undefined,
      wouldReturn: futureTrip ? undefined : wouldReturn, observations,
      updateCurrentKeys: selectedSite ? updateKeys : (Object.keys(observations) as CriterionKey[]),
      createSite: selectedSite ? undefined : siteRecord,
      updateSiteDetails: selectedSite && detailsChanged && updateLocationRecord ? siteRecord : undefined,
    });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="stay-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header"><div><p className="eyebrow">{futureTrip ? 'Upcoming trip plan' : 'Camping diary'}</p><h2 id="stay-title">{editing ? (futureTrip ? 'Edit planned stay' : 'Edit stay') : (futureTrip ? 'Plan a stay' : 'Log a stay')}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X /></button></div>
        <form onSubmit={submit}>
          {futureTrip && <div className="future-plan-banner"><CalendarDays size={19} /><div><strong>Save what you know now.</strong><span>This trip will stay marked Upcoming. Come back after the visit to add weather, ratings, notes, and whether you would return.</span></div></div>}

          <section className="form-section">
            <div className="section-heading-row"><div><h3>Where {futureTrip ? 'will you stay' : 'did you stay'}?</h3><p>{editing ? 'The campsite saved with this entry is loaded below. You can correct it or select another campsite.' : 'Choose one from your history or type a new campsite. The fields remain editable.'}</p></div><History size={22} /></div>
            <label className="field"><span>Find a previous campsite or start typing a new one</span><input list="campsite-history" value={siteSearch} onChange={(event) => handleSiteSearch(event.target.value)} placeholder="Lake Ouachita · Crystal Springs · Loop C · Site 55" autoComplete="off" /><datalist id="campsite-history">{sites.map((site) => <option key={site.id} value={siteLabel(site)} />)}</datalist></label>
            <div className="site-source-row"><span className={selectedSite ? 'history-match matched' : 'history-match'}>{selectedSite ? `Using history from ${siteLabel(selectedSite)}` : 'New campsite — it will be added when this entry is saved.'}</span>{selectedSite && <button type="button" className="text-button" onClick={startNewSite}>Enter a different campsite</button>}</div>
            <div className="form-grid campsite-identity-grid">
              <label className="field"><span>Park</span><input value={park} onChange={(event) => setPark(event.target.value)} placeholder="Lake Ouachita" required /></label>
              <label className="field"><span>State</span><input value={region} onChange={(event) => setRegion(event.target.value)} placeholder="Arkansas" /></label>
              <label className="field"><span>Area</span><input value={area} onChange={(event) => setArea(event.target.value)} placeholder="Crystal Springs" /></label>
              <label className="field"><span>Loop</span><input value={loop} onChange={(event) => setLoop(event.target.value)} placeholder="C" /></label>
              <label className="field"><span>Site</span><input value={siteNumber} onChange={(event) => setSiteNumber(event.target.value)} placeholder="55" required /></label>
              <label className="field"><span>Campsite notes</span><input value={siteNotes} onChange={(event) => setSiteNotes(event.target.value)} placeholder="Lake side, full hookups…" /></label>
            </div>
          </section>

          <section className="form-section">
            <div className="section-heading-row"><div><h3>Camping setup</h3><p>Tag the camper or tent setup used for this trip. You can change it later.</p></div><TentTree size={22} /></div>
            <div className="trip-camper-grid">
              <button type="button" className={!camperId ? 'trip-camper-card active' : 'trip-camper-card'} onClick={() => setCamperId('')}><strong>Not assigned</strong><span>Choose later</span></button>
              {campers.map((camper) => <button type="button" key={camper.id} className={camperId === camper.id ? 'trip-camper-card active' : 'trip-camper-card'} onClick={() => setCamperId(camper.id)}><strong>{camper.name}</strong><span>{camperSubtitle(camper) || camperTypeLabel(camper.type)}</span></button>)}
            </div>
          </section>

          <section className="form-section"><div className="section-heading-row"><div><h3>Hookups and site setup</h3><p>{selectedSite ? 'Amenities are prefilled. Choose the update option only when the permanent campsite profile should also change.' : 'These details will become the starting profile for the new campsite.'}</p></div></div><AmenityCards value={amenities} onChange={setAmenities} />{selectedSite && detailsChanged && <label className="update-location-check"><input type="checkbox" checked={updateLocationRecord} onChange={(event) => setUpdateLocationRecord(event.target.checked)} /> Update the campsite record with these location, amenity, note, or map changes</label>}</section>

          <section className="form-section"><div className="section-heading-row"><div><h3>Pick the exact spot</h3><p>Click the map, use your current location, or enter coordinates.</p></div><button type="button" className="secondary-button" onClick={useCurrentLocation}><Crosshair size={17} /> Use my location</button></div>{locationMessage && <p className="form-help">{locationMessage}</p>}<SiteLocationPicker latitude={validCoordinates ? latitudeNumber : undefined} longitude={validCoordinates ? longitudeNumber : undefined} onPick={(lat, lng) => { setLatitude(lat.toFixed(7)); setLongitude(lng.toFixed(7)); }} /><div className="form-grid coordinate-grid"><label className="field"><span>Latitude</span><input type="number" step="any" value={latitude} onChange={(event) => setLatitude(event.target.value)} required /></label><label className="field"><span>Longitude</span><input type="number" step="any" value={longitude} onChange={(event) => setLongitude(event.target.value)} required /></label></div></section>

          <section className="form-section"><div className="section-heading-row"><div><h3>{futureTrip ? 'When are you staying?' : 'When did you stay?'}</h3></div><MapPinned size={22} /></div><div className="form-grid"><label className="field"><span>Arrival</span><input type="date" value={arrivalDate} onChange={(event) => setArrivalDate(event.target.value)} required /></label><label className="field"><span>Departure</span><input type="date" value={departureDate} min={arrivalDate} onChange={(event) => setDepartureDate(event.target.value)} required /></label></div><div className={`night-summary ${nights < 1 ? 'night-summary-warning' : ''}`}><Moon size={18} /> {nights > 0 ? `${nights} ${nights === 1 ? 'night' : 'nights'}` : 'Departure must be after arrival'}</div><div className="form-grid"><label className="field"><span>Nightly rate</span><input type="number" min="0" step="0.01" value={nightlyRate} onChange={(event) => setNightlyRate(event.target.value)} placeholder="$0.00" /></label><label className="field"><span>{futureTrip ? 'Expected weather or season note' : 'Weather'}</span><input value={weather} onChange={(event) => setWeather(event.target.value)} placeholder="Cool, rainy, windy…" /></label></div></section>

          <section className="form-section"><div className="section-heading-row"><div><h3>What was the site like?</h3><p>{futureTrip ? 'Leave these blank until the trip, or enter anything you already know.' : editing ? 'Changing these ratings updates this diary entry. Check “update site profile” only when the permanent campsite information should also change.' : selectedSite ? 'Previous physical information is prefilled. Check “update profile” only when the campsite itself changed.' : 'These ratings will become the starting physical profile for this new campsite.'}</p></div><CalendarDays size={22} /></div><div className="observation-table">{CRITERIA.map((criterion) => { const previous = selectedSite?.currentFacts[criterion.key]; const current = observations[criterion.key]; const changed = previous !== current; return <div className="observation-row" key={criterion.key}><div><strong>{criterion.label}</strong><small>{previous === undefined ? 'No current site-profile rating' : `Current site profile: ${previous}/5`}</small></div><select aria-label={`${criterion.label} rating`} value={current ?? ''} onChange={(event) => setRating(criterion.key, event.target.value)}><option value="">Did not check</option>{[0,1,2,3,4,5].map((rating) => <option key={rating} value={rating}>{rating} — {rating === 0 ? 'Terrible/none' : rating === 5 ? 'Excellent' : 'Rated'}</option>)}</select>{selectedSite ? <label className={`update-check ${!changed ? 'update-check-disabled' : ''}`}><input type="checkbox" disabled={!changed || current === undefined} checked={updateKeys.includes(criterion.key)} onChange={() => toggleUpdate(criterion.key)} /> Update site profile</label> : <span className="new-site-rating-note">Saved to new site profile</span>}</div>; })}</div></section>

          <section className="form-section"><h3>{futureTrip ? 'Trip planning notes' : 'Diary entry'}</h3><label className="field"><span>{futureTrip ? 'Plans, reservation details, or reminders' : 'Notes from this stay'}</span><textarea rows={5} value={journal} onChange={(event) => setJournal(event.target.value)} placeholder={futureTrip ? 'Arrival plan, gear to pack, reservation number, things to check…' : 'What happened, what worked, what would you do differently?'} /></label>{futureTrip ? <div className="future-return-placeholder"><strong>Would you book this exact site again?</strong><span>That question will appear after the trip.</span></div> : <fieldset className="return-field"><legend>Would you book this exact site again?</legend><button type="button" className={wouldReturn === true ? 'choice active' : 'choice'} onClick={() => setWouldReturn(true)}>Yes</button><button type="button" className={wouldReturn === false ? 'choice active' : 'choice'} onClick={() => setWouldReturn(false)}>No</button><button type="button" className={wouldReturn === undefined ? 'choice active' : 'choice'} onClick={() => setWouldReturn(undefined)}>Unsure</button></fieldset>}</section>

          <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button" disabled={!canSave}>{editing ? 'Save changes' : futureTrip ? 'Save trip plan' : 'Save diary entry'}</button></div>
        </form>
      </div>
    </div>
  );
}
