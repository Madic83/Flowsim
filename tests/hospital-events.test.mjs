import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createHospitalEvent,
  getUpsTimerRemainingMinutes,
  HOSPITAL_EVENT_TYPES,
  UPS_TIMER_DURATION_MINUTES
} from '../frontend/src/hospitalEvents.js';
import {
  getHospitalEventMessages,
  MAX_EVENT_MESSAGES_PER_SIM_MINUTE
} from '../frontend/src/hospitalEventMessages.js';

test('hospital event catalogue contains power, IT, oxygen, water and custom incidents', () => {
  assert.deepEqual(HOSPITAL_EVENT_TYPES.map(event => event.id), [
    'power-outage',
    'it-outage',
    'oxygen-disruption',
    'water-outage',
    'custom'
  ]);
});

test('creates an active hospital event with selected severity and simulation time', () => {
  const event = createHospitalEvent({
    type: 'power-outage',
    hospital: 'Norrlands universitetssjukhus',
    severity: 'high',
    description: 'Reservkraft startar inte.',
    simTime: '14:35'
  });

  assert.equal(event.title, 'Elavbrott');
  assert.equal(event.hospital, 'Norrlands universitetssjukhus');
  assert.equal(event.severity, 'high');
  assert.equal(event.description, 'Reservkraft startar inte.');
  assert.equal(event.createdAtSimTime, '14:35');
  assert.equal(event.status, 'active');
  assert.equal(event.resolvedAtSimTime, null);
  assert.ok(event.id);
});

test('requires a custom event title and hospital, and normalizes severity', () => {
  assert.equal(createHospitalEvent({ type: 'custom', hospital: 'Lycksele lasarett' }), null);
  assert.equal(createHospitalEvent({ type: 'power-outage', hospital: '' }), null);

  const event = createHospitalEvent({
    type: 'custom',
    title: 'Evakuering av vårdavdelning',
    hospital: 'Lycksele lasarett',
    severity: 'invalid'
  });
  assert.equal(event.title, 'Evakuering av vårdavdelning');
  assert.equal(event.severity, 'high');
});

test('critical power outage starts a 60-minute UPS timer at the event simulation time', () => {
  const outage = createHospitalEvent({
    type: 'power-outage',
    hospital: 'Norrlands universitetssjukhus',
    severity: 'high',
    simTime: '23:30'
  });

  assert.equal(UPS_TIMER_DURATION_MINUTES, 60);
  assert.deepEqual(outage.upsTimer, {
    startedAtSimTime: '23:30',
    durationMinutes: 60,
    status: 'running'
  });
  assert.equal(getUpsTimerRemainingMinutes(outage, '23:30'), 60);
  assert.equal(getUpsTimerRemainingMinutes(outage, '23:50'), 40);
  assert.equal(getUpsTimerRemainingMinutes(outage, '00:30'), 0);
});

test('critical power outage reports only blue UPS outlets active, not standby generation', () => {
  const event = createHospitalEvent({
    type: 'power-outage',
    hospital: 'Norrlands universitetssjukhus',
    severity: 'high',
    simTime: '10:00'
  });
  const messages = getHospitalEventMessages(event, '23:59');

  assert.ok(messages.length > 50);
  assert.ok(messages.every(message => message.updateIndex === 0));
  assert.ok(messages.every(message => /blå UPS-uttag/i.test(message.message)));
  assert.ok(messages.every(message => !/reservkraften har tagit över|reservkraft och larmfunktioner kontrolleras/i.test(message.message)));
});

test('non-critical power outages and other critical incidents do not start UPS', () => {
  const outage = createHospitalEvent({
    type: 'power-outage',
    hospital: 'Lycksele lasarett',
    severity: 'medium',
    simTime: '10:00'
  });
  const itOutage = createHospitalEvent({
    type: 'it-outage',
    hospital: 'Lycksele lasarett',
    severity: 'high',
    simTime: '10:00'
  });

  assert.equal(outage.upsTimer, undefined);
  assert.equal(itOutage.upsTimer, undefined);
  assert.equal(getUpsTimerRemainingMinutes({ ...outage, upsTimer: { startedAtSimTime: '10:00', durationMinutes: 60, status: 'running' } }, '10:01'), null);
});

