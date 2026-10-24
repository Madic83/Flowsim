function timeToMinutes(time) {
  const [hours, minutes] = String(time || '00:00').split(':').map(Number);
  return ((hours * 60 + minutes) % 1440 + 1440) % 1440;
}

function isDue(now, start, delay) {
  const elapsed = (timeToMinutes(now) - timeToMinutes(start) + 1440) % 1440;
  return elapsed >= delay;
}

function emptyRowId(personId) {
  return `arrived-${personId}`;
}

export function getUnassignedAvailableStaff(acuteStaff, arrivedSurgeryStaff, roster, excludedStaffIds = []) {
  const assignedIds = new Set();
  for (const staffId of excludedStaffIds) {
    if (staffId) assignedIds.add(staffId);
  }
  Object.entries(roster || {}).forEach(([sectionId, section]) => {
    if (sectionId !== 'available') {
      for (const entry of Array.isArray(section?.entries) ? section.entries : []) {
        if (entry?.personnelId) assignedIds.add(entry.personnelId);
      }
    }
    for (const personId of Object.values(section?.responsibilities || {})) {
      if (personId) assignedIds.add(personId);
    }
  });

  const uniquePeople = new Map();
  for (const person of [...(acuteStaff || []), ...(arrivedSurgeryStaff || [])]) {
    if (person?.id && !assignedIds.has(person.id)) uniquePeople.set(person.id, person);
  }
  return [...uniquePeople.values()];
}

export function shouldKeepLocalRoster(localRoster, remoteRoster) {
  const personnelIds = roster => new Set([
    ...Object.values(roster || {}).flatMap(section => [
      ...(Array.isArray(section?.entries) ? section.entries.map(entry => entry?.personnelId) : []),
      ...Object.values(section?.responsibilities || {})
    ])
  ].filter(Boolean));

  return personnelIds(localRoster).size > personnelIds(remoteRoster).size;
}

export function getInitialAcuteStaffIds(staffByCategory, configuredCounts, extraCounts = {}) {
  return Object.keys(configuredCounts).flatMap(category => {
    const totalCount = Math.max(0, Number(configuredCounts[category]) || 0);
    const addedCount = Math.min(totalCount, Math.max(0, Number(extraCounts[category]) || 0));
    return (staffByCategory[category] || []).slice(0, totalCount - addedCount).map(person => person.id);
  });
}

export function getAddedStaffIds(staffByCategory, configuredCounts, extraCounts = {}, categoryKeys = {}) {
  return Object.keys(configuredCounts).flatMap(category => {
    const people = (staffByCategory[category] || []).slice(0, Math.max(0, Number(configuredCounts[category]) || 0));
    const extraCount = Math.min(people.length, Math.max(0, Number(extraCounts[categoryKeys[category]]) || 0));
    return people.slice(people.length - extraCount).map(person => person.id);
  });
}

export function isOperationInProgress(opCareTasks, departmentPatients, simTime) {
  const currentMinutes = timeToMinutes(simTime);
  const activeTask = Object.values(opCareTasks || {}).some(task => {
    if (!Number.isFinite(Number(task?.startMinutes)) || !Number.isFinite(Number(task?.durationMinutes))) return false;
    const elapsed = (currentMinutes - Number(task.startMinutes) + 1440) % 1440;
    return elapsed < Number(task.durationMinutes);
  });
  if (activeTask) return true;

  const currentHour = Math.floor(currentMinutes / 60);
  return Object.entries(departmentPatients || {}).some(([sal, schedule]) => {
    if (!sal.startsWith('Sal ') || !schedule || typeof schedule !== 'object') return false;
    const patient = schedule[currentHour];
    return Boolean(patient && !patient.opDone);
  });
}

export function advanceSurgeryStaffArrivals(roster, staffPool, simTime, operationInProgress, random = Math.random, immediateStaffIds = []) {
  const nextRoster = { ...roster };
  const available = { ...nextRoster.available };
  const entries = [...(available.entries || [])];
  const arrivalStates = { ...(nextRoster.surgeryStaffArrivals || {}) };
  let changed = false;
  const immediateIds = new Set(immediateStaffIds);

  for (const person of staffPool) {
    const alreadyPlaced = Object.values(nextRoster).some(section => (
      Array.isArray(section?.entries) && section.entries.some(entry => entry.personnelId === person.id)
    ));
    if (alreadyPlaced || arrivalStates[person.id]?.status === 'arrived') continue;

    let state = arrivalStates[person.id];
    const arrivesImmediately = immediateIds.has(person.id);
    if (operationInProgress && !arrivesImmediately) {
      if (!state || state.status !== 'waiting') {
        arrivalStates[person.id] = { status: 'waiting' };
        changed = true;
      }
      continue;
    }

    if (!arrivesImmediately && (!state || state.status === 'waiting')) {
      state = {
        status: 'pending',
        startedAt: simTime,
        delayMinutes: Math.floor(random() * 10) + 1
      };
      arrivalStates[person.id] = state;
      changed = true;
    }

    if (!arrivesImmediately && !isDue(simTime, state.startedAt, state.delayMinutes)) continue;
    const emptyIndex = entries.findIndex(entry => !entry.name.trim() && !entry.role.trim() && !entry.specialty.trim());
    if (emptyIndex < 0) continue;

    entries[emptyIndex] = {
      id: emptyRowId(person.id),
      personnelId: person.id,
      personnelCategory: person.category,
      name: person.name,
      role: person.role,
      specialty: person.specialty
    };
    arrivalStates[person.id] = { ...(state || {}), status: 'arrived', arrivedAt: simTime, person };
    changed = true;
  }

  if (!changed) return roster;
  nextRoster.available = { ...available, entries };
  nextRoster.surgeryStaffArrivals = arrivalStates;
  return nextRoster;
}