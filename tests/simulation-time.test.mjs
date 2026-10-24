import assert from 'node:assert/strict';
import test from 'node:test';
import { addSimulationMinutes, elapsedSimulationMinutes, hasSimulationDurationElapsed, toSimulationMinutes } from '../frontend/src/simulationTime.js';

test('converts simulated time to minutes after midnight', () => {
  assert.equal(toSimulationMinutes('20:15'), 1215);
  assert.equal(toSimulationMinutes('00:05'), 5);
});

test('elapsed simulated minutes wrap across midnight', () => {
  assert.equal(elapsedSimulationMinutes('23:58', '00:03'), 5);
  assert.equal(hasSimulationDurationElapsed('23:58', '00:02', 5), false);
  assert.equal(hasSimulationDurationElapsed('23:58', '00:03', 5), true);
});

test('simulated deadlines wrap across midnight', () => {
  assert.equal(addSimulationMinutes('23:55', 15), '00:10');
});