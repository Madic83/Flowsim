import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { applyDepartmentOccupancyLevel, getPatientAge, getTargetPatientCount, isCompleteDepartmentPatient, matchesDepartment } from '../frontend/src/departmentOccupancy.js';

const root = path.resolve(import.meta.dirname, '..');
const patientFiles = [
  'patients_150_valid_pnr.json',
  'frontend/public/patients_department_specialties.json',
  'frontend/public/patients_explosion_150.json',
  'frontend/public/patients_ammoniak_200.json',
  'frontend/public/patients_burn_200.json',
  'frontend/public/patients_gunshot_150.json'
];

const patientPool = Array.from(new Map(patientFiles
  .flatMap(file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')))
  .filter(patient => patient?.id)
  .map(patient => [patient.id, patient])).values());

const masculineFirstNames = new Set([
  'Arvid', 'Carl', 'Edvin', 'Gustav', 'Isak', 'Ludvig', 'Nils', 'Pelle', 'Viggo', 'Bertil',
  'David', 'Filip', 'Hugo', 'Joel', 'Malte', 'Otto', 'Tage', 'Anton', 'August', 'Daniel',
  'Ebbe', 'Emil', 'Felix', 'Gabriel', 'Kevin', 'Magnus', 'Milo', 'Noah', 'Olle', 'Rasmus',
  'Simon', 'Sven', 'Valter', 'Viktor', 'Albin', 'Andreas', 'Axel', 'Christian', 'Elis', 'Erik',
  'Hjalmar', 'Johan', 'Lars', 'Melker', 'Niklas'
]);

function hasClinicalReason(patient) {
  return Boolean(patient.mechanism || patient.injuryDescription || patient.cause);
}

function makeCompleteDepartmentPatient(overrides = {}) {
  const assessment = {
    X: { Exanguination: '-' },
    A: { airway: 'Fri' },
    B: { AF: 17, Sat: 97 },
    C: { Puls: 82, BT: '124/78', Bleeding: 'Ingen' },
    D: { GCS: 15 },
    E: { Temp: 36.8 }
  };
  return {
    id: 'CHILD-COMPLETE-1',
    name: 'Test Barnpatient',
    sex: 'kvinna',
    age: 10,
    personnummer: '20150101-1234',
    baselineHealth: 'I övrigt frisk',
    mechanism: 'Pediatrik',
    injuryDescription: 'Barn med pneumoni och feber',
    cause: 'Pneumoni hos barn, antibiotikabehandling',
    patientType: 'pediatrics',
    triage: { scene: 'Gul', emergencyDept: 'Gul' },
    XABCDE: assessment,
    ABCDE: assessment,
    activities: [],
    medications: [],
    interventions: { AKM: [], Radiology: 'Ingen', Surgery: 'Ingen' },
    medicalHistory: '',
    referral: '',
    team: '',
    timeCritical: { avoidableComplicationMinutes: 120, avoidableDeathMinutes: 360 },
    outcome: { opNeeded: false, postOpCare: '-', ward: 'Barnavdelning 2' },
    ...overrides
  };
}

test('specialty patient dataset has unique complete identities and valid person-number check digits', () => {
  const specialtyPatients = JSON.parse(fs.readFileSync(
    path.join(root, 'frontend/public/patients_department_specialties.json'),
    'utf8'
  ));
  const patientIds = new Set();
  const personNumbers = new Set();

  for (const patient of specialtyPatients) {
    assert.equal(patientIds.has(patient.id), false, `Duplicate patient ID ${patient.id}`);
    patientIds.add(patient.id);
    assert.equal(personNumbers.has(patient.personnummer), false, `Duplicate person number ${patient.personnummer}`);
    personNumbers.add(patient.personnummer);
    assert.ok(patient.name);
    assert.ok(patient.personnummer);
    assert.ok(hasClinicalReason(patient));
    assert.ok(patient.triage);
    assert.ok(patient.XABCDE);
    assert.ok(patient.interventions);
    assert.ok(patient.timeCritical);
    assert.ok(patient.outcome?.ward);
    assert.equal(getPatientAge(patient), patient.age);
    if (patient.outcome.ward === 'BB Antenatalavdelning') {
      assert.equal(patient.sex, 'kvinna');
      assert.equal(masculineFirstNames.has(patient.name.split(' ')[0]), false);
    }
    if (patient.outcome.ward === 'BB Antenatalavdelning') assert.equal(patient.sex, 'kvinna');

    const digits = patient.personnummer.replace(/\D/g, '');
    const baseDigits = digits.slice(2, 11);
    let sum = 0;
    for (let index = 0; index < baseDigits.length; index += 1) {
      const product = Number(baseDigits[index]) * (index % 2 === 0 ? 2 : 1);
      sum += Math.floor(product / 10) + (product % 10);
    }
    assert.equal(Number(digits[11]), (10 - (sum % 10)) % 10);
  }
});

test('BB occupancy only selects women with pregnancy or childbirth-related reasons', () => {
  const malePregnancyRecord = {
    id: 'MALE-BB-TEST',
    name: 'Test Patient',
    sex: 'man',
    age: 30,
    personnummer: '19960101-1234',
    mechanism: 'Obstetrik',
    injuryDescription: 'Gravid patient med prematura sammandragningar',
    cause: 'Graviditetskomplikation, observation',
    outcome: { ward: 'BB Antenatalavdelning' }
  };
  const result = applyDepartmentOccupancyLevel({ 'BB Antenatalavdelning': [malePregnancyRecord] }, 'medium', '12:00', [...patientPool, malePregnancyRecord]);
  const bbPatients = result.departmentPatients['BB Antenatalavdelning'];

  assert.equal(bbPatients.length, 19);
  assert.ok(bbPatients.every(patient => patient.sex === 'kvinna'));
  assert.ok(bbPatients.every(patient => /gravid|förloss|obstetr|postpartum|antenatal|maternell/i.test(patient.cause)));
  assert.equal(bbPatients.some(patient => patient.id === malePregnancyRecord.id), false);
});

test('low, medium, and high occupancy can fill every department with complete, uniquely placed patients', () => {
  for (const level of ['low', 'medium', 'high']) {
    const result = applyDepartmentOccupancyLevel({}, level, '12:00', patientPool);
    assert.equal(result.unfilledDepartments.length, 0, `${level} leaves departments unfilled: ${JSON.stringify(result.unfilledDepartments)}`);

    const placements = Object.values(result.departmentPatients).flat();
    const sourceIds = placements.map(patient => patient.censusSourceId);
    assert.equal(new Set(sourceIds).size, sourceIds.length, `${level} reuses a source patient`);

    for (const patient of placements) {
      assert.ok(patient.name);
      assert.ok(patient.personnummer);
      assert.ok(getPatientAge(patient) > 0);
      assert.ok(hasClinicalReason(patient));
      assert.equal(isCompleteDepartmentPatient(patient), true);
      assert.equal(patient.location, patient.outcome.ward);
      assert.equal(matchesDepartment(patient, patient.location), true);
      assert.ok(patient.censusOccupant);
    }

    for (const department of ['Barnavdelning 2', 'Barnavdelning 3', 'Barnavdelning 4']) {
      for (const patient of result.departmentPatients[department]) assert.ok(patient.age < 18);
    }
    for (const department of ['Geriatrisk avdelning 1', 'Geriatrisk avdelning 2', 'Geriatrisk avdelning 4']) {
      for (const patient of result.departmentPatients[department]) assert.ok(patient.age >= 65);
    }
  }
});

test('medium occupancy preserves over-capacity counts and defaults unspecified departments to three beds over', () => {
  assert.equal(getTargetPatientCount('Onkologavdelning CDE', 18, 'medium'), 21);
  assert.equal(18 - getTargetPatientCount('Onkologavdelning CDE', 18, 'medium'), -3);
  assert.equal(getTargetPatientCount('Department missing from reference', 10, 'medium'), 13);
  assert.equal(10 - getTargetPatientCount('Department missing from reference', 10, 'medium'), -3);
});

test('legacy placeholders and ward mismatches are replaced; complete matching patients are preserved', () => {
  const childPatientPool = Array.from({ length: 12 }, (_, index) => makeCompleteDepartmentPatient({
    id: `CHILD-SOURCE-${index}`,
    name: `Barnpatient ${index}`,
    personnummer: `20150101-${String(index).padStart(3, '0')}0`
  }));
  const existingPatient = makeCompleteDepartmentPatient({
    id: 'REAL-EXISTING-1',
    name: 'Befintlig barnpatient'
  });
  const adultInWrongWard = makeCompleteDepartmentPatient({
    id: 'ADULT-WRONG-WARD',
    name: 'Vuxen felplacerad',
    age: 46,
    personnummer: '19800101-1234'
  });
  const legacyPlaceholder = {
    id: 'CENSUS-Barnavdelning-2-001',
    name: '',
    personnummer: '',
    censusOccupant: false
  };
  const result = applyDepartmentOccupancyLevel({
    'Barnavdelning 2': [legacyPlaceholder, adultInWrongWard, existingPatient]
  }, 'medium', '12:00', childPatientPool);
  const wardPatients = result.departmentPatients['Barnavdelning 2'];

  assert.equal(wardPatients.length, 12);
  assert.equal(wardPatients[0].id, existingPatient.id);
  assert.equal(wardPatients[0].name, existingPatient.name);
  assert.equal(wardPatients.some(patient => patient.id === adultInWrongWard.id), false);
  const replacedPlaceholder = wardPatients.find(patient => patient.id === legacyPlaceholder.id);
  assert.ok(replacedPlaceholder);
  assert.notEqual(replacedPlaceholder.name, '');
  assert.ok(replacedPlaceholder.censusSourceId);
  assert.equal(result.invalidPatientCount, 1);
  assert.ok(wardPatients.every(patient => isCompleteDepartmentPatient(patient) && matchesDepartment(patient, 'Barnavdelning 2')));
});
