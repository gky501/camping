import { useMemo, useState } from 'react';
import { BookOpen, CalendarDays, Eye, Moon, Plus, Search } from 'lucide-react';
import { formatDateRange } from '../lib/dates';
import type { Campsite, Stay } from '../types';
import { StayDetailModal } from './StayDetailModal';

export function DiaryPanel({ sites, stays, onAdd }: { sites: Campsite[]; stays: Stay[]; onAdd: () => void }) {
  const [search, setSearch] = useState('');
  const [selectedStay, setSelectedStay] = useState<Stay>();
  const sorted = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...stays]
      .filter((stay) => {
        const site = sites.find((item) => item.id === stay.siteId);
        const location = stay.siteSnapshot ?? site;
        const haystack = `${location?.park ?? ''} ${location?.state ?? ''} ${location?.area ?? ''} ${location?.loop ?? ''} ${location?.siteNumber ?? ''} ${stay.journal} ${stay.weather ?? ''}`.toLowerCase();
        return !query || haystack.includes(query);
      })
      .sort((a, b) => b.arrivalDate.localeCompare(a.arrivalDate));
  }, [search, sites, stays]);
  const legacyStays = sites.reduce((sum, site) => sum + site.legacyStayCount, 0);

  return (
    <section className="content-page">
      <div className="page-heading">
        <div><p className="eyebrow">Trip history</p><h2>Camping diary</h2><p>Open any dated stay to review the campsite, exact location, ratings, cost, weather, and notes from that trip.</p></div>
        <button className="primary-button" onClick={onAdd}><Plus size={18} /> Log a stay</button>
      </div>
      <div className="summary-grid">
        <div className="summary-card"><BookOpen /><div><strong>{stays.length}</strong><span>Dated diary entries</span></div></div>
        <div className="summary-card"><Moon /><div><strong>{stays.reduce((sum, stay) => sum + stay.nights, 0)}</strong><span>Dated nights</span></div></div>
        <div className="summary-card"><CalendarDays /><div><strong>{legacyStays}</strong><span>Imported stays without dates</span></div></div>
      </div>
      <label className="search-field page-search"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search park, area, loop, site, weather, or notes" /></label>
      {sorted.length === 0 ? (
        <div className="empty-state"><BookOpen size={42} /><h3>{stays.length ? 'No stays match that search.' : 'Your campsite list is imported.'}</h3><p>{stays.length ? 'Try a different park, site number, or note.' : 'Log the next stay with arrival and departure dates. Existing physical ratings will be prefilled automatically.'}</p>{!stays.length && <button className="primary-button" onClick={onAdd}>Create the first dated entry</button>}</div>
      ) : (
        <div className="timeline">
          {sorted.map((stay) => {
            const site = sites.find((item) => item.id === stay.siteId);
            const location = stay.siteSnapshot ?? site;
            const locationLine = [location?.area, location?.loop ? `Loop ${location.loop}` : '', location?.siteNumber ? `Site ${location.siteNumber}` : ''].filter(Boolean).join(' · ');
            return (
              <article className="timeline-entry" key={stay.id}>
                <div className="timeline-dot" />
                <div className="timeline-card">
                  <p className="eyebrow">{formatDateRange(stay.arrivalDate, stay.departureDate)}</p>
                  <div className="timeline-title"><div><h3>{location?.park ?? 'Unknown campsite'}</h3><p>{locationLine}</p></div><span className="night-pill"><Moon size={15} /> {stay.nights}</span></div>
                  {stay.journal && <p className="timeline-journal">{stay.journal}</p>}
                  <div className="chip-row">
                    {stay.weather && <span className="chip">{stay.weather}</span>}
                    {stay.nightlyRate !== undefined && <span className="chip">${stay.nightlyRate.toFixed(2)}/night</span>}
                    {stay.wouldReturn !== undefined && <span className="chip">{stay.wouldReturn ? 'Would return' : 'Would not return'}</span>}
                  </div>
                  <button type="button" className="text-button view-stay-button" onClick={() => setSelectedStay(stay)}><Eye size={16} /> View full stay</button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {selectedStay && <StayDetailModal stay={selectedStay} site={sites.find((site) => site.id === selectedStay.siteId)} onClose={() => setSelectedStay(undefined)} />}
    </section>
  );
}
