import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  CloudSun,
  ExternalLink,
  ImagePlus,
  KeyRound,
  LoaderCircle,
  MapPin,
  Navigation,
  Pencil,
  ShieldAlert,
  TentTree,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import { deleteTripPhotoRemote, uploadTripPhotoRemote } from '../lib/api';
import { equipmentLifeInfo, formatEquipmentDate } from '../lib/equipment';
import { formatDateRange } from '../lib/dates';
import { camperSiteFit, countdownCopy, wazeDirectionsUrl, weatherCodeLabel } from '../lib/tripDashboard';
import type { CamperProfile, Campsite, EquipmentInventory, Stay, TripDetail, TripPhoto } from '../types';

interface ForecastDay {
  date: string;
  high: number;
  low: number;
  precipitation: number;
  code: number;
}

interface ForecastResponse {
  daily?: {
    time?: string[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: number[];
    weather_code?: number[];
  };
}

interface EquipmentWarning {
  id: string;
  tone: 'danger' | 'warning';
  text: string;
}

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(`${value}T12:00:00`));
}

function equipmentMessage(label: string, kind: 'replace' | 'overdue' | 'nearing' | 'watch', dueDate?: string, note?: string): string {
  if (kind === 'replace') return `${label.toUpperCase()} NEEDS TO BE REPLACED${note ? ` — ${note}` : ''}`;
  if (kind === 'overdue') return `${label} replacement overdue${dueDate ? ` since ${formatEquipmentDate(dueDate)}` : ''}`;
  if (kind === 'nearing') return `${label} nearing end of life${dueDate ? ` · due ${formatEquipmentDate(dueDate)}` : ''}`;
  return `${label} is marked Watch${note ? ` — ${note}` : ''}`;
}

