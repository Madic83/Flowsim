// Automatisering av prehospital omhändertagande
import { prehospitalActionDurations } from './components/prehospitalActionDurations';
import { vehicleTypes, getAvailablePersonnel, allocateTransportPersonnel, allocateActionPersonnel, releasePersonnel, actionRequirements } from './components/prehospitalResources';

// Hjälpfunktion för att konvertera tid till minuter
function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

// Hjälpfunktion för att konvertera minuter till tid
function minutesToTime(minutes) {
  // Hantera negativa värden och mycket stora värden
  if (isNaN(minutes) || !isFinite(minutes)) {
    console.warn('[minutesToTime] Ogiltigt värde:', minutes);
    return '00:00';
  }
  
  // Hantera värden över 24 timmar genom att wrappa runt
  const totalMinutes = Math.floor(minutes);
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// Bestäm vilken behandling en patient behöver baserat på XABCDE
function determineRequiredTreatment(patient) {
  const xabcde = patient.XABCDE || patient.ABCDE;
  if (!xabcde) return null;
  
  // Prioritera i ordning X > A > B > C > D
  
  // X - Blödning
  const exang = xabcde.X?.Exanguination || '';
  if (exang === 'Aktiv blödning' || exang === 'Riklig') {
    return 'tourniquet';
  }
  if (exang === 'Pelvic instability' || exang === 'Måttlig') {
    return 'pelvic_binder';
  }
  
  // A - Luftväg
  const airway = xabcde.A?.airway || '';
  if (airway === 'Ej fri' || airway === 'Hotad') {
    return 'intubering';
  }
  
  // B - Andning
  const sat = xabcde.B?.Sat;
  const af = xabcde.B?.AF;
  if (sat !== undefined && sat < 94) {
    return 'syrgas';
  }
  if (af !== undefined && (af < 10 || af > 30)) {
    return 'bag_valve_mask';
  }
  
  // C - Cirkulation
  const puls = xabcde.C?.Puls;
  if (puls !== undefined && (puls < 50 || puls > 120)) {
    return 'venaccess';
  }
  
  // D - Medvetande/neurologisk status
  const gcs = xabcde.D?.GCS;
  if (gcs !== undefined && gcs < 13) {
    return 'smärtstillande';
  }
  
  // Om patienten är ganska stabil, ge övervakning
  return 'övervakning_vitalparametrar';
}

// Triagera patient enligt SÅLLNINGSTRIAGE (Svensk standard - primär triage på skadeplatsen)
function triagePatientSMART(patient) {
  const xabcde = patient.XABCDE || patient.ABCDE;
  if (!xabcde) return 'Gul'; // Default om ingen data
  
  // 1. Kan patienten gå?
  const canWalk = patient.canWalk || false; // Denna skulle sättas från patientdata
  if (canWalk === true) {
    return 'Grön';
  }
  
  // Patienten kan inte gå - kontrollera andning
  const af = xabcde.B?.AF;
  const airway = xabcde.A?.airway || '';
  
  // 2. Bedöm andning
  // Om patienten inte andas eller luftvägen är blockerad
  if (af === undefined || af === 0 || airway === 'Ej fri' || airway === 'Blockerad') {
    // Försök öppna luftvägen med enkla medel
    // Om detta inte hjälper → "Avvakta" (Svart)
    // Om luftvägen öppnas → Röd
    
    // I detta system antar vi att:
    // - Om airway är 'Ej fri' men kan öppnas → blir Röd
    // - Om airway är 'Blockerad' och inte kan öppnas → blir Svart
    
    if (airway === 'Blockerad') {
      return 'Svart'; // Kan inte öppnas - avvakta
    } else if (airway === 'Ej fri') {
      return 'Röd'; // Kan öppnas med enkla medel
    }
  }
  
  // 3. Patienten andas - bedöm andningsfrekvens
  if (af !== undefined && af > 0) {
    // Andningsfrekvens under 10 eller 30 eller mer = Röd
    if (af < 10 || af >= 30) {
      return 'Röd';
    }
    
    // Andningsfrekvens mellan 10-29 - bedöm puls
    const puls = xabcde.C?.Puls;
    if (puls !== undefined) {
      if (puls > 120) {
        return 'Röd';
      } else {
        return 'Gul';
      }
    }
  }
  
  // Default fallback
  return 'Gul';
}

// Sorteringstriage enligt poängsystem (på uppsamlingsplats)
// Baseras på: Andningsfrekvens, Systoliskt blodtryck, GCS
function sorteringstriagePatient(patient) {
  const xabcde = patient.XABCDE || patient.ABCDE;
  if (!xabcde) return 'Röd'; // Default om ingen data
  
  let totalPoints = 0;
  
  // Andningsfrekvens (AF)
  const af = xabcde.B?.AF;
  if (af !== undefined) {
    if (af >= 10 && af <= 29) {
      totalPoints += 4;
    } else if (af > 29) {
      totalPoints += 3;
    } else if (af >= 6 && af <= 9) {
      totalPoints += 2;
    } else if (af >= 1 && af <= 5) {
      totalPoints += 1;
    } else if (af === 0) {
      totalPoints += 0;
    }
  }
  
  // Systoliskt blodtryck
  let systolisk = undefined;
  const bt = xabcde.C?.BT;
  if (typeof bt === 'string' && bt.includes('/')) {
    const parts = bt.split('/');
    systolisk = parseInt(parts[0], 10);
  } else if (typeof bt === 'number') {
    systolisk = bt;
  }
  
  if (systolisk !== undefined) {
    if (systolisk > 90) {
      totalPoints += 4;
    } else if (systolisk >= 76 && systolisk <= 89) {
      totalPoints += 3;
    } else if (systolisk >= 50 && systolisk <= 75) {
      totalPoints += 2;
    } else if (systolisk >= 1 && systolisk <= 49) {
      totalPoints += 1;
    } else if (systolisk === 0) {
      totalPoints += 0;
    }
  }
  
  // GCS (Glasgow Coma Scale)
  const gcs = xabcde.D?.GCS;
  if (gcs !== undefined) {
    if (gcs >= 13 && gcs <= 15) {
      totalPoints += 4;
    } else if (gcs >= 9 && gcs <= 12) {
      totalPoints += 3;
    } else if (gcs >= 6 && gcs <= 8) {
      totalPoints += 2;
    } else if (gcs >= 4 && gcs <= 5) {
      totalPoints += 1;
    } else if (gcs === 3) {
      totalPoints += 0;
    }
  }
  
  // Bestäm triagefärg baserat på totala poäng
  if (totalPoints === 12) {
    return 'Grön';
  } else if (totalPoints === 11) {
    return 'Gul';
  } else {
    return 'Röd';
  }
}

// Funktion för att initiera uppsamlingsplatser vid början av övning
export function initializeCollectionPoints() {
  // Hämta skadeplatsens koordinater
  const incidentMarker = JSON.parse(localStorage.getItem('prehospitalMapMarker') || 'null');
  const incidentLat = incidentMarker?.lat || 63.8;
  const incidentLng = incidentMarker?.lng || 20.3;
  
  // Skapa uppsamlingsplats för levande
  let collectionPoint = JSON.parse(localStorage.getItem('collectionPointMarker') || 'null');
  if (!collectionPoint || !collectionPoint.lat || !collectionPoint.lng) {
    collectionPoint = {
      lat: incidentLat,
      lng: incidentLng - 0.0005 // ~50m väster
    };
    localStorage.setItem('collectionPointMarker', JSON.stringify(collectionPoint));
    window.dispatchEvent(new Event('storage'));
    console.log(`[Automation] ✓ Initialiserade uppsamlingsplats på lat:${collectionPoint.lat.toFixed(5)}, lng:${collectionPoint.lng.toFixed(5)}`);
  }
}

// Huvudfunktion för automatisk prehospital hantering
export function runPrehospitalAutomation() {
  // Kontrollera om automatisering är påslagen
  const automatedViews = JSON.parse(localStorage.getItem('automatedViews') || '{}');
  if (!automatedViews.Prehospital) {
    console.log('[Automation] Prehospital automatisering är INTE påslagen, automatedViews:', automatedViews);
    return;
  }
  
  const selectedHospital = localStorage.getItem('selectedHospital') || 'Norrlands universitetssjukhus';
  const simTime = localStorage.getItem('simTime') || '00:00';
  const currentMinutes = timeToMinutes(simTime);
  
  // Hämta patienter på skadeplats
  let prehospitalPatients = JSON.parse(localStorage.getItem('prehospitalPatients') || '[]');
  
  console.log('[Automation] KÖRS! Patienter:', prehospitalPatients.length, 'Tid:', simTime, 'Sjukhus:', selectedHospital);
  
  if (prehospitalPatients.length === 0) {
    return;
  }
  
  // Hämta skadeplatsens koordinater
  const incidentMarker = JSON.parse(localStorage.getItem('prehospitalMapMarker') || 'null');
  const incidentLat = incidentMarker?.lat || 63.8;
  const incidentLng = incidentMarker?.lng || 20.3;
  
  // Uppsamlingsplats ska redan vara initialiserad av initializeCollectionPoints()
  let collectionPoint = JSON.parse(localStorage.getItem('collectionPointMarker') || 'null');
  const hasCollectionPoint = collectionPoint && collectionPoint.lat && collectionPoint.lng;
  
  // Hämta befintliga fordon (användaren lägger till manuellt via kontrollpanelen)
  let vehicles = JSON.parse(localStorage.getItem('prehospitalVehicles') || '[]');
  let availableVehicles = vehicles.filter(v => v.status === 'available');
  
  console.log(`[Prehospital Automation] Körs kl ${simTime}, ${prehospitalPatients.length} patienter, ${availableVehicles.length} tillgängliga fordon`);
  
  // Håll reda på upptagen personal (för att inte dubbelboka)
  const busyPersonnel = new Set();
  
  // Kontrollera vilken personal som är upptagen med pågående triageringar
  prehospitalPatients.forEach(p => {
    if (p.triageStartTime && p.triageEndTime && currentMinutes < p.triageEndTime && p.triagingPersonnelId) {
      busyPersonnel.add(p.triagingPersonnelId);
    }
  });
  
  // AUTOMATISK UPPSAMLINGSPLATS FÖR DÖDA: Skapa om någon patient har dött
  const hasDeadPatients = prehospitalPatients.some(p => p.triage && p.triage.scene === 'Svart');
  let deadCollectionPoint = JSON.parse(localStorage.getItem('deadCollectionPointMarker') || 'null');
  if (hasDeadPatients && (!deadCollectionPoint || !deadCollectionPoint.lat || !deadCollectionPoint.lng)) {
    // Placera uppsamlingsplats för döda 50m öster om skadeplatsen
    deadCollectionPoint = {
      lat: incidentLat,
      lng: incidentLng + 0.0005 // ~50m öster
    };
    localStorage.setItem('deadCollectionPointMarker', JSON.stringify(deadCollectionPoint));
    window.dispatchEvent(new Event('storage'));
    console.log(`[Automation] ✓ Skapade uppsamlingsplats för döda automatiskt på lat:${deadCollectionPoint.lat.toFixed(5)}, lng:${deadCollectionPoint.lng.toFixed(5)}`);
  }
  
  let patientsChanged = false;
  let personnelStatusChanged = false;
  
    // Sortera patienter så röda prioriteras före gula, gula före gröna
    // Denna sortering baseras på faktisk triageresultat ELLER förutsägelse baserat på XABCDE-data
    const triagePriority = { 'Röd': 0, 'Orange': 1, 'Gul': 2, 'Grön': 3, 'Svart': 4 };
    prehospitalPatients.sort((a, b) => {
      // Om triageresultatet redan finns, använd det
      let aTriageColor = a.triage?.scene;
      let bTriageColor = b.triage?.scene;
    
      // Om triageresultatet INTE finns ännu, förutsäg det baserat på XABCDE-data
      if (!aTriageColor) {
        aTriageColor = triagePatientSMART(a);
      }
      if (!bTriageColor) {
        bTriageColor = triagePatientSMART(b);
      }
    
      const aPriority = triagePriority[aTriageColor] !== undefined ? triagePriority[aTriageColor] : 5;
      const bPriority = triagePriority[bTriageColor] !== undefined ? triagePriority[bTriageColor] : 5;
      return aPriority - bPriority;
    });
  
  const updatedPatients = prehospitalPatients.map(patient => {
    // Sätt koordinater om de saknas
    if (!patient.lat || !patient.lng) {
      patient.lat = incidentLat + (Math.random() - 0.5) * 0.001;
      patient.lng = incidentLng + (Math.random() - 0.5) * 0.001;
      patientsChanged = true;
    }
    
    // Hoppa över patienter som redan transporteras eller är klara
    if (patient.transportStatus === 'transporting' || patient.transportStatus === 'completed') {
      return patient;
    }
    
    // 1. Triagera patienten om inte redan gjord (tar ca 1 minut per patient, kräver 1 personal)
    if (!patient.triage || !patient.triage.scene) {
      // Starta triage om inte redan påbörjad
      if (!patient.triageStartTime) {
        // Hitta en tillgänglig personal för triagering
        let assignedPersonnel = null;
        
        for (const vehicle of vehicles) {
          if (vehicle.status !== 'available') continue;
          
          const personnel = vehicle.personnel || [];
          for (const person of personnel) {
            if (person.status === 'available' && !busyPersonnel.has(person.id)) {
              assignedPersonnel = person;
              break;
            }
          }
          if (assignedPersonnel) break;
        }
        
        if (!assignedPersonnel) {
          // Ingen personal tillgänglig för triagering
          patient.automationStatus = 'Väntar på personal för triagering';
          patientsChanged = true;
          return patient;
        }
        
        // Allokera personal till triagering
        patient.triageStartTime = currentMinutes;
        patient.triageEndTime = currentMinutes + 1; // 1 minut per patient
        patient.triagingPersonnelId = assignedPersonnel.id;
        patient.automationStatus = 'Triagering pågår';
        busyPersonnel.add(assignedPersonnel.id);
        
        // Markera personalen som busy i fordonet
        for (const vehicle of vehicles) {
          const person = vehicle.personnel?.find(p => p.id === assignedPersonnel.id);
          if (person) {
            person.status = 'busy';
            break;
          }
        }
        
        patientsChanged = true;
        console.log(`[Automation] ✓ Påbörjar triagering av patient ${patient.personnummer || patient.id} med personal ${assignedPersonnel.id}, klar kl ${minutesToTime(patient.triageEndTime)}`);
      }
      
      // Kontrollera om triageringen är klar
      if (patient.triageStartTime && currentMinutes >= patient.triageEndTime) {
        const triageColor = triagePatientSMART(patient);
        patient.triage = { ...patient.triage, scene: triageColor };
        patient.triageCompleted = true;
        patient.automationStatus = 'Triagerad';
        patient.location = 'Skadeplats';
        
        // Frigör personalen från triagering
        if (patient.triagingPersonnelId) {
          busyPersonnel.delete(patient.triagingPersonnelId);
          for (const vehicle of vehicles) {
            const person = vehicle.personnel?.find(p => p.id === patient.triagingPersonnelId);
            if (person) {
              person.status = 'available';
              personnelStatusChanged = true;
              break;
            }
          }
        }
        patient.triagingPersonnelId = null;
        
        patientsChanged = true;
        console.log(`[Automation] ✓ Triagerade patient ${patient.personnummer || patient.id} som ${triageColor}`);
      }
    }
    
    // 1.5 Gröna patienter - kan gå själva till uppsamlingsplats utan personal
    if (patient.triageCompleted && patient.triage?.scene === 'Grön' && hasCollectionPoint && patient.location !== 'Uppsamlingsplats') {
      // Gröna patienter kan röra sig själva - ingen personal behövs
      if (!patient.movingToCollectionPoint) {
        patient.movingToCollectionPoint = true;
        patient.moveToCollectionStartTime = currentMinutes;
        const moveDistance = Math.sqrt(Math.pow(patient.lat - collectionPoint.lat, 2) + Math.pow(patient.lng - collectionPoint.lng, 2));
        const moveDuration = Math.max(2, Math.ceil(moveDistance * 10000)); // ~2-5 min samma som andra
        patient.moveToCollectionEndTime = currentMinutes + moveDuration;
        patient.selfWalking = true; // Markera att de går själva
        
        patient.automationStatus = 'Går själv till uppsamlingsplats';
        patientsChanged = true;
        console.log(`[Automation] ✓ Grön patient ${patient.personnummer || patient.id} börjar gå själv till uppsamlingsplats, ankomst kl ${minutesToTime(patient.moveToCollectionEndTime)}`);
      }
      
      // Kontrollera om rörelsen är klar
      if (patient.movingToCollectionPoint && currentMinutes >= patient.moveToCollectionEndTime) {
        patient.location = 'Uppsamlingsplats';
        patient.lat = collectionPoint.lat;
        patient.lng = collectionPoint.lng;
        patient.movingToCollectionPoint = false;
        patient.selfWalking = false;
        
        patient.automationStatus = 'På uppsamlingsplats - väntar på sorteringstriage';
        patientsChanged = true;
        console.log(`[Automation] ✓ Grön patient ${patient.personnummer || patient.id} har nått uppsamlingsplats`);
      }
      return patient; // Gröna patienter hanteras separat
    }
    
    // 2. OMEDELBAR rörelse till uppsamlingsplats när triagering är klar - PRIORITET FÖRE BEHANDLING
    // Flytta alla patienter till uppsamlingsplats INNAN behandling på skadeplatsen
    // (För patienter som INTE är gröna och kan gå själva)
    if (patient.triageCompleted && patient.triage?.scene !== 'Grön' && hasCollectionPoint && patient.location !== 'Uppsamlingsplats') {
      // Kontrollera att alla patienter är triagerade innan flyttning börjar
      const allPatientsTriaged = prehospitalPatients.every(p => p.triage && p.triage.scene);
      if (!allPatientsTriaged) {
        patient.automationStatus = 'Väntar tills alla patienter är triagerade';
        return patient;
      }
      
      // PRIORITERING: Röda patienter måste ALLA ha börjat flytta innan gula/gröna får flytta
      if (patient.triage?.scene !== 'Röd') {
        const redPatients = prehospitalPatients.filter(p => p.triage?.scene === 'Röd');
        const allRedsMovingOrDone = redPatients.every(p => p.movingToCollectionPoint || p.location === 'Uppsamlingsplats' || p.transportStatus);
        
        if (!allRedsMovingOrDone) {
          const stillWaiting = redPatients.filter(p => !p.movingToCollectionPoint && p.location !== 'Uppsamlingsplats' && !p.transportStatus);
          patient.automationStatus = `Väntar - ${stillWaiting.length} röda patienter väntar på bärning`;
          return patient;
        }
      }
      
      // Beräkna tid för transport till uppsamlingsplats (ca 2-5 min beroende på avstånd)
      if (!patient.movingToCollectionPoint) {
        // Hitta 2 tillgängliga personal för bärning
        const assignedCarriers = [];
        
        for (const vehicle of vehicles) {
          if (vehicle.status !== 'available') continue;
          
          const personnel = vehicle.personnel || [];
          for (const person of personnel) {
            if (person.status === 'available' && !busyPersonnel.has(person.id)) {
              assignedCarriers.push(person);
              busyPersonnel.add(person.id);
              if (assignedCarriers.length >= 2) break;
            }
          }
          if (assignedCarriers.length >= 2) break;
        }
        
        if (assignedCarriers.length < 2) {
          // Inte tillräckligt med personal för bärning
          patient.automationStatus = `Väntar på personal för bärning (${assignedCarriers.length}/2)`;
          patientsChanged = true;
          // Frigör eventuellt allokerad personal
          assignedCarriers.forEach(p => busyPersonnel.delete(p.id));
        } else {
          patient.movingToCollectionPoint = true;
          patient.moveToCollectionStartTime = currentMinutes;
          const moveDistance = Math.sqrt(Math.pow(patient.lat - collectionPoint.lat, 2) + Math.pow(patient.lng - collectionPoint.lng, 2));
          const moveDuration = Math.max(2, Math.ceil(moveDistance * 10000)); // ~2-5 min
          patient.moveToCollectionEndTime = currentMinutes + moveDuration;
          patient.carryingPersonnelIds = assignedCarriers.map(p => p.id);
          
          // Markera bärarna som busy i fordonet
          assignedCarriers.forEach(carrier => {
            for (const vehicle of vehicles) {
              const person = vehicle.personnel?.find(p => p.id === carrier.id);
              if (person) {
                person.status = 'busy';
                personnelStatusChanged = true;
                break;
              }
            }
          });
          
          patient.automationStatus = 'Flyttas till uppsamlingsplats';
          patientsChanged = true;
          console.log(`[Automation] ✓ Flyttar patient ${patient.personnummer || patient.id} till uppsamlingsplats med 2 bärare, ankomst kl ${minutesToTime(patient.moveToCollectionEndTime)}`);
        }
      }
      
      // Om rörelsen redan påbörjats, håll personalen upptagen under bärningen
      if (patient.movingToCollectionPoint && patient.carryingPersonnelIds) {
        patient.carryingPersonnelIds.forEach(id => {
          busyPersonnel.add(id);
          // Försäkra att status är busy i fordonet
          for (const vehicle of vehicles) {
            const person = vehicle.personnel?.find(p => p.id === id);
            if (person && person.status !== 'busy') {
              person.status = 'busy';
              personnelStatusChanged = true;
            }
          }
        });
      }
      
      // Kontrollera om flytten är klar
      if (patient.movingToCollectionPoint && currentMinutes >= patient.moveToCollectionEndTime) {
        patient.location = 'Uppsamlingsplats';
        patient.lat = collectionPoint.lat;
        patient.lng = collectionPoint.lng;
        patient.movingToCollectionPoint = false;
        
        // Frigör bärarna när flytten är klar
        if (patient.carryingPersonnelIds) {
          patient.carryingPersonnelIds.forEach(id => {
            busyPersonnel.delete(id);
            for (const vehicle of vehicles) {
              const person = vehicle.personnel?.find(p => p.id === id);
              if (person) {
                person.status = 'available';
                personnelStatusChanged = true;
              }
            }
          });
        }
        patient.carryingPersonnelIds = null;
        
        patient.automationStatus = 'På uppsamlingsplats - väntar på sorteringstriage';
        patientsChanged = true;
        console.log(`[Automation] ✓ Patient ${patient.personnummer || patient.id} är nu på uppsamlingsplatsen`);
      }
    }
    
    // 3. Sorteringstriage på uppsamlingsplats - 3 minuter, kräver 1 personal
    if (patient.location === 'Uppsamlingsplats' && !patient.sortingTriageCompleted && !patient.transportStatus) {
      // Starta sorteringstriage om inte redan påbörjad
      if (!patient.sortingTriageStartTime) {
        // Hitta en tillgänglig personal för sorteringstriage
        let assignedPersonnel = null;
        
        for (const vehicle of vehicles) {
          if (vehicle.status !== 'available') continue;
          
          const personnel = vehicle.personnel || [];
          for (const person of personnel) {
            if (person.status === 'available' && !busyPersonnel.has(person.id)) {
              assignedPersonnel = person;
              break;
            }
          }
          if (assignedPersonnel) break;
        }
        
        if (!assignedPersonnel) {
          // Ingen personal tillgänglig för sorteringstriage
          patient.automationStatus = 'Väntar på personal för sorteringstriage';
          patientsChanged = true;
        } else {
          // Starta sorteringstriage
          patient.sortingTriageStartTime = currentMinutes;
          patient.sortingTriageEndTime = currentMinutes + 3; // 3 minuter
          patient.sortingTriagingPersonnelId = assignedPersonnel.id;
          busyPersonnel.add(assignedPersonnel.id);
          
          // Markera personalen som busy
          for (const vehicle of vehicles) {
            const person = vehicle.personnel?.find(p => p.id === assignedPersonnel.id);
            if (person) {
              person.status = 'busy';
              personnelStatusChanged = true;
              break;
            }
          }
          
          patient.automationStatus = 'Sorteringstriage pågår';
          patientsChanged = true;
          console.log(`[Automation] ✓ Påbörjar sorteringstriage för patient ${patient.personnummer || patient.id}, klar kl ${minutesToTime(patient.sortingTriageEndTime)}`);
        }
      }
      
      // Kontrollera om sorteringstriage är klar
      if (patient.sortingTriageStartTime && currentMinutes >= patient.sortingTriageEndTime) {
        if (!patient.sortingTriageCompleted) {
          // Uppdatera triage baserat på poängsystem (AF, BT, GCS)
          const triageColor = sorteringstriagePatient(patient);
          patient.triage = {
            ...patient.triage,
            sorting: triageColor // Sorteringstriage-resultat enligt poängsystem
          };
          patient.sortingTriageCompleted = true;
          
          // Frigör personalen från sorteringstriage
          if (patient.sortingTriagingPersonnelId) {
            busyPersonnel.delete(patient.sortingTriagingPersonnelId);
            for (const vehicle of vehicles) {
              const person = vehicle.personnel?.find(p => p.id === patient.sortingTriagingPersonnelId);
              if (person) {
                person.status = 'available';
                personnelStatusChanged = true;
                break;
              }
            }
          }
          patient.sortingTriagingPersonnelId = null;
          
          patient.automationStatus = 'Sorteringstriage klar';
          patientsChanged = true;
          console.log(`[Automation] ✓ Sorteringstriage klar för patient ${patient.personnummer || patient.id} - resultat: ${triageColor}`);
        }
      }
    }
    
    // 4. Påbörja behandling på uppsamlingsplats - KAN SKE PARALLELLT MED SORTERINGSTRIAGE
    // Resterande personal gör åtgärder på patienterna som är kvar på uppsamlingsplats
    // RÖDA PATIENTER PRIORITERAS - om inte personal finns hoppar vi bara över utan att blockera
    if (patient.location === 'Uppsamlingsplats' && patient.triageCompleted && !patient.treatment && !patient.transportStatus) {
      // Bestäm behandling om inte redan gjord
      if (!patient.requiredTreatment) {
        const treatment = determineRequiredTreatment(patient);
        patient.requiredTreatment = treatment;
        patient.automationStatus = 'Klar för behandling på uppsamlingsplats';
        patientsChanged = true;
        console.log(`[Automation] ✓ Patient ${patient.personnummer || patient.id} behöver behandling på uppsamlingsplats: ${treatment}`);
      }
      
      // Försök påbörja behandling om personal finns
      if (patient.requiredTreatment && !patient.treatment) {
        // Kontrollera att det finns tillgänglig personal
        const personnelAvailable = getAvailablePersonnel(vehicles);
        const totalAvailable = Object.values(personnelAvailable).reduce((a, b) => a + b, 0);
        
        const isRedPatient = patient.triage?.scene === 'Röd';
        
        // För RÖDA patienter: skapa inte blockering, hoppa bara över om ingen personal finns
        // För andra patienter: samma logik men de är redan senare i kön
        if (totalAvailable > 0) {
          // Personal finns - starta behandling
          patient.treatment = patient.requiredTreatment;
          patient.treatmentStartTime = currentMinutes;
          const duration = prehospitalActionDurations[patient.requiredTreatment] || 5;
          patient.treatmentEndTime = currentMinutes + duration;
          patient.automationStatus = `Behandlas på uppsamlingsplats (${patient.treatment})`;
          patient.waitingForPersonnel = false;
          patientsChanged = true;
          console.log(`[Automation] ✓ Påbörjar behandling "${patient.treatment}" för patient ${patient.personnummer || patient.id}, klar kl ${minutesToTime(patient.treatmentEndTime)}`);
        } else {
          // Ingen personal tillgänglig - hoppa bara över, blocking inte läget
          if (isRedPatient) {
            patient.automationStatus = 'Ingen personal för behandling - hoppar över';
          } else {
            patient.automationStatus = 'Väntar på personal för behandling';
          }
          patientsChanged = true;
          // OBS: Returnerar INTE - låter patienten komma vidare till transport även utan behandling
        }
      }
    }
    
    // 4. Kontrollera om behandling är klar
    if (patient.treatment && patient.treatmentEndTime && currentMinutes >= patient.treatmentEndTime) {
      if (!patient.treatmentCompleted) {
        patient.treatmentCompleted = true;
        patient.automationStatus = 'Behandling klar - väntar på transport';
        patientsChanged = true;
        console.log(`[Automation] ✓ Behandling klar för patient ${patient.personnummer || patient.id}`);
      }
    }
    
    // 5. Transportöverföringar från uppsamlingsplats till sjukhus
    // Ambulanser kan börja transportera även om sorteringstriage inte är klar
    
    // 6. Om patient är på uppsamlingsplats och fordon finns tillgängligt, starta transport - KRÄVER FORDON
    if (patient.location === 'Uppsamlingsplats' && !patient.transportStatus && availableVehicles.length > 0) {
      // Kontrollera att ALLA patienter är på uppsamlingsplats innan någon transport tillåts
      const allPatientsAtCollectionPoint = prehospitalPatients.every(p => {
        // Patient måste vara på uppsamlingsplats, redan transporteras, eller vara grön (går själv)
        return p.location === 'Uppsamlingsplats' || 
               p.transportStatus === 'transporting' || 
               p.triage?.scene === 'Grön' ||
               p.triage?.scene === 'Svart'; // Svarta patienter är döda
      });
      
      if (!allPatientsAtCollectionPoint) {
        const notAtCollection = prehospitalPatients.filter(p => 
          p.location !== 'Uppsamlingsplats' && 
          p.transportStatus !== 'transporting' && 
          p.triage?.scene !== 'Grön' &&
          p.triage?.scene !== 'Svart'
        );
        patient.automationStatus = `Väntar - ${notAtCollection.length} patienter är inte på uppsamlingsplats än`;
        return patient; // Fortsätt till nästa patient utan transport
      }
      
      // Kontrollera att alla patienter har SÅLLNINGSTRIAGE (scene) innan transport tillåts
      const allPatientsSceneTriaged = prehospitalPatients.every(p => {
        // Kontrollera både triage.scene och triageCompleted (sållningstriage)
        const hasValidTriage = p.triage && p.triage.scene && p.triage.scene !== '';
        const isTriageComplete = p.triageCompleted === true;
        return hasValidTriage && isTriageComplete;
      });
      
      if (!allPatientsSceneTriaged) {
        // Logga vilka patienter som inte har sållningstriage
        const notTriaged = prehospitalPatients.filter(p => !p.triage || !p.triage.scene || !p.triageCompleted);
        console.log(`[Automation] Väntar på sållningstriage av ${notTriaged.length} patienter:`, notTriaged.map(p => p.personnummer || p.name || p.id));
        patient.automationStatus = `Väntar tills alla patienter har sållningstriage (${notTriaged.length} kvar)`;
        return patient; // Fortsätt till nästa patient utan transport
      }
      
      // Kontrollera ambulansreglerna:
      // - Minst 1 ambulans måste finnas kvar på skadeplatsen
      // - Max 70% av totala ambulanser kan användas för transport (men minst 1 kvar)
      // - Om bara 1 patient kvar, får den sista ambulansen åka
      const totalAmbulances = vehicles.filter(v => v.type === 'ambulance').length;
      const currentAmbulancesAtScene = vehicles.filter(v => v.type === 'ambulance' && v.status === 'available').length;
      const patientsWaitingForTransport = prehospitalPatients.filter(p => 
        p.location === 'Uppsamlingsplats' && !p.transportStatus && p.triage && p.triage.scene
      ).length;
      
      // Beräkna hur många ambulanser som kan användas för transport (70% men minst 1 kvar)
      const maxAmbulancesForTransport = Math.max(1, Math.floor(totalAmbulances * 0.7));
      const ambulancesAlreadyTransporting = vehicles.filter(v => v.type === 'ambulance' && v.status === 'away').length;
      const ambulancesAvailableForTransport = maxAmbulancesForTransport - ambulancesAlreadyTransporting;
      
      // Speciell regel: Om bara 1 patient kvar, får den sista ambulansen åka
      const remainingPatients = prehospitalPatients.filter(p => p.transportStatus !== 'transporting').length;
      const isLastPatient = remainingPatients === 1;
      
      if (!isLastPatient && ambulancesAvailableForTransport <= 0) {
        patient.automationStatus = 'Väntar - max ambulanser redan på transport (70% regel)';
        return patient; // Fortsätt till nästa patient utan transport
      }
      
      if (!isLastPatient && currentAmbulancesAtScene <= 1) {
        patient.automationStatus = 'Väntar - minst en ambulans måste finnas kvar';
        return patient; // Fortsätt till nästa patient utan transport
      }
      
      // Välj lämpligt fordon (prioritera ambulans)
      const vehicleIndexAvailable = availableVehicles.findIndex(v => v.type === 'ambulance');
      const vehicle = vehicleIndexAvailable !== -1 ? availableVehicles[vehicleIndexAvailable] : availableVehicles[0];
      
      if (vehicle) {
        // Kontrollera att fordonet har personal
        const vehiclePersonnel = vehicle.personnel || [];
        const availablePersonnelInVehicle = vehiclePersonnel.filter(p => p.status === 'available').length;
        
        if (availablePersonnelInVehicle === 0) {
          // Ingen personal i fordonet
          patient.automationStatus = 'Väntar på fordon med personal';
          // Fortsätt inte med transport, men fortsätt loopen
        } else {
          // Markera fordonet och dess personal som upptagen
          const vehicleIndex = vehicles.findIndex(v => v.id === vehicle.id);
          if (vehicleIndex !== -1) {
            vehicles[vehicleIndex].status = 'away';
            // Markera personal som busy
            if (vehicles[vehicleIndex].personnel) {
              vehicles[vehicleIndex].personnel.forEach(p => {
                if (p.status === 'available') {
                  p.status = 'busy';
                }
              });
            }
          }
          // Ta bort fordonet från listan över tillgängliga i denna körning så att det inte dubbelbokas
          const availableIdx = availableVehicles.findIndex(v => v.id === vehicle.id);
          if (availableIdx !== -1) {
            availableVehicles.splice(availableIdx, 1);
          }
          
          // Beräkna transporttid (baserat på avstånd till sjukhus)
          const hospitals = {
          'Norrlands universitetssjukhus': { lat: 63.8258, lng: 20.2630 },
          'Skellefteå sjukhus': { lat: 64.7508, lng: 20.9528 },
          'Lycksele lasarett': { lat: 64.5975, lng: 18.6743 }
        };
        
        // Använd patientens koordinater
        const startLat = patient.lat;
        const startLng = patient.lng;
        const destCoords = hospitals[selectedHospital];
        
        // Enkel avståndsberäkning
        const latDiff = Math.abs(destCoords.lat - startLat);
        const lngDiff = Math.abs(destCoords.lng - startLng);
        const approxDistanceKm = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111; // ~111 km per grad
        
        const isHelicopter = vehicle.type === 'helicopterAmbulance';
        const speed = isHelicopter ? 200 : 80; // km/h
        const roadFactor = isHelicopter ? 1 : 1.5; // Vägar är inte raka
        const actualDistance = approxDistanceKm * roadFactor;
        const minTime = isHelicopter ? 15 : 5;
        const transportTime = Math.max(minTime, Math.ceil(actualDistance / speed * 60)); // minuter
        
        patient.transportStatus = 'transporting';
        patient.destinationHospital = selectedHospital;
        patient.vehicleId = vehicle.id;
        patient.vehicleType = vehicle.type;
        patient.departureTime = simTime;
        patient.transportTime = transportTime;
        patient.expectedArrivalTime = minutesToTime(currentMinutes + transportTime);
        patient.startCoordinates = { lat: startLat, lng: startLng };
        patient.actualDistance = actualDistance;
        patient.transportSpeed = speed;
        patient.automationStatus = `Transporteras till ${selectedHospital}`;
        
        // Lägg till i Paratus automatiskt
        const paratusPatients = JSON.parse(localStorage.getItem('paratusPatients') || '[]');
        paratusPatients.push(patient);
        localStorage.setItem('paratusPatients', JSON.stringify(paratusPatients));
        window.dispatchEvent(new Event('paratusUpdated'));
        console.log(`[Automation] ✓ Patient ${patient.personnummer || patient.id} tillagd i Paratus`);
        
        // Uppdatera fordonets återkomsttid (baserad på simTime, inte Date.now())
        const returnTime = (transportTime * 2) + 15; // Tid till sjukhus, tid på sjukhus, tid tillbaka
        const expectedReturnMinutes = currentMinutes + returnTime;
        vehicles[vehicleIndex].expectedReturnSimTime = minutesToTime(expectedReturnMinutes);
        vehicles[vehicleIndex].returnTimeMinutes = returnTime;
        
        console.log(`[Automation] Fordon ${vehicle.type} #${vehicle.unitNumber}: transportTime=${transportTime}min, returnTime=${returnTime}min, currentMinutes=${currentMinutes}, expectedReturnMinutes=${expectedReturnMinutes}, expectedReturnSimTime=${vehicles[vehicleIndex].expectedReturnSimTime}`);
        
        localStorage.setItem('prehospitalVehicles', JSON.stringify(vehicles));
        window.dispatchEvent(new CustomEvent('prehospitalVehiclesUpdated', { detail: vehicles }));
        
        patientsChanged = true;
        console.log(`[Automation] ✓ Patient ${patient.personnummer || patient.id} påbörjar transport med ${vehicleTypes[vehicle.type]?.label || vehicle.type}, ankomst ${patient.expectedArrivalTime}`);
        }
      }
    }
    
    return patient;
  });
  
  // Ta bort patienter som transporteras från prehospital-listan
  const remainingPatients = updatedPatients.filter(p => p.transportStatus !== 'transporting');
  
  if (patientsChanged || remainingPatients.length !== prehospitalPatients.length) {
    localStorage.setItem('prehospitalPatients', JSON.stringify(remainingPatients));
    window.dispatchEvent(new Event('prehospitalPatientsUpdated'));
    window.dispatchEvent(new Event('storage'));
    console.log(`[Automation] ✓ Uppdaterade prehospital-listan: ${remainingPatients.length} patienter kvar`);
  }
  
  // Allokera ledig personal till uppgifter - all personal måste vara sysselsatt
  for (const vehicle of vehicles) {
    if (!vehicle.personnel) continue;
    
    for (const person of vehicle.personnel) {
      // Om personalen är ledig och det finns patienter som behöver behandling eller triagering
      if (person.status === 'available' && remainingPatients.length > 0) {
        // Försök allokera till en patient som behöver behandling
        const patientNeedingTreatment = remainingPatients.find(p => 
          p.triageCompleted && 
          p.requiredTreatment && 
          !p.treatment &&
          p.location !== 'Uppsamlingsplats' // Prioritera patienter på skadeplats före uppsamlingsplats
        );
        
        if (patientNeedingTreatment) {
          // Markera personalen som busy (redan tilldelad någon annan patient)
          if (!busyPersonnel.has(person.id)) {
            person.status = 'busy';
            busyPersonnel.add(person.id);
            personnelStatusChanged = true;
            console.log(`[Automation] ⚙️ Personal ${person.id} markerad som busy (uppgift tillgänglig)`);
          }
        }
      }
    }
  }
  
  // Kontrollera om fordon ska återvända baserat på simTime
  let vehiclesChanged = false;
  vehicles.forEach(vehicle => {
    if (vehicle.status === 'away' && vehicle.expectedReturnSimTime) {
      const returnMinutes = timeToMinutes(vehicle.expectedReturnSimTime);
      if (currentMinutes >= returnMinutes) {
        vehicle.status = 'available';
        vehicle.expectedReturnSimTime = null;
        vehicle.returnTimeMinutes = null;
        
        // Frigör all personal i fordonet så de kan användas för nästa transport
        if (vehicle.personnel) {
          vehicle.personnel.forEach(p => {
            p.status = 'available';
            busyPersonnel.delete(p.id);
          });
        }
        
        vehiclesChanged = true;
        personnelStatusChanged = true;
        console.log(`[Automation] ✓ Fordon ${vehicle.type} #${vehicle.unitNumber} har återvänt till skadeplatsen`);
      }
    }
  });
  
  if (vehiclesChanged || personnelStatusChanged) {
    localStorage.setItem('prehospitalVehicles', JSON.stringify(vehicles));
    window.dispatchEvent(new CustomEvent('prehospitalVehiclesUpdated', { detail: vehicles }));
  }
  
  // Kontrollera Paratus-patienter och flytta färdiga till Akutmottagning
  checkParatusCompletions(simTime, selectedHospital);
}

// Kontrollera om Paratus-transport är klart och flytta patienter till Akutmottagning
function checkParatusCompletions(simTime, selectedHospital) {
  const currentMinutes = timeToMinutes(simTime);
  
  let paratusPatients = JSON.parse(localStorage.getItem('paratusPatients') || '[]');
  let changed = false;
  
  const completedPatients = [];
  const remainingParatusPatients = paratusPatients.filter(p => {
    // Kontrollera om patienten har anländt
    if (p.expectedArrivalTime) {
      const arrivalMinutes = timeToMinutes(p.expectedArrivalTime);
      if (currentMinutes >= arrivalMinutes) {
        // Patienten har anländt! Lägg till i Akutmottagning
        completedPatients.push(p);
        return false; // Ta bort från Paratus
      }
    }
    return true; // Behåll i Paratus
  });
  
  if (completedPatients.length > 0) {
    // Lägg till i Akutmottagning
    const akutPatients = JSON.parse(localStorage.getItem('akutPatients') || '{}');
    if (!akutPatients[selectedHospital]) {
      akutPatients[selectedHospital] = [];
    }
    
    completedPatients.forEach(patient => {
      akutPatients[selectedHospital].push(patient);
      console.log(`[Automation] ✓ Patient ${patient.personnummer || patient.id} anländ till ${selectedHospital} och tillagd i Akutmottagning`);
    });
    
    localStorage.setItem('akutPatients', JSON.stringify(akutPatients));
    window.dispatchEvent(new CustomEvent('akutSync', { detail: { akutPatients } }));
  }
  
  if (remainingParatusPatients.length !== paratusPatients.length) {
    localStorage.setItem('paratusPatients', JSON.stringify(remainingParatusPatients));
    window.dispatchEvent(new Event('paratusUpdated'));
    changed = true;
  }
}

// Starta automatiseringsloop
export function startPrehospitalAutomationLoop() {
  // Kör direkt första gången
  runPrehospitalAutomation();
  
  // Kör sedan var 5:e sekund
  const interval = setInterval(() => {
    runPrehospitalAutomation();
  }, 5000);
  
  return interval;
}
