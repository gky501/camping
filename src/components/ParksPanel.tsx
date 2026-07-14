import { useMemo, useState } from 'react';
import { Clock3, MapPin, Moon, Pencil, Search, TentTree, X } from 'lucide-react';
import { locationMatchesPark, siteMatchesPark, stayLocation } from '../lib/parks';
import { calculateOverall } from '../lib/scoring';
import type { Campsite, ParkProfile, PreferenceProfile, Stay } from '../types';
import { ScoreBadge } from './ScoreBadge';

interface ParkStats {
  stays: Stay[];
  sites: Campsite[];
  nights: number;
  score: number | null;
}

function getParkStats(park: ParkProfile, sites: Campsite[], stays: Stay[], profile: PreferenceProfile): ParkStats {
  const parkStays = stays.filter((stay) => locationMatchesPark(stayLocation(stay, sites), park));
  const visitedSiteIds = new Set(parkStays.map((stay) => stay.siteId));
  const parkSites = sites.filter((site) => siteMatchesPark(site, park) && visitedSiteIds.has(site.id));
  const scores = parkSites
    .map((site) => calculateOverall(site, profile))
    .filter((score): score is number => score !== null);
  return {
    stays: parkStays,
    sites: parkSites,
    nights: parkStays.reduce((sum, stay) => sum + stay.nights, 0),
    score: scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null,
  };
}

