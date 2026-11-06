export const GREEN_PATIENT_BUS_CAPACITY = 40;

export function isGreenPrehospitalPatient(patient) {
  const triage = patient?.triage;
  const color = typeof triage === 'string'
    ? triage
    : triage?.scene || triage?.sorting || triage?.collectionPoint || triage?.emergencyDept;
  return color === 'Grön';
}

export function getBusPassengerIds(bus) {
  return Array.isArray(bus?.passengerIds) ? bus.passengerIds : [];
}

export function getBusAvailableSeats(bus) {
  return Math.max(0, GREEN_PATIENT_BUS_CAPACITY - getBusPassengerIds(bus).length);
}

export function canBoardGreenPatient(bus, patient) {
  return Boolean(
    bus?.type === 'bus' &&
    bus.status === 'available' &&
    Number.isFinite(Number(bus.lat)) &&
    Number.isFinite(Number(bus.lng)) &&
    patient?.location === 'Skadeplats' &&
    isGreenPrehospitalPatient(patient) &&
    !getBusPassengerIds(bus).includes(patient.id) &&
    getBusAvailableSeats(bus) > 0
  );
}

export function addGreenPatientToBus(bus, patient) {
  if (!canBoardGreenPatient(bus, patient)) return null;
  return {
    ...bus,
    passengerIds: [...getBusPassengerIds(bus), patient.id]
  };
}

export function canBusDepart(bus, collectionPoint, driverAllocation) {
  return Boolean(
    bus?.type === 'bus' &&
    bus.status === 'available' &&
    Number.isFinite(Number(bus.lat)) &&
    Number.isFinite(Number(bus.lng)) &&
    Number.isFinite(Number(collectionPoint?.lat)) &&
    Number.isFinite(Number(collectionPoint?.lng)) &&
    getBusPassengerIds(bus).length > 0 &&
    Array.isArray(driverAllocation) &&
    driverAllocation.length >= 1
  );
}
