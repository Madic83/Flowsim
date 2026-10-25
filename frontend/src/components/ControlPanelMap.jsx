import React, { useState, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { checkOpenStreetMapTileColor } from '../waterLocation.js';
import 'leaflet/dist/leaflet.css';

function LocationMarker({ markerPosition, onMapClick }) {
  const map = useMapEvents({
    click(e) {
      onMapClick(e.latlng, map);
    },
  });
  return markerPosition ? <Marker position={markerPosition} /> : null;
}

function ControlPanelMap({ onMarkerSet, onStartEvent, eventCount, setEventCount, center }) {
  const [markerPosition, setMarkerPosition] = useState(null);
  const [locationStatus, setLocationStatus] = useState('');
  const locationCheckRef = useRef(0);

  async function handleMapClick(latlng, map) {
    const checkId = ++locationCheckRef.current;
    setMarkerPosition(null);
    setLocationStatus('Kontrollerar kartfärgen …');
    try {
      const isWater = await checkOpenStreetMapTileColor(map, latlng);
      if (checkId !== locationCheckRef.current) return;
      if (isWater === null) {
        setLocationStatus('Kartplattan kunde inte färgkontrolleras. Vänta tills kartan laddat och försök igen.');
        return;
      }
      if (isWater) {
        setLocationStatus('Kan inte placera markören i vatten');
        return;
      }
      setMarkerPosition(latlng);
      setLocationStatus('Platsen är vald.');
      onMarkerSet?.(latlng);
    } catch {
      if (checkId !== locationCheckRef.current) return;
      setLocationStatus('Kartplattan kunde inte färgkontrolleras. Vänta tills kartan laddat och försök igen.');
    }
  }

  return (
    <div>
      <div style={{ width: '100%', height: 400, borderRadius: 8, overflow: 'hidden', boxShadow: '0 2px 8px #0002', margin: '16px 0' }}>
        <MapContainer
          key={center ? center.join(',') : 'default'}
          center={center || [63.8258, 20.2630]}
          zoom={12}
          style={{ width: '100%', height: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LocationMarker markerPosition={markerPosition} onMapClick={handleMapClick} />
        </MapContainer>
      </div>
      {locationStatus && (
        <div role="status" aria-live="polite" style={{margin:'8px 0',fontSize:14,color:locationStatus.startsWith('Platsen är vald') ? '#246b3d' : locationStatus.startsWith('Kontrollerar') ? '#53616a' : '#a52b28'}}>
          {locationStatus}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12 }}>
        <label style={{ fontWeight: 600 }}>Antal patienter:</label>
        <input
          type="number"
          min={1}
          max={150}
          value={eventCount}
          onChange={e => setEventCount(Number(e.target.value))}
          style={{ width: 60, fontSize: 16, padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc' }}
        />
        <button
          style={{ padding: '8px 18px', fontSize: 16, borderRadius: 6, background: '#1976d2', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer' }}
          disabled={!markerPosition || locationStatus !== 'Platsen är vald.' || eventCount < 1}
          onClick={() => onStartEvent(markerPosition, eventCount)}
        >
          Starta händelse
        </button>
      </div>
    </div>
  );
}

export default ControlPanelMap;
