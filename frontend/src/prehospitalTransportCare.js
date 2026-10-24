import { prehospitalActionDurations } from './components/prehospitalActionDurations.js';
import { actionRequirements } from './components/prehospitalResources.js';
import { scalePrehospitalWorkMinutes } from './weatherImpact.js';

const TRIAGE_COLORS = new Set(['Röd', 'Gul', 'Grön', 'Svart']);

function timeToMinutes(time) {
  const [hours, minutes] = String(time || '00:00').split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes) {
  const total = Math.floor(minutes);
  const hours = ((Math.floor(total / 60) % 24) + 24) % 24;
  const remainingMinutes = ((total % 60) + 60) % 60;
  return `${String(hours).padStart(2, '0')}:${String(remainingMinutes).padStart(2, '0')}`;
}

function hasTriage(patient) {
  return TRIAGE_COLORS.has(patient?.triage?.scene || patient?.triage);
}

export function buildTransportCarePlan(patient, {
  completedActionIds = [],
  transportMinutes = 0,
  departureTime = '00:00',
  environment = {}
} = {}) {
  const availableMinutes = Math.max(0, Number(transportMinutes) || 0);
  const completed = new Set(completedActionIds);
  const candidates = [];
  const notCompleted = [];

  if (!hasTriage(patient)) {
    candidates.push({ kind: 'triage', durationMinutes: scalePrehospitalWorkMinutes(1, environment) });
  }

  const requestedActions = Array.isArray(patient?.actions) ? patient.actions : [];
  const actionIds = [...new Set(requestedActions)].sort((left, right) => (
    (actionRequirements[left]?.order || Number.MAX_SAFE_INTEGER) -
    (actionRequirements[right]?.order || Number.MAX_SAFE_INTEGER)
  ));
  for (const actionId of actionIds) {
    if (completed.has(actionId)) continue;
    const baseDuration = prehospitalActionDurations[actionId] ?? actionRequirements[actionId]?.duration ?? 0;
    const durationMinutes = scalePrehospitalWorkMinutes(baseDuration, environment);
    if (durationMinutes > 0) candidates.push({ kind: 'action', actionId, durationMinutes });
    else notCompleted.push(actionId);
  }

  const treatment = patient?.requiredTreatment;
  if (treatment && !completed.has(treatment) && !actionIds.includes(treatment)) {
    const baseDuration = prehospitalActionDurations[treatment] ?? actionRequirements[treatment]?.duration ?? 0;
    const remainingMinutes = patient.treatment && !patient.treatmentCompleted && patient.treatmentEndTime !== undefined
      ? Math.max(0, (Number(patient.treatmentEndTime) - timeToMinutes(departureTime) + 1440) % 1440)
      : null;
    const durationMinutes = remainingMinutes === null
      ? scalePrehospitalWorkMinutes(baseDuration, environment)
      : remainingMinutes;
    if (!patient.treatmentCompleted && durationMinutes > 0) {
      candidates.push({ kind: 'treatment', actionId: treatment, durationMinutes });
    } else if (!patient.treatmentCompleted && durationMinutes === 0) {
      notCompleted.push(treatment);
    }
  }

  let elapsedMinutes = 0;
  const steps = [];
  for (const candidate of candidates) {
    if (elapsedMinutes + candidate.durationMinutes > availableMinutes) {
      if (candidate.actionId) notCompleted.push(candidate.actionId);
      continue;
    }
    elapsedMinutes += candidate.durationMinutes;
    steps.push({ ...candidate, completesAtMinute: elapsedMinutes });
  }

  return {
    departureTime,
    durationMinutes: availableMinutes,
    steps,
    notCompleted
  };
}

export function advanceTransportCare(patient, elapsedMinutes, triagePatient) {
  const plan = patient?.transportCarePlan;
  if (!plan || !Array.isArray(plan.steps)) return patient;

  const elapsed = Math.max(0, Number(elapsedMinutes) || 0);
  const completedSteps = new Set(plan.completedSteps || []);
  const completedActions = new Set(patient.prehospitalCompletedActions || []);
  let triage = patient.triage;
  let triageCompleted = patient.triageCompleted;
  const notes = [...(Array.isArray(patient.transportCareNotes) ? patient.transportCareNotes : [])];
  let changed = false;

  for (let index = 0; index < plan.steps.length; index += 1) {
    const step = plan.steps[index];
    if (completedSteps.has(index) || elapsed < step.completesAtMinute) continue;

    if (step.kind === 'triage') {
      const triageColor = triagePatient(patient);
      triage = { ...(typeof triage === 'object' ? triage : {}), scene: triageColor };
      triageCompleted = true;
      notes.push(`${minutesToTime(timeToMinutes(plan.departureTime) + step.completesAtMinute)}: Triage utförd under transport (${triageColor})`);
      changed = true;
    } else {
      completedActions.add(step.actionId);
      const actionLabel = actionRequirements[step.actionId]?.label || step.actionId;
      notes.push(`${minutesToTime(timeToMinutes(plan.departureTime) + step.completesAtMinute)}: ${actionLabel} utförd under transport`);
      if (step.actionId === patient.requiredTreatment) {
        patient = { ...patient, treatment: patient.treatment || step.actionId, treatmentCompleted: true };
      }
      changed = true;
    }
    completedSteps.add(index);
  }

  if (!changed) return patient;

  return {
    ...patient,
    triage,
    triageCompleted,
    prehospitalCompletedActions: [...completedActions],
    transportCareNotes: notes,
    transportCarePlan: { ...plan, completedSteps: [...completedSteps] }
  };
}