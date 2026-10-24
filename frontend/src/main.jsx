
import React from 'react';
import { createRoot } from 'react-dom/client';
import L from 'leaflet';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';
import App from './App';
import WindowTab from './WindowTab';
import './styles/responsive.css';

// Ensure Leaflet default marker assets resolve correctly in Vite builds.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
	iconRetinaUrl,
	iconUrl,
	shadowUrl
});

// Fångar renderingsfel så att sidan visar ett felmeddelande i stället för att bli helt vit
class ErrorBoundary extends React.Component {
	constructor(props) {
		super(props);
		this.state = { error: null };
	}
	static getDerivedStateFromError(error) {
		return { error };
	}
	componentDidCatch(error, info) {
		console.error('Flowsim renderfel:', error, info);
	}
	render() {
		if (this.state.error) {
			return (
				<div style={{ padding: 24, fontFamily: 'monospace', color: '#b00020', background: '#fff' }}>
					<h2>Ett fel uppstod i vyn</h2>
					<p>Öppna webbläsarens konsol (F12) för mer information. Ladda om sidan för att försöka igen.</p>
					<pre style={{ whiteSpace: 'pre-wrap', background: '#fdecea', padding: 12, borderRadius: 6 }}>
						{String(this.state.error && (this.state.error.stack || this.state.error.message || this.state.error))}
					</pre>
				</div>
			);
		}
		return this.props.children;
	}
}

const path = window.location.pathname;
if (path.startsWith('/window')) {
	createRoot(document.getElementById('root')).render(<ErrorBoundary><WindowTab /></ErrorBoundary>);
} else {
	createRoot(document.getElementById('root')).render(<ErrorBoundary><App /></ErrorBoundary>);
}