test('NUS water outage sends one distinct first report per ward and clinic on the exercise timeline', () => {
  const event = createHospitalEvent({
    type: 'water-outage',
    hospital: 'Norrlands universitetssjukhus',
    simTime: '10:00'
  });

  assert.deepEqual(getHospitalEventMessages(event, '10:00'), []);
  assert.deepEqual(getHospitalEventMessages(event, '10:04'), []);

  const earlyReports = getHospitalEventMessages(event, '10:05');
  assert.ok(earlyReports.length <= MAX_EVENT_MESSAGES_PER_SIM_MINUTE);
  assert.ok(earlyReports.every(message => message.offsetMinutes <= 5));

  const allReports = getHospitalEventMessages(event, '10:50');
  const pediatrics = allReports.find(message => message.unit === 'Barnavdelning 2 Umeå' && message.updateIndex === 0);
  const dialysis = allReports.find(message => message.unit === 'Medicincentrum Dialysen' && message.updateIndex === 0);
  assert.ok(allReports.length > 50);
  assert.ok(allReports.length < 100);
  assert.equal(allReports.every(message => message.offsetMinutes >= 5), true);
  assert.equal(allReports.every(message => message.updateIndex === 0), true);
  assert.match(pediatrics.message, /sondmatning|dehydrering/i);
  assert.match(dialysis.message, /dialysverksamheten har stoppats/i);
  assert.notEqual(pediatrics.message, dialysis.message);

  const messagesByMinute = new Map();
  const messagesByUnit = new Map();
  allReports.forEach(message => {
    messagesByMinute.set(message.offsetMinutes, (messagesByMinute.get(message.offsetMinutes) || 0) + 1);
    const unitMessages = messagesByUnit.get(message.unit) || [];
    unitMessages.push(message);
    messagesByUnit.set(message.unit, unitMessages);
  });
  assert.ok(Math.max(...messagesByMinute.values()) <= MAX_EVENT_MESSAGES_PER_SIM_MINUTE);
  messagesByUnit.forEach(unitMessages => {
    const ordered = unitMessages.sort((left, right) => left.updateIndex - right.updateIndex);
    assert.equal(ordered.length, 1);
    assert.equal(ordered[0].updateIndex, 0);
  });
  assert.equal(getHospitalEventMessages(event, '23:59').some(message => message.updateIndex > 0), false);
});

test('each new NUS water outage receives a fresh stored report schedule', () => {
  const originalRandom = Math.random;
  let firstEvent;
  let secondEvent;
  try {
    Math.random = () => 0;
    firstEvent = createHospitalEvent({
      type: 'water-outage',
      hospital: 'Norrlands universitetssjukhus',
      simTime: '08:00'
    });
    Math.random = () => 0.999999;
    secondEvent = createHospitalEvent({
      type: 'water-outage',
      hospital: 'Norrlands universitetssjukhus',
      simTime: '08:00'
    });
  } finally {
    Math.random = originalRandom;
  }

  assert.ok(firstEvent.messageSchedule);
  assert.ok(secondEvent.messageSchedule);
  assert.notDeepEqual(firstEvent.messageSchedule, secondEvent.messageSchedule);
  assert.ok(firstEvent.responsePlan);
  assert.ok(secondEvent.responsePlan);
  assert.notDeepEqual(firstEvent.responsePlan, secondEvent.responsePlan);
  const firstReplies = getHospitalEventMessages(firstEvent, '08:15');
  const secondReplies = getHospitalEventMessages(secondEvent, '08:15');
  assert.notEqual(firstReplies[0].message, secondReplies[0].message);
  for (const schedule of Object.values(firstEvent.messageSchedule)) {
    assert.equal(schedule.length, 1);
    assert.ok(schedule[0] >= 5 && schedule[0] <= 50);
  }
  assert.ok(new Set(Object.values(firstEvent.messageSchedule).map(schedule => schedule[0])).size > 15);
});

test('water-outage message timeline stops at the event resolution time', () => {
  const event = {
    ...createHospitalEvent({ type: 'water-outage', hospital: 'Norrlands universitetssjukhus', simTime: '10:00' }),
    status: 'resolved',
    resolvedAtSimTime: '10:45'
  };
  const messages = getHospitalEventMessages(event, '12:00');

  assert.ok(messages.length > 0);
  assert.equal(messages.every(message => message.offsetMinutes <= 45), true);
});

test('water-outage response catalog is scoped to its documented NUS scenario', () => {
  const event = createHospitalEvent({
    type: 'water-outage',
    hospital: 'Skellefteå sjukhus',
    simTime: '10:00'
  });
  assert.deepEqual(getHospitalEventMessages(event, '10:00'), []);
});

