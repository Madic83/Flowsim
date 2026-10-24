import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceTransportCare, buildTransportCarePlan } from '../frontend/src/prehospitalTransportCare.js';
import { movePatientToParatus } from '../frontend/src/prehospitalDispatch.js';

const patient = {
  id: 'TRANSPORT-1',
  XABCDE: { A: { airway: 'Fri' }, B: { AF: 20 }, C: { Puls: 90 } },
  triage: {},
  actions: ['tourniquet', 'gcs_bedömning']
};

test('mandatory triage is planned before actions and fits the available transport time', () => {
  const plan = buildTransportCarePlan(patient, { transportMinutes: 3 });
  assert.deepEqual(plan.steps.map(step => step.kind), ['triage', 'action']);
  assert.equal(plan.steps[0].completesAtMinute, 1);
  assert.equal(plan.steps[1].actionId, 'tourniquet');
  assert.deepEqual(plan.notCompleted, ['gcs_bedömning']);
});

test('completed selected actions are not planned again', () => {
  const plan = buildTransportCarePlan(patient, {
    completedActionIds: ['tourniquet'],
    transportMinutes: 3
  });
  assert.equal(plan.steps.some(step => step.actionId === 'tourniquet'), false);
  assert.equal(plan.steps.at(-1).actionId, 'gcs_bedömning');
});

test('transport progression records only steps whose completion time has elapsed', () => {
  const transportCarePlan = buildTransportCarePlan(patient, { transportMinutes: 3 });
  const triageResult = 'Gul';
  const atOneMinute = advanceTransportCare({ ...patient, transportCarePlan }, 1, () => triageResult);
  assert.equal(atOneMinute.triage.scene, triageResult);
  assert.equal(atOneMinute.triageCompleted, true);
  assert.deepEqual(atOneMinute.prehospitalCompletedActions, []);

  const atThreeMinutes = advanceTransportCare(atOneMinute, 3, () => triageResult);
  assert.deepEqual(atThreeMinutes.prehospitalCompletedActions, ['tourniquet']);
  assert.deepEqual(atThreeMinutes.transportCarePlan.completedSteps, [0, 1]);
});

test('an already triaged patient does not spend transport time on triage again', () => {
  const plan = buildTransportCarePlan({ ...patient, triage: { scene: 'Röd' }, triageCompleted: true }, {
    transportMinutes: 2
  });
  assert.equal(plan.steps.some(step => step.kind === 'triage'), false);
  assert.equal(plan.steps[0].actionId, 'tourniquet');
});

test('a pending required treatment is completed only when its duration fits the trip', () => {
  const pendingTreatmentPatient = {
    ...patient,
    actions: [],
    requiredTreatment: 'syrgas'
  };
  const enoughTimePlan = buildTransportCarePlan(pendingTreatmentPatient, { transportMinutes: 3 });
  const treatedPatient = advanceTransportCare(
    { ...pendingTreatmentPatient, transportCarePlan: enoughTimePlan },
    3,
    () => 'Gul'
  );
  assert.equal(treatedPatient.treatment, 'syrgas');
  assert.equal(treatedPatient.treatmentCompleted, true);

  const shortTripPlan = buildTransportCarePlan(pendingTreatmentPatient, { transportMinutes: 2 });
  const untreatedPatient = advanceTransportCare(
    { ...pendingTreatmentPatient, transportCarePlan: shortTripPlan },
    2,
    () => 'Gul'
  );
  assert.equal(untreatedPatient.treatmentCompleted, undefined);
  assert.deepEqual(shortTripPlan.notCompleted, ['syrgas']);
});

test('dispatch removes the patient from the scene and adds them to Paratus once', () => {
  const otherPatient = { id: 'SCENE-2' };
  const dispatch = movePatientToParatus(patient, [patient, otherPatient], []);
  assert.deepEqual(dispatch.prehospitalPatients, [otherPatient]);
  assert.deepEqual(dispatch.paratusPatients, [patient]);

  const repeatedDispatch = movePatientToParatus(patient, dispatch.prehospitalPatients, dispatch.paratusPatients);
  assert.deepEqual(repeatedDispatch.prehospitalPatients, [otherPatient]);
  assert.equal(repeatedDispatch.paratusPatients.length, 1);
});