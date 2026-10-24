const CAREGIVER_CATEGORIES = new Set(['paramedic', 'anesthesiaNurse', 'doctor']);
const DRIVER_CATEGORIES = new Set(['firefighter', 'police', 'emt', 'paramedic', 'anesthesiaNurse', 'doctor']);

function isAvailableToPatient(person, vehicleId, patientId, actionTimers) {
  if (person.status === 'available') return true;
  return (actionTimers[patientId]?.allocatedPersonnel || []).some(allocation => (
    allocation.vehicleId === vehicleId && allocation.personId === person.id
  ));
}

export function getReadyAmbulanceCrew(ambulance, vehicles, patientId, actionTimers = {}) {
  if (!ambulance || !['ambulance', 'helicopterAmbulance'].includes(ambulance.type) || ambulance.status === 'away') return null;

  const candidates = (vehicles || []).flatMap(vehicle => (
    vehicle.status === 'away' ? [] :
    (Array.isArray(vehicle.personnel) ? vehicle.personnel : []).map(person => ({
      ...person,
      vehicleId: vehicle.id,
      personId: person.id
    }))
  )).filter(person => isAvailableToPatient(person, person.vehicleId, patientId, actionTimers));

  const caregiver = candidates.find(person => CAREGIVER_CATEGORIES.has(person.category));
  if (!caregiver) return null;
  const driver = candidates.find(person => (
    (person.vehicleId !== caregiver.vehicleId || person.personId !== caregiver.personId) &&
    DRIVER_CATEGORIES.has(person.category)
  ));
  if (!driver) return null;
  return [caregiver, driver];
}

export function setTransportCrewStatus(vehicles, crew, status) {
  const allocatedIds = new Set((crew || []).map(person => `${person.vehicleId}:${person.personId}`));
  return (vehicles || []).map(vehicle => ({
    ...vehicle,
    personnel: Array.isArray(vehicle.personnel)
      ? vehicle.personnel.map(person => allocatedIds.has(`${vehicle.id}:${person.id}`)
        ? { ...person, status }
        : person
      )
      : vehicle.personnel
  }));
}