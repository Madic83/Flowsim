import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceSurgeryStaffArrivals, getAddedStaffIds, getInitialAcuteStaffIds, getUnassignedAvailableStaff, isOperationInProgress, shouldKeepLocalRoster } from '../frontend/src/catastropheStaffArrivals.js';

function roster() {
  return {
    surgeryStaffArrivals: {},
    available: { responsibilities: { personnelLead: '' }, entries: [{ id: 'available-1', name: '', role: '', specialty: '' }] }
  };
}

const surgeon = {
  id: 'SUR-001',
  name: 'Test Kirurg',
  category: 'Kirurger',
  role: 'Kirurg',
  specialty: 'Kirurgi'
};

test('surgical staff is delayed by a random 1-10 simulated minutes before arrival', () => {
  const pending = advanceSurgeryStaffArrivals(roster(), [surgeon], '08:00', false, () => 0.5);
  assert.equal(pending.available.entries[0].personnelId, undefined);
  assert.equal(pending.surgeryStaffArrivals[surgeon.id].delayMinutes, 6);

  const arrived = advanceSurgeryStaffArrivals(pending, [surgeon], '08:06', false, () => 0.5);
  assert.equal(arrived.available.entries[0].personnelId, surgeon.id);
  assert.equal(arrived.available.entries[0].role, 'Kirurg');
});

test('added operation assistants arrive immediately while original staff retain their delay', () => {
  const assistants = Array.from({ length: 8 }, (_, index) => ({
    ...surgeon,
    id: `USO-${index + 1}`,
    category: 'Undersköterskor operation',
    role: 'Undersköterska',
    specialty: 'Operation'
  }));
  const staffByCategory = { 'Undersköterskor operation': assistants };
  const addedIds = getAddedStaffIds(
    staffByCategory,
    { 'Undersköterskor operation': 8 },
    { usk_op: 6 },
    { 'Undersköterskor operation': 'usk_op' }
  );
  const initialRoster = {
    surgeryStaffArrivals: {},
    available: {
      responsibilities: { personnelLead: '' },
      entries: Array.from({ length: 33 }, (_, index) => ({ id: `available-${index + 1}`, name: '', role: '', specialty: '' }))
    }
  };

  const pending = advanceSurgeryStaffArrivals(initialRoster, assistants, '08:00', true, () => 0, addedIds);
  assert.deepEqual(
    pending.available.entries.filter(entry => entry.personnelId).map(entry => entry.personnelId),
    assistants.slice(2).map(person => person.id)
  );
  assert.equal(pending.surgeryStaffArrivals[assistants[0].id].status, 'waiting');

  const rescheduled = advanceSurgeryStaffArrivals(pending, assistants, '08:01', false, () => 0, addedIds);
  const arrived = advanceSurgeryStaffArrivals(rescheduled, assistants, '08:02', false, () => 0, addedIds);

  assert.deepEqual(
    arrived.available.entries.filter(entry => entry.personnelId).map(entry => entry.personnelId).sort(),
    assistants.map(person => person.id).sort()
  );
});

test('active operation pauses arrivals and starts a fresh delay when clear', () => {
  const waiting = advanceSurgeryStaffArrivals(roster(), [surgeon], '08:00', true, () => 0.5);
  assert.equal(waiting.surgeryStaffArrivals[surgeon.id].status, 'waiting');
  assert.equal(waiting.available.entries[0].personnelId, undefined);

  const scheduled = advanceSurgeryStaffArrivals(waiting, [surgeon], '08:10', false, () => 0);
  assert.equal(scheduled.surgeryStaffArrivals[surgeon.id].startedAt, '08:10');
  assert.equal(scheduled.surgeryStaffArrivals[surgeon.id].delayMinutes, 1);
});

test('an operation that starts during the arrival delay postpones the arrival', () => {
  const pending = advanceSurgeryStaffArrivals(roster(), [surgeon], '08:00', false, () => 0.5);
  const paused = advanceSurgeryStaffArrivals(pending, [surgeon], '08:04', true, () => 0.5);
  assert.equal(paused.surgeryStaffArrivals[surgeon.id].status, 'waiting');
  assert.equal(paused.available.entries[0].personnelId, undefined);

  const rescheduled = advanceSurgeryStaffArrivals(paused, [surgeon], '08:05', false, () => 0);
  assert.equal(rescheduled.surgeryStaffArrivals[surgeon.id].startedAt, '08:05');
  assert.equal(rescheduled.surgeryStaffArrivals[surgeon.id].delayMinutes, 1);
  const arrived = advanceSurgeryStaffArrivals(rescheduled, [surgeon], '08:06', false, () => 0);
  assert.equal(arrived.available.entries[0].personnelId, surgeon.id);
});