function formatTime(value: string | undefined): string {
  if (!value) return 'Not added';
  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value;
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function ParkDetailModal({ park, sites, stays, profile, onClose, onEdit, onSelectSite, onLogStay }: {
  park: ParkProfile;
  sites: Campsite[];
  stays: Stay[];
  profile: PreferenceProfile;
  onClose: () => void;
  onEdit: () => void;
  onSelectSite: (site: Campsite) => void;
  onLogStay: (site: Campsite) => void;
}) {
  const stats = getParkStats(park, sites, stays, profile);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="modal-card park-detail-modal" role="dialog" aria-modal="true" aria-labelledby="park-detail-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div><p className="eyebrow">Park history</p><h2 id="park-detail-title">{park.name}</h2></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X /></button>
        </div>

        <section className="form-section park-detail-hero">
          <div>
            <p className="eyebrow">{park.state}</p>
            <h3>{stats.sites.length} {stats.sites.length === 1 ? 'site' : 'sites'} across {stats.stays.length} {stats.stays.length === 1 ? 'stay' : 'stays'}</h3>
            <p>{stats.nights} total {stats.nights === 1 ? 'night' : 'nights'}</p>
          </div>
          <div className="park-score-block"><span>Overall park rating</span><ScoreBadge score={stats.score} /></div>
        </section>

        <section className="form-section">
          <div className="park-time-grid">
            <div><Clock3 /><span>Check in</span><strong>{formatTime(park.checkInTime)}</strong></div>
            <div><Clock3 /><span>Check out</span><strong>{formatTime(park.checkOutTime)}</strong></div>
          </div>
          <div className="park-notes-block">
            <h3>Park notes</h3>
            <p>{park.notes || 'No park-level notes have been added yet.'}</p>
          </div>
          <button type="button" className="secondary-button" onClick={onEdit}><Pencil size={16} /> Edit park information</button>
        </section>

        <section className="form-section">
          <div className="section-heading-row"><div><h3>Sites stayed at</h3><p>Each site's personalized score uses the preference profile currently selected.</p></div><TentTree size={23} /></div>
          <div className="park-site-list">
            {stats.sites.map((site) => {
              const siteStays = stats.stays.filter((stay) => stay.siteId === site.id);
              const nights = siteStays.reduce((sum, stay) => sum + stay.nights, 0);
              const locationLine = [site.area, site.loop ? `Loop ${site.loop}` : '', `Site ${site.siteNumber}`].filter(Boolean).join(' · ');
              return (
                <article className="park-site-row" key={site.id}>
                  <div className="park-site-copy">
                    <strong>{locationLine}</strong>
                    <span>{siteStays.length} {siteStays.length === 1 ? 'stay' : 'stays'} · {nights} {nights === 1 ? 'night' : 'nights'}</span>
                    {site.notes && <p>{site.notes}</p>}
                  </div>
                  <ScoreBadge score={calculateOverall(site, profile)} compact />
                  <div className="park-site-actions">
                    <button type="button" className="secondary-button" onClick={() => onSelectSite(site)}><MapPin size={15} /> Map</button>
                    <button type="button" className="secondary-button" onClick={() => onLogStay(site)}><Moon size={15} /> Log stay</button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <div className="modal-actions"><button type="button" className="primary-button" onClick={onClose}>Done</button></div>
      </div>
    </div>
  );
}

export function ParksPanel({ parks, sites, stays, profile, onEdit, onSelectSite, onLogStay }: {
  parks: ParkProfile[];
  sites: Campsite[];
  stays: Stay[];
  profile: PreferenceProfile;
  onEdit: (park: ParkProfile) => void;
  onSelectSite: (site: Campsite) => void;
  onLogStay: (site: Campsite) => void;
}) {
  const [search, setSearch] = useState('');
  const [selectedPark, setSelectedPark] = useState<ParkProfile>();

  const visibleParks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return parks
      .map((park) => ({ park, stats: getParkStats(park, sites, stays, profile) }))
      .filter(({ stats }) => stats.stays.length > 0)
      .filter(({ park }) => !query || `${park.name} ${park.state} ${park.notes}`.toLowerCase().includes(query))
      .sort((a, b) => a.park.name.localeCompare(b.park.name));
  }, [parks, profile, search, sites, stays]);

  return (
    <section className="content-page parks-page">
      <div className="page-heading">
        <div><p className="eyebrow">Campground history</p><h2>Parks</h2><p>Every park with a dated stay, rolled up into sites visited, nights camped, park information, and an overall personalized rating.</p></div>
      </div>
      <div className="summary-grid park-summary-grid">
        <div className="summary-card"><TentTree /><div><strong>{visibleParks.length}</strong><span>parks stayed at</span></div></div>
        <div className="summary-card"><MapPin /><div><strong>{new Set(visibleParks.flatMap(({ stats }) => stats.sites.map((site) => site.id))).size}</strong><span>sites across those parks</span></div></div>
        <div className="summary-card"><Moon /><div><strong>{visibleParks.reduce((sum, item) => sum + item.stats.nights, 0)}</strong><span>total nights</span></div></div>
      </div>
      <label className="search-field page-search"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search parks or park notes" /></label>

      {visibleParks.length ? (
        <div className="park-card-grid">
          {visibleParks.map(({ park, stats }) => (
            <article className="park-card" key={park.id}>
              <div className="park-card-heading">
                <div><p className="eyebrow">{park.state}</p><h3>{park.name}</h3></div>
                <ScoreBadge score={stats.score} />
              </div>
              <div className="park-card-stats">
                <span><strong>{stats.sites.length}</strong> {stats.sites.length === 1 ? 'site' : 'sites'}</span>
                <span><strong>{stats.stays.length}</strong> {stats.stays.length === 1 ? 'stay' : 'stays'}</span>
                <span><strong>{stats.nights}</strong> {stats.nights === 1 ? 'night' : 'nights'}</span>
              </div>
              <div className="park-card-times"><span>Check in: <strong>{formatTime(park.checkInTime)}</strong></span><span>Check out: <strong>{formatTime(park.checkOutTime)}</strong></span></div>
              <p className="park-card-note">{park.notes || 'No park notes yet.'}</p>
              <div className="button-row park-card-actions">
                <button type="button" className="secondary-button" onClick={() => setSelectedPark(park)}>View park</button>
                <button type="button" className="secondary-button" onClick={() => onEdit(park)}><Pencil size={16} /> Edit</button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state"><TentTree size={42} /><h3>{stays.length ? 'No parks match that search.' : 'No dated stays yet.'}</h3><p>{stays.length ? 'Try a different park name or note.' : 'A park will appear here automatically after you log a dated stay.'}</p></div>
      )}

      {selectedPark && (
        <ParkDetailModal
          park={selectedPark}
          sites={sites}
          stays={stays}
          profile={profile}
          onClose={() => setSelectedPark(undefined)}
          onEdit={() => { setSelectedPark(undefined); onEdit(selectedPark); }}
          onSelectSite={(site) => { setSelectedPark(undefined); onSelectSite(site); }}
          onLogStay={(site) => { setSelectedPark(undefined); onLogStay(site); }}
        />
      )}
    </section>
  );
}
