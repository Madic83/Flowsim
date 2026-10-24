export const NORRLANDS_DEPARTMENT_BEDS = {
  'Barnavdelning 2': 12,
  'Barnavdelning 3': 11,
  'Barnavdelning 4': 18,
  'Onkologavdelning CDE': 18,
  'Onkologavdelning Hematolog': 16,
  'Intensivvårdsavdelning': 10,
  'Intermediärvårdsavdelning': 5,
  'BB Antenatalavdelning': 15,
  'Geriatrisk avdelning 1': 18,
  'Geriatrisk avdelning 4': 16,
  'Geriatrisk avdelning 2': 6,
  'Hand- Plastik- Ögon avdelning': 5,
  'Hjärtintensvvårdsavdelning': 5,
  'Kardiologisk avdelning': 10,
  'Kardiologisk utredningsavdelning': 8,
  'Thoraxavdelning': 15,
  'Thorax intermediärvårdsavdelning': 5,
  'Thoraxintensiv vårdavdelning': 12,
  'Infektionsavdelning': 19,
  'Buk och kärlkirurgisk avdelning': 17,
  'Kirurgisk akutvårdsavdelning': 10,
  'Urologisk och gynekologisk avdelning': 10,
  'Medicincentrum specialistvårdsavdelning': 15,
  'Medicinsk akutvårdsavdelning': 18,
  'Hjärt- och ryggmärgsskaderehab': 9,
  'Neuro- och strokerehabilitering': 5,
  'Neurokirurgisk intensivvårdsavdelning': 6,
  'Neurokirurgisk avdelning': 12,
  'Neurologisk avdelning': 12,
  'Strokecenter avdelning': 12,
  'Öron- näsa- Hals avdelning': 5,
  'Ortopedavdelning': 18
};

const MEDIUM_FREE_BEDS = {
  'Barnavdelning 2': 0,
  'Barnavdelning 3': 5,
  'Barnavdelning 4': 5,
  'Onkologavdelning CDE': -3,
  'Onkologavdelning Hematolog': -2,
  'Intensivvårdsavdelning': 1,
  'Intermediärvårdsavdelning': 0,
  'BB Antenatalavdelning': -4,
  'Geriatrisk avdelning 1': 0,
  'Geriatrisk avdelning 4': 1,
  'Geriatrisk avdelning 2': 0,
  'Hand- Plastik- Ögon avdelning': -4,
  'Hjärtintensvvårdsavdelning': 1,
  'Kardiologisk avdelning': 1,
  'Kardiologisk utredningsavdelning': -5,
  'Thoraxavdelning': -1,
  'Thorax intermediärvårdsavdelning': 0,
  'Thoraxintensiv vårdavdelning': 1,
  'Infektionsavdelning': 5,
  'Buk och kärlkirurgisk avdelning': -6,
  'Kirurgisk akutvårdsavdelning': 0,
  'Urologisk och gynekologisk avdelning': -5,
  'Medicincentrum specialistvårdsavdelning': -1,
  'Medicinsk akutvårdsavdelning': 3,
  'Hjärt- och ryggmärgsskaderehab': 1,
  'Neuro- och strokerehabilitering': 1,
  'Neurokirurgisk intensivvårdsavdelning': 0,
  'Neurokirurgisk avdelning': 0,
  'Neurologisk avdelning': -2,
  'Strokecenter avdelning': 1,
  'Öron- näsa- Hals avdelning': -8,
  'Ortopedavdelning': -4
};

export function getTargetPatientCount(department, capacity, occupancyLevel) {
  if (occupancyLevel === 'medium') {
    return Math.max(0, capacity - (MEDIUM_FREE_BEDS[department] ?? -3));
  }
  if (occupancyLevel === 'low') {
    return Math.floor(capacity * 0.5);
  }
  const mediumPatientCount = Math.max(0, capacity - (MEDIUM_FREE_BEDS[department] ?? -3));
  return Math.max(Math.ceil(capacity * 1.2), mediumPatientCount + Math.ceil(capacity * 0.2));
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('sv');
}

