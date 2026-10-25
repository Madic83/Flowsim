import assert from 'node:assert/strict';
import test from 'node:test';
import { advancePrehospitalPatient } from '../frontend/src/prehospitalDeterioration.js';
import { applyCompletedPrehospitalActions } from '../frontend/src/prehospitalActions.js';

function patient(overrides = {}) {
  return {
    id: 'PAT-001',
    location: 'Skadeplats',
    triage: { scene: 'Gul' },
    XABCDE: {
      A: { airway: 'Fri' },
      B: { AF: 16, Sat: 98 },
      C: { Puls: 80, BT: '120/70', Bleeding: 'Ingen' },
      D: { GCS: 15 },
      E: { Temp: 36 }
    },
    ...overrides
  };
}

test('green patients remain stable except for cold exposure outdoors', () => {
  const green = patient({ triage: { scene: 'Grön' } });
  let mildWeather = green;
  for (let minute = 0; minute < 10; minute += 1) {
    mildWeather = advancePrehospitalPatient(mildWeather, { temperatureC: 15 }, { simTime: `08:${String(minute).padStart(2, '0')}` });
  }
  assert.deepEqual(mildWeather.XABCDE, green.XABCDE);

  let coldExposure = green;
  for (let minute = 0; minute < 10; minute += 1) {
    coldExposure = advancePrehospitalPatient(coldExposure, { temperatureC: 0 }, { simTime: `08:${String(minute).padStart(2, '0')}` });
  }
  assert.equal(coldExposure.XABCDE.E.Temp, 35);
  assert.equal(coldExposure.XABCDE.B.Sat, 98);
  assert.equal(coldExposure.XABCDE.C.Puls, 80);
});

test('red patients deteriorate faster than yellow patients', () => {
  let red = patient({ triage: { scene: 'Röd' } });
  let yellow = patient({ triage: { scene: 'Gul' } });
  for (let minute = 0; minute < 2; minute += 1) {
    red = advancePrehospitalPatient(red, { temperatureC: 15 });
    yellow = advancePrehospitalPatient(yellow, { temperatureC: 15 });
  }
  assert.ok(red.XABCDE.B.Sat < yellow.XABCDE.B.Sat);
  assert.ok(red.XABCDE.C.Puls > yellow.XABCDE.C.Puls);
});

test('participant triage selection cannot pause deterioration before triage is complete', () => {
  let untriagedPatient = patient({
    triage: { scene: 'Grön' },
    prehospitalBaselineTriage: 'Röd',
    triageCompleted: false
  });
  const initialSaturation = untriagedPatient.XABCDE.B.Sat;
  untriagedPatient = advancePrehospitalPatient(untriagedPatient, { temperatureC: 15 });
  untriagedPatient = advancePrehospitalPatient(untriagedPatient, { temperatureC: 15 });

  assert.ok(untriagedPatient.XABCDE.B.Sat < initialSaturation);
  assert.equal(untriagedPatient.triage.scene, 'Grön');
  assert.equal(untriagedPatient.triageCompleted, false);
});

test('untreated massive bleeding is fatal after five simulated minutes', () => {
  let bleedingPatient = patient({
    triage: { scene: 'Röd' },
    XABCDE: {
      X: { Exanguination: '-' },
      A: { airway: 'Fri' },
      B: { AF: 20, Sat: 94 },
      C: { Puls: 120, BT: '90/60', Bleeding: 'Massiv' },
      D: { GCS: 14 },
      E: { Temp: 36 }
    }
  });
  for (let minute = 1; minute <= 4; minute += 1) {
    bleedingPatient = advancePrehospitalPatient(bleedingPatient, { temperatureC: 15 }, { simTime: `08:0${minute}` });
    assert.notEqual(bleedingPatient.status, 'avliden');
  }
  bleedingPatient = advancePrehospitalPatient(bleedingPatient, { temperatureC: 15 }, { simTime: '08:05' });
  assert.equal(bleedingPatient.status, 'avliden');
  assert.equal(bleedingPatient.location, 'Uppsamlingsplats döda');
});

