import React, { useEffect, useState } from 'react';

// Komponent för att visa medicinskt inriktningsbeslut
function MedicalDirectiveBanner() {
  const [medicalDirective, setMedicalDirective] = useState(() => {
    return localStorage.getItem('medicalDirective') || 'Inget inriktningsbeslut';
  });

  useEffect(() => {
    function handleDirectiveChange(e) {
      const newDirective = e.detail?.medicalDirective || localStorage.getItem('medicalDirective') || 'Inget inriktningsbeslut';
      setMedicalDirective(newDirective);
    }
    
    // Lyssna på meddelanden från huvudfönstret
    function handleMessage(event) {
      if (event.data && event.data.type === 'medicalDirective') {
        setMedicalDirective(event.data.medicalDirective);
        localStorage.setItem('medicalDirective', event.data.medicalDirective);
      }
    }
    
    window.addEventListener('medicalDirectiveChanged', handleDirectiveChange);
    window.addEventListener('message', handleMessage);
    window.addEventListener('storage', handleDirectiveChange);
    
    return () => {
      window.removeEventListener('medicalDirectiveChanged', handleDirectiveChange);
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('storage', handleDirectiveChange);
    };
  }, []);

  if (medicalDirective === 'Inget inriktningsbeslut') return null;

  return (
    <div style={{
      background: '#fff3cd',
      border: '3px solid #ffc107',
      borderRadius: 8,
      padding: '16px 24px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      marginBottom: 16,
      textAlign: 'center'
    }}>
      <div style={{
        fontWeight: 700,
        fontSize: 18,
        color: '#856404',
        marginBottom: 4
      }}>
        ⚠️ AKTIVT MEDICINSKT INRIKTNINGSBESLUT
      </div>
      <div style={{
        fontSize: 16,
        color: '#856404',
        fontWeight: 600
      }}>
        {medicalDirective}
      </div>
    </div>
  );
}

export default function Hem() {
    useEffect(() => {
      console.log('[Hem] COMPONENT RENDERED!');
    }, []);
  const [patients, setPatients] = useState([]);

  useEffect(() => {
    function loadHemPatients(event) {
      try {
        const depData = JSON.parse(localStorage.getItem('departmentPatients') || '{}');
        const hemPatients = depData['Hem'] || [];
        console.log('[Hem] loadHemPatients called. Event:', event, 'Loaded patients:', hemPatients);
        setPatients(Array.isArray(hemPatients) ? hemPatients : []);
      } catch (e) {
        console.log('[Hem] loadHemPatients error:', e);
        setPatients([]);
      }
    }
    loadHemPatients('init');
    window.addEventListener('storage', loadHemPatients);
    return () => {
      window.removeEventListener('storage', loadHemPatients);
    };
  }, []);

  useEffect(() => {
    console.log('[Hem] patients state updated:', patients);
  }, [patients]);

  return (
    <div style={{ padding: 32, fontFamily: 'Arial, sans-serif' }}>
      <MedicalDirectiveBanner />
      <h2>Hem</h2>
      <p>Här visas patienter som blivit skickade hem från akutmottagningen.</p>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:14,marginTop:24}}>
        <thead>
          <tr style={{background:'#e0e0e0'}}>
            <th style={{border:'1px solid #ccc',padding:'4px 8px'}}>Personnummer</th>
            <th style={{border:'1px solid #ccc',padding:'4px 8px'}}>Namn</th>
            <th style={{border:'1px solid #ccc',padding:'4px 8px'}}>Starttid</th>
            <th style={{border:'1px solid #ccc',padding:'4px 8px'}}>Triage</th>
            <th style={{border:'1px solid #ccc',padding:'4px 8px'}}>Orsak</th>
          </tr>
        </thead>
        <tbody>
          {patients.length === 0 ? (
            <tr><td colSpan={5} style={{textAlign:'center',color:'#888'}}>Inga patienter har skickats hem ännu.</td></tr>
          ) : patients.map((p, i) => (
            <tr key={p.id || i} style={{background:i%2?'#f9f9f9':'#fff'}}>
              <td style={{border:'1px solid #ccc',padding:'4px 8px'}}>{p.personnummer}</td>
              <td style={{border:'1px solid #ccc',padding:'4px 8px'}}>{typeof p.name === 'object' ? (p.name?.name || p.name?.fornamn || 'Patient') : p.name}{p.surname ? ' ' + p.surname : ''}</td>
              <td style={{border:'1px solid #ccc',padding:'4px 8px'}}>{p.startTime || ''}</td>
              <td style={{border:'1px solid #ccc',padding:'4px 8px'}}>
                {typeof p.triage === 'object'
                  ? (p.triage?.emergencyDept || p.triage?.scene || '')
                  : (p.triage || '')}
              </td>
              <td style={{border:'1px solid #ccc',padding:'4px 8px'}}>{p.mechanism || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
