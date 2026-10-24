import assert from 'node:assert/strict';
import test from 'node:test';
import { assignInitialAcuteStartTimes, hasDistinctStartTimes, repairInitialAcuteStartTimes } from '../frontend/src/acuteStartTimes.js';

function minutesSinceMidnight(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function lookbackMinutes(startTime, patientStartTime) {
  return (minutesSinceMidnight(startTime) - minutesSinceMidnight(patientStartTime) + 1440) % 1440;
}

test('initial patients get distinct start times within triage-specific lookback limits', () => {
  const patients = [
    ...Array.from({ length: 20 }, (_, index) => ({ id: `green-${index}`, triage: { emergencyDept: 'Grön' } })),
    ...Array.from({ length: 20 }, (_, index) => ({ id: `yellow-${index}`, triage: { emergencyDept: 'Gul' } })),
    ...Array.from({ length: 20 }, (_, index) => ({ id: `orange-${index}`, triage: { emergencyDept: 'Orange' } })),
    ...Array.from({ length: 20 }, (_, index) => ({ id: `red-${index}`, triage: { emergencyDept: 'Röd' } }))
  ];
  const assigned = assignInitialAcuteStartTimes(patients, '12:00');

  assert.equal(new Set(assigned.map(patient => patient.startTime)).size, patients.length);
  for (const patient of assigned) {
    const lookback = lookbackMinutes('12:00', patient.startTime);
    const color = patient.triage.emergencyDept;
    const maxLookback = { Grön: 240, Gul: 150, Orange: 90, Röd: 60 }[color];
    assert.ok(lookback >= 1 && lookback <= maxLookback, `${color} patient outside lookback: ${lookback}`);
  }
});

test('initial start times correctly wrap across midnight', () => {
  const patients = [
    { id: 'red-1', triage: { emergencyDept: 'Röd' } },
    { id: 'red-2', triage: { emergencyDept: 'Röd' } }
  ];
  const assigned = assignInitialAcuteStartTimes(patients, '00:01', () => 0);

  assert.equal(new Set(assigned.map(patient => patient.startTime)).size, patients.length);
  for (const patient of assigned) {
    const lookback = lookbackMinutes('00:01', patient.startTime);
    assert.ok(patient.startTime.startsWith('23:'));
    assert.ok(lookback >= 1 && lookback <= 60);
  }
});

test('duplicate persisted start times are detected for migration', () => {
  assert.equal(hasDistinctStartTimes([{ startTime: '10:00' }, { startTime: '10:00' }]), false);
  assert.equal(hasDistinctStartTimes([{ startTime: '09:30' }, { startTime: '10:00' }]), true);
});

test('the acute window repairs duplicate times only for initial census patients', () => {
  const patients = [
    { id: 'initial-1', initialAcuteCensus: true, startTime: '12:00', triage: { emergencyDept: 'Röd' } },
    { id: 'initial-2', startTime: '12:00', triage: { emergencyDept: 'Gul' } },
    { id: 'spontaneous', startTime: '12:00', triage: { emergencyDept: 'Grön' } }
  ];
  const repaired = repairInitialAcuteStartTimes(patients, ['initial-1', 'initial-2'], '12:00');

  assert.equal(hasDistinctStartTimes(repaired.slice(0, 2)), true);
  assert.equal(repaired[2].startTime, '12:00');
  assert.equal(repairInitialAcuteStartTimes(repaired, ['initial-1', 'initial-2'], '12:00'), repaired);
});