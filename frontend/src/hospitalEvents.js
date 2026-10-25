import { elapsedSimulationMinutes } from './simulationTime.js';
import { createHospitalEventResponsePlan, createWaterOutageMessageSchedule } from './hospitalEventMessages.js';

export const HOSPITAL_EVENT_TYPES = [
  { id: 'power-outage', label: 'Elavbrott' },
  { id: 'it-outage', label: 'IT- / journalsystemavbrott' },
  { id: 'oxygen-disruption', label: 'Störning i syrgasförsörjning' },
  { id: 'water-outage', label: 'Vattenavbrott' },
  { id: 'custom', label: 'Egen händelse' }
];

export const HOSPITAL_EVENT_STORAGE_KEY = 'hospitalEvents';
export const UPS_TIMER_DURATION_MINUTES = 60;

export function createHospitalEvent({
  type,
  title,
  hospital,
  severity = 'high',
  description = '',
  simTime = '00:00'
}) {
  const eventType = HOSPITAL_EVENT_TYPES.find(item => item.id === type);
  const eventTitle = type === 'custom' ? String(title || '').trim() : eventType?.label;
  if (!eventTitle || !hospital) return null;

  const event = {
    id: globalThis.crypto?.randomUUID?.() || `event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    title: eventTitle,
    hospital,
    severity: ['low', 'medium', 'high'].includes(severity) ? severity : 'high',
    description: String(description).trim(),
    createdAtSimTime: simTime,
    status: 'active',
    resolvedAtSimTime: null
  };

  if (type === 'power-outage' && event.severity === 'high') {
    event.upsTimer = {
      startedAtSimTime: simTime,
      durationMinutes: UPS_TIMER_DURATION_MINUTES,
      status: 'running'
    };
  }

  if (hospital === 'Norrlands universitetssjukhus') {
    event.messageSchedule = createWaterOutageMessageSchedule();
    event.responsePlan = createHospitalEventResponsePlan(type);
  }

  return event;
}

export function getUpsTimerRemainingMinutes(event, simTime) {
  if (event?.type !== 'power-outage' || event.severity !== 'high' || !event.upsTimer || event.upsTimer.status !== 'running' || event.status !== 'active') {
    return null;
  }
  const elapsed = elapsedSimulationMinutes(event.upsTimer.startedAtSimTime, simTime);
  return Math.max(0, event.upsTimer.durationMinutes - elapsed);
}

export function readHospitalEvents(storage = globalThis.localStorage) {
  try {
    const events = JSON.parse(storage?.getItem(HOSPITAL_EVENT_STORAGE_KEY) || '[]');
    return Array.isArray(events) ? events : [];
  } catch {
    return [];
  }
}

export function writeHospitalEvents(events, storage = globalThis.localStorage, eventTarget = globalThis.window) {
  const safeEvents = Array.isArray(events) ? events : [];
  storage?.setItem(HOSPITAL_EVENT_STORAGE_KEY, JSON.stringify(safeEvents));
  if (eventTarget && typeof globalThis.CustomEvent === 'function') {
    eventTarget.dispatchEvent(new CustomEvent('hospitalEventsChanged', { detail: safeEvents }));
  }
  try {
    const sessionAuth = JSON.parse(storage?.getItem('flowsimSessionAuth') || 'null');
    if (sessionAuth?.sessionId && sessionAuth.sessionId !== 'ÖPPEN') {
      const request = globalThis.fetch?.(`/api/sessions/${encodeURIComponent(sessionAuth.sessionId)}/hospital-events`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hospitalEvents: safeEvents })
      });
      request?.catch(() => {});
    }
  } catch {}
}