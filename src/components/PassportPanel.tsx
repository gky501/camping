import { useEffect, useMemo, useState } from 'react';
import { BarChart3, BookOpen, CalendarDays, ChevronRight, ClipboardCheck, Gauge, MapPin, Moon, Plus, TentTree, Trophy } from 'lucide-react';
import { formatDateRange } from '../lib/dates';
import { tripStatus } from '../lib/trips';
import type { CamperProfile, Campsite, Stay } from '../types';
import { StayDetailModal } from './StayDetailModal';
import { TripMetaPills, TripStatusPill } from './TripPills';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function locationFor(stay: Stay, sites: Campsite[]) {
  return stay.siteSnapshot ?? sites.find((site) => site.id === stay.siteId);
}

function parkKey(stay: Stay, sites: Campsite[]): string {
  const location = locationFor(stay, sites);
  return location ? `${location.park.trim().toLowerCase()}::${location.state.trim().toLowerCase()}` : 'unknown';
}

function distributeNightsByMonth(stays: Stay[]): number[] {
  const totals = Array.from({ length: 12 }, () => 0);
  for (const stay of stays) {
    const arrival = new Date(`${stay.arrivalDate}T12:00:00`);
    if (Number.isNaN(arrival.getTime())) continue;
    for (let night = 0; night < stay.nights; night += 1) {
      const date = new Date(arrival);
      date.setDate(arrival.getDate() + night);
      totals[date.getMonth()] += 1;
    }
  }
  return totals;
}

function locationLine(stay: Stay, sites: Campsite[]): string {
  const location = locationFor(stay, sites);
  return [location?.area, location?.loop ? `Loop ${location.loop}` : '', location?.siteNumber ? `Site ${location.siteNumber}` : ''].filter(Boolean).join(' · ');
}

function currency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

