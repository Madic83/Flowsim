import { getPatientDeteriorationFactor } from './weatherImpact.js';
import { classifyBleedingSite, controlsPatientBleeding } from './prehospitalActions.js';

const AIRWAY_ACTIONS = new Set(['fri_luftvag', 'svalgtub', 'intubering', 'i-gel']);
const CRITICAL_UNTREATED_MINUTES = 5;

function normalize(value) {
  return String(value || '').trim().toLocaleLowerCase('sv');
}

function getTriageColor(patient) {
  const triage = patient.prehospitalBaselineTriage || patient.triage;
  if (typeof triage === 'string') return triage;
  return triage?.scene || triage?.sorting || triage?.collectionPoint || triage?.emergencyDept || '';
}

function getLifeThreats(patient) {
  const xabcde = patient.XABCDE || patient.ABCDE || {};
  const xBleedingValues = [
    xabcde.X?.Exanguination,
    xabcde.X?.exanguination
  ].map(normalize);
  const cBleedingValues = [
    xabcde.C?.Bleeding,
    xabcde.C?.bleeding
  ].map(normalize);
  const airway = normalize(xabcde.A?.airway || xabcde.A?.Airway);
  const severeBleeding = values => values.some(bleeding => (
    ['massiv', 'riklig', 'aktiv blödning', 'massiv blödning'].some(value => bleeding.includes(value))
  ));
  const externalCompressibleSite = ['extremity', 'junctional'].includes(classifyBleedingSite(patient));
  return {
    bleeding: severeBleeding(cBleedingValues) || (externalCompressibleSite && severeBleeding(xBleedingValues)),
    airway: ['ej fri', 'ofri', 'hotad', 'blockerad', 'obstruerad'].some(value => airway.includes(value))
  };
}

function getActionIds(patient, completedActions, activeActions) {
  const patientActions = completedActions?.[patient.id] || patient.prehospitalCompletedActions || [];
  return new Set([
    ...(Array.isArray(patientActions) ? patientActions : []),
    ...(Array.isArray(activeActions) ? activeActions : []),
    ...(patient.treatment ? [patient.treatment] : [])
  ]);
}

function isLifeThreatManaged(patient, threats, actionIds) {
  const hasBleedingControl = controlsPatientBleeding(patient, actionIds);
  const hasAirwaySupport = [...actionIds].some(action => AIRWAY_ACTIONS.has(action));
  return (!threats.bleeding || hasBleedingControl) && (!threats.airway || hasAirwaySupport);
}

function isOutside(patient) {
  const location = normalize(patient.location);
  return !location.includes('ambulans') && !location.includes('transport') && !location.includes('sjukhus');
}

function applyColdExposure(patient, xabcde, environment) {
  const temperature = Number(environment.temperatureC);
  const bodyTemperature = Number(xabcde.E?.Temp);
  if (!isOutside(patient) || !Number.isFinite(temperature) || temperature >= 10 || !Number.isFinite(bodyTemperature)) {
    return { xabcde, progress: Number(patient.coldExposureProgress) || 0, changed: false };
  }

  const progress = (Number(patient.coldExposureProgress) || 0) + Math.min(0.5, (10 - temperature) * 0.01);
  const coolingSteps = Math.floor(progress + Number.EPSILON * 8);
  const remainingProgress = progress - coolingSteps;
  if (coolingSteps === 0) {
    return {
      xabcde,
      progress: remainingProgress,
      changed: remainingProgress !== (Number(patient.coldExposureProgress) || 0)
    };
  }

  const updated = { ...xabcde, E: { ...xabcde.E, Temp: Math.max(25, bodyTemperature - coolingSteps) } };
  return { xabcde: updated, progress: remainingProgress, changed: updated.E.Temp !== bodyTemperature || remainingProgress !== (Number(patient.coldExposureProgress) || 0) };
}

