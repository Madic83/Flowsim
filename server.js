// ...existing code...

// ...existing code...

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// API: Regenerate personnel, tar emot antal per kategori
app.post('/api/regenerate-personnel', (req, res) => {
  const counts = req.body && req.body.counts && typeof req.body.counts === 'object' ? req.body.counts : {};
  execFile(process.execPath, [path.join(__dirname, 'generate_personnel.js'), JSON.stringify(counts)], { cwd: __dirname }, (error, stdout, stderr) => {
    if (error) {
      console.error('Error running generate_personnel.js:', error);
      return res.status(500).json({ error: 'Kunde inte generera personal' });
    }
    if (stderr) {
      console.error('generate_personnel.js stderr:', stderr);
    }
    console.log('generate_personnel.js stdout:', stdout);
    res.json({ status: 'ok', output: stdout });
  });
});

// In-memory sessions for role-based login (instructor/participant)
const sessions = new Map();

function generateSessionId(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

app.post('/api/sessions/create', (req, res) => {
  const username = (req.body?.username || '').toString();
  const password = (req.body?.password || '').toString();
  const expectedUsername = process.env.FLOWSIM_ADMIN_USERNAME || 'admin';
  const expectedPassword = process.env.FLOWSIM_ADMIN_PASSWORD || 'admin';

  if (username !== expectedUsername || password !== expectedPassword) {
    return res.status(401).json({ error: 'Felaktigt användarnamn eller lösenord.' });
  }

  const displayName = (req.body?.displayName || '').toString().trim() || 'Instruktor';

  let sessionId = generateSessionId();
  while (sessions.has(sessionId)) {
    sessionId = generateSessionId();
  }

  const session = {
    id: sessionId,
    createdAt: new Date().toISOString(),
    departmentPatients: {},
    acutePatients: {},
    catastropheRoster: null,
    hospitalEvents: [],
    environment: req.body?.environment || {
      weather: 'clear',
      temperatureC: 15,
      windSpeed: 0,
      forceDarkness: false,
      lighting: true,
      surface: 'asphalt'
    },
    members: [
      {
        displayName,
        role: 'instructor',
        joinedAt: new Date().toISOString()
      }
    ]
  };

  sessions.set(sessionId, session);
  res.json({ sessionId, role: 'instructor', displayName });
});

app.post('/api/sessions/join', (req, res) => {
  const sessionId = (req.body?.sessionId || '').toString().trim().toUpperCase();
  const role = (req.body?.role || '').toString().trim();
  const displayName = (req.body?.displayName || '').toString().trim() || 'Anvandare';

  if (!sessionId) {
    return res.status(400).json({ error: 'Session saknas' });
  }
  if (role !== 'instructor' && role !== 'participant') {
    return res.status(400).json({ error: 'Ogiltig roll' });
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session finns inte' });
  }

  session.members.push({
    memberId: generateSessionId(16),
    displayName,
    role,
    joinedAt: new Date().toISOString(),
    lastSeenAt: Date.now()
  });

  res.json({ sessionId, role, displayName, memberId: session.members[session.members.length - 1].memberId });
});

app.post('/api/sessions/:sessionId/heartbeat', (req, res) => {
  const session = sessions.get(req.params.sessionId.toUpperCase());
  if (!session) {
    return res.status(404).json({ error: 'Session finns inte' });
  }

  const member = session.members.find(candidate =>
    candidate.role === 'participant' && candidate.memberId === req.body?.memberId
  );
  if (!member) {
    return res.status(404).json({ error: 'Deltagaren finns inte i sessionen' });
  }

  member.lastSeenAt = Date.now();
  res.json({ status: 'ok' });
});

app.put('/api/sessions/:sessionId/environment', (req, res) => {
  const session = sessions.get(req.params.sessionId.toUpperCase());
  if (!session) {
    return res.status(404).json({ error: 'Session finns inte' });
  }

  if (!req.body?.environment || typeof req.body.environment !== 'object') {
    return res.status(400).json({ error: 'Ogiltig väderinställning' });
  }

  session.environment = req.body.environment;
  res.json({ status: 'ok' });
});

app.put('/api/sessions/:sessionId/hospital-events', (req, res) => {
  const session = sessions.get(req.params.sessionId.toUpperCase());
  if (!session) {
    return res.status(404).json({ error: 'Session finns inte' });
  }
  if (!Array.isArray(req.body?.hospitalEvents)) {
    return res.status(400).json({ error: 'Ogiltig händelselista' });
  }

  session.hospitalEvents = req.body.hospitalEvents;
  res.json({ status: 'ok' });
});

app.put('/api/sessions/:sessionId/departments', (req, res) => {
  const session = sessions.get(req.params.sessionId.toUpperCase());
  if (!session) {
    return res.status(404).json({ error: 'Session finns inte' });
  }
  if (!req.body?.departmentPatients || typeof req.body.departmentPatients !== 'object' || Array.isArray(req.body.departmentPatients)) {
    return res.status(400).json({ error: 'Ogiltiga avdelningslistor' });
  }

  session.departmentPatients = req.body.departmentPatients;
  res.json({ status: 'ok' });
});

app.put('/api/sessions/:sessionId/acute-patients', (req, res) => {
  const session = sessions.get(req.params.sessionId.toUpperCase());
  if (!session) {
    return res.status(404).json({ error: 'Session finns inte' });
  }
  if (!req.body?.acutePatients || typeof req.body.acutePatients !== 'object' || Array.isArray(req.body.acutePatients)) {
    return res.status(400).json({ error: 'Ogiltiga akutpatientlistor' });
  }

  session.acutePatients = req.body.acutePatients;
  res.json({ status: 'ok' });
});

app.put('/api/sessions/:sessionId/catastrophe-roster', (req, res) => {
  const session = sessions.get(req.params.sessionId.toUpperCase());
  if (!session) {
    return res.status(404).json({ error: 'Session finns inte' });
  }
  if (!req.body?.catastropheRoster || typeof req.body.catastropheRoster !== 'object' || Array.isArray(req.body.catastropheRoster)) {
    return res.status(400).json({ error: 'Ogiltig katastrofliggare' });
  }

  session.catastropheRoster = req.body.catastropheRoster;
  res.json({ status: 'ok' });
});

app.get('/api/sessions/:sessionId/status', (req, res) => {
  const session = sessions.get(req.params.sessionId.toUpperCase());
  if (!session) {
    return res.status(404).json({ error: 'Session finns inte' });
  }

  const onlineThreshold = Date.now() - 45000;
  const participantCount = session.members.filter(member =>
    member.role === 'participant' && member.lastSeenAt >= onlineThreshold
  ).length;

  res.json({
    sessionId: session.id,
    participantCount,
    environment: session.environment,
    departmentPatients: session.departmentPatients,
    acutePatients: session.acutePatients,
    catastropheRoster: session.catastropheRoster,
    hospitalEvents: session.hospitalEvents
  });
});

// API: Serve patients from JSON file
app.get('/api/patients', (req, res) => {
  const file = path.join(__dirname, 'patients_150_valid_pnr.json');
  console.log('Reading patient file:', file);
  fs.readFile(file, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading patient file:', err);
      return res.status(500).json({ error: 'Kunde inte läsa patientfilen' });
    }
    try {
      const patients = JSON.parse(data);
      console.log('First patient in file:', patients[0]);
      res.json(patients);
    } catch (e) {
      console.error('Error parsing patient JSON:', e);
      res.status(500).json({ error: 'Fel vid tolkning av JSON' });
    }
  });
});

