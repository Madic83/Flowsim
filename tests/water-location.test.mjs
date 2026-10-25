import assert from 'node:assert/strict';
import test from 'node:test';
import { isOpenStreetMapWaterColor } from '../frontend/src/waterLocation.js';

test('recognizes the map water-fill blue', () => {
  assert.equal(isOpenStreetMapWaterColor(170, 211, 223), true);
  assert.equal(isOpenStreetMapWaterColor(180, 218, 228), true);
});

test('does not classify parking, roads, buildings, or blue map symbols as water', () => {
  assert.equal(isOpenStreetMapWaterColor(220, 217, 214), false);
  assert.equal(isOpenStreetMapWaterColor(240, 238, 232), false);
  assert.equal(isOpenStreetMapWaterColor(165, 180, 190), false);
  assert.equal(isOpenStreetMapWaterColor(35, 125, 190), false);
  assert.equal(isOpenStreetMapWaterColor(90, 170, 220), false);
});