import React, { useEffect, useState } from 'react';
import { getUpsTimerRemainingMinutes, readHospitalEvents } from '../hospitalEvents.js';
import { getHospitalEventMessages } from '../hospitalEventMessages.js';

const severityLabels = {
  low: 'Begränsad',
  medium: 'Allvarlig',
  high: 'Kritisk'
};

const severityColors = {
  low: '#54745b',
  medium: '#946200',
  high: '#a62e2e'
};

function EventCard({ event }) {
  const active = event.status === 'active';
  const color = severityColors[event.severity] || severityColors.medium;

  return (
    <article style={{borderLeft:`4px solid ${color}`,borderBottom:'1px solid #d9e0e3',padding:'14px 16px',display:'grid',gridTemplateColumns:'minmax(0,1fr) auto',gap:12,alignItems:'start'}}>
      <div>
        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:5}}>
          <strong style={{fontSize:16,color:'#17364a'}}>{event.title}</strong>
          <span style={{fontSize:12,fontWeight:700,color,background:`${color}16`,padding:'3px 7px',borderRadius:3}}>
            {severityLabels[event.severity] || severityLabels.medium}
          </span>
          <span style={{fontSize:12,color:active ? '#246b3d' : '#68767d',fontWeight:600}}>
            {active ? 'Pågår' : 'Avslutad'}
          </span>
        </div>
        <div style={{fontSize:13,color:'#43545d'}}>{event.hospital}</div>
        {event.description && <p style={{margin:'7px 0 0',fontSize:14,color:'#27363d',whiteSpace:'pre-wrap'}}>{event.description}</p>}
        <div style={{marginTop:8,fontSize:12,color:'#6b777d'}}>
          Start {event.createdAtSimTime || '--:--'}
          {!active && ` · Avslutad ${event.resolvedAtSimTime || '--:--'}`}
        </div>
      </div>
    </article>
  );
}

