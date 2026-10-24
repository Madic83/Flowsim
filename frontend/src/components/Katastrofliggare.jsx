import React, { useEffect, useState } from 'react';
import '../styles/katastrofliggare.css';
import { advanceSurgeryStaffArrivals, getAddedStaffIds, getInitialAcuteStaffIds, getUnassignedAvailableStaff, isOperationInProgress, shouldKeepLocalRoster } from '../catastropheStaffArrivals.js';

const SECTION_DEFINITIONS = [
  {
    id: 'storsal',
    title: 'STORSAL',
    group: 'top',
    rows: 19,
    responsibilities: [{ key: 'roomLead', label: 'Salsansvarig' }, { key: 'materialLead', label: 'Materialansvarig' }]
  },
  {
    id: 'akutrum',
    title: 'AKUTRUM',
    group: 'top',
    rows: 19,
    responsibilities: [{ key: 'roomLead', label: 'Salsansvarig' }, { key: 'materialLead', label: 'Materialansvarig' }]
  },
  {
    id: 'available',
    title: 'TILLGÄNGLIG PERSONAL (KONFERENSRUM)',
    group: 'top',
    rows: 33,
    responsibilities: [{ key: 'personnelLead', label: 'Personalansvarig' }]
  },
  { id: 'triage', title: 'TRIAGE', group: 'top', rows: 19, responsibilities: [] },
  {
    id: 'waiting',
    title: 'VÄNTRUM',
    group: 'bottom',
    rows: 18,
    responsibilities: [{ key: 'roomLead', label: 'Salsansvarig' }, { key: 'materialLead', label: 'Materialansvarig' }]
  },
  {
    id: 'yellow-zone',
    title: 'GUL ZON',
    group: 'bottom',
    rows: 18,
    responsibilities: [
      { key: 'doctorLead', label: 'Zonansvarig läk', allowedCategories: ['Akutläkare'] },
      { key: 'nurseLead', label: 'Zonansvarig ssk', allowedCategories: ['Akutsjuksköterskor'] }
    ]
  }
];

const ACUTE_STAFF_DISPLAY = {
  Akutläkare: { role: 'Läkare', specialty: 'Akut' },
  Akutsjuksköterskor: { role: 'Sjuksköterska', specialty: 'Akut' },
  'Undersköterskor akuten': { role: 'Undersköterska', specialty: 'Akut' }
};

function emptyRow(id = `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`) {
  return { id, name: '', role: '', specialty: '' };
}

function createEmptyRoster() {
  return {
    surgeryStaffArrivals: {},
    ...Object.fromEntries(SECTION_DEFINITIONS.map(section => [section.id, {
    responsibilities: Object.fromEntries(section.responsibilities.map(item => [item.key, ''])),
    entries: Array.from({ length: section.rows }, (_, index) => emptyRow(`${section.id}-${index}`))
    }]))
  };
}

function normalizeRoster(saved) {
  const empty = createEmptyRoster();
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return empty;
  return {
    surgeryStaffArrivals: saved.surgeryStaffArrivals && typeof saved.surgeryStaffArrivals === 'object'
      ? saved.surgeryStaffArrivals
      : {},
    ...Object.fromEntries(SECTION_DEFINITIONS.map(section => {
      const savedSection = saved[section.id] && typeof saved[section.id] === 'object' ? saved[section.id] : {};
      const entries = Array.isArray(savedSection.entries) ? savedSection.entries : [];
      const paddedEntries = [...entries, ...Array.from({ length: Math.max(0, section.rows - entries.length) }, (_, index) => emptyRow(`${section.id}-new-${index}`))];
      return [section.id, {
        responsibilities: { ...empty[section.id].responsibilities, ...(savedSection.responsibilities || {}) },
        entries: paddedEntries.map((entry, index) => ({
          ...emptyRow(entry?.id || `${section.id}-saved-${index}`),
          ...(entry && typeof entry === 'object' ? entry : {})
        }))
      }];
    }))
  };
}

