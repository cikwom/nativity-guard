import { useEffect, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Incident {
  id: string;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  status: string;
  priority?: string;
  type: 'case' | 'sos' | 'unit';
  createdAt?: string;
}

interface IncidentMapProps {
  incidents?: Incident[];
  center?: [number, number];
  zoom?: number;
  onMarkerClick?: (id: string) => void;
  showRadius?: boolean;
  showHeatmap?: boolean;
  filterType?: string;
  filterStatus?: string;
}

const defaultIcon = new L.Icon({
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

L.Marker.prototype.options.icon = defaultIcon;

function ChangeView({
  center,
  zoom,
}: {
  center: [number, number];
  zoom: number;
}) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, zoom);
    setTimeout(() => map.invalidateSize(), 100);
  }, [center, zoom, map]);

  return null;
}

export default function IncidentMap({
  incidents = [],
  center = [6.5244, 3.3792],
  zoom = 12,
  onMarkerClick,
  showRadius = true,
  filterType = 'all',
  filterStatus = 'all',
}: IncidentMapProps) {
  const [userLocation, setUserLocation] =
    useState<[number, number] | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation([
          position.coords.latitude,
          position.coords.longitude,
        ]);
      },
      () => {
        // Keep default map center if location is unavailable.
      }
    );
  }, []);

  const filteredIncidents = incidents.filter((incident) => {
    if (filterType !== 'all' && incident.type !== filterType) {
      return false;
    }

    if (filterStatus !== 'all' && incident.status !== filterStatus) {
      return false;
    }

    return true;
  });

  return (
    <div className="relative w-full h-[500px] overflow-hidden rounded-lg border border-gray-200 shadow-lg dark:border-gray-700">
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={true}
        style={{
          width: '100%',
          height: '100%',
          minHeight: '500px',
        }}
      >
        <ChangeView center={center} zoom={zoom} />

        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* User location */}
        {userLocation && (
          <>
            <Marker position={userLocation}>
              <Popup>
                <strong>Your Location</strong>
                <br />
                {userLocation[0].toFixed(5)}, {userLocation[1].toFixed(5)}
              </Popup>
            </Marker>

            {showRadius && (
              <Circle
                center={userLocation}
                radius={5000}
                pathOptions={{
                  color: 'blue',
                  fillColor: 'blue',
                  fillOpacity: 0.1,
                }}
              />
            )}
          </>
        )}

        {/* Incidents */}
        {filteredIncidents.map((incident) => (
          <Marker
            key={incident.id}
            position={[incident.latitude, incident.longitude]}
            eventHandlers={{
              click: () => onMarkerClick?.(incident.id),
            }}
          >
            <Popup>
              <div className="min-w-[220px]">
                <h3 className="font-bold">{incident.title}</h3>

                <p className="mt-1 text-sm">
                  {incident.description}
                </p>

                <div className="mt-2 text-xs">
                  <strong>Status:</strong> {incident.status}
                </div>

                {incident.priority && (
                  <div className="text-xs">
                    <strong>Priority:</strong> {incident.priority}
                  </div>
                )}

                <div className="text-xs">
                  <strong>Type:</strong> {incident.type}
                </div>

                {incident.createdAt && (
                  <div className="mt-1 text-xs text-gray-500">
                    {new Date(incident.createdAt).toLocaleDateString()}
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Empty state — map remains visible */}
      {filteredIncidents.length === 0 && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-[1000] -translate-x-1/2">
          <div className="rounded-lg bg-white/95 px-4 py-2 text-sm shadow dark:bg-gray-800/95 dark:text-gray-200">
            No incidents reported in this area
          </div>
        </div>
      )}

      {/* Map status */}
      <div className="absolute bottom-4 left-4 z-[1000] rounded-lg bg-white/95 px-3 py-2 text-xs shadow dark:bg-gray-800/95 dark:text-gray-300">
        {filteredIncidents.length} incident
        {filteredIncidents.length === 1 ? '' : 's'} displayed
      </div>
    </div>
  );
}