export function PassportPanel({ sites, stays, campers, onAdd, onEdit, onDelete, onChecklist, onDashboard, onOpenRecap }: {
  sites: Campsite[];
  stays: Stay[];
  campers: CamperProfile[];
  onAdd: () => void;
  onEdit: (stay: Stay) => void;
  onDelete: (stay: Stay) => void;
  onChecklist: (stay: Stay) => void;
  onDashboard: (stay: Stay) => void;
  onOpenRecap: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const currentYear = new Date().getFullYear();
  const availableYears = useMemo(() => {
    const years = new Set(stays.map((stay) => Number(stay.arrivalDate.slice(0, 4))).filter(Number.isFinite));
    years.add(currentYear);
    return [...years].sort((a, b) => b - a);
  }, [currentYear, stays]);
  const [year, setYear] = useState(currentYear);
  const [completedVisible, setCompletedVisible] = useState(8);
  const [selectedStay, setSelectedStay] = useState<Stay>();

  useEffect(() => {
    if (!availableYears.includes(year)) setYear(availableYears[0] ?? currentYear);
  }, [availableYears, currentYear, year]);

  const upcoming = useMemo(() => stays
    .filter((stay) => tripStatus(stay) !== 'completed')
    .sort((a, b) => a.arrivalDate.localeCompare(b.arrivalDate)), [stays]);
  const completed = useMemo(() => stays
    .filter((stay) => tripStatus(stay) === 'completed')
    .sort((a, b) => b.departureDate.localeCompare(a.departureDate)), [stays]);
  const yearStays = useMemo(() => stays.filter((stay) => Number(stay.arrivalDate.slice(0, 4)) === year), [stays, year]);
  const yearStarted = useMemo(() => yearStays.filter((stay) => stay.arrivalDate <= today), [today, yearStays]);

  const yearStats = useMemo(() => {
    const parks = new Set(yearStarted.map((stay) => parkKey(stay, sites)));
    const states = new Set(yearStarted.map((stay) => locationFor(stay, sites)?.state).filter(Boolean));
    const nights = yearStarted.reduce((sum, stay) => sum + stay.nights, 0);
    const cost = yearStarted.reduce((sum, stay) => sum + (stay.nightlyRate ?? 0) * stay.nights, 0);
    return {
      trips: yearStays.length,
      nights,
      parks: parks.has('unknown') ? Math.max(0, parks.size - 1) : parks.size,
      states: states.size,
      cost,
      planned: yearStays.filter((stay) => stay.arrivalDate > today).length,
      monthly: distributeNightsByMonth(yearStarted),
    };
  }, [sites, today, yearStarted, yearStays]);

  const lifetimeStats = useMemo(() => {
    const parks = new Set(completed.map((stay) => parkKey(stay, sites)));
    const states = new Set(completed.map((stay) => locationFor(stay, sites)?.state).filter(Boolean));
    return {
      trips: completed.length,
      nights: completed.reduce((sum, stay) => sum + stay.nights, 0),
      parks: parks.has('unknown') ? Math.max(0, parks.size - 1) : parks.size,
      states: states.size,
    };
  }, [completed, sites]);

  const maxMonth = Math.max(...yearStats.monthly, 1);
  const visibleCompleted = completed.slice(0, completedVisible);

  function editStay(stay: Stay) { setSelectedStay(undefined); onEdit(stay); }
  function deleteStay(stay: Stay) { setSelectedStay(undefined); onDelete(stay); }
  function openChecklist(stay: Stay) { setSelectedStay(undefined); onChecklist(stay); }
  function openDashboard(stay: Stay) { setSelectedStay(undefined); onDashboard(stay); }

  return (
    <section className="content-page passport-page">
      <div className="passport-hero">
        <div>
          <p className="eyebrow">Your camping passport</p>
          <h2>Trips, memories, and what is next</h2>
          <p>One place for upcoming plans, completed stays, and the numbers behind your camping story.</p>
        </div>
        <button className="primary-button" onClick={onAdd}><Plus size={18} /> Add trip</button>
      </div>

      <div className="passport-stat-layout">
        <article className="passport-stat-card year-card">
          <div className="passport-stat-heading">
            <div><p className="eyebrow">Year in progress</p><h3>{year}</h3></div>
            <label><span>Year</span><select value={year} onChange={(event) => setYear(Number(event.target.value))}>{availableYears.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          </div>
          <div className="passport-stat-numbers">
            <span><strong>{yearStats.trips}</strong> trips</span>
            <span><strong>{yearStats.nights}</strong> nights</span>
            <span><strong>{yearStats.parks}</strong> parks</span>
            <span><strong>{yearStats.states}</strong> states</span>
          </div>
          <div className="passport-month-strip" aria-label={`${year} nights by month`}>
            {yearStats.monthly.map((nights, index) => <div key={MONTH_LABELS[index]} title={`${MONTH_LABELS[index]}: ${nights} nights`}><span style={{ height: `${Math.max(7, (nights / maxMonth) * 100)}%` }} /><small>{MONTH_LABELS[index]}</small></div>)}
          </div>
          <p className="passport-stat-detail">{yearStats.planned} upcoming · {currency(yearStats.cost)} recorded campsite cost</p>
        </article>

        <article className="passport-stat-card lifetime-card">
          <div className="passport-stat-heading"><div><p className="eyebrow">All-time record</p><h3>Lifetime</h3></div><Trophy /></div>
          <div className="passport-stat-numbers lifetime-numbers">
            <span><strong>{lifetimeStats.trips}</strong> completed trips</span>
            <span><strong>{lifetimeStats.nights}</strong> nights camped</span>
            <span><strong>{lifetimeStats.parks}</strong> parks visited</span>
            <span><strong>{lifetimeStats.states}</strong> states</span>
          </div>
          <button className="text-button passport-recap-link" onClick={onOpenRecap}><BarChart3 size={17} /> Open detailed recap <ChevronRight size={16} /></button>
        </article>
      </div>

      <section className="passport-section upcoming-passport-section">
        <div className="passport-section-heading"><div><p className="eyebrow">On the calendar</p><h3>Upcoming trips</h3></div><span>{upcoming.length}</span></div>
        {upcoming.length ? <div className="upcoming-trip-rail">
          {upcoming.map((stay) => {
            const location = locationFor(stay, sites);
            const camper = campers.find((item) => item.id === stay.camperId);
            return <article className="upcoming-trip-card" key={stay.id}>
              <div className="upcoming-trip-date"><CalendarDays /><strong>{formatDateRange(stay.arrivalDate, stay.departureDate)}</strong><TripStatusPill stay={stay} /></div>
              <div className="upcoming-trip-title"><span><TentTree /></span><div><h4>{location?.park ?? 'Camping trip'}</h4><p><MapPin size={14} /> {locationLine(stay, sites) || location?.state || 'Location details pending'}</p></div></div>
              <TripMetaPills stay={stay} camper={camper} />
              <div className="upcoming-trip-actions">
                <button className="primary-button" onClick={() => openDashboard(stay)}><Gauge size={17} /> Open trip</button>
                <button className="secondary-button" onClick={() => openChecklist(stay)}><ClipboardCheck size={17} /> Checklist</button>
              </div>
            </article>;
          })}
        </div> : <div className="passport-empty-card"><CalendarDays /><div><strong>No upcoming trips yet</strong><p>Add the next reservation and it will appear here.</p></div><button className="secondary-button" onClick={onAdd}>Plan a trip</button></div>}
      </section>

      <section className="passport-section completed-passport-section">
        <div className="passport-section-heading"><div><p className="eyebrow">Stamped and remembered</p><h3>Completed trips</h3></div><span>{completed.length}</span></div>
        {visibleCompleted.length ? <div className="passport-history-grid">
          {visibleCompleted.map((stay) => {
            const location = locationFor(stay, sites);
            return <button className="passport-history-card" key={stay.id} onClick={() => setSelectedStay(stay)}>
              <span className="passport-stamp"><BookOpen /><small>{stay.arrivalDate.slice(0, 4)}</small></span>
              <span className="passport-history-copy"><small>{formatDateRange(stay.arrivalDate, stay.departureDate)}</small><strong>{location?.park ?? 'Unknown campsite'}</strong><em>{locationLine(stay, sites) || location?.state || 'Location details unavailable'}</em></span>
              <span className="passport-night-count"><Moon size={15} /> {stay.nights}</span>
              <ChevronRight className="passport-history-chevron" />
            </button>;
          })}
        </div> : <div className="passport-empty-card"><BookOpen /><div><strong>Your first passport stamp is waiting</strong><p>Completed trips will collect here without one endless timeline.</p></div></div>}
        {completedVisible < completed.length && <button className="secondary-button passport-show-more" onClick={() => setCompletedVisible((count) => count + 8)}>Show 8 more trips</button>}
      </section>

      {selectedStay && <StayDetailModal stay={selectedStay} site={sites.find((site) => site.id === selectedStay.siteId)} camper={campers.find((camper) => camper.id === selectedStay.camperId)} onDashboard={() => openDashboard(selectedStay)} onChecklist={() => openChecklist(selectedStay)} onEdit={() => editStay(selectedStay)} onDelete={() => deleteStay(selectedStay)} onClose={() => setSelectedStay(undefined)} />}
    </section>
  );
}