test('an untreated obstructed airway is fatal after five simulated minutes', () => {
  let airwayPatient = patient({
    triage: { scene: 'Röd' },
    XABCDE: {
      X: { Exanguination: '-' },
      A: { airway: 'Blockerad' },
      B: { AF: 0, Sat: 70 },
      C: { Puls: 130, BT: '90/60', Bleeding: 'Ingen' },
      D: { GCS: 6 },
      E: { Temp: 36 }
    }
  });
  for (let minute = 1; minute <= 5; minute += 1) {
    airwayPatient = advancePrehospitalPatient(airwayPatient, { temperatureC: 15 }, { simTime: `08:0${minute}` });
  }
  assert.equal(airwayPatient.status, 'avliden');
});

test('a threatened airway from scenario data starts the same critical timer', () => {
  let airwayPatient = patient({
    XABCDE: {
      X: { Exanguination: '-' },
      A: { airway: 'Hotad' },
      B: { AF: 12, Sat: 90 },
      C: { Puls: 125, BT: '95/60', Bleeding: 'Ingen' },
      D: { GCS: 10 },
      E: { Temp: 36 }
    }
  });
  for (let minute = 0; minute < 5; minute += 1) {
    airwayPatient = advancePrehospitalPatient(airwayPatient, { temperatureC: 15 });
  }
  assert.equal(airwayPatient.status, 'avliden');
});

test('airway support or bleeding control stops the corresponding five-minute timer', () => {
  const bleedingPatient = patient({
    injuryDescription: 'Skottskada arm',
    XABCDE: {
      X: { Exanguination: 'Riklig' },
      A: { airway: 'Fri' },
      B: { AF: 20, Sat: 94 },
      C: { Puls: 120, BT: '90/60', Bleeding: 'Riklig' },
      D: { GCS: 14 },
      E: { Temp: 36 }
    }
  });
  const airwayPatient = patient({
    XABCDE: {
      X: { Exanguination: '-' },
      A: { airway: 'Ej fri' },
      B: { AF: 20, Sat: 94 },
      C: { Puls: 120, BT: '90/60', Bleeding: 'Ingen' },
      D: { GCS: 14 },
      E: { Temp: 36 }
    }
  });

  const bleedingTreated = advancePrehospitalPatient(bleedingPatient, { temperatureC: 15 }, {
    completedActions: { 'PAT-001': ['tourniquet'] }
  });
  const airwayTreated = advancePrehospitalPatient(airwayPatient, { temperatureC: 15 }, {
    activeActions: ['fri_luftvag']
  });
  assert.notEqual(bleedingTreated.status, 'avliden');
  assert.equal(bleedingTreated.criticalUntreatedMinutes, 0);
  assert.notEqual(airwayTreated.status, 'avliden');
  assert.equal(airwayTreated.status, 'stabil');
  assert.equal(airwayTreated.criticalUntreatedMinutes, 0);
});

test('treating one of two life threats does not stop the other critical timer', () => {
  let patientWithTwoThreats = patient({
    injuryDescription: 'Skottskada ben och blockerad luftväg',
    XABCDE: {
      X: { Exanguination: 'Massiv' },
      A: { airway: 'Blockerad' },
      B: { AF: 0, Sat: 70 },
      C: { Puls: 130, BT: '90/60', Bleeding: 'Massiv' },
      D: { GCS: 6 },
      E: { Temp: 36 }
    }
  });
  for (let minute = 0; minute < 5; minute += 1) {
    patientWithTwoThreats = advancePrehospitalPatient(patientWithTwoThreats, { temperatureC: 15 }, {
      completedActions: { 'PAT-001': ['tourniquet'] }
    });
  }
  assert.equal(patientWithTwoThreats.status, 'avliden');
});

test('multiple critically abnormal vital signs become fatal after five simulated minutes', () => {
  let criticallyIllPatient = patient({
    XABCDE: {
      A: { airway: 'Fri' },
      B: { AF: 40, Sat: 75 },
      C: { Puls: 170, BT: '70/45', Bleeding: 'Ingen' },
      D: { GCS: 8 },
      E: { Temp: 36 }
    }
  });

  for (let minute = 1; minute < 5; minute += 1) {
    criticallyIllPatient = advancePrehospitalPatient(criticallyIllPatient, { temperatureC: 15 }, { simTime: `09:0${minute}` });
    assert.notEqual(criticallyIllPatient.status, 'avliden');
  }
  criticallyIllPatient = advancePrehospitalPatient(criticallyIllPatient, { temperatureC: 15 }, { simTime: '09:05' });

  assert.equal(criticallyIllPatient.status, 'avliden');
  assert.equal(criticallyIllPatient.location, 'Uppsamlingsplats döda');
  assert.equal(criticallyIllPatient.criticalVitalsMinutes, 5);
});