function readSavedRoster(storageKey) {
  try {
    return normalizeRoster(JSON.parse(localStorage.getItem(storageKey) || 'null'));
  } catch {
    return createEmptyRoster();
  }
}

function normalizeForSort(value) {
  return String(value || '').trim();
}

export default function Katastrofliggare({ simTime = '00:00' }) {
  const sessionAuth = (() => {
    try {
      return JSON.parse(localStorage.getItem('flowsimSessionAuth') || 'null');
    } catch {
      return null;
    }
  })();
  const sessionId = sessionAuth?.sessionId && sessionAuth.sessionId !== 'ÖPPEN' ? sessionAuth.sessionId : null;
  const storageKey = `katastrofliggare:${sessionId || 'local'}`;
  const [roster, setRoster] = useState(() => readSavedRoster(storageKey));
  const [sorting, setSorting] = useState({});
  const [notice, setNotice] = useState('');
  const [availableAcuteStaff, setAvailableAcuteStaff] = useState([]);
  const [surgeryStaffPool, setSurgeryStaffPool] = useState([]);
  const [addedSurgeryStaffIds, setAddedSurgeryStaffIds] = useState([]);
  const [acuteStaffPresentAtStartIds, setAcuteStaffPresentAtStartIds] = useState(() => new Set());

  useEffect(() => {
    let active = true;
    let latestLoad = 0;
    const loadAcuteStaff = async () => {
      const loadId = ++latestLoad;
      try {
        const personnelResponse = await fetch(`/hospital_personnel.json?updated=${Date.now()}`);
        if (!personnelResponse.ok) return;
        const data = await personnelResponse.json();
        const configResponse = JSON.parse(localStorage.getItem('hospitalPersonnelConfig') || '{}');
        const extraCounts = JSON.parse(localStorage.getItem('hospitalPersonnelExtraCounts') || '{}');
        if (!active || loadId !== latestLoad) return;
        const counts = {
          Akutläkare: Number(configResponse.akutläkare ?? 4),
          Akutsjuksköterskor: Number(configResponse.akutsjuksköterskor ?? 4),
          'Undersköterskor akuten': Number(configResponse.usk_akut ?? 5),
          Anestesiläkare: Number(configResponse.narkoslakare ?? 2),
          Narkossköterskor: Number(configResponse.narkosskoterskor ?? 2),
          Kirurger: Number(configResponse.kirurger ?? 1),
          Ortopeder: Number(configResponse.ortopeder ?? 1),
          'Undersköterskor operation': Number(configResponse.usk_op ?? 2)
        };
        const staffDisplay = {
          Anestesiläkare: { role: 'Narkosläkare', specialty: 'Anestesi' },
          Narkossköterskor: { role: 'Narkossköterska', specialty: 'Anestesi' },
          Kirurger: { role: 'Kirurg', specialty: 'Kirurgi' },
          Ortopeder: { role: 'Ortoped', specialty: 'Ortopedi' },
          'Undersköterskor operation': { role: 'Undersköterska', specialty: 'Operation' }
        };
        const staff = (Array.isArray(data.personnel) ? data.personnel : [])
          .filter(person => Object.hasOwn(counts, person.category))
          .reduce((groups, person) => {
            groups[person.category] ||= [];
            groups[person.category].push(person);
            return groups;
          }, {});
        if (active) {
          const toRosterPerson = person => ({
            id: person.id,
            name: `${person.firstName} ${person.lastName}`.trim(),
            category: person.category,
            ...(ACUTE_STAFF_DISPLAY[person.category] || staffDisplay[person.category])
          });
          const acuteCategories = Object.keys(ACUTE_STAFF_DISPLAY);
          const acuteCounts = Object.fromEntries(acuteCategories.map(category => [category, counts[category]]));
          const acuteExtraCounts = {
            Akutläkare: extraCounts.akutläkare,
            Akutsjuksköterskor: extraCounts.akutsjuksköterskor,
            'Undersköterskor akuten': extraCounts.usk_akut
          };
          const presentAtStart = getInitialAcuteStaffIds(staff, acuteCounts, acuteExtraCounts);
          const configuredAcuteStaff = acuteCategories.flatMap(category => (
            (staff[category] || []).slice(0, Math.max(0, counts[category])).map(toRosterPerson)
          ));
          const configuredSurgeryStaff = Object.keys(staffDisplay).flatMap(category => (
            (staff[category] || []).slice(0, Math.max(0, counts[category])).map(toRosterPerson)
          ));
          const addedStaffIds = getAddedStaffIds(staff, counts, extraCounts, {
            Anestesiläkare: 'narkoslakare',
            Narkossköterskor: 'narkosskoterskor',
            Kirurger: 'kirurger',
            Ortopeder: 'ortopeder',
            'Undersköterskor operation': 'usk_op'
          });
          setAcuteStaffPresentAtStartIds(new Set(presentAtStart));
          setAvailableAcuteStaff(configuredAcuteStaff);
          setSurgeryStaffPool(configuredSurgeryStaff);
          setAddedSurgeryStaffIds(addedStaffIds);
        }
      } catch {}
    };
    loadAcuteStaff();
    window.addEventListener('hospitalPersonnelRosterChanged', loadAcuteStaff);
    function handleExtraPersonnelChange(event) {
      if (['hospitalPersonnelExtraCounts', 'hospitalPersonnelRosterVersion'].includes(event.key)) loadAcuteStaff();
    }
    function handlePersonnelConfigChange(event) {
      if (event.key === 'hospitalPersonnelConfig') loadAcuteStaff();
    }
    window.addEventListener('storage', handleExtraPersonnelChange);
    window.addEventListener('storage', handlePersonnelConfigChange);
    return () => {
      active = false;
      window.removeEventListener('hospitalPersonnelRosterChanged', loadAcuteStaff);
      window.removeEventListener('storage', handleExtraPersonnelChange);
      window.removeEventListener('storage', handlePersonnelConfigChange);
    };
  }, []);

  useEffect(() => {
    setRoster(readSavedRoster(storageKey));
  }, [storageKey]);

  useEffect(() => {
    if (!sessionId) return undefined;
    let active = true;
    const syncRoster = async () => {
      try {
        const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/status`);
        if (!response.ok) return;
        const status = await response.json();
        if (!active || !status.catastropheRoster) return;
        const localRoster = readSavedRoster(storageKey);
        if (shouldKeepLocalRoster(localRoster, status.catastropheRoster)) {
          fetch(`/api/sessions/${encodeURIComponent(sessionId)}/catastrophe-roster`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ catastropheRoster: localRoster })
          }).catch(() => {});
          return;
        }
        const serialized = JSON.stringify(status.catastropheRoster);
        if (localStorage.getItem(storageKey) !== serialized) {
          const normalizedRoster = normalizeRoster(status.catastropheRoster);
          localStorage.setItem(storageKey, JSON.stringify(normalizedRoster));
          setRoster(normalizedRoster);
        }
      } catch {}
    };
    syncRoster();
    const interval = setInterval(syncRoster, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [sessionId, storageKey]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(roster));
    if (!sessionId) return undefined;
    const timeout = setTimeout(() => {
      fetch(`/api/sessions/${encodeURIComponent(sessionId)}/catastrophe-roster`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ catastropheRoster: roster })
      }).catch(() => {});
    }, 250);
    return () => clearTimeout(timeout);
  }, [roster, sessionId, storageKey]);

  useEffect(() => {
    if (surgeryStaffPool.length === 0) return;
    let departmentPatients = {};
    let opCareTasks = {};
    try {
      departmentPatients = JSON.parse(localStorage.getItem('departmentPatients') || '{}');
      const allTasks = JSON.parse(localStorage.getItem('opCareTasks') || '{}');
      const hospital = new URLSearchParams(window.location.search).get('hospital') || 'Norrlands universitetssjukhus';
      opCareTasks = allTasks[hospital] || {};
    } catch {}
    const operationInProgress = isOperationInProgress(opCareTasks, departmentPatients, simTime);
    setRoster(previous => advanceSurgeryStaffArrivals(previous, surgeryStaffPool, simTime, operationInProgress, Math.random, addedSurgeryStaffIds));
  }, [roster.surgeryStaffArrivals, roster.available?.entries, simTime, surgeryStaffPool, addedSurgeryStaffIds]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = setTimeout(() => setNotice(''), 2500);
    return () => clearTimeout(timeout);
  }, [notice]);

  const rosterStaff = Object.values(roster)
    .flatMap(section => section.entries || [])
    .filter(entry => entry.personnelId && entry.personnelCategory && !acuteStaffPresentAtStartIds.has(entry.personnelId))
    .map(entry => ({
      id: entry.personnelId,
      name: entry.name,
      category: entry.personnelCategory,
      role: entry.role,
      specialty: entry.specialty
    }));
  const arrivedSurgeryStaff = Object.values(roster.surgeryStaffArrivals || {})
    .filter(arrival => arrival?.status === 'arrived' && arrival.person?.id)
    .map(arrival => arrival.person);
  const unassignedAvailableStaff = getUnassignedAvailableStaff(
    availableAcuteStaff,
    arrivedSurgeryStaff,
    roster,
    acuteStaffPresentAtStartIds
  );
  const selectableStaff = Array.from(new Map(
    [...availableAcuteStaff, ...rosterStaff].map(person => [person.id, person])
  ).values());

  function assignResponsibility(sectionId, key, staffId) {
    const employee = selectableStaff.find(person => person.id === staffId);
    const responsibility = SECTION_DEFINITIONS.find(section => section.id === sectionId)
      ?.responsibilities.find(item => item.key === key);
    if (employee && responsibility?.allowedCategories && !responsibility.allowedCategories.includes(employee.category)) {
      return;
    }
    setRoster(previous => {
      const assignedElsewhere = Object.entries(previous).some(([otherSectionId, section]) => (
        (otherSectionId !== 'available' && Array.isArray(section?.entries) && section.entries.some(entry => entry?.personnelId === staffId)) ||
        Object.entries(section?.responsibilities || {}).some(([otherKey, value]) => (
          value === staffId && (otherSectionId !== sectionId || otherKey !== key)
        ))
      ));
      if (employee && assignedElsewhere) {
        setNotice(`${employee.name} är redan placerad i liggaren.`);
        return previous;
      }
      setNotice('');
      return {
        ...previous,
        [sectionId]: {
          ...previous[sectionId],
          responsibilities: { ...previous[sectionId].responsibilities, [key]: staffId || '' }
        }
      };
    });
  }

  function updateEntry(sectionId, rowId, field, value) {
    setRoster(previous => ({
      ...previous,
      [sectionId]: {
        ...previous[sectionId],
        entries: previous[sectionId].entries.map(entry => entry.id === rowId ? { ...entry, [field]: value } : entry)
      }
    }));
  }

  function assignAcuteStaff(sectionId, rowId, staffId) {
    const employee = selectableStaff.find(person => person.id === staffId);
    setRoster(previous => {
      const assignedElsewhere = Object.values(previous).some(section => (
        (section !== previous.available && Array.isArray(section?.entries) && section.entries.some(entry => (
          entry?.id !== rowId && entry?.personnelId === staffId
        ))) || Object.values(section?.responsibilities || {}).includes(staffId)
      ));
      if (employee && assignedElsewhere) {
        setNotice(`${employee.name} är redan placerad i en annan lista.`);
        return previous;
      }
      setNotice('');
      return {
        ...previous,
        [sectionId]: {
          ...previous[sectionId],
          entries: previous[sectionId].entries.map(entry => {
            if (entry.id !== rowId) return entry;
            return employee
              ? {
                ...entry,
                personnelId: employee.id,
                personnelCategory: employee.category,
                name: employee.name,
                role: employee.role,
                specialty: employee.specialty
              }
                : { ...entry, personnelId: '', name: '', role: '', specialty: '' };
          })
        }
      };
    });
  }

  function sortSection(sectionId, field) {
    setSorting(previous => ({
      ...previous,
      [sectionId]: previous[sectionId]?.field === field
        ? { field, direction: previous[sectionId].direction === 'asc' ? 'desc' : 'asc' }
        : { field, direction: 'asc' }
    }));
  }

  function moveEntry(sourceSectionId, rowId, targetSectionId) {
    if (sourceSectionId === targetSectionId) return;
    const source = roster[sourceSectionId]?.entries || [];
    const target = roster[targetSectionId]?.entries || [];
    const entry = source.find(item => item.id === rowId) || (
      sourceSectionId === 'available'
        ? unassignedAvailableStaff.find(person => person.id === rowId)
        : null
    );
    if (!entry || !entry.name.trim()) return;
    if (targetSectionId === 'available') {
      setRoster(previous => ({
        ...previous,
        [sourceSectionId]: {
          ...previous[sourceSectionId],
          entries: previous[sourceSectionId].entries.map(item => item.id === rowId ? emptyRow(item.id) : item)
        }
      }));
      return;
    }
    const targetIndex = target.findIndex(item => !item.name.trim() && !item.role.trim() && !item.specialty.trim());
    if (targetIndex < 0) {
      setNotice('Mållistan är full.');
      return;
    }
    setRoster(previous => ({
      ...previous,
      [sourceSectionId]: {
        ...previous[sourceSectionId],
        entries: previous[sourceSectionId].entries.map(item => item.id === rowId ? emptyRow(item.id) : item)
      },
      [targetSectionId]: {
        ...previous[targetSectionId],
        entries: previous[targetSectionId].entries.map((item, index) => index === targetIndex ? entry : item)
      }
    }));
  }

  function renderSection(section) {
    const sectionRoster = roster[section.id] || { responsibilities: {}, entries: [] };
    const sortState = sorting[section.id];
    const displayEntries = section.id === 'available' ? unassignedAvailableStaff : sectionRoster.entries;
    const entries = displayEntries.map((entry, index) => ({ entry, index }));
    if (sortState) {
      entries.sort((left, right) => {
        const leftValue = normalizeForSort(left.entry[sortState.field]);
        const rightValue = normalizeForSort(right.entry[sortState.field]);
        if (!leftValue && rightValue) return 1;
        if (leftValue && !rightValue) return -1;
        return leftValue.localeCompare(rightValue, 'sv', { numeric: true, sensitivity: 'base' }) * (sortState.direction === 'asc' ? 1 : -1) || left.index - right.index;
      });
    }
    return (
      <section className={`catastrophe-section catastrophe-section--${section.group}`} key={section.id} onDragOver={event => event.preventDefault()} onDrop={event => {
        event.preventDefault();
        try {
          const transfer = JSON.parse(event.dataTransfer.getData('application/flowsim-roster-entry'));
          moveEntry(transfer.sectionId, transfer.rowId, section.id);
        } catch {}
      }}>
        <h2 className="catastrophe-section__title">{section.title}</h2>
        {section.responsibilities.length > 0 && (
          <div className="catastrophe-responsibilities">
            {section.responsibilities.map(item => (
              <label className="catastrophe-responsibility" key={item.key}>
                <span>{item.label}:</span>
                <select value={sectionRoster.responsibilities[item.key] || ''} onChange={event => assignResponsibility(section.id, item.key, event.target.value)}>
                  <option value=""></option>
                  {selectableStaff.filter(person => {
                    if (item.allowedCategories && !item.allowedCategories.includes(person.category)) return false;
                    const assignedElsewhere = Object.entries(roster).some(([otherSectionId, otherSection]) => (
                      (otherSectionId !== 'available' && Array.isArray(otherSection?.entries) && otherSection.entries.some(entry => entry?.personnelId === person.id)) ||
                      Object.entries(otherSection?.responsibilities || {}).some(([otherKey, value]) => (
                        value === person.id && (otherSectionId !== section.id || otherKey !== item.key)
                      ))
                    ));
                    return !assignedElsewhere || sectionRoster.responsibilities[item.key] === person.id;
                  }).map(person => (
                    <option key={person.id} value={person.id}>
                      {person.name} ({person.category})
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        )}
        <div className="catastrophe-table-wrap">
          <table className="catastrophe-table">
            <thead>
              <tr>
                {[
                  ['Namn', 'name'],
                  ['Yrkesroll', 'role'],
                  ['Specialitet', 'specialty']
                ].map(([label, field]) => (
                  <th key={field} onClick={() => sortSection(section.id, field)} title={`Sortera ${label}`}>
                    {label}{sortState?.field === field ? (sortState.direction === 'asc' ? ' ▲' : ' ▼') : ' ▾'}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.id === 'available' ? entries.map(({ entry }) => (
                <tr
                  key={entry.id}
                  draggable
                  onDragStart={event => event.dataTransfer.setData('application/flowsim-roster-entry', JSON.stringify({ sectionId: 'available', rowId: entry.id }))}
                >
                  <td>{entry.name}</td>
                  <td>{entry.role}</td>
                  <td>{entry.specialty}</td>
                </tr>
              )) : entries.map(({ entry }) => (
                <tr
                  key={entry.id}
                  draggable={Boolean(entry.name.trim())}
                  onDragStart={event => event.dataTransfer.setData('application/flowsim-roster-entry', JSON.stringify({ sectionId: section.id, rowId: entry.id }))}
                >
                  <td>
                    <select
                      className="catastrophe-person-select"
                      aria-label={`${section.title} välj akutpersonal`}
                      value={entry.personnelId || ''}
                      onChange={event => assignAcuteStaff(section.id, entry.id, event.target.value)}
                    >
                      <option value=""></option>
                      {selectableStaff.filter(person => {
                        const assignedToAnotherRow = Object.values(roster).some(otherSection => (
                          otherSection !== roster.available && Array.isArray(otherSection?.entries) && otherSection.entries.some(otherEntry => (
                            otherEntry?.id !== entry.id && otherEntry?.personnelId === person.id
                          ))
                        ));
                        const assignedToResponsibility = Object.values(roster).some(otherSection => (
                          Object.values(otherSection?.responsibilities || {}).includes(person.id)
                        ));
                        return entry.personnelId === person.id || (!assignedToAnotherRow && !assignedToResponsibility);
                      }).map(person => (
                        <option key={person.id} value={person.id}>
                          {person.name} ({person.category})
                        </option>
                      ))}
                    </select>
                  </td>
                  {['role', 'specialty'].map(field => (
                    <td key={field}>
                      <input
                        aria-label={`${section.title} ${field}`}
                        value={entry[field] || ''}
                        onChange={event => updateEntry(section.id, entry.id, field, event.target.value)}
                        onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  return (
    <main className="catastrophe-sheet">
      <header className="catastrophe-sheet__toolbar">
        <div>
          <p className="catastrophe-sheet__eyebrow">KATASTROF</p>
          <h1>Personalliggare</h1>
        </div>
        <span className="catastrophe-sheet__hint">Redigera celler direkt · Dra personal mellan listor</span>
      </header>
      {notice && <div role="status" className="catastrophe-notice">{notice}</div>}
      <div className="catastrophe-grid catastrophe-grid--top">
        {SECTION_DEFINITIONS.filter(section => section.group === 'top').map(renderSection)}
      </div>
      <div className="catastrophe-grid catastrophe-grid--bottom">
        {SECTION_DEFINITIONS.filter(section => section.group === 'bottom').map(renderSection)}
      </div>
    </main>
  );
}