test('ongoing OP tasks and the current occupied OR hour block arrivals', () => {
  assert.equal(isOperationInProgress({ patient1: { startMinutes: 480, durationMinutes: 60 } }, {}, '08:30'), true);
  assert.equal(isOperationInProgress({}, { 'Sal 4': { 8: { id: 'patient1' } } }, '08:30'), true);
  assert.equal(isOperationInProgress({}, { 'Sal 4': { 9: { id: 'patient1' } } }, '08:30'), false);
});

test('available personnel overview excludes staff placed in another roster list or responsibility', () => {
  const acuteDoctor = { id: 'AL-1', name: 'Akutläkare', category: 'Akutläkare' };
  const acuteNurse = { id: 'AS-1', name: 'Akutsjuksköterska', category: 'Akutsjuksköterskor' };
  const surgeon = { id: 'SUR-1', name: 'Kirurg', category: 'Kirurger' };
  const rosterState = {
    available: {
      responsibilities: { personnelLead: '' },
      entries: [{ id: 'arrival-SUR-1', personnelId: surgeon.id, name: surgeon.name, role: 'Kirurg', specialty: 'Kirurgi' }]
    },
    storsal: {
      responsibilities: {},
      entries: [{ id: 'storsal-row', personnelId: acuteDoctor.id, name: acuteDoctor.name }]
    },
    triage: {
      responsibilities: {},
      entries: [{ id: 'triage-row', personnelId: surgeon.id, name: surgeon.name }]
    },
    'yellow-zone': {
      responsibilities: { nurseLead: acuteNurse.id },
      entries: []
    }
  };

  assert.deepEqual(getUnassignedAvailableStaff([acuteDoctor, acuteNurse], [surgeon], rosterState), []);
  assert.deepEqual(getUnassignedAvailableStaff([acuteDoctor, acuteNurse], [surgeon], {
    available: rosterState.available,
    storsal: { responsibilities: {}, entries: [] },
    triage: { responsibilities: {}, entries: [] },
    'yellow-zone': { responsibilities: {}, entries: {} }
  }).map(person => person.id), ['AL-1', 'AS-1', 'SUR-1']);
});

test('a populated local roster is not replaced by an empty session roster', () => {
  const localRoster = {
    available: {
      entries: Array.from({ length: 18 }, (_, index) => ({ personnelId: `STAFF-${index + 1}` }))
    },
    storsal: { responsibilities: {}, entries: [] }
  };
  const emptyRemoteRoster = {
    available: { responsibilities: {}, entries: [] },
    storsal: { responsibilities: {}, entries: [] }
  };

  assert.equal(shouldKeepLocalRoster(localRoster, emptyRemoteRoster), true);
  assert.equal(shouldKeepLocalRoster(emptyRemoteRoster, localRoster), false);
});

test('initial emergency department staff never appear as additional available staff', () => {
  const initialDoctor = { id: 'AL-1', name: 'Initial doctor', category: 'Akutläkare' };
  const initialNurse = { id: 'AS-1', name: 'Initial nurse', category: 'Akutsjuksköterskor' };
  const extraUnconfiguredDoctor = { id: 'AL-EXTRA', name: 'Extra doctor', category: 'Akutläkare' };
  const operationAssistant = { id: 'USO-1', name: 'Operation assistant', category: 'Undersköterskor operation' };
  const arrivedSurgeon = { id: 'SUR-1', name: 'Arrived surgeon', category: 'Kirurger' };
  const rosterState = {
    available: { responsibilities: {}, entries: [] },
    storsal: { responsibilities: {}, entries: [] }
  };

  const available = getUnassignedAvailableStaff(
    [initialDoctor, initialNurse],
    [arrivedSurgeon],
    rosterState,
    [initialDoctor.id, initialNurse.id]
  );
  assert.deepEqual(available.map(person => person.id), [arrivedSurgeon.id]);
  assert.equal(available.some(person => person.id === extraUnconfiguredDoctor.id), false);

  const initialIds = getInitialAcuteStaffIds(
    { Akutläkare: [initialDoctor, extraUnconfiguredDoctor], 'Undersköterskor operation': [operationAssistant] },
    { Akutläkare: 2 },
    { Akutläkare: 1 }
  );
  assert.deepEqual(initialIds, [initialDoctor.id]);
  assert.equal(initialIds.includes(operationAssistant.id), false);
});

test('personnel added with the control panel count as available, not as initial ED staff', () => {
  const staffByCategory = {
    Akutläkare: [1, 2, 3, 4, 5].map(index => ({ id: `AL-${index}`, category: 'Akutläkare' }))
  };
  const initialStaffIds = getInitialAcuteStaffIds(staffByCategory, { Akutläkare: 5 }, { Akutläkare: 1 });
  const availableStaff = getUnassignedAvailableStaff(staffByCategory.Akutläkare, [], { available: { entries: [] } }, initialStaffIds);

  assert.deepEqual(initialStaffIds, ['AL-1', 'AL-2', 'AL-3', 'AL-4']);
  assert.deepEqual(availableStaff.map(person => person.id), ['AL-5']);
});