test('an extreme vital sign can be fatal after five minutes, but one less severe abnormality is not', () => {
  let extremePatient = patient({
    XABCDE: {
      A: { airway: 'Fri' },
      B: { AF: 20, Sat: 70 },
      C: { Puls: 100, BT: '110/70', Bleeding: 'Ingen' },
      D: { GCS: 14 },
      E: { Temp: 36 }
    }
  });
  for (let minute = 0; minute < 5; minute += 1) {
    extremePatient = advancePrehospitalPatient(extremePatient, { temperatureC: 15 });
  }
  assert.equal(extremePatient.status, 'avliden');

  let mildlyAbnormalPatient = patient({
    XABCDE: {
      A: { airway: 'Fri' },
      B: { AF: 30, Sat: 90 },
      C: { Puls: 125, BT: '100/65', Bleeding: 'Ingen' },
      D: { GCS: 12 },
      E: { Temp: 36 }
    }
  });
  for (let minute = 0; minute < 10; minute += 1) {
    mildlyAbnormalPatient = advancePrehospitalPatient(mildlyAbnormalPatient, { temperatureC: 15 });
  }
  assert.notEqual(mildlyAbnormalPatient.status, 'avliden');
});

test('patients inside an ambulance do not cool from outdoor temperature', () => {
  let ambulancePatient = patient({ location: 'Ambulans', triage: { scene: 'Grön' } });
  for (let minute = 0; minute < 10; minute += 1) {
    ambulancePatient = advancePrehospitalPatient(ambulancePatient, { temperatureC: -10 });
  }
  assert.equal(ambulancePatient.XABCDE.E.Temp, 36);
});

test('completed hemorrhage control prevents further deterioration on later simulated minutes', () => {
  const initial = patient({
    triage: { scene: 'Röd' },
    injuryDescription: 'Skottskada ben',
    XABCDE: {
      X: { Exanguination: 'Massiv' },
      A: { airway: 'Fri' },
      B: { AF: 20, Sat: 94 },
      C: { Puls: 120, BT: '90/60', Bleeding: 'Massiv' },
      D: { GCS: 14 },
      E: { Temp: 36 }
    }
  });
  const treated = applyCompletedPrehospitalActions(initial, ['tourniquet']);
  let treatedProgress = treated;
  let untreatedProgress = initial;
  for (let minute = 0; minute < 4; minute += 1) {
    treatedProgress = advancePrehospitalPatient(treatedProgress, { temperatureC: 15 });
    untreatedProgress = advancePrehospitalPatient(untreatedProgress, { temperatureC: 15 });
  }

  assert.ok(treatedProgress.XABCDE.B.Sat > untreatedProgress.XABCDE.B.Sat);
  assert.ok(treatedProgress.XABCDE.C.Puls < untreatedProgress.XABCDE.C.Puls);
  assert.equal(treatedProgress.criticalUntreatedMinutes, 0);
  assert.equal(untreatedProgress.criticalUntreatedMinutes, 4);
});

test('massive X on an abdominal injury is not treated as external compressible hemorrhage', () => {
  const internalBleeding = patient({
    injuryDescription: 'Penetrerande skada buk',
    XABCDE: {
      X: { Exanguination: 'Massiv' },
      A: { airway: 'Fri' },
      B: { AF: 20, Sat: 94 },
      C: { Puls: 120, BT: '90/60', Bleeding: 'Ingen' },
      D: { GCS: 14 },
      E: { Temp: 36 }
    }
  });

  const afterOneMinute = advancePrehospitalPatient(internalBleeding, { temperatureC: 15 });
  assert.equal(afterOneMinute.criticalUntreatedMinutes, 0);
  assert.notEqual(afterOneMinute.status, 'avliden');
});