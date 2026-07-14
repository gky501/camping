import { BookOpen, CalendarDays, Moon, Plus } from 'lucide-react';
import { formatDateRange } from '../lib/dates';
import type { Campsite, Stay } from '../types';

export function DiaryPanel({ sites, stays, onAdd }: { sites: Campsite[]; stays: Stay[]; onAdd: () => void }) {
  const sorted = [...stays].sort((a, b) => b.arrivalDate.localeCompare(a.arrivalDate));
  const legacyStays = sites.reduce((sum, site) => sum + site.legacyStayCount, 0);

  return (
    <section className="content-page">
      <div className="page-heading">
        <div><p className="eyebrow">Trip history</p><h2>Camping diary</h2><p>Every dated stay lives here. Imported spreadsheet stays remain labeled as undated history until you add their dates.</p></div>
        <button className="primary-button" onClick={onAdd}><Plus size={18} /> Log a stay</button>
      </div>
      <div className="summary-grid">
        <div className="summary-card"><BookOpen /><div><strong>{stays.length}</strong><span>Dated diary entries</span></div></div>
        <div className="summary-card"><Moon /><div><strong>{stays.reduce((sum, stay) => sum + stay.nights, 0)}</strong><span>Dated nights</span></div></div>
        <div className="summary-card"><CalendarDays /><div><strong>{legacyStays}</strong><span>Imported stays without dates</span></div></div>
      </div>
      {sorted.length === 0 ? (
        <div className="empty-state"><BookOpen size={42} /><h3>Your campsite list is imported.</h3><p>Log the next stay with arrival and departure dates. The site’s existing physical ratings will be prefilled automatically.</p><button className="primary-button" onClick={onAdd}>Create the first dated entry</button></div>
      ) : (
        <div className="timeline">
          {sorted.map((stay) => {
            const site = sites.find((item) => item.id === stay.siteId);
            return (
              <article className="timeline-entry" key={stay.id}>
                <div className="timeline-dot" />
                <div className="timeline-card">
                  <p className="eyebrow">{formatDateRange(stay.arrivalDate, stay.departureDate)}</p>
                  <div className="timeline-title"><div><h3>{site?.park ?? 'Unknown campsite'}</h3><p>{site ? `${site.loop} · Site ${site.siteNumber}` : ''}</p></div><span className="night-pill"><Moon size={15} /> {stay.nights}</span></div>
                  {stay.journal && <p>{stay.journal}</p>}
                  <div className="chip-row">
                    {stay.weather && <span className="chip">{stay.weather}</span>}
                    {stay.nightlyRate !== undefined && <span className="chip">${stay.nightlyRate.toFixed(2)}/night</span>}
                    {stay.wouldReturn !== undefined && <span className="chip">{stay.wouldReturn ? 'Would return' : 'Would not return'}</span>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
