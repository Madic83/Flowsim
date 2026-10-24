// Automatisering av operationer
// Bestämmer hur lång tid (i simulerade minuter) en operation tar samt vad som ska
// dokumenteras, baserat på patientens planerade ingrepp.

const durationKeywords = [
  { keywords: ['transplantation', 'hjärt', 'thorax', 'neurokirurgi', 'kraniotomi'], duration: 240 },
  { keywords: ['fraktur', 'höft', 'knä', 'axel', 'rygg', 'ortoped'], duration: 120 },
  { keywords: ['appendektomi', 'gallblåsa', 'bråck', 'blindtarm'], duration: 60 }
];
const defaultDuration = 90;

// Returnerar operationspaket för patienten, eller null om ingen operation behövs/är planerad
export function determineOPCare(patient) {
  const surgery = patient?.interventions?.Surgery;
  if (!surgery || surgery.toLowerCase() === 'ingen') return null;
  const lower = surgery.toLowerCase();
  const found = durationKeywords.find(d => d.keywords.some(k => lower.includes(k)));
  return {
    activities: [`Operation: ${surgery}`],
    medications: ['Narkos'],
    durationMinutes: found ? found.duration : defaultDuration
  };
}
