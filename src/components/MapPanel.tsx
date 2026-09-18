import { useCallback, useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import { Filter, Layers, LocateFixed, MapPinned, Maximize2, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';
import type { Campsite, ElectricService, PreferenceProfile, Stay } from '../types';
import { distanceMiles } from '../lib/geo';
import { calculateOverall } from '../lib/scoring';
import { ClusteredSiteMarkers } from './ClusteredSiteMarkers';
import { SiteCard } from './SiteCard';
import { SiteLocationPicker } from './SiteLocationPicker';

const DEFAULT_CENTER: [number, number] = [34.95, -92.6];
const TILE_URL = import.meta.env.VITE_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = import.meta.env.VITE_TILE_ATTRIBUTION || '&copy; OpenStreetMap contributors';
const SATELLITE_TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const SATELLITE_ATTRIBUTION = 'Tiles &copy; Esri';

type StatusFilter = 'all' | 'wishlist' | 'visited';
type ElectricFilter = 'all' | ElectricService;

interface UserLocation {
  latitude: number;
  longitude: number;
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
  onUpdateSite: (site: Campsite) => Promise<void>;
}

export function MapPanel({ sites, stays, profile, selectedSiteId, onSelectSite, onLogStay, onUpdateSite }: MapPanelProps) {
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
  const [baseLayer, setBaseLayer] = useState<'street' | 'satellite'>('street');
  const [editingLocation, setEditingLocation] = useState<Campsite>();
  const [draftLocation, setDraftLocation] = useState<UserLocation>();
  const [savingLocation, setSavingLocation] = useState(false);
  const [locationSaveError, setLocationSaveError] = useState('');
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

  function openLocationEditor(site: Campsite) {
    setEditingLocation(site);
    setDraftLocation({ latitude: site.latitude, longitude: site.longitude });
    setLocationSaveError('');
  }

  async function saveLocation() {
    if (!editingLocation || !draftLocation) return;
    setSavingLocation(true);
    setLocationSaveError('');
    try {
      await onUpdateSite({ ...editingLocation, ...draftLocation });
      setEditingLocation(undefined);
      setDraftLocation(undefined);
    } catch (cause) {
      setLocationSaveError(cause instanceof Error ? cause.message : 'Unable to save the corrected location.');
    } finally {
      setSavingLocation(false);
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
          <TileLayer
            key={baseLayer}
            attribution={baseLayer === 'satellite' ? SATELLITE_ATTRIBUTION : TILE_ATTRIBUTION}
            url={baseLayer === 'satellite' ? SATELLITE_TILE_URL : TILE_URL}
          />
          <MapController
            site={selectedSite}
            filteredSites={filtered}
            fitRequest={fitRequest}
            locateRequest={locateRequest}
            onLocation={setUserLocation}
            onLocationError={handleLocationError}
          />
          {userLocation && <CircleMarker center={[userLocation.latitude, userLocation.longitude]} radius={8} pathOptions={{ weight: 3, fillOpacity: 1 }}><Popup>You are here</Popup></CircleMarker>}
          <ClusteredSiteMarkers
            sites={filtered}
            stays={stays}
            profile={profile}
            selectedSiteId={selectedSiteId}
            userLocation={userLocation}
            onSelectSite={onSelectSite}
            onLogStay={onLogStay}
            onEditLocation={openLocationEditor}
            onDeleteSite={deleteOrphanSite}
          />
        </MapContainer>
        <div className="map-tool-stack">
          <button title={baseLayer === 'satellite' ? 'Switch to street map' : 'Switch to satellite map'} aria-label={baseLayer === 'satellite' ? 'Switch to street map' : 'Switch to satellite map'} className={baseLayer === 'satellite' ? 'active' : ''} onClick={() => setBaseLayer((layer) => layer === 'street' ? 'satellite' : 'street')}><Layers /></button>
          <button title="Fit all filtered campsites" onClick={() => setFitRequest((value) => value + 1)}><Maximize2 /></button>
          <button title="Find my location and sort nearest first" className={userLocation ? 'active' : ''} onClick={() => setLocateRequest((value) => value + 1)}><LocateFixed /></button>
        </div>
        <div className="map-legend">
          <span><i className="legend-dot score-excellent" /> 4.5+</span>
          <span><i className="legend-dot score-good" /> 4.0+</span>
          <span><i className="legend-dot score-fair" /> 3.0+</span>
          <span><i className="legend-dot score-poor" /> 2.0+</span>
          <span><i className="legend-dot score-bad" /> Under 2</span>
          <span><i className="legend-dot score-empty wishlist-legend-dot" /> Wish list</span>
          <span><i className="legend-dot cluster-legend-dot" /> Cluster</span>
        </div>
      </div>
      {editingLocation && draftLocation && <div className="modal-backdrop map-location-editor-backdrop" role="presentation" onMouseDown={() => !savingLocation && setEditingLocation(undefined)}>
        <section className="modal-card map-location-editor" role="dialog" aria-modal="true" aria-labelledby="map-location-editor-title" onMouseDown={(event) => event.stopPropagation()}>
          <div className="modal-header"><div><p className="eyebrow">Correct map pin</p><h3 id="map-location-editor-title">{editingLocation.park} · Site {editingLocation.siteNumber}</h3><p>Move the pin to the exact campsite. Saving updates this campsite everywhere it appears.</p></div><button className="icon-button" aria-label="Close location editor" onClick={() => setEditingLocation(undefined)} disabled={savingLocation}><X /></button></div>
          <div className="map-location-editor-body">
            <SiteLocationPicker latitude={draftLocation.latitude} longitude={draftLocation.longitude} onPick={(latitude, longitude) => setDraftLocation({ latitude, longitude })} />
            <div className="coordinate-line"><span><MapPinned size={15} /> {draftLocation.latitude.toFixed(7)}, {draftLocation.longitude.toFixed(7)}</span></div>
            {locationSaveError && <p className="form-error">{locationSaveError}</p>}
          </div>
          <div className="modal-actions"><button className="secondary-button" onClick={() => setEditingLocation(undefined)} disabled={savingLocation}>Cancel</button><button className="primary-button" onClick={() => void saveLocation()} disabled={savingLocation}>{savingLocation ? 'Saving…' : 'Save location'}</button></div>
        </section>
      </div>}
    </section>
  );
}
