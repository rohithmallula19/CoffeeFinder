import { useEffect, useMemo, useState } from 'react';
import './App.css';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const DEFAULT_POSITION = { lat: 37.7749, lon: -122.4194 }; // San Francisco fallback

type Place = {
  id: number;
  type: string;
  name: string | null;
  tags: Record<string, string>;
  lat: number;
  lon: number;
  distanceMeters: number;
};

type Category = 'gas' | 'restroom' | 'restaurant' | 'charging';

function RecenterMap({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lon], Math.max(map.getZoom(), 14));
  }, [lat, lon, map]);
  return null;
}

function App() {
  const [position, setPosition] = useState<{ lat: number; lon: number } | null>(null);
  const [category, setCategory] = useState<Category>('gas');
  const [radius, setRadius] = useState<number>(3000);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPosition({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        },
        () => {
          setPosition(DEFAULT_POSITION);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setPosition(DEFAULT_POSITION);
    }
  }, []);

  const center = useMemo(() => position ?? DEFAULT_POSITION, [position]);

  async function fetchPlaces() {
    if (!center) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await axios.get('/api/nearby', {
        params: { lat: center.lat, lon: center.lon, type: category, radius },
      });
      setPlaces(resp.data?.results ?? []);
    } catch (e: any) {
      setError('Failed to load nearby places');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (center) {
      fetchPlaces();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, radius, center?.lat, center?.lon]);

  return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex' }}>
      <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 1000, background: 'white', padding: 12, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <label>
            Category:
            <select value={category} onChange={(e) => setCategory(e.target.value as Category)} style={{ marginLeft: 8 }}>
              <option value="gas">Gas stations</option>
              <option value="restroom">Public restrooms</option>
              <option value="restaurant">Restaurants</option>
              <option value="charging">Charging stations</option>
            </select>
          </label>
          <label>
            Radius (m):
            <input type="number" value={radius} min={500} max={10000} step={100} onChange={(e) => setRadius(Number(e.target.value))} style={{ width: 100, marginLeft: 8 }} />
          </label>
          <button onClick={fetchPlaces} disabled={loading}>
            {loading ? 'Searching…' : 'Find'}
          </button>
        </div>
        {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
        <div style={{ marginTop: 8, fontSize: 12 }}>
          Showing up to 5 nearest results.
        </div>
      </div>
      <MapContainer center={[center.lat, center.lon]} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <RecenterMap lat={center.lat} lon={center.lon} />
        <Marker position={[center.lat, center.lon]}>
          <Popup>Your location</Popup>
        </Marker>
        {places.map((p) => (
          <Marker key={`${p.type}-${p.id}`} position={[p.lat, p.lon]}>
            <Popup>
              <div style={{ minWidth: 180 }}>
                <div style={{ fontWeight: 600 }}>{p.name || 'Unnamed'}</div>
                <div style={{ marginTop: 4 }}>{(p.distanceMeters / 1000).toFixed(2)} km away</div>
                {p.tags?.addr_street && (
                  <div style={{ marginTop: 4 }}>
                    {p.tags.addr_housenumber ? `${p.tags.addr_housenumber} ` : ''}
                    {p.tags.addr_street}
                  </div>
                )}
                {p.tags?.opening_hours && <div style={{ marginTop: 4 }}>Hours: {p.tags.opening_hours}</div>}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

export default App;