export function getPatientAge(patient, currentYear = new Date().getFullYear()) {
  if (Number.isFinite(Number(patient.age)) && Number(patient.age) > 0) return Number(patient.age);
  const digits = String(patient.personnummer || '').replace(/\D/g, '');
  if (digits.length < 8) return null;

  let birthYear = Number(digits.slice(0, 4));
  if (digits.length < 12) {
    const shortYear = Number(digits.slice(0, 2));
    birthYear = shortYear > currentYear % 100 ? 1900 + shortYear : 2000 + shortYear;
  }
  if (!Number.isFinite(birthYear) || birthYear < 1900 || birthYear > currentYear) return null;
  let age = currentYear - birthYear;
  const month = Number(digits.slice(digits.length === 12 ? 4 : 2, digits.length === 12 ? 6 : 4));
  const day = Number(digits.slice(digits.length === 12 ? 6 : 4, digits.length === 12 ? 8 : 6));
  const today = new Date();
  if (month > today.getMonth() + 1 || (month === today.getMonth() + 1 && day > today.getDate())) age -= 1;
  return age;
}

function patientText(patient) {
  return normalizeText([
    patient.mechanism,
    patient.injuryDescription,
    patient.cause,
    patient.baselineHealth,
    patient.interventions?.Surgery,
    patient.interventions?.Radiology
  ].join(' '));
}

export function isCompleteDepartmentPatient(patient) {
  return Boolean(
    patient?.id &&
    String(patient.name || '').trim() &&
    String(patient.personnummer || '').trim() &&
    getPatientAge(patient) !== null &&
    String(patient.sex || '').trim() &&
    String(patient.baselineHealth || '').trim() &&
    String(patient.mechanism || '').trim() &&
    String(patient.injuryDescription || '').trim() &&
    String(patient.cause || '').trim() &&
    String(patient.patientType || '').trim() &&
    patient.triage &&
    patient.XABCDE &&
    patient.ABCDE &&
    Array.isArray(patient.activities) &&
    Array.isArray(patient.medications) &&
    patient.interventions &&
    Array.isArray(patient.interventions.AKM) &&
    String(patient.interventions.Radiology || '').trim() &&
    String(patient.interventions.Surgery || '').trim() &&
    typeof patient.medicalHistory === 'string' &&
    typeof patient.referral === 'string' &&
    typeof patient.team === 'string' &&
    typeof patient.timeCritical?.avoidableComplicationMinutes === 'number' &&
    typeof patient.timeCritical?.avoidableDeathMinutes === 'number' &&
    patient.outcome &&
    String(patient.outcome.ward || '').trim()
  );
}

