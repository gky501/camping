import { BookOpen, Eye, MapPin, Moon, Pencil, Plus, Search, TentTree, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { camperSubtitle, camperTypeLabel } from '../lib/campers';
import { loadCamperMaintenance, maintenanceTiming, saveCamperMaintenance, type CamperMaintenanceMap, type CamperMaintenanceRecord } from '../lib/camperMaintenance';
import { formatDateRange } from '../lib/dates';
import { tripStatus } from '../lib/trips';
import type { CamperProfile, Campsite, Stay } from '../types';
import { CamperMaintenanceManager } from './CamperMaintenanceManager';
import { TripStatusPill } from './TripPills';

function camperStats(camper: CamperProfile, stays: Stay[], sites: Campsite[]) {
  const trips = stays.filter((stay) => stay.camperId === camper.id);
  const completed = trips.filter((stay) => tripStatus(stay) === 'completed');
  const parks = new Set(trips.map((stay) => {
    const site = sites.find((item) => item.id === stay.siteId);
    const location = stay.siteSnapshot ?? site;
    return location ? `${location.park.toLowerCase()}::${location.state.toLowerCase()}` : '';
  }).filter(Boolean));
  return { trips, completedTrips: completed.length, upcomingTrips: trips.filter((stay) => tripStatus(stay) !== 'completed').length, nights: completed.reduce((sum, stay) => sum + stay.nights, 0), parks: parks.size };
}

function specItems(camper: CamperProfile): Array<[string, string]> {
  const items: Array<[string, string | undefined]> = [
    ['Type', camperTypeLabel(camper.type)], ['Year', camper.year ? String(camper.year) : undefined], ['Make', camper.make], ['Model', camper.model],
    [camper.type === 'tent' ? 'Footprint length' : 'Length', camper.lengthFeet ? `${camper.lengthFeet} ft` : undefined], ['Sleeps', camper.sleeps ? String(camper.sleeps) : undefined],
    ['Tent style', camper.type === 'tent' ? camper.tentStyle : undefined], ['Slide-outs', camper.type !== 'tent' && camper.slideOuts !== undefined ? String(camper.slideOuts) : undefined],
    ['Dry weight', camper.type !== 'tent' && camper.dryWeightLbs ? `${camper.dryWeightLbs.toLocaleString()} lbs` : undefined], ['GVWR', camper.type !== 'tent' && camper.gvwrLbs ? `${camper.gvwrLbs.toLocaleString()} lbs` : undefined],
  ];
  return items.filter((item): item is [string, string] => Boolean(item[1]));
}

function defaultRecord(): CamperMaintenanceRecord { return { active: true, maintenance: [] }; }

function CamperDetailModal({ camper, stays, sites, maintenance, onMaintenanceChange, onClose, onEdit }: {
  camper: CamperProfile; stays: Stay[]; sites: Campsite[]; maintenance: CamperMaintenanceRecord; onMaintenanceChange: (record: CamperMaintenanceRecord) => void; onClose: () => void; onEdit: () => void;
}) {
  const stats = camperStats(camper, stays, sites);
  const trips = [...stats.trips].sort((a, b) => b.arrivalDate.localeCompare(a.arrivalDate));
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="modal-card camper-detail-modal" role="dialog" aria-modal="true" aria-labelledby="camper-detail-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header"><div><p className="eyebrow">Camper profile</p><h2 id="camper-detail-title">{camper.name}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X /></button></div>
        <section className="form-section camper-profile-hero"><div><span className="camper-type-badge"><TentTree size={16} /> {camperTypeLabel(camper.type)}</span><h3>{camperSubtitle(camper)}</h3><p>{camper.notes || 'No camper notes added yet.'}</p></div><div className="camper-stat-strip"><span><strong>{stats.completedTrips}</strong> trips</span><span><strong>{stats.nights}</strong> nights</span><span><strong>{stats.parks}</strong> parks</span>{stats.upcomingTrips > 0 && <span><strong>{stats.upcomingTrips}</strong> upcoming</span>}</div></section>
        <CamperMaintenanceManager record={maintenance} onChange={onMaintenanceChange} />
        <section className="form-section"><div className="section-heading-row"><div><h3>Data sheet</h3><p>Specifications and setup details saved with this camper profile.</p></div></div><div className="camper-data-grid">{specItems(camper).map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><button type="button" className="secondary-button" onClick={onEdit}><Pencil size={16} /> Edit profile</button></section>
        <section className="form-section"><div className="section-heading-row"><div><h3>Trip history</h3><p>Diary entries tagged with this camping setup.</p></div><BookOpen size={22} /></div>{trips.length ? <div className="camper-trip-list">{trips.map((stay) => { const site = sites.find((item) => item.id === stay.siteId); const location = stay.siteSnapshot ?? site; return <div className="camper-trip-row" key={stay.id}><div><TripStatusPill stay={stay} /><strong>{location?.park ?? 'Unknown park'}</strong><span><MapPin size={13} /> {[location?.area, location?.loop ? `Loop ${location.loop}` : '', location?.siteNumber ? `Site ${location.siteNumber}` : ''].filter(Boolean).join(' · ')}</span></div><div className="camper-trip-date"><strong>{formatDateRange(stay.arrivalDate, stay.departureDate)}</strong><span><Moon size={13} /> {stay.nights} nights</span></div></div>; })}</div> : <div className="mini-empty-state">No trips have been tagged with this profile yet. Edit a diary entry to assign it.</div>}</section>
        <div className="modal-actions"><button type="button" className="primary-button" onClick={onClose}>Done</button></div>
      </div>
    </div>
  );
}

export function CampersPanel({ campers, stays, sites, onAdd, onEdit, onDelete }: { campers: CamperProfile[]; stays: Stay[]; sites: Campsite[]; onAdd: () => void; onEdit: (camper: CamperProfile) => void; onDelete: (camper: CamperProfile) => void; }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<CamperProfile>();
  const [maintenanceMap, setMaintenanceMap] = useState<CamperMaintenanceMap>({});
  useEffect(() => { loadCamperMaintenance().then(setMaintenanceMap).catch(() => undefined); }, []);
  const filtered = useMemo(() => { const query = search.trim().toLowerCase(); return campers.filter((camper) => !query || `${camper.name} ${camperTypeLabel(camper.type)} ${camper.year ?? ''} ${camper.make ?? ''} ${camper.model ?? ''} ${camper.notes}`.toLowerCase().includes(query)); }, [campers, search]);
  const totalNights = stays.filter((stay) => stay.camperId && tripStatus(stay) === 'completed').reduce((sum, stay) => sum + stay.nights, 0);
  const activeCampers = campers.filter((camper) => (maintenanceMap[camper.id]?.active ?? true)).length;
  const dueItems = campers.flatMap((camper) => { const record = maintenanceMap[camper.id] ?? defaultRecord(); return record.active ? record.maintenance.filter((item) => ['overdue', 'soon'].includes(maintenanceTiming(item))) : []; }).length;

  function updateMaintenance(camperId: string, record: CamperMaintenanceRecord) {
    const next = { ...maintenanceMap, [camperId]: record };
    setMaintenanceMap(next);
    saveCamperMaintenance(next).catch(() => undefined);
  }

  return (
    <section className="content-page">
      <div className="page-heading"><div><p className="eyebrow">Your camping setups</p><h2>Campers</h2><p>Keep every camper in your trip history, but only mark current setups in use so retired campers do not generate maintenance reminders.</p></div><button type="button" className="primary-button" onClick={onAdd}><Plus size={18} /> Add camper</button></div>
      <div className="summary-grid camper-summary-grid"><div className="summary-card"><TentTree /><div><strong>{activeCampers}</strong><span>campers in use</span></div></div><div className="summary-card"><Moon /><div><strong>{totalNights}</strong><span>tagged completed nights</span></div></div><div className="summary-card"><BookOpen /><div><strong>{dueItems}</strong><span>maintenance items due</span></div></div></div>
      <label className="search-field page-search"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search camper name, make, model, or notes" /></label>
      <div className="camper-card-grid">{filtered.map((camper) => { const stats = camperStats(camper, stays, sites); const maintenance = maintenanceMap[camper.id] ?? defaultRecord(); const alerts = maintenance.active ? maintenance.maintenance.filter((item) => ['overdue', 'soon'].includes(maintenanceTiming(item))).length : 0; return <article className={`camper-card ${maintenance.active ? '' : 'camper-card-inactive'}`} key={camper.id}><div className="camper-card-heading"><div><span className="camper-type-badge"><TentTree size={14} /> {camperTypeLabel(camper.type)}</span><h3>{camper.name}</h3><p>{camperSubtitle(camper)}</p></div><span className={maintenance.active ? 'camper-use-status active' : 'camper-use-status'}>{maintenance.active ? 'In use' : 'Not in use'}</span></div><div className="camper-card-stats"><span><strong>{stats.completedTrips}</strong> trips</span><span><strong>{stats.nights}</strong> nights</span><span><strong>{stats.parks}</strong> parks</span></div>{alerts > 0 && <span className="maintenance-alert-pill">{alerts} maintenance {alerts === 1 ? 'item' : 'items'} due</span>}<p className="camper-card-note">{camper.notes || 'No profile notes yet.'}</p><div className="button-row camper-card-actions"><button type="button" className="secondary-button" onClick={() => setSelected(camper)}><Eye size={16} /> View & maintain</button><button type="button" className="secondary-button" onClick={() => onEdit(camper)}><Pencil size={16} /> Edit</button><button type="button" className="danger-button" disabled={camper.id === 'camper-tent'} title={camper.id === 'camper-tent' ? 'The Tent Camping profile is kept available' : 'Delete camper profile'} onClick={() => onDelete(camper)}><Trash2 size={16} /></button></div></article>; })}</div>
      {!filtered.length && <div className="empty-state"><TentTree size={42} /><h3>No camper profiles match that search.</h3><p>Add your camper or clear the search.</p></div>}
      {selected && <CamperDetailModal camper={selected} stays={stays} sites={sites} maintenance={maintenanceMap[selected.id] ?? defaultRecord()} onMaintenanceChange={(record) => updateMaintenance(selected.id, record)} onClose={() => setSelected(undefined)} onEdit={() => { setSelected(undefined); onEdit(selected); }} />}
    </section>
  );
}
