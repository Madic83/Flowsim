const TRIAGE_LOOKBACK_MINUTES = {
  grön: 240,
  gul: 150,
  orange: 90,
  röd: 60
};

function timeToMinutes(time) {
  const [hours, minutes] = String(time || '00:00').split(':').map(Number);
  return ((hours * 60 + minutes) % 1440 + 1440) % 1440;
}

function minutesToTime(minutes) {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const remainingMinutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(remainingMinutes).padStart(2, '0')}`;
}

function shuffle(values, random) {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

export function assignInitialAcuteStartTimes(patients, simulationStartTime, random = Math.random) {
  const startMinutes = timeToMinutes(simulationStartTime);
  const usedOffsets = new Set();
  const patientsWithLimits = patients.map((patient, index) => {
    const triage = String(patient.triage?.emergencyDept || patient.triage?.scene || patient.triage || '').toLocaleLowerCase('sv');
    return { patient, index, maxLookback: TRIAGE_LOOKBACK_MINUTES[triage] ?? TRIAGE_LOOKBACK_MINUTES.grön };
  });
  const assignmentOrder = patientsWithLimits.sort((left, right) => left.maxLookback - right.maxLookback);
  const startTimes = new Array(patients.length);

  assignmentOrder.forEach(({ patient, index, maxLookback }) => {
    const possibleOffsets = shuffle(
      Array.from({ length: maxLookback }, (_, offsetIndex) => offsetIndex + 1),
      random
    );
    let lookback = possibleOffsets.find(offset => !usedOffsets.has(offset));
    if (lookback === undefined) lookback = possibleOffsets[0];
    usedOffsets.add(lookback);
    startTimes[index] = minutesToTime(startMinutes - lookback);
  });

  return patients.map((patient, index) => ({ ...patient, startTime: startTimes[index] }));
}

export function hasDistinctStartTimes(patients) {
  return patients.length <= 1 || new Set(patients.map(patient => patient.startTime)).size === patients.length;
}

export function repairInitialAcuteStartTimes(patients, initialPatientIds, simulationStartTime) {
  const initialIds = new Set(initialPatientIds || []);
  const initialPatients = patients.filter(patient => (
    patient.initialAcuteCensus || initialIds.has(patient.id)
  ));
  if (initialPatients.length < 2 || hasDistinctStartTimes(initialPatients)) return patients;

  const correctedPatients = assignInitialAcuteStartTimes(initialPatients, simulationStartTime || initialPatients[0].startTime);
  const correctedById = new Map(correctedPatients.map(patient => [patient.id, patient]));
  return patients.map(patient => correctedById.get(patient.id) || patient);
}