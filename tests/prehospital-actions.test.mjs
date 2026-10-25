import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  applyCompletedPrehospitalActions,
  classifyBleedingSite,
  controlsPatientBleeding,
  getRecommendedBleedingAction,
  isPrehospitalActionApplicable
} from '../frontend/src/prehospitalActions.js';

function bleedingPatient(injuryDescription, overrides = {}) {
  return {
    id: 'BLEED-1',
    injuryDescription,
    XABCDE: {
      X: { Exanguination: 'Massiv' },
      A: { airway: 'Fri' },
      B: { AF: 18, Sat: 96 },
      C: { Puls: 120, BT: '90/60', Bleeding: 'Massiv' },
      D: { GCS: 14 },
      E: { Temp: 36 }
    },
    ...overrides
  };
}

test('classifies extremity and junctional bleeding locations from injury text', () => {
  assert.equal(classifyBleedingSite(bleedingPatient('Skottskada ben')), 'extremity');
  assert.equal(classifyBleedingSite(bleedingPatient('Skottskada arm')), 'extremity');
  assert.equal(classifyBleedingSite(bleedingPatient('Skottskada ljumske')), 'junctional');
  assert.equal(classifyBleedingSite(bleedingPatient('Skottskada armhåla')), 'junctional');
  assert.equal(classifyBleedingSite(bleedingPatient('Skottskada hals')), 'junctional');
  assert.equal(classifyBleedingSite(bleedingPatient('Sekundär: Splitter i buk')), 'noncompressible');
  assert.equal(classifyBleedingSite(bleedingPatient('Skottskada thorax')), 'noncompressible');
  assert.equal(classifyBleedingSite(bleedingPatient('Skallblödning')), 'noncompressible');
});

test('tourniquet is limited to extremities and wound packing to junctional sites', () => {
  assert.equal(isPrehospitalActionApplicable(bleedingPatient('Skottskada ben'), 'tourniquet'), true);
  assert.equal(isPrehospitalActionApplicable(bleedingPatient('Skottskada hals'), 'tourniquet'), false);
  assert.equal(isPrehospitalActionApplicable(bleedingPatient('Skottskada ljumske'), 'sårpackning'), true);
  assert.equal(isPrehospitalActionApplicable(bleedingPatient('Skottskada armhåla'), 'sårpackning'), true);
  assert.equal(isPrehospitalActionApplicable(bleedingPatient('Skottskada hals'), 'sårpackning'), true);
  assert.equal(isPrehospitalActionApplicable(bleedingPatient('Skottskada ben'), 'sårpackning'), false);
});

test('completed tourniquet or wound packing updates XABCDE and controls matching bleeding', () => {
  for (const [injury, action] of [
    ['Skottskada ben', 'tourniquet'],
    ['Skottskada ljumske', 'sårpackning']
  ]) {
    const patient = bleedingPatient(injury);
    const updated = applyCompletedPrehospitalActions(patient, [action]);
    assert.equal(updated.XABCDE.X.Exanguination, 'Kontrollerad');
    assert.equal(updated.XABCDE.C.Bleeding, 'Stoppad');
    assert.equal(updated.bleedingControlled, true);
    assert.equal(controlsPatientBleeding(updated, [action]), true);
  }
});

test('wrong hemorrhage technique does not stop the critical bleeding threat', () => {
  const neckWound = bleedingPatient('Skottskada hals');
  assert.equal(controlsPatientBleeding(neckWound, ['tourniquet']), false);
  const extremityWound = bleedingPatient('Skottskada arm');
  assert.equal(controlsPatientBleeding(extremityWound, ['sårpackning']), false);
});

test('completed airway actions update airway status in XABCDE', () => {
  const patient = bleedingPatient('Skottskada thorax', {
    XABCDE: {
      X: { Exanguination: '-' },
      A: { airway: 'Hotad' },
      B: { AF: 34, Sat: 90 },
      C: { Puls: 130, BT: '100/60', Bleeding: 'Ingen' },
      D: { GCS: 10 },
      E: { Temp: 36 }
    }
  });

  assert.equal(applyCompletedPrehospitalActions(patient, ['fri_luftvag']).XABCDE.A.airway, 'Fri');
  assert.equal(applyCompletedPrehospitalActions(patient, ['svalgtub']).XABCDE.A.airway, 'Fri');
  assert.equal(applyCompletedPrehospitalActions(patient, ['intubering']).XABCDE.A.airway, 'Säkrad (intuberad)');
  assert.equal(applyCompletedPrehospitalActions(patient, ['i-gel']).XABCDE.A.airway, 'Säkrad (i-gel)');
});

