import { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { Bookmark, Search, SlidersHorizontal } from 'lucide-react';
import type { Campsite, PreferenceProfile, Stay } from '../types';
import { calculateOverall, formatScore, scoreClass } from '../lib/scoring';
import { SiteCard } from './SiteCard';

const DEFAULT_CENTER: [number, number] = [34.95, -92.6];
const TILE_URL = import.meta.env.VITE_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = import.meta.env.VITE_TILE_ATTRIBUTION || '&copy; OpenStreetMap contributors';

type StatusFilter = 'all' | 'wishlist' | 'visited';

function createScoreIcon(score: number | null, selected: boolean, wishlist: boolean) {
  return L.divIcon({
    className: 'score-marker-shell',
    html: `<div class="score-marker ${scoreClass(score)} ${wishlist ? 'score-marker-wishlist' : ''} ${selected ? 'score-marker-selected' : ''}"><span>${wishlist ? '–' : formatScore(score)}</span></div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -23],
  });
}

function FitSelected({ site }: { site?: Campsite }) {
  const map = useMap();
  useEffect(() => {
    if (site) map.flyTo([site.latitude, site.longitude], Math.max(map.getZoom(), 15), { duration: 0.65 });
  }, [map, site]);
  return null;
}

interface MapPanelProps {
  sites: Campsite[];
  stays: Stay[];
  profile: PreferenceProfile;
  selectedSiteId?: string;
  onSelectSite: (site: Campsite) => void;
  onLogStay: (site: Campsite) => void;
}

export function MapPanel({ sites, stays, profile, selectedSiteId, onSelectSite, onLogStay }: MapPanelProps) {
  const [search, setSearch] = useState('');
  const [minimumScore, setMinimumScore] = useState(0);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const selectedSite = sites.find((site) => site.id === selectedSiteId);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return sites
      .filter((site) => {
        const score = calculateOverall(site, profile);
        const isWishlist = site.status === 'wishlist';
        const statusMatches = statusFilter === 'all' || site.status === statusFilter;
        const scoreMatches = isWishlist ? minimumScore === 0 : (score ?? 0) >= minimumScore;
        const haystack = `${site.park} ${site.state} ${site.loop} ${site.siteNumber} ${site.notes}`.toLowerCase();
        return statusMatches && scoreMatches && (!query || haystack.includes(query));
      })
      .sort((a, b) => {
        if (a.status === 'wishlist' && b.status !== 'wishlist') return 1;
        if (b.status === 'wishlist' && a.status !== 'wishlist') return -1;
        return (calculateOverall(b, profile) ?? -1) - (calculateOverall(a, profile) ?? -1);
      });
  }, [minimumScore, profile, search, sites, statusFilter]);

  return (
    <section className="map-layout">
      <aside className="map-sidebar">
        <div className="filter-panel">
          <label className="search-field">
            <Search size={18} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search park, loop, site, or note" />
          </label>
          <div className="status-filter" role="group" aria-label="Campsite status">
            {(['all', 'visited', 'wishlist'] as const).map((value) => (
              <button key={value} className={statusFilter === value ? 'active' : ''} onClick={() => setStatusFilter(value)}>{value === 'all' ? 'All' : value === 'visited' ? 'Visited' : 'Wish list'}</button>
            ))}
          </div>
          <label className="range-filter">
            <span><SlidersHorizontal size={16} /> Minimum match <strong>{minimumScore.toFixed(1)}</strong></span>
            <input type="range" min="0" max="5" step="0.5" value={minimumScore} onChange={(event) => setMinimumScore(Number(event.target.value))} />
          </label>
        </div>
        <div className="map-results-heading"><strong>{filtered.length}</strong> campsite{filtered.length === 1 ? '' : 's'}</div>
        <div className="site-card-list">
          {filtered.map((site) => (
            <SiteCard
              key={site.id}
              site={site}
              profile={profile}
              stays={stays}
              selected={selectedSiteId === site.id}
              onSelect={() => onSelectSite(site)}
              onLogStay={() => onLogStay(site)}
            />
          ))}
        </div>
      </aside>
      <div className="map-canvas-wrap">
        <MapContainer center={DEFAULT_CENTER} zoom={7} scrollWheelZoom className="leaflet-map">
          <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL} />
          <FitSelected site={selectedSite} />
          {filtered.map((site) => {
            const score = calculateOverall(site, profile);
            const isWishlist = site.status === 'wishlist';
            return (
              <Marker
                key={site.id}
                position={[site.latitude, site.longitude]}
                icon={createScoreIcon(score, selectedSiteId === site.id, isWishlist)}
                eventHandlers={{ click: () => onSelectSite(site) }}
              >
                <Popup minWidth={245}>
                  <div className="map-popup">
                    <p className="eyebrow">{site.state}</p>
                    <h3>{site.park}</h3>
                    <p>{site.loop || 'Site'} · Site {site.siteNumber}</p>
                    {isWishlist ? (
                      <div className="popup-score wishlist"><span><Bookmark size={15} fill="currentColor" /> Wish list</span><strong>Not visited</strong></div>
                    ) : (
                      <div className="popup-score"><span>Your match</span><strong>{formatScore(score)}</strong></div>
                    )}
                    <p>{site.notes || (isWishlist ? 'Saved to try later.' : 'No notes yet.')}</p>
                    <button className="primary-button small" onClick={() => onLogStay(site)}>{isWishlist ? 'Log first stay' : 'Log another stay'}</button>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
        <div className="map-legend">
          <span><i className="legend-dot score-excellent" /> 4.5+</span>
          <span><i className="legend-dot score-good" /> 4.0+</span>
          <span><i className="legend-dot score-fair" /> 3.0+</span>
          <span><i className="legend-dot score-poor" /> 2.0+</span>
          <span><i className="legend-dot score-bad" /> Under 2</span>
          <span><i className="legend-dot score-empty" /> Wish list</span>
        </div>
      </div>
    </section>
  );
}
