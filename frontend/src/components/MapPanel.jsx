import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { prehospitalActionDurations } from './prehospitalActionDurations';
import { getVehicleSpeedFactor, isDarkAtTime, scalePrehospitalWorkMinutes, scalePrehospitalWorkSeconds } from '../weatherImpact';
import { advancePrehospitalPatient } from '../prehospitalDeterioration.js';
import { addSimulationMinutes, elapsedSimulationMinutes } from '../simulationTime.js';
import { getReadyAmbulanceCrew, setTransportCrewStatus } from '../prehospitalTransportEligibility.js';
import { vehicleTypes, personnelCategories, getTotalPersonnel, getAvailablePersonnel, allocateTransportPersonnel, allocateActionPersonnel, releasePersonnel, markPersonnelBusy, actionRequirements } from './prehospitalResources';
import { buildTransportCarePlan } from '../prehospitalTransportCare.js';
import { movePatientToParatus } from '../prehospitalDispatch.js';
import { MapContainer, Marker, TileLayer, useMap, Popup, CircleMarker, useMapEvent } from 'react-leaflet';
// Komponent som lyssnar på klick på kartan och placerar uppsamlingsplats
function CollectionPointPlacer({ placing, onPlace }) {
  useMapEvent('click', (e) => {
    if (placing) {
      onPlace(e.latlng);
    }
  });
  return null;
}
import 'leaflet/dist/leaflet.css';

function PrehospitalMapSyncMarker() {
  const map = useMap();
  const [marker, setMarker] = useState(null);
  useEffect(() => {
    function updateMarkerFromStorage() {
      const latlng = JSON.parse(localStorage.getItem('prehospitalMapMarker') || 'null');
      if (latlng && latlng.lat && latlng.lng) {
        setMarker(latlng);
        map.setView([latlng.lat, latlng.lng], map.getZoom());
      }
    }
    updateMarkerFromStorage();
    window.addEventListener('prehospitalMapMarkerSet', updateMarkerFromStorage);
    window.addEventListener('storage', updateMarkerFromStorage);
    return () => {
      window.removeEventListener('prehospitalMapMarkerSet', updateMarkerFromStorage);
      window.removeEventListener('storage', updateMarkerFromStorage);
    };
  }, [map]);
  return marker ? <Marker position={marker} /> : null;
}