test('recommended hemorrhage control follows extremity versus junctional injury location', () => {
  assert.equal(getRecommendedBleedingAction(bleedingPatient('Skottskada ben')), 'tourniquet');
  assert.equal(getRecommendedBleedingAction(bleedingPatient('Skottskada ljumske')), 'sårpackning');
  assert.equal(getRecommendedBleedingAction(bleedingPatient('Skottskada hals')), 'sårpackning');
  assert.equal(getRecommendedBleedingAction(bleedingPatient('Skottskada buk')), null);
  assert.equal(getRecommendedBleedingAction(bleedingPatient('Skottskada thorax')), null);
  assert.equal(getRecommendedBleedingAction(bleedingPatient('Skallblödning')), null);
});

test('Isak Olsson abdominal hemorrhage cannot receive external hemostasis actions', () => {
  const isak = bleedingPatient('Sekundär: Splitter i buk', {
    XABCDE: { X: { Exanguination: '-' }, C: { Bleeding: 'Massiv' } }
  });

  assert.equal(getRecommendedBleedingAction(isak), null);
  assert.equal(isPrehospitalActionApplicable(isak, 'tourniquet'), false);
  assert.equal(isPrehospitalActionApplicable(isak, 'sårpackning'), false);
  assert.equal(isPrehospitalActionApplicable(isak, 'tryckförband'), false);
  assert.equal(controlsPatientBleeding(isak, ['tryckförband']), false);
  assert.equal(controlsPatientBleeding(isak, ['tourniquet']), false);
  assert.equal(controlsPatientBleeding(isak, ['sårpackning']), false);
});

test('external pressure dressing is available only for a documented compressible site', () => {
  assert.equal(isPrehospitalActionApplicable(bleedingPatient('Skottskada arm'), 'tryckförband'), true);
  assert.equal(isPrehospitalActionApplicable(bleedingPatient('Skottskada ljumske'), 'tryckförband'), true);
  assert.equal(isPrehospitalActionApplicable(bleedingPatient('Skottskada thorax'), 'tryckförband'), false);
  assert.equal(isPrehospitalActionApplicable(bleedingPatient('Skallblödning'), 'tryckförband'), false);
});

test('severe bleeding in C is detected even when X contains a non-severe value', () => {
  const patient = bleedingPatient('Skottskada arm', {
    XABCDE: {
      X: { Exanguination: '-' },
      C: { Bleeding: 'Massiv' }
    }
  });
  assert.equal(controlsPatientBleeding(patient, ['tryckförband']), false);
});

test('shipped internal hemorrhage scenarios are documented in C, not X', () => {
  const explosionPatients = JSON.parse(readFileSync(new URL('../frontend/public/patients_explosion_150.json', import.meta.url), 'utf8'));
  const internalHemorrhagePatients = explosionPatients.filter(patient => classifyBleedingSite(patient) === 'noncompressible');

  for (const patient of internalHemorrhagePatients) {
    const xabcde = patient.XABCDE || patient.ABCDE || {};
    const exanguination = xabcde.X?.Exanguination || xabcde.X?.exanguination || '';
    assert.doesNotMatch(exanguination, /massiv|riklig|aktiv blödning/i, `${patient.id} should not have external X bleeding`);
  }

  const isak = explosionPatients.find(patient => patient.personnummer === '19940315-7754');
  assert.equal(isak.XABCDE.X.Exanguination, '-');
  assert.equal(isak.XABCDE.C.Bleeding, 'Massiv');
});

test('a lower-leg fracture without X bleeding does not allow a tourniquet', () => {
  const patients = JSON.parse(readFileSync(new URL('../frontend/public/patients_explosion_150.json', import.meta.url), 'utf8'));
  const daniel = patients.find(patient => patient.personnummer === '20110824-3674');

  assert.equal(daniel.injuryDescription, 'Tertiär: Underbensfraktur');
  assert.equal(daniel.XABCDE.X.Exanguination, '-');
  assert.equal(isPrehospitalActionApplicable(daniel, 'tourniquet'), false);
  assert.equal(isPrehospitalActionApplicable(daniel, 'tryckförband'), false);
  assert.equal(getRecommendedBleedingAction(daniel), null);
  assert.equal(controlsPatientBleeding(daniel, ['tourniquet']), false);
});