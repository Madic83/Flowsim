// Definitioner för prehospitala resurser och fordon

export const personnelCategories = {
  paramedic: { label: 'Ambulanssjuksköterska', color: '#4caf50' },
  emt: { label: 'Ambulanssjukvårdare', color: '#66bb6a' },
  firefighter: { label: 'Brandman', color: '#f44336' },
  police: { label: 'Polis', color: '#1976d2' },
  doctor: { label: 'Läkare', color: '#9c27b0' },
  anesthesiaNurse: { label: 'Anestesisjuksköterska', color: '#8e24aa' }
};

export const vehicleTypes = {
  ambulance: {
    label: 'Ambulans',
    icon: '🚑',
    color: '#ffc107',
    personnel: {
      paramedic: 1,
      emt: 1
    },
    capacity: 1 // Antal patienter som kan transporteras samtidigt
  },
  fireEngine: {
    label: 'Brandbil',
    icon: '🚒',
    color: '#f44336',
    personnel: {
      firefighter: 4
    },
    capacity: 0
  },
  policeCar: {
    label: 'Polisbil',
    icon: '🚓',
    color: '#1976d2',
    personnel: {
      police: 2
    },
    capacity: 0
  },
  helicopterAmbulance: {
    label: 'Ambulanshelikopter',
    icon: '🚁',
    color: '#ff9800',
    personnel: {
      doctor: 1,
      anesthesiaNurse: 1
    },
    capacity: 1
  },
  commandVehicle: {
    label: 'Ledningsfordon',
    icon: '🚐',
    color: '#607d8b',
    personnel: {
      paramedic: 2
    },
    capacity: 0
  },
  rescueVehicle: {
    label: 'Räddningsfordon',
    icon: '🚙',
    color: '#ff5722',
    personnel: {
      firefighter: 3,
      paramedic: 1
    },
    capacity: 0
  }
};

// Åtgärder som kräver personal och tid - Prehospitala traumaåtgärder enligt XABCDE
export const actionRequirements = {
  // X - Exsanguination (Massiv blödning)
  'tourniquet': {
    personnel: 1,
    duration: 2,
    categories: ['paramedic', 'emt', 'firefighter', 'police', 'doctor', 'anesthesiaNurse'],
    label: 'Tourniquet',
    order: 1
  },
  'tryckförband': {
    personnel: 1,
    duration: 3,
    categories: ['police', 'firefighter', 'emt', 'paramedic', 'anesthesiaNurse', 'doctor'],
    label: 'Tryckförband',
    order: 2
  },
  
  // A - Airway (Luftväg)
  'fri_luftvag': {
    personnel: 1,
    duration: 1,
    categories: ['police', 'firefighter', 'emt', 'paramedic', 'anesthesiaNurse', 'doctor'],
    label: 'Fri luftväg',
    order: 3,
    locksPersonnel: true, // Låser personal tills definitiv luftväg säkrats
    requiresFollowUp: ['svalgtub', 'intubering', 'i-gel'] // Kräver en av dessa åtgärder för att frigöra personal
  },
  'svalgtub': {
    personnel: 1,
    duration: 2,
    categories: ['paramedic', 'anesthesiaNurse', 'doctor'],
    label: 'Svalgtub/Näskantarell',
    order: 4,
    resolvesAirwayLock: true // Frigör personal som är låst vid fri luftväg
  },
  'intubering': {
    personnel: 1,
    duration: 5,
    categories: ['doctor', 'anesthesiaNurse'],
    label: 'Intubering',
    order: 5,
    locksPersonnel: true // Låser personal tills patienten transporteras
  },
  'i-gel': {
    personnel: 1,
    duration: 3,
    categories: ['paramedic', 'anesthesiaNurse', 'doctor'],
    label: 'I-gel',
    order: 6,
    locksPersonnel: true // Låser personal tills patienten transporteras
  },
  
  // B - Breathing (Andning)
  'syrgas': {
    personnel: 1,
    duration: 2,
    categories: ['emt', 'paramedic', 'anesthesiaNurse', 'doctor'],
    label: 'Syrgas',
    order: 7
  },
  'bag_valve_mask': {
    personnel: 1,
    duration: 1,
    categories: ['emt', 'paramedic', 'anesthesiaNurse', 'doctor'],
    label: 'Ventilationsstöd',
    order: 8,
    locksPersonnel: true // Låser personal tills patienten transporteras
  },
  'thoraxdränage': {
    personnel: 1,
    duration: 8,
    categories: ['doctor'],
    label: 'Thoraxdränage',
    order: 9
  },
  
  // C - Circulation (Cirkulation)
  'pelvic_binder': {
    personnel: 2,
    duration: 4,
    categories: ['emt', 'paramedic', 'anesthesiaNurse', 'doctor'],
    label: 'Bäckengördel',
    order: 10
  },
  'venaccess': {
    personnel: 1,
    duration: 4,
    categories: ['paramedic', 'anesthesiaNurse', 'doctor'],
    label: 'Infart (PVK/IO)',
    order: 11
  },
  'vätskebehandling': {
    personnel: 1,
    duration: 2,
    categories: ['paramedic', 'anesthesiaNurse', 'doctor'],
    label: 'Vätskebehandling',
    order: 12
  },
  'blodtransfusion': {
    personnel: 1,
    duration: 3,
    categories: ['doctor', 'anesthesiaNurse'],
    label: 'Blodtransfusion',
    order: 13
  },
  'txa': {
    personnel: 1,
    duration: 2,
    categories: ['paramedic', 'anesthesiaNurse', 'doctor'],
    label: 'TXA (blödningshämmande)',
    order: 14
  },
  
  // D - Disability (Neurologisk status)
  'gcs_bedömning': {
    personnel: 1,
    duration: 2,
    categories: ['emt', 'paramedic', 'anesthesiaNurse', 'doctor'],
    label: 'GCS-bedömning',
    order: 15
  },
  'pupillkontroll': {
    personnel: 1,
    duration: 1,
    categories: ['emt', 'paramedic', 'anesthesiaNurse', 'doctor'],
    label: 'Pupillkontroll',
    order: 16
  },
  'smärtstillande': {
    personnel: 1,
    duration: 3,
    categories: ['paramedic', 'anesthesiaNurse', 'doctor'],
    label: 'Smärtstillande',
    order: 17
  },
  
  // E - Exposure/Environment (Exponering och värme)
  'värmebehandling': {
    personnel: 1,
    duration: 2,
    categories: ['firefighter', 'emt', 'paramedic', 'anesthesiaNurse', 'doctor'],
    label: 'Hypotermiprevention',
    order: 18
  },
  
  // Immobilisering
  'immobilisering': {
    personnel: 2,
    duration: 5,
    categories: ['firefighter', 'emt', 'paramedic', 'anesthesiaNurse', 'doctor'],
    label: 'Immobilisering',
    order: 19
  },
  
  // Övervakni ng
  'övervakning_vitalparametrar': {
    personnel: 1,
    duration: 3,
    categories: ['emt', 'paramedic', 'anesthesiaNurse', 'doctor'],
    label: 'Övervakning vitalparametrar',
    order: 20
  }
};

