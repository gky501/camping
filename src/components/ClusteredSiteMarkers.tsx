import { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import { Marker, Popup, useMap } from 'react-leaflet';
import { Bookmark, ExternalLink, Trash2 } from 'lucide-react';
import type { Campsite, PreferenceProfile, Stay } from '../types';
import { distanceMiles } from '../lib/geo';
import { calculateOverall, formatScore, scoreClass } from '../lib/scoring';

interface UserLocation {
  latitude: number;
  longitude: number;
}

interface ClusteredSiteMarkersProps {
  sites: Campsite[];
  stays: Stay[];
  profile: PreferenceProfile;
  selectedSiteId?: string;
  userLocation?: UserLocation;
  onSelectSite: (site: Campsite) => void;
  onLogStay: (site: Campsite) => void;
  onDeleteSite: (site: Campsite) => Promise<void>;
}

interface SiteCluster {
  id: string;
  sites: Campsite[];
  latitude: number;
  longitude: number;
  point: L.Point;
}

function markerRadiusForZoom(zoom: number): number {
  if (zoom >= 15) return 20;
  if (zoom >= 13) return 28;
  if (zoom >= 10) return 38;
  return 52;
}

function clusterSites(sites: Campsite[], map: L.Map, zoom: number, selectedSiteId?: string): SiteCluster[] {
  const radius = markerRadiusForZoom(zoom);
  const clusters: SiteCluster[] = [];
  const ordered = [...sites].sort((a, b) => {
    if (a.id === selectedSiteId) return -1;
    if (b.id === selectedSiteId) return 1;
    if (a.status === 'wishlist' && b.status !== 'wishlist') return 1;
    if (b.status === 'wishlist' && a.status !== 'wishlist') return -1;
    return 0;
  });

  ordered.forEach((site) => {
    const point = map.project([site.latitude, site.longitude], zoom);

    // Keep the selected campsite visible even when several sites share nearly the same location.
    if (site.id === selectedSiteId) {
      clusters.push({ id: `site-${site.id}`, sites: [site], latitude: site.latitude, longitude: site.longitude, point });
      return;
    }

    let nearest: SiteCluster | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const cluster of clusters) {
      if (cluster.sites.some((entry) => entry.id === selectedSiteId)) continue;
      const distance = cluster.point.distanceTo(point);
      if (distance <= radius && distance < nearestDistance) {
        nearest = cluster;
        nearestDistance = distance;
      }
    }

    if (!nearest) {
      clusters.push({ id: `site-${site.id}`, sites: [site], latitude: site.latitude, longitude: site.longitude, point });
      return;
    }

    const count = nearest.sites.length;
    nearest.sites.push(site);
    nearest.latitude = ((nearest.latitude * count) + site.latitude) / (count + 1);
    nearest.longitude = ((nearest.longitude * count) + site.longitude) / (count + 1);
    nearest.point = L.point(
      ((nearest.point.x * count) + point.x) / (count + 1),
      ((nearest.point.y * count) + point.y) / (count + 1),
    );
    nearest.id = `cluster-${nearest.sites.map((entry) => entry.id).sort().join('-')}`;
  });

  return clusters;
}

function createSiteIcon(score: number | null, selected: boolean, wishlist: boolean) {
  const shellSize = wishlist ? 30 : 46;
  const markerLabel = wishlist ? '' : formatScore(score);
  return L.divIcon({
    className: `map-site-marker-shell ${wishlist ? 'wishlist-shell' : ''}`,
    html: `<div class="map-site-marker ${scoreClass(score)} ${wishlist ? 'map-site-marker-wishlist' : ''} ${selected ? 'map-site-marker-selected' : ''}" aria-label="${wishlist ? 'Wish list campsite' : `Campsite match ${markerLabel}`}"><span>${markerLabel}</span></div>`,
    iconSize: [shellSize, shellSize],
    iconAnchor: [shellSize / 2, shellSize / 2],
    popupAnchor: [0, wishlist ? -14 : -23],
  });
}

