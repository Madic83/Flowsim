import React, { useState, useEffect } from 'react';

export default function OPScheduleTable({ activeDep, simTime }) {
      // Läs in sal-data från localStorage vid start och när localStorage ändras
      useEffect(() => {
        // Flytta patient tillbaka till OP-listan
        function handleMovePatientBackToOP(e) {
          const { patientId } = e.detail;
          let departmentPatients = {};
          try {
            departmentPatients = JSON.parse(localStorage.getItem('departmentPatients') || '{}');
          } catch {}
          // Hitta och ta bort patienten från alla salar
          let patientObj = null;
          for (const s in departmentPatients) {
            if (s.startsWith('Sal ')) {
              for (const h in departmentPatients[s]) {
                if (departmentPatients[s][h]?.id === patientId) {
                  patientObj = departmentPatients[s][h];
                  delete departmentPatients[s][h];
                }
              }
            }
          }
          // Lägg tillbaka patienten i OP-listan om inte redan där
          if (patientObj) {
            const opList = departmentPatients['OP'] || [];
            if (!opList.some(p => p.id === patientId)) {
              departmentPatients['OP'] = [...opList, patientObj];
            }
            localStorage.setItem('departmentPatients', JSON.stringify(departmentPatients));
            window.dispatchEvent(new CustomEvent('departmentPatientsUpdated', { detail: { departmentPatients } }));
            // Uppdatera salPatients direkt
            setSalPatients(prev => {
              let newState = { ...prev };
              for (const s in newState) {
                for (const h in newState[s]) {
                  if (newState[s][h]?.id === patientId) {
                    delete newState[s][h];
                  }
                }
              }
              return newState;
            });
          }
        }
        window.addEventListener('movePatientBackToOP', handleMovePatientBackToOP);
        function updateSalPatients() {
          let departmentPatients = {};
          try {
            departmentPatients = JSON.parse(localStorage.getItem('departmentPatients') || '{}');
          } catch {}
          // Filtrera ut salar för aktuell avdelning
          const newSalPatients = {};
          Object.keys(departmentPatients).forEach(key => {
            if (key.startsWith('Sal ')) {
              newSalPatients[key] = departmentPatients[key];
            }
          });
          setSalPatients(newSalPatients);
        }
        updateSalPatients();
        window.addEventListener('storage', updateSalPatients);
        window.addEventListener('departmentPatientsUpdated', updateSalPatients);
        return () => {
          window.removeEventListener('movePatientBackToOP', handleMovePatientBackToOP);
          window.removeEventListener('storage', updateSalPatients);
          window.removeEventListener('departmentPatientsUpdated', updateSalPatients);
        };
      }, []);
    const [modalPatient, setModalPatient] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
  const [date, setDate] = useState(new Date());
  const [dragOverSal, setDragOverSal] = useState(null);
  const [dragOverHour, setDragOverHour] = useState(null);
  // salPatients: { sal: { hour: patientObj } }
  const [salPatients, setSalPatients] = useState({});

  // Felmeddelande för bemanning
  const [staffError, setStaffError] = useState("");

  // Hantera drop från akutlistan
  useEffect(() => {
    function handleDropPatient(e) {
      const { patient, sal, hour, toAkut } = e.detail;
      // Kontrollera bemanning innan operation kan starta
      if (!toAkut) {
        const config = JSON.parse(localStorage.getItem('hospitalPersonnelConfig') || '{}');
        // Kolla grundroller
        const missing = [];
        if ((config.narkosskoterskor || 0) < 1) missing.push('narkossköterska');
        if ((config.narkoslakare || 0) < 1) missing.push('narkosläkare');
        if ((config.operationsskoterskor || 0) < 1) missing.push('operationssköterska');
        if ((config.usk_op || 0) < 1) missing.push('undersköterska operation');
        // Kolla operatör beroende på patientens enhet
        let opUnit = '';
        if (patient.outcome?.ward) opUnit = patient.outcome.ward.toLowerCase();
        if (opUnit.includes('kirurg') && (config.kirurger || 0) < 1) missing.push('kirurg');
        if (opUnit.includes('ortoped') && (config.ortopeder || 0) < 1) missing.push('ortoped');
        if (opUnit.includes('thorax') && (config.kirurger || 0) < 1) missing.push('thoraxkirurg');
        if (opUnit.includes('neurokirurg') && (config.kirurger || 0) < 1) missing.push('neurokirurg');
        if (missing.length > 0) {
          setStaffError('Operation kan inte starta. Saknar: ' + missing.join(', '));
          return;
        } else {
          setStaffError("");
        }
      }
      // Update departmentPatients in localStorage
      let departmentPatients = {};
      try {
        departmentPatients = JSON.parse(localStorage.getItem('departmentPatients') || '{}');
      } catch {}
      // Remove patient from all sal assignments in departmentPatients
      for (const s in departmentPatients) {
        if (typeof departmentPatients[s] === 'object') {
          for (const h in departmentPatients[s]) {
            if (departmentPatients[s][h]?.id === patient.id) {
              delete departmentPatients[s][h];
            }
          }
        }
      }
      if (toAkut) {
        // Remove from OP list
        const opList = departmentPatients['OP'] || [];
        departmentPatients['OP'] = opList.filter(p => p.id !== patient.id);
        localStorage.setItem('departmentPatients', JSON.stringify(departmentPatients));
        window.dispatchEvent(new CustomEvent('removePatientFromOP', { detail: { patientId: patient.id } }));
        // Uppdatera salPatients direkt
        setSalPatients(prev => {
          let newState = { ...prev };
          for (const s in newState) {
            for (const h in newState[s]) {
              if (newState[s][h].id === patient.id) {
                delete newState[s][h];
              }
            }
          }
          return newState;
        });
        return;
      }
      // Add patient to new sal assignment in departmentPatients
      if (!departmentPatients[sal]) departmentPatients[sal] = {};
      departmentPatients[sal][hour] = patient;
      departmentPatients[sal][hour+1] = patient;
      departmentPatients[sal][hour+2] = patient;
      // Ta bort patienten från OP-listan om den finns där
      const opList = departmentPatients['OP'] || [];
      departmentPatients['OP'] = opList.filter(p => p.id !== patient.id);
      // Ta bort patienten från alla andra salar och tider
      for (const s in departmentPatients) {
        if (s.startsWith('Sal ')) {
          for (const h in departmentPatients[s]) {
            if (departmentPatients[s][h]?.id === patient.id && (s !== sal || h != hour)) {
              delete departmentPatients[s][h];
            }
          }
        }
      }
      localStorage.setItem('departmentPatients', JSON.stringify(departmentPatients));
      window.dispatchEvent(new CustomEvent('departmentPatientsUpdated', { detail: { departmentPatients } }));
      window.dispatchEvent(new CustomEvent('requestRemovePatientFromAkut', { detail: { patientId: patient.id } }));
      window.dispatchEvent(new CustomEvent('removePatientFromOP', { detail: { patientId: patient.id } }));
      // Uppdatera salPatients direkt
      setSalPatients(prev => {
        let newState = { ...prev };
        // Ta bort patienten från alla salar först
        for (const s in newState) {
          for (const h in newState[s]) {
            if (newState[s][h].id === patient.id && (s !== sal || h != hour)) {
              delete newState[s][h];
            }
          }
        }
        // Lägg till patienten på rätt sal och timmar
        if (!newState[sal]) newState[sal] = {};
        newState[sal][hour] = patient;
        newState[sal][hour+1] = patient;
        newState[sal][hour+2] = patient;
        return newState;
      });
    // Ta bort överflödig klammer
    }
    window.addEventListener('dropPatientToSal', handleDropPatient);
    return () => window.removeEventListener('dropPatientToSal', handleDropPatient);
  }, []);

  function formatDate(d) {
    return d.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  function addDays(d, n) {
    const copy = new Date(d);
    copy.setDate(copy.getDate() + n);
    return copy;
  }

  // Salar per avdelning
  let salNamn = [];
  if (activeDep === 'Cop 1') {
    salNamn = ['Sal 4', 'Sal 5', 'Sal 8', 'Sal 10', 'Sal 11', 'Sal 12', 'Sal 14'];
  } else if (activeDep === 'Cop 2') {
    salNamn = ['Sal 7', 'Sal 9', 'Sal 20', 'Sal 21', 'Sal 22', 'Sal 23', 'Sal 24', 'Sal 25', 'Sal 26', 'Sal 28', 'Sal 29', 'HplOP', 'INR'];
  } else if (activeDep === 'Cop 3') {
    salNamn = ['Sal 13', 'Sal 31', 'Sal 32', 'Sal 33', 'Sal 34', 'Sal 35', 'Sal 36', 'Sal 37', 'Kir Beh 3', 'IR 1', 'IR 2'];
  } else if (activeDep === 'Thorax op') {
    salNamn = ['Sal 1', 'Sal 2', 'Sal 3', 'Sal 6', 'PCI 1', 'PCI 2'];
  } else {
    const numSalar = 4;
    salNamn = Array.from({length: numSalar}, (_, i) => `Sal ${i+1}`);
  }

  return (
    <div>
      {staffError && (
        <div style={{background:'#ffe0e0',color:'#b71c1c',padding:12,borderRadius:6,marginBottom:12,fontWeight:600,position:'fixed',top:80,left:'50%',transform:'translateX(-50%)',zIndex:9999}}>
          {staffError}
          <button style={{marginLeft:16,padding:'4px 12px',fontSize:15,borderRadius:4,border:'1px solid #b71c1c',background:'#fff',color:'#b71c1c',cursor:'pointer'}} onClick={()=>setStaffError("")}>Stäng</button>
        </div>
      )}
      <div style={{display:'flex',alignItems:'center',marginBottom:8,gap:8}}>
        <button onClick={() => setDate(addDays(date, -1))} style={{padding:'4px 10px',fontSize:14}}>&lt; Föregående dag</button>
        <span style={{fontWeight:'bold',fontSize:16}}>{formatDate(date)}</span>
        <button onClick={() => setDate(addDays(date, 1))} style={{padding:'4px 10px',fontSize:14}}>Nästa dag &gt;</button>
      </div>
      <table style={{borderCollapse:'collapse',width:'100%',fontSize:13,tableLayout:'fixed'}}>
        <colgroup>
          <col style={{width:120}} />
          {[...Array(24)].map((_, i) => (
            <col key={i} style={{width:40}} />
          ))}
        </colgroup>
        <thead>
          <tr style={{background:'#ffe0a0'}}>
            <th style={{border:'1px solid #ccc',padding:'4px 8px',background:'#ffe0a0',fontWeight:'bold',minWidth:120}}>{activeDep}</th>
            {[...Array(24)].map((_, i) => (
              <th key={i} style={{border:'1px solid #ccc',padding:'4px 8px',background:'#ffe0a0',fontWeight:'bold',minWidth:32}}>{i.toString().padStart(2,'0')}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {salNamn.map(sal => (
            <tr key={sal}>
              <td style={{border:'1px solid #ccc',padding:'4px 8px',background:'#f9f9f9',fontWeight:'bold'}}>{sal}</td>
              {[...Array(24)].map((_, hour) => {
                // Visa patient om placerad på denna sal och timme
                const patient = salPatients[sal]?.[hour];
                // Visa info endast om detta är första timmen patienten är placerad på denna sal
                let showInfo = false;
                if (patient) {
                  // Om patienten inte finns på timmen innan, visa info
                  const prevHourPatient = salPatients[sal]?.[hour-1];
                  if (!prevHourPatient || prevHourPatient.id !== patient.id) {
                    showInfo = true;
                  }
                }
                // Hämta aktuell simulerad timme från simTime-prop
                let simHour = null;
                if (simTime) {
                  simHour = parseInt(simTime.split(':')[0], 10);
                }
                // Om simHour matchar denna kolumn, rendera en röd vertikal linje
                return (
                  <td
                    key={hour}
                    style={{
                      border: patient ? 'none' : '1px solid #ccc',
                      padding:'4px 8px',
                      height:32,
                      background:
                        patient
                          ? (dragOverSal === sal && dragOverHour === hour ? '#e3f2fd' : '#d0ffd0')
                          : (dragOverSal === sal && dragOverHour === hour ? '#e3f2fd' : undefined),
                      position:'relative',
                      minWidth: 32,
                      cursor: patient ? 'grab' : 'pointer',
                    }}
                    draggable={!!patient}
                    onDragStart={patient ? (e => {
                      e.dataTransfer.setData('application/patient-id', patient.id);
                    }) : undefined}
                    onDragOver={e => {
                      e.preventDefault();
                      setDragOverSal(sal);
                      setDragOverHour(hour);
                    }}
                    onDragLeave={e => {
                      setDragOverSal(null);
                      setDragOverHour(null);
                    }}
                    onDrop={e => {
                      e.preventDefault();
                      setDragOverSal(null);
                      setDragOverHour(null);
                      const patientId = e.dataTransfer.getData('application/patient-id');
                      let simHour = null;
                      if (simTime) {
                        simHour = parseInt(simTime.split(':')[0], 10);
                      }
                      if (hour < simHour) {
                        setStaffError('OBS: Tiden för operationsstart har passerat!');
                        return;
                      }
                      if (patientId) {
                        // Hämta patientobjektet från OP-listan
                        let departmentPatients = {};
                        try { departmentPatients = JSON.parse(localStorage.getItem('departmentPatients') || '{}'); } catch {}
                        const opList = departmentPatients['OP'] || [];
                        const patient = opList.find(p => p.id === patientId);
                        if (patient) {
                          // Kontrollera bemanning
                          const config = JSON.parse(localStorage.getItem('hospitalPersonnelConfig') || '{}');
                          const missing = [];
                          if ((config.narkosskoterskor || 0) < 1) missing.push('narkossköterska');
                          if ((config.narkoslakare || 0) < 1) missing.push('narkosläkare');
                          if ((config.operationsskoterskor || 0) < 1) missing.push('operationssköterska');
                          if ((config.usk_op || 0) < 1) missing.push('undersköterska operation');
                          let opUnit = '';
                          if (patient.outcome?.ward) opUnit = patient.outcome.ward.toLowerCase();
                          if (opUnit.includes('kirurg') && (config.kirurger || 0) < 1) missing.push('kirurg');
                          if (opUnit.includes('ortoped') && (config.ortopeder || 0) < 1) missing.push('ortoped');
                          if (opUnit.includes('thorax') && (config.kirurger || 0) < 1) missing.push('thoraxkirurg');
                          if (opUnit.includes('neurokirurg') && (config.kirurger || 0) < 1) missing.push('neurokirurg');
                          if (missing.length > 0) {
                            setStaffError('Operation kan inte starta. Saknar: ' + missing.join(', '));
                            return;
                          } else {
                            setStaffError("");
                          }
                        }
                        // Flytta patient till denna sal och timme
                        setTimeout(() => {
                          const event = new CustomEvent('getPatientById', { detail: { patientId, sal, hour } });
                          window.dispatchEvent(event);
                        }, 0);
                      }
                    }}
                  >
                    {/* Röd vertikal linje för aktuell tid */}
                    {simHour === hour ? (
                      <div style={{position:'absolute',top:0,bottom:0,left:0,right:0,pointerEvents:'none'}}>
                        <div style={{position:'absolute',top:0,bottom:0,left:'50%',width:2,background:'red',zIndex:20}} />
                      </div>
                    ) : null}
                    {patient && showInfo ? (
                      <div
                        style={{
                          fontWeight:'bold',
                          borderRadius:4,
                          cursor:'pointer',
                          background:'#d0ffd0', // Alltid grön ruta för patient på OP-sal
                          height:'100%',
                          width:'100%',
                          lineHeight:'24px',
                          overflow:'visible',
                          whiteSpace:'nowrap',
                          textOverflow:'clip',
                          position:'absolute',
                          left:0,
                          right:0,
                          top:0,
                          bottom:0,
                          zIndex:10,
                          boxSizing:'border-box',
                          border:'none',
                          boxShadow:'none',
                          display:'flex',
                          alignItems:'center',
                          justifyContent:'flex-start',
                          userSelect:'none',
                        }}
                        onClick={() => { setModalPatient(patient); setModalOpen(true); }}
                        draggable
                        onDragStart={e => {
                          e.dataTransfer.setData('application/patient-id', patient.id);
                        }}
                        onDoubleClick={e => {
                          // Dubbelklick: flytta tillbaka till akutlistan
                          window.dispatchEvent(new CustomEvent('dropPatientToSal', { detail: { patient, toAkut: true } }));
                        }}
                      >
                        {(() => {
                          let year = '';
                          if (patient.personnummer && /^\d{4}/.test(patient.personnummer)) {
                            year = patient.personnummer.substring(0,4);
                          }
                          let surgery = '';
                          if (patient.interventions && patient.interventions.Surgery) {
                            surgery = patient.interventions.Surgery;
                          }
                          return (surgery ? surgery : '') + (year ? ' ' + year : '');
                        })()}
                      </div>
                    ) : null}
                        {/* Modal för patientinfo - flyttad utanför cell-rendering */}
                        {modalOpen && modalPatient && (
                          <div style={{
                            position:'fixed',
                            top:'50%',
                            left:'50%',
                            transform:'translate(-50%, -50%)',
                            background:'#E3EFFF',
                            borderRadius:14,
                            boxShadow:'none',
                            padding:96,
                            minWidth:960,
                            maxWidth:1400,
                            zIndex:1000,
                          }}>
                            <h2 style={{marginTop:0,marginBottom:24,fontSize:28}}>Patientinformation</h2>
                            <div style={{marginBottom:18,fontSize:18}}><b>Opererande enhet:</b> {(() => {
                              const ward = modalPatient.outcome?.ward || '';
                              if (/kirurg/i.test(ward)) return 'Kirurg';
                              if (/ortoped/i.test(ward)) return 'Ortoped';
                              if (/thorax/i.test(ward)) return 'Thorax';
                              if (/neurokirurg/i.test(ward)) return 'Neurokirurg';
                              return ward ? ward : '-';
                            })()}</div>
                            <div style={{marginBottom:18,fontSize:18}}><b>Operation:</b> {modalPatient.interventions?.Surgery || '-'}</div>
                            <div style={{marginBottom:18,fontSize:18}}><b>Vikt:</b> {modalPatient.weight || modalPatient.vikt || '-'}</div>
                            <div style={{marginBottom:18,fontSize:18}}><b>Längd:</b> {modalPatient.height || modalPatient.längd || '-'}</div>
                            <button style={{marginTop:24,padding:'12px 28px',borderRadius:8,border:'1px solid #007acc',background:'#007acc',color:'#fff',cursor:'pointer',fontSize:18}} onClick={() => setModalOpen(false)}>Stäng</button>
                          </div>
                        )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