export function TripDashboardModal({
  stay,
  site,
  camper,
  equipmentInventory,
  detail,
  onSaveDetail,
  onChecklist,
  onEdit,
  onClose,
}: {
  stay: Stay;
  site?: Campsite;
  camper?: CamperProfile;
  equipmentInventory: EquipmentInventory;
  detail?: TripDetail;
  onSaveDetail: (detail: TripDetail) => void;
  onChecklist: () => void;
  onEdit: () => void;
  onClose: () => void;
}) {
  const location = stay.siteSnapshot ?? site;
  const safeDetail: TripDetail = detail ?? { photos: [] };
  const [gateCode, setGateCode] = useState(safeDetail.gateCode ?? '');
  const [forecast, setForecast] = useState<ForecastDay[]>([]);
  const [forecastStatus, setForecastStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [photoStatus, setPhotoStatus] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const countdown = countdownCopy(stay, location?.park ?? 'your trip');
  const fit = camperSiteFit(camper, location?.amenities);

  useEffect(() => {
    setGateCode(safeDetail.gateCode ?? '');
  }, [safeDetail.gateCode, stay.id]);

  useEffect(() => {
    if (!location) {
      setForecastStatus('unavailable');
      return;
    }
    const controller = new AbortController();
    const query = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
      temperature_unit: 'fahrenheit',
      timezone: 'auto',
      forecast_days: '16',
    });
    setForecastStatus('loading');
    fetch(`https://api.open-meteo.com/v1/forecast?${query}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Forecast failed: ${response.status}`);
        return response.json() as Promise<ForecastResponse>;
      })
      .then((payload) => {
        const daily = payload.daily;
        if (!daily?.time?.length) throw new Error('Forecast unavailable');
        const tripDays = daily.time.flatMap((date, index) => {
          if (date < stay.arrivalDate || date > stay.departureDate) return [];
          return [{
            date,
            high: Math.round(daily.temperature_2m_max?.[index] ?? 0),
            low: Math.round(daily.temperature_2m_min?.[index] ?? 0),
            precipitation: Math.round(daily.precipitation_probability_max?.[index] ?? 0),
            code: Number(daily.weather_code?.[index] ?? 0),
          }];
        });
        setForecast(tripDays);
        setForecastStatus(tripDays.length ? 'ready' : 'unavailable');
      })
      .catch((cause) => {
        if ((cause as Error).name !== 'AbortError') setForecastStatus('unavailable');
      });
    return () => controller.abort();
  }, [location?.latitude, location?.longitude, stay.arrivalDate, stay.departureDate]);

  const equipmentWarnings = useMemo<EquipmentWarning[]>(() => {
    const warnings: EquipmentWarning[] = [];
    for (const item of equipmentInventory.items) {
      const life = equipmentLifeInfo(item);
      if (item.condition === 'replace') {
        warnings.push({ id: `${item.id}-replace`, tone: 'danger', text: equipmentMessage(item.label, 'replace', life.nextDueDate, item.note) });
      } else if (life.status === 'overdue') {
        warnings.push({ id: `${item.id}-overdue`, tone: 'danger', text: equipmentMessage(item.label, 'overdue', life.nextDueDate, item.note) });
      } else if (life.status === 'nearing') {
        warnings.push({ id: `${item.id}-nearing`, tone: 'warning', text: equipmentMessage(item.label, 'nearing', life.nextDueDate, item.note) });
      } else if (item.condition === 'watch') {
        warnings.push({ id: `${item.id}-watch`, tone: 'warning', text: equipmentMessage(item.label, 'watch', life.nextDueDate, item.note) });
      }
    }
    return warnings;
  }, [equipmentInventory]);

  function saveGateCode() {
    onSaveDetail({ ...safeDetail, gateCode: gateCode.trim() || undefined, photos: safeDetail.photos ?? [] });
  }

  async function addPhoto(file?: File) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPhotoStatus('Choose an image file.');
      return;
    }
    setUploadingPhoto(true);
    setPhotoStatus('Uploading photo…');
    try {
      const photo = await uploadTripPhotoRemote(stay.id, file);
      onSaveDetail({ ...safeDetail, gateCode: safeDetail.gateCode, photos: [...(safeDetail.photos ?? []), photo] });
      setPhotoStatus('Photo added.');
    } catch (cause) {
      setPhotoStatus(cause instanceof Error ? cause.message : 'Unable to upload the photo.');
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function deletePhoto(photo: TripPhoto) {
    if (!window.confirm('Remove this photo from the trip?')) return;
    try {
      await deleteTripPhotoRemote(photo.key);
      onSaveDetail({ ...safeDetail, photos: (safeDetail.photos ?? []).filter((item) => item.id !== photo.id) });
    } catch (cause) {
      setPhotoStatus(cause instanceof Error ? cause.message : 'Unable to remove the photo.');
    }
  }

  return (
    <div className="modal-backdrop trip-dashboard-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="modal-card trip-dashboard-modal" role="dialog" aria-modal="true" aria-labelledby="trip-dashboard-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header trip-dashboard-header">
          <div><p className="eyebrow">Trip dashboard</p><h2 id="trip-dashboard-title">{location?.park ?? 'Camping trip'}</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="Close"><X /></button>
        </div>

        <section className="trip-dashboard-countdown">
          <div><p className="eyebrow">{countdown.eyebrow}</p><h3>{countdown.headline}</h3><p>{countdown.detail} · {formatDateRange(stay.arrivalDate, stay.departureDate)}</p></div>
          <CalendarDays />
        </section>

        <div className="trip-dashboard-grid">
          <section className="trip-dashboard-card trip-dashboard-fit-card">
            <div className="trip-dashboard-card-heading"><div><p className="eyebrow">Camper & campsite</p><h3>Site-fit summary</h3></div><TentTree /></div>
            <div className={`trip-fit-result ${fit.tone}`}>
              {fit.tone === 'good' ? <CheckCircle2 /> : fit.tone === 'watch' ? <AlertTriangle /> : <TentTree />}
              <div><strong>{fit.title}</strong><p>{fit.detail}</p></div>
            </div>
            {location && <p className="trip-dashboard-location"><MapPin size={16} /> {[location.area, location.loop ? `Loop ${location.loop}` : '', `Site ${location.siteNumber}`].filter(Boolean).join(' · ')}</p>}
          </section>

          <section className="trip-dashboard-card trip-dashboard-directions-card">
            <div className="trip-dashboard-card-heading"><div><p className="eyebrow">Get there</p><h3>Directions via Waze</h3></div><Navigation /></div>
            {location ? <a className="primary-button trip-waze-button" href={wazeDirectionsUrl(location.latitude, location.longitude)} target="_blank" rel="noreferrer"><Navigation size={18} /> Start Waze directions <ExternalLink size={15} /></a> : <p className="trip-dashboard-muted">Add campsite coordinates to enable directions.</p>}
          </section>

          <section className="trip-dashboard-card trip-dashboard-weather-card">
            <div className="trip-dashboard-card-heading"><div><p className="eyebrow">At the campground</p><h3>Weather forecast</h3></div><CloudSun /></div>
            {forecastStatus === 'loading' && <p className="trip-dashboard-muted"><LoaderCircle className="spin" size={17} /> Loading forecast…</p>}
            {forecastStatus === 'unavailable' && <p className="trip-dashboard-muted">The trip is outside the available forecast window or weather data could not be loaded yet. Check again closer to departure.</p>}
            {forecastStatus === 'ready' && <div className="trip-forecast-strip">{forecast.map((day) => <div key={day.date}><strong>{dateLabel(day.date)}</strong><span>{weatherCodeLabel(day.code)}</span><b>{day.high}° / {day.low}°</b><small>{day.precipitation}% rain</small></div>)}</div>}
          </section>

          <section className="trip-dashboard-card trip-dashboard-gate-card">
            <div className="trip-dashboard-card-heading"><div><p className="eyebrow">Arrival details</p><h3>Gate code</h3></div><KeyRound /></div>
            <div className="trip-gate-row"><input value={gateCode} onChange={(event) => setGateCode(event.target.value)} placeholder="Add gate or entry code" autoComplete="off" /><button className="secondary-button" type="button" onClick={saveGateCode}>Save</button></div>
            <p className="trip-dashboard-muted">Stored with this trip so it is ready at check-in.</p>
          </section>
        </div>

        <section className="trip-dashboard-card trip-equipment-alerts-card">
          <div className="trip-dashboard-card-heading"><div><p className="eyebrow">Before pulling out</p><h3>Equipment attention</h3></div><Wrench /></div>
          {equipmentWarnings.length ? <div className="trip-equipment-alert-list">{equipmentWarnings.map((warning) => <div className={warning.tone} key={warning.id}>{warning.tone === 'danger' ? <ShieldAlert /> : <AlertTriangle />}<strong>{warning.text}</strong></div>)}</div> : <div className="trip-equipment-clear"><CheckCircle2 /><div><strong>No equipment warnings</strong><p>Nothing is marked for replacement, overdue, nearing end of life, or Watch.</p></div></div>}
        </section>

        <section className="trip-dashboard-card trip-photo-card">
          <div className="trip-dashboard-card-heading"><div><p className="eyebrow">Trip memories & setup</p><h3>Photos</h3></div><Camera /></div>
          <label className={`secondary-button trip-photo-upload ${uploadingPhoto ? 'disabled' : ''}`}><ImagePlus size={18} /> {uploadingPhoto ? 'Uploading…' : 'Add photo'}<input type="file" accept="image/*" capture="environment" disabled={uploadingPhoto} onChange={(event) => { void addPhoto(event.target.files?.[0]); event.currentTarget.value = ''; }} /></label>
          {photoStatus && <p className="trip-photo-status">{photoStatus}</p>}
          {(safeDetail.photos ?? []).length ? <div className="trip-photo-grid">{safeDetail.photos.map((photo) => <figure key={photo.id}><img src={photo.url} alt={photo.caption || photo.name} loading="lazy" /><figcaption><span>{photo.caption || photo.name}</span><button type="button" onClick={() => void deletePhoto(photo)} aria-label="Delete photo"><Trash2 size={15} /></button></figcaption></figure>)}</div> : <div className="trip-photo-empty"><Camera /><p>Add campsite setup, hookups, views, or anything you want to remember.</p></div>}
        </section>

        <div className="modal-actions trip-dashboard-actions">
          <button type="button" className="secondary-button" onClick={onEdit}><Pencil size={16} /> Edit trip</button>
          <span className="modal-action-spacer" />
          <button type="button" className="secondary-button" onClick={onChecklist}><ClipboardCheck size={16} /> Open checklist</button>
          <button type="button" className="primary-button" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