function PrehospitalPatientsMarkers({ collectionPoint, openActionPatient, setOpenActionPatient, openTriagePatient, setOpenTriagePatient, setHospitalSelectPatient, hospitalDispatchHandlerRef, totalPersonnel, availablePersonnel, actionTimers, setActionTimers, transportTasks, setTransportTasks, simTime, simulationEnvironment }) {
  const previousSimTimeRef = useRef(null);
  const [patients, setPatients] = useState([]);
  const [completedActions, setCompletedActions] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('prehospitalCompletedActions') || '{}');
    } catch {
      return {};
    }
  });

  useEffect(() => {
    const updatePatients = () => {
      try {
        const storedPatients = JSON.parse(localStorage.getItem('prehospitalPatients') || '[]');
        setPatients(Array.isArray(storedPatients) ? storedPatients : []);
      } catch {
        setPatients([]);
      }
    };
    updatePatients();
    window.addEventListener('prehospitalPatientsCreated', updatePatients);
    window.addEventListener('prehospitalPatientsUpdated', updatePatients);
    window.addEventListener('storage', updatePatients);
    return () => {
      window.removeEventListener('prehospitalPatientsCreated', updatePatients);
      window.removeEventListener('prehospitalPatientsUpdated', updatePatients);
      window.removeEventListener('storage', updatePatients);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('prehospitalTransportTasks', JSON.stringify(transportTasks));
  }, [transportTasks]);

  useEffect(() => {
    localStorage.setItem('prehospitalCompletedActions', JSON.stringify(completedActions));
  }, [completedActions]);

  useEffect(() => {
    if (previousSimTimeRef.current === simTime) return;
    previousSimTimeRef.current = simTime;

    const updatedActions = { ...actionTimers };
    const personnelToRelease = [];
    let actionsChanged = false;
    Object.entries(updatedActions).forEach(([patientId, timer]) => {
      if (timer.waitingForFollowUp) return;
      const elapsed = elapsedSimulationMinutes(timer.startedAtSimTime || simTime, simTime);
      const duration = Number(timer.durationMinutes) || 0;
      if (elapsed >= duration) {
        const timedActions = (timer.actions || []).filter(action => (prehospitalActionDurations[action] || 0) > 0);
        if (timedActions.length) {
          setCompletedActions(previous => ({
            ...previous,
            [patientId]: [...new Set([...(previous[patientId] || []), ...timedActions])]
          }));
        }
        if (timer.airwayLocked) updatedActions[patientId] = { ...timer, remaining: 0, waitingForFollowUp: true };
        else {
          if (timer.allocatedPersonnel) personnelToRelease.push(timer.allocatedPersonnel);
          delete updatedActions[patientId];
        }
        actionsChanged = true;
      } else {
        const remaining = Math.max(0, Math.ceil((duration - elapsed) * 60));
        if (remaining !== timer.remaining) {
          updatedActions[patientId] = { ...timer, remaining };
          actionsChanged = true;
        }
      }
    });
    if (actionsChanged) setActionTimers(updatedActions);

    const updatedTasks = { ...transportTasks };
    const completedTransports = [];
    const transportAllocations = [];
    let tasksChanged = false;
    Object.entries(updatedTasks).forEach(([patientId, task]) => {
      const elapsed = elapsedSimulationMinutes(task.startedAtSimTime || simTime, simTime);
      const duration = Number(task.durationMinutes) || 0;
      if (elapsed >= duration && collectionPoint) {
        completedTransports.push(patientId);
        if (task.allocatedPersonnel) transportAllocations.push(task.allocatedPersonnel);
        delete updatedTasks[patientId];
        tasksChanged = true;
      } else {
        const remaining = Math.max(0, Math.ceil((duration - elapsed) * 60));
        if (remaining !== task.remaining) {
          updatedTasks[patientId] = { ...task, remaining };
          tasksChanged = true;
        }
      }
    });
    if (tasksChanged) setTransportTasks(updatedTasks);

    if (completedTransports.length) {
      const storedPatients = JSON.parse(localStorage.getItem('prehospitalPatients') || '[]');
      const updatedPatients = storedPatients.map(patient => completedTransports.includes(String(patient.id))
        ? { ...patient, lat: collectionPoint.lat, lng: collectionPoint.lng, location: 'Uppsamlingsplats' }
        : patient
      );
      localStorage.setItem('prehospitalPatients', JSON.stringify(updatedPatients));
      window.dispatchEvent(new Event('prehospitalPatientsUpdated'));
    }
    const allocationsToRelease = [...personnelToRelease, ...transportAllocations];
    if (allocationsToRelease.length) {
      let vehicles = JSON.parse(localStorage.getItem('prehospitalVehicles') || '[]');
      allocationsToRelease.forEach(allocation => { vehicles = releasePersonnel(vehicles, allocation); });
      localStorage.setItem('prehospitalVehicles', JSON.stringify(vehicles));
      window.dispatchEvent(new CustomEvent('prehospitalVehiclesUpdated', { detail: vehicles }));
    }
  }, [simTime, collectionPoint]);

  // Spara triage och åtgärder i localStorage
  function updatePatientField(id, field, value) {
    setPatients(prev => {
      const updated = prev.map(p => {
        if (p.id === id) {
          // Om fältet är triage, spara det som ett objekt med scene-värdet
          if (field === 'triage') {
            return {
              ...p,
              prehospitalBaselineTriage: p.prehospitalBaselineTriage || p.triage?.scene || p.triage?.sorting || p.triage?.emergencyDept || (typeof p.triage === 'string' ? p.triage : ''),
              triage: { scene: value }
            };
          }
          return { ...p, [field]: value };
        }
        return p;
      });
      localStorage.setItem('prehospitalPatients', JSON.stringify(updated));
      window.dispatchEvent(new Event('prehospitalPatientsUpdated'));
      return updated;
    });
  }

  // Funktion för att validera att transport är möjlig innan dialogen öppnas
  function canTransportToHospital(patientId) {
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return false;

    const vehicles = JSON.parse(localStorage.getItem('prehospitalVehicles') || '[]');
    const hasReadyAmbulance = vehicles.some(vehicle => (
        ['ambulance', 'helicopterAmbulance'].includes(vehicle.type) &&
        getReadyAmbulanceCrew(vehicle, vehicles, patientId, actionTimers) !== null
      ));
    if (!hasReadyAmbulance) {
      alert('Sjukhustransport kräver en ledig ambulans samt två personer: en vårdare och en förare.');
      return false;
    }
    return true;
  }

  function sendToHospital(id, selectedHospitalName) {
    // Hitta patienten först
    const patient = patients.find(p => p.id === id);
    if (!patient) {
      alert('Patienten kunde inte hittas i skadeplatslistan. Uppdatera vyn och försök igen.');
      return false;
    }
    
    // Sjukhusens koordinater (Västerbotten, Sverige)
    const hospitals = {
      'Norrlands universitetssjukhus': { lat: 63.8258, lng: 20.2630 },
      'Skellefteå sjukhus': { lat: 64.7508, lng: 20.9528 },
      'Lycksele lasarett': { lat: 64.5975, lng: 18.6743 }
    };
    
    // Använd valt sjukhus
    const nearestHospital = selectedHospitalName;
    const hospitalCoords = hospitals[selectedHospitalName];
    
    if (!hospitalCoords) {
      alert('Ogiltigt sjukhus valt!');
      return false;
    }
    
    // Beräkna avstånd till valt sjukhus
    const calculateDistance = (lat1, lng1, lat2, lng2) => {
      // Haversine-formeln för att beräkna avstånd mellan två punkter på jorden
      const R = 6371; // Jordens radie i km
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLng/2) * Math.sin(dLng/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c; // Avstånd i km
    };
    
    let shortestDistance = 0;
    if (patient.lat && patient.lng) {
      shortestDistance = calculateDistance(patient.lat, patient.lng, hospitalCoords.lat, hospitalCoords.lng);
    } else {
      // Om patient saknar koordinater, använd standardavstånd
      shortestDistance = 50; // km
    }
    
    // Hämta fordon från localStorage
    const vehicles = JSON.parse(localStorage.getItem('prehospitalVehicles') || '[]');
    
    const assignment = vehicles
      .filter(vehicle => ['ambulance', 'helicopterAmbulance'].includes(vehicle.type))
      .map(vehicle => ({ vehicle, crew: getReadyAmbulanceCrew(vehicle, vehicles, id, actionTimers) }))
      .find(candidate => candidate.crew);
    if (!assignment) {
      alert('Sjukhustransport kräver en ledig ambulans samt två personer: en vårdare och en förare.');
      return false;
    }
    const selectedVehicle = assignment.vehicle;
    const allocated = assignment.crew;
    
    // Beräkna distans baserat på fordonstyp
    // Helikopter: Använd fågelvägen (direkt Haversine-distans)
    // Markfordon: Multiplicera med 1.5 för att simulera vägsträcka
    const isHelicopter = selectedVehicle.type === 'helicopterAmbulance';
    const actualDistance = isHelicopter ? shortestDistance : shortestDistance * 1.5;
    
    // Beräkna restid baserat på fordonstyp
    // Helikopter: 200 km/h, Ambulans och andra: 80 km/h
    const speed = isHelicopter ? 200 : 80; // km/h
    const minTime = isHelicopter ? 15 : 5; // Helikopter: minst 15 min, andra: minst 5 min
    const baseTransportTime = Math.max(minTime, Math.ceil(actualDistance / speed * 60));
    const transportTime = Math.ceil(baseTransportTime / getVehicleSpeedFactor(simulationEnvironment));
    
    console.log(`Transport till ${nearestHospital} med ${vehicleTypes[selectedVehicle.type]?.label || selectedVehicle.type}: ${actualDistance.toFixed(1)} km (fågelväg: ${shortestDistance.toFixed(1)} km), ${transportTime} minuter (${speed} km/h)`);
    
    // Beräkna när fordonet kommer tillbaka (transporttid * 2 + 15 min)
    const returnTime = (transportTime * 2) + 15;
    const expectedReturnSimTime = addSimulationMinutes(simTime, returnTime);
    
    // Beräkna ankomsttid baserat på simTime + transportTime
    const calculateArrivalTime = (simTimeStr, minutesToAdd) => {
      const [hours, minutes] = simTimeStr.split(':').map(Number);
      let totalMinutes = hours * 60 + minutes + minutesToAdd;
      const arrivalHours = Math.floor(totalMinutes / 60) % 24;
      const arrivalMinutes = totalMinutes % 60;
      return `${arrivalHours.toString().padStart(2, '0')}:${arrivalMinutes.toString().padStart(2, '0')}`;
    };
    
    const arrivalTime = calculateArrivalTime(simTime, transportTime);
    
    console.log(`Patient ${patient.id} transporteras till ${nearestHospital}:`);
    console.log(`  Aktuell simTime: ${simTime}`);
    console.log(`  Transporttid: ${transportTime} minuter`);
    console.log(`  Förväntad ankomsttid: ${arrivalTime}`);
    console.log(`  Destination: ${nearestHospital}`);
    
    // Lägg till patient i Paratus-listan
    const patientCopy = {
      ...patient,
      expectedArrivalTime: arrivalTime,
      hospitalArrivalSimTime: arrivalTime,
      destinationHospital: nearestHospital,
      distanceKm: actualDistance.toFixed(1),
      transportTime: transportTime, // Spara transporttid för destination-ändring
      transportTimeMinutes: transportTime,
      departureTime: simTime, // Spara avgångstid för destination-ändring
      vehicleType: selectedVehicle.type, // Spara fordonstyp för destination-ändring
      transportSpeed: speed, // Spara hastighet (km/h) för destination-ändring
      actualDistance: actualDistance, // Spara faktisk körsträcka (med väg-faktor för markfordon)
      straightLineDistance: shortestDistance, // Spara fågelvägen för referens
      startCoordinates: patient.lat && patient.lng ? { lat: patient.lat, lng: patient.lng } : { lat: 63.825, lng: 20.25 }, // Spara startkoordinater för destination-ändring
      allocatedPersonnel: allocated,
      vehicleId: selectedVehicle.id,
      unitNumber: selectedVehicle.unitNumber,
      transportCarePlan: buildTransportCarePlan(patient, {
        completedActionIds: JSON.parse(localStorage.getItem('prehospitalCompletedActions') || '{}')[patient.id] || patient.prehospitalCompletedActions || [],
        transportMinutes: transportTime,
        departureTime: simTime,
        environment: simulationEnvironment
      })
    };
    const storedPatients = JSON.parse(localStorage.getItem('prehospitalPatients') || '[]');
    const currentPatients = Array.from(new Map(
      [...patients, ...storedPatients].filter(scenePatient => scenePatient?.id).map(scenePatient => [scenePatient.id, scenePatient])
    ).values());
    const currentParatusPatients = JSON.parse(localStorage.getItem('paratusPatients') || '[]');
    const dispatch = movePatientToParatus(patientCopy, currentPatients, currentParatusPatients);
    const updatedPatients = dispatch.prehospitalPatients;
    localStorage.setItem('prehospitalPatients', JSON.stringify(updatedPatients));
    localStorage.setItem('paratusPatients', JSON.stringify(dispatch.paratusPatients));
    window.dispatchEvent(new Event('prehospitalPatientsUpdated'));
    window.dispatchEvent(new Event('paratusUpdated'));
    setPatients(updatedPatients);

    // Markera fordonet som borta först efter att patienten har flyttats till Paratus.
    const updatedVehicles = vehicles.map(v => v.id === selectedVehicle.id
      ? { ...v, status: 'away', expectedReturnSimTime, returnStartSimTime: simTime, returnTimeMinutes: returnTime, transportPersonnel: allocated }
      : v
    );
    const reservedVehicles = setTransportCrewStatus(updatedVehicles, allocated, 'busy');
    localStorage.setItem('prehospitalVehicles', JSON.stringify(reservedVehicles));
    window.dispatchEvent(new CustomEvent('prehospitalVehiclesUpdated', { detail: reservedVehicles }));
    
    console.log(`Patient transporteras till ${nearestHospital} (${shortestDistance.toFixed(1)} km, ${transportTime} min):`, patient.id);
    console.log(`  simTime: ${simTime}, expectedArrivalTime: ${arrivalTime}, destinationHospital: ${nearestHospital}`);
    alert(`Patienten transporteras till ${nearestHospital} och beräknas anlända kl. ${arrivalTime}.`);
    return true;
  }

  hospitalDispatchHandlerRef.current = sendToHospital;
  
  function sendToCollectionPoint(id) {
    if (!collectionPoint) return;
    
    // Hitta patienten först
    const patient = patients.find(p => p.id === id);
    if (!patient) return;
    
    // Kolla om patient är grön (kan gå själv) eller behöver bäras
    const triageValue = typeof patient.triage === 'object' ? null : patient.triage;
    const canWalk = triageValue === 'Grön';
    const personnelNeeded = canWalk ? 1 : 2;
    
    // Hämta fordon från localStorage
    const vehicles = JSON.parse(localStorage.getItem('prehospitalVehicles') || '[]');
    
    // Allokera personal enligt behov
    const allocated = allocateTransportPersonnel(vehicles, personnelNeeded);
    
    if (!allocated) {
      alert(`Otillräcklig personal! Behöver ${personnelNeeded} tillgängliga person${personnelNeeded > 1 ? 'er' : ''} för att ${canWalk ? 'följa' : 'bära'} patient till uppsamlingsplats.`);
      return;
    }
    
    // Markera personal som upptagen
    const updatedVehicles = markPersonnelBusy(vehicles, allocated);
    localStorage.setItem('prehospitalVehicles', JSON.stringify(updatedVehicles));
    window.dispatchEvent(new CustomEvent('prehospitalVehiclesUpdated', { detail: updatedVehicles }));
    
    // Beräkna avstånd i meter mellan patient och uppsamlingsplats (Haversine-formel)
    const R = 6371000; // Jordens radie i meter
    const lat1 = patient.lat * Math.PI / 180;
    const lat2 = collectionPoint.lat * Math.PI / 180;
    const deltaLat = (collectionPoint.lat - patient.lat) * Math.PI / 180;
    const deltaLng = (collectionPoint.lng - patient.lng) * Math.PI / 180;
    
    const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLng/2) * Math.sin(deltaLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c; // Avstånd i meter
    
    // Beräkna tid: För gröna patienter (går själv) 1.2 m/s (4.3 km/h), annars 0.83 m/s (3 km/h med patient), gånger 1.5
    const walkingSpeed = canWalk ? 1.2 : 0.83; // m/s
    const baseTimeInSeconds = Math.ceil((distance / walkingSpeed) * 1.5);
    const timeInSeconds = scalePrehospitalWorkSeconds(baseTimeInSeconds, simulationEnvironment);
    const transportTime = timeInSeconds * 1000; // millisekunder
    
    setTransportTasks(prev => ({
      ...prev,
      [id]: {
        type: canWalk ? 'walkToCollectionPoint' : 'carryToCollectionPoint',
        startedAtSimTime: simTime,
        durationMinutes: timeInSeconds / 60,
        remaining: timeInSeconds,
        personnel: personnelNeeded,
        distance: Math.round(distance),
        allocatedPersonnel: allocated // Spara vilka som är allokerade
      }
    }));
  }

  const triageOptions = [
    { value: '', label: 'Välj triage' },
    { value: 'Röd', label: 'Röd (akut)' },
    { value: 'Gul', label: 'Gul (brådskande)' },
    { value: 'Grön', label: 'Grön (icke-brådskande)' },
    { value: 'Svart', label: 'Svart (avvakta)' },
  ];
  // XABCDE-ordning
  // Generera actionOptions från actionRequirements, sorterat efter order
  const actionOptions = Object.entries(actionRequirements)
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([key, req]) => ({
      value: key,
      label: req.label
    }));

  // Färgkarta för triage
  const triageRowColors = {
    'Röd':   { background: '#ffcccc', color: '#b71c1c' },
    'Gul':   { background: '#fff9c4', color: '#bfa600' },
    'Grön':  { background: '#d0f8ce', color: '#388e3c' },
    'Svart': { background: '#e0e0e0', color: '#222' },
    '':      { background: 'transparent', color: '#222' },
    undefined: { background: 'transparent', color: '#222' },
    null: { background: 'transparent', color: '#222' }
  };

  // Färgkarta för triage-markör
  const triageMarkerColors = {
    'Röd':   { color: '#b71c1c', fillColor: '#ff5252' },
    'Gul':   { color: '#bfa600', fillColor: '#fff176' },
    'Grön':  { color: '#388e3c', fillColor: '#69f0ae' },
    'Svart': { color: '#222', fillColor: '#888' },
    '':      { color: '#888', fillColor: '#888' },
    undefined: { color: '#888', fillColor: '#888' },
    null: { color: '#888', fillColor: '#888' }
  };

  function getPatientTriageValue(patient) {
    if (!patient || !patient.triage) return '';
    if (typeof patient.triage === 'string') return patient.triage;
    return patient.triage.scene || patient.triage.sorting || patient.triage.emergencyDept || '';
  }



  // Hjälpfunktion för att summera åtgärdstid
  function getTotalActionTime(actions) {
    if (!Array.isArray(actions)) return 0;
    return actions.reduce((sum, action) => sum + getActionTimeMinutes(action), 0);
  }

  function getActionTimeMinutes(action) {
    return scalePrehospitalWorkMinutes(prehospitalActionDurations[action] || 0, simulationEnvironment);
  }

  // Gemensam funktion för att rendera patientinformation (används av både Popup och Modal)
  function renderPatientInfo(p) {
    return (
      <>
        {p.status === 'avliden' && (
          <div role="status" style={{marginBottom:8,padding:'8px 12px',background:'#ffebee',border:'2px solid #b71c1c',borderRadius:6,color:'#b71c1c',fontWeight:700,textAlign:'center'}}>
            AVLEDEN{p.deathTime ? ` kl. ${p.deathTime}` : ''}
          </div>
        )}
        {/* Slutförda åtgärder */}
        {completedActions[p.id] && completedActions[p.id].length > 0 && (
          <div style={{
            marginBottom:8,
            padding:'8px 12px',
            background:'#e8f5e9',
            border:'2px solid #4caf50',
            borderRadius:6,
            fontWeight:600,
            color:'#2e7d32',
            fontSize:13
          }}>
            <div style={{marginBottom:6}}>✓ Slutförda åtgärder:</div>
            <div style={{fontSize:12,lineHeight:'1.6'}}>
              {completedActions[p.id].map((actionId) => {
                const actionOption = actionOptions.find(opt => opt.value === actionId);
                return actionOption ? (
                  <div key={actionId}>✓ {actionOption.label}</div>
                ) : null;
              })}
            </div>
          </div>
        )}
        
        {/* Triagefärg för patienter på uppsamlingsplats */}
        {p.location === 'Uppsamlingsplats' && getPatientTriageValue(p) && (
          <div style={{
            marginBottom:8,
            padding:'8px 12px',
            background: (triageRowColors[getPatientTriageValue(p)] || triageRowColors['']).background,
            border:`3px solid ${(triageMarkerColors[getPatientTriageValue(p)] || triageMarkerColors['']).color}`,
            borderRadius:6,
            fontWeight:700,
            color: (triageRowColors[getPatientTriageValue(p)] || triageRowColors['']).color,
            fontSize:16,
            textAlign:'center'
          }}>
            {getPatientTriageValue(p) || 'Inte triagerad'} 🏷️
          </div>
        )}
        
        {/* Behandling som är utförd */}
        {p.treatment && (
          <div style={{
            marginBottom:8,
            padding:'8px 12px',
            background:'#e3f2fd',
            border:'2px solid #1976d2',
            borderRadius:6,
            fontWeight:600,
            color:'#1976d2',
            fontSize:13,
            textAlign:'center'
          }}>
            ✓ Behandling: {p.treatment}
          </div>
        )}
        
        {/* Automatiseringsstatus */}
        {p.automationStatus && (
          <div style={{
            marginBottom:8,
            padding:'8px 12px',
            background:'#e8f5e9',
            border:'2px solid #4caf50',
            borderRadius:6,
            fontWeight:600,
            color:'#2e7d32',
            fontSize:14,
            textAlign:'center'
          }}>
            ⚙️ {p.automationStatus}
          </div>
        )}
        
        {/* Timer för åtgärder */}
        {actionTimers[p.id] && (
          <div style={{marginBottom:6,fontWeight:600,color: actionTimers[p.id].waitingForFollowUp ? '#ff6f00' : '#388e3c',fontSize:15}}>
            {actionTimers[p.id].waitingForFollowUp ? (
              actionTimers[p.id].actions?.includes('fri_luftvag') ? (
                <>⚠️ Håller fri luftväg - kräver definitiv luftväg!</>
              ) : (
                <>⚕️ Personal låst av åtgärd</>
              )
            ) : (
              <>⚕️ Åtgärder pågår: {Math.ceil((actionTimers[p.id].remaining || 0) / 60)} min kvar</>
            )}
          </div>
        )}
        {/* Timer för transport */}
        {transportTasks[p.id] && (
          <div style={{marginBottom:6,fontWeight:600,color:'#ff9800',fontSize:15}}>
            {transportTasks[p.id].type === 'hospital' ? '🚑 Transport till sjukhus' : 
             transportTasks[p.id].type === 'walkToCollectionPoint' ? '🚶 Går till uppsamlingsplats' : 
             transportTasks[p.id].type === 'relocateToNewCollectionPoint' ? '🚶 Flyttas till ny uppsamlingsplats' :
             '🚶 Bärs till uppsamlingsplats'}: {Math.ceil((transportTasks[p.id].remaining || 0) / 60)} min kvar
            <div style={{fontSize:12,color:'#666',fontWeight:400,marginTop:2}}>
              ({transportTasks[p.id].personnel} person{transportTasks[p.id].personnel > 1 ? 'er' : ''} upptagen{transportTasks[p.id].personnel > 1 ? 'a' : ''})
            </div>
          </div>
        )}
        <div style={{fontSize:13,marginBottom:2}}><b>Personnummer:</b> {p.personnummer}</div>
        <div style={{fontSize:13,marginBottom:2}}><b>Ålder:</b> {p.age || '-'} <b>Kön:</b> {p.sex || '-'}</div>
        <div style={{fontSize:13,marginBottom:2}}><b>Hälsostatus:</b> {p.baselineHealth || '-'}</div>
        <div style={{fontSize:13,marginBottom:2}}><b>Mekanism:</b> {p.mechanism || '-'}</div>
        <div style={{fontSize:13,marginBottom:6}}><b>Skadebeskrivning:</b> {p.injuryDescription || '-'}</div>
        {(p.XABCDE || p.ABCDE) && (
          <div style={{fontSize:13,marginBottom:6,padding:'6px 8px',background:'#f7f7f7',borderRadius:4}}>
            <b>{p.XABCDE ? 'XABCDE:' : 'ABCDE:'}</b><br/>
            {p.XABCDE && <span style={{marginRight:8}}><b>X:</b> {p.XABCDE.X?.Exanguination || '-'}</span>}
            <span style={{marginRight:8}}><b>A:</b> {(p.XABCDE?.A || p.ABCDE?.A)?.airway || '-'}</span>
            <span style={{marginRight:8}}><b>B:</b> AF: {(p.XABCDE?.B || p.ABCDE?.B)?.AF || '-'}, Sat: {(p.XABCDE?.B || p.ABCDE?.B)?.Sat || '-'}</span><br/>
            <span style={{marginRight:8}}><b>C:</b> Puls: {(p.XABCDE?.C || p.ABCDE?.C)?.Puls || '-'}, BT: {(p.XABCDE?.C || p.ABCDE?.C)?.BT || '-'}, Blödning: {(p.XABCDE?.C || p.ABCDE?.C)?.Bleeding || '-'}</span><br/>
            <span style={{marginRight:8}}><b>D:</b> GCS: {(p.XABCDE?.D || p.ABCDE?.D)?.GCS || '-'}</span>
            <span style={{marginRight:8}}><b>E:</b> Temp: {(p.XABCDE?.E || p.ABCDE?.E)?.Temp || '-'}</span>
          </div>
        )}
        <div style={{marginBottom:6}}>
          <label style={{fontWeight:600,fontSize:13}}>Triage:</label><br/>
          <select
            value={getPatientTriageValue(p)}
            onChange={e => updatePatientField(p.id, 'triage', e.target.value)}
            style={{
              width:'100%',marginTop:2,fontWeight:600,fontSize:13,borderRadius:4,padding:'4px 8px',outline:'none',border:'1px solid #bbb',
              background: (triageRowColors[getPatientTriageValue(p)] || triageRowColors['']).background,
              color: (triageRowColors[getPatientTriageValue(p)] || triageRowColors['']).color,
              transition:'background 0.2s'
            }}
          >
            {triageOptions.map(opt => (
              <option
                key={opt.value}
                value={opt.value}
                style={{
                  background: (triageRowColors[opt.value] || triageRowColors['']).background,
                  color: (triageRowColors[opt.value] || triageRowColors['']).color
                }}
              >
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <button
          style={{marginTop:6,padding:'6px 12px',borderRadius:5,border:'1px solid #1976d2',background:'#1976d2',color:'#fff',fontWeight:600,cursor:'pointer'}}
          onClick={() => setOpenActionPatient(p.id)}
        >
          Åtgärder
        </button>
        {!transportTasks[p.id] && (
          <button
            style={{marginTop:6,marginLeft:8,padding:'6px 12px',borderRadius:5,border:'1px solid #ff9800',background:'#ff9800',color:'#fff',fontWeight:600,cursor:'pointer'}}
            onClick={() => {
              // Validera först om transport är möjlig
              if (canTransportToHospital(p.id)) {
                console.log('Transport möjlig, öppnar sjukhusvalsdialogruta för:', p.id);
                setHospitalSelectPatient(p.id);
              } else {
                console.log('Transport ej möjlig för patient:', p.id);
              }
            }}
          >
            Skicka till sjukhus
          </button>
        )}
        {collectionPoint && p.location !== 'Uppsamlingsplats' && !transportTasks[p.id] && (
          <button
            style={{marginTop:6,marginLeft:8,padding:'6px 12px',borderRadius:5,border:'1px solid #4caf50',background:'#4caf50',color:'#fff',fontWeight:600,cursor:'pointer'}}
            onClick={() => sendToCollectionPoint(p.id)}
          >
            Bär till uppsamlingsplats
          </button>
        )}
        {/* Skicka till sjukhus från uppsamlingsplats */}
        {p.location === 'Uppsamlingsplats' && !transportTasks[p.id] && (
          <button
            style={{marginTop:6,marginLeft:8,padding:'6px 12px',borderRadius:5,border:'1px solid #1976d2',background:'#1976d2',color:'#fff',fontWeight:600,cursor:'pointer'}}
            onClick={() => {
              if (canTransportToHospital(p.id)) {
                setHospitalSelectPatient(p.id);
              } else {
                alert('Ingen transport till sjukhus möjlig för denna patient!');
              }
            }}
          >
            Skicka till sjukhus
          </button>
        )}
      </>
    );
  }

  return patients.map((p, i) => [
    p.lat && p.lng ? (
      <CircleMarker
        key={p.id || i}
        center={[p.lat, p.lng]}
        radius={8}
        pathOptions={{
          color: (triageMarkerColors[getPatientTriageValue(p)] || triageMarkerColors['']).color,
          fillColor: (triageMarkerColors[getPatientTriageValue(p)] || triageMarkerColors['']).fillColor,
          fillOpacity: 1,
          weight: 2
        }}
      >
        {transportTasks[p.id] ? (
          <Popup minWidth={260} maxWidth={400}>
            <div style={{fontWeight:700,fontSize:16,marginBottom:4}}>{typeof p.name === 'object' ? (p.name?.name || p.personnummer || p.id) : (p.name || p.personnummer || p.id)}</div>
            <div style={{marginBottom:6,fontWeight:600,color:'#ff9800',fontSize:15}}>
              {transportTasks[p.id].type === 'hospital' ? '🚑 Transport till sjukhus' : 
               transportTasks[p.id].type === 'walkToCollectionPoint' ? '🚶 Går till uppsamlingsplats' : 
               transportTasks[p.id].type === 'relocateToNewCollectionPoint' ? '🚶 Flyttas till ny uppsamlingsplats' :
               '🚶 Bärs till uppsamlingsplats'}
            </div>
            <div style={{fontSize:18,fontWeight:700,color:'#ff9800',textAlign:'center',padding:'12px',background:'#fff3e0',borderRadius:6}}>
              {Math.floor((transportTasks[p.id].remaining || 0) / 60)}:{String((transportTasks[p.id].remaining || 0) % 60).padStart(2, '0')} kvar
            </div>
            <div style={{fontSize:12,color:'#666',marginTop:6,textAlign:'center'}}>
              {transportTasks[p.id].personnel} person{transportTasks[p.id].personnel > 1 ? 'er' : ''} upptagen{transportTasks[p.id].personnel > 1 ? 'a' : ''}
            </div>
            {transportTasks[p.id].distance && (
              <div style={{fontSize:12,color:'#666',textAlign:'center'}}>
                Avstånd: {transportTasks[p.id].distance}m
              </div>
            )}
          </Popup>
        ) : (
        <Popup minWidth={260} maxWidth={400}>
          <div style={{fontWeight:700,fontSize:16,marginBottom:4}}>{typeof p.name === 'object' ? (p.name?.name || p.personnummer || p.id) : (p.name || p.personnummer || p.id)}</div>
          {renderPatientInfo(p)}
        </Popup>
        )}
      </CircleMarker>
    ) : null,
    // Modal för åtgärder
    openActionPatient === p.id && (
      <div 
        key={p.id+':modal'} 
        style={{
          position:'fixed',left:0,top:0,width:'100vw',height:'100vh',zIndex:9999,
          background:'rgba(0,0,0,0.25)',display:'flex',alignItems:'center',justifyContent:'center'
        }}
        onClick={(e) => {
          // Stäng modal om man klickar på bakgrunden (inte på själva modalen)
          if (e.target === e.currentTarget) {
            setOpenActionPatient(null);
          }
        }}
      >
        <div style={{
          background:'#fff',padding:24,borderRadius:8,minWidth:260,maxWidth:500,
          boxShadow:'0 2px 12px #0004',position:'relative',
          maxHeight:'80vh',overflow:'auto'
        }}>
          <div style={{fontWeight:700,fontSize:17,marginBottom:10}}>Åtgärder för {typeof p.name === 'object' ? (p.name?.name || p.personnummer || p.id) : (p.name || p.personnummer || p.id)}</div>
          {actionOptions.map(opt => {
            const selected = Array.isArray(p.actions) ? p.actions.includes(opt.value) : false;
            const isCompleted = completedActions[p.id] && completedActions[p.id].includes(opt.value);
            const requirement = actionRequirements[opt.value];
            
            // Kolla om denna patient har låst personal
            const patientTimer = actionTimers[p.id];
            const hasLockedPersonnel = patientTimer && patientTimer.airwayLocked && patientTimer.allocatedPersonnel;
            
            let hasEnoughPersonnel = false;
            let missingPersonnel = [];
            
            if (requirement) {
              if (hasLockedPersonnel) {
                // Om patienten har låst personal, kolla om den låsta personalen kan utföra åtgärden
                const lockedCategories = patientTimer.allocatedPersonnel.map(ap => ap.category);
                const lockedCanPerform = lockedCategories.some(cat => requirement.categories.includes(cat));
                
                if (lockedCanPerform && patientTimer.allocatedPersonnel.length >= requirement.personnel) {
                  // Den låsta personalen kan utföra åtgärden och det finns tillräckligt många
                  hasEnoughPersonnel = true;
                } else if (lockedCanPerform && patientTimer.allocatedPersonnel.length < requirement.personnel) {
                  // Den låsta personalen kan utföra åtgärden men det behövs fler - kolla om det finns extra personal tillgänglig
                  const availableTotal = requirement.categories.reduce((sum, cat) => sum + (availablePersonnel[cat] || 0), 0);
                  hasEnoughPersonnel = availableTotal >= (requirement.personnel - patientTimer.allocatedPersonnel.length);
                } else {
                  // Den låsta personalen kan INTE utföra åtgärden
                  hasEnoughPersonnel = false;
                  const lockedPersonName = personnelCategories[lockedCategories[0]]?.label || lockedCategories[0];
                  missingPersonnel = [`${lockedPersonName} (låst) kan ej utföra denna`];
                }
              } else {
                // Ingen låst personal - kolla tillgänglig personal som vanligt
                hasEnoughPersonnel = requirement.categories.reduce((sum, cat) => sum + (availablePersonnel[cat] || 0), 0) >= requirement.personnel;
              }
            } else {
              hasEnoughPersonnel = true;
            }
            
            // Beräkna vilken personal som saknas (om inte redan satt ovan)
            if (requirement && !hasEnoughPersonnel && missingPersonnel.length === 0) {
              const availableByCategory = {};
              requirement.categories.forEach(cat => {
                availableByCategory[cat] = totalPersonnel[cat] || 0;
              });
              
              // Kontrollera om någon av de tillåtna kategorierna har tillräckligt med personal
              const anyHasEnough = requirement.categories.some(cat => availableByCategory[cat] >= requirement.personnel);
              
              if (!anyHasEnough) {
                // Ingen kategori har tillräckligt - visa vilka som behövs
                missingPersonnel = requirement.categories
                  .filter(cat => availableByCategory[cat] < requirement.personnel)
                  .map(cat => personnelCategories[cat]?.label || cat);
              }
            }
            
            return (
              <div
                key={opt.value}
                onClick={() => {
                  if (!hasEnoughPersonnel && !selected) {
                    return; // Kan inte välja om det saknas personal
                  }
                  const newActions = Array.isArray(p.actions) ? [...p.actions] : [];
                  if (!selected) {
                    newActions.push(opt.value);
                  } else {
                    const idx = newActions.indexOf(opt.value);
                    if (idx > -1) newActions.splice(idx, 1);
                  }
                  updatePatientField(p.id, 'actions', newActions);
                }}
                style={{
                  display:'flex',alignItems:'center',marginBottom:6,fontSize:14,
                  cursor: (!hasEnoughPersonnel && !selected) ? 'not-allowed' : (isCompleted ? 'default' : 'pointer'),
                  background: isCompleted ? '#c8e6c9' : (selected ? '#e3f2fd' : (!hasEnoughPersonnel ? '#ffebee' : 'transparent')),
                  borderRadius:4,
                  padding:'4px 8px',
                  border: isCompleted ? '1.5px solid #4caf50' : (selected ? '1.5px solid #1976d2' : (!hasEnoughPersonnel ? '1.5px solid #f44336' : '1.5px solid transparent')),
                  fontWeight: (isCompleted || selected) ? 600 : 400,
                  opacity: (!hasEnoughPersonnel && !selected) ? 0.5 : 1,
                  transition:'background 0.15s,border 0.15s'
                }}
                tabIndex={0}
                role="button"
                aria-pressed={selected}
                onKeyDown={e => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    const newActions = Array.isArray(p.actions) ? [...p.actions] : [];
                    if (!selected) {
                      newActions.push(opt.value);
                    } else {
                      const idx = newActions.indexOf(opt.value);
                      if (idx > -1) newActions.splice(idx, 1);
                    }
                    updatePatientField(p.id, 'actions', newActions);
                  }
                }}
              >
                <span style={{flex:1}}>
                  {opt.label}
                  {requirement && (
                    <div style={{fontSize:11,color:hasEnoughPersonnel?'#666':'#f44336',marginTop:2}}>
                      👥 {requirement.personnel} person{requirement.personnel > 1 ? 'er' : ''}
                      {!hasEnoughPersonnel && missingPersonnel.length > 0 && (
                        <span style={{fontWeight:600}}> (saknas: {missingPersonnel.join(' eller ')})</span>
                      )}
                    </div>
                  )}
                </span>
                <span style={{marginLeft:8,color:'#888',fontSize:13}}>
                  {(prehospitalActionDurations[opt.value] || 0) === 0
                    ? <span style={{fontSize:22}}>∞</span>
                    : `${getActionTimeMinutes(opt.value)} min`}
                </span>
                {isCompleted && <span style={{marginLeft:8,color:'#4caf50',fontWeight:700,fontSize:16}}>✓</span>}
                {selected && !isCompleted && <span style={{marginLeft:8,color:'#1976d2',fontWeight:700}}>&#10003;</span>}
              </div>
            );
          })}
          <div style={{marginTop:10,marginBottom:8,fontWeight:600,fontSize:15}}>
            Total tid: <span style={{color:'#1976d2'}}>{getTotalActionTime(p.actions)} min</span>
          </div>
          {/* Utför-knapp */}
          <button
            style={{marginTop:8,padding:'6px 16px',borderRadius:5,border:'1px solid #388e3c',background:'#388e3c',color:'#fff',fontWeight:600,cursor:'pointer'}}
            onClick={() => {
              const totalMin = getTotalActionTime(p.actions);
              // Kontrollera om det finns åtgärder att utföra
              if (!Array.isArray(p.actions) || p.actions.length === 0) {
                return;
              }
              
              // Beräkna hur många personer som behövs för alla valda åtgärder
              let maxPersonnel = 0;
              const allCategories = new Set();
              if (Array.isArray(p.actions)) {
                p.actions.forEach(action => {
                  const req = actionRequirements[action];
                  if (req) {
                    maxPersonnel = Math.max(maxPersonnel, req.personnel);
                    req.categories.forEach(cat => allCategories.add(cat));
                  }
                });
              }
              
              // Kolla om det redan finns låst personal hos denna patient som kan återanvändas
              const existingTimer = actionTimers[p.id];
              let allocated = [];
              let shouldReleaseOld = false;
              let lockedPersonnel = null;
              let needsAdditionalPersonnel = false;
              
              if (existingTimer && existingTimer.airwayLocked && existingTimer.allocatedPersonnel) {
                // Det finns låst personal hos denna patient
                lockedPersonnel = existingTimer.allocatedPersonnel;
                const lockedCategories = lockedPersonnel.map(ap => ap.category);
                
                // Kolla om alla valda åtgärder kan utföras av den låsta personalen
                let canPerformAll = true;
                let missingCompetence = null;
                if (Array.isArray(p.actions)) {
                  for (const action of p.actions) {
                    const req = actionRequirements[action];
                    if (req) {
                      // Kolla om någon av de låsta personerna kan utföra denna specifika åtgärd
                      const canPerformThisAction = lockedCategories.some(cat => req.categories.includes(cat));
                      if (!canPerformThisAction) {
                        canPerformAll = false;
                        missingCompetence = req.label;
                        break;
                      }
                    }
                  }
                }
                
                if (canPerformAll) {
                  // Återanvänd den låsta personalen
                  allocated = [...lockedPersonnel];
                  console.log('Återanvänder låst personal för nya åtgärder:', allocated);
                  
                  // Kolla om vi behöver YTTERLIGARE personal (om åtgärden kräver fler personer än vad som är låst)
                  if (maxPersonnel > lockedPersonnel.length) {
                    needsAdditionalPersonnel = true;
                    console.log(`Behöver ${maxPersonnel - lockedPersonnel.length} extra person(er) utöver den låsta personalen`);
                  }
                } else {
                  // Den låsta personalen har inte rätt kompetens
                  const lockedPersonName = personnelCategories[lockedCategories[0]]?.label || lockedCategories[0];
                  alert(`Den låsta personalen (${lockedPersonName}) kan inte utföra "${missingCompetence}". Du måste transportera patienten först för att frigöra personalen.`);
                  return;
                }
              } else if (existingTimer && existingTimer.allocatedPersonnel) {
                // Det finns en timer men den är inte låst, frigör den gamla personalen
                shouldReleaseOld = true;
              }
              
              // Om vi behöver allokera ny personal (inget att återanvända ELLER behöver extra personal)
              if (allocated.length === 0 || needsAdditionalPersonnel) {
                const vehicles = JSON.parse(localStorage.getItem('prehospitalVehicles') || '[]');
                const personsNeeded = needsAdditionalPersonnel ? (maxPersonnel - allocated.length) : maxPersonnel;
                const newlyAllocated = allocateActionPersonnel(vehicles, personsNeeded, Array.from(allCategories));
                
                if (!newlyAllocated) {
                  if (needsAdditionalPersonnel) {
                    alert(`Otillräcklig personal! Behöver ${personsNeeded} ytterligare person(er) för dessa åtgärder (utöver den låsta personalen).`);
                  } else {
                    alert(`Otillräcklig personal! Behöver ${maxPersonnel} tillgängliga personer för dessa åtgärder.`);
                  }
                  return;
                }
                
                // Lägg till den nya personalen till allocated
                allocated = [...allocated, ...newlyAllocated];
                
                // Markera ny personal som upptagen
                const updatedVehicles = markPersonnelBusy(vehicles, newlyAllocated);
                localStorage.setItem('prehospitalVehicles', JSON.stringify(updatedVehicles));
                window.dispatchEvent(new CustomEvent('prehospitalVehiclesUpdated', { detail: updatedVehicles }));
              }
              
              // Kontrollera om någon åtgärd låser personal (t.ex. fri_luftväg, intubering, i-gel, ventilationsstöd)
              const hasAirwayLock = Array.isArray(p.actions) && p.actions.some(action => {
                const req = actionRequirements[action];
                return req && req.locksPersonnel;
              });
              
              // Om det redan finns en låst timer och vi återanvänder personalen, behåll låset
              const keepLock = existingTimer && existingTimer.airwayLocked && lockedPersonnel && allocated.length > 0 && 
                                allocated.every((ap, i) => lockedPersonnel[i] && ap.vehicleId === lockedPersonnel[i].vehicleId && ap.personId === lockedPersonnel[i].personId);
              const finalAirwayLock = keepLock || hasAirwayLock;
              
              // Frigör gammal personal om det behövs (men INTE om vi behåller låset)
              if (shouldReleaseOld && !keepLock && existingTimer && existingTimer.allocatedPersonnel) {
                const currentVehicles = JSON.parse(localStorage.getItem('prehospitalVehicles') || '[]');
                const freedVehicles = releasePersonnel(currentVehicles, existingTimer.allocatedPersonnel);
                localStorage.setItem('prehospitalVehicles', JSON.stringify(freedVehicles));
                window.dispatchEvent(new CustomEvent('prehospitalVehiclesUpdated', { detail: freedVehicles }));
                console.log('Frigjorde gammal personal innan ny åtgärd:', existingTimer.allocatedPersonnel);
              }
              
              // Skapa eller uppdatera timer
              setActionTimers(prev => {
                // Om personalen redan är låst och vi återanvänder dem
                if (keepLock && existingTimer) {
                  // Om det finns tidsbestämda åtgärder (totalMin > 0), starta en timer men behåll låset
                  if (totalMin > 0) {
                    console.log('Återanvänder låst personal för tidsbestämd åtgärd - startar timer men behåller lås', totalMin, 'min');
                    return {
                      ...prev,
                      [p.id]: {
                        startedAtSimTime: simTime,
                        durationMinutes: totalMin,
                        remaining: totalMin * 60,
                        allocatedPersonnel: allocated,
                        airwayLocked: finalAirwayLock, // Behåller låset
                        waitingForFollowUp: false, // Tar bort waiting-status under åtgärden
                        actions: p.actions
                      }
                    };
                  } else {
                    // Alla åtgärder är oändliga, behåll befintlig timer
                    console.log('Återanvänder låst personal för oändlig åtgärd - behåller befintlig timer');
                    return {
                      ...prev,
                      [p.id]: {
                        ...existingTimer,
                        allocatedPersonnel: allocated,
                        airwayLocked: finalAirwayLock,
                        actions: p.actions
                      }
                    };
                  }
                }
                
                // Annars skapa ny timer med ny tid
                return {
                  ...prev,
                  [p.id]: {
                    startedAtSimTime: simTime,
                    durationMinutes: totalMin,
                    remaining: totalMin * 60,
                    allocatedPersonnel: allocated,
                    airwayLocked: finalAirwayLock,
                    actions: p.actions
                  }
                };
              });
              
              setOpenActionPatient(null);
            }}
          >Utför</button>
          <button
            style={{marginTop:12,padding:'6px 16px',borderRadius:5,border:'1px solid #1976d2',background:'#1976d2',color:'#fff',fontWeight:600,cursor:'pointer'}}
            onClick={() => setOpenActionPatient(null)}
          >Stäng</button>
        </div>
      </div>
    ),
    // Modal för triage-val
    openTriagePatient === p.id && (
      <div key={p.id+':triage-modal'} style={{
        position:'fixed',left:0,top:0,width:'100vw',height:'100vh',zIndex:9999,
        background:'rgba(0,0,0,0.25)',display:'flex',alignItems:'center',justifyContent:'center'
      }} onClick={(e) => {
        if (e.target === e.currentTarget) setOpenTriagePatient(null);
      }}>
        <div style={{background:'#fff',padding:24,borderRadius:8,minWidth:340,maxWidth:500,maxHeight:'80vh',overflowY:'auto',boxShadow:'0 2px 12px #0004',position:'relative'}}>
          <div style={{fontWeight:700,fontSize:17,marginBottom:14}}>{typeof p.name === 'object' ? (p.name?.name || p.personnummer || p.id) : (p.name || p.personnummer || p.id)}</div>
          {renderPatientInfo(p)}
          <button
            style={{marginTop:12,padding:'6px 16px',borderRadius:5,border:'1px solid #888',background:'transparent',color:'#333',fontWeight:600,cursor:'pointer'}}
            onClick={() => setOpenTriagePatient(null)}
          >Stäng</button>
        </div>
      </div>
    )
  ]).flat();
}

// Komponent för att visa grupperade fordon med nedräkningstimer
function VehicleGroupDisplay({ type, vehicles, vType, simTime }) {
  const availableVehicles = vehicles.filter(v => v.status !== 'away');
  const awayVehicles = vehicles.filter(v => v.status === 'away');
  const availableCount = availableVehicles.length;
  const awayCount = awayVehicles.length;
  
  const timeRemaining = awayCount > 0
    ? Math.min(...awayVehicles.map(vehicle => Math.max(0,
      (Number(vehicle.returnTimeMinutes) || 0) - elapsedSimulationMinutes(vehicle.returnStartSimTime || simTime, simTime)
    )))
    : 0;
  
  return (
    <>
      {availableCount > 0 && (
        <div style={{
          background: '#f5f5f5',
          padding: '8px 10px',
          borderRadius: 4,
          marginBottom: 4,
          border: '1px solid #e0e0e0'
        }}>
          <div style={{flex: 1}}>
            <div style={{fontWeight: 600, fontSize: 14}}>
              {availableCount} x {vType.icon} {vType.label}
            </div>
            <div style={{fontSize: 12, color: '#666'}}>
              {Object.entries(vType.personnel).map(([cat, count]) => 
                `${count}x ${personnelCategories[cat].label}`
              ).join(', ')}
            </div>
          </div>
        </div>
      )}
      
      {awayCount > 0 && (
        <div style={{
          background: '#fff3e0',
          padding: '8px 10px',
          borderRadius: 4,
          marginBottom: 4,
          border: '2px solid #ff9800'
        }}>
          <div style={{flex: 1}}>
            <div style={{fontWeight: 600, fontSize: 14, color: '#ff9800'}}>
              🚑 {awayCount} x {vType.icon} {vType.label} på transport
            </div>
            <div style={{fontSize: 12, color: '#ff9800', fontWeight: 600, marginTop: 4}}>
              Tillbaka om: {timeRemaining} min
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function MapPanel({ simTime: propSimTime }) {
  const [simTime, setSimTime] = useState(() => {
    if (propSimTime) return propSimTime;
    const now = new Date();
    return now.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', hour12: false }).padStart(5, '0');
  });

  const [simulationEnvironment, setSimulationEnvironment] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('simulationEnvironment') || '{}');
    } catch {
      return {};
    }
  });

  useEffect(() => {
    function updateEnvironment(event) {
      if (event.detail) {
        setSimulationEnvironment(event.detail);
        return;
      }
      try {
        setSimulationEnvironment(JSON.parse(localStorage.getItem('simulationEnvironment') || '{}'));
      } catch {
        setSimulationEnvironment({});
      }
    }
    window.addEventListener('simulationEnvironmentChanged', updateEnvironment);
    window.addEventListener('storage', updateEnvironment);
    return () => {
      window.removeEventListener('simulationEnvironmentChanged', updateEnvironment);
      window.removeEventListener('storage', updateEnvironment);
    };
  }, []);
  
  // Uppdatera simTime när propen ändras
  useEffect(() => {
    if (propSimTime) {
      setSimTime(propSimTime);
    }
  }, [propSimTime]);

  const effectiveSimulationEnvironment = {
    ...simulationEnvironment,
    darkness: Boolean(simulationEnvironment.forceDarkness) || isDarkAtTime(simTime)
  };
  
  const [openActionPatient, setOpenActionPatient] = useState(null);
  const [openTriagePatient, setOpenTriagePatient] = useState(null);
  const [hospitalSelectPatient, setHospitalSelectPatient] = useState(null);
  const hospitalDispatchHandlerRef = useRef(null);
  const [placingCollectionPoint, setPlacingCollectionPoint] = useState(false);
  const [collectionPoint, setCollectionPoint] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('collectionPointMarker') || 'null');
    } catch {
      return null;
    }
  });
  const [placingDeadCollectionPoint, setPlacingDeadCollectionPoint] = useState(false);
  const [deadCollectionPoint, setDeadCollectionPoint] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('deadCollectionPointMarker') || 'null');
    } catch {
      return null;
    }
  });
  
  // Action timers och transport tasks för personal tracking
  const [actionTimers, setActionTimers] = useState({});
  const [transportTasks, setTransportTasks] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('prehospitalTransportTasks') || '{}');
    } catch {
      return {};
    }
  });
  
  // Resurshantering
  const [vehicles, setVehicles] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('prehospitalVehicles') || '[]');
    } catch {
      return [];
    }
  });
  
  const mapRef = useRef();

  // Listen for storage changes (sync between windows)
  useEffect(() => {
    function handleStorage(e) {
      if (e.key === 'collectionPointMarker') {
        try {
          setCollectionPoint(JSON.parse(e.newValue || 'null'));
        } catch {}
      }
      if (e.key === 'deadCollectionPointMarker') {
        try {
          setDeadCollectionPoint(JSON.parse(e.newValue || 'null'));
        } catch {}
      }
      if (e.key === 'prehospitalVehicles') {
        try {
          setVehicles(JSON.parse(e.newValue || '[]'));
        } catch {}
      }
    }
    
    // Lyssna också på custom events
    function handleVehicleUpdate(e) {
      // Läs alltid från localStorage för att säkerställa senaste versionen
      const vehiclesFromStorage = JSON.parse(localStorage.getItem('prehospitalVehicles') || '[]');
      setVehicles(vehiclesFromStorage);
    }
    
    window.addEventListener('storage', handleStorage);
    window.addEventListener('prehospitalVehiclesUpdated', handleVehicleUpdate);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('prehospitalVehiclesUpdated', handleVehicleUpdate);
    };
  }, []);
  
  // Spara vehicles till localStorage (tas bort eftersom kontrollpanelen nu hanterar detta)
  // vehicles läses in från localStorage och lyssnar på förändringar

  // Map click handler for placing collection point

  function handleCollectionPointPlace(latlng) {
    console.log('handleCollectionPointPlace called with:', latlng);
    const oldCollectionPoint = collectionPoint;
    
    // Om det redan finns en uppsamlingsplats, hantera flyttning
    if (oldCollectionPoint) {
      console.log('Flyttar uppsamlingsplats från', oldCollectionPoint, 'till', latlng);
      
      // Läs in aktuella patienter
      const allPatients = JSON.parse(localStorage.getItem('prehospitalPatients') || '[]');
      
      // 1. Hantera patienter som är på väg till gamla uppsamlingsplatsen
      const updatedTransportTasks = { ...transportTasks };
      Object.keys(updatedTransportTasks).forEach(patientId => {
        const task = updatedTransportTasks[patientId];
        if (task.type === 'carryToCollectionPoint' || task.type === 'walkToCollectionPoint') {
          const patient = allPatients.find(p => p.id === patientId);
          if (patient && patient.lat && patient.lng) {
            // Räkna om avstånd och tid till nya platsen
            const calculateDistance = (lat1, lng1, lat2, lng2) => {
              const R = 6371000; // Jordens radie i meter
              const dLat = (lat2 - lat1) * Math.PI / 180;
              const dLng = (lng2 - lng1) * Math.PI / 180;
              const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                        Math.sin(dLng/2) * Math.sin(dLng/2);
              const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
              return R * c;
            };
            
            const newDistance = calculateDistance(patient.lat, patient.lng, latlng.lat, latlng.lng);
            const walkSpeed = 1.4; // m/s
            const carrySpeed = 0.7; // m/s
            const speed = task.type === 'walkToCollectionPoint' ? walkSpeed : carrySpeed;
            const newTimeSeconds = Math.ceil(newDistance / speed);
            updatedTransportTasks[patientId] = {
              ...task,
              startedAtSimTime: simTime,
              durationMinutes: newTimeSeconds / 60,
              remaining: newTimeSeconds,
              distance: Math.round(newDistance)
            };
            
            console.log(`Patient ${patientId} omdirigerad till ny uppsamlingsplats: ${Math.round(newDistance)}m, ${newTimeSeconds}s`);
          }
        } else if (task.type === 'relocateToNewCollectionPoint') {
          // Patient håller på att flyttas från ursprunglig plats till nya uppsamlingsplatsen
          // Räkna om från URSPRUNGLIGA platsen (sourceLocation) till ÄNNU nyare platsen
          const calculateDistance = (lat1, lng1, lat2, lng2) => {
            const R = 6371000;
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLng = (lng2 - lng1) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                      Math.sin(dLng/2) * Math.sin(dLng/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return R * c;
          };
          
          // Använd sourceLocation från task, eller fallback till oldCollectionPoint
          const sourcePos = task.sourceLocation || oldCollectionPoint;
          const newDistance = calculateDistance(sourcePos.lat, sourcePos.lng, latlng.lat, latlng.lng);
          const carrySpeed = 0.7; // m/s
          const newTimeSeconds = Math.ceil(newDistance / carrySpeed) * 2; // Tur och retur
          updatedTransportTasks[patientId] = {
            ...task,
            startedAtSimTime: simTime,
            durationMinutes: newTimeSeconds / 60,
            remaining: newTimeSeconds,
            distance: Math.round(newDistance),
            sourceLocation: sourcePos // Behåll ursprungliga platsen
          };
          
          console.log(`Patient ${patientId} i relocate omdirigerad från (${sourcePos.lat.toFixed(4)}, ${sourcePos.lng.toFixed(4)}): ${Math.round(newDistance)}m, ${newTimeSeconds}s`);
        }
      });
      setTransportTasks(updatedTransportTasks);
      
      // 2. Hantera patienter som redan är på gamla uppsamlingsplatsen
      // Exkludera patienter som redan har en transportTask (de är redan in transit eller håller på att flyttas)
      const patientsAtOldLocation = allPatients.filter(p => 
        p.location === 'Uppsamlingsplats' && !updatedTransportTasks[p.id]
      );
      
      if (patientsAtOldLocation.length > 0) {
        console.log(`${patientsAtOldLocation.length} patient(er) på gamla uppsamlingsplatsen behöver flyttas`);
        
        // Beräkna avstånd mellan gamla och nya platsen
        const calculateDistance = (lat1, lng1, lat2, lng2) => {
          const R = 6371000;
          const dLat = (lat2 - lat1) * Math.PI / 180;
          const dLng = (lng2 - lng1) * Math.PI / 180;
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                    Math.sin(dLng/2) * Math.sin(dLng/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          return R * c;
        };
        
        const relocateDistance = calculateDistance(oldCollectionPoint.lat, oldCollectionPoint.lng, latlng.lat, latlng.lng);
        const carrySpeed = 0.7; // m/s
        const timePerTrip = Math.ceil(relocateDistance / carrySpeed) * 2; // Tur och retur
        
        // Hitta tillgänglig personal för att bära (använd aktuell vehicles state, inte localStorage)
        // Exkludera personal som redan bär patienter in transit
        const busyPersonnelIds = new Set();
        Object.values(updatedTransportTasks).forEach(task => {
          if ((task.type === 'carryToCollectionPoint' || task.type === 'walkToCollectionPoint' || task.type === 'relocateToNewCollectionPoint') && task.allocatedPersonnel) {
            task.allocatedPersonnel.forEach(p => {
              busyPersonnelIds.add(`${p.vehicleId}-${p.id}`);
            });
          }
        });
        
        console.log('Upptagen personal (busyPersonnelIds):', Array.from(busyPersonnelIds));
        
        // Läs från localStorage för att få senaste statusen på personal
        const currentVehicles = JSON.parse(localStorage.getItem('prehospitalVehicles') || '[]');
        console.log('Fordon med personal:', currentVehicles);
        
        const availablePersonnelList = [];
        
        currentVehicles.forEach(v => {
          if (v.personnel) {
            v.personnel.forEach(p => {
              const personnelKey = `${v.id}-${p.id}`;
              console.log(`Kollar personal ${personnelKey}: status=${p.status}, busy=${busyPersonnelIds.has(personnelKey)}`);
              if (p.status === 'available' && !busyPersonnelIds.has(personnelKey)) {
                availablePersonnelList.push({ ...p, vehicleId: v.id });
              }
            });
          }
        });
        
        console.log('Tillgänglig personal för flytt:', availablePersonnelList);
        
        if (availablePersonnelList.length < 2) {
          alert(`Otillräcklig personal för att flytta ${patientsAtOldLocation.length} patient(er) från gamla uppsamlingsplatsen! Behöver minst 2 personer.`);
          // Fortsätt ändå och flytta uppsamlingsplatsen, men flytta inte patienterna
          console.log('Uppsamlingsplatsen flyttas men patienterna stannar kvar tills personal blir tillgänglig');
        } else {
          // Använd max 2 personer för att bära (även om fler finns tillgängliga)
          const carriers = availablePersonnelList.slice(0, 2);
          const tripsNeeded = patientsAtOldLocation.length;
          const totalTimeSeconds = timePerTrip * tripsNeeded;
          
          console.log(`Behöver ${tripsNeeded} vändor, ${timePerTrip}s per vända, totalt ${totalTimeSeconds}s`);
          
          // Markera personal som upptagen
          const updatedVehicles = currentVehicles.map(v => ({
            ...v,
            personnel: v.personnel.map(p => {
              const isCarrier = carriers.some(c => c.vehicleId === v.id && c.id === p.id);
              return isCarrier ? { ...p, status: 'busy' } : p;
            })
          }));
          setVehicles(updatedVehicles);
          localStorage.setItem('prehospitalVehicles', JSON.stringify(updatedVehicles));
          window.dispatchEvent(new CustomEvent('prehospitalVehiclesUpdated', { detail: updatedVehicles }));
          
          // Skapa transportTasks för varje patient som ska flyttas
          const newTransportTasks = { ...transportTasks };
          patientsAtOldLocation.forEach((patient, index) => {
            const startDelay = timePerTrip * index; // Varje patient börjar efter föregående vända
            newTransportTasks[patient.id] = {
              type: 'relocateToNewCollectionPoint',
              startedAtSimTime: addSimulationMinutes(simTime, startDelay / 60),
              durationMinutes: timePerTrip / 60,
              remaining: startDelay + timePerTrip,
              personnel: 2,
              distance: Math.round(relocateDistance),
              allocatedPersonnel: carriers.map(c => ({ id: c.id, vehicleId: c.vehicleId })),
              sourceLocation: { lat: oldCollectionPoint.lat, lng: oldCollectionPoint.lng } // Spara var patienten befinner sig
            };
          });
          setTransportTasks(newTransportTasks);
          
          // Transport-countdown-logiken i useEffect kommer automatiskt flytta patienterna
          // när endTime nås och frigöra personalen
          
          alert(`Flyttar ${patientsAtOldLocation.length} patient(er) till nya uppsamlingsplatsen. Tid: ${Math.ceil(totalTimeSeconds / 60)} minuter.`);
        }
      }
    }
    
    setCollectionPoint(latlng);
    localStorage.setItem('collectionPointMarker', JSON.stringify(latlng));
    // Låt placingCollectionPoint vara true tills användaren trycker "Klar"
  }
  function handleDeadCollectionPointPlace(latlng) {
    setDeadCollectionPoint(latlng);
    localStorage.setItem('deadCollectionPointMarker', JSON.stringify(latlng));
    // Låt placingDeadCollectionPoint vara true tills användaren trycker "Klar"
  }
  
  // Beräkna total och tillgänglig personal
  const totalPersonnel = getTotalPersonnel(vehicles);
  const availablePersonnel = getAvailablePersonnel(vehicles);

  // Hämta patienter från localStorage
  const [sidePanelPatients, setSidePanelPatients] = React.useState([]);
  React.useEffect(() => {
    function updatePatients() {
      const pats = JSON.parse(localStorage.getItem('prehospitalPatients') || '[]');
      setSidePanelPatients(Array.isArray(pats) ? pats : []);
    }
    updatePatients();
    window.addEventListener('prehospitalPatientsCreated', updatePatients);
    window.addEventListener('prehospitalPatientsUpdated', updatePatients);
    window.addEventListener('storage', updatePatients);
    return () => {
      window.removeEventListener('prehospitalPatientsCreated', updatePatients);
      window.removeEventListener('prehospitalPatientsUpdated', updatePatients);
      window.removeEventListener('storage', updatePatients);
    };
  }, []);

  // Beräkna statistik
  // Endast triagerade med faktisk färg (ej tom eller null eller undefined eller 'Välj triage')
  const validTriageColors = ['Röd', 'Gul', 'Grön', 'Svart'];
  const triagedCount = sidePanelPatients.filter(p => validTriageColors.includes(
    typeof p.triage === 'object' ? (p.triage?.scene || p.triage?.sorting || p.triage?.emergencyDept || '') : (p.triage || '')
  )).length;
  const atCollectionPoint = sidePanelPatients.filter(p => p.location === 'Uppsamlingsplats').length;
  const atDeadCollectionPoint = sidePanelPatients.filter(p => p.location === 'Uppsamlingsplats döda').length;

  // Kontrollera om automatisering är aktiv
  const [automationActive, setAutomationActive] = useState(false);
  useEffect(() => {
    function checkAutomation() {
      const automatedViews = JSON.parse(localStorage.getItem('automatedViews') || '{}');
      setAutomationActive(automatedViews.Prehospital || false);
    }
    checkAutomation();
    window.addEventListener('automatedViewsChanged', checkAutomation);
    window.addEventListener('storage', checkAutomation);
    return () => {
      window.removeEventListener('automatedViewsChanged', checkAutomation);
      window.removeEventListener('storage', checkAutomation);
    };
  }, []);

  return (
    <>
    <div className="flowsim-map-layout" style={{ height: '90vh', width: '100%', marginTop: 16, borderRadius: 8, overflow: 'hidden', boxShadow: '0 2px 8px #0002', display: 'flex', flexDirection: 'row' }}>
      {/* Informationspanel till vänster */}
      <div className="flowsim-map-sidebar" style={{ width: 320, minWidth: 220, background: '#f7faff', borderRight: '1px solid #e0e0e0', padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
        <h3 style={{marginTop:0,marginBottom:16,fontWeight:700,fontSize:22,color:'#1976d2'}}>Information</h3>
        
        {/* Automatiserings-indikator */}
        {automationActive && (
          <div style={{
            background: '#e8f5e9',
            border: '2px solid #4caf50',
            borderRadius: 6,
            padding: '12px 16px',
            marginBottom: 16,
            textAlign: 'center'
          }}>
            <div style={{fontWeight: 700, fontSize: 15, color: '#2e7d32', marginBottom: 4}}>
              ⚙️ AUTOMATISERING AKTIV
            </div>
            <div style={{fontSize: 13, color: '#388e3c'}}>
              Patienter hanteras automatiskt
            </div>
          </div>
        )}
        
        <button
          style={{
            padding: '10px 16px',
            fontSize: 15,
            borderRadius: 6,
            border: '1px solid #1976d2',
            background: '#1976d2',
            color: '#fff',
            fontWeight: 600,
            marginBottom: 8,
            cursor: 'pointer',
            boxShadow: '0 1px 4px #0001'
          }}
          onClick={() => {
            setPlacingCollectionPoint(prev => {
              const next = !prev;
              if (next) setPlacingDeadCollectionPoint(false);
              return next;
            });
          }}
        >
          {placingCollectionPoint ? 'Klar' : 'Uppsamlingsplats'}
        </button>
        <div style={{fontSize:13,color:'#1976d2',marginBottom:8}}>
          {placingCollectionPoint ? 'Klicka på kartan för att sätta ut uppsamlingsplats.' : ''}
        </div>
        <button
          style={{
            padding: '10px 16px',
            fontSize: 15,
            borderRadius: 6,
            border: '1px solid #b71c1c',
            background: '#b71c1c',
            color: '#fff',
            fontWeight: 600,
            marginBottom: 8,
            cursor: 'pointer',
            boxShadow: '0 1px 4px #0001'
          }}
          onClick={() => {
            setPlacingDeadCollectionPoint(prev => {
              const next = !prev;
              if (next) setPlacingCollectionPoint(false);
              return next;
            });
          }}
        >
          {placingDeadCollectionPoint ? 'Klar' : 'Uppsamlingsplats döda'}
        </button>
        <div style={{fontSize:13,color:'#b71c1c',marginBottom:8}}>
          {placingDeadCollectionPoint ? 'Klicka på kartan för att sätta ut uppsamlingsplats döda.' : ''}
        </div>
        
        {/* Resurspanel - alltid synlig */}
        <div style={{marginTop:12}}>
          <div style={{background:'#fff',border:'1px solid #e0e0e0',borderRadius:6,padding:'12px 16px',marginBottom:8,fontSize:14,boxShadow:'0 1px 4px #0001'}}>
            <div style={{fontWeight:600,marginBottom:8,fontSize:15,color:'#ff9800'}}>
              Fordon på skadeplatsen ({vehicles.length})
            </div>
            <div style={{fontSize:12,color:'#666',marginBottom:12,fontStyle:'italic'}}>
              (Fordon läggs till från kontrollpanelen)
            </div>
            
            {vehicles.length === 0 ? (
              <div style={{color:'#999',fontSize:13,fontStyle:'italic',marginBottom:8}}>Inga fordon har anlänt ännu</div>
            ) : (
              <div style={{maxHeight:400,overflowY:'auto',marginBottom:12}}>
                {(() => {
                  // Gruppera fordon efter typ
                  const grouped = vehicles.reduce((acc, vehicle) => {
                    if (!acc[vehicle.type]) {
                      acc[vehicle.type] = [];
                    }
                    acc[vehicle.type].push(vehicle);
                    return acc;
                  }, {});
                  
                  return Object.entries(grouped).map(([type, vehiclesOfType]) => {
                    const vType = vehicleTypes[type];
                    return (
                      <VehicleGroupDisplay 
                        key={type}
                        type={type}
                        vehicles={vehiclesOfType}
                        vType={vType}
                        simTime={simTime}
                      />
                    );
                  });
                })()}
              </div>
            )}
            
            <div style={{fontWeight:600,marginBottom:6,fontSize:15,marginTop:12}}>Tillgänglig personal</div>
            {Object.keys(availablePersonnel).length === 0 ? (
              <div style={{color:'#999',fontSize:13,fontStyle:'italic'}}>Ingen personal tillgänglig</div>
            ) : (
              <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:12}}>
                {Object.entries(availablePersonnel).map(([cat, count]) => (
                  <div key={cat} style={{
                    background:personnelCategories[cat].color,
                    color:'#fff',
                    padding:'4px 8px',
                    borderRadius:4,
                    fontSize:13,
                    fontWeight:600
                  }}>
                    {count}x {personnelCategories[cat].label}
                  </div>
                ))}
              </div>
            )}
            
            <div style={{fontWeight:600,marginBottom:6,fontSize:15}}>Upptagen personal</div>
            {(() => {
              const busyPersonnel = {};
              Object.entries(totalPersonnel).forEach(([cat, total]) => {
                const available = availablePersonnel[cat] || 0;
                const busy = total - available;
                if (busy > 0) {
                  busyPersonnel[cat] = busy;
                }
              });
              
              // Beräkna när nästa person av varje kategori blir ledig
              const nextAvailableTime = {};
              
              // Kolla actionTimers
              Object.values(actionTimers).forEach(timer => {
                if (timer.allocatedPersonnel && timer.remaining > 0) {
                  timer.allocatedPersonnel.forEach(person => {
                    const cat = person.category;
                    const timeRemaining = timer.waitingForFollowUp ? Infinity : timer.remaining;
                    if (!nextAvailableTime[cat] || timeRemaining < nextAvailableTime[cat]) {
                      nextAvailableTime[cat] = timeRemaining;
                    }
                  });
                }
              });
              
              // Kolla transportTasks
              Object.values(transportTasks).forEach(task => {
                if (task.allocatedPersonnel && task.remaining > 0) {
                  task.allocatedPersonnel.forEach(person => {
                    const cat = person.category;
                    if (!nextAvailableTime[cat] || task.remaining < nextAvailableTime[cat]) {
                      nextAvailableTime[cat] = task.remaining;
                    }
                  });
                }
              });
              
              return Object.keys(busyPersonnel).length === 0 ? (
                <div style={{color:'#999',fontSize:13,fontStyle:'italic'}}>Ingen personal upptagen</div>
              ) : (
                <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                  {Object.entries(busyPersonnel).map(([cat, count]) => {
                    const timeUntilNext = nextAvailableTime[cat];
                    const timeText = timeUntilNext === Infinity 
                      ? '∞' 
                      : timeUntilNext 
                        ? `${Math.ceil(timeUntilNext / 60)}min` 
                        : '?';
                    
                    return (
                      <div key={cat} style={{
                        background:personnelCategories[cat].color,
                        color:'#fff',
                        padding:'4px 8px',
                        borderRadius:4,
                        fontSize:13,
                        fontWeight:600,
                        opacity:0.7
                      }}>
                        {count}x {personnelCategories[cat].label}
                        {timeUntilNext !== undefined && (
                          <span style={{marginLeft:6,fontSize:11,opacity:0.9}}>
                            (nästa: {timeText})
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
        
        {/* Statistikruta */}
        <div style={{background:'#fff',border:'1px solid #e0e0e0',borderRadius:6,padding:'12px 16px',marginTop:8,marginBottom:8,fontSize:15,boxShadow:'0 1px 4px #0001'}}>
          <div style={{fontWeight:600,marginBottom:4}}>Status patienter</div>
          <div>Triagerade: <b>{triagedCount}</b></div>
          <div>På uppsamlingsplats: <b>{atCollectionPoint}</b></div>
          <div>På uppsamlingsplats döda: <b>{atDeadCollectionPoint}</b></div>
        </div>
      </div>
      {/* Karta till höger */}
      <div className="flowsim-map-canvas" style={{ flex: 1, height: '100%' }}>
        <MapContainer
          center={[63.8258, 20.2630]}
          zoom={17}
          style={{ height: '100%', width: '100%' }}
          whenCreated={mapInstance => (mapRef.current = mapInstance)}
        >
          <CollectionPointPlacer placing={placingCollectionPoint} onPlace={handleCollectionPointPlace} />
          <CollectionPointPlacer placing={placingDeadCollectionPoint} onPlace={handleDeadCollectionPointPlace} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {/* <PrehospitalMapSyncMarker /> */}
          <PrehospitalPatientsMarkers 
            collectionPoint={collectionPoint} 
            openActionPatient={openActionPatient} 
            setOpenActionPatient={setOpenActionPatient}
            openTriagePatient={openTriagePatient}
            setOpenTriagePatient={setOpenTriagePatient}
            setHospitalSelectPatient={setHospitalSelectPatient}
            hospitalDispatchHandlerRef={hospitalDispatchHandlerRef}
            totalPersonnel={totalPersonnel}
            availablePersonnel={availablePersonnel}
            actionTimers={actionTimers}
            setActionTimers={setActionTimers}
            transportTasks={transportTasks}
            setTransportTasks={setTransportTasks}
            simTime={simTime}
            simulationEnvironment={effectiveSimulationEnvironment}
          />
          {collectionPoint && (
            <Marker position={collectionPoint} icon={window.L && window.L.icon ? window.L.icon({
              iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
              iconSize: [25, 41],
              iconAnchor: [12, 41],
              popupAnchor: [1, -34],
              shadowUrl: 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-shadow.png',
              shadowSize: [41, 41]
            }) : undefined}>
              <Popup minWidth={250}>
                <div style={{fontWeight:700,fontSize:16,marginBottom:8}}>Uppsamlingsplats</div>
                <div style={{fontSize:14}}>
                  {sidePanelPatients.filter(p => p.location === 'Uppsamlingsplats').length === 0 ? (
                    <div style={{color:'#888',fontStyle:'italic'}}>Inga patienter än</div>
                  ) : (
                    <div>
                      <div style={{fontWeight:600,marginBottom:4}}>Patienter här:</div>
                      <ul style={{margin:0,paddingLeft:18,listStyle:'disc'}}>
                        {sidePanelPatients.filter(p => p.location === 'Uppsamlingsplats').map(p => {
                          const triageColors = { 'Röd': '#d32f2f', 'Orange': '#ff9800', 'Gul': '#fbc02d', 'Grön': '#388e3c', 'Svart': '#222' };
                          const triageValue = typeof p.triage === 'object' ? (p.triage?.scene || p.triage?.sorting) : p.triage;
                          const triageColor = triageColors[triageValue] || '#555';
                          return (
                            <li 
                              key={p.id}
                              style={{marginBottom:2,cursor:'pointer',padding:'4px 6px',borderRadius:4,transition:'background 0.15s',borderLeft:`4px solid ${triageColor}`}}
                              onClick={() => {
                                setOpenTriagePatient(p.id);
                                // Stäng eventuell Leaflet popup från markören
                                setTimeout(() => {
                                  document.querySelectorAll('.leaflet-popup-close-button').forEach(btn => btn.click());
                                }, 0);
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = '#e3f2fd'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              <span style={{fontWeight:500}}>{typeof p.name === 'object' ? (p.name?.name || p.personnummer || p.id) : (p.name || p.personnummer || p.id)}</span>
                              {triageValue && <span style={{marginLeft:6,fontSize:13,color:triageColor,fontWeight:600,background:triageColor+'22',padding:'2px 4px',borderRadius:3}}>● {triageValue}</span>}
                              {/* Skicka till sjukhus-knapp i patientpopup från uppsamlingsplatsens lista */}
                              {openTriagePatient === p.id && (
                                <div style={{marginTop:8}}>
                                  <button
                                    style={{padding:'6px 12px',borderRadius:5,border:'1px solid #1976d2',background:'#1976d2',color:'#fff',fontWeight:600,cursor:'pointer'}}
                                    onClick={e => {
                                      e.stopPropagation();
                                      if (typeof window.canTransportToHospital === 'function' ? window.canTransportToHospital(p.id) : true) {
                                        if (typeof window.setHospitalSelectPatient === 'function') {
                                          window.setHospitalSelectPatient(p.id);
                                        } else if (typeof setHospitalSelectPatient === 'function') {
                                          setHospitalSelectPatient(p.id);
                                        }
                                      } else {
                                        alert('Ingen transport till sjukhus möjlig för denna patient!');
                                      }
                                    }}
                                  >
                                    Skicka till sjukhus
                                  </button>
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          )}
          {deadCollectionPoint && (
            <Marker position={deadCollectionPoint} icon={window.L && window.L.icon ? window.L.icon({
              iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
              iconSize: [25, 41],
              iconAnchor: [12, 41],
              popupAnchor: [1, -34],
              shadowUrl: 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-shadow.png',
              shadowSize: [41, 41]
            }) : undefined}>
              <Popup>
                <span style={{color:'#b71c1c',fontWeight:700,fontSize:16}}>Uppsamlingsplats döda</span>
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>
    </div>
    {hospitalSelectPatient && createPortal(
      <div
        role="presentation"
        style={{position:'fixed',inset:0,zIndex:10000,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center'}}
        onClick={event => {
          if (event.target === event.currentTarget) setHospitalSelectPatient(null);
        }}
      >
        <div role="dialog" aria-modal="true" aria-labelledby="hospital-destination-title" style={{background:'#fff',borderRadius:8,padding:24,width:'min(440px, calc(100vw - 32px))',boxShadow:'0 4px 20px rgba(0,0,0,0.3)'}}>
          <h3 id="hospital-destination-title" style={{margin:'0 0 20px',fontSize:20,color:'#1976d2'}}>Välj destination</h3>
          {['Norrlands universitetssjukhus', 'Skellefteå sjukhus', 'Lycksele lasarett'].map(hospital => (
            <button
              key={hospital}
              type="button"
              style={{display:'block',width:'100%',padding:'12px 16px',marginBottom:8,fontSize:15,borderRadius:6,border:'2px solid #1976d2',background:'#fff',color:'#1976d2',fontWeight:600,cursor:'pointer',textAlign:'left'}}
              onClick={() => {
                const dispatch = hospitalDispatchHandlerRef.current;
                if (!dispatch) {
                  alert('Transportfunktionen är inte redo. Stäng rutan och försök igen.');
                  return;
                }
                try {
                  if (dispatch(hospitalSelectPatient, hospital)) setHospitalSelectPatient(null);
                } catch (error) {
                  console.error('Kunde inte skicka patienten till sjukhuset:', error);
                  alert(`Transporten kunde inte starta: ${error?.message || 'okänt fel'}`);
                }
              }}
            >
              {hospital}
            </button>
          ))}
          <button type="button" style={{width:'100%',padding:'10px 16px',fontSize:14,borderRadius:6,border:'1px solid #ccc',background:'#f5f5f5',color:'#333',fontWeight:600,cursor:'pointer'}} onClick={() => setHospitalSelectPatient(null)}>
            Avbryt
          </button>
        </div>
      </div>,
      document.body
    )}
    </>
  );
}

