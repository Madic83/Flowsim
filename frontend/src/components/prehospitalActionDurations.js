// Prehospital action durations in minutes
export const prehospitalActionDurations = {
  // X - Exsanguination
  'tourniquet': 2,
  'tryckförband': 3,
  'pelvic_binder': 4,
  
  // A - Airway
  'fri_luftvag': 0, // Ingen specifik tid - personal låses tills uppföljning
  'svalgtub': 2,
  'intubering': 0, // Låser personal i oändlighet
  'i-gel': 0, // Låser personal i oändlighet
  
  // B - Breathing
  'syrgas': 2,
  'bag_valve_mask': 0, // Låser personal i oändlighet
  'thoraxdränage': 8,
  
  // C - Circulation
  'venaccess': 4,
  'vätskebehandling': 2,
  'blodtransfusion': 3,
  'txa': 2,
  
  // D - Disability
  'gcs_bedömning': 2,
  'pupillkontroll': 1,
  'smärtstillande': 3,
  
  // E - Exposure/Environment
  'värmebehandling': 2,
  
  // Övriga
  'immobilisering': 5,
  'övervakning_vitalparametrar': 3
};
