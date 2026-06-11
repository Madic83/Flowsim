// Skicka patient till OP (utan att ta bort från akutmottagning)
  function handleSendToOP(patientIndex) {
    const patient = patients[patientIndex];
    if (!patient) return;
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

// Hjälpfunktion för att hitta patientobjekt i OP-listan
function getPatientByIdFromOP(departmentPatients, id) {
  const opList = departmentPatients['OP'] || [];
  return opList.find(p => p.id === id);
}

const th = {border:'1px solid #ccc',padding:'4px 8px',background:'#e0e0e0',fontWeight:'bold'};
const td = {border:'1px solid #ccc',padding:'4px 8px'};

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

export default function WindowTab() {
    // POSTOP/DKE tab state
    const [postopTab, setPostopTab] = useState('POSTOP');
    // Flyttvärden för POSTOP akutlista
    const [postopTransferValues, setPostopTransferValues] = useState([]);
  // Clock state for synced time, läs från localStorage eller default till 00:00
  const [clock, setClock] = useState(() => {
    return localStorage.getItem('simTime') || '00:00';
  });
  // State for transfer values in Patienter IN
  const [transferValues, setTransferValues] = useState([]);
  const params = new URLSearchParams(window.location.search);
  const title = params.get('title') || '';
  const selectedHospital = params.get('hospital') || 'Norrlands universitetssjukhus';

  let initialPatients = [];
  if (title === 'Akutmottagning') {
    try {
      const akut = JSON.parse(localStorage.getItem('akutPatients') || '{}');
      initialPatients = akut[selectedHospital] || [];
    } catch {}
  }
  const [patients, setPatients] = useState(initialPatients);
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
    }
    window.addEventListener('message', handleMsg);
    
    // Lyssna på paratusUpdated-event
    function handleParatusUpdate() {
      try {
        const paratus = JSON.parse(localStorage.getItem('paratusPatients') || '[]');
        setParatusPatients(paratus);
      } catch {}
    }
    window.addEventListener('paratusUpdated', handleParatusUpdate);
    function handleStorage(e) {
      if (e.key === 'simTime') {
        setClock(e.newValue || '00:00');
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
    };
  }, [selectedHospital]);

  // Hantera ändring av förflyttning för en patient
  function handleTransferChange(patientIndex, value) {
    setPatients(pats => pats.map((p, i) => i === patientIndex ? { ...p, transfer: value } : p));
  }

  // Flytta patient till avdelning
  function handleSendToDepartment(patientIndex) {
    const patient = patients[patientIndex];
    if (!patient.transfer) return;
    setDepartmentPatients(prev => {
      const dep = patient.transfer;
      // Om patienten skickas till Röntgen, lägg bara till i Röntgen och behåll på akuten
      if (dep && dep.toLowerCase().includes('röntgen')) {
        const updated = { ...prev };
        const prevList = prev[dep] || [];
        if (!prevList.some(p => p.id === patient.id)) {
          updated[dep] = [...prevList, patient];
        }
        localStorage.setItem('departmentPatients', JSON.stringify(updated));
        return updated;
      }
      // Annars: ta bort patienten från ALLA avdelningar och lägg till i den nya
      const updated = {};
      for (const key of Object.keys(prev)) {
        updated[key] = prev[key].filter(p => p.id !== patient.id);
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
      localStorage.setItem('departmentPatients', JSON.stringify(updated));
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
  const [activeDep, setActiveDep] = useState(null);
  let allDeps = departmentOptions[selectedHospital];
  if (title === 'OP' && selectedHospital === 'Norrlands universitetssjukhus') {
    allDeps = departmentOptions['Norrlands universitetssjukhus_OP'];
  } else if (title === 'Mottagningar' && selectedHospital === 'Norrlands universitetssjukhus') {
    allDeps = departmentOptions['Norrlands universitetssjukhus_Mottagningar'];
  }

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

  return (
    <div style={{padding:24, fontFamily:'Arial, sans-serif'}}>
      {title === 'Prehospital' ? (
        <div style={{width:'100%',height:'calc(100vh - 48px)'}}>
          <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:8}}>
            <h2 style={{margin:0}}>Prehospital</h2>
            <span style={{fontFamily:'monospace',fontSize:18,color:'#007acc'}}>{clock}</span>
          </div>
          <MapPanel simTime={clock} />
        </div>
      ) : title === 'Paratus' ? (
        <div>
          <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:8}}>
            <h2 style={{margin:0}}>Paratus - Patienter under transport</h2>
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
                  <th style={th}>Behandling</th>
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
                      <td style={td}>{p.treatment ? `✓ ${p.treatment}` : '-'}</td>
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
                      updated[key] = prev[key].filter(p => p.id !== patientId);
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
                                      updated[key] = prev[key].filter(x => x.id !== p.id);
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
              {patients.map((p, i) => (
                <tr key={p.id || i} style={{background:i%2?'#f9f9f9':'#fff'}}>
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
                  <td style={td}>{p.medications?.join(', ')||''}</td>
                  <td style={td}>{p.doctor || ''}</td>
                  <td style={td}>{p.nurse || ''}</td>
                  <td style={td}>
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
        </>
      )}
      {title === 'Avdelningar' && (
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
                  {(departmentPatients[activeDep]||[]).map((p, i) => (
                    <tr key={p.id || i} style={{background:i%2?'#f9f9f9':'#fff'}}>
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
                      <td style={td}>{p.medications?.join(', ')||''}</td>
                      <td style={td}>{p.doctor || ''}</td>
                      <td style={td}>{p.nurse || ''}</td>
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
          )}
        </>
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
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13,background:'#fff',color:'#222'}}>
              <thead>
                <tr style={{background:'#fff',color:'#222'}}>
                  <th style={th}>Starttid</th>
                  <th style={th}>Personnummer</th>
                  <th style={th}>Namn</th>
                  <th style={th}>Operationskort</th>
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
                  updated[key] = prev[key].filter(p => p.id !== patientId);
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
                                  updated[key] = prev[key].filter(x => x.id !== p.id);
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
                              updated[key] = prev[key].filter(x => x.id !== p.id);
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
