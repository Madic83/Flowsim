import React, { useState, useEffect, useRef } from 'react'
import Window from './components/Window'
import Hem from './components/Hem'
import ControlPanelMap from './components/ControlPanelMap';
import { vehicleTypes, personnelCategories, getTotalPersonnel, getAvailablePersonnel } from './components/prehospitalResources';
import { startPrehospitalAutomationLoop, initializeCollectionPoints } from './prehospitalAutomation';
import { getPatientDeteriorationFactor, getStaffEfficiency, getVehicleSpeedFactor, isDarkAtTime } from './weatherImpact';
import { applyDepartmentOccupancyLevel } from './departmentOccupancy';
import { assignInitialAcuteStartTimes, hasDistinctStartTimes } from './acuteStartTimes';

// Tabellcell-stilar
const th = {border:'1px solid #ccc',padding:'4px 8px',background:'#e0e0e0',fontWeight:'bold'}
const td = {border:'1px solid #ccc',padding:'4px 8px'}
const SESSION_STORAGE_KEY = 'flowsimSessionAuth'
const DEFAULT_PERSONNEL_CONFIG = {
  akutläkare: 4,
  akutsjuksköterskor: 4,
  narkoslakare: 2,
  narkosskoterskor: 2,
  ivaskoterskor: 4,
  operationsskoterskor: 2,
  kirurger: 1,
  ortopeder: 1,
  usk_akut: 5,
  usk_op: 2,
  usk_iva: 4
};
const DEFAULT_SIMULATION_ENVIRONMENT = {
  weather: 'clear',
  temperatureC: 15,
  windSpeed: 0,
  forceDarkness: false,
  lighting: true,
  surface: 'asphalt'
};

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

