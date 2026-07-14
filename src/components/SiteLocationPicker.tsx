import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';

const DEFAULT_CENTER: [number, number] = [34.95, -92.6];
const TILE_URL = import.meta.env.VITE_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = import.meta.env.VITE_TILE_ATTRIBUTION || '&copy; OpenStreetMap contributors';

const pinIcon = L.divIcon({
  className: 'location-picker-marker-shell',
  html: '<div class="location-picker-marker"><span></span></div>',
  iconSize: [34, 42],
  iconAnchor: [17, 39],
});

function Recenter({ latitude, longitude, zoom }: { latitude?: number; longitude?: number; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (latitude !== undefined && longitude !== undefined) map.setView([latitude, longitude], zoom, { animate: false });
  }, [latitude, longitude, map, zoom]);
  return null;
}

function ClickPicker({ onPick }: { onPick?: (latitude: number, longitude: number) => void }) {
  useMapEvents({
    click(event) {
      onPick?.(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

export function SiteLocationPicker({ latitude, longitude, onPick, readOnly = false }: {
  latitude?: number;
  longitude?: number;
  onPick?: (latitude: number, longitude: number) => void;
  readOnly?: boolean;
}) {
  const valid = Number.isFinite(latitude) && Number.isFinite(longitude);
  const center = useMemo<[number, number]>(() => valid ? [latitude as number, longitude as number] : DEFAULT_CENTER, [latitude, longitude, valid]);
  const zoom = valid ? 15 : 6;

  return (
    <div className={`site-location-picker ${readOnly ? 'read-only' : ''}`}>
      <MapContainer center={center} zoom={zoom} scrollWheelZoom={!readOnly} dragging={!readOnly} doubleClickZoom={!readOnly} zoomControl={!readOnly} attributionControl className="site-location-picker-map">
        <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL} />
        <Recenter latitude={valid ? latitude : undefined} longitude={valid ? longitude : undefined} zoom={zoom} />
        {!readOnly && <ClickPicker onPick={onPick} />}
        {valid && <Marker position={[latitude as number, longitude as number]} icon={pinIcon} />}
      </MapContainer>
      {!readOnly && <span className="map-picker-help">Click the exact campsite location to move the pin.</span>}
    </div>
  );
}
