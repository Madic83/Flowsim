
import React from 'react';
import { createRoot } from 'react-dom/client';
import L from 'leaflet';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';
import App from './App';
import WindowTab from './WindowTab';

// Ensure Leaflet default marker assets resolve correctly in Vite builds.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
	iconRetinaUrl,
	iconUrl,
	shadowUrl
});

const path = window.location.pathname;
if (path.startsWith('/window')) {
	createRoot(document.getElementById('root')).render(<WindowTab />);
} else {
	createRoot(document.getElementById('root')).render(<App />);
}