// Förflyttningsuppgifter som kräver personal
export const transportTasks = {
  carryToCollectionPoint: {
    label: 'Bära till uppsamlingsplats',
    personnel: 2,
    baseTime: 3, // minuter (kan variera beroende på avstånd)
    categories: ['firefighter', 'emt', 'paramedic', 'anesthesiaNurse', 'doctor']
  },
  carryToAmbulance: {
    label: 'Bära till ambulans',
    personnel: 2,
    baseTime: 2,
    categories: ['firefighter', 'emt', 'paramedic', 'anesthesiaNurse', 'doctor']
  },
  walkWithPatient: {
    label: 'Följa med patient (gående)',
    personnel: 1,
    baseTime: 4,
    categories: ['firefighter', 'emt', 'paramedic', 'anesthesiaNurse', 'doctor']
  }
};

// Hjälpfunktion för att räkna total personal från fordonslista
export function getTotalPersonnel(vehicles) {
  const total = {};
  
  vehicles.forEach(vehicle => {
    // Hoppa över fordon som är borta på transport
    if (vehicle.status === 'away') {
      return;
    }
    
    const vehicleType = vehicleTypes[vehicle.type];
    if (vehicleType && vehicleType.personnel) {
      Object.entries(vehicleType.personnel).forEach(([category, count]) => {
        total[category] = (total[category] || 0) + count;
      });
    }
  });
  
  return total;
}

// Hjälpfunktion för att kontrollera om det finns tillräckligt med personal för en åtgärd
export function canPerformAction(actionName, availablePersonnel) {
  const requirement = actionRequirements[actionName];
  if (!requirement) return false;
  
  // Kolla om det finns minst requirement.personnel tillgängliga från rätt kategori
  const availableCount = requirement.categories.reduce((sum, category) => {
    return sum + (availablePersonnel[category] || 0);
  }, 0);
  
  return availableCount >= requirement.personnel;
}

// Hjälpfunktion för att allokera personal till en åtgärd
export function allocatePersonnel(actionName, availablePersonnel) {
  const requirement = actionRequirements[actionName];
  if (!requirement) return null;
  
  const allocated = [];
  let needed = requirement.personnel;
  
  for (const category of requirement.categories) {
    const available = availablePersonnel[category] || 0;
    const toAllocate = Math.min(needed, available);
    
    if (toAllocate > 0) {
      for (let i = 0; i < toAllocate; i++) {
        allocated.push(category);
      }
      needed -= toAllocate;
    }
    
    if (needed === 0) break;
  }
  
  return needed === 0 ? allocated : null;
}

