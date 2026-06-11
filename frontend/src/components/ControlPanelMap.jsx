import React, { useState, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

function LocationMarker({ markerPosition, setMarkerPosition, onMarkerSet }) {
  useMapEvents({
    click(e) {
      setMarkerPosition(e.latlng);
      if (onMarkerSet) onMarkerSet(e.latlng);
    },
  });
  return markerPosition ? <Marker position={markerPosition} /> : null;
}

function ControlPanelMap({ onMarkerSet, onStartEvent, eventCount, setEventCount, center }) {
  const [markerPosition, setMarkerPosition] = useState(null);
  const mapRef = useRef();

  return (
    <div>
      <div style={{ width: '100%', height: 400, borderRadius: 8, overflow: 'hidden', boxShadow: '0 2px 8px #0002', margin: '16px 0' }}>
        <MapContainer
          key={center ? center.join(',') : 'default'}
          center={center || [63.8258, 20.2630]}
          zoom={12}
          style={{ width: '100%', height: '100%' }}
          whenCreated={mapInstance => (mapRef.current = mapInstance)}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LocationMarker markerPosition={markerPosition} setMarkerPosition={setMarkerPosition} onMarkerSet={onMarkerSet} />
        </MapContainer>
      </div>
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
          disabled={!markerPosition || eventCount < 1}
          onClick={() => onStartEvent(markerPosition, eventCount)}
        >
          Starta händelse
        </button>
      </div>
    </div>
  );
}

export default ControlPanelMap;