test('power, IT, oxygen and custom incidents create distinct staged unit messages', () => {
  const cases = [
    ['power-outage', undefined, /reservkraft|elberoende|batteri/i],
    ['it-outage', undefined, /journal|pappers|reservblankett/i],
    ['oxygen-disruption', undefined, /syrgas|tuber|försörjning/i],
    ['custom', 'Evakuering av vårdavdelning', /Evakuering av vårdavdelning/]
  ];

  for (const [type, title, expectedContent] of cases) {
    const event = createHospitalEvent({
      type,
      title,
      hospital: 'Norrlands universitetssjukhus',
      severity: 'high',
      description: type === 'custom' ? 'Övningsscenario: hissarna är avstängda.' : '',
      simTime: '10:00'
    });
    assert.ok(event.messageSchedule, `${type} should have a stored message schedule`);
    assert.ok(event.responsePlan, `${type} should have a stored unit response plan`);

    const messages = getHospitalEventMessages(event, '10:50');
    assert.ok(messages.length > 40, `${type} should notify each listed NUS unit`);
    assert.ok(messages.some(message => expectedContent.test(message.message)), `${type} should contain incident-specific wording`);
      assert.ok(new Set(messages.map(message => message.message)).size > 4, `${type} should have varied unit responses`);
    assert.ok(messages.every(message => message.offsetMinutes >= 5 && message.offsetMinutes <= 50));
  }
});

test('two separate exercises can produce different response text for the same non-water incident', () => {
  const originalRandom = Math.random;
  let firstEvent;
  let secondEvent;
  try {
    Math.random = () => 0;
    firstEvent = createHospitalEvent({
      type: 'it-outage',
      hospital: 'Norrlands universitetssjukhus',
      simTime: '10:00'
    });
    Math.random = () => 0.999999;
    secondEvent = createHospitalEvent({
      type: 'it-outage',
      hospital: 'Norrlands universitetssjukhus',
      simTime: '10:00'
    });
  } finally {
    Math.random = originalRandom;
  }

  assert.notDeepEqual(firstEvent.responsePlan, secondEvent.responsePlan);
  const firstMessages = getHospitalEventMessages(firstEvent, '23:59');
  const secondMessages = getHospitalEventMessages(secondEvent, '23:59');
  const firstByUnit = new Map(firstMessages.map(message => [message.unit, message.message]));
  assert.ok(secondMessages.some(message => firstByUnit.get(message.unit) !== message.message));
});

test('power, IT, oxygen and custom incidents send varied department-specific responses', () => {
  const cases = [
    ['power-outage', undefined, /reservkraft|elberoende|batteri/i],
    ['it-outage', undefined, /journal|pappers|reservblankett/i],
    ['oxygen-disruption', undefined, /syrgas|tuber|försörjning/i],
    ['custom', 'Evakuering av vårdavdelning', /Evakuering av vårdavdelning/]
  ];

  for (const [type, title, expectedText] of cases) {
    const event = createHospitalEvent({
      type,
      title,
      hospital: 'Norrlands universitetssjukhus',
      severity: 'high',
      description: type === 'custom' ? 'Hissarna är avstängda.' : '',
      simTime: '10:00'
    });
    const messages = getHospitalEventMessages(event, '23:59');

    assert.equal(event.messageSchedule ? true : false, true, `${type} needs a stored timeline`);
    assert.ok(event.responsePlan, `${type} needs a stored per-unit response plan`);
    assert.ok(messages.length > 40, `${type} should send reports from the NUS units`);
    assert.ok(messages.every(message => message.updateIndex === 0), `${type} should currently send only the first report`);
    assert.ok(messages.some(message => expectedText.test(message.message)), `${type} should use incident-specific language`);
    assert.ok(new Set(messages.map(message => message.message)).size > 10, `${type} should have different replies across units`);
    assert.ok(messages.every(message => message.offsetMinutes >= 5));
    const perMinute = new Map();
    messages.forEach(message => perMinute.set(message.offsetMinutes, (perMinute.get(message.offsetMinutes) || 0) + 1));
    assert.ok(Math.max(...perMinute.values()) <= MAX_EVENT_MESSAGES_PER_SIM_MINUTE);
  }
});

test('non-water response plans are newly randomized and preserved in each event', () => {
  const originalRandom = Math.random;
  let firstEvent;
  let secondEvent;
  try {
    Math.random = () => 0;
    firstEvent = createHospitalEvent({
      type: 'power-outage',
      hospital: 'Norrlands universitetssjukhus',
      simTime: '10:00'
    });
    Math.random = () => 0.999999;
    secondEvent = createHospitalEvent({
      type: 'power-outage',
      hospital: 'Norrlands universitetssjukhus',
      simTime: '10:00'
    });
  } finally {
    Math.random = originalRandom;
  }

  assert.notDeepEqual(firstEvent.messageSchedule, secondEvent.messageSchedule);
  assert.notDeepEqual(firstEvent.responsePlan, secondEvent.responsePlan);
  const firstMessages = getHospitalEventMessages(firstEvent, '23:59');
  const secondMessages = getHospitalEventMessages(secondEvent, '23:59');
  const firstByUnit = new Map(firstMessages.map(message => [message.unit, message.message]));
  assert.ok(secondMessages.some(message => firstByUnit.get(message.unit) !== message.message));
});