// Funktion för att räkna tillgänglig (inte upptagen) personal
export function getAvailablePersonnel(vehicles) {
  const available = {};
  vehicles.forEach(vehicle => {
    // Hoppa över fordon som är borta på transport
    if (vehicle.status === 'away') {
      return;
    }
    
    if (vehicle.personnel && Array.isArray(vehicle.personnel)) {
      vehicle.personnel.forEach(person => {
        if (person.status === 'available') {
          available[person.category] = (available[person.category] || 0) + 1;
        }
      });
    } else {
      // Fallback för gamla fordon utan personnel array
      const vehicleType = vehicleTypes[vehicle.type];
      if (vehicleType && vehicleType.personnel) {
        Object.entries(vehicleType.personnel).forEach(([category, count]) => {
          available[category] = (available[category] || 0) + count;
        });
      }
    }
  });
  return available;
}

// Prioritetsordning för att allokera personal (brandmän > poliser > ambulanssjukvårdare > ambulanssjuksköterskor > anestesisjuksköterskor > läkare)
export const personnelAllocationPriority = [
  'firefighter',
  'police',
  'emt',
  'paramedic',
  'anesthesiaNurse',
  'doctor'
];

// Allokera personal för transport (enligt prioritetsordning)
export function allocateTransportPersonnel(vehicles, count) {
  const allocated = [];
  const allowedCategories = ['firefighter', 'police', 'emt', 'paramedic', 'anesthesiaNurse', 'doctor'];
  
  for (const category of personnelAllocationPriority) {
    if (!allowedCategories.includes(category)) continue;
    
    for (const vehicle of vehicles) {
      if (!vehicle.personnel) continue;
      
      for (const person of vehicle.personnel) {
        if (person.category === category && person.status === 'available') {
          allocated.push({ vehicleId: vehicle.id, personId: person.id, category: person.category });
          if (allocated.length >= count) return allocated;
        }
      }
    }
  }
  
  return allocated.length >= count ? allocated : null;
}

// Allokera personal för åtgärd (enligt prioritetsordning men med allowedCategories från åtgärd)
export function allocateActionPersonnel(vehicles, count, allowedCategories) {
  const allocated = [];
  
  // Prioritetsordning för åtgärder: lägsta kompetens först
  // Använd anestesisjuksköterska före läkare, ambulanssjuksköterska före anestesisjuksköterska, etc.
  const actionPriority = ['police', 'firefighter', 'emt', 'paramedic', 'anesthesiaNurse', 'doctor'];
  
  for (const category of actionPriority) {
    if (!allowedCategories.includes(category)) continue;
    
    for (const vehicle of vehicles) {
      if (!vehicle.personnel) continue;
      
      for (const person of vehicle.personnel) {
        if (person.category === category && person.status === 'available') {
          allocated.push({ vehicleId: vehicle.id, personId: person.id, category: person.category });
          if (allocated.length >= count) return allocated;
        }
      }
    }
  }
  
  return allocated.length >= count ? allocated : null;
}

// Frigör allokerad personal
export function releasePersonnel(vehicles, allocatedPersonnel) {
  if (!allocatedPersonnel || allocatedPersonnel.length === 0) return vehicles;
  
  return vehicles.map(vehicle => {
    const hasAllocated = allocatedPersonnel.some(ap => ap.vehicleId === vehicle.id);
    if (!hasAllocated || !vehicle.personnel) return vehicle;
    
    return {
      ...vehicle,
      personnel: vehicle.personnel.map(person => {
        const isAllocated = allocatedPersonnel.some(ap => 
          ap.vehicleId === vehicle.id && ap.personId === person.id
        );
        return isAllocated ? { ...person, status: 'available' } : person;
      })
    };
  });
}

// Markera personal som upptagen
export function markPersonnelBusy(vehicles, allocatedPersonnel) {
  if (!allocatedPersonnel || allocatedPersonnel.length === 0) return vehicles;
  
  return vehicles.map(vehicle => {
    const hasAllocated = allocatedPersonnel.some(ap => ap.vehicleId === vehicle.id);
    if (!hasAllocated || !vehicle.personnel) return vehicle;
    
    return {
      ...vehicle,
      personnel: vehicle.personnel.map(person => {
        const isAllocated = allocatedPersonnel.some(ap => 
          ap.vehicleId === vehicle.id && ap.personId === person.id
        );
        return isAllocated ? { ...person, status: 'busy' } : person;
      })
    };
  });
}
