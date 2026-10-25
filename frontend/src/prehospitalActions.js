const EXTREMITY_TERMS = [
  'arm', 'hand', 'finger', 'ben', 'lår', 'underben', 'fot', 'fots', 'extremitet', 'extremitets',
  'limb', 'leg', 'thigh', 'forearm', 'upper arm'
];
const JUNCTIONAL_TERMS = [
  'ljumske', 'ljumsk', 'armhåla', 'axill', 'hals', 'neck', 'groin', 'armpit', 'axilla',
  'övergångsskada', 'junctional'
];
const NONCOMPRESSIBLE_TERMS = [
  'buk', 'bukvägg', 'abdomen', 'abdominal', 'thorax', 'bröst', 'chest', 'skall', 'kranium', 'huvud', 'head'
];
const AIRWAY_ACTIONS = new Set(['fri_luftvag', 'svalgtub', 'intubering', 'i-gel']);

function normalize(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('sv');
}

function injuryText(patient) {
  const xabcde = patient.XABCDE || patient.ABCDE || {};
  return normalize([
    patient.injuryDescription,
    patient.mechanism,
    patient.bleedingLocation,
    patient.hemorrhageLocation,
    patient.woundLocation,
    patient.injuryLocation,
    xabcde.X?.BleedingLocation,
    xabcde.X?.location,
    xabcde.C?.BleedingLocation,
    xabcde.C?.location
  ].filter(Boolean).join(' '));
}

export function classifyBleedingSite(patient) {
  const text = injuryText(patient);
  if (NONCOMPRESSIBLE_TERMS.some(term => text.includes(normalize(term)))) return 'noncompressible';
  if (JUNCTIONAL_TERMS.some(term => text.includes(normalize(term)))) return 'junctional';
  if (EXTREMITY_TERMS.some(term => text.includes(normalize(term)))) return 'extremity';
  return 'unknown';
}

function hasActiveExternalXBleeding(patient) {
  const xabcde = patient.XABCDE || patient.ABCDE || {};
  const exanguination = normalize(xabcde.X?.Exanguination || xabcde.X?.exanguination);
  return ['massiv', 'riklig', 'aktiv blödning', 'massiv blödning'].some(value => exanguination.includes(value));
}

function hasControlledExternalXBleeding(patient) {
  const xabcde = patient.XABCDE || patient.ABCDE || {};
  const exanguination = normalize(xabcde.X?.Exanguination || xabcde.X?.exanguination);
  return ['kontrollerad', 'stoppad'].includes(exanguination);
}

export function getRecommendedBleedingAction(patient) {
  if (!hasActiveExternalXBleeding(patient)) return null;
  const site = classifyBleedingSite(patient);
  if (site === 'extremity') return 'tourniquet';
  if (site === 'junctional') return 'sårpackning';
  return null;
}

export function isPrehospitalActionApplicable(patient, actionId) {
  if (['tourniquet', 'sårpackning', 'tryckförband'].includes(actionId) && !hasActiveExternalXBleeding(patient)) {
    return false;
  }
  const site = classifyBleedingSite(patient);
  if (actionId === 'tourniquet') return site === 'extremity';
  if (actionId === 'sårpackning') return site === 'junctional';
  if (actionId === 'tryckförband') return site === 'extremity' || site === 'junctional';
  return true;
}

export function controlsPatientBleeding(patient, actionIds) {
  if (!hasActiveExternalXBleeding(patient) && !hasControlledExternalXBleeding(patient)) return false;
  const site = classifyBleedingSite(patient);
  const actions = new Set(actionIds || []);

  if (site === 'extremity') {
    return actions.has('tourniquet') || actions.has('tryckförband');
  }
  if (site === 'junctional') {
    return actions.has('sårpackning') || actions.has('tryckförband');
  }
  return false;
}

export function applyCompletedPrehospitalActions(patient, actionIds) {
  const actions = new Set(actionIds || []);
  if (!actions.size) return patient;
  const original = patient.XABCDE || patient.ABCDE;
  if (!original) return patient;

  const xabcde = {
    ...original,
    X: original.X ? { ...original.X } : original.X,
    A: original.A ? { ...original.A } : original.A,
    C: original.C ? { ...original.C } : original.C
  };
  let changed = false;

  if (controlsPatientBleeding(patient, actions)) {
    if (!xabcde.X) xabcde.X = {};
    if (!xabcde.C) xabcde.C = {};
    if ('exanguination' in xabcde.X && !('Exanguination' in xabcde.X)) xabcde.X.exanguination = 'Kontrollerad';
    else xabcde.X.Exanguination = 'Kontrollerad';
    if ('bleeding' in xabcde.C && !('Bleeding' in xabcde.C)) xabcde.C.bleeding = 'Stoppad';
    else xabcde.C.Bleeding = 'Stoppad';
    changed = true;
  }

  if (actions.has('fri_luftvag') || actions.has('svalgtub')) {
    if (xabcde.A) {
      xabcde.A.airway = 'Fri';
      changed = true;
    }
  } else if (actions.has('intubering') || actions.has('i-gel')) {
    if (xabcde.A) {
      xabcde.A.airway = actions.has('intubering') ? 'Säkrad (intuberad)' : 'Säkrad (i-gel)';
      changed = true;
    }
  }

  if (!changed) return patient;
  return {
    ...patient,
    ...(patient.XABCDE ? { XABCDE: xabcde } : { ABCDE: xabcde }),
    prehospitalCompletedActions: [...new Set([...(patient.prehospitalCompletedActions || []), ...actions])],
    bleedingControlled: controlsPatientBleeding(patient, actions) || patient.bleedingControlled || false,
    airwaySecured: actionsHasAirwayAction(actions) || patient.airwaySecured || false
  };
}

function actionsHasAirwayAction(actions) {
  return [...actions].some(action => AIRWAY_ACTIONS.has(action));
}