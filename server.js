// ...existing code...

// ...existing code...

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
// API: Regenerate personnel, tar emot antal per kategori
app.post('/api/regenerate-personnel', (req, res) => {
  const { exec } = require('child_process');
  let counts = req.body && req.body.counts ? req.body.counts : {};
  // Skicka in counts som JSON-strängad argument
  exec(`node generate_personnel.js '${JSON.stringify(counts)}'`, { cwd: __dirname }, (error, stdout, stderr) => {
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
app.use(cors());
app.use(express.json());

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
  const displayName = (req.body?.displayName || '').toString().trim() || 'Instruktor';

  let sessionId = generateSessionId();
  while (sessions.has(sessionId)) {
    sessionId = generateSessionId();
  }

  const session = {
    id: sessionId,
    createdAt: new Date().toISOString(),
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
    displayName,
    role,
    joinedAt: new Date().toISOString()
  });

  res.json({ sessionId, role, displayName });
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

app.use(express.static(distDir));
app.get('*', (req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Flowsim running on http://localhost:${port}`));
