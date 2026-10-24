// Automatisering av vårdåtgärder på akutmottagningen
// Bestämmer vilken vård en patient behöver baserat på triage/mekanism,
// samt hur lång tid (i simulerade minuter) åtgärderna tar.

// Hjälpfunktion: tid (HH:MM) -> minuter sedan midnatt
export function timeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const parts = timeStr.split(':');
  if (parts.length !== 2) return 0;
  const [h, m] = parts.map(Number);
  if (isNaN(h) || isNaN(m)) return 0;
  return h * 60 + m;
}

// Hjälpfunktion: minuter -> tid (HH:MM), wrap runt vid dygnsskifte
export function minutesToTime(minutes) {
  if (isNaN(minutes) || !isFinite(minutes)) return '00:00';
  const total = Math.floor(minutes);
  const h = ((total / 60) | 0) % 24;
  const m = ((total % 60) + 60) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Vårdpaket per triagefärg: aktiviteter, läkemedel och total behandlingstid (minuter)
const carePackages = {
  'röd':    { activities: ['Akut läkarbedömning', 'Monitorering', 'Vätsketerapi'], medications: ['Smärtstillande IV'], duration: 45 },
  'orange': { activities: ['Läkarbedömning', 'Blodprover'],                        medications: ['Smärtstillande'],    duration: 30 },
  'gul':    { activities: ['Läkarbedömning', 'Blodprover'],                        medications: [],                    duration: 25 },
  'grön':   { activities: ['Läkarbedömning'],                                      medications: [],                    duration: 15 },
  'blå':    { activities: ['Bedömning'],                                           medications: [],                    duration: 10 }
};

// Returnerar vårdpaket att köra för patienten, eller null om ingen automatisk vård ska ske
// (t.ex. redan behandlad eller triagerad som avliden/svart)
export function determineAkutCare(patient) {
  const triage = (patient?.triage?.emergencyDept || '').toLowerCase();
  if (!triage || triage === 'svart') return null;
  const pkg = carePackages[triage] || carePackages['gul'];
  return {
    activities: [...pkg.activities],
    medications: [...pkg.medications],
    durationMinutes: pkg.duration
  };
}
