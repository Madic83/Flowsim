// Skicka patient till OP (utan att ta bort från akutmottagning)
  function handleSendToOP(patientIndex) {
    const patient = patients[patientIndex];
    if (!patient) return;
    if (!patientNeedsOperation(patient)) {
      alert('Den här patienten behöver ingen operation');
      return;
    }
    // Lägg till i OP-listan (akutlistan)
    setDepartmentPatients(prev => {
      const prevList = prev['OP'] || [];
      // Undvik dubletter
      if (prevList.some(p => p.id === patient.id)) return prev;
      const updated = { ...prev, OP: [...prevList, patient] };
      localStorage.setItem('departmentPatients', JSON.stringify(updated));
      return updated;
    });
  }
import React, { useState, useEffect } from 'react';
import OPScheduleTable from './components/OPScheduleTable';
import MapPanel from './components/MapPanel';
import { determineAkutCare, timeToMinutes, minutesToTime } from './components/akutCareAutomation';
import { determineOPCare } from './components/opCareAutomation';
import { determineIvaCare } from './components/ivaCareAutomation';
import { getWeatherPresentation } from './weatherDisplay';
import { getTargetPatientCount, NORRLANDS_DEPARTMENT_BEDS } from './departmentOccupancy';
import { actionRequirements } from './components/prehospitalResources';
import { repairInitialAcuteStartTimes } from './acuteStartTimes.js';
import Katastrofliggare from './components/Katastrofliggare';
import LSSL from './components/LSSL';

// Hjälpfunktion för att hitta patientobjekt i OP-listan
function getPatientByIdFromOP(departmentPatients, id) {
  const opList = departmentPatients['OP'] || [];
  return opList.find(p => p.id === id);
}

const th = {border:'1px solid #ccc',padding:'4px 8px',background:'#e0e0e0',fontWeight:'bold'};
const td = {border:'1px solid #ccc',padding:'4px 8px'};

function patientNeedsOperation(patient) {
  if (patient?.outcome?.opNeeded === true) return true;
  const plannedSurgery = String(patient?.interventions?.Surgery || '').trim().toLocaleLowerCase('sv');
  return Boolean(plannedSurgery && !['ingen', '-', 'nej', 'none'].includes(plannedSurgery));
}

const departmentOptions = {
    // Operationsavdelningar för OP-vyn
    'Norrlands universitetssjukhus_OP': [
      'Cop 1', 'Cop 2', 'Cop 3', 'Thorax op'
    ],
    // Mottagningar för Norrlands universitetssjukhus (för övningsvyn Mottagningar)
    'Norrlands universitetssjukhus_Mottagningar': [
      'Medicinmottagningen',
      'Ortopedmottagningen',
      'Kirurgmottagningen',
      'Hjärt- och kärlmottagningen',
      'STD-mottagningen',
      'Barnmottagningen',
      'Onkologisk mottagning',
      'Gynmottagningen',
      'HAKI- mottagningen',
      'Infektionsmottagningen',
      'Käkkirurgisk mottagning',
      'Neurologmottagningen',
      'Urologmottagningen',
      'Röntgen',
      'Öron-näsa-hals mottagningen',
      'Ögonmottagningen'
    ],
  'Norrlands universitetssjukhus': [
    'Barnavdelning 2',
    'Barnavdelning 3',
    'Barnavdelning 4',
    'BB Antenatalavdelning',
    'Buk och kärlkirurgisk avdelning',
    'Geriatrisk avdelning 1',
    'Geriatrisk avdelning 2',
    'Geriatrisk avdelning 4',
    'Hand- Plastik- Ögon avdelning',
    'Hjärt- och ryggmärgsskaderehab',
    'Hjärtintensvvårdsavdelning',
    'Infektionsavdelning',
    'Intensivvårdsavdelning',
    'Intermediärvårdsavdelning',
    'Kardiologisk avdelning',
    'Kardiologisk utredningsavdelning',
    'Kirurgisk akutvårdsavdelning',
    'Medicincentrum specialistvårdsavdelning',
    'Medicinsk akutvårdsavdelning',
    'Neuro- och strokerehabilitering',
    'Neurokirurgisk avdelning',
    'Neurokirurgisk intensivvårdsavdelning',
    'Neurologisk avdelning',
    'Onkologavdelning CDE',
    'Onkologavdelning Hematolog',
    'Operation',
    'Ortopedavdelning',
    'Strokecenter avdelning',
    'Thorax intermediärvårdsavdelning',
    'Thoraxavdelning',
    'Thoraxintensiv vårdavdelning',
    'Thoraxintermediär',
    'Urologisk och gynekologisk avdelning',
    'Öron- näsa- Hals avdelning'
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
    'Ortopedavdelning',
    'Operation'
  ],
  'Lycksele lasarett': [
    'BB- Förlossning- Gyn avdelning',
    'Kirurgi- Ortopedi avdelning',
    'Medicinsk avdelning',
    'Rehabilitering- Strokeavdelning',
    'IVA- Postoperativavdelning',
    'Operation'
  ]
};

function getDepartmentCategory(department) {
  const name = department.toLocaleLowerCase('sv');
  if (name.includes('neuro') || name.includes('stroke') || name.includes('öron') || name.includes('ryggmärg')) return 'Neuro- huvud- halscentrum Umeå';
  if (name.includes('barn')) return 'Barn- och ungdomscentrum';
  if (name.includes('cancer') || name.includes('onkolog')) return 'Cancercentrum Västerbotten';
  if (name.includes('hjärt') || name.includes('kardiolog') || name.includes('thorax')) return 'Hjärtcentrum Umeå';
  if (
    name.includes('anestesi') ||
    name === 'operation' ||
    name.includes('intensivvårdsavdelning') ||
    name.includes('intermediärvårdsavdelning')
  ) return 'Centrum för Anestesi och operation';
  if (name.includes('urolog')) return 'Kirurgcentrum Umeå';
  if (name.includes('bb') || name.includes('gyn') || name.includes('förloss')) return 'Centrum för obstetrik och gynekologi';
  if (name.includes('geriatr')) return 'Geriatriskt centrum Umeå';
  if (name.includes('hand') || name.includes('plastik') || name.includes('ögon')) return 'Hand- och plastikkirurgiskt centrum';
  if (name.includes('infektion')) return 'Infektionsklinik Umeå';
  if (name.includes('kirurg') || name.includes('urolog')) return 'Kirurgcentrum Umeå';
  if (name.includes('medicin')) return 'Medicincentrum Umeå';
  if (name.includes('ortoped')) return 'Ortopedi Umeå';
  return 'Övriga avdelningar';
}

function getDepartmentRowOrder(department, category) {
  const name = department.toLocaleLowerCase('sv');
  const compactName = name.replace(/[\s-]+/g, '');
  const orderByCategory = {
    'Barn- och ungdomscentrum': [
      name.includes('barnavdelning 2') ? 0 : -1,
      name.includes('barnavdelning 3') ? 1 : -1,
      name.includes('barnavdelning 4') ? 2 : -1
    ],
    'Centrum för Anestesi och operation': [
      name.includes('intensivvårdsavdelning') ? 0 : -1,
      name.includes('intermediärvårdsavdelning') ? 1 : -1
    ],
    'Centrum för obstetrik och gynekologi': [
      name.includes('bb') || name.includes('förloss') ? 0 : 1
    ],
    'Geriatriskt centrum Umeå': [
      name.includes('avdelning 1') ? 0 : -1,
      name.includes('avdelning 4') ? 1 : -1,
      name.includes('avdelning 2') ? 2 : -1
    ],
    'Hjärtcentrum Umeå': [
      compactName.includes('hjärtintens') ? 0 : -1,
      compactName.includes('kardiologiskutredning') ? 2 : -1,
      compactName.includes('kardiologisk') ? 1 : -1,
      compactName.includes('thoraxavdelning') ? 3 : -1,
      compactName.includes('thoraxintermediärvårdsavdelning') ? 4 : -1,
      compactName.includes('thoraxintensiv') ? 5 : -1,
      compactName.includes('thoraxintermediär') ? 6 : -1
    ],
    'Kirurgcentrum Umeå': [
      name.includes('buk och kärlkirurgisk') ? 0 : -1,
      name.includes('kirurgisk akutvårdsavdelning') ? 1 : -1,
      name.includes('urologisk') ? 2 : -1
    ],
    'Neuro- huvud- halscentrum Umeå': [
      compactName.includes('ryggmärg') ? 0 : -1,
      name.includes('neuro- och stroke') ? 1 : -1,
      name.includes('neurokirurgisk intensivvårdsavdelning') ? 2 : -1,
      name.includes('neurokirurgisk avdelning') ? 3 : -1,
      name.includes('neurologisk avdelning') ? 4 : -1,
      name.includes('strokecenter') ? 5 : -1,
      name.includes('öron') ? 6 : -1
    ]
  };
  const priorities = orderByCategory[category] || [];
  const priority = priorities.find(value => value >= 0);
  return priority === undefined ? Number.MAX_SAFE_INTEGER : priority;
}

const DEPARTMENT_CATEGORY_ORDER = [
  'Barn- och ungdomscentrum',
  'Cancercentrum Västerbotten',
  'Centrum för Anestesi och operation',
  'Centrum för obstetrik och gynekologi',
  'Geriatriskt centrum Umeå',
  'Hand- och plastikkirurgiskt centrum',
  'Hjärtcentrum Umeå',
  'Infektionsklinik Umeå',
  'Kirurgcentrum Umeå',
  'Medicincentrum Umeå',
  'Neuro- huvud- halscentrum Umeå',
  'Ortopedi Umeå',
  'Övriga avdelningar'
];

const DEPARTMENT_GROUP_BEDS = {
  'Barn- och ungdomscentrum': 41,
  'Cancercentrum Västerbotten': 34,
  'Centrum för Anestesi och operation': 15,
  'Centrum för obstetrik och gynekologi': 15,
  'Geriatriskt centrum Umeå': 40,
  'Hand- och plastikkirurgiskt centrum': 5,
  'Hjärtcentrum Umeå': 50,
  'Infektionsklinik Umeå': 19,
  'Kirurgcentrum Umeå': 40,
  'Medicincentrum Umeå': 33,
  'Neuro- huvud- halscentrum Umeå': 61,
  'Ortopedi Umeå': 18
};

