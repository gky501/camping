import { useMemo, useState } from 'react';
import { BookOpen, CalendarDays, ClipboardCheck, Eye, Gauge, Moon, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { formatDateRange } from '../lib/dates';
import { sortDiaryStays, tripStatus } from '../lib/trips';
import type { CamperProfile, Campsite, Stay } from '../types';
import { StayDetailModal } from './StayDetailModal';
import { TripMetaPills, TripStatusPill } from './TripPills';

export function DiaryPanel({ sites, stays, campers, onAdd, onEdit, onDelete, onChecklist, onDashboard }: {
  sites: Campsite[];
  stays: Stay[];
  campers: CamperProfile[];
  onAdd: () => void;
  onEdit: (stay: Stay) => void;
  onDelete: (stay: Stay) => void;
  onChecklist: (stay: Stay) => void;
  onDashboard: (stay: Stay) => void;
}) {
  const [search, setSearch] = useState('');
  const [selectedStay, setSelectedStay] = useState<Stay>();
  const sorted = useMemo(() => {
    const query = search.trim().toLowerCase();
    return sortDiaryStays(stays.filter((stay) => {
      const site = sites.find((item) => item.id === stay.siteId);
      const camper = campers.find((item) => item.id === stay.camperId);
      const location = stay.siteSnapshot ?? site;
      const haystack = `${location?.park ?? ''} ${location?.state ?? ''} ${location?.area ?? ''} ${location?.loop ?? ''} ${location?.siteNumber ?? ''} ${stay.journal} ${stay.weather ?? ''} ${camper?.name ?? ''}`.toLowerCase();
      return !query || haystack.includes(query);
    }));
  }, [campers, search, sites, stays]);

  const completed = stays.filter((stay) => tripStatus(stay) === 'completed');
  const upcoming = stays.filter((stay) => tripStatus(stay) !== 'completed');
  function editStay(stay: Stay) { setSelectedStay(undefined); onEdit(stay); }
  function deleteStay(stay: Stay) { setSelectedStay(undefined); onDelete(stay); }
  function openChecklist(stay: Stay) { setSelectedStay(undefined); onChecklist(stay); }
  function openDashboard(stay: Stay) { setSelectedStay(undefined); onDashboard(stay); }

  return (
    <section className="content-page">
      <div className="page-heading"><div><p className="eyebrow">Trips and plans</p><h2>Camping diary</h2><p>Upcoming plans stay at the top. Open any entry to finish details, use its trip dashboard, review its checklist, or update the trip after you return.</p></div><button className="primary-button" onClick={onAdd}><Plus size={18} /> Log a stay</button></div>
      <div className="summary-grid diary-summary-grid">
        <div className="summary-card"><BookOpen /><div><strong>{completed.length}</strong><span>Completed stays</span></div></div>
        <div className="summary-card"><Moon /><div><strong>{completed.reduce((sum, stay) => sum + stay.nights, 0)}</strong><span>Completed nights</span></div></div>
        <div className="summary-card upcoming-summary"><CalendarDays /><div><strong>{upcoming.length}</strong><span>Upcoming trips</span></div></div>
      </div>
      <label className="search-field page-search"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search park, camper, area, site, weather, or notes" /></label>
      {sorted.length === 0 ? (
        <div className="empty-state"><BookOpen size={42} /><h3>{stays.length ? 'No trips match that search.' : 'Your diary is ready.'}</h3><p>{stays.length ? 'Try a different park, camper, site number, or note.' : 'Add a future plan or log a completed camping stay.'}</p>{!stays.length && <button className="primary-button" onClick={onAdd}>Create the first entry</button>}</div>
      ) : (
        <div className="timeline">
          {sorted.map((stay) => {
            const site = sites.find((item) => item.id === stay.siteId);
            const camper = campers.find((item) => item.id === stay.camperId);
            const location = stay.siteSnapshot ?? site;
            const status = tripStatus(stay);
            const locationLine = [location?.area, location?.loop ? `Loop ${location.loop}` : '', location?.siteNumber ? `Site ${location.siteNumber}` : ''].filter(Boolean).join(' · ');
            return (
              <article className={`timeline-entry ${status}`} key={stay.id}>
                <div className="timeline-dot" />
                <div className={`timeline-card ${status}`}>
                  <div className="timeline-card-top"><p className="eyebrow">{formatDateRange(stay.arrivalDate, stay.departureDate)}</p><TripStatusPill stay={stay} /></div>
                  <div className="timeline-title"><div><h3>{location?.park ?? 'Unknown campsite'}</h3><p>{locationLine}</p></div><span className="night-pill"><Moon size={15} /> {stay.nights}</span></div>
                  {stay.journal && <p className="timeline-journal">{stay.journal}</p>}
                  <TripMetaPills stay={stay} camper={camper} />
                  <div className="button-row diary-entry-actions">
                    <button type="button" className="text-button trip-dashboard-button" onClick={() => openDashboard(stay)}><Gauge size={16} /> Trip dashboard</button>
                    <button type="button" className="text-button view-stay-button" onClick={() => setSelectedStay(stay)}><Eye size={16} /> View full {status === 'upcoming' ? 'plan' : 'stay'}</button>
                    <button type="button" className="text-button diary-checklist-button" onClick={() => openChecklist(stay)}><ClipboardCheck size={16} /> Checklist</button>
                    <button type="button" className="text-button" onClick={() => editStay(stay)}><Pencil size={16} /> Edit</button>
                    <button type="button" className="text-button destructive-text-button" onClick={() => deleteStay(stay)}><Trash2 size={16} /> Delete</button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {selectedStay && <StayDetailModal stay={selectedStay} site={sites.find((site) => site.id === selectedStay.siteId)} camper={campers.find((camper) => camper.id === selectedStay.camperId)} onDashboard={() => openDashboard(selectedStay)} onChecklist={() => openChecklist(selectedStay)} onEdit={() => editStay(selectedStay)} onDelete={() => deleteStay(selectedStay)} onClose={() => setSelectedStay(undefined)} />}
    </section>
  );
}
