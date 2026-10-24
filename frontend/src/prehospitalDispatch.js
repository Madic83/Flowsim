export function movePatientToParatus(patient, prehospitalPatients, paratusPatients) {
  if (!patient?.id) {
    return { prehospitalPatients, paratusPatients, moved: false };
  }

  const updatedPrehospitalPatients = (Array.isArray(prehospitalPatients) ? prehospitalPatients : [])
    .filter(scenePatient => scenePatient.id !== patient.id);
  const existingParatusPatients = Array.isArray(paratusPatients) ? paratusPatients : [];
  const alreadyInParatus = existingParatusPatients.some(paratusPatient => paratusPatient.id === patient.id);

  return {
    prehospitalPatients: updatedPrehospitalPatients,
    paratusPatients: alreadyInParatus
      ? existingParatusPatients.map(paratusPatient => paratusPatient.id === patient.id ? patient : paratusPatient)
      : [...existingParatusPatients, patient],
    moved: true
  };
}