export default function LSSL({ simTime = '00:00', hospital }) {
  const [events, setEvents] = useState(readHospitalEvents);

  useEffect(() => {
    const syncEvents = event => {
      setEvents(Array.isArray(event?.detail) ? event.detail : readHospitalEvents());
    };
    window.addEventListener('hospitalEventsChanged', syncEvents);
    window.addEventListener('storage', syncEvents);
    return () => {
      window.removeEventListener('hospitalEventsChanged', syncEvents);
      window.removeEventListener('storage', syncEvents);
    };
  }, []);

  const visibleEvents = events.filter(event => !hospital || event.hospital === hospital);
  const activeEvents = visibleEvents.filter(event => event.status === 'active');
  const activeUpsEvents = activeEvents.filter(event => event.upsTimer?.status === 'running');
  const resolvedEvents = visibleEvents.filter(event => event.status !== 'active');
  const eventMessages = visibleEvents
    .flatMap(event => getHospitalEventMessages(event, simTime))
    .sort((left, right) => right.offsetMinutes - left.offsetMinutes || left.unit.localeCompare(right.unit, 'sv'));

  return (
    <main style={{maxWidth:1000,margin:'0 auto',padding:'8px 4px',color:'#1d303a'}}>
      <header style={{display:'flex',justifyContent:'space-between',alignItems:'end',gap:16,flexWrap:'wrap',borderBottom:'2px solid #087f91',paddingBottom:14,marginBottom:22}}>
        <div>
          <h2 style={{margin:'0 0 4px',fontSize:25,color:'#075078'}}>LSSL</h2>
          <div style={{fontSize:14,color:'#53636b'}}>{hospital || 'Sjukhusövergripande samverkan'}</div>
        </div>
        <div style={{fontFamily:'monospace',fontSize:19,color:'#075078'}}>{simTime}</div>
      </header>

      {activeUpsEvents.length > 0 && (
        <section aria-labelledby="lssl-ups-heading" style={{marginBottom:24,padding:'14px 16px',border:'1px solid #d7b8b8',borderLeft:'5px solid #a62e2e',background:'#fffafa'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:12,marginBottom:8}}>
            <h3 id="lssl-ups-heading" style={{margin:0,fontSize:18,color:'#7f2424'}}>UPS</h3>
          </div>
          {activeUpsEvents.map(event => {
          const remaining = getUpsTimerRemainingMinutes(event, simTime);
          return (
            <div key={event.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,padding:'8px 0',borderTop:'1px solid #eadada'}}>
              <div>
                <strong style={{fontSize:14,color:'#17364a'}}>{event.hospital}</strong>
                <div style={{fontSize:12,color:'#68767d',marginTop:2}}>Elavbrott · Start {event.upsTimer.startedAtSimTime}</div>
              </div>
              <div aria-live="polite" style={{fontFamily:'monospace',fontWeight:700,fontSize:20,color:remaining > 0 ? '#a62e2e' : '#6b2525',whiteSpace:'nowrap'}}>
                {remaining > 0 ? `${remaining} min kvar` : 'TID UTE'}
              </div>
            </div>
          );
          })}
        </section>
      )}

      <section aria-labelledby="lssl-messages-heading" style={{marginBottom:28}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:12,borderBottom:'1px solid #cbd5d9',paddingBottom:8,marginBottom:4}}>
          <h3 id="lssl-messages-heading" style={{margin:0,fontSize:18}}>Meddelanden från avdelningar och mottagningar</h3>
          <span style={{fontSize:13,color:'#617078'}}>{eventMessages.length} rapporter</span>
        </div>
        {eventMessages.length ? (
          <div style={{maxHeight:460,overflowY:'auto',border:'1px solid #d9e0e3',borderTop:0}}>
            {eventMessages.map(message => (
              <article key={message.id} style={{display:'grid',gridTemplateColumns:'62px minmax(0,1fr)',gap:12,padding:'12px 14px',borderBottom:'1px solid #d9e0e3',background:message.offsetMinutes === 0 ? '#f5fafb' : '#fff'}}>
                <time style={{fontFamily:'monospace',fontWeight:700,fontSize:14,color:'#075078',paddingTop:1}}>{message.simTime}</time>
                <div>
                  <div style={{display:'flex',alignItems:'center',gap:7,flexWrap:'wrap',marginBottom:4}}>
                    <strong style={{fontSize:14,color:'#17364a'}}>{message.unit}</strong>
                    <span style={{fontSize:11,color:'#5c6d74',background:'#edf2f4',padding:'2px 6px',borderRadius:3}}>{message.unitType}</span>
                    <span style={{fontSize:11,color:'#6b777d'}}>{message.eventTitle}</span>
                  </div>
                  <div style={{fontSize:14,lineHeight:1.45,color:'#27363d'}}>{message.message}</div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div style={{padding:'20px 14px',textAlign:'center',color:'#78858b'}}>Verksamhetsrapporter visas här när en vattenavbrottshändelse startas.</div>
        )}
      </section>

      <section aria-labelledby="lssl-active-heading" style={{marginBottom:28}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:12,borderBottom:'1px solid #cbd5d9',paddingBottom:8,marginBottom:4}}>
          <h3 id="lssl-active-heading" style={{margin:0,fontSize:18}}>Aktiva händelser</h3>
          <span style={{fontSize:13,color:'#617078'}}>{activeEvents.length} pågår</span>
        </div>
        {activeEvents.length ? activeEvents.map(event => (
          <EventCard key={event.id} event={event} />
        )) : (
          <div style={{padding:'24px 16px',textAlign:'center',color:'#78858b'}}>Inga aktiva händelser för det här sjukhuset.</div>
        )}
      </section>

      <section aria-labelledby="lssl-history-heading">
        <h3 id="lssl-history-heading" style={{margin:'0 0 4px',fontSize:18,borderBottom:'1px solid #cbd5d9',paddingBottom:8}}>Händelselogg</h3>
        {resolvedEvents.length ? resolvedEvents.slice().reverse().map(event => (
          <EventCard key={event.id} event={event} />
        )) : (
          <div style={{padding:'18px 16px',color:'#78858b'}}>Avslutade händelser visas här.</div>
        )}
      </section>
    </main>
  );
}