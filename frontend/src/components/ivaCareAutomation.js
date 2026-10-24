// Automatisering av intensivvård (IVA/NIVA/THIVA/IMA/THIMA)
// Bestämmer vilken intensivvård en patient behöver baserat på triage/mekanism,
// samt hur lång tid (i simulerade minuter) övervakningen/behandlingen tar.

const carePackages = {
  'röd':    { activities: ['Intensivövervakning', 'Respiratorbehandling'], medications: ['Sedering'],           duration: 240 },
  'orange': { activities: ['Intensivövervakning'],                        medications: ['Smärtstillande IV'],  duration: 180 },
  'gul':    { activities: ['Övervakning vitalparametrar'],                 medications: [],                     duration: 120 },
  'grön':   { activities: ['Övervakning vitalparametrar'],                 medications: [],                     duration: 90 }
};

// Returnerar vårdpaket att köra för patienten, eller null om ingen automatisk vård ska ske
export function determineIvaCare(patient) {
  const triage = (patient?.triage?.emergencyDept || patient?.triage?.scene || '').toLowerCase();
  if (!triage || triage === 'svart') return null;
  const pkg = carePackages[triage] || carePackages['gul'];
  return {
    activities: [...pkg.activities],
    medications: [...pkg.medications],
    durationMinutes: pkg.duration
  };
}