export default function WindowTab() {
    // POSTOP/DKE tab state
    const [postopTab, setPostopTab] = useState('POSTOP');
    // Vald patient för detaljvy (klick i akutmottagningens patienttabell)
    const [selectedPatientDetail, setSelectedPatientDetail] = useState(null);
    const [operationTransferNoticePatientId, setOperationTransferNoticePatientId] = useState(null);
    useEffect(() => {
      if (!operationTransferNoticePatientId) return undefined;
      const timeout = setTimeout(() => setOperationTransferNoticePatientId(null), 2500);
      return () => clearTimeout(timeout);
    }, [operationTransferNoticePatientId]);
    // Flyttvärden för POSTOP akutlista
    const [postopTransferValues, setPostopTransferValues] = useState([]);
  // Clock state for synced time, läs från localStorage eller default till 00:00
  const [clock, setClock] = useState(() => {
    return localStorage.getItem('simTime') || '00:00';
  });
  const [simulationEnvironment, setSimulationEnvironment] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('simulationEnvironment') || '{}');
    } catch {
      return {};
    }
  });
  const weatherPresentation = getWeatherPresentation(simulationEnvironment.weather);
  // State for transfer values in Patienter IN
  const [transferValues, setTransferValues] = useState([]);
  const params = new URLSearchParams(window.location.search);
  const title = params.get('title') || '';
  const selectedHospital = params.get('hospital') || 'Norrlands universitetssjukhus';
  const [activeDep, setActiveDep] = useState(null);

  let initialPatients = [];
  if (title === 'Akutmottagning') {
    try {
      const akut = JSON.parse(localStorage.getItem('akutPatients') || '{}');
      initialPatients = akut[selectedHospital] || [];
    } catch {}
  }
  const [patients, setPatients] = useState(initialPatients);
  const [acutePatientSort, setAcutePatientSort] = useState({ key: null, direction: 'asc' });
  // Paratus-patienter
  const [paratusPatients, setParatusPatients] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('paratusPatients') || '[]');
    } catch {
      return [];
    }
  });
  // Avdelningslistor: { avdelningsnamn: [patienter] }
  // Läs in från localStorage vid start
  const [departmentPatients, setDepartmentPatients] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('departmentPatients') || '{}');
    } catch {
      return {};
    }
  });
  const [departmentOccupancyLevel, setDepartmentOccupancyLevel] = useState(() => (
    localStorage.getItem('departmentOccupancyLevel') || ''
  ));
  const [collapsedDepartmentGroups, setCollapsedDepartmentGroups] = useState({});
  const [movedPatientIds, setMovedPatientIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('movedPatientIds') || '[]');
    } catch {
      return [];
    }
  });

  // Ta emot postMessage från huvudfönstret
  useEffect(() => {
    function handleMsg(e) {
      if (e.data && e.data.type === 'akutSync') {
        setPatients((e.data.akutPatients && e.data.akutPatients[selectedHospital]) || []);
      }
      if (e.data && e.data.type === 'resetAll') {
        setPatients([]);
        setDepartmentPatients({});
        setMovedPatientIds([]);
        setParatusPatients([]);
      }
      if (e.data && e.data.type === 'simTime') {
        setClock(e.data.simTime);
      }
      if (e.data && e.data.type === 'simulationEnvironment') {
        setSimulationEnvironment(e.data.simulationEnvironment || {});
      }
      if (e.data && e.data.type === 'departmentOccupancyUpdate') {
        setDepartmentOccupancyLevel(e.data.departmentOccupancyLevel || '');
        if (e.data.departmentPatients) setDepartmentPatients(e.data.departmentPatients);
      }
    }
    window.addEventListener('message', handleMsg);
    
    // Lyssna på paratusUpdated-event
    function handleParatusUpdate() {
      try {
        const paratus = JSON.parse(localStorage.getItem('paratusPatients') || '[]');
        setParatusPatients(paratus);
      } catch {}
    }
    function handleDepartmentPatientsUpdate(event) {
      if (event.detail?.departmentPatients) {
        setDepartmentPatients(event.detail.departmentPatients);
      }
    }
    window.addEventListener('paratusUpdated', handleParatusUpdate);
    window.addEventListener('departmentPatientsUpdated', handleDepartmentPatientsUpdate);
    function handleStorage(e) {
      if (e.key === 'simTime') {
        setClock(e.newValue || '00:00');
      }
      if (e.key === 'simulationEnvironment') {
        try {
          setSimulationEnvironment(JSON.parse(e.newValue || '{}'));
        } catch {
          setSimulationEnvironment({});
        }
      }
      if (e.key === 'paratusPatients') {
        try {
          setParatusPatients(JSON.parse(e.newValue || '[]'));
        } catch {}
      }
      if (e.key === 'akutPatients') {
        try {
          const akut = JSON.parse(e.newValue || '{}');
          setPatients(akut[selectedHospital] || []);
        } catch {}
      }
      if (e.key === 'departmentPatients') {
        try {
          setDepartmentPatients(JSON.parse(e.newValue || '{}'));
        } catch {}
      }
      if (e.key === 'departmentOccupancyLevel') {
        setDepartmentOccupancyLevel(e.newValue || '');
      }
      if (e.key === 'movedPatientIds') {
        try {
          setMovedPatientIds(JSON.parse(e.newValue || '[]'));
        } catch {}
      }
      // Om alla är nollställda, töm även akutmottagningens patienter
      if (
        (e.key === 'departmentPatients' || e.key === 'movedPatientIds' || e.key === 'akutPatients') &&
        localStorage.getItem('departmentPatients') === null &&
        localStorage.getItem('movedPatientIds') === null &&
        localStorage.getItem('akutPatients') === null
      ) {
        setPatients([]);
      }
    }
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('message', handleMsg);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('paratusUpdated', handleParatusUpdate);
      window.removeEventListener('departmentPatientsUpdated', handleDepartmentPatientsUpdate);
    };
  }, [selectedHospital]);

  // Hantera ändring av förflyttning för en patient
  function handleTransferChange(patientIndex, value) {
    setOperationTransferNoticePatientId(null);
    setPatients(pats => pats.map((p, i) => i === patientIndex ? { ...p, transfer: value } : p));
  }

  // Namnlistor för personal (läkare/sjuksköterskor akuten, kirurger, anestesiläkare, IVA-sköterskor m.m.)
  const [allHospitalStaff, setAllHospitalStaff] = useState({ doctors: [], nurses: [], surgeons: [], anesthesiologists: [], ivaNurses: [], ivaAssistants: [] });
  // Antal av respektive personalkategori som är inställt i kontrollpanelen
  const [staffCounts, setStaffCounts] = useState(() => {
    try {
      const cfg = JSON.parse(localStorage.getItem('hospitalPersonnelConfig') || '{}');
      return {
        akutläkare: cfg.akutläkare ?? 4,
        akutsjuksköterskor: cfg.akutsjuksköterskor ?? 4,
        kirurger: cfg.kirurger ?? 1,
        ortopeder: cfg.ortopeder ?? 1,
        narkoslakare: cfg.narkoslakare ?? 2,
        ivaskoterskor: cfg.ivaskoterskor ?? 4,
        usk_iva: cfg.usk_iva ?? 4
      };
    } catch {
      return { akutläkare: 4, akutsjuksköterskor: 4, kirurger: 1, ortopeder: 1, narkoslakare: 2, ivaskoterskor: 4, usk_iva: 4 };
    }
  });
  useEffect(() => {
    function loadPersonnel() {
      fetch(`/hospital_personnel.json?updated=${Date.now()}`)
      .then(res => res.json())
      .then(data => {
        const personnel = Array.isArray(data.personnel) ? data.personnel : [];
        const fullName = p => `${p.firstName} ${p.lastName}`;
        setAllHospitalStaff({
          doctors: personnel.filter(p => p.category === 'Akutläkare').map(fullName),
          nurses: personnel.filter(p => p.category === 'Akutsjuksköterskor').map(fullName),
          surgeons: personnel.filter(p => p.category === 'Kirurger' || p.category === 'Ortopeder').map(fullName),
          anesthesiologists: personnel.filter(p => p.category === 'Anestesiläkare').map(fullName),
          ivaNurses: personnel.filter(p => p.category === 'IVA-sköterskor').map(fullName),
          ivaAssistants: personnel.filter(p => p.category === 'Undersköterskor IVA').map(fullName)
        });
      })
      .catch(() => {});
    }
    loadPersonnel();
    window.addEventListener('hospitalPersonnelRosterChanged', loadPersonnel);
    function handlePersonnelConfigChange(e) {
      if (e.key === 'hospitalPersonnelConfig') {
        try {
          const cfg = JSON.parse(e.newValue || '{}');
          setStaffCounts({
            akutläkare: cfg.akutläkare ?? 4,
            akutsjuksköterskor: cfg.akutsjuksköterskor ?? 4,
            kirurger: cfg.kirurger ?? 1,
            ortopeder: cfg.ortopeder ?? 1,
            narkoslakare: cfg.narkoslakare ?? 2,
            ivaskoterskor: cfg.ivaskoterskor ?? 4,
            usk_iva: cfg.usk_iva ?? 4
          });
        } catch {}
      }
    }
    window.addEventListener('storage', handlePersonnelConfigChange);
    return () => {
      window.removeEventListener('storage', handlePersonnelConfigChange);
      window.removeEventListener('hospitalPersonnelRosterChanged', loadPersonnel);
    };
  }, []);

  // Begränsa namnlistorna till det antal som är inställt i kontrollpanelen
  const hospitalStaff = {
    doctors: allHospitalStaff.doctors.slice(0, staffCounts.akutläkare),
    nurses: allHospitalStaff.nurses.slice(0, staffCounts.akutsjuksköterskor),
    surgeons: allHospitalStaff.surgeons.slice(0, staffCounts.kirurger + staffCounts.ortopeder),
    anesthesiologists: allHospitalStaff.anesthesiologists.slice(0, staffCounts.narkoslakare),
    ivaNurses: allHospitalStaff.ivaNurses.slice(0, staffCounts.ivaskoterskor),
    ivaAssistants: allHospitalStaff.ivaAssistants.slice(0, staffCounts.usk_iva)
  };

  // Tilldela läkare/sjuksköterska till en patient på akutmottagningen
  function handleAssignStaff(patientIndex, field, value) {
    setPatients(pats => {
      const updated = pats.map((p, i) => {
        if (i !== patientIndex) return p;
        if (field !== 'team') return { ...p, [field]: value };

        const teamIndex = Number(value.match(/^Team ([1-4])$/)?.[1]) - 1;
        return {
          ...p,
          team: value,
          doctor: hospitalStaff.doctors[teamIndex] || '',
          nurse: hospitalStaff.nurses[teamIndex] || ''
        };
      });
      persistAkutPatients(updated);
      return updated;
    });
  }

  // Pågående vårdåtgärder på akutmottagningen: { [patientId]: { activities, medications, durationMinutes, startMinutes } }
  const [careTasks, setCareTasks] = useState(() => {
    try {
      const all = JSON.parse(localStorage.getItem('akutCareTasks') || '{}');
      return all[selectedHospital] || {};
    } catch {
      return {};
    }
  });

  function persistCareTasks(tasks) {
    try {
      const all = JSON.parse(localStorage.getItem('akutCareTasks') || '{}');
      all[selectedHospital] = tasks;
      localStorage.setItem('akutCareTasks', JSON.stringify(all));
    } catch {}
  }

  function persistAkutPatients(updatedPatients) {
    try {
      const akut = JSON.parse(localStorage.getItem('akutPatients') || '{}');
      akut[selectedHospital] = updatedPatients;
      localStorage.setItem('akutPatients', JSON.stringify(akut));
      window.dispatchEvent(new CustomEvent('akutSync', { detail: { akutPatients: akut } }));
      const sessionAuth = JSON.parse(localStorage.getItem('flowsimSessionAuth') || 'null');
      if (sessionAuth?.sessionId && sessionAuth.sessionId !== 'ÖPPEN') {
        fetch(`/api/sessions/${encodeURIComponent(sessionAuth.sessionId)}/acute-patients`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ acutePatients: akut })
        }).catch(() => {});
      }
    } catch {}
  }

  useEffect(() => {
    if (title !== 'Akutmottagning' || patients.length < 2) return;
    let initialPatientIds = [];
    try {
      initialPatientIds = JSON.parse(localStorage.getItem('acuteInitialCensusIds') || '[]');
    } catch {}
    const startTime = localStorage.getItem('acuteSimulationStartTime') || patients[0]?.startTime || clock;
    const repairedPatients = repairInitialAcuteStartTimes(patients, initialPatientIds, startTime);
    if (repairedPatients !== patients) {
      setPatients(repairedPatients);
      persistAkutPatients(repairedPatients);
    }
  }, [patients, title, selectedHospital, clock]);

  // Om automatisering av respektive vy är påslagen (styrs från kontrollpanelen)
  const [automation, setAutomation] = useState(() => {
    try {
      const automatedViews = JSON.parse(localStorage.getItem('automatedViews') || '{}');
      return {
        Akutmottagning: automatedViews.Akutmottagning || false,
        Operation: automatedViews.Operation || false,
        Intensivvard: automatedViews.Intensivvard || false
      };
    } catch {
      return { Akutmottagning: false, Operation: false, Intensivvard: false };
    }
  });
  useEffect(() => {
    function checkAutomation(e) {
      if (e && e.key && e.key !== 'automatedViews') return;
      try {
        const automatedViews = JSON.parse(localStorage.getItem('automatedViews') || '{}');
        setAutomation({
          Akutmottagning: automatedViews.Akutmottagning || false,
          Operation: automatedViews.Operation || false,
          Intensivvard: automatedViews.Intensivvard || false
        });
      } catch {}
    }
    window.addEventListener('storage', checkAutomation);
    window.addEventListener('automatedViewsChanged', checkAutomation);
    return () => {
      window.removeEventListener('storage', checkAutomation);
      window.removeEventListener('automatedViewsChanged', checkAutomation);
    };
  }, []);
  const akutAutomationEnabled = automation.Akutmottagning;

  // Tilldela automatiskt läkare och sjuksköterska till patienter som saknar det, om automatiseringen är på.
  // Läkare/sjuksköterskor på akutmottagningen kan vara ansvariga för flera patienter samtidigt, så ingen upptagen-kontroll behövs här.
  useEffect(() => {
    if (title !== 'Akutmottagning') return;
    if (!akutAutomationEnabled) return;
    if (hospitalStaff.doctors.length === 0 || hospitalStaff.nurses.length === 0) return;
    let doctorIdx = 0;
    let nurseIdx = 0;
    let changed = false;
    const updated = patients.map(p => {
      if (p.careDone || (p.doctor && p.nurse)) return p;
      const doctor = p.doctor || hospitalStaff.doctors[doctorIdx++ % hospitalStaff.doctors.length];
      const nurse = p.nurse || hospitalStaff.nurses[nurseIdx++ % hospitalStaff.nurses.length];
      changed = true;
      return { ...p, doctor, nurse };
    });
    if (changed) {
      setPatients(updated);
      persistAkutPatients(updated);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patients, title, akutAutomationEnabled, allHospitalStaff, staffCounts]);


  // Starta automatisk vård så snart både läkare och sjuksköterska är tilldelade en patient
  // (redan pågående vårdåtgärder slutförs alltid, oavsett om automatiseringen är av)
  useEffect(() => {
    if (title !== 'Akutmottagning') return;
    if (!akutAutomationEnabled) return;
    let tasksChanged = false;
    const updatedTasks = { ...careTasks };
    patients.forEach(p => {
      if (p.doctor && p.nurse && !p.careDone && !updatedTasks[p.id]) {
        const care = determineAkutCare(p);
        if (care) {
          updatedTasks[p.id] = {
            ...care,
            startMinutes: timeToMinutes(clock),
            doctor: p.doctor,
            nurse: p.nurse
          };
          tasksChanged = true;
        }
      }
    });
    if (tasksChanged) {
      setCareTasks(updatedTasks);
      persistCareTasks(updatedTasks);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patients, title, akutAutomationEnabled]);

  // Följ den simulerade tiden - avsluta vårdåtgärder när deras tid har löpt ut
  useEffect(() => {
    if (title !== 'Akutmottagning') return;
    const activeIds = Object.keys(careTasks);
    if (activeIds.length === 0) return;
    const nowMinutes = timeToMinutes(clock);
    const remainingTasks = { ...careTasks };
    let tasksChanged = false;
    let patientsChanged = false;

    const updatedPatients = patients.map(p => {
      const task = careTasks[p.id];
      if (!task) return p;
      if (!p.doctor || !p.nurse || p.doctor !== task.doctor || p.nurse !== task.nurse) {
        delete remainingTasks[p.id];
        tasksChanged = true;
        return p;
      }
      let elapsed = nowMinutes - task.startMinutes;
      if (elapsed < 0) elapsed += 1440; // dygnsskifte
      if (elapsed >= task.durationMinutes) {
        // Vårdåtgärden är klar - dokumentera i patientens journal
        delete remainingTasks[p.id];
        tasksChanged = true;
        patientsChanged = true;
        const existingActivities = Array.isArray(p.activities) ? p.activities : [];
        const existingMedications = Array.isArray(p.medications) ? p.medications : [];
        return {
          ...p,
          activities: [...new Set([...existingActivities, ...task.activities])],
          medications: [...new Set([...existingMedications, ...task.medications])],
          treatment: `${task.activities.join(', ')} (klar kl ${clock})`,
          careDone: true
        };
      }
      return p;
    });

    if (tasksChanged) {
      setCareTasks(remainingTasks);
      persistCareTasks(remainingTasks);
    }
    if (patientsChanged) {
      setPatients(updatedPatients);
      persistAkutPatients(updatedPatients);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clock, title]);

  // Beräkna hur många minuter som återstår av en pågående vårdåtgärd för en patient
  function getCareRemainingMinutes(patientId) {
    const task = careTasks[patientId];
    if (!task) return null;
    const nowMinutes = timeToMinutes(clock);
    let elapsed = nowMinutes - task.startMinutes;
    if (elapsed < 0) elapsed += 1440;
    return Math.max(0, task.durationMinutes - elapsed);
  }

  function getAcuteSortValue(patient, key) {
    switch (key) {
      case 'priority': return patient.triage?.emergencyDept || '';
      case 'startTime': return patient.startTime || '';
      case 'location': return patient.location || '';
      case 'personnummer': return patient.personnummer || '';
      case 'name': return `${patient.name?.name || patient.name?.fornamn || patient.name || ''} ${patient.surname || ''}`.trim();
      case 'mechanism': return patient.mechanism || '';
      case 'activities': return Array.isArray(patient.activities) ? patient.activities.join(', ') : '';
      case 'team': return patient.team || '';
      case 'doctor': return patient.doctor || '';
      case 'nurse': return patient.nurse || '';
      case 'careStatus': {
        const remaining = getCareRemainingMinutes(patient.id);
        return remaining !== null ? remaining : patient.careDone ? 'Vård klar' : patient.doctor && patient.nurse ? 'Väntar' : '';
      }
      case 'transfer': return patient.transfer || '';
      case 'age': {
        if (Number.isFinite(Number(patient.age)) && Number(patient.age) > 0) return Number(patient.age);
        const birthYear = Number(String(patient.personnummer || '').slice(0, 4));
        return Number.isFinite(birthYear) && birthYear > 0 ? 2025 - birthYear : '';
      }
      case 'referral': return patient.referral || '';
      case 'patientType': return patient.patientType || '';
      case 'arrivalSource': {
        const source = String(patient.arrivalSource || '').toLocaleLowerCase('sv');
        if (source.includes('ambulans')) return 'ambulans';
        if (source.includes('egen') || source.includes('spontan')) return 'egen transport';
        return /trafikolycka|skott|explosion|brännskada|stickskada|multitrauma|skadeplats|masskade|hjärtstopp|drunkning|brand|krosskada|klämning|våld|masskrock/i.test(patient.mechanism || '')
          ? 'ambulans'
          : 'egen transport';
      }
      case 'cause': return patient.cause || '';
      case 'medicalUnit': return patient.medicalUnit || '';
      default: return '';
    }
  }

  function handleAcuteSort(key) {
    setAcutePatientSort(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  }

  function renderAcuteSortHeader(label, key, style = th) {
    const active = acutePatientSort.key === key;
    return (
      <th
        key={key}
        style={{...style,cursor:'pointer',userSelect:'none'}}
        aria-sort={active ? (acutePatientSort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
        onClick={() => handleAcuteSort(key)}
        title={`Sortera ${label}`}
      >
        {label}{active ? (acutePatientSort.direction === 'asc' ? ' ▲' : ' ▼') : ''}
      </th>
    );
  }

  const sortedAcutePatients = patients
    .map((patient, originalIndex) => ({ patient, originalIndex }))
    .sort((left, right) => {
      if (!acutePatientSort.key) return left.originalIndex - right.originalIndex;
      const leftValue = getAcuteSortValue(left.patient, acutePatientSort.key);
      const rightValue = getAcuteSortValue(right.patient, acutePatientSort.key);
      if (acutePatientSort.key === 'team') {
        const leftUnassigned = !String(leftValue).trim();
        const rightUnassigned = !String(rightValue).trim();
        if (leftUnassigned !== rightUnassigned) return leftUnassigned ? 1 : -1;
        if (leftUnassigned) return left.originalIndex - right.originalIndex;
        const leftTeamNumber = Number(String(leftValue).match(/\d+/)?.[0]);
        const rightTeamNumber = Number(String(rightValue).match(/\d+/)?.[0]);
        const teamComparison = leftTeamNumber - rightTeamNumber;
        if (teamComparison !== 0) {
          return acutePatientSort.direction === 'asc' ? teamComparison : -teamComparison;
        }
        return left.originalIndex - right.originalIndex;
      }
      if (acutePatientSort.key === 'mechanism') {
        const leftNumbers = String(leftValue).match(/\d+/g)?.map(Number) || [];
        const rightNumbers = String(rightValue).match(/\d+/g)?.map(Number) || [];
        if (Boolean(leftNumbers.length) !== Boolean(rightNumbers.length)) return leftNumbers.length ? -1 : 1;
        for (let index = 0; index < leftNumbers.length; index += 1) {
          if (rightNumbers[index] === undefined) break;
          if (leftNumbers[index] !== rightNumbers[index]) {
            const numericComparison = leftNumbers[index] - rightNumbers[index];
            return acutePatientSort.direction === 'asc' ? numericComparison : -numericComparison;
          }
        }
        if (leftNumbers.length > 0) {
          if (leftNumbers.length !== rightNumbers.length) {
            const lengthComparison = leftNumbers.length - rightNumbers.length;
            return acutePatientSort.direction === 'asc' ? lengthComparison : -lengthComparison;
          }
          const textComparison = String(leftValue).localeCompare(String(rightValue), 'sv', { sensitivity: 'base' });
          return textComparison === 0 ? left.originalIndex - right.originalIndex : textComparison;
        }
      }
      const comparison = typeof leftValue === 'number' && typeof rightValue === 'number'
        ? leftValue - rightValue
        : String(leftValue).localeCompare(String(rightValue), 'sv', { numeric: true, sensitivity: 'base' });
      return comparison === 0
        ? left.originalIndex - right.originalIndex
        : acutePatientSort.direction === 'asc' ? comparison : -comparison;
    });

  function persistDepartmentPatients(updated) {
    try {
      const serialized = JSON.stringify(updated);
      localStorage.setItem('departmentPatients', serialized);
      window.dispatchEvent(new CustomEvent('departmentPatientsUpdated', {
        detail: { departmentPatients: updated }
      }));
      const sessionAuth = JSON.parse(localStorage.getItem('flowsimSessionAuth') || 'null');
      if (sessionAuth?.sessionId && sessionAuth.sessionId !== 'ÖPPEN') {
        fetch(`/api/sessions/${encodeURIComponent(sessionAuth.sessionId)}/departments`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ departmentPatients: updated })
        }).catch(() => {});
      }
    } catch {}
  }

  // --- Automatisering: Operation ---
  const [opCareTasks, setOpCareTasks] = useState(() => {
    try {
      const all = JSON.parse(localStorage.getItem('opCareTasks') || '{}');
      return all[selectedHospital] || {};
    } catch {
      return {};
    }
  });
  function persistOpCareTasks(tasks) {
    try {
      const all = JSON.parse(localStorage.getItem('opCareTasks') || '{}');
      all[selectedHospital] = tasks;
      localStorage.setItem('opCareTasks', JSON.stringify(all));
    } catch {}
  }
  function handleAssignOPStaff(patientId, field, value) {
    setDepartmentPatients(prev => {
      const list = prev['OP'] || [];
      const updated = { ...prev, OP: list.map(p => p.id === patientId ? { ...p, [field]: value } : p) };
      persistDepartmentPatients(updated);
      return updated;
    });
  }

  // Tilldela automatiskt kirurg och anestesiläkare till patienter i OP-akutlistan som saknar det, om automatiseringen är på.
  // Kirurger/anestesiläkare kan bara operera en patient åt gången - de får inte tilldelas en ny patient om de redan är
  // upptagna (antingen mitt i en pågående operation, eller redan reserverade till en annan väntande patient).
  useEffect(() => {
    if (title !== 'OP') return;
    if (!automation.Operation) return;
    const opList = departmentPatients['OP'] || [];
    if (opList.length === 0) return;
    if (hospitalStaff.surgeons.length === 0 || hospitalStaff.anesthesiologists.length === 0) return;
    const busySurgeons = new Set([
      ...Object.values(opCareTasks).map(t => t.surgeon).filter(Boolean),
      ...opList.filter(p => p.surgeon && !p.opDone).map(p => p.surgeon)
    ]);
    const busyAnesth = new Set([
      ...Object.values(opCareTasks).map(t => t.anesthesiologist).filter(Boolean),
      ...opList.filter(p => p.anesthesiologist && !p.opDone).map(p => p.anesthesiologist)
    ]);
    const availableSurgeons = hospitalStaff.surgeons.filter(s => !busySurgeons.has(s));
    const availableAnesth = hospitalStaff.anesthesiologists.filter(a => !busyAnesth.has(a));
    let changed = false;
    const updatedList = opList.map(p => {
      if (p.opDone || (p.surgeon && p.anesthesiologist)) return p;
      if (availableSurgeons.length === 0 || availableAnesth.length === 0) return p;
      const surgeon = p.surgeon || availableSurgeons.shift();
      const anesthesiologist = p.anesthesiologist || availableAnesth.shift();
      changed = true;
      return { ...p, surgeon, anesthesiologist };
    });
    if (changed) {
      setDepartmentPatients(prev => {
        const updated = { ...prev, OP: updatedList };
        persistDepartmentPatients(updated);
        return updated;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentPatients, title, automation.Operation, opCareTasks, allHospitalStaff]);

  // Operationssalar tillgängliga för automatisk schemaläggning, per sjukhus
  const NORRLANDS_SAL_GROUPS = {
    'Cop 1': ['Sal 4', 'Sal 5', 'Sal 8', 'Sal 10', 'Sal 11', 'Sal 12', 'Sal 14'],
    'Cop 2': ['Sal 7', 'Sal 9', 'Sal 20', 'Sal 21', 'Sal 22', 'Sal 23', 'Sal 24', 'Sal 25', 'Sal 26', 'Sal 28', 'Sal 29', 'HplOP', 'INR'],
    'Cop 3': ['Sal 13', 'Sal 31', 'Sal 32', 'Sal 33', 'Sal 34', 'Sal 35', 'Sal 36', 'Sal 37', 'Kir Beh 3', 'IR 1', 'IR 2'],
    'Thorax op': ['Sal 1', 'Sal 2', 'Sal 3', 'Sal 6', 'PCI 1', 'PCI 2']
  };
  function getSalPool(hospital, activeDepartment) {
    if (hospital === 'Norrlands universitetssjukhus') {
      return activeDepartment ? NORRLANDS_SAL_GROUPS[activeDepartment] || [] : [];
    }
    return ['Sal 1', 'Sal 2', 'Sal 3', 'Sal 4'];
  }
  // Hitta en ledig sal och starttimme (3 timmars block) från och med angiven timme
  function findFreeSalSlot(deptPatients, salPool, startHour) {
    for (let h = Math.max(0, startHour); h <= 21; h++) {
      for (const sal of salPool) {
        const salData = deptPatients[sal] || {};
        if (!salData[h] && !salData[h + 1] && !salData[h + 2]) {
          return { sal, hour: h };
        }
      }
    }
    return null;
  }

  // Starta operation och placera patienten i en ledig operationssal så snart kirurg och anestesiläkare är tilldelade
  useEffect(() => {
    if (title !== 'OP') return;
    if (!automation.Operation) return;
    const opList = departmentPatients['OP'] || [];
    if (opList.length === 0) return;
    const currentHour = Math.floor(timeToMinutes(clock) / 60);
    const salPool = getSalPool(selectedHospital, activeDep);
    if (salPool.length === 0) return;
    let tasksChanged = false;
    let deptChanged = false;
    const updatedTasks = { ...opCareTasks };
    const updated = { ...departmentPatients };
    let remainingOpList = [...opList];

    opList.forEach(p => {
      if (p.surgeon && p.anesthesiologist && !p.opDone && !updatedTasks[p.id]) {
        const care = determineOPCare(p);
        if (!care) return;
        const slot = findFreeSalSlot(updated, salPool, currentHour);
        if (!slot) return; // Ingen ledig sal just nu - försök igen vid nästa tick
        const { sal, hour } = slot;
        updated[sal] = { ...(updated[sal] || {}) };
        updated[sal][hour] = p;
        updated[sal][hour + 1] = p;
        updated[sal][hour + 2] = p;
        remainingOpList = remainingOpList.filter(x => x.id !== p.id);
        updatedTasks[p.id] = { ...care, startMinutes: timeToMinutes(clock), surgeon: p.surgeon, anesthesiologist: p.anesthesiologist, sal };
        tasksChanged = true;
        deptChanged = true;
      }
    });

    if (deptChanged) {
      updated['OP'] = remainingOpList;
      setDepartmentPatients(updated);
      persistDepartmentPatients(updated);
      window.dispatchEvent(new CustomEvent('departmentPatientsUpdated', { detail: { departmentPatients: updated } }));
    }
    if (tasksChanged) {
      setOpCareTasks(updatedTasks);
      persistOpCareTasks(updatedTasks);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentPatients, title, automation.Operation, activeDep, selectedHospital]);

  // Följ simulerad tid - avsluta operationer, dokumentera, tömma salen och flytta patienten till Postoperativ avdelning
  useEffect(() => {
    if (title !== 'OP') return;
    const activeIds = Object.keys(opCareTasks);
    if (activeIds.length === 0) return;
    const nowMinutes = timeToMinutes(clock);
    const remainingTasks = { ...opCareTasks };
    let tasksChanged = false;
    let deptChanged = false;
    const updated = { ...departmentPatients };
    const postopList = updated['Postoperativ avdelning'] ? [...updated['Postoperativ avdelning']] : [];

    activeIds.forEach(patientId => {
      const task = opCareTasks[patientId];
      let elapsed = nowMinutes - task.startMinutes;
      if (elapsed < 0) elapsed += 1440;
      if (elapsed < task.durationMinutes) return;

      // Hitta patienten i salen den placerades i (eller i OP-listan om den aldrig hann placeras)
      let patientObj = null;
      if (task.sal && updated[task.sal]) {
        updated[task.sal] = { ...updated[task.sal] };
        for (const h of Object.keys(updated[task.sal])) {
          if (updated[task.sal][h]?.id === patientId) {
            patientObj = updated[task.sal][h];
            delete updated[task.sal][h];
          }
        }
      }
      if (!patientObj) {
        const opList = updated['OP'] || [];
        patientObj = opList.find(x => x.id === patientId) || null;
        updated['OP'] = opList.filter(x => x.id !== patientId);
      }
      if (!patientObj) {
        delete remainingTasks[patientId];
        tasksChanged = true;
        return;
      }

      delete remainingTasks[patientId];
      tasksChanged = true;
      deptChanged = true;
      const existingActivities = Array.isArray(patientObj.activities) ? patientObj.activities : [];
      const existingMedications = Array.isArray(patientObj.medications) ? patientObj.medications : [];
      postopList.push({
        ...patientObj,
        activities: [...new Set([...existingActivities, ...task.activities])],
        medications: [...new Set([...existingMedications, ...task.medications])],
        treatment: `${task.activities.join(', ')} (klar kl ${clock})`,
        opDone: true
      });
    });

    if (deptChanged) {
      updated['Postoperativ avdelning'] = postopList;
      setDepartmentPatients(updated);
      persistDepartmentPatients(updated);
      window.dispatchEvent(new CustomEvent('departmentPatientsUpdated', { detail: { departmentPatients: updated } }));
    }
    if (tasksChanged) {
      setOpCareTasks(remainingTasks);
      persistOpCareTasks(remainingTasks);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clock, title]);

  function getOpCareRemainingMinutes(patientId) {
    const task = opCareTasks[patientId];
    if (!task) return null;
    const nowMinutes = timeToMinutes(clock);
    let elapsed = nowMinutes - task.startMinutes;
    if (elapsed < 0) elapsed += 1440;
    return Math.max(0, task.durationMinutes - elapsed);
  }

  // --- Automatisering: Intensivvård ---
  const [ivaCareTasks, setIvaCareTasks] = useState(() => {
    try {
      const all = JSON.parse(localStorage.getItem('ivaCareTasks') || '{}');
      return all[selectedHospital] || {};
    } catch {
      return {};
    }
  });
  function persistIvaCareTasks(tasks) {
    try {
      const all = JSON.parse(localStorage.getItem('ivaCareTasks') || '{}');
      all[selectedHospital] = tasks;
      localStorage.setItem('ivaCareTasks', JSON.stringify(all));
    } catch {}
  }
  function handleAssignIvaStaff(patientId, field, value) {
    setDepartmentPatients(prev => {
      const list = prev['IVA_AKUTLISTA'] || [];
      const updated = { ...prev, IVA_AKUTLISTA: list.map(p => p.id === patientId ? { ...p, [field]: value } : p) };
      persistDepartmentPatients(updated);
      return updated;
    });
  }

  // Tilldela automatiskt IVA-läkare, IVA-sköterska och undersköterska IVA till patienter som saknar det, om automatiseringen är på.
  // Personal på IVA kan vara ansvarig för flera patienter samtidigt, så ingen upptagen-kontroll behövs här.
  useEffect(() => {
    if (title !== 'IVA') return;
    if (!automation.Intensivvard) return;
    const ivaList = departmentPatients['IVA_AKUTLISTA'] || [];
    if (ivaList.length === 0) return;
    if (hospitalStaff.anesthesiologists.length === 0 || hospitalStaff.ivaNurses.length === 0) return;
    let doctorIdx = 0;
    let nurseIdx = 0;
    let assistantIdx = 0;
    const hasAssistants = hospitalStaff.ivaAssistants.length > 0;
    let changed = false;
    const updatedList = ivaList.map(p => {
      if (p.ivaCareDone || (p.ivaDoctor && p.ivaNurse && (!hasAssistants || p.ivaAssistant))) return p;
      const ivaDoctor = p.ivaDoctor || hospitalStaff.anesthesiologists[doctorIdx++ % hospitalStaff.anesthesiologists.length];
      const ivaNurse = p.ivaNurse || hospitalStaff.ivaNurses[nurseIdx++ % hospitalStaff.ivaNurses.length];
      const ivaAssistant = p.ivaAssistant || (hasAssistants ? hospitalStaff.ivaAssistants[assistantIdx++ % hospitalStaff.ivaAssistants.length] : p.ivaAssistant);
      changed = true;
      return { ...p, ivaDoctor, ivaNurse, ivaAssistant };
    });
    if (changed) {
      setDepartmentPatients(prev => {
        const updated = { ...prev, IVA_AKUTLISTA: updatedList };
        persistDepartmentPatients(updated);
        return updated;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentPatients, title, automation.Intensivvard, allHospitalStaff, staffCounts]);


  // Lediga IVA-platser tillgängliga för automatisk placering
  const IVA_BEDS = ['9:1', '9:2', '9:3', '9:4', '9:5', '9:6', '12:1', '12:2', '12:3', '12:4', '12:5', '12:6', '8', 'Akut', 'Sista vilan'];
  function findFreeIvaBed(deptPatients) {
    const occupied = new Set((deptPatients['IVA'] || []).map(p => p.bed || p.location));
    return IVA_BEDS.find(b => !occupied.has(b)) || null;
  }

  // Starta intensivvård och placera patienten på en ledig IVA-plats så snart IVA-läkare och IVA-sköterska är tilldelade
  useEffect(() => {
    if (title !== 'IVA') return;
    if (!automation.Intensivvard) return;
    const ivaList = departmentPatients['IVA_AKUTLISTA'] || [];
    if (ivaList.length === 0) return;
    let tasksChanged = false;
    let deptChanged = false;
    const updatedTasks = { ...ivaCareTasks };
    const updated = { ...departmentPatients };
    let remainingAkutlista = [...ivaList];
    let ivaBedList = updated['IVA'] ? [...updated['IVA']] : [];

    ivaList.forEach(p => {
      if (p.ivaDoctor && p.ivaNurse && !p.ivaCareDone && !updatedTasks[p.id]) {
        const care = determineIvaCare(p);
        if (!care) return;
        updated['IVA'] = ivaBedList;
        const bed = findFreeIvaBed(updated);
        if (!bed) return; // Ingen ledig plats just nu - försök igen vid nästa tick
        ivaBedList = [...ivaBedList, { ...p, bed }];
        updated['IVA'] = ivaBedList;
        remainingAkutlista = remainingAkutlista.filter(x => x.id !== p.id);
        updatedTasks[p.id] = { ...care, startMinutes: timeToMinutes(clock), ivaDoctor: p.ivaDoctor, ivaNurse: p.ivaNurse, ivaAssistant: p.ivaAssistant };
        tasksChanged = true;
        deptChanged = true;
      }
    });

    if (deptChanged) {
      updated['IVA_AKUTLISTA'] = remainingAkutlista;
      updated['IVA'] = ivaBedList;
      setDepartmentPatients(updated);
      persistDepartmentPatients(updated);
    }
    if (tasksChanged) {
      setIvaCareTasks(updatedTasks);
      persistIvaCareTasks(updatedTasks);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentPatients, title, automation.Intensivvard]);

  // Följ simulerad tid - dokumentera intensivvård när behandlingstiden har löpt ut (patienten stannar kvar på sin IVA-plats)
  useEffect(() => {
    if (title !== 'IVA') return;
    const activeIds = Object.keys(ivaCareTasks);
    if (activeIds.length === 0) return;
    const nowMinutes = timeToMinutes(clock);
    const remainingTasks = { ...ivaCareTasks };
    let tasksChanged = false;
    let listChanged = false;
    const ivaBedList = departmentPatients['IVA'] || [];
    const updatedBedList = ivaBedList.map(p => {
      const task = ivaCareTasks[p.id];
      if (!task) return p;
      let elapsed = nowMinutes - task.startMinutes;
      if (elapsed < 0) elapsed += 1440;
      if (elapsed >= task.durationMinutes) {
        delete remainingTasks[p.id];
        tasksChanged = true;
        listChanged = true;
        const existingActivities = Array.isArray(p.activities) ? p.activities : [];
        const existingMedications = Array.isArray(p.medications) ? p.medications : [];
        return {
          ...p,
          activities: [...new Set([...existingActivities, ...task.activities])],
          medications: [...new Set([...existingMedications, ...task.medications])],
          treatment: `${task.activities.join(', ')} (klar kl ${clock})`,
          ivaCareDone: true
        };
      }
      return p;
    });

    if (listChanged) {
      setDepartmentPatients(prev => {
        const updated = { ...prev, IVA: updatedBedList };
        persistDepartmentPatients(updated);
        return updated;
      });
    }
    if (tasksChanged) {
      setIvaCareTasks(remainingTasks);
      persistIvaCareTasks(remainingTasks);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clock, title]);

  function getIvaCareRemainingMinutes(patientId) {
    const task = ivaCareTasks[patientId];
    if (!task) return null;
    const nowMinutes = timeToMinutes(clock);
    let elapsed = nowMinutes - task.startMinutes;
    if (elapsed < 0) elapsed += 1440;
    return Math.max(0, task.durationMinutes - elapsed);
  }

  // Håll detaljvyn i synk med patientlistan så vårdstatusen uppdateras i realtid
  useEffect(() => {
    if (!selectedPatientDetail) return;
    const updated = patients.find(pt => pt.id === selectedPatientDetail.id);
    if (updated && updated !== selectedPatientDetail) {
      setSelectedPatientDetail(updated);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patients]);

  // Flytta patient till avdelning
  function handleSendToDepartment(patientIndex) {
    const patient = patients[patientIndex];
    if (!patient.transfer) return;
    if (patient.transfer.toLocaleLowerCase('sv') === 'operation' && !patientNeedsOperation(patient)) {
      handleTransferChange(patientIndex, '');
      setOperationTransferNoticePatientId(patient.id);
      return;
    }
    setDepartmentPatients(prev => {
      const dep = patient.transfer;
      // Om patienten skickas till Röntgen, lägg bara till i Röntgen och behåll på akuten
      if (dep && dep.toLowerCase().includes('röntgen')) {
        const updated = { ...prev };
        const prevList = prev[dep] || [];
        if (!prevList.some(p => p.id === patient.id)) {
          updated[dep] = [...prevList, patient];
        }
        persistDepartmentPatients(updated);
        return updated;
      }
      // Annars: ta bort patienten från ALLA avdelningar och lägg till i den nya
      const updated = {};
      for (const key of Object.keys(prev)) {
        updated[key] = Array.isArray(prev[key]) ? prev[key].filter(p => p.id !== patient.id) : prev[key];
      }
      // Lägg till patienten i vald avdelning
      const prevDepList = updated[dep] || [];
      if (!prevDepList.some(p => p.id === patient.id)) {
        updated[dep] = [...prevDepList, patient];
      }
      // Om avdelningen är 'Operation', lägg även till i OP Akutlista
      if (dep && dep.toLowerCase() === 'operation') {
        const prevOpList = updated['OP'] || [];
        if (!prevOpList.some(p => p.id === patient.id)) {
          updated['OP'] = [...prevOpList, patient];
        }
      }
      // Hantera alla IVA/IM/HIA/NIVA/THIMA/THIVA
      const depMap = {
        'Intensivvårdsavdelning': 'IVA',
        'Intermediärvårdsavdelning': 'IM',
        'Hjärtintensvvårdsavdelning': 'HIA',
        'Neurokirurgisk intensivvårdsavdelning': 'NIVA',
        'Thoraxintermediär': 'THIMA',
        'Thoraxintensiv vårdavdelning': 'THIVA',
      };
      // Lägg till i respektive avdelning
      if (depMap[dep]) {
        const key = depMap[dep];
        const prevList = updated[key] || [];
        if (!prevList.some(p => p.id === patient.id)) {
          updated[key] = [...prevList, patient];
        }
        // Lägg även till i IVA_AKUTLISTA om IVA, IM, NIVA, THIVA, THIMA
        const akutDepts = ['IVA','IM','NIVA','THIVA','THIMA'];
        if (akutDepts.includes(key)) {
          const akutList = updated['IVA_AKUTLISTA'] || [];
          if (!akutList.some(p => p.id === patient.id)) {
            updated['IVA_AKUTLISTA'] = [...akutList, patient];
          }
        }
      }
      persistDepartmentPatients(updated);
      return updated;
    });

    // Om patienten INTE skickas till röntgen, ta även bort från akutmottagningen och spara till localStorage
    if (!(patient.transfer && patient.transfer.toLowerCase().includes('röntgen'))) {
      setPatients(prevPatients => {
        const updated = prevPatients.filter((_, i) => i !== patientIndex);
        // Spara till localStorage så det överlever reload
        try {
          const akut = JSON.parse(localStorage.getItem('akutPatients') || '{}');
          akut[selectedHospital] = updated;
          localStorage.setItem('akutPatients', JSON.stringify(akut));
        } catch {}
        return updated;
      });
    }
    // Lägg till id i movedPatientIds
    setMovedPatientIds(ids => {
      const updated = [...ids, patient.id];
      localStorage.setItem('movedPatientIds', JSON.stringify(updated));
      return updated;
    });
  }

  // Tabbar för avdelningar
  let allDeps = departmentOptions[selectedHospital];
  if (title === 'OP' && selectedHospital === 'Norrlands universitetssjukhus') {
    allDeps = departmentOptions['Norrlands universitetssjukhus_OP'];
  } else if (title === 'Mottagningar' && selectedHospital === 'Norrlands universitetssjukhus') {
    allDeps = departmentOptions['Norrlands universitetssjukhus_Mottagningar'];
  }
  const departmentGroups = (allDeps || []).filter(department => (
    !['operation', 'thoraxintermediär'].includes(department.toLocaleLowerCase('sv'))
  )).reduce((groups, department) => {
    const category = getDepartmentCategory(department);
    const group = groups.find(item => item.name === category);
    if (group) group.departments.push(department);
    else groups.push({ name: category, departments: [department] });
    return groups;
  }, []).sort((left, right) => (
    DEPARTMENT_CATEGORY_ORDER.indexOf(left.name) - DEPARTMENT_CATEGORY_ORDER.indexOf(right.name)
  )).map(group => ({
    ...group,
    departments: group.departments.sort((left, right) => (
      getDepartmentRowOrder(left, group.name) - getDepartmentRowOrder(right, group.name)
    ))
  }));

  // Hantera globalt event för att leverera patientobjekt till OPScheduleTable
  useEffect(() => {
    function handleGetPatientById(e) {
      const { patientId, sal, hour } = e.detail;
      const patient = getPatientByIdFromOP(departmentPatients, patientId);
      if (patient) {
        // Skicka patientobjekt till OPScheduleTable
        const dropEvent = new CustomEvent('dropPatientToSal', { detail: { patient, sal, hour } });
        window.dispatchEvent(dropEvent);
      }
    }
    window.addEventListener('getPatientById', handleGetPatientById);
    return () => window.removeEventListener('getPatientById', handleGetPatientById);
  }, [departmentPatients]);

  function returnToExerciseViews() {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({ type: 'returnToExerciseViews' }, window.location.origin);
      window.opener.focus();
      window.close();
      return;
    }
    window.location.assign('/?view=exercises');
  }

  return (
    <div className="flowsim-window-shell" style={{padding:24, fontFamily:'Arial, sans-serif'}}>
      <div className="flowsim-window-back" style={{display:'flex',justifyContent:'flex-start',marginBottom:12}}>
        <button
          type="button"
          onClick={returnToExerciseViews}
          style={{padding:'8px 12px',border:'1px solid #087f91',borderRadius:5,background:'#fff',color:'#075078',fontWeight:600,cursor:'pointer'}}
        >
          ← Tillbaka till övningsvyer
        </button>
      </div>
      {title === 'Prehospital' ? (
        <div style={{width:'100%',height:'calc(100vh - 48px)'}}>
          <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:8}}>
            <h2 style={{margin:0}}>Prehospital</h2>
            <span title={`Utomhus: ${weatherPresentation.label}`} style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:14,color:'#075078',whiteSpace:'nowrap'}}>
              <span aria-hidden="true" style={{fontSize:18}}>{weatherPresentation.icon}</span>
              {weatherPresentation.label}
            </span>
            <span style={{fontFamily:'monospace',fontSize:18,color:'#007acc'}}>{clock}</span>
          </div>
          <MapPanel simTime={clock} />
        </div>
      ) : title === 'Paratus' ? (
        <div>
          <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:8}}>
            <h2 style={{margin:0}}>Paratus - Patienter under transport</h2>
            <span title={`Utomhus: ${weatherPresentation.label}`} style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:14,color:'#075078',whiteSpace:'nowrap'}}>
              <span aria-hidden="true" style={{fontSize:18}}>{weatherPresentation.icon}</span>
              {weatherPresentation.label}
            </span>
            <span style={{fontFamily:'monospace',fontSize:18,color:'#007acc'}}>{clock}</span>
          </div>
          <div style={{marginBottom:16,fontWeight:600,fontSize:16}}>
            Antal patienter: {paratusPatients.length}
          </div>
          {paratusPatients.length === 0 ? (
            <div style={{padding:20,textAlign:'center',color:'#666',fontSize:14}}>
              Inga patienter under transport
            </div>
          ) : (
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
              <thead>
                <tr style={{background:'#e0e0e0'}}>
                  <th style={th}>Personnummer</th>
                  <th style={th}>Namn</th>
                  <th style={th}>Triage</th>
                  <th style={th}>Destination</th>
                  <th style={th}>Fordon</th>
                  <th style={th}>Avresetid</th>
                  <th style={th}>Ankomsttid</th>
                  <th style={th}>Transporttid</th>
                  <th style={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {paratusPatients.map((p, i) => {
                  const triageColor = typeof p.triage === 'object' ? p.triage?.scene : p.triage;
                  const colorMap = {
                    'Röd': '#e53935',
                    'Orange': '#ff9800',
                    'Gul': '#ffd600',
                    'Grön': '#43a047',
                    'Svart': '#222'
                  };
                  const color = colorMap[triageColor] || '#ccc';
                  
                  return (
                    <tr key={p.id || i} style={{background:i%2?'#f9f9f9':'#fff'}}>
                      <td style={td}>{p.personnummer || '-'}</td>
                      <td style={td}>
                        {typeof p.name === 'object' ? (p.name?.name || p.name?.fornamn || 'Patient') : (p.name || 'Patient')}
                      </td>
                      <td style={td}>
                        <span style={{display:'inline-flex',alignItems:'center',gap:6}}>
                          <span style={{display:'inline-block',width:14,height:14,borderRadius:'50%',background:color,border:'1px solid #888'}}></span>
                          {triageColor || '-'}
                        </span>
                      </td>
                      <td style={td}>{p.destinationHospital || '-'}</td>
                      <td style={td}>{p.vehicleType === 'ambulance' ? '🚑 Ambulans' : p.vehicleType === 'helicopterAmbulance' ? '🚁 Helikopter' : '-'}</td>
                      <td style={td}>{p.departureTime || '-'}</td>
                      <td style={td}>{p.expectedArrivalTime || '-'}</td>
                      <td style={td}>{p.transportTime ? `${p.transportTime} min` : '-'}</td>
                      <td style={td}>
                        <span style={{color:'#ff9800',fontWeight:600}}>🚑 Under transport</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : title === 'Katastrofliggare' ? (
        <Katastrofliggare simTime={clock} />
      ) : title === 'LSSL' ? (
        <LSSL simTime={clock} hospital={selectedHospital} />
      ) : (
      <>
      <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:8}}>
        <h2 style={{margin:0}}>
          {title === 'Akutmottagning' && selectedHospital === 'Norrlands universitetssjukhus' && 'Akutmottagning Umeå'}
          {title === 'Akutmottagning' && selectedHospital === 'Skellefteå sjukhus' && 'Akutmottagning Skellefteå'}
          {title === 'Akutmottagning' && selectedHospital === 'Lycksele lasarett' && 'Akutmottagning Lycksele'}
          {title !== 'Akutmottagning' && title}
        </h2>
        <span style={{fontFamily:'monospace',fontSize:18,color:'#007acc'}}>{clock}</span>
        <span title={`Utomhus: ${weatherPresentation.label}`} style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:14,color:'#075078',whiteSpace:'nowrap'}}>
          <span aria-hidden="true" style={{fontSize:18}}>{weatherPresentation.icon}</span>
          {weatherPresentation.label}
        </span>
      </div>
      {title === 'POSTOP' && (
        <>
          <div style={{display:'flex',gap:12,marginBottom:16}}>
            <button
              style={{
                padding:'8px 24px',
                borderRadius:6,
                border: postopTab==='POSTOP' ? '2px solid #1976d2' : '1px solid #ccc',
                background: postopTab==='POSTOP' ? '#e3f2fd' : '#fff',
                fontWeight: postopTab==='POSTOP' ? 'bold' : 'normal',
                cursor:'pointer',
                fontSize:16
              }}
              onClick={()=>setPostopTab('POSTOP')}
            >POSTOP</button>
            <button
              style={{
                padding:'8px 24px',
                borderRadius:6,
                border: postopTab==='DKE' ? '2px solid #1976d2' : '1px solid #ccc',
                background: postopTab==='DKE' ? '#e3f2fd' : '#fff',
                fontWeight: postopTab==='DKE' ? 'bold' : 'normal',
                cursor:'pointer',
                fontSize:16
              }}
              onClick={()=>setPostopTab('DKE')}
            >DKE</button>
          </div>
          {['POSTOP','DKE'].map(tab => postopTab === tab && (
            <div key={tab} style={{padding:16,background:'#fff',borderRadius:8,border:'1px solid #ccc',marginBottom:24}}>
              {/* POSTOP sängrutor */}
              {tab === 'POSTOP' && (
                <div style={{margin:'32px 0'}}>
                  <div style={{
                    display:'grid',
                    gridTemplateColumns:'repeat(10, 110px)',
                    gridTemplateRows:'repeat(4, 80px)',
                    gap:'24px',
                    justifyContent:'center',
                    marginBottom:32
                  }}>
                    {/* Första raden */}
                    <BedBox bed="A:1" patients={departmentPatients['Postoperativ avdelning']||[]} setDepartmentPatients={setDepartmentPatients} department="Postoperativ avdelning" style={{gridColumn:1,gridRow:1}} />
                    <BedBox bed="A:2" patients={departmentPatients['Postoperativ avdelning']||[]} setDepartmentPatients={setDepartmentPatients} department="Postoperativ avdelning" style={{gridColumn:2,gridRow:1}} />
                    <BedBox bed="B:3" patients={departmentPatients['Postoperativ avdelning']||[]} setDepartmentPatients={setDepartmentPatients} department="Postoperativ avdelning" style={{gridColumn:3,gridRow:1}} />
                    <BedBox bed="B:4" patients={departmentPatients['Postoperativ avdelning']||[]} setDepartmentPatients={setDepartmentPatients} department="Postoperativ avdelning" style={{gridColumn:4,gridRow:1}} />
                    <BedBox bed="B:5" patients={departmentPatients['Postoperativ avdelning']||[]} setDepartmentPatients={setDepartmentPatients} department="Postoperativ avdelning" style={{gridColumn:5,gridRow:1}} />
                    <BedBox bed="B:6" patients={departmentPatients['Postoperativ avdelning']||[]} setDepartmentPatients={setDepartmentPatients} department="Postoperativ avdelning" style={{gridColumn:6,gridRow:1}} />
                    <BedBox bed="C:3" patients={departmentPatients['Postoperativ avdelning']||[]} setDepartmentPatients={setDepartmentPatients} department="Postoperativ avdelning" style={{gridColumn:7,gridRow:1}} />
                    <BedBox bed="C:4" patients={departmentPatients['Postoperativ avdelning']||[]} setDepartmentPatients={setDepartmentPatients} department="Postoperativ avdelning" style={{gridColumn:8,gridRow:1}} />
                    <BedBox bed="C:5" patients={departmentPatients['Postoperativ avdelning']||[]} setDepartmentPatients={setDepartmentPatients} department="Postoperativ avdelning" style={{gridColumn:9,gridRow:1}} />
                    <BedBox bed="C:6" patients={departmentPatients['Postoperativ avdelning']||[]} setDepartmentPatients={setDepartmentPatients} department="Postoperativ avdelning" style={{gridColumn:10,gridRow:1}} />
                    {/* Andra raden */}
                    <BedBox bed="A:3" patients={departmentPatients['Postoperativ avdelning']||[]} setDepartmentPatients={setDepartmentPatients} department="Postoperativ avdelning" style={{gridColumn:2,gridRow:2}} />
                    <BedBox bed="B:2" patients={departmentPatients['Postoperativ avdelning']||[]} setDepartmentPatients={setDepartmentPatients} department="Postoperativ avdelning" style={{gridColumn:3,gridRow:2}} />
                    <BedBox bed="B:7" patients={departmentPatients['Postoperativ avdelning']||[]} setDepartmentPatients={setDepartmentPatients} department="Postoperativ avdelning" style={{gridColumn:6,gridRow:2}} />
                    <BedBox bed="C:2" patients={departmentPatients['Postoperativ avdelning']||[]} setDepartmentPatients={setDepartmentPatients} department="Postoperativ avdelning" style={{gridColumn:7,gridRow:2}} />
                    <BedBox bed="C:7" patients={departmentPatients['Postoperativ avdelning']||[]} setDepartmentPatients={setDepartmentPatients} department="Postoperativ avdelning" style={{gridColumn:10,gridRow:2}} />
                    {/* Tredje raden */}
                    <BedBox bed="A:4" patients={departmentPatients['Postoperativ avdelning']||[]} setDepartmentPatients={setDepartmentPatients} department="Postoperativ avdelning" style={{gridColumn:2,gridRow:3}} />
                    <BedBox bed="B:1" patients={departmentPatients['Postoperativ avdelning']||[]} setDepartmentPatients={setDepartmentPatients} department="Postoperativ avdelning" style={{gridColumn:3,gridRow:3}} />
                    <BedBox bed="B:8" patients={departmentPatients['Postoperativ avdelning']||[]} setDepartmentPatients={setDepartmentPatients} department="Postoperativ avdelning" style={{gridColumn:6,gridRow:3}} />
                    <BedBox bed="C:1" patients={departmentPatients['Postoperativ avdelning']||[]} setDepartmentPatients={setDepartmentPatients} department="Postoperativ avdelning" style={{gridColumn:7,gridRow:3}} />
                    <BedBox bed="C:8" patients={departmentPatients['Postoperativ avdelning']||[]} setDepartmentPatients={setDepartmentPatients} department="Postoperativ avdelning" style={{gridColumn:10,gridRow:3}} />
                    {/* Fjärde raden */}
                    <BedBox bed="B:9" patients={departmentPatients['Postoperativ avdelning']||[]} setDepartmentPatients={setDepartmentPatients} department="Postoperativ avdelning" style={{gridColumn:3,gridRow:4}} />
                    <BedBox bed="C:9" patients={departmentPatients['Postoperativ avdelning']||[]} setDepartmentPatients={setDepartmentPatients} department="Postoperativ avdelning" style={{gridColumn:10,gridRow:4}} />
                  </div>
                </div>
              )}
              {tab === 'DKE' && (
                <div style={{margin:'32px 0'}}>
                  <div style={{
                    display:'grid',
                    gridTemplateColumns:'repeat(8, 110px)',
                    gridTemplateRows:'repeat(5, 80px)',
                    gap:'24px',
                    justifyContent:'center',
                    marginBottom:32
                  }}>
                    {/* Rad 1 */}
                    <BedBox bed="A:2" patients={departmentPatients['DKE']||[]} setDepartmentPatients={setDepartmentPatients} department="DKE" style={{gridColumn:1,gridRow:1}} />
                    <BedBox bed="A:3" patients={departmentPatients['DKE']||[]} setDepartmentPatients={setDepartmentPatients} department="DKE" style={{gridColumn:2,gridRow:1}} />
                    <BedBox bed="A:4" patients={departmentPatients['DKE']||[]} setDepartmentPatients={setDepartmentPatients} department="DKE" style={{gridColumn:3,gridRow:1}} />
                    <BedBox bed="A:5" patients={departmentPatients['DKE']||[]} setDepartmentPatients={setDepartmentPatients} department="DKE" style={{gridColumn:4,gridRow:1}} />
                    <BedBox bed="B:2" patients={departmentPatients['DKE']||[]} setDepartmentPatients={setDepartmentPatients} department="DKE" style={{gridColumn:5,gridRow:1}} />
                    <BedBox bed="B:3" patients={departmentPatients['DKE']||[]} setDepartmentPatients={setDepartmentPatients} department="DKE" style={{gridColumn:7,gridRow:1}} />
                    <BedBox bed="B:4" patients={departmentPatients['DKE']||[]} setDepartmentPatients={setDepartmentPatients} department="DKE" style={{gridColumn:8,gridRow:1}} />
                    {/* Rad 2 */}
                    <BedBox bed="A:1" patients={departmentPatients['DKE']||[]} setDepartmentPatients={setDepartmentPatients} department="DKE" style={{gridColumn:1,gridRow:2}} />
                    <BedBox bed="A:7" patients={departmentPatients['DKE']||[]} setDepartmentPatients={setDepartmentPatients} department="DKE" style={{gridColumn:3,gridRow:2}} />
                    <BedBox bed="A:6" patients={departmentPatients['DKE']||[]} setDepartmentPatients={setDepartmentPatients} department="DKE" style={{gridColumn:4,gridRow:2}} />
                    <BedBox bed="B:1" patients={departmentPatients['DKE']||[]} setDepartmentPatients={setDepartmentPatients} department="DKE" style={{gridColumn:5,gridRow:2}} />
                    {/* Mellanrum (rad 3) */}
                    <div style={{gridColumn:'1 / span 8', gridRow:3}}></div>
                    {/* Rad 4 */}
                    <BedBox bed="D:4" patients={departmentPatients['DKE']||[]} setDepartmentPatients={setDepartmentPatients} department="DKE" style={{gridColumn:1,gridRow:4}} />
                    <BedBox bed="D:1" patients={departmentPatients['DKE']||[]} setDepartmentPatients={setDepartmentPatients} department="DKE" style={{gridColumn:3,gridRow:4}} />
                    <BedBox bed="C:1" patients={departmentPatients['DKE']||[]} setDepartmentPatients={setDepartmentPatients} department="DKE" style={{gridColumn:4,gridRow:4}} />
                    <BedBox bed="B:8" patients={departmentPatients['DKE']||[]} setDepartmentPatients={setDepartmentPatients} department="DKE" style={{gridColumn:5,gridRow:4}} />
                    <BedBox bed="B:7" patients={departmentPatients['DKE']||[]} setDepartmentPatients={setDepartmentPatients} department="DKE" style={{gridColumn:6,gridRow:4}} />
                    <BedBox bed="B:6" patients={departmentPatients['DKE']||[]} setDepartmentPatients={setDepartmentPatients} department="DKE" style={{gridColumn:7,gridRow:4}} />
                    <BedBox bed="B:5" patients={departmentPatients['DKE']||[]} setDepartmentPatients={setDepartmentPatients} department="DKE" style={{gridColumn:8,gridRow:4}} />
                    {/* Rad 5 */}
                    <BedBox bed="D:3" patients={departmentPatients['DKE']||[]} setDepartmentPatients={setDepartmentPatients} department="DKE" style={{gridColumn:1,gridRow:5}} />
                    <BedBox bed="D:2" patients={departmentPatients['DKE']||[]} setDepartmentPatients={setDepartmentPatients} department="DKE" style={{gridColumn:3,gridRow:5}} />
                  </div>
                </div>
              )}
              {/* Akutlista-ruta med drag-and-drop */}
              <div
                style={{padding:16, border:'2px solid #222', borderRadius:8, background:'#f9f9f9', marginTop:24}}
                onDrop={e => {
                  e.preventDefault();
                  const patientId = e.dataTransfer.getData('application/patient-id');
                  if (!patientId) return;
                  setDepartmentPatients(prev => {
                    // Hitta patientobjektet från alla avdelningar
                    let patient = null;
                    const allLists = Object.values(prev).flat();
                    patient = allLists.find(p => p.id === patientId);
                    if (!patient) return prev;
                    // Ta bort patienten från ALLA avdelningar
                    const updated = {};
                    for (const key of Object.keys(prev)) {
                      updated[key] = Array.isArray(prev[key]) ? prev[key].filter(p => p.id !== patientId) : prev[key];
                    }
                    // Ta bort sänginfo
                    const patientNoBed = { ...patient };
                    delete patientNoBed.bed;
                    // Lägg tillbaka i Postoperativ avdelning
                    const postopList = updated['Postoperativ avdelning'] || [];
                    updated['Postoperativ avdelning'] = [...postopList, patientNoBed];
                    localStorage.setItem('departmentPatients', JSON.stringify(updated));
                    return updated;
                  });
                }}
                onDragOver={e => e.preventDefault()}
              >
                <h4 style={{marginTop:0,marginBottom:8}}>Akutlista</h4>
                {Array.isArray(departmentPatients['Postoperativ avdelning']) && departmentPatients['Postoperativ avdelning'].filter(p => !p.bed).length > 0 ? (
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:13,background:'#fff',color:'#222'}}>
                    <thead>
                      <tr style={{background:'#e0e0e0'}}>
                        <th style={th}>Personnummer</th>
                        <th style={th}>Namn</th>
                        <th style={th}>Kommentar</th>
                        <th style={{...th, minWidth: 30, maxWidth: 35}}>Förflyttning</th>
                      </tr>
                    </thead>
                    <tbody>
                      {departmentPatients['Postoperativ avdelning'].filter(p => !p.bed).map((p, i) => (
                        <tr
                          key={p.id || i}
                          style={{background:'#fff',color:'#222',cursor:'grab'}} 
                          draggable
                          onDragStart={e => {
                            e.dataTransfer.setData('application/patient-id', p.id);
                          }}
                        >
                          <td style={td}>{p.personnummer}</td>
                          <td style={td}>{p.name}{p.surname ? ' ' + p.surname : ''}</td>
                          <td style={td}>{p.comment || ''}</td>
                          <td style={{...td, minWidth: 30, maxWidth: 35}}>
                            <span style={{display:'flex',alignItems:'center',gap:4}}>
                              <select
                                value={postopTransferValues[i] || ''}
                                onChange={e => {
                                  const newValues = [...postopTransferValues];
                                  newValues[i] = e.target.value;
                                  setPostopTransferValues(newValues);
                                }}
                                style={{padding:'4px 4px',fontSize:13, minWidth: 135, maxWidth: 200}}
                              >
                                <option value="">Välj</option>
                                {[...departmentOptions[selectedHospital],
                                  ...(!departmentOptions[selectedHospital].includes('Postoperativ avdelning') ? ['Postoperativ avdelning'] : [])
                                ].map(dep => (
                                  <option key={dep} value={dep}>{dep}</option>
                                ))}
                              </select>
                              <button
                                style={{padding:'4px 9px',fontSize:13,cursor:'pointer', minWidth: 54}}
                                disabled={!postopTransferValues[i]}
                                title="Skicka till avdelning"
                                onClick={() => {
                                  const transfer = postopTransferValues[i];
                                  if (!transfer) return;
                                  setDepartmentPatients(prev => {
                                    // Ta bort patienten från ALLA avdelningar
                                    const updated = {};
                                    for (const key of Object.keys(prev)) {
                                      updated[key] = Array.isArray(prev[key]) ? prev[key].filter(x => x.id !== p.id) : prev[key];
                                    }
                                    // Lägg till patienten i vald avdelning
                                    const prevDepList = updated[transfer] || [];
                                    if (!prevDepList.some(x => x.id === p.id)) {
                                      updated[transfer] = [...prevDepList, p];
                                    }
                                    localStorage.setItem('departmentPatients', JSON.stringify(updated));
                                    return updated;
                                  });
                                  // Rensa transferValue för denna rad
                                  setPostopTransferValues(vals => {
                                    const newVals = [...vals];
                                    newVals[i] = '';
                                    return newVals;
                                  });
                                }}
                              >
                                ➔
                              </button>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{color:'#222'}}>Inga patienter väntar på plats i Postoperativ avdelning.</div>
                )}
              </div>
            </div>
          ))}
        </>
      )}
      {title === 'Akutmottagning' && (
        <>
          <div style={{fontWeight:'bold',marginBottom:8}}>
            Antal patienter: {patients.length}
          </div>
          {akutAutomationEnabled && (
            <div style={{
              background:'#e8f5e9',
              border:'2px solid #4caf50',
              borderRadius:6,
              padding:'8px 16px',
              marginBottom:12,
              display:'inline-block'
            }}>
              <span style={{fontWeight:700,fontSize:14,color:'#2e7d32'}}>⚙️ AUTOMATISERING AKTIV</span>
              <span style={{fontSize:13,color:'#388e3c',marginLeft:8}}>Patienter med tilldelad läkare och sjuksköterska vårdas automatiskt</span>
            </div>
          )}
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead>
              <tr style={{background:'#e0e0e0'}}>
                {renderAcuteSortHeader('PRIO', 'priority')}
                {renderAcuteSortHeader('Starttid', 'startTime')}
                {renderAcuteSortHeader('Plats', 'location')}
                {renderAcuteSortHeader('Personnummer', 'personnummer')}
                {renderAcuteSortHeader('Namn', 'name', {...th, minWidth:180, maxWidth:300, whiteSpace:'normal'})}
                {renderAcuteSortHeader('Prioriteringsorsak', 'mechanism')}
                {renderAcuteSortHeader('Aktiviteter', 'activities')}
                {renderAcuteSortHeader('Team', 'team')}
                {renderAcuteSortHeader('Läkare', 'doctor')}
                {renderAcuteSortHeader('Sjuksköterska', 'nurse')}
                {renderAcuteSortHeader('Vårdstatus', 'careStatus')}
                {renderAcuteSortHeader('Förflyttning', 'transfer')}
                {renderAcuteSortHeader('Ålder', 'age')}
                {renderAcuteSortHeader('Remiss', 'referral')}
                {renderAcuteSortHeader('Patienttyp', 'patientType')}
                {renderAcuteSortHeader('Ankomstsätt', 'arrivalSource')}
                {renderAcuteSortHeader('Sökorsak', 'cause')}
                {renderAcuteSortHeader('Medicinsk enhet', 'medicalUnit')}
              </tr>
            </thead>
            <tbody>
              {sortedAcutePatients.map(({ patient: p, originalIndex: i }) => (
                <tr
                  key={p.id || i}
                  style={{background:i%2?'#f9f9f9':'#fff',cursor:'pointer'}}
                  onClick={() => setSelectedPatientDetail(p)}
                  title="Klicka för patientinformation"
                >
                  <td style={td}>{(() => {
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
                  })()}</td>
                  <td style={td}>{p.startTime || ''}</td>
                  <td style={td}>{p.location || ''}</td>
                  <td style={td}>{p.personnummer}</td>
                  <td style={{...td, minWidth: 180, maxWidth: 300, whiteSpace: 'normal', wordBreak: 'break-word'}}>
                    {p.name}{p.surname ? ' ' + p.surname : ''}
                  </td>
                  <td style={td}>{p.mechanism || ''}</td>
                  <td style={td}>{p.activities?.join(', ')||''}</td>
                  <td style={td} onClick={e => e.stopPropagation()}>
                    <select
                      aria-label={`Team för ${p.name || p.personnummer || 'patient'}`}
                      value={p.team || ''}
                      onChange={e => handleAssignStaff(i, 'team', e.target.value)}
                      style={{padding:'2px 6px',fontSize:13}}
                    >
                      <option value="">Välj team</option>
                      {[1, 2, 3, 4].map(teamNumber => (
                        <option key={teamNumber} value={`Team ${teamNumber}`}>Team {teamNumber}</option>
                      ))}
                    </select>
                  </td>
                  <td style={td} onClick={e => e.stopPropagation()}>
                    <select
                      value={p.doctor || ''}
                      onChange={e => handleAssignStaff(i, 'doctor', e.target.value)}
                      style={{padding:'2px 6px',fontSize:13,maxWidth:160}}
                    >
                      <option value="">Välj läkare</option>
                      {hospitalStaff.doctors.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </td>
                  <td style={td} onClick={e => e.stopPropagation()}>
                    <select
                      value={p.nurse || ''}
                      onChange={e => handleAssignStaff(i, 'nurse', e.target.value)}
                      style={{padding:'2px 6px',fontSize:13,maxWidth:160}}
                    >
                      <option value="">Välj sjuksköterska</option>
                      {hospitalStaff.nurses.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </td>
                  <td style={td}>{(() => {
                    const remaining = getCareRemainingMinutes(p.id);
                    if (remaining !== null) {
                      return <span style={{color:'#ff9800',fontWeight:600}}>⏳ {remaining} min kvar</span>;
                    }
                    if (p.careDone) {
                      return <span style={{color:'#2e7d32',fontWeight:600}}>✓ Vård klar</span>;
                    }
                    if (p.doctor && p.nurse) {
                      return <span style={{color:'#999'}}>Väntar...</span>;
                    }
                    return <span style={{color:'#999'}}>-</span>;
                  })()}</td>
                  <td style={td} onClick={e => e.stopPropagation()}>
                    <span style={{display:'flex',alignItems:'center',gap:4}}>
                      <select
                        value={p.transfer || ''}
                        onChange={e => handleTransferChange(i, e.target.value)}
                        style={{padding:'2px 6px',fontSize:13}}
                      >
                        <option value="">Välj avdelning</option>
                        {[...departmentOptions[selectedHospital],
                          ...(!departmentOptions[selectedHospital].includes('Postoperativ avdelning') ? ['Postoperativ avdelning'] : [])
                        ].map(dep => (
                          <option key={dep} value={dep}>{dep}</option>
                        ))}
                      </select>
                      <button
                        style={{padding:'2px 8px',fontSize:13,cursor:'pointer'}}
                        disabled={!p.transfer}
                        title="Skicka till avdelning"
                        onClick={() => handleSendToDepartment(i)}
                      >
                        ➔
                      </button>
                    </span>
                    {operationTransferNoticePatientId === p.id && (
                      <div role="status" style={{marginTop:4,color:'#a12622',fontSize:12,fontWeight:600}}>
                        Den här patienten behöver ingen operation
                      </div>
                    )}
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
                    const arrivalSource = String(p.arrivalSource || '').toLocaleLowerCase('sv');
                    if (arrivalSource.includes('ambulans')) return 'ambulans';
                    if (arrivalSource.includes('egen') || arrivalSource.includes('spontan')) return 'egen transport';
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
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {selectedPatientDetail && (
        <div
          style={{
            position:'fixed',left:0,top:0,width:'100vw',height:'100vh',zIndex:9999,
            background:'rgba(0,0,0,0.25)',display:'flex',alignItems:'center',justifyContent:'center'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedPatientDetail(null);
          }}
        >
          <div style={{
            background:'#fff',padding:24,borderRadius:8,minWidth:300,maxWidth:480,
            boxShadow:'0 2px 12px #0004',position:'relative',
            maxHeight:'85vh',overflow:'auto'
          }}>
            <button
              onClick={() => setSelectedPatientDetail(null)}
              style={{position:'absolute',top:10,right:10,border:'none',background:'transparent',fontSize:18,cursor:'pointer',color:'#666'}}
              title="Stäng"
            >✕</button>
            <div style={{fontWeight:700,fontSize:17,marginBottom:10}}>
              {selectedPatientDetail.name}{selectedPatientDetail.surname ? ' ' + selectedPatientDetail.surname : ''}
            </div>
            {selectedPatientDetail.location === 'Uppsamlingsplats' && selectedPatientDetail.triage?.emergencyDept && (
              <div style={{marginBottom:8,padding:'8px 12px',background:'#fafafa',border:'2px solid #888',borderRadius:6,fontWeight:700,textAlign:'center'}}>
                {selectedPatientDetail.triage.emergencyDept} 🏷️
              </div>
            )}
            {selectedPatientDetail.treatment && (
              <div style={{marginBottom:8,padding:'8px 12px',background:'#e3f2fd',border:'2px solid #1976d2',borderRadius:6,fontWeight:600,color:'#1976d2',fontSize:13,textAlign:'center'}}>
                ✓ Behandling: {selectedPatientDetail.treatment}
              </div>
            )}
            {selectedPatientDetail.transportCareNotes?.length > 0 && (
              <div style={{marginBottom:8,padding:'8px 12px',background:'#eaf5ee',border:'1px solid #8ab99a',borderRadius:5,fontSize:13}}>
                <b>Vård under transport:</b> {selectedPatientDetail.transportCareNotes.join('; ')}
              </div>
            )}
            {selectedPatientDetail.transportCarePlan?.notCompleted?.length > 0 && (
              <div style={{marginBottom:8,padding:'8px 12px',background:'#fff6e8',border:'1px solid #e5b96f',borderRadius:5,fontSize:13}}>
                <b>Hann inte utföras under transport:</b> {selectedPatientDetail.transportCarePlan.notCompleted.map(actionId => actionRequirements[actionId]?.label || actionId).join(', ')}
              </div>
            )}
            {(() => {
              const remaining = getCareRemainingMinutes(selectedPatientDetail.id);
              if (remaining === null) return null;
              const task = careTasks[selectedPatientDetail.id];
              const eta = minutesToTime(task.startMinutes + task.durationMinutes);
              return (
                <div style={{marginBottom:8,padding:'8px 12px',background:'#fff3e0',border:'2px solid #ff9800',borderRadius:6,fontWeight:600,color:'#ff9800',fontSize:13,textAlign:'center'}}>
                  ⏳ Pågående vård: {task.activities.join(', ')} — {remaining} min kvar (klar ca {eta})
                </div>
              );
            })()}
            <div style={{fontSize:13,marginBottom:2}}><b>Personnummer:</b> {selectedPatientDetail.personnummer}</div>
            <div style={{fontSize:13,marginBottom:2}}><b>Ålder:</b> {selectedPatientDetail.age || '-'} <b>Kön:</b> {selectedPatientDetail.sex || '-'}</div>
            <div style={{fontSize:13,marginBottom:2}}><b>Hälsostatus:</b> {selectedPatientDetail.baselineHealth || '-'}</div>
            <div style={{fontSize:13,marginBottom:2}}><b>Mekanism:</b> {selectedPatientDetail.mechanism || '-'}</div>
            <div style={{fontSize:13,marginBottom:6}}><b>Skadebeskrivning:</b> {selectedPatientDetail.injuryDescription || '-'}</div>
            {(selectedPatientDetail.XABCDE || selectedPatientDetail.ABCDE) && (
              <div style={{fontSize:13,marginBottom:6,padding:'6px 8px',background:'#f7f7f7',borderRadius:4}}>
                <b>{selectedPatientDetail.XABCDE ? 'XABCDE:' : 'ABCDE:'}</b><br/>
                {selectedPatientDetail.XABCDE && <span style={{marginRight:8}}><b>X:</b> {selectedPatientDetail.XABCDE.X?.Exanguination || '-'}</span>}
                <span style={{marginRight:8}}><b>A:</b> {(selectedPatientDetail.XABCDE?.A || selectedPatientDetail.ABCDE?.A)?.airway || '-'}</span>
                <span style={{marginRight:8}}><b>B:</b> AF: {(selectedPatientDetail.XABCDE?.B || selectedPatientDetail.ABCDE?.B)?.AF || '-'}, Sat: {(selectedPatientDetail.XABCDE?.B || selectedPatientDetail.ABCDE?.B)?.Sat || '-'}</span><br/>
                <span style={{marginRight:8}}><b>C:</b> Puls: {(selectedPatientDetail.XABCDE?.C || selectedPatientDetail.ABCDE?.C)?.Puls || '-'}, BT: {(selectedPatientDetail.XABCDE?.C || selectedPatientDetail.ABCDE?.C)?.BT || '-'}, Blödning: {(selectedPatientDetail.XABCDE?.C || selectedPatientDetail.ABCDE?.C)?.Bleeding || '-'}</span><br/>
                <span style={{marginRight:8}}><b>D:</b> GCS: {(selectedPatientDetail.XABCDE?.D || selectedPatientDetail.ABCDE?.D)?.GCS || '-'}</span>
                <span style={{marginRight:8}}><b>E:</b> Temp: {(selectedPatientDetail.XABCDE?.E || selectedPatientDetail.ABCDE?.E)?.Temp || '-'}</span>
              </div>
            )}
            <div style={{fontSize:13,marginBottom:2}}><b>Aktiviteter:</b> {selectedPatientDetail.activities?.join(', ') || '-'}</div>
            <div style={{fontSize:13,marginBottom:2}}><b>Läkemedel:</b> {selectedPatientDetail.medications?.join(', ') || '-'}</div>
            <div style={{fontSize:13,marginBottom:2}}><b>Läkare:</b> {selectedPatientDetail.doctor || '-'} <b>Sjuksköterska:</b> {selectedPatientDetail.nurse || '-'}</div>
            <div style={{fontSize:13,marginBottom:2}}><b>Remiss:</b> {selectedPatientDetail.referral || '-'}</div>
            <div style={{fontSize:13,marginBottom:2}}><b>Sökorsak:</b> {selectedPatientDetail.cause || '-'}</div>
            <div style={{fontSize:13,marginBottom:2}}><b>Medicinsk enhet:</b> {selectedPatientDetail.medicalUnit || '-'}</div>
            <div style={{fontSize:13,marginBottom:2}}><b>Team:</b> {selectedPatientDetail.team || '-'}</div>
          </div>
        </div>
      )}
      {title === 'Avdelningar' && (
        <div style={{margin:'-8px -12px 0',overflowX:'auto',border:'1px solid #aeb5ba',background:'#fff'}}>
          <table style={{width:'100%',minWidth:940,borderCollapse:'collapse',fontSize:12,tableLayout:'fixed',color:'#16191b'}}>
            <colgroup>
              <col style={{width:'31%'}} />
              <col style={{width:'9%'}} />
              <col style={{width:'8%'}} />
              <col style={{width:'8%'}} />
              <col style={{width:'8%'}} />
              <col style={{width:'9%'}} />
              <col style={{width:'9%'}} />
              <col style={{width:'9%'}} />
              <col style={{width:'9%'}} />
            </colgroup>
            <thead>
              <tr style={{height:28,background:'#fff',borderBottom:'2px solid #222'}}>
                {['Enhet','Disponibla vårdplatser','Lediga vp','2h Prognos','8h Prognos','8h in planerad','8h ut planerad','Utskrivning','Utlokaliserade'].map(label => (
                  <th key={label} title={label} style={{padding:'4px 6px',textAlign:label==='Enhet'?'left':'center',fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {departmentGroups.map(group => {
                const collapsed = Boolean(collapsedDepartmentGroups[group.name]);
                const groupCapacity = selectedHospital === 'Norrlands universitetssjukhus'
                  ? DEPARTMENT_GROUP_BEDS[group.name]
                  : undefined;
                const groupFreeBeds = group.departments.reduce((total, department) => {
                  const capacity = NORRLANDS_DEPARTMENT_BEDS[department];
                  if (capacity === undefined) return total;
                  const currentPatients = Array.isArray(departmentPatients[department]) ? departmentPatients[department].length : 0;
                  const targetPatients = departmentOccupancyLevel
                    ? getTargetPatientCount(department, capacity, departmentOccupancyLevel)
                    : currentPatients;
                  return total + capacity - Math.max(currentPatients, targetPatients);
                }, 0);

                return (
                  <React.Fragment key={group.name}>
                    <tr
                      onClick={() => {
                        setCollapsedDepartmentGroups(previous => ({...previous, [group.name]: !previous[group.name]}));
                        if (!collapsed && group.departments.includes(activeDep)) setActiveDep(null);
                      }}
                      style={{height:27,background:'#f0f1f2',borderTop:'2px solid #333',borderBottom:'1px solid #555',fontWeight:700,cursor:'pointer'}}
                      aria-expanded={!collapsed}
                    >
                      <td style={{padding:'3px 6px',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                        <span aria-hidden="true" style={{display:'inline-block',width:14}}>{collapsed ? '▸' : '▾'}</span>{group.name}
                      </td>
                      <td style={{padding:'3px 6px',textAlign:'center'}}>{groupCapacity ?? '—'}</td>
                      <td style={{padding:'3px 6px',textAlign:'center',fontWeight:600,color:groupCapacity !== undefined && groupFreeBeds <= 0 ? '#b42318' : '#247a3c'}}>{groupCapacity === undefined ? '—' : groupFreeBeds}</td>
                      <td colSpan={6} />
                    </tr>
                    {!collapsed && group.departments.map(department => {
                      const patientsInDepartment = Array.isArray(departmentPatients[department]) ? departmentPatients[department] : [];
                      const selected = activeDep === department;
                      const bedCapacity = selectedHospital === 'Norrlands universitetssjukhus'
                        ? NORRLANDS_DEPARTMENT_BEDS[department]
                        : undefined;
                      const targetPatients = bedCapacity !== undefined && departmentOccupancyLevel
                        ? getTargetPatientCount(department, bedCapacity, departmentOccupancyLevel)
                        : patientsInDepartment.length;
                      const displayedPatientCount = Math.max(patientsInDepartment.length, targetPatients);
                      const freeBeds = bedCapacity === undefined
                        ? undefined
                        : bedCapacity - displayedPatientCount;
                      return (
                        <React.Fragment key={department}>
                          <tr
                            onClick={() => setActiveDep(selected ? null : department)}
                            style={{height:26,background:selected?'#e9f4f8':'#fff',borderBottom:'1px solid #c7c9ca',cursor:'pointer'}}
                            aria-selected={selected}
                          >
                            <td title={department} style={{padding:'3px 6px',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{department}</td>
                            <td style={{padding:'3px 6px',textAlign:'center',fontWeight:600}}>{bedCapacity ?? '—'}</td>
                            <td style={{padding:'3px 6px',textAlign:'center',fontWeight:600,color:freeBeds !== undefined && freeBeds <= 0 ? '#b42318' : '#247a3c'}}>{freeBeds ?? '—'}</td>
                            <td style={{padding:'3px 6px',textAlign:'center',color:'#777'}}>—</td>
                            <td style={{padding:'3px 6px',textAlign:'center',color:'#777'}}>—</td>
                            <td style={{padding:'3px 6px',textAlign:'center',color:'#777'}}>—</td>
                            <td style={{padding:'3px 6px',textAlign:'center',color:'#777'}}>—</td>
                            <td style={{padding:'3px 6px',textAlign:'center',color:'#777'}}>—</td>
                            <td style={{padding:'3px 6px',textAlign:'center',color:'#777'}}>—</td>
                          </tr>
                          {selected && (
                            <tr>
                              <td colSpan={9} style={{padding:0,borderBottom:'2px solid #075078',background:'#f8f9fa'}}>
                                <div style={{padding:12}}>
                                  <h3 style={{margin:'0 0 10px',fontSize:15}}>{department}</h3>
                                  {patientsInDepartment.length === 0 ? (
                                    <div style={{padding:'8px 4px',color:'#60676c'}}>Inga patienter på avdelningen.</div>
                                  ) : (
                                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,background:'#fff'}}>
                                      <thead><tr style={{background:'#e6e8e9'}}>
                                        {['Starttid','Personnummer','Namn','Sökorsak'].map(label => <th key={label} style={{padding:'5px 6px',border:'1px solid #c5c8ca',textAlign:'left'}}>{label}</th>)}
                                      </tr></thead>
                                      <tbody>{patientsInDepartment.map((patient, index) => (
                                        <tr
                                          key={patient.id || index}
                                          onClick={() => setSelectedPatientDetail(patient)}
                                          onKeyDown={event => {
                                            if (event.key === 'Enter' || event.key === ' ') {
                                              event.preventDefault();
                                              setSelectedPatientDetail(patient);
                                            }
                                          }}
                                          tabIndex={0}
                                          role="button"
                                          title="Öppna patientinformation"
                                          style={{background:index%2?'#f7f8f8':'#fff',cursor:'pointer'}}
                                        >
                                          <td style={{padding:'5px 6px',border:'1px solid #d4d6d7'}}>{patient.startTime || '—'}</td>
                                          <td style={{padding:'5px 6px',border:'1px solid #d4d6d7'}}>{patient.personnummer || '—'}</td>
                                          <td style={{padding:'5px 6px',border:'1px solid #d4d6d7'}}>{typeof patient.name === 'object' ? (patient.name?.name || patient.name?.fornamn || 'Patient') : (patient.name || 'Patient')}{patient.surname ? ` ${patient.surname}` : ''}</td>
                                          <td title={patient.cause || patient.injuryDescription || patient.mechanism || 'Sökorsak saknas'} style={{padding:'5px 6px',border:'1px solid #d4d6d7'}}>
                                            {patient.cause || patient.injuryDescription || patient.mechanism || 'Sökorsak saknas'}
                                          </td>
                                        </tr>
                                      ))}</tbody>
                                    </table>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {title === 'Mottagningar' && selectedHospital === 'Norrlands universitetssjukhus' && (
        <>
          <div style={{marginBottom:16,display:'flex',gap:8,flexWrap:'wrap'}}>
            {[...allDeps].sort((a, b) => a.localeCompare(b, 'sv')).map(dep => (
              <button
                key={dep}
                style={{padding:'6px 14px',borderRadius:5,border:activeDep===dep?'2px solid #007acc':'1px solid #ccc',background:activeDep===dep?'#e3f2fd':'#fff',fontWeight:activeDep===dep?'bold':'normal',cursor:'pointer'}}
                onClick={() => setActiveDep(dep)}
              >
                {dep}
              </button>
            ))}
          </div>
          {activeDep && (
            <div>
              <h3 style={{marginTop:0}}>{activeDep}</h3>
              <p>Här kan du lägga till mer information om mottagningen <strong>{activeDep}</strong> om det behövs.</p>
            </div>
          )}
        </>
      )}
      {title === 'OP' && (
        <>
          {selectedHospital === 'Norrlands universitetssjukhus' ? (
            <>
              <div style={{marginBottom:16,display:'flex',gap:8,flexWrap:'wrap'}}>
                {allDeps.map(dep => (
                  <button
                    key={dep}
                    style={{padding:'6px 14px',borderRadius:5,border:activeDep===dep?'2px solid #007acc':'1px solid #ccc',background:activeDep===dep?'#e3f2fd':'#fff',fontWeight:activeDep===dep?'bold':'normal',cursor:'pointer'}}
                    onClick={() => setActiveDep(dep)}
                  >
                    {dep}
                  </button>
                ))}
              </div>
              {activeDep && (
                <div>
                  <h3 style={{marginTop:0}}>{activeDep}</h3>
                  <OPScheduleTable activeDep={activeDep} simTime={clock} />
                </div>
              )}
            </>
          ) : (
            <div>
              <h3 style={{marginTop:0}}>{selectedHospital} OP</h3>
              <OPScheduleTable activeDep={selectedHospital + ' OP'} simTime={clock} />
            </div>
          )}

          {/* Akutlista längst ner */}
          <div style={{marginTop:0, padding:16, border:'2px solid #222', borderRadius:8, background:'#fff'}}>
            <h2 style={{color:'#222',marginTop:0}}>Patienter IN</h2>
            {automation.Operation && (
              <div style={{
                background:'#e8f5e9',
                border:'2px solid #4caf50',
                borderRadius:6,
                padding:'8px 16px',
                marginBottom:12,
                display:'inline-block'
              }}>
                <span style={{fontWeight:700,fontSize:14,color:'#2e7d32'}}>⚙️ AUTOMATISERING AKTIV</span>
                <span style={{fontSize:13,color:'#388e3c',marginLeft:8}}>Patienter med tilldelad kirurg och anestesiläkare opereras automatiskt</span>
              </div>
            )}
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13,background:'#fff',color:'#222'}}>
              <thead>
                <tr style={{background:'#fff',color:'#222'}}>
                  <th style={th}>Starttid</th>
                  <th style={th}>Personnummer</th>
                  <th style={th}>Namn</th>
                  <th style={th}>Operationskort</th>
                  <th style={th}>Kirurg</th>
                  <th style={th}>Anestesiläkare</th>
                  <th style={th}>Vårdstatus</th>
                  <th style={th}>Kommentar (akut)</th>
                </tr>
              </thead>
              <tbody>
                {(departmentPatients['OP']||[]).map((p, i) => (
                  <tr
                    key={p.id || i}
                    style={{background:'#fff',color:'#222',cursor:'grab'}}
                    draggable
                    onDragStart={e => {
                      e.dataTransfer.setData('application/patient-id', p.id);
                    }}
                  >
                    <td style={{...td, cursor:'grab', userSelect:'none'}}>{p.startTime || ''}</td>
                    <td style={{...td, cursor:'grab', userSelect:'none'}}>{p.personnummer}</td>
                    <td style={{...td, cursor:'grab', userSelect:'none'}}>{p.name}{p.surname ? ' ' + p.surname : ''}</td>
                    <td style={{...td, cursor:'grab', userSelect:'none'}}>{(p.interventions && p.interventions.Surgery) ? p.interventions.Surgery : ''}</td>
                    <td style={td} draggable={false} onClick={e => e.stopPropagation()}>
                      <select
                        value={p.surgeon || ''}
                        onChange={e => handleAssignOPStaff(p.id, 'surgeon', e.target.value)}
                        style={{padding:'2px 6px',fontSize:13,maxWidth:160}}
                      >
                        <option value="">Välj kirurg</option>
                        {hospitalStaff.surgeons.map(name => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </td>
                    <td style={td} draggable={false} onClick={e => e.stopPropagation()}>
                      <select
                        value={p.anesthesiologist || ''}
                        onChange={e => handleAssignOPStaff(p.id, 'anesthesiologist', e.target.value)}
                        style={{padding:'2px 6px',fontSize:13,maxWidth:160}}
                      >
                        <option value="">Välj anestesiläkare</option>
                        {hospitalStaff.anesthesiologists.map(name => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{...td, cursor:'grab', userSelect:'none'}}>{(() => {
                      const remaining = getOpCareRemainingMinutes(p.id);
                      if (remaining !== null) {
                        return <span style={{color:'#ff9800',fontWeight:600}}>⏳ {remaining} min kvar</span>;
                      }
                      if (p.surgeon && p.anesthesiologist) {
                        return <span style={{color:'#999'}}>Väntar...</span>;
                      }
                      return <span style={{color:'#999'}}>-</span>;
                    })()}</td>
                    <td style={{...td, cursor:'grab', userSelect:'none'}}></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(!departmentPatients['OP'] || departmentPatients['OP'].length === 0) && (
              <div style={{color:'#222',marginTop:8}}>Inga patienter har skickats till operation.</div>
            )}
          </div>
        </>
      )}
      {title === 'IVA' && (
        <>
          <div style={{marginBottom:16,display:'flex',gap:8,flexWrap:'wrap'}}>
            {['IVA','NIVA','THIVA','IMA','THIMA'].map(dep => (
              <button
                key={dep}
                style={{padding:'6px 14px',borderRadius:5,border:activeDep===dep?'2px solid #007acc':'1px solid #ccc',background:activeDep===dep?'#e3f2fd':'#fff',fontWeight:activeDep===dep?'bold':'normal',cursor:'pointer'}}
                onClick={() => setActiveDep(dep)}
              >
                {dep}
              </button>
            ))}
          </div>
          {activeDep && (
            <div>
              <h3 style={{marginTop:0}}>{activeDep}</h3>
              {/* Sängplatslayout för IVA, NIVA och THIVA */}
              {activeDep === 'IVA' ? (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(8, 110px)',
                  gridTemplateRows: 'repeat(3, 80px)',
                  gap: '32px',
                  justifyContent: 'center',
                  alignItems: 'center',
                  margin: '0 auto',
                  width: 'max-content',
                  marginBottom: 48,
                }}>
                  {/* Rad 1 */}
                  <BedBox bed="9:2" patients={departmentPatients['IVA']||[]} style={{gridColumn:1, gridRow:1}} setDepartmentPatients={setDepartmentPatients} />
                  <BedBox bed="9:3" patients={departmentPatients['IVA']||[]} style={{gridColumn:2, gridRow:1}} setDepartmentPatients={setDepartmentPatients} />
                  <BedBox bed="9:4" patients={departmentPatients['IVA']||[]} style={{gridColumn:3, gridRow:1}} setDepartmentPatients={setDepartmentPatients} />
                  <BedBox bed="9:5" patients={departmentPatients['IVA']||[]} style={{gridColumn:4, gridRow:1}} setDepartmentPatients={setDepartmentPatients} />
                  <BedBox bed="12:2" patients={departmentPatients['IVA']||[]} style={{gridColumn:5, gridRow:1}} setDepartmentPatients={setDepartmentPatients} />
                  <BedBox bed="12:3" patients={departmentPatients['IVA']||[]} style={{gridColumn:6, gridRow:1}} setDepartmentPatients={setDepartmentPatients} />
                  <BedBox bed="12:4" patients={departmentPatients['IVA']||[]} style={{gridColumn:7, gridRow:1}} setDepartmentPatients={setDepartmentPatients} />
                  <BedBox bed="12:5" patients={departmentPatients['IVA']||[]} style={{gridColumn:8, gridRow:1}} setDepartmentPatients={setDepartmentPatients} />
                  {/* Rad 2 */}
                  <BedBox bed="9:1" patients={departmentPatients['IVA']||[]} style={{gridColumn:1, gridRow:2}} setDepartmentPatients={setDepartmentPatients} />
                  <BedBox bed="9:6" patients={departmentPatients['IVA']||[]} style={{gridColumn:4, gridRow:2}} setDepartmentPatients={setDepartmentPatients} />
                  <BedBox bed="12:1" patients={departmentPatients['IVA']||[]} style={{gridColumn:5, gridRow:2}} setDepartmentPatients={setDepartmentPatients} />
                  <BedBox bed="12:6" patients={departmentPatients['IVA']||[]} style={{gridColumn:8, gridRow:2}} setDepartmentPatients={setDepartmentPatients} />
                  {/* Rad 3 */}
                  <BedBox bed="8" patients={departmentPatients['IVA']||[]} style={{gridColumn:1, gridRow:3}} setDepartmentPatients={setDepartmentPatients} />
                  <BedBox bed="Akut" patients={departmentPatients['IVA']||[]} style={{gridColumn:4, gridRow:3}} setDepartmentPatients={setDepartmentPatients} />
                  <BedBox bed="Sista vilan" patients={departmentPatients['IVA']||[]} style={{gridColumn:5, gridRow:3}} setDepartmentPatients={setDepartmentPatients} />
                </div>
              ) : activeDep === 'IMA' ? (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 110px)',
                  gridTemplateRows: 'repeat(2, 80px)',
                  gap: '32px',
                  justifyContent: 'center',
                  alignItems: 'center',
                  margin: '0 auto',
                  width: 'max-content',
                  marginBottom: 48,
                }}>
                  {/* Översta raden: E:1 och D */}
                  <BedBox bed="E:1" patients={departmentPatients['IMA']||[]} style={{gridColumn:1, gridRow:1}} setDepartmentPatients={setDepartmentPatients} department="IMA" />
                                    <BedBox bed="E:2" patients={departmentPatients['IMA']||[]} style={{gridColumn:1, gridRow:2}} setDepartmentPatients={setDepartmentPatients} department="IMA" />
                  <div style={{gridColumn:2, gridRow:1}}></div>
                  <BedBox bed="D" patients={departmentPatients['IMA']||[]} style={{gridColumn:3, gridRow:1}} setDepartmentPatients={setDepartmentPatients} department="IMA" />
                  {/* Halv rad under, till höger om D */}
                  <div style={{gridColumn:4, gridRow:2, position:'relative', top:'-40px', display:'flex', gap:'32px'}}>
                    <BedBox bed="C:1" patients={departmentPatients['IMA']||[]} style={{}} setDepartmentPatients={setDepartmentPatients} department="IMA" />
                    <BedBox bed="C:2" patients={departmentPatients['IMA']||[]} style={{}} setDepartmentPatients={setDepartmentPatients} department="IMA" />
                  </div>
                    <BedBox bed="B" patients={departmentPatients['IMA']||[]} style={{gridColumn:4, gridRow:3, position:'relative', left:160}} setDepartmentPatients={setDepartmentPatients} department="IMA" />
                </div>
              ) : activeDep === 'NIVA' ? (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 110px)',
                  gridTemplateRows: 'repeat(4, 80px)',
                  gap: '32px',
                  justifyContent: 'center',
                  alignItems: 'center',
                  margin: '0 auto',
                  width: 'max-content',
                  marginBottom: 48,
                }}>
                  {/* Rad 1 */}
                  <BedBox bed="8-2" patients={departmentPatients['NIVA']||[]} style={{gridColumn:1, gridRow:1}} setDepartmentPatients={setDepartmentPatients} department="NIVA" />
                  <BedBox bed="8-3" patients={departmentPatients['NIVA']||[]} style={{gridColumn:2, gridRow:1}} setDepartmentPatients={setDepartmentPatients} department="NIVA" />
                  <BedBox bed="6-2" patients={departmentPatients['NIVA']||[]} style={{gridColumn:3, gridRow:1}} setDepartmentPatients={setDepartmentPatients} department="NIVA" />
                  <BedBox bed="6-3" patients={departmentPatients['NIVA']||[]} style={{gridColumn:4, gridRow:1}} setDepartmentPatients={setDepartmentPatients} department="NIVA" />
                  {/* mellanrum */}
                  <div style={{gridColumn:5, gridRow:1}}></div>
                  <BedBox bed="4-2" patients={departmentPatients['NIVA']||[]} style={{gridColumn:6, gridRow:1}} setDepartmentPatients={setDepartmentPatients} department="NIVA" />
                  {/* mellanrum */}
                  <div style={{gridColumn:7, gridRow:1}}></div>
                  <BedBox bed="2-2" patients={departmentPatients['NIVA']||[]} style={{gridColumn:8, gridRow:1}} setDepartmentPatients={setDepartmentPatients} department="NIVA" />
                  {/* Rad 2, halvt steg ner */}
                  <BedBox bed="4-1" patients={departmentPatients['NIVA']||[]} style={{gridColumn:5, gridRow:2}} setDepartmentPatients={setDepartmentPatients} department="NIVA" />
                  {/* Rad 3, halvt steg ner till */}
                  <BedBox bed="8-1" patients={departmentPatients['NIVA']||[]} style={{gridColumn:1, gridRow:3}} setDepartmentPatients={setDepartmentPatients} department="NIVA" />
                  <BedBox bed="6-1" patients={departmentPatients['NIVA']||[]} style={{gridColumn:3, gridRow:3}} setDepartmentPatients={setDepartmentPatients} department="NIVA" />
                  <BedBox bed="4-3" patients={departmentPatients['NIVA']||[]} style={{gridColumn:6, gridRow:3}} setDepartmentPatients={setDepartmentPatients} department="NIVA" />
                  <BedBox bed="2-1" patients={departmentPatients['NIVA']||[]} style={{gridColumn:8, gridRow:3}} setDepartmentPatients={setDepartmentPatients} department="NIVA" />
                </div>
              ) : activeDep === 'THIVA' ? (
                (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(8, 110px)',
                    gridTemplateRows: 'repeat(5, 80px)',
                    gap: '32px',
                    justifyContent: 'center',
                    alignItems: 'center',
                    margin: '0 auto',
                    width: 'max-content',
                    marginBottom: 48,
                  }}>
                    {/* Översta raden */}
                    <BedBox bed="1:2" patients={departmentPatients['THIVA']||[]} style={{gridColumn:1, gridRow:1}} />
                    <BedBox bed="1:3" patients={departmentPatients['THIVA']||[]} style={{gridColumn:2, gridRow:1}} />
                    <BedBox bed="1:4" patients={departmentPatients['THIVA']||[]} style={{gridColumn:3, gridRow:1}} />
                    {/* Mellanrum */}
                    <BedBox bed="4:1" patients={departmentPatients['THIVA']||[]} style={{gridColumn:5, gridRow:1}} />
                    <BedBox bed="4:2" patients={departmentPatients['THIVA']||[]} style={{gridColumn:6, gridRow:1}} />
                    <BedBox bed="4:3" patients={departmentPatients['THIVA']||[]} style={{gridColumn:7, gridRow:1}} />
                    <BedBox bed="4:4" patients={departmentPatients['THIVA']||[]} style={{gridColumn:8, gridRow:1}} />
                    {/* Raden under */}
                    <BedBox bed="1:1" patients={departmentPatients['THIVA']||[]} style={{gridColumn:1, gridRow:2}} />
                    {/* En rads mellanrum (rad 3 är tom) */}
                    {/* Raden under det */}
                    <BedBox bed="5:1" patients={departmentPatients['THIVA']||[]} style={{gridColumn:1, gridRow:4}} />
                    <BedBox bed="5:2" patients={departmentPatients['THIVA']||[]} style={{gridColumn:2, gridRow:4}} />
                    <BedBox bed="6:2" patients={departmentPatients['THIVA']||[]} style={{gridColumn:3, gridRow:4}} />
                    <BedBox bed="6:3" patients={departmentPatients['THIVA']||[]} style={{gridColumn:4, gridRow:4}} />
                    {/* 6:1 under 6:2, 6:4 under 6:3 */}
                    <BedBox bed="6:1" patients={departmentPatients['THIVA']||[]} style={{gridColumn:3, gridRow:5}} />
                    <BedBox bed="6:4" patients={departmentPatients['THIVA']||[]} style={{gridColumn:4, gridRow:5}} />
                    {/* "Röd" och "Sista vilan" på samma rad som 6:1 och 6:4 */}
                    <BedBox bed="Röd" patients={departmentPatients['THIVA']||[]} style={{gridColumn:6, gridRow:5}} />
                    <BedBox bed="Sista vilan" patients={departmentPatients['THIVA']||[]} style={{gridColumn:7, gridRow:5}} />
                  </div>
                )
              ) : (
                <div style={{marginTop:16}}>Visa patienter för {activeDep} här.</div>
              )}
            </div>
          )}
          {/* Patienter IN längst ner i IVA-vyn */}
          <div
            style={{padding:16, border:'2px solid #222', borderRadius:8, background:'#fff'}}
            onDrop={e => {
              e.preventDefault();
              const patientId = e.dataTransfer.getData('application/patient-id');
              if (!patientId) return;
              setDepartmentPatients(prev => {
                // Hitta patientobjektet från alla avdelningar
                let patient = null;
                const allLists = Object.values(prev).flat();
                patient = allLists.find(p => p.id === patientId);
                if (!patient) return prev;
                // Ta bort patienten från ALLA avdelningar
                const updated = {};
                for (const key of Object.keys(prev)) {
                  updated[key] = Array.isArray(prev[key]) ? prev[key].filter(p => p.id !== patientId) : prev[key];
                }
                // Ta bort sänginfo
                const patientNoBed = { ...patient };
                delete patientNoBed.bed;
                // Lägg tillbaka i IVA_AKUTLISTA
                const akutList = updated['IVA_AKUTLISTA'] || [];
                updated['IVA_AKUTLISTA'] = [...akutList, patientNoBed];
                localStorage.setItem('departmentPatients', JSON.stringify(updated));
                return updated;
              });
            }}
            onDragOver={e => e.preventDefault()}
          >
            <h2 style={{color:'#222',marginTop:0}}>Patienter IN</h2>
            {automation.Intensivvard && (
              <div style={{
                background:'#e8f5e9',
                border:'2px solid #4caf50',
                borderRadius:6,
                padding:'8px 16px',
                marginBottom:12,
                display:'inline-block'
              }}>
                <span style={{fontWeight:700,fontSize:14,color:'#2e7d32'}}>⚙️ AUTOMATISERING AKTIV</span>
                <span style={{fontSize:13,color:'#388e3c',marginLeft:8}}>Patienter med tilldelad IVA-läkare och IVA-sköterska vårdas automatiskt</span>
              </div>
            )}
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13,background:'#fff',color:'#222'}}>
              <thead>
                <tr style={{background:'#fff',color:'#222'}}>
                  <th style={th}>Starttid</th>
                  <th style={th}>Personnummer</th>
                  <th style={th}>Namn</th>
                  <th style={th}>IVA-läkare</th>
                  <th style={th}>IVA-sköterska</th>
                  <th style={th}>Undersköterska IVA</th>
                  <th style={th}>Vårdstatus</th>
                  <th style={th}>Kommentar (akut)</th>
                  <th style={{...th, width: 270, minWidth: 180, maxWidth: 315}}>Förflyttning</th>
                </tr>
              </thead>
              <tbody>
                {(departmentPatients['IVA_AKUTLISTA']||[]).map((p, i) => (
                  <tr
                    key={p.id || i}
                    style={{background:'#fff',color:'#222',cursor:'grab'}}
                    draggable
                    onDragStart={e => {
                      e.dataTransfer.setData('application/patient-id', p.id);
                    }}
                  >
                    <td style={{...td, cursor:'grab', userSelect:'none'}}>{p.startTime || ''}</td>
                    <td style={{...td, cursor:'grab', userSelect:'none'}}>{p.personnummer}</td>
                    <td style={{...td, cursor:'grab', userSelect:'none'}}>{p.name}{p.surname ? ' ' + p.surname : ''}</td>
                    <td style={td}>
                      <select
                        value={p.ivaDoctor || ''}
                        onChange={e => handleAssignIvaStaff(p.id, 'ivaDoctor', e.target.value)}
                        style={{padding:'2px 6px',fontSize:13,maxWidth:160}}
                      >
                        <option value="">Välj läkare</option>
                        {hospitalStaff.anesthesiologists.map(name => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </td>
                    <td style={td}>
                      <select
                        value={p.ivaNurse || ''}
                        onChange={e => handleAssignIvaStaff(p.id, 'ivaNurse', e.target.value)}
                        style={{padding:'2px 6px',fontSize:13,maxWidth:160}}
                      >
                        <option value="">Välj sköterska</option>
                        {hospitalStaff.ivaNurses.map(name => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </td>
                    <td style={td}>
                      <select
                        value={p.ivaAssistant || ''}
                        onChange={e => handleAssignIvaStaff(p.id, 'ivaAssistant', e.target.value)}
                        style={{padding:'2px 6px',fontSize:13,maxWidth:160}}
                      >
                        <option value="">Välj undersköterska</option>
                        {hospitalStaff.ivaAssistants.map(name => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{...td, cursor:'grab', userSelect:'none'}}>{(() => {
                      const remaining = getIvaCareRemainingMinutes(p.id);
                      if (remaining !== null) {
                        return <span style={{color:'#ff9800',fontWeight:600}}>⏳ {remaining} min kvar</span>;
                      }
                      if (p.ivaCareDone) {
                        return <span style={{color:'#2e7d32'}}>✓ Dokumenterad</span>;
                      }
                      if (p.ivaDoctor && p.ivaNurse) {
                        return <span style={{color:'#999'}}>Väntar...</span>;
                      }
                      return <span style={{color:'#999'}}>-</span>;
                    })()}</td>
                    <td style={{...td, cursor:'grab', userSelect:'none'}}>{p.comment || ''}</td>
                    <td style={td}>
                      <span style={{display:'flex',alignItems:'center',gap:4}}>
                        <select
                          value={transferValues[i] || ''}
                          onChange={e => {
                            const newValues = [...transferValues];
                            newValues[i] = e.target.value;
                            setTransferValues(newValues);
                          }}
                          style={{padding:'4px 4px',fontSize:13, minWidth: 135, maxWidth: 200}}
                        >
                          <option value="">Välj</option>
                          {[...departmentOptions[selectedHospital],
                            ...(!departmentOptions[selectedHospital].includes('Postoperativ avdelning') ? ['Postoperativ avdelning'] : [])
                          ].map(dep => (
                            <option key={dep} value={dep}>{dep}</option>
                          ))}
                        </select>
                          <button
                            style={{padding:'4px 9px',fontSize:13,cursor:'pointer', minWidth: 54}}
                            disabled={!transferValues[i]}
                            title="Skicka till avdelning"
                            onClick={() => {
                              const transfer = transferValues[i];
                              if (!transfer) return;
                              setDepartmentPatients(prev => {
                                // Ta bort patienten från ALLA avdelningar
                                const updated = {};
                                for (const key of Object.keys(prev)) {
                                  updated[key] = Array.isArray(prev[key]) ? prev[key].filter(x => x.id !== p.id) : prev[key];
                                }
                                // Lägg till patienten i vald avdelning
                                const prevDepList = updated[transfer] || [];
                                if (!prevDepList.some(x => x.id === p.id)) {
                                  updated[transfer] = [...prevDepList, p];
                                }
                                localStorage.setItem('departmentPatients', JSON.stringify(updated));
                                return updated;
                              });
                              // Rensa transferValue för denna rad
                              setTransferValues(vals => {
                                const newVals = [...vals];
                                newVals[i] = '';
                                return newVals;
                              });
                            }}
                          >
                            ➔
                          </button>
                        </span>
                      </td>
                    </tr>
                ))}
              </tbody>
            </table>
            {(!departmentPatients['IVA_AKUTLISTA'] || departmentPatients['IVA_AKUTLISTA'].length === 0) && (
              <div style={{color:'#222',marginTop:8}}>Inga patienter har skickats till Patienter IN.</div>
            )}
          </div>
        </>
      )}
      {title === 'Mottagningar' && (
        <div style={{marginTop:0, padding:16, border:'2px solid #222', borderRadius:8, background:'#fff'}}>
          <h2 style={{color:'#222',marginTop:0}}>Patienter IN</h2>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13,background:'#fff',color:'#222'}}>
            <thead>
              <tr style={{background:'#fff',color:'#222'}}>
                <th style={th}>Starttid</th>
                <th style={th}>Personnummer</th>
                <th style={th}>Namn</th>
                <th style={th}>Kommentar (akut)</th>
                <th style={{...th, width: 270, minWidth: 180, maxWidth: 315}}>Förflyttning</th>
              </tr>
            </thead>
            <tbody>
              {(departmentPatients['MOTTAGNINGAR_AKUTLISTA']||[]).map((p, i) => (
                <tr
                  key={p.id || i}
                  style={{background:'#fff',color:'#222',cursor:'grab'}}
                  draggable
                  onDragStart={e => {
                    e.dataTransfer.setData('application/patient-id', p.id);
                  }}
                >
                  <td style={{...td, cursor:'grab', userSelect:'none'}}>{p.startTime || ''}</td>
                  <td style={{...td, cursor:'grab', userSelect:'none'}}>{p.personnummer}</td>
                  <td style={{...td, cursor:'grab', userSelect:'none'}}>{p.name}{p.surname ? ' ' + p.surname : ''}</td>
                  <td style={{...td, cursor:'grab', userSelect:'none'}}>{p.comment || ''}</td>
                  <td style={td}>
                    <span style={{display:'flex',alignItems:'center',gap:4}}>
                      <select
                        value={transferValues[i] || ''}
                        onChange={e => {
                          const newValues = [...transferValues];
                          newValues[i] = e.target.value;
                          setTransferValues(newValues);
                        }}
                        style={{padding:'4px 4px',fontSize:13, minWidth: 135, maxWidth: 200}}
                      >
                        <option value="">Välj</option>
                        {departmentOptions[selectedHospital].map(dep => (
                          <option key={dep} value={dep}>{dep}</option>
                        ))}
                      </select>
                      <button
                        style={{padding:'4px 9px',fontSize:13,cursor:'pointer', minWidth: 54}}
                        disabled={!transferValues[i]}
                        title="Skicka till avdelning"
                        onClick={() => {
                          const transfer = transferValues[i];
                          if (!transfer) return;
                          setDepartmentPatients(prev => {
                            // Ta bort patienten från ALLA avdelningar
                            const updated = {};
                            for (const key of Object.keys(prev)) {
                              updated[key] = Array.isArray(prev[key]) ? prev[key].filter(x => x.id !== p.id) : prev[key];
                            }
                            // Lägg till patienten i vald avdelning
                            const prevDepList = updated[transfer] || [];
                            if (!prevDepList.some(x => x.id === p.id)) {
                              updated[transfer] = [...prevDepList, p];
                            }
                            localStorage.setItem('departmentPatients', JSON.stringify(updated));
                            return updated;
                          });
                          // Rensa transferValue för denna rad
                          setTransferValues(vals => {
                            const newVals = [...vals];
                            newVals[i] = '';
                            return newVals;
                          });
                        }}
                      >
                        ➔
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(!departmentPatients['MOTTAGNINGAR_AKUTLISTA'] || departmentPatients['MOTTAGNINGAR_AKUTLISTA'].length === 0) && (
            <div style={{color:'#222',marginTop:8}}>Inga patienter har skickats till Patienter IN.</div>
          )}
        </div>
      )}
      </>
      )}
    </div>
  );
}

// Komponent för sängplatsruta
function BedBox({ bed, patients, style, setDepartmentPatients, department = 'IVA' }) {
  const patient = patients.find(p => (p.bed || p.location) === bed);
  // Drag-and-drop support for akutlista och mellan sängar
  const handleDrop = (e) => {
    e.preventDefault();
    const patientId = e.dataTransfer.getData('application/patient-id');
    if (!patientId || !setDepartmentPatients) return;
    setDepartmentPatients(prev => {
      // Ta bort patienten från ALLA avdelningar och akutlista
      const updated = {};
      for (const key of Object.keys(prev)) {
        updated[key] = prev[key].filter(p => p.id !== patientId);
      }
      // Hämta patientobjektet (från alla avdelningar)
      let droppedPatient = null;
      const allLists = Object.values(prev).flat();
      droppedPatient = allLists.find(p => p.id === patientId);
      if (!droppedPatient) return prev;
      // Tilldela ny säng
      droppedPatient = { ...droppedPatient, bed };
      // Lägg till patienten i rätt avdelning
      const depList = updated[department] || [];
      updated[department] = [...depList, droppedPatient];
      // Om POSTOP: ta även bort från akutlistan i departmentPatients direkt
      if (department === 'Postoperativ avdelning' && updated['Postoperativ avdelning']) {
        updated['Postoperativ avdelning'] = updated['Postoperativ avdelning'].filter(p => p.id !== patientId || (p.bed && p.bed === bed));
      }
      // Spara till localStorage
      localStorage.setItem('departmentPatients', JSON.stringify(updated));
      // Ta även bort patienten från akutmottagningen (patients-listan i localStorage)
      try {
        const akut = JSON.parse(localStorage.getItem('akutPatients') || '{}');
        for (const hosp of Object.keys(akut)) {
          akut[hosp] = (akut[hosp] || []).filter(p => p.id !== patientId);
        }
        localStorage.setItem('akutPatients', JSON.stringify(akut));
      } catch {}
      // Ta även bort patienten från POSTOP akutlista om relevant
      try {
        const postopAkut = JSON.parse(localStorage.getItem('postopAkutlista') || '[]');
        const newPostopAkut = postopAkut.filter(p => p.id !== patientId);
        localStorage.setItem('postopAkutlista', JSON.stringify(newPostopAkut));
      } catch {}
      return updated;
    });
  };
  return (
    <div
      style={{
        border: '2px solid #1976d2',
        borderRadius: 8,
        minWidth: 110,
        minHeight: 70,
        padding: 8,
        background: '#f5faff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 6px #0001',
        fontSize: 15,
        fontWeight: 500,
        ...style
      }}
      onDrop={handleDrop}
      onDragOver={e => e.preventDefault()}
      draggable={!!patient}
      onDragStart={patient ? (e => {
        e.dataTransfer.setData('application/patient-id', patient.id);
      }) : undefined}
    >
      <div style={{fontWeight:700,marginBottom:2}}>{bed}</div>
      <div
        style={{fontSize:13,color:'#333',cursor:patient ? 'grab' : 'default', userSelect:'none'}}
      >{patient ? patient.personnummer : ''}</div>
      <div style={{fontSize:13,color:'#1976d2'}}>{patient ? (patient.name + (patient.surname ? ' ' + patient.surname : '')) : ''}</div>
    </div>
  );
}