function deteriorateVitals(xabcde, steps, gcsProgress) {
  if (steps <= 0) return { xabcde, gcsProgress, changed: false };
  const updated = {
    ...xabcde,
    B: xabcde.B ? { ...xabcde.B } : xabcde.B,
    C: xabcde.C ? { ...xabcde.C } : xabcde.C,
    D: xabcde.D ? { ...xabcde.D } : xabcde.D
  };
  let changed = false;

  if (Number.isFinite(Number(updated.B?.Sat))) {
    const value = Math.max(70, Number(updated.B.Sat) - steps);
    changed ||= value !== updated.B.Sat;
    updated.B.Sat = value;
  }
  if (Number.isFinite(Number(updated.B?.AF))) {
    const value = Math.min(40, Number(updated.B.AF) + steps);
    changed ||= value !== updated.B.AF;
    updated.B.AF = value;
  }
  if (Number.isFinite(Number(updated.C?.Puls))) {
    const value = Math.min(180, Number(updated.C.Puls) + 2 * steps);
    changed ||= value !== updated.C.Puls;
    updated.C.Puls = value;
  }
  if (typeof updated.C?.BT === 'string') {
    const [systolic, diastolic] = updated.C.BT.split('/').map(value => Number.parseInt(value, 10));
    if (Number.isFinite(systolic) && Number.isFinite(diastolic)) {
      const value = `${Math.max(60, systolic - 2 * steps)}/${Math.max(40, diastolic - steps)}`;
      changed ||= value !== updated.C.BT;
      updated.C.BT = value;
    }
  }

  const nextGcsProgress = gcsProgress + steps / 2;
  const gcsLoss = Math.floor(nextGcsProgress);
  const remainingGcsProgress = nextGcsProgress - gcsLoss;
  if (Number.isFinite(Number(updated.D?.GCS)) && gcsLoss > 0) {
    const value = Math.max(3, Number(updated.D.GCS) - gcsLoss);
    changed ||= value !== updated.D.GCS;
    updated.D.GCS = value;
  }
  return { xabcde: updated, gcsProgress: remainingGcsProgress, changed: changed || remainingGcsProgress !== gcsProgress };
}

function improveVitals(xabcde) {
  const updated = {
    ...xabcde,
    B: xabcde.B ? { ...xabcde.B } : xabcde.B,
    C: xabcde.C ? { ...xabcde.C } : xabcde.C,
    D: xabcde.D ? { ...xabcde.D } : xabcde.D
  };
  if (typeof updated.C?.BT === 'string') {
    const [systolic, diastolic] = updated.C.BT.split('/').map(value => Number.parseInt(value, 10));
    if (Number.isFinite(systolic) && Number.isFinite(diastolic)) updated.C.BT = `${Math.min(120, systolic + 2)}/${Math.min(70, diastolic + 1)}`;
  }
  if (Number.isFinite(Number(updated.C?.Puls))) updated.C.Puls = Math.max(80, Number(updated.C.Puls) - 2);
  if (Number.isFinite(Number(updated.B?.Sat))) updated.B.Sat = Math.min(98, Number(updated.B.Sat) + 2);
  if (Number.isFinite(Number(updated.B?.AF))) updated.B.AF = Math.max(16, Number(updated.B.AF) - 1);
  if (Number.isFinite(Number(updated.D?.GCS))) updated.D.GCS = Math.min(15, Number(updated.D.GCS) + 1);
  return updated;
}

function getCriticalVitalState(xabcde) {
  const systolic = typeof xabcde.C?.BT === 'string'
    ? Number.parseInt(xabcde.C.BT.split('/')[0], 10)
    : Number.NaN;
  const pulse = Number(xabcde.C?.Puls);
  const saturation = Number(xabcde.B?.Sat);
  const respiratoryRate = Number(xabcde.B?.AF);
  const gcs = Number(xabcde.D?.GCS);
  const severeSigns = [
    Number.isFinite(saturation) && saturation <= 75,
    Number.isFinite(systolic) && systolic <= 70,
    Number.isFinite(gcs) && gcs <= 5,
    Number.isFinite(respiratoryRate) && (respiratoryRate <= 5 || respiratoryRate >= 40),
    Number.isFinite(pulse) && (pulse <= 40 || pulse >= 170)
  ].filter(Boolean).length;
  const extremeSign = saturation <= 70 || systolic <= 60 || gcs <= 3 || respiratoryRate === 0 || pulse <= 30 || pulse >= 180;
  return extremeSign || severeSigns >= 2;
}

