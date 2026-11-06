import React from 'react';

const th = {border:'1px solid #ccc',padding:'4px 8px',background:'#e0e0e0',fontWeight:'bold'};
const td = {border:'1px solid #ccc',padding:'4px 8px'};

export default function HalsocentralWindow({ name, simTime = '00:00', departmentPatients, approved }) {
  const patients = Array.isArray(departmentPatients[name]) ? departmentPatients[name] : [];

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:12,flexWrap:'wrap'}}>
        <h2 style={{margin:0}}>{name}</h2>
        <span style={{fontFamily:'monospace',fontSize:18,color:'#007acc'}}>{simTime}</span>
        <span style={{
          fontSize:13,
          fontWeight:700,
          padding:'4px 10px',
          borderRadius:12,
          background:approved ? '#e8f5e9' : '#fdecea',
          color:approved ? '#2e7d32' : '#a12622'
        }}>
          {approved ? '✓ Godkänd av LSSL' : '✕ Ej godkänd av LSSL'}
        </span>
      </div>
      {!approved && (
        <div style={{marginBottom:12,padding:'8px 12px',background:'#fff3e0',border:'1px solid #ff9800',borderRadius:6,color:'#8a5a00',fontSize:13}}>
          LSSL har inte godkänt den här hälsocentralen för patientmottagning. Patienter kan inte skickas hit förrän den godkänns i LSSL-vyn.
        </div>
      )}
      <div style={{fontWeight:'bold',marginBottom:8}}>Antal patienter: {patients.length}</div>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
        <thead>
          <tr style={{background:'#e0e0e0'}}>
            <th style={th}>Starttid</th>
            <th style={th}>Personnummer</th>
            <th style={th}>Namn</th>
            <th style={th}>Triage</th>
            <th style={th}>Sökorsak</th>
            <th style={th}>Kommentar</th>
          </tr>
        </thead>
        <tbody>
          {patients.length === 0 ? (
            <tr><td colSpan={6} style={{textAlign:'center',color:'#888',padding:16}}>Inga patienter har skickats hit ännu.</td></tr>
          ) : patients.map((p, i) => (
            <tr key={p.id || i} style={{background:i % 2 ? '#f9f9f9' : '#fff'}}>
              <td style={td}>{p.startTime || ''}</td>
              <td style={td}>{p.personnummer || ''}</td>
              <td style={td}>{typeof p.name === 'object' ? (p.name?.name || p.name?.fornamn || 'Patient') : p.name}{p.surname ? ' ' + p.surname : ''}</td>
              <td style={td}>{typeof p.triage === 'object' ? (p.triage?.emergencyDept || p.triage?.scene || '') : (p.triage || '')}</td>
              <td style={td}>{p.cause || p.mechanism || ''}</td>
              <td style={td}>{p.comment || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
