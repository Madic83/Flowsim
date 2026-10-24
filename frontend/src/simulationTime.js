export function toSimulationMinutes(time) {
  const [hours, minutes] = String(time || '00:00').split(':').map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return 0;
  return ((hours * 60 + minutes) % 1440 + 1440) % 1440;
}

export function elapsedSimulationMinutes(startTime, currentTime) {
  return (toSimulationMinutes(currentTime) - toSimulationMinutes(startTime) + 1440) % 1440;
}

export function addSimulationMinutes(time, duration) {
  const minutes = (toSimulationMinutes(time) + Math.max(0, Number(duration) || 0)) % 1440;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export function hasSimulationDurationElapsed(startTime, currentTime, durationMinutes) {
  return elapsedSimulationMinutes(startTime, currentTime) >= Math.max(0, Number(durationMinutes) || 0);
}