export function matchesDepartment(patient, department) {
  const text = patientText(patient);
  const age = getPatientAge(patient);
  const normalizedDepartment = normalizeText(department);
  const outcomeWard = normalizeText(patient.outcome?.ward);
  const hasAny = (...terms) => terms.some(term => text.includes(term));
  const isRealField = patient => Boolean(patient && patient !== '-' && patient !== 'Ingen');
  const cancer = hasAny('cancer', 'onkolog', 'tumor', 'leukemi', 'lymfom');
  const obstetric = hasAny('gravid', 'forloss', 'obstetr', 'postpartum', 'antenatal', 'maternell');
  const cardiac = hasAny('hjart', 'kardi', 'brostsm', 'stemi', 'arytm', 'infarkt');
  const infection = hasAny('infektion', 'feber', 'sepsis', 'pneumoni', 'pneumonit', 'kol', 'astma');
  const neuro = hasAny('stroke', 'hemipares', 'afasi', 'hjarn', 'neuro', 'ryggmarg', 'skall', 'huvudtrauma');
  const orthopedic = hasAny('fraktur', 'collum', 'handled', 'fotled', 'underben', 'knä', 'kna', 'arm', 'benbrott', 'höft', 'hoft');
  if (outcomeWard !== normalizedDepartment) return false;
  const hasSurgery = patient.outcome?.opNeeded === true || (
    isRealField(patient.interventions?.Surgery) && !['ingen', '-'].includes(normalizeText(patient.interventions.Surgery))
  );

  if (department.startsWith('Barnavdelning')) {
    return age !== null && age < 18 && hasAny('barn', 'pediatr', 'pneumoni', 'astma', 'gastroenterit', 'fraktur', 'diabetes');
  }
  if (department.includes('Onkolog')) return cancer && outcomeWard === normalizedDepartment;
  if (department === 'BB Antenatalavdelning') {
    return age !== null && age >= 18 && age <= 55 && normalizeText(patient.sex) === 'kvinna' && obstetric;
  }
  if (department.startsWith('Geriatrisk avdelning')) {
    return age !== null && age >= 65 && hasAny('geriatr', 'äldre', 'fall', 'dehydr', 'multisjuk', 'konfusion');
  }
  const isEarNoseThroat = normalizedDepartment.includes('oron') || normalizedDepartment.includes('nasa') || normalizedDepartment.includes('hals');
  if (age === null || age < (isEarNoseThroat ? 8 : 18)) return false;
  if (department.includes('Neurokirurgisk intensiv')) return neuro && outcomeWard === normalizedDepartment;
  if (department.includes('Neurokirurgisk')) return neuro && outcomeWard === normalizedDepartment;
  if (normalizedDepartment.includes('oron') || normalizedDepartment.includes('nasa') || normalizedDepartment.includes('hals')) {
    return hasAny('oron-nasa-hals', 'peritonsillit', 'epistaxis', 'nasblod', 'otit', 'larynx', 'tonsill') && outcomeWard === 'oron- nasa- hals avdelning';
  }
  if (normalizedDepartment.includes('ryggmargsskaderehab')) return hasAny('hjartrehabilitering', 'hjart- och ryggmargsskaderehabilitering', 'ryggmarg', 'hjartatack') && outcomeWard === normalizedDepartment;
  if (department.includes('Hand- Plastik')) return hasAny('hand', 'handled', 'plastik', 'ogon', 'ansikte', 'brann', 'arm') && outcomeWard === normalizedDepartment;
  if (normalizedDepartment.includes('hjartintens')) return cardiac && outcomeWard === normalizedDepartment;
  if (normalizedDepartment.includes('kardiologisk')) {
    return cardiac && outcomeWard === normalizeText(department);
  }
  if (department.includes('Thorax')) {
    return hasAny('thorax', 'hjart', 'kardi', 'brostsm', 'stemi', 'arytm', 'infarkt') && outcomeWard === normalizedDepartment;
  }
  if (department === 'Infektionsavdelning') return infection && outcomeWard === 'infektionsavdelning';
  if (department === 'Buk och kärlkirurgisk avdelning') return hasAny('buk', 'abdomen', 'karl', 'kärl', 'aorta', 'laparotomi') && outcomeWard === normalizedDepartment;
  if (department === 'Kirurgisk akutvårdsavdelning') return hasAny('akutkirurgi', 'trauma', 'fraktur', 'blodning', 'buk') && outcomeWard === normalizedDepartment;
  if (department === 'Urologisk och gynekologisk avdelning') return hasAny('urolog', 'gynek', 'gravid', 'forloss', 'urin', 'njursten') && outcomeWard === 'urologisk och gynekologisk avdelning';
  if (department === 'Medicincentrum specialistvårdsavdelning' || department === 'Medicinsk akutvårdsavdelning') {
    return !hasSurgery && (infection || hasAny('andning', 'astma', 'kol', 'yrsel', 'buk', 'brost', 'hjart', 'stroke', 'diabetes', 'anemi')) && outcomeWard === normalizedDepartment;
  }
  if (department.includes('Neuro') || department.includes('Neurolog') || department.includes('Stroke')) {
    return neuro && outcomeWard === normalizeText(department);
  }
  if (department.includes('Ortoped')) return orthopedic && outcomeWard === 'ortopedavdelning';
  if (department === 'Intensivvårdsavdelning') return outcomeWard === normalizedDepartment && hasAny('intensivvard', 'sepsis', 'andningssvikt', 'postoperativ');
  if (department === 'Intermediärvårdsavdelning') {
    return hasAny('intermediar', 'overvak', 'andning', 'hjart', 'postoper', 'respirator');
  }
  if (department.includes('rehabilitering') || department.includes('rehab')) return hasAny('stroke', 'hemipares', 'afasi', 'ryggmarg', 'rehab') && outcomeWard === normalizedDepartment;
  return false;
}