export function advancePrehospitalPatient(patient, environment = {}, { completedActions = {}, activeActions = [], simTime = '' } = {}) {
  if (patient.status === 'avliden' || patient.location === 'Uppsamlingsplats döda') return patient;

  const sourceXabcde = patient.XABCDE || patient.ABCDE;
  if (!sourceXabcde) return patient;
  let xabcde = JSON.parse(JSON.stringify(sourceXabcde));
  let changed = false;
  const threats = getLifeThreats(patient);
  const actionIds = getActionIds(patient, completedActions, activeActions);
  const untreatedThreat = (threats.bleeding || threats.airway) && !isLifeThreatManaged(patient, threats, actionIds);
  const lifeThreatManaged = (threats.bleeding || threats.airway) && !untreatedThreat;
  let criticalUntreatedMinutes = Number(patient.criticalUntreatedMinutes) || 0;

  if (untreatedThreat) {
    criticalUntreatedMinutes += 1;
    changed = true;
  } else if (criticalUntreatedMinutes !== 0) {
    criticalUntreatedMinutes = 0;
    changed = true;
  }

  if (untreatedThreat && criticalUntreatedMinutes >= CRITICAL_UNTREATED_MINUTES) {
    return {
      ...patient,
      status: 'avliden',
      location: 'Uppsamlingsplats döda',
      deathTime: simTime,
      criticalUntreatedMinutes
    };
  }

  const triageColor = normalize(getTriageColor(patient));
  const greenPatient = triageColor === 'grön' && !untreatedThreat;
  const completedTreatment = patient.treatment && patient.requiredTreatment && patient.treatment === patient.requiredTreatment;
  const completedPrehospitalCare = patient.bleedingControlled || patient.airwaySecured;
  let deteriorationProgress = Number(patient.weatherDeteriorationProgress) || 0;
  let gcsProgress = Number(patient.weatherGcsProgress) || 0;
  if (!greenPatient && !completedTreatment) {
    if (!lifeThreatManaged) {
      const severityMultiplier = (untreatedThreat ? 2 : triageColor === 'röd' ? 2 : triageColor === 'orange' ? 1.25 : triageColor === 'gul' ? 0.5 : 1)
        * (completedPrehospitalCare ? 0.5 : 1);
      deteriorationProgress += getPatientDeteriorationFactor(environment) * severityMultiplier / 2;
      const steps = Math.floor(deteriorationProgress);
      deteriorationProgress -= steps;
      const deteriorated = deteriorateVitals(xabcde, steps, gcsProgress);
      xabcde = deteriorated.xabcde;
      gcsProgress = deteriorated.gcsProgress;
      changed ||= deteriorated.changed || deteriorationProgress !== (Number(patient.weatherDeteriorationProgress) || 0);
    }
  } else if (completedTreatment) {
    xabcde = improveVitals(xabcde);
    changed = true;
  }

  const cooling = applyColdExposure({ ...patient, coldExposureProgress: patient.coldExposureProgress }, xabcde, environment);
  xabcde = cooling.xabcde;
  changed ||= cooling.changed;

  const criticalVitalsMinutes = getCriticalVitalState(xabcde)
    ? (Number(patient.criticalVitalsMinutes) || 0) + 1
    : 0;
  if (criticalVitalsMinutes !== (Number(patient.criticalVitalsMinutes) || 0)) changed = true;
  if (criticalVitalsMinutes >= CRITICAL_UNTREATED_MINUTES) {
    return {
      ...patient,
      ...(patient.XABCDE ? { XABCDE: xabcde } : { ABCDE: xabcde }),
      status: 'avliden',
      location: 'Uppsamlingsplats döda',
      deathTime: simTime,
      criticalUntreatedMinutes,
      criticalVitalsMinutes,
      weatherDeteriorationProgress: deteriorationProgress,
      weatherGcsProgress: gcsProgress,
      coldExposureProgress: cooling.progress
    };
  }

  const updated = {
    ...patient,
    ...(patient.XABCDE ? { XABCDE: xabcde } : { ABCDE: xabcde }),
    weatherDeteriorationProgress: deteriorationProgress,
    weatherGcsProgress: gcsProgress,
    criticalUntreatedMinutes,
    criticalVitalsMinutes,
    coldExposureProgress: cooling.progress
  };
  const nextStatus = greenPatient
    ? (cooling.changed ? 'nedkyls' : patient.status || 'stabil')
    : completedTreatment
      ? 'förbättras'
      : lifeThreatManaged
        ? 'stabil'
        : 'försämras';
  if (updated.status !== nextStatus) changed = true;
  updated.status = nextStatus;
  return changed ? updated : patient;
}