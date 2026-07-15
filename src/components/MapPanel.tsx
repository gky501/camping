import { useCallback, useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { Bookmark, ExternalLink, Filter, LocateFixed, Maximize2, RotateCcw, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import type { Campsite, ElectricService, PreferenceProfile, Stay } from '../types';
import { distanceMiles } from '../lib/geo';
import { calculateOverall, formatScore, scoreClass } from '../lib/scoring';
import { SiteCard } from './SiteCard';

const DEFAULT_CENTER: [number, number] = [34.95, -92.6];
const TILE_URL = import.meta.env.VITE_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = import.meta.env.VITE_TILE_ATTRIBUTION || '&copy; OpenStreetMap contributors';

type StatusFilter = 'all' | 'wishlist' | 'visited';
type ElectricFilter = 'all' | ElectricService;

interface UserLocation {
  latitude: number;
  longitude: number;
}

function createScoreIcon(score: number | null, selected: boolean, wishlist: boolean) {
  return L.divIcon({
    className: 'score-marker-shell',
    html: `<div class="score-marker ${scoreClass(score)} ${wishlist ? 'score-marker-wishlist' : ''} ${selected ? 'score-marker-selected' : ''}"><span>${wishlist ? '–' : formatScore(score)}</span></div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -23],
  });
}

function MapController({
  site,
  filteredSites,
  fitRequest,
  locateRequest,
  onLocation,
  onLocationError,
}: {
  site?: Campsite;
  filteredSites: Campsite[];
  fitRequest: number;
  locateRequest: number;
  onLocation: (location: UserLocation) => void;
  onLocationError: (message: string) => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (site) map.flyTo([site.latitude, site.longitude], Math.max(map.getZoom(), 15), { duration: 0.65 });
  }, [map, site]);

  useEffect(() => {
    if (!fitRequest || !filteredSites.length) return;
    if (filteredSites.length === 1) {
      map.flyTo([filteredSites[0].latitude, filteredSites[0].longitude], 14, { duration: 0.5 });
      return;
    }
    const bounds = L.latLngBounds(filteredSites.map((item) => [item.latitude, item.longitude] as [number, number]));
    map.fitBounds(bounds, { padding: [42, 42], maxZoom: 13 });
  }, [filteredSites, fitRequest, map]);

  useEffect(() => {
    if (!locateRequest) return;
    if (!navigator.geolocation) {
      onLocationError('Location is not available in this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        onLocation(location);
        map.flyTo([location.latitude, location.longitude], 12, { duration: 0.6 });
      },
      (failure) => onLocationError(failure.message || 'Unable to find your location.'),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }, [locateRequest, map, onLocation, onLocationError]);

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
  const [electricFilter, setElectricFilter] = useState<ElectricFilter>('all');
  const [waterfrontOnly, setWaterfrontOnly] = useState(false);
  const [pullThroughOnly, setPullThroughOnly] = useState(false);
  const [fullHookupsOnly, setFullHookupsOnly] = useState(false);
  const [minimumLength, setMinimumLength] = useState(0);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [fitRequest, setFitRequest] = useState(0);
  const [locateRequest, setLocateRequest] = useState(0);
  const [userLocation, setUserLocation] = useState<UserLocation>();
  const selectedSite = sites.find((site) => site.id === selectedSiteId);
  const handleLocationError = useCallback((message: string) => window.alert(message), []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return sites
      .filter((site) => {
        const score = calculateOverall(site, profile);
        const isWishlist = site.status === 'wishlist';
        const statusMatches = statusFilter === 'all' || site.status === statusFilter;
        const scoreMatches = isWishlist ? minimumScore === 0 : (score ?? 0) >= minimumScore;
        const electricMatches = electricFilter === 'all' || site.amenities?.electric === electricFilter;
        const waterfrontMatches = !waterfrontOnly || site.amenities?.features?.includes('waterfront');
        const pullThroughMatches = !pullThroughOnly || site.amenities?.entry === 'pull-through';
        const fullHookupMatches = !fullHookupsOnly
          || (site.amenities?.electric !== 'none' && Boolean(site.amenities?.electric) && site.amenities?.water === 'yes' && site.amenities?.sewer === 'site');
        const lengthMatches = minimumLength <= 0 || (site.amenities?.siteLengthFeet ?? 0) >= minimumLength;
        const haystack = `${site.park} ${site.state} ${site.area ?? ''} ${site.loop} ${site.siteNumber} ${site.notes}`.toLowerCase();
        return statusMatches && scoreMatches && electricMatches && waterfrontMatches && pullThroughMatches && fullHookupMatches && lengthMatches && (!query || haystack.includes(query));
      })
      .sort((a, b) => {
        if (userLocation) return distanceMiles(userLocation, a) - distanceMiles(userLocation, b);
        if (a.status === 'wishlist' && b.status !== 'wishlist') return 1;
        if (b.status === 'wishlist' && a.status !== 'wishlist') return -1;
        return (calculateOverall(b, profile) ?? -1) - (calculateOverall(a, profile) ?? -1);
      });
  }, [electricFilter, fullHookupsOnly, minimumLength, minimumScore, profile, pullThroughOnly, search, sites, statusFilter, userLocation, waterfrontOnly]);

  const activeAdvancedFilters = [electricFilter !== 'all', waterfrontOnly, pullThroughOnly, fullHookupsOnly, minimumLength > 0].filter(Boolean).length;

  function resetFilters() {
    setSearch('');
    setMinimumScore(0);
    setStatusFilter('all');
    setElectricFilter('all');
    setWaterfrontOnly(false);
    setPullThroughOnly(false);
    setFullHookupsOnly(false);
    setMinimumLength(0);
  }

  async function deleteOrphanSite(site: Campsite) {
    const tripCount = stays.filter((stay) => stay.siteId === site.id).length;
    if (tripCount > 0) {
      window.alert('This campsite still has a trip attached. Delete the trip from the Diary first.');
      return;
    }

    const label = [site.park, site.area, site.loop ? `Loop ${site.loop}` : '', `Site ${site.siteNumber}`]
      .filter(Boolean)
      .join(' · ');

    if (!window.confirm(`Delete ${label} and remove its map marker? This cannot be undone.`)) return;

    try {
      const response = await fetch(`/api/sites/${encodeURIComponent(site.id)}`, { method: 'DELETE' });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || `Delete failed with status ${response.status}.`);
      window.location.reload();
    } catch (cause) {
      window.alert(cause instanceof Error ? cause.message : 'Unable to delete this campsite.');
    }
  }

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
          <div className="map-filter-toggle-row">
            <button className={`secondary-button map-filter-toggle ${advancedOpen ? 'active' : ''}`} onClick={() => setAdvancedOpen((open) => !open)}><Filter size={16} /> More filters {activeAdvancedFilters ? <strong>{activeAdvancedFilters}</strong> : null}</button>
            <button className="text-button" onClick={resetFilters}><RotateCcw size={15} /> Reset</button>
          </div>
          {advancedOpen && (
            <div className="advanced-map-filters">
              <label><span>Electric</span><select value={electricFilter} onChange={(event) => setElectricFilter(event.target.value as ElectricFilter)}><option value="all">Any service</option><option value="50amp">50 amp</option><option value="30amp">30 amp</option><option value="none">No electric</option></select></label>
              <label><span>Minimum site length</span><select value={minimumLength} onChange={(event) => setMinimumLength(Number(event.target.value))}><option value={0}>Any length</option><option value={30}>30+ feet</option><option value={40}>40+ feet</option><option value={50}>50+ feet</option><option value={60}>60+ feet</option><option value={70}>70+ feet</option></select></label>
              <label className="map-filter-check"><input type="checkbox" checked={waterfrontOnly} onChange={(event) => setWaterfrontOnly(event.target.checked)} /> Waterfront</label>
              <label className="map-filter-check"><input type="checkbox" checked={pullThroughOnly} onChange={(event) => setPullThroughOnly(event.target.checked)} /> Pull-through</label>
              <label className="map-filter-check"><input type="checkbox" checked={fullHookupsOnly} onChange={(event) => setFullHookupsOnly(event.target.checked)} /> Full hookups</label>
            </div>
          )}
          <label className="range-filter">
            <span><SlidersHorizontal size={16} /> Minimum match <strong>{minimumScore.toFixed(1)}</strong></span>
            <input type="range" min="0" max="5" step="0.5" value={minimumScore} onChange={(event) => setMinimumScore(Number(event.target.value))} />
          </label>
        </div>
        <div className="map-results-heading"><strong>{filtered.length}</strong> campsite{filtered.length === 1 ? '' : 's'}{userLocation ? ' · nearest first' : ''}</div>
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
          <MapController
            site={selectedSite}
            filteredSites={filtered}
            fitRequest={fitRequest}
            locateRequest={locateRequest}
            onLocation={setUserLocation}
            onLocationError={handleLocationError}
          />
          {userLocation && <CircleMarker center={[userLocation.latitude, userLocation.longitude]} radius={8} pathOptions={{ weight: 3, fillOpacity: 1 }}><Popup>You are here</Popup></CircleMarker>}
          {filtered.map((site) => {
            const score = calculateOverall(site, profile);
            const isWishlist = site.status === 'wishlist';
            const hasTrips = stays.some((stay) => stay.siteId === site.id);
            const distance = userLocation ? distanceMiles(userLocation, site) : undefined;
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
                    <p>{site.loop || 'Site'} · Site {site.siteNumber}{distance !== undefined ? ` · ${Math.round(distance)} mi away` : ''}</p>
                    {isWishlist ? (
                      <div className="popup-score wishlist"><span><Bookmark size={15} fill="currentColor" /> Wish list</span><strong>Not visited</strong></div>
                    ) : (
                      <div className="popup-score"><span>Your match</span><strong>{formatScore(score)}</strong></div>
                    )}
                    <p>{site.notes || (isWishlist ? 'Saved to try later.' : 'No notes yet.')}</p>
                    <div className="map-popup-actions">
                      <button className="primary-button small" onClick={() => onLogStay(site)}>{isWishlist ? 'Log first stay' : 'Log another stay'}</button>
                      <a className="secondary-button small" href={`https://www.google.com/maps/dir/?api=1&destination=${site.latitude},${site.longitude}`} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Directions</a>
                      {!hasTrips && (
                        <button className="text-button destructive-text-button small" onClick={() => void deleteOrphanSite(site)}>
                          <Trash2 size={15} /> Delete campsite
                        </button>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
        <div className="map-tool-stack">
          <button title="Fit all filtered campsites" onClick={() => setFitRequest((value) => value + 1)}><Maximize2 /></button>
          <button title="Find my location and sort nearest first" className={userLocation ? 'active' : ''} onClick={() => setLocateRequest((value) => value + 1)}><LocateFixed /></button>
        </div>
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