function createOccupancyPatient(department, index, occupancyLevel, simTime, sourcePatient) {
  const departmentId = department
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-');
  const sequence = String(index + 1).padStart(3, '0');
  return {
    ...sourcePatient,
    id: `CENSUS-${departmentId}-${sequence}`,
    originalId: sourcePatient.id,
    age: getPatientAge(sourcePatient),
    startTime: simTime,
    location: department,
    censusOccupant: true,
    occupancyLevel,
    censusSourceId: sourcePatient.id,
    outcome: { ...sourcePatient.outcome, ward: department }
  };
}

export function applyDepartmentOccupancyLevel(currentDepartments, occupancyLevel, simTime, patientPool = []) {
  if (!Array.isArray(patientPool) || patientPool.length === 0) {
    return { departmentPatients: currentDepartments, createdPatients: 0, departmentsOverTarget: 0, missingPatientPool: true };
  }

  const departments = { ...currentDepartments };
  let invalidPatientCount = 0;

  Object.keys(departments).forEach(department => {
    if (Array.isArray(departments[department])) {
      departments[department] = departments[department].filter(patient => {
        if (patient.censusOccupant || String(patient.id || '').startsWith('CENSUS-')) return false;
        const validForDepartment = isCompleteDepartmentPatient(patient) && matchesDepartment(patient, department);
        if (!validForDepartment) invalidPatientCount += 1;
        return validForDepartment;
      });
    }
  });

  const usedPatientIds = new Set(Object.values(departments)
    .filter(Array.isArray)
    .flat()
    .map(patient => patient.censusSourceId || patient.originalId || patient.id)
    .filter(Boolean));

  let createdPatients = 0;
  let departmentsOverTarget = 0;
  const unfilledDepartments = [];

  Object.entries(NORRLANDS_DEPARTMENT_BEDS).forEach(([department, capacity]) => {
    const existingPatients = Array.isArray(departments[department]) ? departments[department] : [];
    const targetPatientCount = getTargetPatientCount(department, capacity, occupancyLevel);
    if (existingPatients.length > targetPatientCount) departmentsOverTarget += 1;

    const eligiblePatients = patientPool.filter(patient => (
      isCompleteDepartmentPatient(patient) && matchesDepartment(patient, department)
    ));
    const patientsToCreate = Math.max(0, targetPatientCount - existingPatients.length);
    const simulatedPatients = [];
    for (const candidate of eligiblePatients) {
      if (simulatedPatients.length >= patientsToCreate) break;
      if (usedPatientIds.has(candidate.id)) continue;
      usedPatientIds.add(candidate.id);
      simulatedPatients.push(createOccupancyPatient(department, simulatedPatients.length, occupancyLevel, simTime, candidate));
    }
    if (simulatedPatients.length < patientsToCreate) {
      unfilledDepartments.push({
        department,
        missing: patientsToCreate - simulatedPatients.length,
        eligible: eligiblePatients.length
      });
    }

    departments[department] = [...existingPatients, ...simulatedPatients];
    createdPatients += simulatedPatients.length;
  });

  return { departmentPatients: departments, createdPatients, departmentsOverTarget, unfilledDepartments, invalidPatientCount, missingPatientPool: false };
}