const LESSONS = [
  { id: 1, title: 'Introduktion till Flowsim', content: 'Detta är första lektionen.' },
  { id: 2, title: 'Grundläggande koncept', content: 'Här lär du dig grunderna.' }
];
let PROGRESS = [];

app.get('/api/lessons', (req, res) => res.json(LESSONS));
app.get('/api/lessons/:id', (req, res) => {
  const id = Number(req.params.id);
  const l = LESSONS.find(x => x.id === id);
  if (!l) return res.status(404).json({ detail: 'Not found' });
  res.json(l);
});

app.get('/api/progress', (req, res) => res.json(PROGRESS));
app.post('/api/progress', (req, res) => {
  const p = req.body;
  PROGRESS.push(p);
  res.json({ status: 'ok' });
});

// Serve frontend - prefer built `frontend/dist` when available
const distDir = fs.existsSync(path.join(__dirname, 'frontend', 'dist'))
  ? path.join(__dirname, 'frontend', 'dist')
  : path.join(__dirname, 'frontend');

app.get('/hospital_personnel.json', (req, res, next) => {
  const personnelFile = path.join(__dirname, 'frontend', 'public', 'hospital_personnel.json');
  if (!fs.existsSync(personnelFile)) return next();
  res.sendFile(personnelFile);
});

app.use(express.static(distDir));
app.get('*', (req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Flowsim running on http://localhost:${port}`));