function createClusterIcon(cluster: SiteCluster) {
  const wishlistOnly = cluster.sites.every((site) => site.status === 'wishlist');
  const selected = cluster.sites.some((site) => site.id === undefined);
  const visualSize = wishlistOnly
    ? Math.min(38, 28 + cluster.sites.length * 2)
    : Math.min(52, 40 + cluster.sites.length * 2);
  const shellSize = visualSize + 10;
  return L.divIcon({
    className: 'map-cluster-marker-shell',
    html: `<div class="map-cluster-marker ${wishlistOnly ? 'wishlist-only' : 'visited-cluster'} ${selected ? 'selected' : ''}" style="width:${visualSize}px;height:${visualSize}px" aria-label="${cluster.sites.length} campsites"><strong>${cluster.sites.length}</strong></div>`,
    iconSize: [shellSize, shellSize],
    iconAnchor: [shellSize / 2, shellSize / 2],
    popupAnchor: [0, -(visualSize / 2)],
  });
}

function locationLabel(site: Campsite): string {
  const parts = [site.area, site.loop ? `Loop ${site.loop}` : '', `Site ${site.siteNumber}`].filter(Boolean);
  return parts.join(' · ');
}

export function ClusteredSiteMarkers({
  sites,
  stays,
  profile,
  selectedSiteId,
  userLocation,
  onSelectSite,
  onLogStay,
  onDeleteSite,
}: ClusteredSiteMarkersProps) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());

  useEffect(() => {
    const refresh = () => setZoom(map.getZoom());
    map.on('zoomend', refresh);
    return () => { map.off('zoomend', refresh); };
  }, [map]);

  const clusters = useMemo(
    () => clusterSites(sites, map, zoom, selectedSiteId),
    [map, selectedSiteId, sites, zoom],
  );

  function zoomIntoCluster(cluster: SiteCluster) {
    const bounds = L.latLngBounds(cluster.sites.map((site) => [site.latitude, site.longitude] as [number, number]));
    const targetZoom = Math.min(16, map.getZoom() + 2);
    const northEast = bounds.getNorthEast();
    const southWest = bounds.getSouthWest();
    const samePoint = northEast.equals(southWest);
    if (samePoint) {
      map.flyTo([cluster.latitude, cluster.longitude], targetZoom, { duration: 0.45 });
      return;
    }
    map.fitBounds(bounds, { padding: [64, 64], maxZoom: targetZoom, animate: true });
  }

  return (
    <>
      {clusters.map((cluster) => {
        if (cluster.sites.length > 1) {
          return (
            <Marker
              key={cluster.id}
              position={[cluster.latitude, cluster.longitude]}
              icon={createClusterIcon(cluster)}
              eventHandlers={{ click: () => zoomIntoCluster(cluster) }}
            >
              <Popup minWidth={260} maxWidth={320}>
                <div className="map-cluster-popup">
                  <p className="eyebrow">Grouped nearby</p>
                  <h3>{cluster.sites.length} campsites</h3>
                  <p>Zoom in or choose a campsite below.</p>
                  <div className="map-cluster-site-list">
                    {cluster.sites.map((site) => {
                      const wishlist = site.status === 'wishlist';
                      const score = calculateOverall(site, profile);
                      return (
                        <button
                          type="button"
                          key={site.id}
                          onClick={() => {
                            onSelectSite(site);
                            map.flyTo([site.latitude, site.longitude], Math.max(15, map.getZoom() + 2), { duration: 0.45 });
                          }}
                        >
                          <span><strong>{site.park}</strong><small>{locationLabel(site)}</small></span>
                          <em className={wishlist ? 'wishlist' : scoreClass(score)}>{wishlist ? 'Wish list' : formatScore(score)}</em>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        }

        const site = cluster.sites[0];
        const score = calculateOverall(site, profile);
        const isWishlist = site.status === 'wishlist';
        const hasTrips = stays.some((stay) => stay.siteId === site.id);
        const distance = userLocation ? distanceMiles(userLocation, site) : undefined;
        return (
          <Marker
            key={site.id}
            position={[site.latitude, site.longitude]}
            icon={createSiteIcon(score, selectedSiteId === site.id, isWishlist)}
            eventHandlers={{ click: () => onSelectSite(site) }}
          >
            <Popup minWidth={245}>
              <div className="map-popup">
                <p className="eyebrow">{site.state}</p>
                <h3>{site.park}</h3>
                <p>{locationLabel(site)}{distance !== undefined ? ` · ${Math.round(distance)} mi away` : ''}</p>
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
                    <button className="text-button destructive-text-button small" onClick={() => void onDeleteSite(site)}>
                      <Trash2 size={15} /> Delete campsite
                    </button>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}
