import React, { useEffect, useState } from 'react';
import { HALSOCENTRALER, readApprovedHalsocentraler } from '../halsocentraler.js';

export default function Halsocentraler({ simTime = '00:00', hospital }) {
  const [approved, setApproved] = useState(readApprovedHalsocentraler);

  useEffect(() => {
    function syncApproved(e) {
      if (e && e.key && e.key !== 'approvedHalsocentraler') return;
      setApproved(readApprovedHalsocentraler());
    }
    window.addEventListener('storage', syncApproved);
    window.addEventListener('halsocentralerApprovalChanged', syncApproved);
    return () => {
      window.removeEventListener('storage', syncApproved);
      window.removeEventListener('halsocentralerApprovalChanged', syncApproved);
    };
  }, []);

  function openHalsocentral(namn) {
    const url = `/window?title=${encodeURIComponent(namn)}&hospital=${encodeURIComponent(hospital || '')}`;
    window.open(url, '_blank');
  }

  return (
    <main style={{maxWidth:800,margin:'0 auto',padding:'8px 4px',color:'#1d303a'}}>
      <header style={{display:'flex',justifyContent:'space-between',alignItems:'end',gap:16,flexWrap:'wrap',borderBottom:'2px solid #087f91',paddingBottom:14,marginBottom:22}}>
        <h2 style={{margin:0,fontSize:25,color:'#075078'}}>Hälsocentraler</h2>
        <div style={{fontFamily:'monospace',fontSize:19,color:'#075078'}}>{simTime}</div>
      </header>
      <p style={{margin:'0 0 14px',fontSize:13,color:'#5e6b70'}}>Klicka på en hälsocentral för att öppna dess patientlista. Endast hälsocentraler som LSSL godkänt kan ta emot patienter.</p>
      <ul style={{listStyle:'none',margin:0,padding:0,border:'1px solid #d9e0e3'}}>
        {HALSOCENTRALER.map((namn, index) => {
          const isApproved = approved.includes(namn);
          return (
            <li key={namn} style={{borderBottom:'1px solid #d9e0e3'}}>
              <button
                type="button"
                onClick={() => openHalsocentral(namn)}
                style={{
                  width:'100%',
                  display:'flex',
                  justifyContent:'space-between',
                  alignItems:'center',
                  gap:12,
                  padding:'10px 16px',
                  fontSize:15,
                  textAlign:'left',
                  background:index % 2 ? '#f9f9f9' : '#fff',
                  border:'none',
                  cursor:'pointer',
                  color:'#1d303a'
                }}
              >
                <span>{namn}</span>
                <span style={{
                  fontSize:12,
                  fontWeight:700,
                  padding:'3px 9px',
                  borderRadius:12,
                  whiteSpace:'nowrap',
                  background:isApproved ? '#e8f5e9' : '#fdecea',
                  color:isApproved ? '#2e7d32' : '#a12622'
                }}>
                  {isApproved ? '✓ Godkänd av LSSL' : 'Ej godkänd'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
