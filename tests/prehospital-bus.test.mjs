import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addGreenPatientToBus,
  canBoardGreenPatient,
  canBusDepart,
  getBusAvailableSeats,
  GREEN_PATIENT_BUS_CAPACITY,
  isGreenPrehospitalPatient
} from '../frontend/src/prehospitalBus.js';
import { vehicleTypes } from '../frontend/src/components/prehospitalResources.js';

function bus(overrides = {}) {
  return {
    id: 'BUS-1',
    type: 'bus',
    status: 'available',
    lat: 63.82,
    lng: 20.25,
    passengerIds: [],
    personnel: [],
    ...overrides
  };
}

function patient(id, triage = 'Grön') {
  return { id, triage: { scene: triage }, location: 'Skadeplats' };
}

test('control-panel bus carries 40 green patients and adds no onboard staff', () => {
  assert.equal(vehicleTypes.bus.capacity, 40);
  assert.deepEqual(vehicleTypes.bus.personnel, {});
  assert.equal(vehicleTypes.bus.passengerTriage, 'Grön');
  assert.equal(vehicleTypes.bus.requiresDriver, true);
});

test('bus has 40 seats and only boards green patients when placed at the scene', () => {
  const placedBus = bus();
  assert.equal(GREEN_PATIENT_BUS_CAPACITY, 40);
  assert.equal(getBusAvailableSeats(placedBus), 40);
  assert.equal(isGreenPrehospitalPatient(patient('GREEN-1')), true);
  assert.equal(canBoardGreenPatient(placedBus, patient('GREEN-1')), true);
  assert.equal(canBoardGreenPatient(placedBus, patient('YELLOW-1', 'Gul')), false);
  assert.equal(canBoardGreenPatient(placedBus, { ...patient('GREEN-ELSEWHERE'), location: 'Uppsamlingsplats' }), false);
  assert.equal(canBoardGreenPatient(bus({ lat: undefined, lng: undefined }), patient('GREEN-2')), false);
});

test('boarding prevents duplicates and enforces the forty-passenger limit', () => {
  const placedBus = bus();
  const firstBoarding = addGreenPatientToBus(placedBus, patient('GREEN-1'));
  assert.deepEqual(firstBoarding.passengerIds, ['GREEN-1']);
  assert.equal(addGreenPatientToBus(firstBoarding, patient('GREEN-1')), null);

  const fullBus = bus({ passengerIds: Array.from({ length: GREEN_PATIENT_BUS_CAPACITY }, (_, index) => `GREEN-${index}`) });
  assert.equal(getBusAvailableSeats(fullBus), 0);
  assert.equal(canBoardGreenPatient(fullBus, patient('GREEN-41')), false);
});

test('bus departure requires boarded patients, a collection point, and one allocated driver', () => {
  const loadedBus = bus({ passengerIds: ['GREEN-1'] });
  const collectionPoint = { lat: 63.83, lng: 20.26 };

  assert.equal(canBusDepart(loadedBus, collectionPoint, [{ category: 'police', personId: 'P-1' }]), true);
  assert.equal(canBusDepart(loadedBus, collectionPoint, []), false);
  assert.equal(canBusDepart(bus(), collectionPoint, [{ category: 'doctor', personId: 'D-1' }]), false);
  assert.equal(canBusDepart(loadedBus, null, [{ category: 'emt', personId: 'E-1' }]), false);
  assert.equal(canBusDepart(bus({ status: 'awaitingPlacement' }), collectionPoint, [{ category: 'emt' }]), false);
});