function PersonnelCountControl({ label, value, onChange, onAdd, addDisabled = false }) {
  return (
    <div>
      <label style={{display:'block',marginBottom:4,fontWeight:600}}>{label}:</label>
      <div style={{display:'flex',alignItems:'center',gap:5}}>
        <input
          type="number"
          min="0"
          max="500"
          value={value}
          onChange={onChange}
          style={{fontSize:16,padding:'4px 8px',width:60}}
        />
        <button
          type="button"
          aria-label={`Lägg till ${label.toLocaleLowerCase('sv')}`}
          title={`Lägg till en ${label.toLocaleLowerCase('sv')}`}
          disabled={value >= 500}
          onClick={onAdd}
          style={{width:30,height:30,padding:0,border:'1px solid #087f91',borderRadius:4,background:'#fff',color:'#087f91',fontSize:20,fontWeight:700,lineHeight:1,cursor:value >= 500 ? 'not-allowed' : 'pointer'}}
        >
          +
        </button>
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
  const [authForm, setAuthForm] = useState({ role: 'participant', username: '', password: '', sessionId: '' });
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [connectedParticipantCount, setConnectedParticipantCount] = useState(null);

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

  const [showExercisePanel, setShowExercisePanel] = useState(() => new URLSearchParams(window.location.search).get('view') === 'exercises')
  const [selectedHospital, setSelectedHospital] = useState(hospitals[0]);
  const controlPanelMapRef = useRef();

  useEffect(() => {
    function handleExerciseWindowReturn(event) {
      if (event.data?.type === 'returnToExerciseViews') setShowExercisePanel(true);
    }
    window.addEventListener('message', handleExerciseWindowReturn);
    return () => window.removeEventListener('message', handleExerciseWindowReturn);
  }, []);
  
  // Medicinska inriktningsbeslut
  const [medicalDirective, setMedicalDirective] = useState(() => {
    return localStorage.getItem('medicalDirective') || 'Inget inriktningsbeslut';
  });
  const [departmentOccupancyLevel, setDepartmentOccupancyLevel] = useState(() => (
    localStorage.getItem('departmentOccupancyLevel') || ''
  ));
  const [departmentOccupancyStatus, setDepartmentOccupancyStatus] = useState('');
  const appliedOccupancyPresetRef = useRef('');
  const [initialAcutePatientCount, setInitialAcutePatientCount] = useState(() => (
    Number(localStorage.getItem('initialAcutePatientCount') ?? 20)
  ));
  const [acuteAdmissionsPerHour, setAcuteAdmissionsPerHour] = useState(() => (
    Number(localStorage.getItem('acuteAdmissionsPerHour') ?? 2)
  ));
  const [simulationStarted, setSimulationStarted] = useState(() => localStorage.getItem('simulationStarted') === 'true');
  const [acuteAdmissionStatus, setAcuteAdmissionStatus] = useState('');
  const acuteAdmissionRemainderRef = useRef(Number(localStorage.getItem('acuteAdmissionRemainder') || 0));
  const acuteAdmissionSequenceRef = useRef(Number(localStorage.getItem('acuteAdmissionSequence') || 0));
  const lastAcuteAdmissionSimTimeRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('initialAcutePatientCount', String(initialAcutePatientCount));
  }, [initialAcutePatientCount]);

  useEffect(() => {
    localStorage.setItem('acuteAdmissionsPerHour', String(acuteAdmissionsPerHour));
  }, [acuteAdmissionsPerHour]);

  function getOccupancyPresetKey(level) {
    return `${sessionAuth?.sessionId || 'local'}:${selectedHospital}:${level}`;
  }

  function handleDepartmentOccupancyChange(level) {
    setDepartmentOccupancyLevel(level);
    localStorage.setItem('departmentOccupancyLevel', level);
    if (!level || selectedHospital !== 'Norrlands universitetssjukhus') return;

    let currentDepartments = {};
    try {
      currentDepartments = JSON.parse(localStorage.getItem('departmentPatients') || '{}');
    } catch {}

    const result = applyDepartmentOccupancyLevel(currentDepartments, level, simTime, departmentPatientPool);
    if (result.missingPatientPool) {
      setDepartmentOccupancyStatus('Patientlistan har inte laddats ännu. Försök igen om en liten stund.');
      return;
    }
    appliedOccupancyPresetRef.current = getOccupancyPresetKey(level);
    const serializedDepartments = JSON.stringify(result.departmentPatients);
    localStorage.setItem('departmentPatients', serializedDepartments);
    window.dispatchEvent(new CustomEvent('departmentPatientsUpdated', {
      detail: { departmentPatients: result.departmentPatients }
    }));
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'departmentPatients',
      newValue: serializedDepartments
    }));
    localStorage.setItem('departmentOccupancyLevel', level);
    if (sessionAuth?.role === 'instructor' && sessionAuth.sessionId) {
      fetch(`/api/sessions/${encodeURIComponent(sessionAuth.sessionId)}/departments`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ departmentPatients: result.departmentPatients })
      }).catch(() => {});
    }
    openWindowsRef.current = openWindowsRef.current.filter(win => win && !win.closed);
    for (const win of openWindowsRef.current) {
      try {
        win.postMessage({
          type: 'departmentOccupancyUpdate',
          departmentOccupancyLevel: level,
          departmentPatients: result.departmentPatients
        }, '*');
      } catch {}
    }

    const levelName = { low: 'Låg', medium: 'Medel', high: 'Hög' }[level];
    const preservedWarning = result.departmentsOverTarget
      ? ` ${result.departmentsOverTarget} avdelningar har fler riktiga patienter än presetmålet; de har behållits.`
      : '';
    const invalidPatientWarning = result.invalidPatientCount
      ? ` ${result.invalidPatientCount} ofullständiga eller felplacerade patientposter togs bort från avdelningslistorna.`
      : '';
    const missingWarning = result.unfilledDepartments.length
      ? ` Matchande patientdata saknas för: ${result.unfilledDepartments.map(item => `${item.department} (${item.missing})`).join(', ')}.`
      : '';
    setDepartmentOccupancyStatus(`${levelName} beläggning vald. ${result.createdPatients} matchande simulerade patienter placerades ut.${preservedWarning}${invalidPatientWarning}${missingWarning}`);
  }

  const [simulationEnvironment, setSimulationEnvironment] = useState(() => {
    try {
      return {
        weather: 'clear',
        temperatureC: 15,
        windSpeed: 0,
        forceDarkness: false,
        lighting: true,
        surface: 'asphalt',
        ...(() => {
          const saved = JSON.parse(localStorage.getItem('simulationEnvironment') || '{}');
          return { ...saved, forceDarkness: saved.forceDarkness ?? saved.darkness ?? false };
        })()
      };
    } catch {
      return { weather: 'clear', temperatureC: 15, windSpeed: 0, forceDarkness: false, lighting: true, surface: 'asphalt' };
    }
  });

  useEffect(() => {
    localStorage.setItem('simulationEnvironment', JSON.stringify(simulationEnvironment));
    window.dispatchEvent(new CustomEvent('simulationEnvironmentChanged', { detail: simulationEnvironment }));
    openWindowsRef.current = openWindowsRef.current.filter(win => win && !win.closed);
    for (const win of openWindowsRef.current) {
      try { win.postMessage({ type: 'simulationEnvironment', simulationEnvironment }, '*'); } catch {}
    }
    if (sessionAuth?.role === 'instructor' && sessionAuth.sessionId) {
      fetch(`/api/sessions/${encodeURIComponent(sessionAuth.sessionId)}/environment`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ environment: simulationEnvironment })
      }).catch(() => {});
    }
  }, [simulationEnvironment, sessionAuth?.role, sessionAuth?.sessionId]);
  
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

  useEffect(() => {
    if (sessionAuth?.role !== 'participant' || !sessionAuth.memberId || !sessionAuth.sessionId || sessionAuth.sessionId === 'ÖPPEN') {
      return undefined;
    }

    const sendHeartbeat = () => {
      fetch(`/api/sessions/${encodeURIComponent(sessionAuth.sessionId)}/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: sessionAuth.memberId })
      }).catch(() => {});
    };

    const syncEnvironment = async () => {
      try {
        const response = await fetch(`/api/sessions/${encodeURIComponent(sessionAuth.sessionId)}/status`);
        if (response.status === 404) {
          setAuthError('Sessionen finns inte längre. Be instruktören skapa en ny session och anslut med den nya koden.');
          setSessionAuth(null);
          return;
        }
        if (!response.ok) return;
        const status = await response.json();
        if (status.environment) {
          setSimulationEnvironment(previous => (
            JSON.stringify(previous) === JSON.stringify(status.environment) ? previous : status.environment
          ));
        }
        if (status.departmentPatients) {
          const serializedDepartments = JSON.stringify(status.departmentPatients);
          if (localStorage.getItem('departmentPatients') !== serializedDepartments) {
            localStorage.setItem('departmentPatients', serializedDepartments);
            window.dispatchEvent(new CustomEvent('departmentPatientsUpdated', {
              detail: { departmentPatients: status.departmentPatients }
            }));
          }
        }
        if (status.acutePatients) {
          const serializedAcutePatients = JSON.stringify(status.acutePatients);
          if (localStorage.getItem('akutPatients') !== serializedAcutePatients) {
            localStorage.setItem('akutPatients', serializedAcutePatients);
            window.dispatchEvent(new CustomEvent('akutSync', {
              detail: { akutPatients: status.acutePatients }
            }));
          }
        }
      } catch {}
    };

    sendHeartbeat();
    syncEnvironment();
    const heartbeatInterval = setInterval(sendHeartbeat, 15000);
    const environmentInterval = setInterval(syncEnvironment, 5000);
    return () => {
      clearInterval(heartbeatInterval);
      clearInterval(environmentInterval);
    };
  }, [sessionAuth]);

  useEffect(() => {
    if (sessionAuth?.role !== 'instructor' || !sessionAuth.sessionId) {
      setConnectedParticipantCount(null);
      return undefined;
    }

    let isActive = true;
    const refreshParticipantCount = async () => {
      try {
        const response = await fetch(`/api/sessions/${encodeURIComponent(sessionAuth.sessionId)}/status`);
        if (!response.ok) return;
        const status = await response.json();
        if (isActive) setConnectedParticipantCount(status.participantCount);
      } catch {}
    };

    refreshParticipantCount();
    const interval = setInterval(refreshParticipantCount, 10000);
    return () => {
      isActive = false;
      clearInterval(interval);
    };
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
      usk_op: 2,
      usk_iva: 4
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
  const [hospitalPersonnelExtraCounts, setHospitalPersonnelExtraCounts] = useState(() => {
    try {
      const savedExtraCounts = localStorage.getItem('hospitalPersonnelExtraCounts');
      if (savedExtraCounts) return JSON.parse(savedExtraCounts) || {};
      const savedConfig = JSON.parse(localStorage.getItem('hospitalPersonnelConfig') || '{}');
      const initialCounts = {
        akutläkare: 4,
        akutsjuksköterskor: 4,
        narkoslakare: 2,
        narkosskoterskor: 2,
        ivaskoterskor: 4,
        operationsskoterskor: 2,
        kirurger: 1,
        ortopeder: 1,
        usk_akut: 5,
        usk_op: 2,
        usk_iva: 4
      };
      return Object.fromEntries(Object.entries(initialCounts).map(([key, initialCount]) => [
        key,
        Math.max(0, (Number(savedConfig[key]) || initialCount) - initialCount)
      ]));
    } catch {
      return {};
    }
  });
  const [updatingPersonnelCategory, setUpdatingPersonnelCategory] = useState('');
  const [personnelUpdateNotice, setPersonnelUpdateNotice] = useState('');
  const hospitalPersonnelRef = useRef(hospitalPersonnel);
  const hospitalPersonnelExtraCountsRef = useRef(hospitalPersonnelExtraCounts);
  const personnelRegenerationQueueRef = useRef({ running: false, requested: false, categoryKey: '', categoryLabel: '' });

  useEffect(() => {
    hospitalPersonnelRef.current = hospitalPersonnel;
  }, [hospitalPersonnel]);

  useEffect(() => {
    hospitalPersonnelExtraCountsRef.current = hospitalPersonnelExtraCounts;
  }, [hospitalPersonnelExtraCounts]);

  function getPersonnelGeneratorCounts(config) {
    return {
      'Akutläkare': config.akutläkare,
      'Anestesiläkare': config.narkoslakare,
      'Ortopeder': config.ortopeder,
      'Kirurger': config.kirurger,
      'Narkossköterskor': config.narkosskoterskor,
      'Undersköterskor operation': config.usk_op,
      'Operationssköterskor': config.operationsskoterskor,
      'Akutsjuksköterskor': config.akutsjuksköterskor,
      'Undersköterskor akuten': config.usk_akut,
      'IVA-sköterskor': config.ivaskoterskor,
      'Avdelningssköterskor': config.avdelningsskoterskor ?? 50,
      'Undersköterskor IVA': config.usk_iva,
      'Undersköterskor avdelning': config.usk_avd ?? 50
    };
  }

  async function flushPersonnelRegenerationQueue() {
    const queue = personnelRegenerationQueueRef.current;
    if (queue.running) return;
    queue.running = true;
    setUpdatingPersonnelCategory(queue.categoryKey);
    try {
      while (queue.requested) {
        queue.requested = false;
        const latestConfig = hospitalPersonnelRef.current;
        const categoryLabel = queue.categoryLabel;
        const response = await fetch('/api/regenerate-personnel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ counts: getPersonnelGeneratorCounts(latestConfig), cacheBust: Date.now() })
        });
        if (!response.ok) throw new Error('Kunde inte uppdatera personalregistret.');
        localStorage.setItem('hospitalPersonnelRosterVersion', `${Date.now()}-${Math.random()}`);
        window.dispatchEvent(new CustomEvent('hospitalPersonnelRosterChanged'));
        if (categoryLabel) setPersonnelUpdateNotice(`En ${categoryLabel.toLocaleLowerCase('sv')} har lagts till.`);
      }
    } catch (error) {
      setPersonnelUpdateNotice(error.message || 'Kunde inte uppdatera personalregistret.');
    } finally {
      queue.running = false;
      setUpdatingPersonnelCategory('');
      if (queue.requested) flushPersonnelRegenerationQueue();
    }
  }

  async function addHospitalPersonnel(categoryKey, categoryLabel) {
    const currentConfig = hospitalPersonnelRef.current;
    if (currentConfig[categoryKey] >= 500) return;
    const updatedConfig = { ...currentConfig, [categoryKey]: currentConfig[categoryKey] + 1 };
    const updatedExtraCounts = {
      ...hospitalPersonnelExtraCountsRef.current,
      [categoryKey]: (Number(hospitalPersonnelExtraCountsRef.current[categoryKey]) || 0) + 1
    };

    hospitalPersonnelRef.current = updatedConfig;
    hospitalPersonnelExtraCountsRef.current = updatedExtraCounts;
    setHospitalPersonnel(updatedConfig);
    setHospitalPersonnelExtraCounts(updatedExtraCounts);
    localStorage.setItem('hospitalPersonnelConfig', JSON.stringify(updatedConfig));
    localStorage.setItem('hospitalPersonnelExtraCounts', JSON.stringify(updatedExtraCounts));
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'hospitalPersonnelExtraCounts',
      newValue: JSON.stringify(updatedExtraCounts)
    }));
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'hospitalPersonnelConfig',
      newValue: JSON.stringify(updatedConfig)
    }));
    setPersonnelUpdateNotice('');
    personnelRegenerationQueueRef.current.requested = true;
    personnelRegenerationQueueRef.current.categoryKey = categoryKey;
    personnelRegenerationQueueRef.current.categoryLabel = categoryLabel;
    flushPersonnelRegenerationQueue();
  }
  
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
  const effectiveSimulationEnvironment = {
    ...simulationEnvironment,
    darkness: Boolean(simulationEnvironment.forceDarkness) || isDarkAtTime(simTime)
  };
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
  const [departmentSourcePatients, setDepartmentSourcePatients] = useState([])
  const [departmentSourcePatientsLoading, setDepartmentSourcePatientsLoading] = useState(true)
  const [numPatients, setNumPatients] = useState(0)
  const [loadingPatients, setLoadingPatients] = useState(false)
  const [patientsError, setPatientsError] = useState(null)

  useEffect(() => {
    const previousTime = lastAcuteAdmissionSimTimeRef.current;
    lastAcuteAdmissionSimTimeRef.current = simTime;
    if (!simulationStarted || !previousTime || acuteAdmissionsPerHour <= 0 || allPatients.length === 0) return;

    const toMinutes = value => {
      const [hours, minutes] = value.split(':').map(Number);
      return hours * 60 + minutes;
    };
    const elapsedMinutes = (toMinutes(simTime) - toMinutes(previousTime) + 1440) % 1440;
    if (elapsedMinutes === 0) return;

    const accumulated = acuteAdmissionRemainderRef.current + elapsedMinutes * acuteAdmissionsPerHour / 60;
    const arrivalsDue = Math.floor(accumulated);
    acuteAdmissionRemainderRef.current = accumulated - arrivalsDue;
    localStorage.setItem('acuteAdmissionRemainder', String(acuteAdmissionRemainderRef.current));
    if (arrivalsDue === 0) return;

    addSpontaneousAcuteArrivals(selectedHospital, arrivalsDue, simTime);
  }, [simTime, simulationStarted, acuteAdmissionsPerHour, allPatients, selectedHospital]);
  
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

  const departmentPatientPool = Array.from(
    new Map([...allPatients, ...departmentSourcePatients].filter(patient => patient?.id).map(patient => [patient.id, patient])).values()
  );

  useEffect(() => {
    let cancelled = false;
    const sourceFiles = [
      '/patients_department_specialties.json',
      '/patients_explosion_150.json',
      '/patients_ammoniak_200.json',
      '/patients_burn_200.json',
      '/patients_gunshot_150.json'
    ];

    Promise.all(sourceFiles.map(async file => {
      try {
        const response = await fetch(file);
        if (!response.ok) return [];
        const patients = await response.json();
        return Array.isArray(patients) ? patients : [];
      } catch {
        return [];
      }
    })).then(pools => {
      if (!cancelled) setDepartmentSourcePatients(pools.flat());
    }).finally(() => {
      if (!cancelled) setDepartmentSourcePatientsLoading(false);
    });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (sessionAuth?.role !== 'instructor' || selectedHospital !== 'Norrlands universitetssjukhus') return;
    if (!departmentOccupancyLevel || loadingPatients || departmentSourcePatientsLoading || allPatients.length === 0) return;
    if (appliedOccupancyPresetRef.current === getOccupancyPresetKey(departmentOccupancyLevel)) return;
    handleDepartmentOccupancyChange(departmentOccupancyLevel);
  }, [
    sessionAuth?.role,
    sessionAuth?.sessionId,
    selectedHospital,
    departmentOccupancyLevel,
    loadingPatients,
    departmentSourcePatientsLoading,
    allPatients.length,
    departmentSourcePatients.length
  ]);

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
    if (window.matchMedia('(max-width: 760px)').matches) {
      window.location.assign(url);
      return;
    }
    const win = window.open(url, '_blank');
    openWindowsRef.current.push(win);
    setTimeout(() => {
      try { win.postMessage({ type: 'simTime', simTime }, '*'); } catch {}
      try { win.postMessage({ type: 'simulationEnvironment', simulationEnvironment }, '*'); } catch {}
      try {
        win.postMessage({
          type: 'departmentOccupancyUpdate',
          departmentOccupancyLevel,
          departmentPatients: JSON.parse(localStorage.getItem('departmentPatients') || '{}')
        }, '*');
      } catch {}
      if (title === 'Akutmottagning') {
        const akutPatients = JSON.parse(localStorage.getItem('akutPatients') || '{}');
        try { win.postMessage({ type: 'akutSync', akutPatients }, '*'); } catch {}
        akutWindowRef.current = win;
      }
    }, 300);
  }

  function persistAcutePatientLists(acutePatientsByHospital) {
    const serialized = JSON.stringify(acutePatientsByHospital);
    localStorage.setItem('akutPatients', serialized);
    window.dispatchEvent(new CustomEvent('akutSync', { detail: { akutPatients: acutePatientsByHospital } }));
    if (sessionAuth?.role === 'instructor' && sessionAuth.sessionId) {
      fetch(`/api/sessions/${encodeURIComponent(sessionAuth.sessionId)}/acute-patients`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acutePatients: acutePatientsByHospital })
      }).catch(() => {});
    }
    openWindowsRef.current = openWindowsRef.current.filter(win => win && !win.closed);
    for (const win of openWindowsRef.current) {
      try { win.postMessage({ type: 'akutSync', akutPatients: acutePatientsByHospital }, '*'); } catch {}
    }
  }

  function createNonSceneAcutePatients(count, hospital, arrivalTime = simTime, initialCensus = false) {
    if (!allPatients.length || count <= 0) return [];
    return Array.from({ length: count }, () => {
      const sequence = acuteAdmissionSequenceRef.current;
      acuteAdmissionSequenceRef.current += 1;
      const source = allPatients[sequence % allPatients.length];
      return {
        ...source,
        id: `${source.id}-NONSCENE-${Date.now()}-${sequence}`,
        originalId: source.id,
        startTime: arrivalTime,
        currentHospital: hospital,
        location: 'Akutmottagning',
        arrivalSource: 'egen transport',
        prehospital: false,
        initialAcuteCensus: initialCensus
      };
    });
  }

  function getAcuteStartTimeVersionKey(hospital = selectedHospital) {
    return `acuteStartTimesVersion:${sessionAuth?.sessionId || 'local'}:${hospital}`;
  }

  function repairInitialAcutePatientStartTimes(hospital = selectedHospital) {
    let acutePatientsByHospital = {};
    try {
      acutePatientsByHospital = JSON.parse(localStorage.getItem('akutPatients') || '{}');
    } catch {}
    const hospitalPatients = acutePatientsByHospital[hospital] || [];
    let initialPatients = hospitalPatients.filter(patient => patient.initialAcuteCensus);

    if (initialPatients.length === 0) {
      initialPatients = hospitalPatients
        .filter(patient => (
          patient.prehospital === false &&
          ['egen transport', 'spontan ankomst'].includes(String(patient.arrivalSource || '').toLocaleLowerCase('sv'))
        ))
        .slice(0, Math.max(0, initialAcutePatientCount));
    }

    const versionKey = getAcuteStartTimeVersionKey(hospital);
    if (initialPatients.length === 0) {
      localStorage.setItem(versionKey, '1');
      return false;
    }

    if (hasDistinctStartTimes(initialPatients)) {
      localStorage.setItem(versionKey, '1');
      return false;
    }

    const simulationStartTime = localStorage.getItem('acuteSimulationStartTime') || initialPatients[0]?.startTime || simTime;
    const backdatedPatients = assignInitialAcuteStartTimes(initialPatients, simulationStartTime)
      .map(patient => ({ ...patient, initialAcuteCensus: true }));
    const updatedById = new Map(backdatedPatients.map(patient => [patient.id, patient]));
    acutePatientsByHospital[hospital] = hospitalPatients.map(patient => updatedById.get(patient.id) || patient);
    localStorage.setItem('acuteInitialCensusIds', JSON.stringify(backdatedPatients.map(patient => patient.id)));
    localStorage.setItem(versionKey, '1');
    persistAcutePatientLists(acutePatientsByHospital);
    return true;
  }

  useEffect(() => {
    if (!simulationStarted) return;
    repairInitialAcutePatientStartTimes(selectedHospital);
  }, [simulationStarted, selectedHospital, sessionAuth?.sessionId, initialAcutePatientCount, simTime]);

  function addSpontaneousAcuteArrivals(hospital, count, arrivalTime = simTime) {
    if (count <= 0) return [];
    const acutePatients = JSON.parse(localStorage.getItem('akutPatients') || '{}');
    const arrivals = createNonSceneAcutePatients(count, hospital, arrivalTime);
    acutePatients[hospital] = [...(acutePatients[hospital] || []), ...arrivals];
    localStorage.setItem('acuteAdmissionSequence', String(acuteAdmissionSequenceRef.current));
    persistAcutePatientLists(acutePatients);
    return arrivals;
  }

  function startSimulationWithAcutePatients() {
    if (allPatients.length === 0) {
      setAcuteAdmissionStatus('Patientunderlaget laddas fortfarande. Vänta tills det är klart och försök igen.');
      return false;
    }
    if (simulationStarted) {
      repairInitialAcutePatientStartTimes(selectedHospital);
      return true;
    }

    const acutePatients = JSON.parse(localStorage.getItem('akutPatients') || '{}');
    const initialPatients = assignInitialAcuteStartTimes(
      createNonSceneAcutePatients(initialAcutePatientCount, selectedHospital, simTime, true),
      simTime
    );
    acutePatients[selectedHospital] = initialPatients;
    localStorage.setItem('acuteSimulationStartTime', simTime);
    localStorage.setItem('acuteInitialCensusIds', JSON.stringify(initialPatients.map(patient => patient.id)));
    localStorage.setItem(getAcuteStartTimeVersionKey(), '1');
    localStorage.setItem('acuteAdmissionSequence', String(acuteAdmissionSequenceRef.current));
    persistAcutePatientLists(acutePatients);
    acuteAdmissionRemainderRef.current = 0;
    localStorage.setItem('acuteAdmissionRemainder', '0');
    lastAcuteAdmissionSimTimeRef.current = simTime;
    setSimulationStarted(true);
    localStorage.setItem('simulationStarted', 'true');
    setAcuteAdmissionStatus(`${acutePatients[selectedHospital].length} patienter på Akutmottagningen vid start. Spontant inflöde: ${acuteAdmissionsPerHour} per timme.`);
    return true;
  }

  function renderExerciseButton(title) {
    return (
      <button
        key={title}
        type="button"
        onClick={() => openWindow(title)}
        style={panelBtn}
      >
        {title}
      </button>
    );
  }

  // Lägg till nästa patient i Akutmottagning-tabellen
  // Per-hospital patient index
  const [hospitalPatientIndexes, setHospitalPatientIndexes] = useState({
    'Norrlands universitetssjukhus': 0,
    'Skellefteå sjukhus': 0,
    'Lycksele lasarett': 0
  });

  function addNextPatient(hospital) {
    let foundIdx = -1;
    const startIndex = hospitalPatientIndexes[hospital] || 0;
    for (let index = startIndex; index < allPatients.length; index++) {
      if (!allPatients[index].currentHospital) {
        foundIdx = index;
        break;
      }
    }
    if (foundIdx === -1) return;

    const updatedPatients = [...allPatients];
    const newPatient = { ...updatedPatients[foundIdx], startTime: simTime, currentHospital: hospital };
    updatedPatients[foundIdx] = newPatient;
    setAllPatients(updatedPatients);
    setHospitalPatientIndexes(previous => ({ ...previous, [hospital]: foundIdx + 1 }));

    const acutePatients = JSON.parse(localStorage.getItem('akutPatients') || '{}');
    const hospitalPatients = acutePatients[hospital] || [];
    if (!hospitalPatients.some(patient => patient.id === newPatient.id)) {
      acutePatients[hospital] = [...hospitalPatients, newPatient];
      persistAcutePatientLists(acutePatients);
    }
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

  async function resetSimulationData({ session = sessionAuth, resetServerSession = true } = {}) {
    if (resetServerSession && session?.role === 'instructor' && session.sessionId && session.sessionId !== 'ÖPPEN') {
      const sessionUrl = `/api/sessions/${encodeURIComponent(session.sessionId)}`;
      const sharedResetRequests = [
        fetch(`${sessionUrl}/departments`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ departmentPatients: {} }) }),
        fetch(`${sessionUrl}/acute-patients`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acutePatients: {} }) }),
        fetch(`${sessionUrl}/catastrophe-roster`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ catastropheRoster: {} }) }),
        fetch(`${sessionUrl}/environment`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ environment: DEFAULT_SIMULATION_ENVIRONMENT }) })
      ];
      await Promise.allSettled(sharedResetRequests);
    }

    const now = new Date();
    const resetTime = now.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', hour12: false }).padStart(5, '0');
    const resetWeekday = now.getDay() === 0 ? 6 : now.getDay() - 1;
    localStorage.clear();
    if (session) localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    localStorage.setItem('hospitalPersonnelConfig', JSON.stringify(DEFAULT_PERSONNEL_CONFIG));
    localStorage.setItem('hospitalPersonnelExtraCounts', '{}');
    localStorage.setItem('simulationEnvironment', JSON.stringify(DEFAULT_SIMULATION_ENVIRONMENT));
    localStorage.setItem('automatedViews', '{}');
    localStorage.setItem('medicalDirective', 'Inget inriktningsbeslut');
    localStorage.setItem('selectedHospital', hospitals[0]);
    localStorage.setItem('simTime', resetTime);
    localStorage.setItem('initialAcutePatientCount', '20');
    localStorage.setItem('acuteAdmissionsPerHour', '2');
    localStorage.setItem('departmentOccupancyLevel', '');

    setHospitalPersonnel(DEFAULT_PERSONNEL_CONFIG);
    hospitalPersonnelRef.current = DEFAULT_PERSONNEL_CONFIG;
    setHospitalPersonnelExtraCounts({});
    hospitalPersonnelExtraCountsRef.current = {};
    personnelRegenerationQueueRef.current.requested = false;
    setUpdatingPersonnelCategory('');
    setPersonnelUpdateNotice('');
    setSimulationEnvironment(DEFAULT_SIMULATION_ENVIRONMENT);
    setAutomatedViews({});
    setMedicalDirective('Inget inriktningsbeslut');
    setSelectedHospital(hospitals[0]);
    setDepartmentOccupancyLevel('');
    setDepartmentOccupancyStatus('');
    appliedOccupancyPresetRef.current = '';
    setInitialAcutePatientCount(20);
    setAcuteAdmissionsPerHour(2);
    setSimulationStarted(false);
    setAcuteAdmissionStatus('');
    acuteAdmissionRemainderRef.current = 0;
    acuteAdmissionSequenceRef.current = 0;
    lastAcuteAdmissionSimTimeRef.current = null;
    setSimTime(resetTime);
    setSimSpeed(1);
    setSimWeekday(resetWeekday);
    setVehicles([]);
    setSelectedVehicleType('ambulance');
    setEventType('explosion');
    setWindows([]);
    setNumPatients(0);
    setAllPatients([]);
    setPatientsError(null);
    setShowExercisePanel(false);

    personnelRegenerationQueueRef.current.requested = true;
    personnelRegenerationQueueRef.current.categoryKey = '';
    personnelRegenerationQueueRef.current.categoryLabel = '';
    flushPersonnelRegenerationQueue();

    openWindowsRef.current = openWindowsRef.current.filter(win => win && !win.closed);
    for (const win of openWindowsRef.current) {
      try { win.location.reload(); } catch {}
    }
    openWindowsRef.current = [];

    try {
      setLoadingPatients(true);
      const response = await fetch('/api/patients');
      if (!response.ok) throw new Error('Kunde inte hämta patienter');
      const patients = await response.json();
      for (let index = patients.length - 1; index > 0; index--) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [patients[index], patients[swapIndex]] = [patients[swapIndex], patients[index]];
      }
      setAllPatients(patients);
    } catch (error) {
      setPatientsError(error.message);
    } finally {
      setLoadingPatients(false);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setAuthError('');

    const enteredSessionId = (authForm.sessionId || '').trim().toUpperCase();
    if (authForm.role === 'participant' && !enteredSessionId) {
      setSessionAuth({ sessionId: 'ÖPPEN', role: 'participant', displayName: 'Deltagare' });
      return;
    }

    setAuthLoading(true);
    try {
      const isInstructor = authForm.role === 'instructor';
      const response = await fetch(isInstructor ? '/api/sessions/create' : '/api/sessions/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isInstructor ? {
          username: authForm.username,
          password: authForm.password,
          displayName: 'Instruktör',
          environment: DEFAULT_SIMULATION_ENVIRONMENT
        } : {
          sessionId: enteredSessionId,
          role: 'participant',
          displayName: 'Deltagare'
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Kunde inte logga in');
      }

      const nextSession = {
        sessionId: payload.sessionId,
        role: payload.role,
        displayName: payload.displayName,
        memberId: payload.memberId
      };
      if (isInstructor) {
        await resetSimulationData({ session: nextSession, resetServerSession: false });
      }
      setSessionAuth(nextSession);
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
      <div className="flowsim-login-shell" style={{minHeight:'100vh',display:'grid',gridTemplateColumns:'minmax(0, 1.1fr) minmax(320px, 0.9fr)',fontFamily:'Arial, sans-serif',background:'#f1f7f8',color:'#07385f'}}>
        <div className="flowsim-login-brand" style={{display:'grid',placeItems:'center',padding:'clamp(20px, 4vw, 56px)',background:'#fff'}}>
          <img
            src="/flowsim-logo.svg"
            alt="FlowSIM – simulera, planera, förbättra hela vårdkedjan"
            style={{display:'block',width:'100%',maxWidth:720,height:'auto',objectFit:'contain'}}
          />
        </div>
        <div className="flowsim-login-panel" style={{display:'grid',placeItems:'center',padding:24,background:'#f1f7f8'}}>
          <div style={{width:'100%',maxWidth:420}}>
            <div style={{fontSize:13,fontWeight:700,color:'#087f91',textTransform:'uppercase',marginBottom:10}}>Välkommen</div>
            <h2 style={{fontSize:32,margin:'0 0 8px',color:'#07385f'}}>Logga in</h2>
            <p style={{color:'#4d6878',margin:'0 0 28px'}}>Välj hur du vill delta i övningen.</p>
            <div role="group" aria-label="Välj roll" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,padding:5,background:'#dceef1',borderRadius:8,marginBottom:24}}>
              {[
                { value: 'participant', label: 'Deltagare' },
                { value: 'instructor', label: 'Instruktör' }
              ].map(option => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={authForm.role === option.value}
                  onClick={() => {
                    setAuthForm(prev => ({ ...prev, role: option.value, username: '', password: '' }));
                    setAuthError('');
                  }}
                  style={{padding:'11px 12px',border:0,borderRadius:6,background:authForm.role === option.value ? '#fff' : 'transparent',color:'#07385f',fontSize:15,fontWeight:authForm.role === option.value ? 700 : 500,cursor:'pointer',boxShadow:authForm.role === option.value ? '0 1px 4px #07385f24' : 'none'}}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <form onSubmit={handleLogin}>
              {authForm.role === 'instructor' && (
                <>
                  <label htmlFor="login-username" style={{display:'block',fontSize:14,fontWeight:600,marginBottom:6}}>Användarnamn</label>
                  <input
                    id="login-username"
                    autoComplete="username"
                    value={authForm.username}
                    onChange={e => setAuthForm(prev => ({...prev, username:e.target.value}))}
                    style={{boxSizing:'border-box',width:'100%',padding:'12px 13px',fontSize:16,border:'1px solid #b7cbd4',borderRadius:6,marginBottom:16,background:'#fff',color:'#07385f'}}
                  />
                  <label htmlFor="login-password" style={{display:'block',fontSize:14,fontWeight:600,marginBottom:6}}>Lösenord</label>
                  <input
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    value={authForm.password}
                    onChange={e => setAuthForm(prev => ({...prev, password:e.target.value}))}
                    style={{boxSizing:'border-box',width:'100%',padding:'12px 13px',fontSize:16,border:'1px solid #b7cbd4',borderRadius:6,marginBottom:16,background:'#fff',color:'#07385f'}}
                  />
                </>
              )}
              {authForm.role === 'participant' && (
                <>
                  <label htmlFor="login-session" style={{display:'block',fontSize:14,fontWeight:600,marginBottom:6}}>Instruktörens sessionskod</label>
                  <input
                    id="login-session"
                    autoComplete="off"
                    value={authForm.sessionId}
                    onChange={e => setAuthForm(prev => ({...prev, sessionId:e.target.value.toUpperCase()}))}
                    placeholder="Lämna tomt för att logga in utan session"
                    style={{boxSizing:'border-box',width:'100%',padding:'12px 13px',fontSize:16,border:'1px solid #b7cbd4',borderRadius:6,marginBottom:16,background:'#fff',color:'#07385f',textTransform:'uppercase'}}
                  />
                </>
              )}
              {authError && <div role="alert" style={{color:'#a52b28',fontSize:14,marginBottom:14}}>{authError}</div>}
              <button
                type="submit"
                disabled={authLoading}
                style={{width:'100%',padding:'13px 16px',border:0,borderRadius:6,background:'linear-gradient(100deg, #07385f, #087f91 72%, #08aeb0)',color:'#fff',fontSize:16,fontWeight:700,cursor:authLoading ? 'wait' : 'pointer',boxShadow:'0 5px 14px #0750782b'}}
              >
                {authLoading ? 'Loggar in...' : authForm.role === 'participant' ? 'Logga in som deltagare' : 'Logga in som instruktör'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flowsim-app-shell" style={{ fontFamily: 'Arial, sans-serif', padding: 20 }}>
      <h1>Flowsim</h1>

      <div className="flowsim-session-header" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
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
      <div className="flowsim-panel-tabs" style={{ marginBottom: 16, display: 'flex', gap: 10 }}>
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
        ) : null}
        {sessionAuth.role === 'instructor' && !showExercisePanel && connectedParticipantCount !== null && (
          <div aria-live="polite" style={{display:'flex',alignItems:'center',gap:8,marginLeft:'auto',padding:'8px 12px',border:'1px solid #b7d9d7',borderRadius:6,background:'#eff9f8',color:'#075078',fontSize:14,fontWeight:600}}>
            <span aria-hidden="true" style={{width:8,height:8,borderRadius:'50%',background:'#08a7a0'}} />
            Anslutna deltagare: {connectedParticipantCount}
          </div>
        )}
        {/* Nollställningsknapp */}
        {sessionAuth.role === 'instructor' && !showExercisePanel && (
          <button
            style={{marginLeft:20,padding:'10px 16px',fontSize:14,borderRadius:6,border:'1px solid #e53935',background:'#fff',color:'#e53935',fontWeight:'bold',cursor:'pointer'}}
            onClick={() => resetSimulationData()}
            title="Nollställ alla patientlistor och flyttade patienter i alla övningsvyer"
          >
            Nollställ all data
          </button>
        )}
      </div>

      {/* Main control panel view (default) - hidden when Övningsvyer is active */}
      {sessionAuth.role === 'instructor' && !showExercisePanel && (
        <div style={{ marginBottom: 20 }}>
          <div className="flowsim-clock-controls" style={{marginBottom:12,display:'flex',alignItems:'center',gap:12}}>
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
          <div className="flowsim-hospital-buttons" style={{ display: 'flex', gap: 10 }}>
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

          <h2 style={{marginTop:32}}>Akutmottagning – spontana patienter</h2>
          <div style={{display:'flex',flexWrap:'wrap',alignItems:'end',gap:18,marginBottom:12}}>
            <div>
              <label htmlFor="initial-acute-patients" style={{display:'block',marginBottom:4,fontWeight:600}}>Patienter på plats vid start:</label>
              <input
                id="initial-acute-patients"
                type="number"
                min="0"
                max="150"
                value={initialAcutePatientCount}
                onChange={event => setInitialAcutePatientCount(Math.min(150, Math.max(0, Number(event.target.value) || 0)))}
                style={{fontSize:16,padding:'8px 10px',width:100}}
              />
            </div>
            <div>
              <label htmlFor="acute-admissions-rate" style={{display:'block',marginBottom:4,fontWeight:600}}>Nya spontana patienter per timme:</label>
              <input
                id="acute-admissions-rate"
                type="number"
                min="0"
                max="60"
                value={acuteAdmissionsPerHour}
                onChange={event => setAcuteAdmissionsPerHour(Math.min(60, Math.max(0, Number(event.target.value) || 0)))}
                style={{fontSize:16,padding:'8px 10px',width:100}}
              />
            </div>
            <span style={{fontSize:13,color:'#53616a',paddingBottom:8}}>Patienterna skapas direkt på Akutmottagningen och kommer inte från skadeplatsen.</span>
            <button
              type="button"
              onClick={startSimulationWithAcutePatients}
              disabled={simulationStarted || loadingPatients}
              style={{padding:'9px 14px',fontSize:14,borderRadius:5,border:0,background:simulationStarted ? '#7b8a8b' : '#087f91',color:'#fff',fontWeight:700,cursor:simulationStarted || loadingPatients ? 'default' : 'pointer'}}
            >
              {simulationStarted ? 'Simulering startad' : 'Starta simulering'}
            </button>
          </div>
          {acuteAdmissionStatus && <div role="status" style={{marginBottom:12,color:'#245a43',fontSize:13}}>{acuteAdmissionStatus}</div>}

          <h2 style={{marginTop:32}}>Beläggning på avdelningar</h2>
          <div style={{display:'flex',flexWrap:'wrap',alignItems:'center',gap:14,marginBottom:12}}>
            <div>
              <label htmlFor="department-occupancy" style={{display:'block',marginBottom:4,fontWeight:600}}>Beläggningsnivå:</label>
              <select
                id="department-occupancy"
                value={departmentOccupancyLevel}
                disabled={selectedHospital !== 'Norrlands universitetssjukhus' || departmentSourcePatientsLoading}
                onChange={e => handleDepartmentOccupancyChange(e.target.value)}
                style={{fontSize:16,padding:'8px 12px',minWidth:210}}
              >
                <option value="">Välj beläggningsnivå</option>
                <option value="low">Låg beläggning</option>
                <option value="medium">Medel beläggning (referensbild)</option>
                <option value="high">Hög beläggning</option>
              </select>
            </div>
            <div style={{fontSize:13,color:'#53616a',maxWidth:540}}>
              Låg: cirka 50% beläggning. Medel: beläggningen från referensbilden. Hög: minst 120% beläggning.
            </div>
          </div>
          {departmentSourcePatientsLoading && (
            <div role="status" style={{marginBottom:12,color:'#59646b',fontSize:13}}>Laddar patientunderlag för avdelningarna…</div>
          )}
          {selectedHospital !== 'Norrlands universitetssjukhus' && (
            <div role="status" style={{marginBottom:12,color:'#59646b',fontSize:13}}>
              Fasta kapacitetsvärden finns ännu bara för Norrlands universitetssjukhus.
            </div>
          )}
          {departmentOccupancyStatus && selectedHospital === 'Norrlands universitetssjukhus' && (
            <div role="status" style={{marginBottom:12,color:'#245a43',fontSize:13}}>{departmentOccupancyStatus}</div>
          )}

          {/* Personalinställningar */}
          <h2 style={{marginTop:32}}>Tillgänglig personal</h2>
          <div style={{display:'flex',flexWrap:'wrap',gap:20,marginBottom:16}}>
            <PersonnelCountControl label="Akutläkare" value={hospitalPersonnel.akutläkare} onChange={e => setHospitalPersonnel({...hospitalPersonnel, akutläkare: Math.max(0, parseInt(e.target.value) || 0)})} onAdd={() => addHospitalPersonnel('akutläkare', 'Akutläkare')} addDisabled={Boolean(updatingPersonnelCategory)} />
            <PersonnelCountControl label="Akutsjuksköterskor" value={hospitalPersonnel.akutsjuksköterskor} onChange={e => setHospitalPersonnel({...hospitalPersonnel, akutsjuksköterskor: Math.max(0, parseInt(e.target.value) || 0)})} onAdd={() => addHospitalPersonnel('akutsjuksköterskor', 'Akutsjuksköterska')} addDisabled={Boolean(updatingPersonnelCategory)} />
            <PersonnelCountControl label="Narkosläkare" value={hospitalPersonnel.narkoslakare} onChange={e => setHospitalPersonnel({...hospitalPersonnel, narkoslakare: Math.max(0, parseInt(e.target.value) || 0)})} onAdd={() => addHospitalPersonnel('narkoslakare', 'Narkosläkare')} addDisabled={Boolean(updatingPersonnelCategory)} />
            <PersonnelCountControl label="Narkossköterskor" value={hospitalPersonnel.narkosskoterskor} onChange={e => setHospitalPersonnel({...hospitalPersonnel, narkosskoterskor: Math.max(0, parseInt(e.target.value) || 0)})} onAdd={() => addHospitalPersonnel('narkosskoterskor', 'Narkossköterska')} addDisabled={Boolean(updatingPersonnelCategory)} />
            <PersonnelCountControl label="IVA sköterskor" value={hospitalPersonnel.ivaskoterskor} onChange={e => setHospitalPersonnel({...hospitalPersonnel, ivaskoterskor: Math.max(0, parseInt(e.target.value) || 0)})} onAdd={() => addHospitalPersonnel('ivaskoterskor', 'IVA-sköterska')} addDisabled={Boolean(updatingPersonnelCategory)} />
            <PersonnelCountControl label="Operationssköterskor" value={hospitalPersonnel.operationsskoterskor} onChange={e => setHospitalPersonnel({...hospitalPersonnel, operationsskoterskor: Math.max(0, parseInt(e.target.value) || 0)})} onAdd={() => addHospitalPersonnel('operationsskoterskor', 'Operationssköterska')} addDisabled={Boolean(updatingPersonnelCategory)} />
            <PersonnelCountControl label="Kirurger" value={hospitalPersonnel.kirurger} onChange={e => setHospitalPersonnel({...hospitalPersonnel, kirurger: Math.max(0, parseInt(e.target.value) || 0)})} onAdd={() => addHospitalPersonnel('kirurger', 'Kirurg')} addDisabled={Boolean(updatingPersonnelCategory)} />
            <PersonnelCountControl label="Ortopeder" value={hospitalPersonnel.ortopeder} onChange={e => setHospitalPersonnel({...hospitalPersonnel, ortopeder: Math.max(0, parseInt(e.target.value) || 0)})} onAdd={() => addHospitalPersonnel('ortopeder', 'Ortoped')} addDisabled={Boolean(updatingPersonnelCategory)} />
            <PersonnelCountControl label="Undersköterskor akutmottagningen" value={hospitalPersonnel.usk_akut} onChange={e => setHospitalPersonnel({...hospitalPersonnel, usk_akut: Math.max(0, parseInt(e.target.value) || 0)})} onAdd={() => addHospitalPersonnel('usk_akut', 'Undersköterska akuten')} addDisabled={Boolean(updatingPersonnelCategory)} />
            <PersonnelCountControl label="Undersköterskor operation" value={hospitalPersonnel.usk_op} onChange={e => setHospitalPersonnel({...hospitalPersonnel, usk_op: Math.max(0, parseInt(e.target.value) || 0)})} onAdd={() => addHospitalPersonnel('usk_op', 'Undersköterska operation')} addDisabled={Boolean(updatingPersonnelCategory)} />
            <PersonnelCountControl label="Undersköterskor IVA" value={hospitalPersonnel.usk_iva} onChange={e => setHospitalPersonnel({...hospitalPersonnel, usk_iva: Math.max(0, parseInt(e.target.value) || 0)})} onAdd={() => addHospitalPersonnel('usk_iva', 'Undersköterska IVA')} addDisabled={Boolean(updatingPersonnelCategory)} />
          </div>
          {personnelUpdateNotice && <div role="status" style={{marginTop:-8,marginBottom:14,color:personnelUpdateNotice.startsWith('Kunde') ? '#a12622' : '#245a43',fontSize:13}}>{personnelUpdateNotice}</div>}

          {/* Väder och temperatur för övningen */}
          <h2 style={{marginTop:32}}>Väder och temperatur</h2>
          <div style={{display:'flex',flexWrap:'wrap',alignItems:'end',gap:16,marginBottom:16}}>
            <div>
              <label htmlFor="simulation-weather" style={{display:'block',marginBottom:4,fontWeight:600}}>Väder:</label>
              <select
                id="simulation-weather"
                value={simulationEnvironment.weather}
                onChange={e => setSimulationEnvironment(prev => ({...prev, weather: e.target.value}))}
                style={{fontSize:16,padding:'8px 12px',minWidth:180}}
              >
                <option value="clear">Klart</option>
                <option value="cloudy">Molnigt</option>
                <option value="lightRain">Lätt regn</option>
                <option value="heavyRain">Kraftigt regn</option>
                <option value="snow">Snöfall</option>
                <option value="heavySnow">Kraftigt snöfall</option>
                <option value="storm">Storm</option>
                <option value="fog">Dimma</option>
              </select>
            </div>
            <div>
              <label htmlFor="simulation-temperature" style={{display:'block',marginBottom:4,fontWeight:600}}>Temperatur:</label>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <input
                  id="simulation-temperature"
                  type="number"
                  min="-40"
                  max="50"
                  value={simulationEnvironment.temperatureC}
                  onChange={e => {
                    const value = Number(e.target.value);
                    if (e.target.value !== '' && Number.isFinite(value)) {
                      setSimulationEnvironment(prev => ({...prev, temperatureC: Math.min(50, Math.max(-40, value))}));
                    }
                  }}
                  style={{fontSize:16,padding:'8px 12px',width:90}}
                />
                <span>°C</span>
              </div>
            </div>
            <div>
              <label htmlFor="simulation-wind" style={{display:'block',marginBottom:4,fontWeight:600}}>Vind:</label>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <input
                  id="simulation-wind"
                  type="number"
                  min="0"
                  max="50"
                  value={simulationEnvironment.windSpeed}
                  onChange={e => {
                    const value = Number(e.target.value);
                    if (e.target.value !== '' && Number.isFinite(value)) {
                      setSimulationEnvironment(prev => ({...prev, windSpeed: Math.min(50, Math.max(0, value))}));
                    }
                  }}
                  style={{fontSize:16,padding:'8px 12px',width:90}}
                />
                <span>m/s</span>
              </div>
            </div>
            <div>
              <label htmlFor="simulation-surface" style={{display:'block',marginBottom:4,fontWeight:600}}>Underlag:</label>
              <select
                id="simulation-surface"
                value={simulationEnvironment.surface}
                onChange={e => setSimulationEnvironment(prev => ({...prev, surface: e.target.value}))}
                style={{fontSize:16,padding:'8px 12px'}}
              >
                <option value="asphalt">Asfalt / ambulans</option>
                <option value="grass">Gräs</option>
                <option value="snow">Snö</option>
                <option value="ice">Is</option>
                <option value="wet">Våt mark</option>
                <option value="water">Vatten</option>
              </select>
            </div>
            <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',paddingBottom:8}}>
              <input
                type="checkbox"
                checked={simulationEnvironment.forceDarkness}
                onChange={e => setSimulationEnvironment(prev => ({...prev, forceDarkness: e.target.checked}))}
              />
              Tvinga mörker
            </label>
            <span style={{alignSelf:'center',paddingBottom:8}}>
              Mörker just nu: <strong>{effectiveSimulationEnvironment.darkness ? 'Ja' : 'Nej'}</strong>
              {simulationEnvironment.forceDarkness ? ' (manuellt)' : ' (automatiskt, 20:00–06:00)'}
            </span>
            {effectiveSimulationEnvironment.darkness && (
              <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',paddingBottom:8}}>
                <input
                  type="checkbox"
                  checked={simulationEnvironment.lighting}
                  onChange={e => setSimulationEnvironment(prev => ({...prev, lighting: e.target.checked}))}
                />
                Belysning finns
              </label>
            )}
          </div>
          <div style={{display:'flex',flexWrap:'wrap',gap:20,padding:'10px 12px',borderLeft:'4px solid #1976d2',background:'#f4f7fa',marginBottom:16}}>
            <span>Personalens arbetsförmåga: <strong>{Math.round(getStaffEfficiency(effectiveSimulationEnvironment) * 100)}%</strong></span>
            <span>Patienters försämring: <strong>{getPatientDeteriorationFactor(simulationEnvironment).toFixed(2).replace('.', ',')}×</strong></span>
            <span>Fordonshastighet: <strong>{Math.round(getVehicleSpeedFactor(simulationEnvironment) * 100)}%</strong></span>
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
              <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}>
                <input
                  type="checkbox"
                  checked={automatedViews.Akutmottagning || false}
                  onChange={(e) => {
                    setAutomatedViews({...automatedViews, Akutmottagning: e.target.checked});
                  }}
                  style={{width:18,height:18,cursor:'pointer'}}
                />
                <span style={{fontSize:16,fontWeight:500}}>Akutmottagning (automatisk vård av patienter som har tilldelad läkare och sjuksköterska)</span>
              </label>
              <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}>
                <input
                  type="checkbox"
                  checked={automatedViews.Operation || false}
                  onChange={(e) => {
                    setAutomatedViews({...automatedViews, Operation: e.target.checked});
                  }}
                  style={{width:18,height:18,cursor:'pointer'}}
                />
                <span style={{fontSize:16,fontWeight:500}}>Operation (automatisk operation av patienter som har tilldelad kirurg och anestesiläkare)</span>
              </label>
              <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}>
                <input
                  type="checkbox"
                  checked={automatedViews.Intensivvard || false}
                  onChange={(e) => {
                    setAutomatedViews({...automatedViews, Intensivvard: e.target.checked});
                  }}
                  style={{width:18,height:18,cursor:'pointer'}}
                />
                <span style={{fontSize:16,fontWeight:500}}>Intensivvård (automatisk vård av patienter som har tilldelad IVA-läkare och IVA-sköterska)</span>
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
              if (allPatients.length === 0) {
                setAcuteAdmissionStatus('Patientunderlaget laddas fortfarande. Vänta tills det är klart och starta sedan övningen igen.');
                return;
              }
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

              if (!startSimulationWithAcutePatients()) return;
              const acutePatients = JSON.parse(localStorage.getItem('akutPatients') || '{}');
              alert(`${selected.length} patienter skapade vid skadeplatsen. ${acutePatients[selectedHospital].length} patienter finns på Akutmottagningen från start.`);
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
        <div className="flowsim-exercise-selector" style={{ marginBottom: 20, padding: 12, border: '1px solid #e0e0e0', borderRadius: 6 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {renderExerciseButton('Prehospital')}
            {renderExerciseButton('Paratus')}
            {renderExerciseButton('Akutmottagning')}
            {renderExerciseButton('OP')}
            {renderExerciseButton('IVA')}
            {renderExerciseButton('POSTOP')}
            {renderExerciseButton('Mottagningar')}
            {renderExerciseButton('Avdelningar')}
            {renderExerciseButton('Katastrofliggare')}
            {renderExerciseButton('Hem')}
            {renderExerciseButton('Personal')}
          </div>
        </div>
      )}

      {/* Render open windows */}
      {windows.map(w => (
        <Window key={w.id} id={w.id} title={w.title} onClose={() => closeWindow(w.id)} simTime={simTime} simWeekday={weekdays[simWeekday]} weather={simulationEnvironment.weather}>
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
