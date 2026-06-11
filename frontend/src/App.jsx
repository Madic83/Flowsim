import React, { useState, useEffect, useRef } from 'react'
import Window from './components/Window'
import Hem from './components/Hem'
import ControlPanelMap from './components/ControlPanelMap';
import { vehicleTypes, personnelCategories, getTotalPersonnel, getAvailablePersonnel } from './components/prehospitalResources';
import { startPrehospitalAutomationLoop, initializeCollectionPoints } from './prehospitalAutomation';

// Tabellcell-stilar
const th = {border:'1px solid #ccc',padding:'4px 8px',background:'#e0e0e0',fontWeight:'bold'}
const td = {border:'1px solid #ccc',padding:'4px 8px'}
const SESSION_STORAGE_KEY = 'flowsimSessionAuth'

// Komponent för att visa när fordon kommer tillbaka
function VehicleReturnCountdown({ vehicles, simTime }) {
  // Hjälpfunktion för att konvertera tid till minuter
  const timeToMinutes = (time) => {
    if (!time || typeof time !== 'string') return 0;
    const parts = time.split(':');
    if (parts.length !== 2) return 0;
    const [h, m] = parts.map(Number);
    if (isNaN(h) || isNaN(m)) return 0;
    return h * 60 + m;
  };
  
  const awayVehicles = vehicles.filter(v => v.status === 'away');
  
  if (awayVehicles.length === 0) return null;
  
  const currentMinutes = timeToMinutes(simTime);
  
  return (
    <div style={{marginTop:16}}>
      <div style={{fontWeight:600,fontSize:14,marginBottom:8,color:'#e91e63'}}>
        Fordon på väg tillbaka ({awayVehicles.length})
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:6}}>
        {awayVehicles.map(vehicle => {
          const vType = vehicleTypes[vehicle.type];
          
          // Beräkna återstående tid baserat på simTime
          let remainingMinutes = 0;
          let displayText = 'Beräknar...';
          
          if (vehicle.expectedReturnSimTime) {
            const returnMinutes = timeToMinutes(vehicle.expectedReturnSimTime);
            remainingMinutes = Math.max(0, returnMinutes - currentMinutes);
            
            if (remainingMinutes > 0) {
              displayText = `${remainingMinutes} min (återvänder ${vehicle.expectedReturnSimTime})`;
            } else {
              displayText = 'Anländer nu...';
            }
          }
          
          return (
            <div key={vehicle.id} style={{
              background:'#fff3e0',
              border:'1px solid #ff9800',
              padding:'8px 12px',
              borderRadius:4,
              display:'flex',
              justifyContent:'space-between',
              alignItems:'center'
            }}>
              <div style={{fontSize:13,fontWeight:600}}>
                {vType.icon} {vType.label} #{vehicle.unitNumber}
              </div>
              <div style={{fontSize:13,fontWeight:600,color:'#ff9800'}}>
                {displayText}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function App() {
  const [sessionAuth, setSessionAuth] = useState(() => {
    try {
      const saved = localStorage.getItem(SESSION_STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [authForm, setAuthForm] = useState({ role: 'participant', sessionId: '', displayName: '' });
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    if (sessionAuth) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionAuth));
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, [sessionAuth]);
  // Händelsetyp används endast i logik, inte i renderad output
  const [eventType, setEventType] = useState('explosion');
  const exerciseViews = [
    { title: 'Akutmottagning', component: Window },
    { title: 'Hem', component: Hem },
    { title: 'Personal', component: (props) => <PersonalView hospitalPersonnel={hospitalPersonnel} {...props} /> },
    // Lägg till fler vyer här vid behov
  ];
  const hospitals = [
    'Norrlands universitetssjukhus',
    'Skellefteå sjukhus',
    'Lycksele lasarett'
  ]

  const [showExercisePanel, setShowExercisePanel] = useState(false)
  const [selectedHospital, setSelectedHospital] = useState(hospitals[0]);
  const controlPanelMapRef = useRef();
  
  // Medicinska inriktningsbeslut
  const [medicalDirective, setMedicalDirective] = useState(() => {
    return localStorage.getItem('medicalDirective') || 'Inget inriktningsbeslut';
  });
  
  // Automatisering av övningsvyer
  const [automatedViews, setAutomatedViews] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('automatedViews') || '{}');
    } catch {
      return {};
    }
  });
  
  // Spara automatiseringsinställningar
  useEffect(() => {
    localStorage.setItem('automatedViews', JSON.stringify(automatedViews));
    window.dispatchEvent(new CustomEvent('automatedViewsChanged', { detail: { automatedViews } }));
  }, [automatedViews]);

  useEffect(() => {
    if (sessionAuth?.role === 'participant') {
      setShowExercisePanel(true);
    }
  }, [sessionAuth]);
  
  // Starta automatiseringsloop för prehospital
  useEffect(() => {
    const interval = startPrehospitalAutomationLoop();
    return () => clearInterval(interval);
  }, []);
  
  // Personalinställningar för sjukhus
  const [hospitalPersonnel, setHospitalPersonnel] = useState(() => {
    const saved = localStorage.getItem('hospitalPersonnelConfig');
    const defaults = {
      akutläkare: 4,
      akutsjuksköterskor: 4,
      narkoslakare: 2,
      narkosskoterskor: 2,
      ivaskoterskor: 4,
      operationsskoterskor: 2,
      kirurger: 1,
      ortopeder: 1,
      usk_akut: 5,
      usk_op: 2
    };
    let parsed = {};
    if (saved) {
      try { parsed = JSON.parse(saved) || {}; } catch { parsed = {}; }
    }
    // Sätt default om värdet är null eller undefined (men inte 0)
    const merged = { ...defaults, ...parsed };
    Object.keys(defaults).forEach(key => {
      if (merged[key] === undefined || merged[key] === null) {
        merged[key] = defaults[key];
      }
    });
    return merged;
  });
  
  // Spara personalinställningar när de ändras
  useEffect(() => {
    localStorage.setItem('hospitalPersonnelConfig', JSON.stringify(hospitalPersonnel));
  }, [hospitalPersonnel]);
  
  // Simulerad tid och veckodag
  const weekdays = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'];
  const [simTime, setSimTime] = useState(() => {
    const now = new Date();
    return now.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', hour12: false }).padStart(5, '0');
  });
  const [simSpeed, setSimSpeed] = useState(1); // Simuleringshastighet: 1x = normal, 2x-60x = snabbare
  const [simWeekday, setSimWeekday] = useState(() => {
    const now = new Date();
    // JS: 0=söndag, 1=måndag ...
    // Vi vill ha 0=måndag, 6=söndag
    let jsDay = now.getDay();
    let weekdayIndex = jsDay === 0 ? 6 : jsDay - 1;
    return weekdayIndex;
  });
  // Timer för att öka tiden varje minut (justeras av simSpeed)
  useEffect(() => {
    const timer = setInterval(() => {
      setSimTime(prev => {
        let [h, m] = prev.split(':').map(Number);
        m++;
        if (m >= 60) { m = 0; h = (h + 1) % 24; }
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      });
    }, 60000 / simSpeed); // Dela intervallet med hastigheten
    return () => clearInterval(timer);
  }, [simSpeed]);

  // Broadcast simTime to all open exercise windows when simTime changes
  useEffect(() => {
    localStorage.setItem('simTime', simTime);
    openWindowsRef.current = openWindowsRef.current.filter(win => win && !win.closed);
    for (const win of openWindowsRef.current) {
      try { win.postMessage({ type: 'simTime', simTime }, '*'); } catch {}
    }
  }, [simTime]);
  const [windows, setWindows] = useState([])
  const [allPatients, setAllPatients] = useState([])
  const [numPatients, setNumPatients] = useState(0)
  const [loadingPatients, setLoadingPatients] = useState(false)
  const [patientsError, setPatientsError] = useState(null)
  
  // Prehospital resurshantering
  const [vehicles, setVehicles] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('prehospitalVehicles') || '[]');
    } catch {
      return [];
    }
  });
  const [selectedVehicleType, setSelectedVehicleType] = useState('ambulance');
  
  // Lyssna på uppdateringar från andra komponenter (MapPanel)
  useEffect(() => {
    function handleVehiclesUpdated() {
      // Läs alltid från localStorage när event triggas
      try {
        const updatedVehicles = JSON.parse(localStorage.getItem('prehospitalVehicles') || '[]');
        setVehicles(updatedVehicles);
      } catch (e) {
        console.error('Error parsing vehicles:', e);
      }
    }
    
    window.addEventListener('prehospitalVehiclesUpdated', handleVehiclesUpdated);
    window.addEventListener('storage', handleVehiclesUpdated);
    
    return () => {
      window.removeEventListener('prehospitalVehiclesUpdated', handleVehiclesUpdated);
      window.removeEventListener('storage', handleVehiclesUpdated);
    };
  }, []);
  
  function addVehicle(type) {
    const vType = vehicleTypes[type];
    const personnel = [];
    // Skapa individuella personal-ID:n för varje person i fordonet
    Object.entries(vType.personnel).forEach(([category, count]) => {
      for (let i = 0; i < count; i++) {
        personnel.push({
          id: `${Date.now()}-${category}-${i}`,
          category,
          status: 'available' // 'available' eller 'busy'
        });
      }
    });
    
    // Generera individnummer för alla fordon baserat på typ
    const currentVehicles = JSON.parse(localStorage.getItem('prehospitalVehicles') || '[]');
    let unitNumber = null;
    
    if (type === 'ambulance') {
      // Ambulans: 9001, 9002, 9003...
      const existingAmbulances = currentVehicles.filter(v => v.type === 'ambulance');
      unitNumber = 9001 + existingAmbulances.length;
    } else if (type === 'helicopterAmbulance') {
      // Helikopter: 7001, 7002, 7003...
      const existingHelicopters = currentVehicles.filter(v => v.type === 'helicopterAmbulance');
      unitNumber = 7001 + existingHelicopters.length;
    } else if (type === 'fireEngine') {
      // Brandbil: 4001, 4002, 4003...
      const existingFireEngines = currentVehicles.filter(v => v.type === 'fireEngine');
      unitNumber = 4001 + existingFireEngines.length;
    } else if (type === 'policeVehicle') {
      // Polisbil: 3001, 3002, 3003...
      const existingPoliceVehicles = currentVehicles.filter(v => v.type === 'policeVehicle');
      unitNumber = 3001 + existingPoliceVehicles.length;
    } else if (type === 'commandVehicle') {
      // Ledningsfordon: 2001, 2002, 2003...
      const existingCommandVehicles = currentVehicles.filter(v => v.type === 'commandVehicle');
      unitNumber = 2001 + existingCommandVehicles.length;
    } else if (type === 'bus') {
      // Buss: 6001, 6002, 6003...
      const existingBuses = currentVehicles.filter(v => v.type === 'bus');
      unitNumber = 6001 + existingBuses.length;
    }
    
    const newVehicle = {
      id: Date.now(),
      type: type,
      unitNumber: unitNumber,
      arrivalTime: new Date().toISOString(),
      status: 'available',
      personnel // Array av personal-objekt
    };
    
    const updatedVehicles = [...currentVehicles, newVehicle];
    
    // Spara till localStorage och uppdatera state
    localStorage.setItem('prehospitalVehicles', JSON.stringify(updatedVehicles));
    setVehicles(updatedVehicles);
    window.dispatchEvent(new CustomEvent('prehospitalVehiclesUpdated', { detail: updatedVehicles }));
    
    // Broadcast till öppna övningsfönster
    openWindowsRef.current = openWindowsRef.current.filter(win => win && !win.closed);
    for (const win of openWindowsRef.current) {
      try { win.postMessage({ type: 'prehospitalVehicles', vehicles: updatedVehicles }, '*'); } catch {}
    }
  }
  
  function removeVehicle(id) {
    const currentVehicles = JSON.parse(localStorage.getItem('prehospitalVehicles') || '[]');
    const updatedVehicles = currentVehicles.filter(v => v.id !== id);
    
    // Spara till localStorage och uppdatera state
    localStorage.setItem('prehospitalVehicles', JSON.stringify(updatedVehicles));
    setVehicles(updatedVehicles);
    window.dispatchEvent(new CustomEvent('prehospitalVehiclesUpdated', { detail: updatedVehicles }));
    
    // Broadcast till öppna övningsfönster
    openWindowsRef.current = openWindowsRef.current.filter(win => win && !win.closed);
    for (const win of openWindowsRef.current) {
      try { win.postMessage({ type: 'prehospitalVehicles', vehicles: updatedVehicles }, '*'); } catch {}
    }
  }
  
  const totalPersonnel = getTotalPersonnel(vehicles.filter(v => v.status === 'available'));

  // Ladda alla patienter vid start, men visa ingen i tabellen förrän man trycker på knappen
  // Spara alla patienter separat, och visa bara numPatients st
  useEffect(() => {
    async function fetchPatients() {
      setLoadingPatients(true)
      setPatientsError(null)
      try {
        const res = await fetch('/api/patients')
        if (!res.ok) throw new Error('Kunde inte hämta patienter')
        let data = await res.json()
        // Blanda patienterna (Fisher-Yates shuffle)
        for (let i = data.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [data[i], data[j]] = [data[j], data[i]];
        }
        setAllPatients(data)
        setNumPatients(0)
        setWindows([])
      } catch (e) {
        setPatientsError(e.message)
      } finally {
        setLoadingPatients(false)
      }
    }
    fetchPatients()
  }, [])

  // Håll referens till öppnad Akutmottagning-flik
  const akutWindowRef = useRef(null);
  // Håll koll på alla öppna övningsfönster
  const openWindowsRef = useRef([]);
  function openWindow(title, content) {
    let url = `/window?title=${encodeURIComponent(title)}&hospital=${encodeURIComponent(selectedHospital)}`;
    const win = window.open(url, '_blank');
    openWindowsRef.current.push(win);
    setTimeout(() => {
      try { win.postMessage({ type: 'simTime', simTime }, '*'); } catch {}
      if (title === 'Akutmottagning') {
        const akutPatients = JSON.parse(localStorage.getItem('akutPatients') || '{}');
        try { win.postMessage({ type: 'akutSync', akutPatients }, '*'); } catch {}
        akutWindowRef.current = win;
      }
    }, 300);
  }

  // Lägg till nästa patient i Akutmottagning-tabellen
  // Per-hospital patient index
  const [hospitalPatientIndexes, setHospitalPatientIndexes] = useState({
    'Norrlands universitetssjukhus': 0,
    'Skellefteå sjukhus': 0,
    'Lycksele lasarett': 0
  });

  function addNextPatient(hospital) {
    setAllPatients(pats => {
      let idx = hospitalPatientIndexes[hospital] || 0;
      let foundIdx = -1;
      for (let i = idx; i < pats.length; i++) {
        if (!pats[i].currentHospital) {
          foundIdx = i;
          break;
        }
      }
      if (foundIdx === -1) return pats;
      const updated = [...pats];
      updated[foundIdx] = { ...updated[foundIdx], startTime: simTime, currentHospital: hospital };
      setHospitalPatientIndexes(prev => ({ ...prev, [hospital]: foundIdx + 1 }));
      
      // Lägg till den nya patienten till befintliga patienter i akutmottagningen
      const allAkut = JSON.parse(localStorage.getItem('akutPatients') || '{}');
      const newAkut = { ...allAkut };
      const existingHospitalPatients = newAkut[hospital] || [];
      const newPatient = updated[foundIdx];
      
      // Kontrollera att patienten inte redan finns
      if (!existingHospitalPatients.some(p => p.id === newPatient.id)) {
        newAkut[hospital] = [...existingHospitalPatients, newPatient];
        localStorage.setItem('akutPatients', JSON.stringify(newAkut));
        window.dispatchEvent(new CustomEvent('akutSync', { detail: { akutPatients: newAkut } }));
      }
      
      return updated;
    });
  }

  // generatePatients används ej längre

  function closeWindow(id) {
    setWindows(w => w.filter(x => x.id !== id))
  }

  // Avdelningar per sjukhus
  const departmentOptions = {
      // Operationsavdelningar för OP-vyn
      'Norrlands universitetssjukhus_OP': [
        'Cop 1', 'Cop 2', 'Cop 3', 'Thorax op'
      ],
    'Norrlands universitetssjukhus': [
      'Barnavdelning 2', 'Barnavdelning 3', 'Barnavdelning 4',
      'BB Antenatalavdelning', 'Buk och kärlkirurgisk avdelning',
      'Geriatrisk avdelning 1', 'Geriatrisk avdelning 2', 'Geriatrisk avdelning 4',
      'Hand- Plastik- Ögon avdelning', 'Hjärn- och ryggmärgsskaderehab',
      'Infektionsavdelning', 'Intensivvårdsavdelning', 'Intermediärvårdsavdelning',
      'Kardiologisk avdelning', 'Kardiologisk utredningsavdelning',
      'Kirurg avd', 'Kirurgisk akutvårdsavdelning',
      'Medicinsk akutvårdsavdelning', 'Medicincentrum specialistvårdsavdelning',
      'Neuro- och strokerehabilitering', 'Neurokirurgisk avdelning', 'Neurologisk avdelning',
      'Onkologavdelning CDE', 'Onkologavdelning Hematolog', 'Ortoped avd', 'Ortopedavdelning',
      'PostOP', 'Strokecenter avdelning', 'Thoraxavdelning', 'Thoraxintermediär',
      'Urologisk och gynekologisk avdelning', 'Öron- näsa- Hals avdelning'
    ],
    'Skellefteå sjukhus': [
      'Intensivvård och postoperativ avdelning',
      'Barnavdelning',
      'BB- Gynekologiavdelning',
      'Kirurgisk avdelning 2',
      'Kirurgisk avdelning 8',
      'Medicingeriatrisk avdelning 2',
      'Medicinsk avdelning 3 Stroke',
      'Medicinsk avdelning 6',
      'Medicinsk avdelning 7',
      'Ortopedavdelning'
    ],
    'Lycksele lasarett': [
      'BB- Förlossning- Gyn avdelning',
      'Kirurgi- Ortopedi avdelning',
      'Medicinsk avdelning',
      'Rehabilitering- Strokeavdelning',
      'IVA- Postoperativavdelning'
    ]
  };

  // Hantera ändring av förflyttning för en patient
  function handleTransferChange(winId, patientIndex, value) {
    setWindows(wins => wins.map(win => {
      if (win.id !== winId) return win;
      const newContent = [...win.content];
      newContent[patientIndex] = { ...newContent[patientIndex], transfer: value };
      return { ...win, content: newContent };
    }));
  }

  async function handleLogin(e) {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const displayName = (authForm.displayName || '').trim() || (authForm.role === 'instructor' ? 'Instruktor' : 'Deltagare');
      const enteredSessionId = (authForm.sessionId || '').trim().toUpperCase();

      let response;
      if (authForm.role === 'instructor' && !enteredSessionId) {
        response = await fetch('/api/sessions/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ displayName })
        });
      } else {
        response = await fetch('/api/sessions/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: enteredSessionId,
            role: authForm.role,
            displayName
          })
        });
      }

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Kunde inte logga in');
      }

      setSessionAuth({
        sessionId: payload.sessionId,
        role: payload.role,
        displayName: payload.displayName
      });
    } catch (err) {
      setAuthError(err.message || 'Kunde inte logga in');
    } finally {
      setAuthLoading(false);
    }
  }

  function handleLogout() {
    setSessionAuth(null);
    setShowExercisePanel(false);
  }

  if (!sessionAuth) {
    return (
      <div style={{ fontFamily: 'Arial, sans-serif', padding: 20, maxWidth: 520, margin: '0 auto' }}>
        <h1>Flowsim</h1>
        <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, background: '#fff' }}>
          <h2 style={{ marginTop: 0 }}>Logga in till session</h2>
          <p style={{ color: '#555', marginTop: 0 }}>Instruktör kan skapa session eller ansluta till befintlig. Deltagare ansluter till befintlig session.</p>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Roll</label>
              <select
                value={authForm.role}
                onChange={e => setAuthForm(prev => ({ ...prev, role: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', fontSize: 14 }}
              >
                <option value="instructor">Instruktör</option>
                <option value="participant">Deltagare</option>
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Namn</label>
              <input
                value={authForm.displayName}
                onChange={e => setAuthForm(prev => ({ ...prev, displayName: e.target.value }))}
                placeholder={authForm.role === 'instructor' ? 'Instruktörens namn' : 'Deltagarens namn'}
                style={{ width: '100%', padding: '8px 10px', fontSize: 14 }}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Session-ID</label>
              <input
                value={authForm.sessionId}
                onChange={e => setAuthForm(prev => ({ ...prev, sessionId: e.target.value.toUpperCase() }))}
                placeholder={authForm.role === 'instructor' ? 'Lämna tomt för att skapa ny session' : 'Ange session-ID från instruktör'}
                style={{ width: '100%', padding: '8px 10px', fontSize: 14, textTransform: 'uppercase' }}
              />
            </div>
            {authError && <div style={{ color: '#c62828', marginBottom: 10 }}>{authError}</div>}
            <button
              type="submit"
              disabled={authLoading}
              style={{ padding: '10px 14px', borderRadius: 6, border: '1px solid #007acc', background: '#007acc', color: '#fff', cursor: 'pointer' }}
            >
              {authLoading ? 'Loggar in...' : 'Logga in'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: 20 }}>
      <h1>Flowsim</h1>

      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ padding: '4px 8px', borderRadius: 999, background: '#e3f2fd', border: '1px solid #90caf9', fontSize: 13 }}>
          Session: <b>{sessionAuth.sessionId}</b>
        </span>
        <span style={{ padding: '4px 8px', borderRadius: 999, background: '#f1f8e9', border: '1px solid #aed581', fontSize: 13 }}>
          Roll: <b>{sessionAuth.role === 'instructor' ? 'Instruktör' : 'Deltagare'}</b>
        </span>
        <span style={{ fontSize: 13, color: '#555' }}>Inloggad som: {sessionAuth.displayName}</span>
        <button
          onClick={handleLogout}
          style={{ marginLeft: 'auto', padding: '6px 10px', borderRadius: 6, border: '1px solid #999', background: '#fff', cursor: 'pointer' }}
        >
          Logga ut
        </button>
      </div>

      {/* Control panel header with buttons */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 10 }}>
        {sessionAuth.role === 'instructor' ? (
          <>
            <button
              onClick={() => setShowExercisePanel(false)}
              style={showExercisePanel ? headerBtnInactive : headerBtnActive}
            >
              Kontrollpanelen
            </button>
            <button
              onClick={() => setShowExercisePanel(true)}
              style={showExercisePanel ? headerBtnActive : headerBtnInactive}
            >
              Övningsvyer
            </button>
          </>
        ) : (
          <div style={{ padding: '10px 14px', borderRadius: 6, border: '1px solid #e0e0e0', background: '#f9f9f9', fontSize: 14 }}>
            Deltagarläge: endast övningsfönster är tillgängliga
          </div>
        )}
        {/* Nollställningsknapp */}
        {sessionAuth.role === 'instructor' && !showExercisePanel && (
          <button
            style={{marginLeft:20,padding:'10px 16px',fontSize:14,borderRadius:6,border:'1px solid #e53935',background:'#fff',color:'#e53935',fontWeight:'bold',cursor:'pointer'}}
            onClick={async () => {
              // 1. Ta bort och återställ personalinställningar till utgångsvärden
              localStorage.removeItem('hospitalPersonnelConfig');
              const defaultPersonnelConfig = {
                narkoslakare: 2,
                narkosskoterskor: 2,
                operationsskoterskor: 2,
                usk_op: 2,
                kirurger: 2,
                ortopeder: 2
              };
              setTimeout(() => {
                localStorage.setItem('hospitalPersonnelConfig', JSON.stringify(defaultPersonnelConfig));
                setHospitalPersonnel(defaultPersonnelConfig);
                window.dispatchEvent(new StorageEvent('storage', { key: 'hospitalPersonnelConfig', newValue: JSON.stringify(defaultPersonnelConfig) }));
              }, 100);
              let config = defaultPersonnelConfig;
              // Mappa till generate_personnel.js format
              let counts = { "Narkosläkare": config.narkoslakare, "Narkossköterskor": config.narkosskoterskor, "Operationssköterskor": config.operationsskoterskor, "Undersköterska operation": config.usk_op, "Kirurger": config.kirurger, "Ortopeder": config.ortopeder };
              try {
                // Lägg till cache-busting för att alltid hämta ny fil
                await fetch('/api/regenerate-personnel', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ counts, cacheBust: Date.now() })
                });
              } catch (e) {
                alert('Kunde inte generera ny personal!');
              }
              // 2. Rensa all lokal data som tidigare
              localStorage.removeItem('departmentPatients');
              localStorage.removeItem('movedPatientIds');
              localStorage.removeItem('prehospitalPatients');
              localStorage.removeItem('prehospitalVehicles');
              localStorage.removeItem('prehospitalTransportTasks');
              localStorage.removeItem('paratusPatients');
              localStorage.removeItem('collectionPointMarker');
              localStorage.removeItem('deadCollectionPointMarker');
                            localStorage.removeItem('hospitalPersonnelConfig');
              localStorage.removeItem('prehospitalMapMarker');
              setVehicles([]);
              window.dispatchEvent(new StorageEvent('storage', { key: 'departmentPatients', newValue: null }));
              window.dispatchEvent(new StorageEvent('storage', { key: 'movedPatientIds', newValue: null }));
              window.dispatchEvent(new StorageEvent('storage', { key: 'prehospitalVehicles', newValue: '[]' }));
              window.dispatchEvent(new StorageEvent('storage', { key: 'prehospitalTransportTasks', newValue: '{}' }));
              window.dispatchEvent(new Event('paratusUpdated'));
              setAllPatients([]);
              setNumPatients(0);
              // Ladda om patientlistan från servern
              try {
                setLoadingPatients(true);
                setPatientsError(null);
                const res = await fetch('/api/patients');
                if (!res.ok) throw new Error('Kunde inte hämta patienter');
                let data = await res.json();
                // Blanda patienterna (Fisher-Yates shuffle)
                for (let i = data.length - 1; i > 0; i--) {
                  const j = Math.floor(Math.random() * (i + 1));
                  [data[i], data[j]] = [data[j], data[i]];
                }
                setAllPatients(data);
                setNumPatients(0);
              } catch (e) {
                setPatientsError(e.message);
              } finally {
                setLoadingPatients(false);
              }
              // Broadcast till alla öppna övningsfönster
              openWindowsRef.current = openWindowsRef.current.filter(win => win && !win.closed);
              for (const win of openWindowsRef.current) {
                try { win.postMessage({ type: 'resetAll' }, '*'); } catch {}
              }
              // Rensa ALL lokal data
              localStorage.removeItem('akutPatients');
              localStorage.removeItem('departmentPatients');
              localStorage.removeItem('movedPatientIds');
              localStorage.removeItem('paratusPatients');
              localStorage.removeItem('prehospitalPatients');
              localStorage.removeItem('prehospitalVehicles');
              localStorage.removeItem('prehospitalTransportTasks');
              localStorage.removeItem('prehospitalCompletedActions');
              localStorage.removeItem('collectionPointMarker');
              localStorage.removeItem('deadCollectionPointMarker');
              localStorage.removeItem('prehospitalMapMarker');
              localStorage.removeItem('postopAkutlista');
              // Behåll simTime - tid behövs för övningarna
              
              // Uppdatera vehicles-state lokalt
              setVehicles([]);
              
              // Dispatcha events så alla komponenter uppdateras
              window.dispatchEvent(new Event('paratusUpdated'));
              window.dispatchEvent(new CustomEvent('prehospitalVehiclesUpdated', { detail: [] }));
              window.dispatchEvent(new Event('storage'));
              
              console.log('All data nollställd');
              console.log('prehospitalVehicles efter reset:', JSON.parse(localStorage.getItem('prehospitalVehicles') || '[]'));
            }}
            title="Nollställ alla patientlistor och flyttade patienter i alla övningsvyer"
          >
            Nollställ all data
          </button>
        )}
      </div>

      {/* Main control panel view (default) - hidden when Övningsvyer is active */}
      {sessionAuth.role === 'instructor' && !showExercisePanel && (
        <div style={{ marginBottom: 20 }}>
          <div style={{marginBottom:12,display:'flex',alignItems:'center',gap:12}}>
            <span style={{fontWeight:'bold'}}>Veckodag:</span>
            <select
              value={simWeekday}
              onChange={e => setSimWeekday(Number(e.target.value))}
              style={{fontSize:16,padding:'4px 8px'}}
            >
              {weekdays.map((wd, i) => (
                <option key={wd} value={i}>{wd}</option>
              ))}
            </select>
            <span style={{fontWeight:'bold'}}>Tid:</span>
            <select
              value={simTime.split(':')[0]}
              onChange={e => {
                const h = e.target.value.padStart(2, '0');
                const m = simTime.split(':')[1];
                setSimTime(`${h}:${m}`);
              }}
              style={{fontSize:16,padding:'4px 8px',fontFamily:'monospace'}}
            >
              {[...Array(24).keys()].map(h => (
                <option key={h} value={h.toString().padStart(2, '0')}>
                  {h.toString().padStart(2, '0')}
                </option>
              ))}
            </select>
            :
            <select
              value={simTime.split(':')[1]}
              onChange={e => {
                const m = e.target.value.padStart(2, '0');
                const h = simTime.split(':')[0];
                setSimTime(`${h}:${m}`);
              }}
              style={{fontSize:16,padding:'4px 8px',fontFamily:'monospace'}}
            >
              {[...Array(60).keys()].map(m => (
                <option key={m} value={m.toString().padStart(2, '0')}>
                  {m.toString().padStart(2, '0')}
                </option>
              ))}
            </select>
            
            <span style={{fontWeight:'bold',marginLeft:20}}>Hastighet:</span>
            <select
              value={simSpeed}
              onChange={e => setSimSpeed(Number(e.target.value))}
              style={{fontSize:16,padding:'4px 8px'}}
            >
              <option value={1}>1x (realtid)</option>
              <option value={2}>2x</option>
              <option value={5}>5x</option>
              <option value={10}>10x</option>
              <option value={20}>20x</option>
              <option value={30}>30x</option>
              <option value={60}>60x</option>
            </select>
            
            <span style={{fontFamily:'monospace',fontSize:16}}>{weekdays[simWeekday]} {simTime}</span>
          </div>
          <button onClick={() => addNextPatient(selectedHospital)} style={{ marginBottom: 16, padding: '10px 16px', fontSize: 14, cursor: 'pointer', borderRadius: 6, border: '1px solid #007acc', background: '#007acc', color: '#fff' }} disabled={loadingPatients}>
            {loadingPatients ? 'Hämtar patienter...' : 'Generera patient'}
          </button>
          {patientsError && <div style={{color:'red',marginBottom:8}}>{patientsError}</div>}
          <h2>Välj sjukhus</h2>
          <div style={{ display: 'flex', gap: 10 }}>
            {hospitals.map(name => (
              <button
                key={name}
                style={{
                  padding: '10px 16px',
                  fontSize: 14,
                  cursor: 'pointer',
                  borderRadius: 6,
                  border: selectedHospital === name ? '2px solid #007acc' : '1px solid #ccc',
                  background: selectedHospital === name ? '#e3f2fd' : '#fff',
                  fontWeight: selectedHospital === name ? 'bold' : 'normal'
                }}
                onClick={() => {
                  setSelectedHospital(name);
                  localStorage.setItem('selectedHospital', name);
                  // Sjukhusens koordinater
                  const hospitalCoords = {
                    'Norrlands universitetssjukhus': { lat: 63.8258, lng: 20.2630 },
                    'Skellefteå sjukhus': { lat: 64.7508, lng: 20.9528 },
                    'Lycksele lasarett': { lat: 64.5975, lng: 18.6743 }
                  };
                  const coords = hospitalCoords[name];
                }}
              >
                {name}
              </button>
            ))}
          </div>

          {/* Personalinställningar */}
          <h2 style={{marginTop:32}}>Tillgänglig personal</h2>
          <div style={{display:'flex',flexWrap:'wrap',gap:20,marginBottom:16}}>
            <div>
              <label style={{display:'block',marginBottom:4,fontWeight:600}}>Akutläkare:</label>
              <input type="number" min="0" max="50" value={hospitalPersonnel.akutläkare} onChange={e => setHospitalPersonnel({...hospitalPersonnel, akutläkare: parseInt(e.target.value) || 0})} style={{fontSize:16,padding:'4px 8px',width:60}} />
            </div>
            <div>
              <label style={{display:'block',marginBottom:4,fontWeight:600}}>Akutsjuksköterskor:</label>
              <input type="number" min="0" max="50" value={hospitalPersonnel.akutsjuksköterskor} onChange={e => setHospitalPersonnel({...hospitalPersonnel, akutsjuksköterskor: parseInt(e.target.value) || 0})} style={{fontSize:16,padding:'4px 8px',width:60}} />
            </div>
            <div>
              <label style={{display:'block',marginBottom:4,fontWeight:600}}>Narkosläkare:</label>
              <input type="number" min="0" max="50" value={hospitalPersonnel.narkoslakare} onChange={e => setHospitalPersonnel({...hospitalPersonnel, narkoslakare: parseInt(e.target.value) || 0})} style={{fontSize:16,padding:'4px 8px',width:60}} />
            </div>
            <div>
              <label style={{display:'block',marginBottom:4,fontWeight:600}}>Narkossköterskor:</label>
              <input type="number" min="0" max="50" value={hospitalPersonnel.narkosskoterskor} onChange={e => setHospitalPersonnel({...hospitalPersonnel, narkosskoterskor: parseInt(e.target.value) || 0})} style={{fontSize:16,padding:'4px 8px',width:60}} />
            </div>
            <div>
              <label style={{display:'block',marginBottom:4,fontWeight:600}}>IVA sköterskor:</label>
              <input type="number" min="0" max="50" value={hospitalPersonnel.ivaskoterskor} onChange={e => setHospitalPersonnel({...hospitalPersonnel, ivaskoterskor: parseInt(e.target.value) || 0})} style={{fontSize:16,padding:'4px 8px',width:60}} />
            </div>
            <div>
              <label style={{display:'block',marginBottom:4,fontWeight:600}}>Operationssköterskor:</label>
              <input type="number" min="0" max="50" value={hospitalPersonnel.operationsskoterskor} onChange={e => setHospitalPersonnel({...hospitalPersonnel, operationsskoterskor: parseInt(e.target.value) || 0})} style={{fontSize:16,padding:'4px 8px',width:60}} />
            </div>
            <div>
              <label style={{display:'block',marginBottom:4,fontWeight:600}}>Kirurger:</label>
              <input type="number" min="0" max="50" value={hospitalPersonnel.kirurger} onChange={e => setHospitalPersonnel({...hospitalPersonnel, kirurger: parseInt(e.target.value) || 0})} style={{fontSize:16,padding:'4px 8px',width:60}} />
            </div>
            <div>
              <label style={{display:'block',marginBottom:4,fontWeight:600}}>Ortopeder:</label>
              <input type="number" min="0" max="50" value={hospitalPersonnel.ortopeder} onChange={e => setHospitalPersonnel({...hospitalPersonnel, ortopeder: parseInt(e.target.value) || 0})} style={{fontSize:16,padding:'4px 8px',width:60}} />
            </div>
            <div>
              <label style={{display:'block',marginBottom:4,fontWeight:600}}>Undersköterskor akutmottagningen:</label>
              <input type="number" min="0" max="50" value={hospitalPersonnel.usk_akut} onChange={e => setHospitalPersonnel({...hospitalPersonnel, usk_akut: parseInt(e.target.value) || 0})} style={{fontSize:16,padding:'4px 8px',width:60}} />
            </div>
            <div>
              <label style={{display:'block',marginBottom:4,fontWeight:600}}>Undersköterskor operation:</label>
              <input type="number" min="0" max="50" value={hospitalPersonnel.usk_op} onChange={e => setHospitalPersonnel({...hospitalPersonnel, usk_op: parseInt(e.target.value) || 0})} style={{fontSize:16,padding:'4px 8px',width:60}} />
            </div>
          </div>

          {/* Medicinska inriktningsbeslut */}
          <h2 style={{marginTop:32}}>Medicinska inriktningsbeslut</h2>
          <div style={{marginBottom:16}}>
            <label style={{display:'block',marginBottom:8,fontWeight:600}}>Välj inriktningsbeslut:</label>
            <select 
              value={medicalDirective} 
              onChange={(e) => {
                const newDirective = e.target.value;
                setMedicalDirective(newDirective);
                localStorage.setItem('medicalDirective', newDirective);
                // Broadcast till alla öppna övningsfönster
                openWindowsRef.current = openWindowsRef.current.filter(win => win && !win.closed);
                for (const win of openWindowsRef.current) {
                  try { win.postMessage({ type: 'medicalDirective', medicalDirective: newDirective }, '*'); } catch {}
                }
                window.dispatchEvent(new CustomEvent('medicalDirectiveChanged', { detail: { medicalDirective: newDirective } }));
              }}
              style={{fontSize:16,padding:'8px 12px',width:'100%',maxWidth:500}}
            >
              <option value="Inget inriktningsbeslut">Inget inriktningsbeslut</option>
              <option value="Inget blod på akutmottagningen">Inget blod på akutmottagningen</option>
              <option value="Endast akuta operationer">Endast akuta operationer</option>
              <option value="Ingen CT-diagnostik">Ingen CT-diagnostik</option>
              <option value="Katastrofläge - endast livräddande åtgärder">Katastrofläge - endast livräddande åtgärder</option>
            </select>
          </div>

          {/* Automatisering av övningsvyer */}
          <h2 style={{marginTop:32}}>Automatisering av övningsvyer</h2>
          <div style={{marginBottom:16}}>
            <p style={{marginBottom:12,color:'#666'}}>Välj vilka vyer som ska automatiseras. Personal kommer automatiskt att hantera patienter enligt bästa förmåga.</p>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}>
                <input
                  type="checkbox"
                  checked={automatedViews.Prehospital || false}
                  onChange={(e) => {
                    setAutomatedViews({...automatedViews, Prehospital: e.target.checked});
                  }}
                  style={{width:18,height:18,cursor:'pointer'}}
                />
                <span style={{fontSize:16,fontWeight:500}}>Prehospital (automatisk omhändertagande och transport till valt sjukhus)</span>
              </label>
            </div>
          </div>

          {/* Karta för att sätta ut händelsemarkör */}
          <h2 style={{marginTop:32}}>Välj plats för händelse</h2>
          {/* Händelsetyp */}
          <div style={{margin:'16px 0'}}>
            <label style={{fontWeight:'bold',marginRight:8}}>Händelsetyp:</label>
            <select value={eventType} onChange={e => setEventType(e.target.value)} style={{fontSize:16,padding:'4px 8px'}}>
              <option value="explosion">Explosion</option>
              <option value="gunshot">Skott</option>
              <option value="ammoniak">CBRN (Ammoniak)</option>
              <option value="burn">Brännskada</option>
            </select>
          </div>
          <ControlPanelMap
            center={(() => {
              const hospitalCoords = {
                'Norrlands universitetssjukhus': [63.8258, 20.2630],
                'Skellefteå sjukhus': [64.7508, 20.9528],
                'Lycksele lasarett': [64.5975, 18.6743]
              };
              return hospitalCoords[selectedHospital];
            })()}
            onMarkerSet={latlng => {
              localStorage.setItem('prehospitalMapMarker', JSON.stringify(latlng));
              window.dispatchEvent(new CustomEvent('prehospitalMapMarkerSet', { detail: latlng }));
            }}
            eventCount={numPatients}
            setEventCount={setNumPatients}
            onStartEvent={async (markerPosition, eventCount) => {
              // Sparar skadeplatsmarkör för senare bruk
              localStorage.setItem('prehospitalMapMarker', JSON.stringify(markerPosition));
              window.dispatchEvent(new Event('storage'));
              
              // Nollställ fordon och gamla patienter innan nytt scenario startar
              localStorage.removeItem('prehospitalVehicles');
              localStorage.removeItem('prehospitalPatients');
              localStorage.removeItem('deadCollectionPointMarker');
              localStorage.removeItem('paratusPatients');
              setVehicles([]);
              window.dispatchEvent(new CustomEvent('prehospitalVehiclesUpdated', { detail: [] }));
              window.dispatchEvent(new Event('paratusUpdated'));
              
              let patients = [];
              let file = '/patients_explosion_150.json';
              if (eventType === 'gunshot') file = '/patients_gunshot_150.json';
              if (eventType === 'ammoniak') file = '/patients_ammoniak_200.json';
              if (eventType === 'burn') file = '/patients_burn_200.json';
              try {
                const res = await fetch(file);
                patients = await res.json();
              } catch (e) {
                alert('Kunde inte ladda patientdata!');
                return;
              }
              // Blanda patienterna (Fisher-Yates shuffle)
              for (let i = patients.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [patients[i], patients[j]] = [patients[j], patients[i]];
              }
              // Ta ut rätt antal patienter och placera dem kring markören
              const selected = patients.slice(0, eventCount).map((p, i) => {
                const angle = Math.random() * 2 * Math.PI;
                const radius = Math.random() * 0.00045;
                const dLat = Math.cos(angle) * radius;
                const dLng = Math.sin(angle) * radius / Math.cos(markerPosition.lat * Math.PI / 180);
                // Ta bort förinställd triage från filen
                const { triage, ...patientWithoutTriage } = p;
                // Skapa unikt ID genom att kombinera ursprungligt ID med timestamp och index
                const uniqueId = `${p.id}-${Date.now()}-${i}`;
                return {
                  ...patientWithoutTriage,
                  id: uniqueId,
                  originalId: p.id, // Behåll ursprungligt ID som referens
                  lat: markerPosition.lat + dLat,
                  lng: markerPosition.lng + dLng,
                  startTime: simTime,
                  location: 'Skadeplats',
                  currentHospital: null,
                  triage: null // Ingen triage förinställd
                };
              });
              localStorage.setItem('prehospitalPatients', JSON.stringify(selected));
              window.dispatchEvent(new CustomEvent('prehospitalPatientsCreated', { detail: selected }));
              
              // Initialisera uppsamlingsplats EFTER att patienter skapas
              initializeCollectionPoints();
              
              alert(`${selected.length} patienter skapade vid skadeplatsen!`);
            }}
          />

          
          {/* Resurshantering */}
          <h2 style={{marginTop:32}}>Resurshantering - Fordon på plats</h2>
          <div style={{background:'#fff',border:'1px solid #e0e0e0',borderRadius:6,padding:16,marginTop:12}}>
            <div style={{fontWeight:600,marginBottom:12,fontSize:15}}>Lägg till fordon</div>
            <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:16}}>
              <select 
                value={selectedVehicleType} 
                onChange={(e) => setSelectedVehicleType(e.target.value)}
                style={{flex:1,padding:'8px 12px',borderRadius:4,border:'1px solid #bbb',fontSize:14}}
              >
                {Object.entries(vehicleTypes).map(([key, vType]) => (
                  <option key={key} value={key}>
                    {vType.icon} {vType.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => addVehicle(selectedVehicleType)}
                style={{padding:'8px 16px',borderRadius:4,border:'1px solid #4caf50',background:'#4caf50',color:'#fff',fontWeight:600,cursor:'pointer',fontSize:14}}
              >
                Lägg till fordon
              </button>
            </div>
            
            {/* Fordon på väg tillbaka */}
            <VehicleReturnCountdown vehicles={vehicles} simTime={simTime} />
            
            <div style={{fontWeight:600,marginBottom:8,fontSize:15,marginTop:16}}>
              Fordon på skadeplatsen ({vehicles.filter(v => v.status !== 'away').length})
            </div>
            {vehicles.filter(v => v.status !== 'away').length === 0 ? (
              <div style={{color:'#999',fontSize:14,fontStyle:'italic',padding:12,background:'#f5f5f5',borderRadius:4}}>
                Inga fordon på plats
              </div>
            ) : (
              <div style={{display:'grid',gap:8,marginBottom:16}}>
                {(() => {
                  // Filtrera bort fordon som är away och gruppera resten efter typ
                  const grouped = vehicles.filter(v => v.status !== 'away').reduce((acc, vehicle) => {
                    if (!acc[vehicle.type]) {
                      acc[vehicle.type] = { vehicles: [], busy: 0 };
                    }
                    acc[vehicle.type].vehicles.push(vehicle);
                    if (vehicle.status === 'busy') {
                      acc[vehicle.type].busy++;
                    }
                    return acc;
                  }, {});
                  
                  return Object.entries(grouped).map(([type, data]) => {
                    const vType = vehicleTypes[type];
                    const hasBusy = data.busy > 0;
                    const count = data.vehicles.length;
                    return (
                      <div key={type} style={{
                        background:'#f5f5f5',
                        padding:'12px',
                        borderRadius:6,
                        border: hasBusy ? '2px solid #ff9800' : '1px solid #e0e0e0'
                      }}>
                        <div style={{fontWeight:600,fontSize:15,marginBottom:4}}>
                          {count}x {vType.icon} {vType.label}
                        </div>
                        <div style={{fontSize:13,color:'#666'}}>
                          Personal: {Object.entries(vType.personnel).map(([cat, count]) => 
                            `${count}x ${personnelCategories[cat].label}`
                          ).join(', ')}
                        </div>
                        {hasBusy && (
                          <div style={{fontSize:12,color:'#ff9800',fontWeight:600,marginTop:4}}>
                            🔄 {data.busy} upptagen{data.busy > 1 ? 'a' : ''}
                          </div>
                        )}
                        <div style={{marginTop:8,display:'flex',gap:6,flexWrap:'wrap'}}>
                          {data.vehicles.map(vehicle => (
                            <button
                              key={vehicle.id}
                              onClick={() => {
                                if (window.confirm(`Ta bort ett ${vType.label}?`)) {
                                  removeVehicle(vehicle.id);
                                }
                              }}
                              style={{padding:'4px 8px',borderRadius:4,border:'1px solid #f44336',background:'#f44336',color:'#fff',fontSize:12,cursor:'pointer',fontWeight:600}}
                            >
                              Ta bort
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
            
            <div style={{fontWeight:600,marginBottom:8,fontSize:15,marginTop:16}}>Personal - översikt</div>
            {(() => {
              const availablePersonnel = getAvailablePersonnel(vehicles);
              
              return (
                <div>
                  {/* Tillgänglig personal */}
                  <div style={{marginBottom:12}}>
                    <div style={{fontWeight:600,fontSize:14,marginBottom:6,color:'#4caf50'}}>Tillgänglig personal</div>
                    {Object.keys(availablePersonnel).length === 0 ? (
                      <div style={{color:'#999',fontSize:13,fontStyle:'italic'}}>Ingen personal tillgänglig</div>
                    ) : (
                      <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                        {Object.entries(availablePersonnel).map(([cat, count]) => (
                          <div key={cat} style={{
                            background:personnelCategories[cat].color,
                            color:'#fff',
                            padding:'6px 10px',
                            borderRadius:4,
                            fontSize:13,
                            fontWeight:600
                          }}>
                            {count}x {personnelCategories[cat].label}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Upptagen personal */}
                  <div>
                    <div style={{fontWeight:600,fontSize:14,marginBottom:6,color:'#ff9800'}}>Upptagen personal</div>
                    {(() => {
                      const busyPersonnel = {};
                      Object.entries(totalPersonnel).forEach(([cat, total]) => {
                        const available = availablePersonnel[cat] || 0;
                        const busy = total - available;
                        if (busy > 0) {
                          busyPersonnel[cat] = busy;
                        }
                      });
                      
                      return Object.keys(busyPersonnel).length === 0 ? (
                        <div style={{color:'#999',fontSize:13,fontStyle:'italic'}}>Ingen personal upptagen</div>
                      ) : (
                        <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                          {Object.entries(busyPersonnel).map(([cat, count]) => (
                            <div key={cat} style={{
                              background:personnelCategories[cat].color,
                              color:'#fff',
                              padding:'6px 10px',
                              borderRadius:4,
                              fontSize:13,
                              fontWeight:600,
                              opacity:0.7
                            }}>
                              {count}x {personnelCategories[cat].label}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Exercise panel: shows buttons that open windows */}
      {showExercisePanel && (
        <div style={{ marginBottom: 20, padding: 12, border: '1px solid #e0e0e0', borderRadius: 6 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => openWindow('Prehospital')} style={panelBtn}>Prehospital</button>
            <button onClick={() => openWindow('Paratus')} style={panelBtn}>Paratus</button>
            <button onClick={() => openWindow('Akutmottagning')} style={panelBtn}>Akutmottagning</button>
            <button onClick={() => openWindow('OP')} style={panelBtn}>OP</button>
            <button onClick={() => openWindow('IVA')} style={panelBtn}>IVA</button>
            <button onClick={() => openWindow('POSTOP')} style={panelBtn}>POSTOP</button>
            <button onClick={() => openWindow('Mottagningar')} style={panelBtn}>Mottagningar</button>
            <button onClick={() => openWindow('Avdelningar')} style={panelBtn}>Avdelningar</button>
            <button onClick={() => openWindow('Hem')} style={panelBtn}>Hem</button>
            <button onClick={() => openWindow('Personal')} style={panelBtn}>Personal</button>
          </div>
        </div>
      )}

      {/* Render open windows */}
      {windows.map(w => (
        <Window key={w.id} id={w.id} title={w.title} onClose={() => closeWindow(w.id)} simTime={simTime} simWeekday={weekdays[simWeekday]}>
          {w.title === 'Akutmottagning' ? (
            <div>
              <div style={{fontWeight:'bold',marginBottom:8}}>
                Antal patienter: {w.content ? w.content.length : 0}
              </div>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead>
                  <tr style={{background:'#e0e0e0'}}>
                    <th style={th}>PRIO</th>
                    <th style={th}>Starttid</th>
                    <th style={th}>Plats</th>
                    <th style={th}>Personnummer</th>
                    <th style={{...th, minWidth: 180, maxWidth: 300, whiteSpace: 'normal'}}>Namn</th>
                    <th style={th}>Prioriteringsorsak</th>
                    <th style={th}>Aktiviteter</th>
                    <th style={th}>Läkemedel</th>
                    <th style={th}>Läkare</th>
                    <th style={th}>Sjuksköterska</th>
                    <th style={th}>Förflyttning</th>
                    <th style={th}>Ålder</th>
                    <th style={th}>Remiss</th>
                    <th style={th}>Patienttyp</th>
                    <th style={th}>Ankomstsätt</th>
                    <th style={th}>Sökorsak</th>
                    <th style={th}>Medicinsk enhet</th>
                    <th style={th}>Team</th>
                  </tr>
                </thead>
                <tbody>
                  {(w.content || []).map((p, i) => (
                    <tr key={p.id || i} style={{background:i%2?'#f9f9f9':'#fff'}}>
                      <td style={td}>
                        {(() => {
                          const colorMap = {
                            'röd': '#e53935',
                            'gul': '#ffd600',
                            'grön': '#43a047',
                            'orange': '#ff9800',
                            'blå': '#2196f3',
                            'vit': '#fff',
                            'svart': '#222'
                          };
                          const prio = (p.triage?.emergencyDept||'').toLowerCase();
                          const color = colorMap[prio] || '#ccc';
                          return <span style={{display:'inline-flex',alignItems:'center',gap:6}}>
                            <span style={{display:'inline-block',width:14,height:14,borderRadius:'50%',background:color,border:'1px solid #888',marginRight:4}}></span>
                            {p.triage?.emergencyDept||''}
                          </span>;
                        })()}
                      </td>
                      <td style={td}>{p.startTime || ''}</td>
                      <td style={td}>{p.location || ''}</td>
                      <td style={td}>{p.personnummer}</td>
                      <td style={{...td, minWidth: 180, maxWidth: 300, whiteSpace: 'normal', wordBreak: 'break-word'}}>
                        {typeof p.name === 'object' ? (p.name?.name || p.name?.fornamn || 'Patient') : p.name}{p.surname ? ' ' + p.surname : ''}
                      </td>
                      <td style={td}>{p.mechanism || ''}</td>
                      <td style={td}>{p.activities?.join(', ')||''}</td>
                      <td style={td}>{p.medications?.join(', ')||''}</td>
                      <td style={td}>{p.doctor || ''}</td>
                      <td style={td}>{p.nurse || ''}</td>
                      <td style={td}>
                        <span style={{display:'flex',alignItems:'center',gap:4}}>
                          <select
                            value={p.transfer || ''}
                            onChange={e => handleTransferChange(w.id, i, e.target.value)}
                            style={{padding:'2px 6px',fontSize:13}}
                          >
                            <option value="">Välj avdelning</option>
                            {departmentOptions[selectedHospital].map(dep => (
                              <option key={dep} value={dep}>{dep}</option>
                            ))}
                          </select>
                          <button
                            style={{padding:'2px 8px',fontSize:13,cursor:'pointer'}}
                            disabled={!p.transfer}
                            title="Skicka till avdelning"
                            onClick={() => {
                              if (p.transfer === 'Hem') {
                                console.log('[Akutmottagning] Patient skickas till Hem:', p);
                                let depPatients = {};
                                try {
                                  depPatients = JSON.parse(localStorage.getItem('departmentPatients') || '{}');
                                } catch {}
                                Object.keys(depPatients).forEach(dep => {
                                  depPatients[dep] = depPatients[dep].filter(x => x.id !== p.id);
                                });
                                depPatients['Hem'] = depPatients['Hem'] || [];
                                if (!depPatients['Hem'].some(x => x.id === p.id)) {
                                  depPatients['Hem'].push({ ...p });
                                  console.log('[Hem] departmentPatients["Hem"] innan setItem:', depPatients['Hem']);
                                  localStorage.setItem('departmentPatients', JSON.stringify(depPatients));
                                  console.log('[Hem] departmentPatients["Hem"] efter setItem:', JSON.parse(localStorage.getItem('departmentPatients'))['Hem']);
                                  window.dispatchEvent(new CustomEvent('storage', { key: 'departmentPatients' }));
                                } else {
                                  console.log('[Hem] Patient redan i departmentPatients["Hem"]:', p.id);
                                }
                              }
                              alert(`Patienten skickas till ${p.transfer}`);
                            }}
                          >
                            ➔
                          </button>
                        </span>
                      </td>
                        <td style={td}>{(() => {
                          if (p.personnummer && /^\d{4}/.test(p.personnummer)) {
                            const birthYear = parseInt(p.personnummer.substring(0,4), 10);
                            if (!isNaN(birthYear)) {
                              return 2025 - birthYear;
                            }
                          }
                          return '';
                        })()}</td>
                      <td style={td}>{p.referral || ''}</td>
                      <td style={td}>{p.patientType || ''}</td>
                      <td style={td}>{(() => {
                        const ambuMechanisms = [
                          'Trafikolycka', 'Skott', 'Explosion', 'Brännskada', 'Stickskada',
                          'Multitrauma', 'Fall från höjd', 'Skadeplats', 'Masskade',
                          'Hjärtstopp', 'Drunkning', 'Brand', 'Krosskada', 'Klämning', 'Våld', 'Masskrock'
                        ];
                        if (ambuMechanisms.some(m => (p.mechanism||'').toLowerCase().includes(m.toLowerCase()))) {
                          return 'ambulans';
                        }
                        return 'egen transport';
                      })()}</td>
                      <td style={td}>{p.cause || ''}</td>
                      <td style={td}>{p.medicalUnit || ''}</td>
                      <td style={td}>{p.team || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : w.title === 'Hem' ? (
            <Hem />
          ) : null}
        </Window>
      ))}

    </div>
  )
}

const panelBtn = {
  padding: '8px 12px',
  borderRadius: 6,
  border: '1px solid #007acc',
  background: '#007acc',
  color: '#fff',
  cursor: 'pointer'
}

const headerBtnActive = {
  padding: '10px 16px',
  fontSize: 14,
  cursor: 'pointer',
  borderRadius: 6,
  border: '1px solid #007acc',
  background: '#007acc',
  color: '#fff'
}

const headerBtnInactive = {
  padding: '10px 16px',
  fontSize: 14,
  cursor: 'pointer',
  borderRadius: 6,
  border: '1px solid #ccc',
  background: '#fff',
  color: '#000'
}
