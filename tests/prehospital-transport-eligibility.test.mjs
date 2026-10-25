import assert from 'node:assert/strict';
import test from 'node:test';
import { getReadyAmbulanceCrew, setTransportCrewStatus } from '../frontend/src/prehospitalTransportEligibility.js';
import { actionRequirements } from '../frontend/src/components/prehospitalResources.js';

test('ambulance care assistants can perform svalgtub/näskantarell', () => {
  assert.ok(actionRequirements.svalgtub.categories.includes('emt'));
});

function vehicle(id, type, personnel, status = 'available') {
  return { id, type, personnel, status };
}

test('ambulance uses one available caregiver and one distinct driver', () => {
  const vehicles = [vehicle('AMB-1', 'ambulance', [
    { id: 'MED-1', category: 'paramedic', status: 'available' },
    { id: 'DRIVER-1', category: 'emt', status: 'available' }
  ])];

  assert.deepEqual(
    getReadyAmbulanceCrew(vehicles[0], vehicles, 'PAT-1').map(person => person.personId),
    ['MED-1', 'DRIVER-1']
  );
});

test('police and firefighters can drive an ambulance', () => {
  for (const driverCategory of ['police', 'firefighter']) {
    const vehicles = [vehicle('AMB-1', 'ambulance', [
      { id: 'MED-1', category: 'paramedic', status: 'available' },
      { id: `DRIVER-${driverCategory}`, category: driverCategory, status: 'available' }
    ])];
    const crew = getReadyAmbulanceCrew(vehicles[0], vehicles, 'PAT-1');
    assert.equal(crew[1].category, driverCategory);
  }
});

test('available staff from another ambulance can form the transport crew', () => {
  const vehicles = [
    vehicle('AMB-1', 'ambulance', [], 'available'),
    vehicle('AMB-2', 'ambulance', [
      { id: 'MED-1', category: 'paramedic', status: 'available' },
      { id: 'DRIVER-1', category: 'emt', status: 'available' }
    ])
  ];

  assert.deepEqual(
    getReadyAmbulanceCrew(vehicles[0], vehicles, 'PAT-1').map(person => person.vehicleId),
    ['AMB-2', 'AMB-2']
  );
});

test('personnel busy on the patient being transported can be reused', () => {
  const vehicles = [vehicle('AMB-1', 'ambulance', [
    { id: 'MED-1', category: 'paramedic', status: 'busy' },
    { id: 'DRIVER-1', category: 'emt', status: 'busy' }
  ])];
  const timers = {
    'PAT-1': {
      allocatedPersonnel: [
        { vehicleId: 'AMB-1', personId: 'MED-1' },
        { vehicleId: 'AMB-1', personId: 'DRIVER-1' }
      ]
    }
  };

  assert.equal(getReadyAmbulanceCrew(vehicles[0], vehicles, 'PAT-1', timers).length, 2);
  assert.equal(getReadyAmbulanceCrew(vehicles[0], vehicles, 'OTHER-PATIENT', timers), null);
});

test('a crew member busy on another task is not eligible, even if a second driver exists', () => {
  const vehicles = [
    vehicle('AMB-1', 'ambulance', [], 'available'),
    vehicle('AMB-2', 'ambulance', [
      { id: 'MED-1', category: 'paramedic', status: 'available' },
      { id: 'BUSY-EMT', category: 'emt', status: 'busy' },
      { id: 'POLICE-1', category: 'police', status: 'available' }
    ])
  ];

  const crew = getReadyAmbulanceCrew(vehicles[0], vehicles, 'PAT-1');
  assert.deepEqual(crew.map(person => person.personId), ['MED-1', 'POLICE-1']);
});

test('personnel attached to an away vehicle cannot be borrowed', () => {
  const vehicles = [
    vehicle('AMB-1', 'ambulance', [], 'available'),
    vehicle('AMB-2', 'ambulance', [
      { id: 'MED-1', category: 'paramedic', status: 'available' },
      { id: 'DRIVER-1', category: 'emt', status: 'available' }
    ], 'away')
  ];
  assert.equal(getReadyAmbulanceCrew(vehicles[0], vehicles, 'PAT-1'), null);
});

test('reserving and releasing a crew updates only the allocated people in their source vehicles', () => {
  const vehicles = [
    vehicle('AMB-1', 'ambulance', [
      { id: 'MED-1', category: 'paramedic', status: 'available' },
      { id: 'EMT-1', category: 'emt', status: 'available' }
    ]),
    vehicle('POLICE-1', 'policeCar', [
      { id: 'POLICE-DRIVER', category: 'police', status: 'available' }
    ])
  ];
  const crew = [
    { vehicleId: 'AMB-1', personId: 'MED-1' },
    { vehicleId: 'POLICE-1', personId: 'POLICE-DRIVER' }
  ];

  const reserved = setTransportCrewStatus(vehicles, crew, 'busy');
  assert.equal(reserved[0].personnel[0].status, 'busy');
  assert.equal(reserved[0].personnel[1].status, 'available');
  assert.equal(reserved[1].personnel[0].status, 'busy');

  const released = setTransportCrewStatus(reserved, crew, 'available');
  assert.equal(released[0].personnel[0].status, 'available');
  assert.equal(released[0].personnel[1].status, 'available');
  assert.equal(released[1].personnel[0].status, 'available');
});

test('an away ambulance and duplicate use of one person are rejected', () => {
  const away = vehicle('AMB-1', 'ambulance', [
    { id: 'MED-1', category: 'paramedic', status: 'available' },
    { id: 'DRIVER-1', category: 'emt', status: 'available' }
  ], 'away');
  assert.equal(getReadyAmbulanceCrew(away, [away], 'PAT-1'), null);

  const onePerson = vehicle('AMB-2', 'ambulance', [
    { id: 'MED-1', category: 'paramedic', status: 'available' }
  ]);
  assert.equal(getReadyAmbulanceCrew(onePerson, [onePerson], 'PAT-1'), null);
});