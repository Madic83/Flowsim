// flowsim patientCareSystem.js - ensure clean encoding, no BOM
const TIMINGS = {
  triageAssessment: 5,  // 3-8 minuter för triage (medelvärde)
  
  // Läkarens bedömning och ordination
  doctorAssessment: 5,
  orderBloodTest: 2,
  orderXray: 2,
  orderCT: 3,
  orderMedication: 2,
  
  // Sjuksköterskans åtgärder
  takeBloodSample: 5,
  giveIVMedication: 3,
  giveOralMedication: 2,
  transportToXray: 20,
  transportToCT: 15,
  
  // Resultat
  bloodTestResult: 30,
  xrayResult: 20,
  ctResult: 30
};

// Generera SBAR för patient baserat på skada och symptom
function generateSBAR(patient, patientType, triageColor) {
  const desc = patient.injuryDescription || '';
  const mech = patient.mechanism || '';
  
  // S - Situation (Sökorsak - varför är patienten där?)
  let situation = '';
  if (desc) {
    situation = desc;
  } else if (mech) {
    situation = mech;
  } else {
    situation = 'Akuta besvär';
  }
  
  // B - Bakgrund (Tidigare sjukdomar)
  let background = patient.medicalHistory || 'Inga kända tidigare sjukdomar dokumenterade.';
  
  // A - Aktuellt (Symptom + XABCDE med vitalparametrar)
  let assessment = '';
  
  // Beskrivning av symptom baserat på patienttyp
  switch (patientType) {
    case 'trauma':
      assessment += 'Multitraumaskada med synliga skador. ';
      break;
    case 'fracture':
      assessment += 'Smärta och svullnad i extremitet, svårt att belasta. ';
      break;
    case 'burn':
      assessment += 'Brännskada med rodnad och blåsbildning. ';
      break;
    case 'penetrating':
      assessment += 'Penetrerande trauma, synlig sårskada. ';
      break;
    case 'cardiac':
      assessment += 'Tryckande bröstsmärta, svettning. ';
      break;
    case 'neuro':
      assessment += 'Neurologiska symtom, förändrad medvetandegrad eller pareser. ';
      break;
    case 'abdominal':
      assessment += 'Buksmärta, palpationsömhet. ';
      break;
    case 'infection':
      assessment += 'Feber, frossa, allmänpåverkan. ';
      break;
    default:
      assessment += 'Allmänna besvär. ';
  }
  
  // Lägg till XABCDE-bedömning med vitalparametrar
  assessment += '\n\nXABCDE:\n';
  assessment += 'X - ';
  assessment += (patientType === 'trauma' || patientType === 'penetrating') ? 'Kontrollerad blödning\n' : 'Ingen blödning\n';
  assessment += 'A - Fri luftväg\n';
  assessment += 'B - Andningsfrekvens 16/min, SaO2 98% på rumsluft\n';
  assessment += 'C - Puls 85/min, BT 130/80 mmHg, kapillär återfyllnad <2 sek\n';
  assessment += 'D - RLS 1, pupils runda och ljusreaktiva\n';
  assessment += 'E - Normotermisk, inga övriga synliga skador';
  
  // R - Rekommendation (Vad bör hända med patienten?)
  let recommendation = '';
  
  return `SBAR:\n\nS (Situation): ${situation}\n\nB (Bakgrund): ${background}\n\nA (Aktuellt): ${assessment}\n\nR (Rekommendation): ${recommendation}`;
} 

// Identifiera patienttyp baserat på skademekanism och beskrivning
// Wrapper-funktion för att matcha patchen i updateCareProgress
function determinePatientType(injuryDescription, mechanism, triage) {
  // Skapa ett patientobjekt för identifyPatientType
  return identifyPatientType({ injuryDescription, mechanism, triage });
}
function identifyPatientType(patient) {
  const desc = (patient.injuryDescription || '').toLowerCase();
  const mech = (patient.mechanism || '').toLowerCase();
  const combined = desc + ' ' + mech;
  
  // Brännskador (hög prioritet)
  if (mech.includes('brännskada') || mech.includes('brand') || desc.includes('brännskada') || 
      desc.includes('brännsår') || combined.includes('termisk')) {
    return 'burn';
  }
  
  // Penetrerande trauma (hög prioritet)
  if (mech.includes('skott') || mech.includes('stickskada') || desc.includes('skottskada') || 
      desc.includes('knivskada') || desc.includes('penetrerande')) {
    return 'penetrating';
  }
  
  // Frakturer (före generellt trauma)
  if (desc.includes('fraktur') || desc.includes('brott') || desc.includes('benbrott') || 
      desc.includes('luxation') || desc.includes('kotfraktur') ||
      desc.includes('skadad fot') || desc.includes('skadad hand') || desc.includes('skadad arm') ||
      desc.includes('skadad ben') || desc.includes('fotskada') || desc.includes('handled') ||
      desc.includes('vrist') || desc.includes('knä') || desc.includes('armbåge') ||
      desc.includes('axel') || desc.includes('höft') || desc.includes('extremitet') ||
      mech.includes('fall') && !mech.includes('fall från höjd') || // Vanligt fall, inte högt fall
      combined.includes('stukning') || combined.includes('stukad') || combined.includes('vrickning')) {
    return 'fracture';
  }
  
  // Hjärt-lung (hög prioritet)
  if (desc.includes('bröstsmärta') || desc.includes('hjärtinfarkt') || desc.includes('hjärtstopp') || 
      desc.includes('andnöd') || desc.includes('takykardi') || desc.includes('arytmi') ||
      mech.includes('hjärtstopp') || combined.includes('stemi') || combined.includes('nstemi')) {
    return 'cardiac';
  }
  
  // Neurologiskt
  if (desc.includes('stroke') || desc.includes('tia') || desc.includes('kramper') || 
      desc.includes('medvetslös') || desc.includes('huvudtrauma') || desc.includes('skallskada') ||
      desc.includes('hjärnskakning') || desc.includes('cva') || combined.includes('neuro')) {
    return 'neuro';
  }
  
  // Buksmärta
  if (desc.includes('buksmärta') || desc.includes('illamående') || desc.includes('kräkning') ||
      desc.includes('diarré') || desc.includes('appendicit') || desc.includes('pankreatit') ||
      combined.includes('abdominal')) {
    return 'abdominal';
  }
  
  // Infektion
  if (desc.includes('feber') || desc.includes('infektion') || desc.includes('sepsis') ||
      desc.includes('pneumoni') || desc.includes('urinvägsinfektion') || desc.includes('uti')) {
    return 'infection';
  }
  
  // Trauma (efter mer specifika kategorier)
  if (mech.includes('trafikolycka') || mech.includes('explosion') || mech.includes('fall från höjd') || 
      mech.includes('multitrauma') || mech.includes('masskade') || mech.includes('skadeplats') ||
      combined.includes('polytrauma')) {
    return 'trauma';
  }
  
  return 'general';
}

// Hjälpfunktion för att kontrollera om en åtgärd är tillåten enligt inriktningsbeslut
function isActionAllowedByDirective(actionType, actionDetails = {}) {
  const directive = localStorage.getItem('medicalDirective') || 'Inget inriktningsbeslut';
  
  if (directive === 'Inget inriktningsbeslut') return true;
  
  switch (directive) {
    case 'Inget blod på akutmottagningen':
      // Blockera blodgruppering och blodtransfusioner
      if (actionType === 'bloodTest' && actionDetails.tests) {
        // Ta bort blodgruppering från tester
        actionDetails.tests = actionDetails.tests.filter(t => 
          !t.toLowerCase().includes('blodgruppering') && 
          !t.toLowerCase().includes('transfusion')
        );
        // Om inga tester kvar, blockera hela åtgärden
        if (actionDetails.tests.length === 0) return false;
      }
      return true;
      
    case 'Ingen CT-diagnostik':
      // Blockera CT-undersökningar
      if (actionType === 'imaging' && actionDetails.exam) {
        return !actionDetails.exam.toLowerCase().includes('ct');
      }
      return true;
      
    case 'Endast akuta operationer':
      // Detta påverkar främst OP-schemat, inte akutmottagningen direkt
      return true;
      
    case 'Katastrofläge - endast livräddande åtgärder':
      // Tillåt endast absolut nödvändiga åtgärder
      const criticalActions = [
        'assessment', 'other', 'quickTest', 'medication'
      ];
      if (!criticalActions.includes(actionType)) {
        // Tillåt endast akut CT och akuta röntgen
        if (actionType === 'imaging' && actionDetails.exam) {
          return actionDetails.exam.toLowerCase().includes('trauma-ct') || 
                 actionDetails.exam.toLowerCase().includes('lungröntgen');
        }
        return false;
      }
      // För blodprover, tillåt endast minimal diagnostik
      if (actionType === 'bloodTest' && actionDetails.tests) {
        const criticalTests = ['Hb', 'BAS', 'Laktat', 'Blodgruppering'];
        actionDetails.tests = actionDetails.tests.filter(t => 
          criticalTests.some(critical => t.includes(critical))
        );
        if (actionDetails.tests.length === 0) return false;
      }
      if (actionType === 'quickTest' && actionDetails.tests) {
        const criticalTests = ['Glukos', 'Hb'];
        actionDetails.tests = actionDetails.tests.filter(t => 
          criticalTests.some(critical => t.includes(critical))
        );
        if (actionDetails.tests.length === 0) return false;
      }
      return true;
      
    default:
      return true;
  }
}

// Generera läkarordinationer baserat på patienttyp
function generateDoctorOrders(patientType, triage) {
  const orders = [];
  
  switch (patientType) {
    case 'trauma':
      // ESS 38 - Trauma: Traumalarm aktiveras
      orders.push(
        { type: 'other', action: 'Sätt PVK x2', description: 'Sätt PVK x2', time: 3 },
        { type: 'other', action: 'EKG-övervakning', description: 'Koppla EKG-övervakning', time: 2 },
        { type: 'assessment', action: 'Primär traumabedömning (ABCDE)', description: 'Primär traumabedömning (ABCDE)', time: 5 },
        { type: 'bloodTest', tests: ['Hb', 'LPK', 'CRP', 'Trombocyter', 'Elstatus', 'Koagulation', 'Laktat', 'Blodgruppering'], description: 'Ordinera stora trauma/chock-prover + blodgruppering', time: 2 },
        { type: 'bloodTest', tests: ['BAS'], description: 'Ordinera blodgas', time: 1 },
        { type: 'imaging', exam: 'Trauma-CT (huvud, hals, buk, bäcken)', description: 'Ordinera Trauma-CT', time: 3 },
        { type: 'medication', drug: 'Plasmalyte eller Ringer-Acetat iv', description: 'Ordinera vätskeersättning', time: 2 },
        { type: 'medication', drug: 'Morfin 5-10 mg iv', description: 'Ordinera Morfin 5-10 mg iv', time: 2 },
        { type: 'medication', drug: 'Tranexamsyra 1g iv', description: 'Ordinera Tranexamsyra 1g iv', time: 2 }
      );
      break;
      
    case 'fracture':
      // ESS 33/34 - Extremitetsskada
      // INGA BLODPROVER på stukad/vriden fotled, endast röntgen och smärtlindring
      orders.push(
        { type: 'assessment', action: 'Undersökning av extremitet', description: 'Undersökning av extremitet', time: 5 },
        { type: 'other', action: 'Skriv röntgenremiss', description: 'Skriv röntgenremiss', time: 1 },
        { type: 'imaging', exam: 'Röntgen av skadad extremitet', description: 'Ordinera röntgen', time: 2 },
        { type: 'medication', drug: 'Paracetamol 1g po', description: 'Ordinera Paracetamol 1g po', time: 2 },
        { type: 'medication', drug: 'Ibuprofen 400-600 mg po vid behov', description: 'Ordinera Ibuprofen 400-600 mg po', time: 2 }
      );
      break;
      
    case 'burn':
      // ESS 35 - Brännskada
      orders.push(
        { type: 'other', action: 'Sätt PVK', description: 'Sätt PVK', time: 2 },
        { type: 'other', action: 'EKG-uppkoppling', description: 'Koppla EKG-uppkoppling', time: 2 },
        { type: 'other', action: 'Syrgas 15L reservoarmask', description: 'Ge syrgas 15L reservoarmask', time: 2 },
        { type: 'assessment', action: 'Bedömning av brännskadedjup och area', description: 'Bedömning av brännskadedjup och area', time: 5 },
        { type: 'bloodTest', tests: ['Hb', 'LPK', 'Trombocyter', 'Elstatus', 'Koagulation', 'Laktat', 'Albumin', 'Myoglobin', 'Blodgruppering'], description: 'Ordinera liten traumarutin + Myoglobin + blodgruppering', time: 2 },
        { type: 'bloodTest', tests: ['BAS'], description: 'Ordinera blodgas', time: 1 },
        { type: 'medication', drug: 'Ringer-Acetat enligt Parkland-formeln', description: 'Ordinera Ringer-Acetat enligt Parkland-formeln', time: 2 },
        { type: 'medication', drug: 'Morfin 5-10 mg iv', description: 'Ordinera Morfin 5-10 mg iv', time: 2 }
      );
      break;
      
    case 'penetrating':
      // ESS 38 - Penetrerande trauma (röd prioritet)
      orders.push(
        { type: 'other', action: 'Sätt PVK x2', description: 'Sätt PVK x2', time: 3 },
        { type: 'other', action: 'EKG-övervakning', description: 'Koppla EKG-övervakning', time: 2 },
        { type: 'assessment', action: 'Bedömning av penetrerande trauma', description: 'Bedömning av penetrerande trauma', time: 5 },
        { type: 'bloodTest', tests: ['Hb', 'LPK', 'Trombocyter', 'Elstatus', 'Koagulation', 'Laktat', 'Blodgruppering'], description: 'Ordinera stora trauma/chock-prover + blodgruppering', time: 2 },
        { type: 'bloodTest', tests: ['BAS'], description: 'Ordinera blodgas', time: 1 },
        { type: 'imaging', exam: 'Trauma-CT torax/buk', description: 'Ordinera Trauma-CT', time: 3 },
        { type: 'medication', drug: 'Plasmalyte eller Ringer-Acetat iv', description: 'Ordinera vätskeersättning', time: 2 },
        { type: 'medication', drug: 'Morfin 5-10 mg iv', description: 'Ordinera Morfin 5-10 mg iv', time: 2 }
      );
      break;
      
    case 'cardiac':
      // ESS 5 - Bröstsmärta: Hjärtrutin
      orders.push(
        { type: 'other', action: 'Sätt PVK (överväg 2)', description: 'Sätt PVK (överväg 2)', time: 2 },
        { type: 'other', action: 'EKG-uppkoppling', description: 'Koppla EKG-uppkoppling', time: 2 },
        { type: 'other', action: 'Syrgas om saturation <95%', description: 'Ge syrgas om saturation <95%', time: 1 },
        { type: 'assessment', action: 'Hjärtauskultation och kardiell bedömning', description: 'Hjärtauskultation och kardiell bedömning', time: 3 },
        { type: 'ekg', description: 'Ordinera EKG', time: 2 },
        { type: 'quickTest', tests: ['Troponin'], description: 'Ordinera snabbprover (Troponin)', time: 1 },
        { type: 'bloodTest', tests: ['Troponin-T', 'CK-MB', 'BNP', 'CRP', 'Elstatus'], description: 'Ordinera hjärtrutin', time: 2 },
        { type: 'imaging', exam: 'Lungröntgen', description: 'Ordinera lungröntgen', time: 2 },
        { type: 'medication', drug: 'Plasmalyte iv', description: 'Ordinera Plasmalyte iv', time: 2 },
        { type: 'medication', drug: 'Trombyl 300 mg po', description: 'Ordinera Trombyl 300 mg po', time: 2 },
        { type: 'medication', drug: 'Morfin 2,5 mg iv', description: 'Ordinera Morfin 2,5 mg iv', time: 2 },
        { type: 'medication', drug: 'Nitroglycerin spray sublingualt', description: 'Ordinera Nitroglycerin spray', time: 1 }
      );
      break;
      
    case 'neuro':
      // ESS 12 - Stroke/TIA eller ESS 9 - Kramper
      orders.push(
        { type: 'other', action: 'Sätt PVK', description: 'Sätt PVK', time: 2 },
        { type: 'assessment', action: 'Neurologstatus (GCS, pupiller, NIHSS)', description: 'Neurologstatus (GCS, pupiller, NIHSS)', time: 5 },
        { type: 'quickTest', tests: ['Glukos'], description: 'Ordinera snabbprover (Glukos)', time: 1 },
        { type: 'bloodTest', tests: ['CRP', 'LPK', 'Elstatus', 'Glukos', 'Koagulation', 'Kreatinin'], description: 'Ordinera blodprover', time: 2 },
        { type: 'imaging', exam: 'CT hjärna akut', description: 'Ordinera CT hjärna', time: 3 },
        { type: 'medication', drug: 'Glukos 30% iv vid hypoglykemi', description: 'Ordinera Glukos 30% iv vid behov', time: 2 }
      );
      break;
      
    case 'abdominal':
      // ESS 6 - Buksmärta
      orders.push(
        { type: 'other', action: 'Sätt PVK x2', description: 'Sätt PVK x2', time: 3 },
        { type: 'other', action: 'EKG (över 35 år eller kardiovaskulära riskfaktorer)', description: 'EKG (över 35 år)', time: 2 },
        { type: 'other', action: 'Urinsticka', description: 'Ta urinsticka', time: 2 },
        { type: 'assessment', action: 'Bukstatus och palpation', description: 'Bukstatus och palpation', time: 5 },
        { type: 'quickTest', tests: ['CRP'], description: 'Ordinera snabbprover (CRP)', time: 1 },
        { type: 'bloodTest', tests: ['CRP', 'LPK', 'ALAT', 'ASAT', 'ALP', 'Bilirubin', 'Amylas', 'Lipas', 'Kreatinin', 'Troponin'], description: 'Ordinera bukrutin + Troponin', time: 2 },
        { type: 'imaging', exam: 'Ultraljud buk eller CT buk', description: 'Ordinera ultraljud/CT buk', time: 2 },
        { type: 'medication', drug: 'Plasmalyte iv vid kräkning', description: 'Ordinera Plasmalyte iv', time: 2 },
        { type: 'medication', drug: 'Paracetamol 1g po/iv', description: 'Ordinera Paracetamol 1g po/iv', time: 2 },
        { type: 'medication', drug: 'Ondansetron 4 mg iv vid illamående', description: 'Ordinera Ondansetron 4 mg iv', time: 2 }
      );
      break;
      
    case 'infection':
      // ESS 47 - Feber/Infektion
      orders.push(
        { type: 'other', action: 'Sätt PVK', description: 'Sätt PVK', time: 2 },
        { type: 'assessment', action: 'Fokusundersökning och infektionsbedömning', description: 'Fokusundersökning och infektionsbedömning', time: 5 },
        { type: 'quickTest', tests: ['CRP', 'Hb'], description: 'Ordinera snabbprover (CRP, Hb)', time: 1 },
        { type: 'bloodTest', tests: ['CRP', 'LPK', 'PCT', 'Kreatinin', 'Odlingar (blod, urin)'], description: 'Ordinera infektionsprover och odlingar', time: 2 },
        { type: 'medication', drug: 'Plasmalyte iv vid dehydrering', description: 'Ordinera Plasmalyte iv', time: 2 },
        { type: 'medication', drug: 'Paracetamol 1g po/iv', description: 'Ordinera Paracetamol 1g po/iv', time: 2 },
        { type: 'medication', drug: 'Antibiotika enligt lokal rutin', description: 'Ordinera Antibiotika enligt lokal rutin', time: 2 }
      );
      break;
      
    default: // general
      orders.push(
        { type: 'assessment', action: 'Allmän undersökning', description: 'Allmän undersökning', time: 5 },
        { type: 'quickTest', tests: ['CRP', 'Glukos'], description: 'Ordinera snabbprover (CRP, Glukos)', time: 1 },
        { type: 'bloodTest', tests: ['Hb', 'LPK', 'CRP', 'Elstatus'], description: 'Ordinera blodprover', time: 2 },
        { type: 'medication', drug: 'Paracetamol 1g po vid behov', description: 'Ordinera Paracetamol 1g po vid behov', time: 2 }
      );
  }
  
  // Filtrera ordinationer baserat på medicinska inriktningsbeslut
  const filteredOrders = orders.filter(order => {
    const allowed = isActionAllowedByDirective(order.type, order);
    if (!allowed) {
      console.log(`[Inriktningsbeslut] Blockerad åtgärd: ${order.type} - ${order.description || order.exam || order.drug}`);
    }
    return allowed;
  });
  
  return filteredOrders;
}

// Generera sjuksköterskans åtgärder baserat på läkarens ordinationer
function generateNurseActions(doctorOrders) {
  const actions = [];
  
  for (const order of doctorOrders) {
    switch (order.type) {
      case 'quickTest': {
        // Log when a result action is created
        console.log(`[PROVSIM][CREATE][quickTest] order=`, order);
        // Nurse action
        const nurseAction = {
          type: 'takeQuickTest',
          description: `Ta snabbprover: ${order.tests.join(', ')}`,
          time: 2,
          resultsIn: 5, // Snabbprover tar 5 minuter
          resultsType: 'quickTest',
          tests: order.tests
        };
        actions.push(nurseAction);
        // Result action
        actions.push({
          type: 'result',
          resultType: 'quickTest',
          description: `Resultat: snabbprover (${order.tests.join(', ')})`,
          time: 5, // Samma som resultsIn
          tests: order.tests
        });
        break;
      }
      case 'ekg': {
        // Log when a result action is created
        console.log(`[PROVSIM][CREATE][ekg] order=`, order);
        // Nurse action
        actions.push({
          type: 'performEKG',
          description: 'Utför EKG',
          time: 3,
          resultsIn: 2, // EKG-tolkning tar 2 minuter
          resultsType: 'ekg'
        });
        // Result action
        actions.push({
          type: 'result',
          resultType: 'ekg',
          description: 'Resultat: EKG',
          time: 2
        });
        break;
      }
      case 'bloodTest': {
        // Log when a result action is created
        console.log(`[PROVSIM][CREATE][bloodTest] order=`, order);
        // Nurse action
        // Om odlingar ingår, skapa separat action för odlingar med 72h svarstid
        const hasCulture = order.tests.some(t => t.toLowerCase().includes('odling'));
        if (hasCulture) {
          // Dela upp: övriga blodprover och odlingar
          const cultureTests = order.tests.filter(t => t.toLowerCase().includes('odling'));
          const otherTests = order.tests.filter(t => !t.toLowerCase().includes('odling'));
          if (otherTests.length > 0) {
            actions.push({
              type: 'takeBloodSample',
              description: `Ta blodprover: ${otherTests.join(', ')}`,
              time: TIMINGS.takeBloodSample,
              resultsIn: TIMINGS.bloodTestResult,
              resultsType: 'bloodTest',
              tests: otherTests
            });
            actions.push({
              type: 'result',
              resultType: 'bloodTest',
              description: `Resultat: blodprover (${otherTests.join(', ')})`,
              time: TIMINGS.bloodTestResult,
              tests: otherTests
            });
          }
          // Odlingar får egen action med 4320 min (72h)
          actions.push({
            type: 'takeBloodSample',
            description: `Ta odlingar: ${cultureTests.join(', ')}`,
            time: TIMINGS.takeBloodSample,
            resultsIn: 4320,
            resultsType: 'bloodTest',
            tests: cultureTests
          });
          actions.push({
            type: 'result',
            resultType: 'bloodTest',
            description: `Resultat: odlingar (${cultureTests.join(', ')})`,
            time: 4320,
            tests: cultureTests
          });
        } else {
          actions.push({
            type: 'takeBloodSample',
            description: `Ta blodprover: ${order.tests.join(', ')}`,
            time: TIMINGS.takeBloodSample,
            resultsIn: TIMINGS.bloodTestResult,
            resultsType: 'bloodTest',
            tests: order.tests
          });
          actions.push({
            type: 'result',
            resultType: 'bloodTest',
            description: `Resultat: blodprover (${order.tests.join(', ')})`,
            time: TIMINGS.bloodTestResult,
            tests: order.tests
          });
        }
        break;
      }
        
      case 'imaging':
        if (order.exam.includes('CT')) {
          // Transport till CT
          actions.push({
            type: 'transportToCT',
            description: `Transport till CT: ${order.exam}`,
            time: TIMINGS.transportToCT
          });
          // Undersökning på CT (patient är på CT)
          actions.push({
            type: 'ctScan',
            description: `CT-undersökning: ${order.exam}`,
            time: 10 // Justera om du vill ha annan undersökningstid
          });
          // Transport tillbaka från CT
          actions.push({
            type: 'transportFromCT',
            description: `Transport från CT till akuten: ${order.exam}`,
            time: TIMINGS.transportToCT
          });
          // Resultat-action (kommer efter att patienten är tillbaka)
          actions.push({
            type: 'result',
            resultType: 'imaging',
            description: `Resultat: ${order.exam}`,
            time: TIMINGS.ctResult,
            exam: order.exam
          });
        } else {
          // Transport till röntgen
          actions.push({
            type: 'transportToXray',
            description: `Transport till röntgen: ${order.exam}`,
            time: TIMINGS.transportToXray
          });
          // Undersökning på röntgen (patient är på röntgen)
          actions.push({
            type: 'xrayExam',
            description: `Röntgenundersökning: ${order.exam}`,
            time: 10 // Justera om du vill ha annan undersökningstid
          });
          // Transport tillbaka från röntgen
          actions.push({
            type: 'transportFromXray',
            description: `Transport från röntgen till akuten: ${order.exam}`,
            time: TIMINGS.transportToXray
          });
          // Resultat-action (kommer efter att patienten är tillbaka)
          actions.push({
            type: 'result',
            resultType: 'imaging',
            description: `Resultat: ${order.exam}`,
            time: TIMINGS.xrayResult,
            exam: order.exam
          });
        }
        break;
        
      case 'medication':
        const isIV = order.drug.includes(' iv');
        actions.push({
          type: isIV ? 'giveIVMedication' : 'giveOralMedication',
          description: `Ge läkemedel: ${order.drug}`,
          time: isIV ? TIMINGS.giveIVMedication : TIMINGS.giveOralMedication
        });
        break;
        
      case 'other':
        actions.push({
          type: 'otherAction',
          description: order.action,
          time: order.time || 10
        });
        break;
    }
  }
  
  return actions;
}

// Generera realistiska provsvar
function generateBloodTestResults(tests, patientType) {
  const results = [];
  
  for (const test of tests) {
    switch (test) {
      case 'Hb':
        const hb = patientType === 'trauma' || patientType === 'penetrating' 
          ? (90 + Math.random() * 40).toFixed(0) // Lägre vid trauma
          : (120 + Math.random() * 40).toFixed(0);
        results.push(`Hb: ${hb} g/L (ref 134-170)`);
        break;
      case 'LPK':
        const lpk = patientType === 'infection' 
          ? (12 + Math.random() * 15).toFixed(1) // Högt vid infektion
          : (4 + Math.random() * 8).toFixed(1);
        results.push(`LPK: ${lpk} x10⁹/L (ref 3,5-8,8)`);
        break;
      case 'CRP':
        const crp = patientType === 'infection' || patientType === 'trauma'
          ? (50 + Math.random() * 200).toFixed(0) // Högt vid infektion/trauma
          : (Math.random() * 20).toFixed(0);
        results.push(`CRP: ${crp} mg/L (ref <5)`);
        break;
      case 'EKG':
        // Simulera ett enkelt EKG-svar
        results.push('EKG: Sinusrytm, frekvens 78/min, inga patologiska ST-T förändringar.');
        break;
        
      case 'Troponin-T':
        const trop = patientType === 'cardiac' && Math.random() > 0.5
          ? (50 + Math.random() * 500).toFixed(0) // Förhöjt vid infarkt
          : (Math.random() * 14).toFixed(0);
        results.push(`Troponin-T: ${trop} ng/L (ref <14)`);
        break;
        
      case 'Elstatus':
        results.push(`Na: ${(135 + Math.random() * 10).toFixed(0)} mmol/L`);
        results.push(`K: ${(3.5 + Math.random() * 1.5).toFixed(1)} mmol/L`);
        results.push(`Krea: ${(60 + Math.random() * 40).toFixed(0)} µmol/L`);
        break;
        
      case 'Koagulation':
        results.push(`PK(INR): ${(0.9 + Math.random() * 0.4).toFixed(1)} (ref 0,9-1,2)`);
        results.push(`APTT: ${(25 + Math.random() * 10).toFixed(0)} sek (ref 26-36)`);
        break;
        
      case 'PCT':
        const pct = patientType === 'infection'
          ? (0.5 + Math.random() * 5).toFixed(1)
          : (Math.random() * 0.5).toFixed(2);
        results.push(`PCT: ${pct} µg/L (ref <0,05)`);
        break;
        
      default:
        results.push(`${test}: Normalt`);
    }
  }
  
  return results.join('\n');
}

// Generera snabbprovsresultat
function generateQuickTestResults(tests, patientType) {
  const results = [];
  
  for (const test of tests) {
    switch (test) {
      case 'Hb':
        const hb = patientType === 'trauma' || patientType === 'penetrating' 
          ? (90 + Math.random() * 40).toFixed(0)
          : (120 + Math.random() * 40).toFixed(0);
        results.push(`Hb (snabbprov): ${hb} g/L (ref 134-170)`);
        break;
        
      case 'CRP':
        const crp = patientType === 'infection' || patientType === 'trauma'
          ? (50 + Math.random() * 150).toFixed(0)
          : (Math.random() * 20).toFixed(0);
        results.push(`CRP (snabbprov): ${crp} mg/L (ref <5)`);
        break;
        
      case 'Glukos':
      case 'Glukos':
        const glucose = (3.5 + Math.random() * 6).toFixed(1);
        results.push(`Glukos (snabbprov): ${glucose} mmol/L (ref 4,0-6,0)`);
        break;
        
      case 'BAS':
        results.push(`BAS: Endast som blodprov!`);
        break;
      case 'Urinsticka':
        results.push(`Urinsticka (snabbprov):`);
        results.push(`  Glukos: Neg`);
        results.push(`  Protein: Neg`);
        results.push(`  Nitrit: Neg`);
        results.push(`  Leukocyter: Neg`);
        break;
        
      case 'Troponin':
        const trop = patientType === 'cardiac' && Math.random() > 0.5
          ? (50 + Math.random() * 300).toFixed(0)
          : (Math.random() * 14).toFixed(0);
        results.push(`Troponin (snabbprov): ${trop} ng/L (ref <14)`);
        break;
        
      default:
        results.push(`${test} (snabbprov): Normalt`);
    }
  }
  
  return results.join('\n');
}

// Generera EKG-resultat
function generateEKGResults(patientType) {
  const findings = [];
  
  findings.push('EKG-undersökning:');
  findings.push(`Hjärtfrekvens: ${(60 + Math.random() * 40).toFixed(0)} slag/min`);
  
  if (patientType === 'cardiac') {
    if (Math.random() > 0.5) {
      findings.push('Sinusrytm med ST-höjningar i avledning V2-V4');
      findings.push('Tolkning: Tecken till akut främre väggsinfarkt (STEMI)');
    } else {
      findings.push('Sinusrytm med ST-sänkningar och T-vågsinversioner i V4-V6');
      findings.push('Tolkning: Tecken till akut koronart syndrom (NSTEMI)');
    }
  } else {
    findings.push('Sinusrytm');
    findings.push('Normala ST-T-förändringar');
    findings.push('Tolkning: Normalt EKG');
  }
  
  return findings.join('\n');
}

// Generera läkarens bedömning och rekommendation
function generateDoctorAssessment(patientType, triage) {
  const assessment = [];
  
  assessment.push('LÄKARBEDÖMNING OCH REKOMMENDATION:');
  assessment.push('');
  
  switch (patientType) {
    case 'trauma':
      assessment.push('Preliminär diagnos: Multitrauma efter traumamekanism');
      assessment.push('Bedömning: Allvarligt skadad patient med frakturer och eventuell intern blödning.');
      assessment.push('Rekommendation: Inneliggande vård på IVA/Traumavdelning');
      assessment.push('Plan: Fortsatt övervakning, eventuell kirurgisk åtgärd');
      break;
      
    case 'fracture':
      assessment.push('Preliminär diagnos: Fraktur i extremitet');
      assessment.push('Bedömning: Stabil fraktur utan större komplikationer.');
      assessment.push('Rekommendation: Ortopedisk konsultation, gipsning och hemgång');
      assessment.push('Plan: Återbesök ortopedmottagning om 1 vecka, smärtlindring');
      break;
      
    case 'burn':
      assessment.push('Preliminär diagnos: Brännskada grad 2-3');
      assessment.push('Bedömning: Måttlig till allvarlig brännskada med risk för vätskebrist.');
      assessment.push('Rekommendation: Inneliggande vård på Kirurgavdelning/Brännskadeenhet');
      assessment.push('Plan: Fortsatt vätskebehandling, sårvård, uppföljning av diures');
      break;
      
    case 'penetrating':
      assessment.push('Preliminär diagnos: Penetrerande trauma torax/buk');
      assessment.push('Bedömning: Akut kirurgisk åtgärd kan bli nödvändig.');
      assessment.push('Rekommendation: Inneliggande vård på IVA, kirurgisk konsultation akut');
      assessment.push('Plan: Fortsatt övervakning, beredskapstid för operation');
      break;
      
    case 'cardiac':
      const isSTEMI = Math.random() > 0.5;
      if (isSTEMI) {
        assessment.push('Preliminär diagnos: Akut STEMI (ST-höjningsinfarkt)');
        assessment.push('Bedömning: Akut hjärtinfarkt med pågående myokardskada.');
        assessment.push('Rekommendation: Akut PCI (kranskärlsröntgen), inneliggande vård på IVA/Koronaravdelning');
        assessment.push('Plan: Direkt transport till PCI-lab, fortsatt övervakning och läkemedelsbehandling');
      } else {
        assessment.push('Preliminär diagnos: NSTEMI/Instabil angina');
        assessment.push('Bedömning: Trolig hjärtinfarkt utan ST-höjningar, kräver övervakning.');
        assessment.push('Rekommendation: Inneliggande vård på Koronaravdelning');
        assessment.push('Plan: Fortsatt provotagning, koronarangiografi inom 24-72 timmar');
      }
      break;
      
    case 'neuro':
      const isStroke = Math.random() > 0.5;
      if (isStroke) {
        assessment.push('Preliminär diagnos: Akut ischemisk stroke');
        assessment.push('Bedömning: Akut stroke i MCA-territorium, neurologiska bortfallssymtom.');
        assessment.push('Rekommendation: Inneliggande vård på Strokeavdelning/IVA');
        assessment.push('Plan: Överväg trombolys/trombektomi, fortsatt övervakning');
      } else {
        assessment.push('Preliminär diagnos: TIA (transitorisk ischemisk attack) / oklar medvetandepåverkan');
        assessment.push('Bedömning: Övergående neurologiska symtom, låg risk för återfall.');
        assessment.push('Rekommendation: Inneliggande vård på Strokeavdelning för utredning');
        assessment.push('Plan: Fortsatt utredning med karotisdoppler, 24-timmars-EKG');
      }
      break;
      
    case 'abdominal':
      assessment.push('Preliminär diagnos: Akut buk, trolig appendicit/kolecystit');
      assessment.push('Bedömning: Akut kirurgisk diagnos kan föreligga.');
      assessment.push('Rekommendation: Kirurgisk konsultation, eventuellt inneliggande vård på Kirurgavdelning');
      assessment.push('Plan: Fortsatt observation, eventuell operation');
      break;
      
    case 'infection':
      assessment.push('Preliminär diagnos: Infektion (trolig sepsis/pneumoni/UVI)');
      assessment.push('Bedömning: Måttlig till svår infektion med förhöjda infektionsparametrar.');
      assessment.push('Rekommendation: Inneliggande vård på Infektionsavdelning/Medicinavdelning');
      assessment.push('Plan: Antibiotikabehandling enligt odlingssvar, uppföljning av CRP och LPK');
      break;
      
    default: // general
      if (triage === 'Grön' || triage === 'Gul') {
        assessment.push('Preliminär diagnos: Lindrigare besvär, ingen akut kirurgisk eller medicinsk åtgärd');
        assessment.push('Bedömning: Stabil patient utan allvarlig sjukdom.');
        assessment.push('Rekommendation: Hemgång med råd och eventuell återbesöksremiss');
        assessment.push('Plan: Smärtlindring vid behov, kontakt med primärvård vid försämring');
      } else {
        assessment.push('Preliminär diagnos: Oklar/Under utredning');
        assessment.push('Bedömning: Kräver fortsatt utredning och observation.');
        assessment.push('Rekommendation: Inneliggande vård på Medicinavdelning för fortsatt utredning');
        assessment.push('Plan: Kompletterande undersökningar, uppföljning av status');
      }
  }
  
  return assessment.join('\n');
}

// Generera realistiska röntgensvar
function generateImagingResults(exam, patientType) {
  const findings = [];
  
  if (exam.includes('CT')) {
    if (patientType === 'trauma') {
      findings.push('CT huvud-hals-torax-buk-bäcken:');
      findings.push('- Inga akuta intrakraniella fynd');
      findings.push('- Fraktur i revben 5-7 vänster');
      findings.push('- Liten pneumothorax vänster (10%)');
      findings.push('- Fri vätska i buken, möjlig mjältruptur');
      findings.push('- Bäckenfraktur typ B');
    } else if (patientType === 'neuro') {
      findings.push('CT hjärna:');
      if (Math.random() > 0.5) {
        findings.push('- Tecken till akut ischemisk stroke i vänster MCA-territorium');
      } else {
        findings.push('- Inga akuta intrakraniella fynd');
        findings.push('- Kroniska förändringar förenliga med ålder');
      }
    }
  } else if (exam.includes('Röntgen')) {
    if (patientType === 'fracture') {
      findings.push(`${exam}:`);
      findings.push('- Tvärställd fraktur i distala radius');
      findings.push('- Måttlig dislokation');
      findings.push('- Ingen subluxation i radiokarpalleden');
    } else if (patientType === 'cardiac') {
      findings.push('Lungröntgen:');
      findings.push('- Normalt stor hjärtsilhuett');
      findings.push('- Fria kostofrena sinus');
      findings.push('- Inga infiltrat eller ödem');
    }
  } else if (exam.includes('Ultraljud')) {
    findings.push(`${exam}:`);
    findings.push('- Lever och mjälte utan patologiska fynd');
    findings.push('- Gallblåsa utan konkrement');
    findings.push('- Normala njurar bilateralt');
  }
  
  if (findings.length === 0) {
    findings.push(`${exam}: Undersökning genomförd, normala fynd`);
  }
  
  return findings.join('\n');
}

// Huvudfunktion: Starta automatiskt vårdflöde när personal tilldelas
export function startAutomatedCare(patient, patientIndex, selectedHospital, assignedRole) {
    // Hämta eller skapa patientens vårdkö
    let careQueue = JSON.parse(localStorage.getItem('patientCareQueue') || '{}');

    // DEBUG: Logga careQueue och doctorOrders vid nurse-tilldelning
    if (assignedRole === 'nurse') {
      console.log('[DEBUG] startAutomatedCare: doctorOrders vid nurse-tilldelning:', JSON.stringify(careQueue[`${selectedHospital}_${patientIndex}`]?.doctorOrders, null, 2));
    }
    const patientType = identifyPatientType(patient);
    console.log(`[Care System] Patient ${patient.name} identifierad som: ${patientType}`);
    const patientKey = `${selectedHospital}_${patientIndex}`;
    // Om vårdkön finns men alla åtgärder är klara, skapa en ny kö (ny patient på samma index)
    if (careQueue[patientKey] && careQueue[patientKey].activeActions) {
      const hasPendingActions = careQueue[patientKey].activeActions.some(a => a.status === 'pending');
      if (!hasPendingActions && careQueue[patientKey].activeActions.length > 0) {
        console.log(`[Care System] Rensar gammal vårdkö för ${patientKey}`);
        delete careQueue[patientKey];
      }
    }
    if (!careQueue[patientKey]) {
      careQueue[patientKey] = {
        patientIndex,
        hospital: selectedHospital,
        patientType,
        doctorOrders: [],
        nurseActions: [],
        completedActions: [],
        activeActions: [],
        assignedDoctor: patient.doctor || null,
        assignedNurse: patient.nurse || null
      };
    }

  
  if (!careQueue[patientKey]) {
    careQueue[patientKey] = {
      patientIndex,
      hospital: selectedHospital,
      patientType,
      doctorOrders: [],
      nurseActions: [],
      completedActions: [],
      activeActions: [],
      assignedDoctor: patient.doctor || null,
      assignedNurse: patient.nurse || null
    };
  }
  
  // Hjälpfunktion: Hitta när personalen är ledig nästa gång
  const getNextAvailableTime = (staffName, staffRole, hospital) => {
    const simTime = localStorage.getItem('simTime') || '00:00';
    let latestTime = timeToMinutes(simTime);
    
    // Gå igenom alla patienter och hitta den senaste tiden personalen är upptagen
    for (const key in careQueue) {
      if (!key.startsWith(hospital)) continue;
      
      const queue = careQueue[key];
      const isAssignedToThisQueue = staffRole === 'doctor' 
        ? queue.assignedDoctor === staffName 
        : queue.assignedNurse === staffName;
      
      if (isAssignedToThisQueue) {
        // Hitta den senaste completionTime för denna personal
        // OBS: Ignorera 'system' actions (resultat) - personalen är inte upptagen då
        queue.activeActions.forEach(action => {
          if (action.role === staffRole && action.status === 'pending') {
            if (action.completionTime > latestTime) {
              latestTime = action.completionTime;
            }
          }
        });
      }
    }
    
    return latestTime;
  };
  
  // Om läkare tilldelas: generera ordinationer
  if (assignedRole === 'doctor' && careQueue[patientKey].doctorOrders.length === 0) {
    careQueue[patientKey].assignedDoctor = patient.doctor;
    const orders = generateDoctorOrders(patientType, patient.triage);
    careQueue[patientKey].doctorOrders = orders;
    
    // Lägg till anteckning om inriktningsbeslut är aktivt
    const directive = localStorage.getItem('medicalDirective') || 'Inget inriktningsbeslut';
    if (directive !== 'Inget inriktningsbeslut') {
      const akutPatients = JSON.parse(localStorage.getItem('akutPatients') || '{}');
      if (akutPatients[selectedHospital] && akutPatients[selectedHospital][patientIndex]) {
        const currentTime = localStorage.getItem('simTime') || '00:00';
        const noteText = `\n${currentTime} - OBS: Medicinskt inriktningsbeslut aktivt: "${directive}"\nBehandlingen anpassas efter inriktningsbeslutet.\n`;
        if (!akutPatients[selectedHospital][patientIndex].notes) {
          akutPatients[selectedHospital][patientIndex].notes = '';
        }
        akutPatients[selectedHospital][patientIndex].notes += noteText;
        localStorage.setItem('akutPatients', JSON.stringify(akutPatients));
        console.log(`[Inriktningsbeslut] Notis tillagd för patient ${patient.name}: ${directive}`);
      }
    }

    // Lägg endast till doctor actions här (inte nurse actions)
    const simTime = localStorage.getItem('simTime') || '00:00';
    const currentSimTime = timeToMinutes(simTime);
    const nextAvailableTime = getNextAvailableTime(patient.doctor, 'doctor', selectedHospital);
    let currentTime = Math.max(currentSimTime, nextAvailableTime);

    if (currentTime > currentSimTime) {
      console.log(`[Care System] Läkare ${patient.doctor} upptagen, startar kl ${minutesToTime(currentTime)}`);
    } else {
      console.log(`[Care System] Läkare ${patient.doctor} börjar nu kl ${minutesToTime(currentTime)}`);
    }

    for (const order of orders) {
      let blockForImaging = false;
      // Endast assessment-åtgärder blockeras av imaging-resultat
      // (Blockeringslogik kan flyttas till nurse om nödvändigt)
      const action = {
        ...order,
        startTime: currentTime,
        completionTime: currentTime + order.time,
        status: 'pending',
        role: 'doctor'
      };
      careQueue[patientKey].activeActions.push(action);
      currentTime += order.time;
    }
  }
  
  // Om sjuksköterska tilldelas eller om patienten saknar sjuksköterska, tilldela en default och generera åtgärder
  if (assignedRole === 'nurse' || !careQueue[patientKey].assignedNurse) {
    // Tilldela default-nurse om ingen finns
    if (!careQueue[patientKey].assignedNurse) {
      careQueue[patientKey].assignedNurse = patient.nurse || 'AutoNurse';
    }

    // Rensa gamla nurseActions och relaterade activeActions (nurse och result)
    careQueue[patientKey].nurseActions = [];
    careQueue[patientKey].activeActions = careQueue[patientKey].activeActions.filter(a => a.role !== 'nurse' && a.role !== 'system');

    if (careQueue[patientKey].doctorOrders.length > 0) {
      const actions = generateNurseActions(careQueue[patientKey].doctorOrders);
      careQueue[patientKey].nurseActions = actions;
      console.log(`[Care System] Sjuksköterska ${careQueue[patientKey].assignedNurse} tilldelas - ${actions.length} åtgärder skapade:`, actions.map(a => a.type + (a.exam ? ' ('+a.exam+')' : '')));

      // DEBUG: Logga nurseActions
      console.log('[DEBUG] nurseActions:', JSON.stringify(actions, null, 2));

      // Beräkna baseStartTime INNAN några nya nurse actions läggs till
      const simTime = localStorage.getItem('simTime') || '00:00';
      const currentSimTime = timeToMinutes(simTime);
      // Hitta den sista LÄKAR-åtgärden (inte system-actions)
      const doctorActions = careQueue[patientKey].activeActions.filter(a => a.role === 'doctor');
      const lastDoctorAction = doctorActions[doctorActions.length - 1];
      const doctorDoneTime = lastDoctorAction ? lastDoctorAction.completionTime : currentSimTime;
      // baseStartTime för parallella åtgärder: max(nu, sista läkaråtgärd klar)
      const baseStartTime = currentSimTime;
      // nurseAvailableTime för sekventiella åtgärder: max(nu, sista läkaråtgärd klar, nurse ledig)
      const nurseAvailableTime = getNextAvailableTime(careQueue[patientKey].assignedNurse, 'nurse', selectedHospital);
      const seqStartTime = Math.max(currentSimTime, nurseAvailableTime, doctorDoneTime);
      console.log(`[DEBUG] baseStartTime för parallella åtgärder: ${baseStartTime} min (${minutesToTime(baseStartTime)})`);
      console.log(`[DEBUG] seqStartTime för sekventiella åtgärder: ${seqStartTime} min (${minutesToTime(seqStartTime)})`);

      // Lista på åtgärdstyper som måste gå i sekvens (beroende på föregående)
      const sequentialTypes = ['transportToXray', 'xrayExam', 'transportFromXray', 'transportToCT', 'ctScan', 'transportFromCT', 'result', 'assessment'];
      // Schemalägg sekventiella åtgärder först, och håll reda på när de är klara
      let seqTime = seqStartTime;
      const parallelActions = [];
      for (const action of actions) {
        // Endast exakt de typer som finns i sequentialTypes är sekventiella
        if (sequentialTypes.some(t => t === action.type)) {
          // Sekventiella åtgärder läggs i ordning
          if (action.type === 'result') {
            const resultAction = {
              ...action,
              startTime: seqTime,
              completionTime: seqTime + action.time,
              status: 'pending',
              role: 'system'
            };
            careQueue[patientKey].activeActions.push(resultAction);
            seqTime += action.time;
            console.log(`[Care System] Väntar på resultat från ${action.description}, tillgängliga kl ${minutesToTime(resultAction.completionTime)}`);
          } else {
            const nurseAction = {
              ...action,
              startTime: seqTime,
              completionTime: seqTime + action.time,
              status: 'pending',
              role: 'nurse'
            };
            careQueue[patientKey].activeActions.push(nurseAction);
            seqTime += action.time;
          }
        } else {
          // Spara parallella åtgärder för separat schemaläggning
          parallelActions.push(action);
        }
      }
      // Schemalägg parallella åtgärder EFTER sekventiella lagts till, så att getNextAvailableTime inte påverkas
      for (const action of parallelActions) {
        // Granulär debugloggning för parallella åtgärder
        console.log('[DEBUG][PARALLELL] action.description:', action.description);
        console.log('[DEBUG][PARALLELL] baseStartTime:', baseStartTime, `(${minutesToTime(baseStartTime)})`);
        console.log('[DEBUG][PARALLELL] doctorDoneTime:', doctorDoneTime, `(${minutesToTime(doctorDoneTime)})`);
        console.log('[DEBUG][PARALLELL] simTime:', simTime, `(minuter: ${currentSimTime})`);
        const parallelAction = {
          ...action,
          startTime: baseStartTime,
          completionTime: baseStartTime + action.time,
          status: 'pending',
          role: 'nurse'
        };
        careQueue[patientKey].activeActions.push(parallelAction);
        console.log(`[DEBUG] Parallell åtgärd schemalagd: ${action.description} startar kl ${minutesToTime(baseStartTime)}`);
      }

      // DEBUG: Logga activeActions efter nurse-tilldelning
      console.log('[DEBUG] activeActions efter nurse-tilldelning:', JSON.stringify(careQueue[patientKey].activeActions, null, 2));
    }

    // DEBUG: Logga hela careQueue för patienten efter nurse-tilldelning
    console.log('[DEBUG] careQueue[patientKey] efter nurse-tilldelning:', JSON.stringify(careQueue[patientKey], null, 2));
  }
  
  // Spara uppdaterad kö
  localStorage.setItem('patientCareQueue', JSON.stringify(careQueue));
  window.dispatchEvent(new Event('careQueueUpdated'));
  
  return careQueue[patientKey];
}

// Uppdatera vårdflödet baserat på aktuell simTime
export function updateCareProgress(selectedHospital) {
  const simTime = localStorage.getItem('simTime') || '00:00';
  const currentMinutes = timeToMinutes(simTime);
  
  let careQueue = JSON.parse(localStorage.getItem('patientCareQueue') || '{}');
  let akutPatients = JSON.parse(localStorage.getItem('akutPatients') || '{}');
  let updated = false;
  
  const queueKeys = Object.keys(careQueue).filter(k => k.startsWith(selectedHospital));
  console.log(`[Care System] updateCareProgress körs: simTime=${simTime} (${currentMinutes} min), ${queueKeys.length} patienter i kön`);
  
  // Skapa en lista över alla patienter på akuten
  const akutList = akutPatients[selectedHospital] || [];
  // Gå igenom alla patienter på akuten och säkerställ att det finns en careQueue för varje
  for (let i = 0; i < akutList.length; i++) {
    const patient = akutList[i];
    const patientKey = `${selectedHospital}_${i}`;
    let queue = careQueue[patientKey];
    if (!queue) {
      // Återskapa careQueue-objekt om det saknas
      console.warn(`[Care System][BUGFIX] careQueue saknas för ${patientKey}, återskapar.`);
      queue = {
        patientIndex: i,
        hospital: selectedHospital,
        patientType: patient.patientType || 'unknown',
        doctorOrders: [],
        nurseActions: [],
        completedActions: [],
        activeActions: [],
        assignedDoctor: patient.doctor || null,
        assignedNurse: patient.nurse || null
      };
      careQueue[patientKey] = queue;
      // Spara direkt för att undvika race conditions
      localStorage.setItem('patientCareQueue', JSON.stringify(careQueue));
    }
    // ...resten av updateCareProgress-logiken...
    // Nedan är originalkoden:
    // const queue = careQueue[patientKey];
    // const patient = akutPatients[selectedHospital]?.[queue.patientIndex];
    // if (!patient) continue;
    
    // Logga aktiva och klara åtgärder för patienten
    console.log(`[PROVSIM][ACTIONS][${patient.id || patient.name}] activeActions:`, JSON.stringify(queue.activeActions, null, 2));
    console.log(`[PROVSIM][ACTIONS][${patient.id || patient.name}] completedActions:`, JSON.stringify(queue.completedActions, null, 2));
    
    // Uppdatera plats baserat på pågående åtgärder
    const onTransportToXray = queue.activeActions.find(a =>
      a.status === 'pending' &&
      currentMinutes >= a.startTime &&
      currentMinutes < a.completionTime &&
      a.type === 'transportToXray'
    );
    const onXrayExam = queue.activeActions.find(a =>
      a.status === 'pending' &&
      currentMinutes >= a.startTime &&
      currentMinutes < a.completionTime &&
      a.type === 'xrayExam'
    );
    const onTransportFromXray = queue.activeActions.find(a =>
      a.status === 'pending' &&
      currentMinutes >= a.startTime &&
      currentMinutes < a.completionTime &&
      a.type === 'transportFromXray'
    );

    if (onTransportToXray) {
      patient.location = 'Transport till röntgen';
      updated = true;
    } else if (onXrayExam) {
      patient.location = 'Röntgen';
      updated = true;
    } else if (onTransportFromXray) {
      patient.location = 'Transport från röntgen';
      updated = true;
    } else if (patient.location === 'Röntgen' || patient.location === 'Transport till röntgen' || patient.location === 'Transport från röntgen') {
      // Återställ plats när patienten är tillbaka
      patient.location = '';
      updated = true;
    }
    
    // Kontrollera om några åtgärder är klara
    for (let i = 0; i < queue.activeActions.length; i++) {
      const action = queue.activeActions[i];
      if (action.status === 'pending' && currentMinutes >= action.completionTime) {
        action.status = 'completed';
        queue.completedActions.push(action);
        console.log(`[PROVSIM][COMPLETE][${patient.id || patient.name}] action=`, JSON.stringify(action, null, 2));
        // Log when a result action is completed
        if (action.type === 'result') {
          console.log(`[PROVSIM][RESULT][${patient.id || patient.name}] resultType=${action.resultType} exam=${action.exam || ''} tests=${action.tests ? action.tests.join(',') : ''}`);
           if (action.resultType === 'bloodTest') {
             const results = generateBloodTestResults(action.tests, queue.patientType);
             patient.labResults = (patient.labResults || '') + '\n\n' + results;
             // Synka till akutPatients
             if (akutPatients[selectedHospital] && akutPatients[selectedHospital][queue.patientIndex]) {
               akutPatients[selectedHospital][queue.patientIndex].labResults = patient.labResults;
             }
             console.log(`[PROVSIM][LAB][${patient.id || patient.name}] bloodTest=`, results);
             console.log(`[PROVSIM][LAB][${patient.id || patient.name}] labResults=`, patient.labResults);
           } else if (action.resultType === 'quickTest') {
             const results = generateQuickTestResults(action.tests, queue.patientType);
             patient.labResults = (patient.labResults || '') + '\n\n' + results;
             if (akutPatients[selectedHospital] && akutPatients[selectedHospital][queue.patientIndex]) {
               akutPatients[selectedHospital][queue.patientIndex].labResults = patient.labResults;
             }
             console.log(`[PROVSIM][LAB][${patient.id || patient.name}] quickTest=`, results);
             console.log(`[PROVSIM][LAB][${patient.id || patient.name}] labResults=`, patient.labResults);
           } else if (action.resultType === 'ekg') {
             const results = generateEKGResults(queue.patientType);
             patient.labResults = (patient.labResults || '') + '\n\n' + results;
             if (akutPatients[selectedHospital] && akutPatients[selectedHospital][queue.patientIndex]) {
               akutPatients[selectedHospital][queue.patientIndex].labResults = patient.labResults;
             }
             console.log(`[PROVSIM][LAB][${patient.id || patient.name}] ekg=`, results);
             console.log(`[PROVSIM][LAB][${patient.id || patient.name}] labResults=`, patient.labResults);
           } else if (action.resultType === 'imaging') {
             const results = generateImagingResults(action.exam, queue.patientType);
             patient.xrayResults = (patient.xrayResults || '') + '\n\n' + results;
             if (akutPatients[selectedHospital] && akutPatients[selectedHospital][queue.patientIndex]) {
               akutPatients[selectedHospital][queue.patientIndex].xrayResults = patient.xrayResults;
             }
             console.log(`[Care System][DEBUG] Röntgensvar tillagda till patient ${patient.name}: ${results.substring(0, 50)}...`);
             console.log(`[Care System][DEBUG] patient.xrayResults nu:`, patient.xrayResults);
           }
           updated = true;
        }
        // Om läkare ordinerar något (alla typer av ordinationer), lägg till i prescribedMeds
        if (action.role === 'doctor' && (action.type === 'medication' || action.type === 'bloodTest' || action.type === 'quickTest' || action.type === 'ekg' || action.type === 'imaging')) {
          if (!patient.prescribedMeds) patient.prescribedMeds = '';
          const timeStr = minutesToTime(currentMinutes);
          let ordinationText = '';
          if (action.type === 'medication') {
            ordinationText = action.drug;
          } else if (action.type === 'bloodTest') {
            ordinationText = `Blodprover: ${action.tests.join(', ')}`;
          } else if (action.type === 'quickTest') {
            ordinationText = `Snabbprover: ${action.tests.join(', ')}`;
          } else if (action.type === 'ekg') {
            ordinationText = 'EKG';
          } else if (action.type === 'imaging') {
            ordinationText = action.exam;
          }
          patient.prescribedMeds += (patient.prescribedMeds ? '\n' : '') + `${timeStr} - ${ordinationText}`;
          updated = true;
        }
        // Lägg till åtgärden i journalanteckningar
        if (!patient.notes) patient.notes = '';
        const timeStr = minutesToTime(currentMinutes);
        patient.notes += `\n${timeStr} - ${action.description || action.action}`;
        updated = true;
      }
    }
    
    // Kontrollera om alla åtgärder (förutom result-actions) är klara och bedömning inte redan gjorts
    // Nu: Läkaren kan ta beslut även om result-actions (t.ex. odlingssvar) inte är klara
    const allActionsCompleted = queue.activeActions.filter(a => a.type !== 'result').every(a => a.status === 'completed');
    const hasPendingNurseWork = queue.doctorOrders.length > 0 && queue.nurseActions.length === 0 && !queue.assignedNurse;

    // Debug-logging
    if (!queue.assessmentGiven && (queue.activeActions.length > 0 || queue.doctorOrders.length > 0)) {
      const pendingActions = queue.activeActions.filter(a => a.status === 'pending' && a.type !== 'result');
      if (pendingActions.length > 0) {
        console.log(`[Care System] Patient ${queue.patientIndex} väntar på ${pendingActions.length} åtgärder:`, 
          pendingActions.map(a => `${a.description} (klar ${minutesToTime(a.completionTime)})`));
      }
      if (hasPendingNurseWork) {
        console.log(`[Care System] Patient ${queue.patientIndex} väntar på sjuksköterska (${queue.doctorOrders.length} ordinationer)`);
      }
    }

    // Tillåt läkarbedömning även om det bara är result-actions kvar
    const onlyResultActionsLeft = queue.activeActions.every(a => a.status !== 'pending' || a.type === 'result');
    if ((allActionsCompleted || onlyResultActionsLeft) && !hasPendingNurseWork && !queue.assessmentGiven) {
      // DEBUG: Logga patienttyp och triage
      console.log(`[DEBUG][Assessment] patientType: ${queue.patientType}, triage: ${patient.triage}, id: ${patient.id || patient.name}`);
      // Om patientType är okänd, försök att gissa från skada/symptom
      let effectivePatientType = queue.patientType;
      if (!effectivePatientType || effectivePatientType === 'unknown') {
        if (patient.injuryDescription || patient.mechanism) {
          effectivePatientType = determinePatientType(patient.injuryDescription || '', patient.mechanism || '', patient.triage || '');
          console.log(`[DEBUG][Assessment] Gissad patientType: ${effectivePatientType}`);
        }
      }
      const assessment = generateDoctorAssessment(effectivePatientType, patient.triage);
      if (!patient.notes) patient.notes = '';
      const timeStr = minutesToTime(currentMinutes);
      patient.notes += `\n\n${timeStr} - ${assessment}`;

      // Kontrollera att alla åtgärder utom odlingssvar är klara innan "Hem" eller "Inläggning" läggs till
      const nonCultureActionsCompleted = queue.activeActions
        .filter(a => a.type !== 'result' || !(a.resultType === 'bloodTest' && Array.isArray(a.tests) && a.tests.some(t => t.toLowerCase().includes('odling'))))
        .every(a => a.status === 'completed');

      if (nonCultureActionsCompleted) {
        // Lägg till "Hem" i activities om patienten får hemgångsrekommendation
        if ((queue.patientType === undefined || queue.patientType === 'general' || queue.patientType === '' || queue.patientType === null)
          && (patient.triage === 'Grön' || patient.triage === 'Gul')) {
          if (!Array.isArray(patient.activities)) patient.activities = [];
          if (!patient.activities.includes('Hem')) patient.activities.push('Hem');
        }
        // Lägg till "Hem" i activities om rekommendationen är "Ortopedisk konsultation, gipsning och hemgång"
        if (patient.notes && patient.notes.includes('Rekommendation: Ortopedisk konsultation, gipsning och hemgång')) {
          if (!Array.isArray(patient.activities)) patient.activities = [];
          if (!patient.activities.includes('Hem')) patient.activities.push('Hem');
        }
        // Lägg till "Inläggning" i activities om patienten får inneliggande-rekommendation (default patienttyp och triage ej Grön/Gul)
        if ((queue.patientType === undefined || queue.patientType === 'general' || queue.patientType === '' || queue.patientType === null)
          && (patient.triage !== 'Grön' && patient.triage !== 'Gul')) {
          if (!Array.isArray(patient.activities)) patient.activities = [];
          if (!patient.activities.includes('Inläggning')) patient.activities.push('Inläggning');
        }
        // Lägg till "Inläggning" i activities om bedömningen innehåller 'Plan: Fortsatt observation, eventuell operation'
        if (patient.notes && patient.notes.includes('Plan: Fortsatt observation, eventuell operation')) {
          if (!Array.isArray(patient.activities)) patient.activities = [];
          if (!patient.activities.includes('Inläggning')) patient.activities.push('Inläggning');
        }
        // Lägg till "Inläggning" i activities om patienten får en rekommendation som börjar med 'Rekommendation: Inneliggande vård på'
        if (patient.notes && /Rekommendation: Inneliggande vård på/.test(patient.notes)) {
          if (!Array.isArray(patient.activities)) patient.activities = [];
          if (!patient.activities.includes('Inläggning')) patient.activities.push('Inläggning');
        }
      }

      queue.assessmentGiven = true;
      updated = true;
      
      console.log(`[Care System] Läkarbedömning och rekommendation tillagd för patient ${queue.patientIndex}`);
    }
  }
  
  if (updated) {
    localStorage.setItem('akutPatients', JSON.stringify(akutPatients));
    localStorage.setItem('patientCareQueue', JSON.stringify(careQueue));
    // Tvinga frontend att synka patientdata direkt
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('careQueueUpdated'));
  }
}

// Starta triageprocess för patient
export function startTriage(patient, patientIndex, selectedHospital) {
  // Om patienten redan är triagerad (från skadeplats eller annat sjukhus), gör ingenting
  if (patient.triageStatus === 'completed' || patient.triageCompleted) {
    return;
  }
  
  const simTime = localStorage.getItem('simTime') || '00:00';
  const currentMinutes = timeToMinutes(simTime);
  
  // Identifiera patienttyp för att bestämma triageringstid
  const patientType = identifyPatientType(patient);
  let triageDuration;
  
  // Allvarligare tillstånd tar längre tid att triagera (mer omfattande bedömning)
  switch (patientType) {
    case 'trauma':
    case 'penetrating':
      triageDuration = 6 + Math.floor(Math.random() * 3); // 6-8 min (svårbedömda, livhotande)
      break;
    case 'burn':
    case 'cardiac':
    case 'neuro':
      triageDuration = 5 + Math.floor(Math.random() * 2); // 5-6 min (måttligt komplexa)
      break;
    case 'abdominal':
      triageDuration = 4 + Math.floor(Math.random() * 2); // 4-5 min (kräver bukpalpation)
      break;
    case 'fracture':
    case 'infection':
      triageDuration = 3 + Math.floor(Math.random() * 2); // 3-4 min (enklare att bedöma)
      break;
    default:
      triageDuration = 3 + Math.floor(Math.random() * 3); // 3-5 min (standardfall)
  }
  
  // Hämta triagekö
  let triageQueue = JSON.parse(localStorage.getItem('triageQueue') || '{}');
  if (!triageQueue[selectedHospital]) {
    triageQueue[selectedHospital] = {
      nurseAvailableAt: currentMinutes,
      queue: []
    };
  }
  
  // DEBUG: Kolla om någon annan patient håller på att triageras
  const akutPatients = JSON.parse(localStorage.getItem('akutPatients') || '{}');
  const otherTriaging = akutPatients[selectedHospital]?.filter(p => 
    p.triageStatus === 'pending' && p.name !== patient.name
  ) || [];
  
  console.log(`[startTriage] Patient ${patient.name}, currentMinutes=${currentMinutes}, nurseAvailableAt=${triageQueue[selectedHospital].nurseAvailableAt}, andra patienter som triageras: ${otherTriaging.length}`);
  if (otherTriaging.length > 0) {
    console.log(`[startTriage] Andra patienter i triage:`, otherTriaging.map(p => `${p.name} (start=${p.triageStartTime}, slutar=${p.triageCompletionTime})`));
  }
  
  // Om nurseAvailableAt är i det förflutna, betyder det att sjuksköterskan är ledig nu
  // Uppdatera till nuvarande tid
  if (triageQueue[selectedHospital].nurseAvailableAt < currentMinutes) {
    console.log(`[startTriage] nurseAvailableAt (${triageQueue[selectedHospital].nurseAvailableAt}) är i det förflutna, uppdaterar till currentMinutes (${currentMinutes})`);
    triageQueue[selectedHospital].nurseAvailableAt = currentMinutes;
  }
  
  // EXTRA CHECK: Om det inte finns några andra patienter som triageras, sätt sjuksköterskan som ledig NU
  if (otherTriaging.length === 0 && triageQueue[selectedHospital].nurseAvailableAt > currentMinutes) {
    console.log(`[startTriage] Ingen annan patient triageras, men nurseAvailableAt är ${triageQueue[selectedHospital].nurseAvailableAt}. Återställer till ${currentMinutes}`);
    triageQueue[selectedHospital].nurseAvailableAt = currentMinutes;
  }
  
  // Beräkna när triagen kan starta (när sjuksköterskan är ledig)
  const nurseAvailable = triageQueue[selectedHospital].nurseAvailableAt;
  
  // Om sjuksköterskan är ledig NU (nurseAvailable <= currentMinutes), starta direkt
  // Annars måste patienten vänta tills sjuksköterskan blir ledig
  const triageStartTime = Math.max(currentMinutes, nurseAvailable);
  const triageCompletionTime = triageStartTime + triageDuration;
  
  // Uppdatera när sjuksköterskan blir ledig nästa gång
  triageQueue[selectedHospital].nurseAvailableAt = triageCompletionTime;
  
  // Sätt triagestart
  patient.triageStatus = 'pending';
  patient.triageStartTime = triageStartTime;
  patient.triageCompletionTime = triageCompletionTime;
  
  if (triageStartTime > currentMinutes) {
    console.log(`[Triage] Triagesjuksköterska upptagen, patient ${patient.name} väntar. Triage startar kl ${minutesToTime(triageStartTime)}, klar kl ${minutesToTime(triageCompletionTime)}`);
  } else {
    console.log(`[Triage] Påbörjar triage för patient ${patient.name} NU, klar kl ${minutesToTime(triageCompletionTime)}`);
  }
  
  // Spara (återanvänd akutPatients från tidigare)
  if (akutPatients[selectedHospital]) {
    akutPatients[selectedHospital][patientIndex] = patient;
    localStorage.setItem('akutPatients', JSON.stringify(akutPatients));
    localStorage.setItem('triageQueue', JSON.stringify(triageQueue));
    window.dispatchEvent(new CustomEvent('storage', { detail: { key: 'akutPatients' } }));
  }
}

// Uppdatera triageprocessen (körs varje tick)
export function updateTriageProgress(selectedHospital) {
  const simTime = localStorage.getItem('simTime') || '00:00';
  const currentMinutes = timeToMinutes(simTime);
  const akutPatients = JSON.parse(localStorage.getItem('akutPatients') || '{}');
  
  console.log(`[updateTriageProgress] Körs för ${selectedHospital}, simTime=${simTime} (${currentMinutes} min)`);
  
  if (!akutPatients[selectedHospital]) return;
  
  let updated = false;
  
  for (let i = 0; i < akutPatients[selectedHospital].length; i++) {
    const patient = akutPatients[selectedHospital][i];
    
    // DEBUG: Logga alla patienter med pending status
    if (patient.triageStatus === 'pending') {
      console.log(`[updateTriageProgress] Patient ${patient.name} i pending: triageStartTime=${patient.triageStartTime}, triageCompletionTime=${patient.triageCompletionTime}, currentMinutes=${currentMinutes}`);
    }
    
    // FALLBACK: Om patient har pending status men saknar completionTime, eller completionTime är långt i det förflutna
    const shouldCompleteTriage = patient.triageStatus === 'pending' && (
      !patient.triageCompletionTime || 
      patient.triageCompletionTime < currentMinutes - 60 ||
      currentMinutes >= patient.triageCompletionTime
    );
    
    if (shouldCompleteTriage) {
      if (!patient.triageCompletionTime || patient.triageCompletionTime < currentMinutes - 60) {
        console.log(`[updateTriageProgress] VARNING: Patient ${patient.name} fastnad i pending (completionTime=${patient.triageCompletionTime}), slutför nu`);
      } else {
        console.log(`[updateTriageProgress] Patient ${patient.name} triage klar (completionTime=${patient.triageCompletionTime}, currentMinutes=${currentMinutes})`);
      }
      
      // Identifiera patienttyp
      const patientType = identifyPatientType(patient);
      
      // Bestäm triagefärg baserat på patienttyp och allvarlighetsgrad
      let triageColor = 'Gul'; // Default
      
      switch (patientType) {
        case 'trauma':
        case 'penetrating':
          triageColor = 'Röd'; // Multitrauma är alltid akut
          break;
        case 'burn':
          triageColor = 'Orange'; // Brännskador är ofta orange
          break;
        case 'cardiac':
          triageColor = Math.random() > 0.5 ? 'Röd' : 'Orange'; // Hjärtinfarkt kan vara röd eller orange
          break;
        case 'neuro':
          triageColor = Math.random() > 0.5 ? 'Röd' : 'Orange'; // Stroke kan vara röd eller orange
          break;
        case 'abdominal':
          triageColor = 'Orange'; // Buksmärta ofta orange
          break;
        case 'fracture':
          triageColor = 'Gul'; // Frakturer ofta gul
          break;
        case 'infection':
          triageColor = Math.random() > 0.7 ? 'Orange' : 'Gul'; // Infektion oftast gul, ibland orange
          break;
        default:
          triageColor = 'Gul';
      }
      
      // Sätt triagefärgen
      if (typeof patient.triage === 'object') {
        patient.triage = { ...patient.triage, emergencyDept: triageColor };
      } else {
        patient.triage = triageColor;
      }
      
      // Generera SBAR
      patient.triageSBAR = generateSBAR(patient, patientType, triageColor);
      patient.triageStatus = 'completed';
      patient.triageCompleted = true;
      
      // Lägg till SBAR i anteckningar
      if (!patient.notes) patient.notes = '';
      const timeStr = minutesToTime(currentMinutes);
      patient.notes = `${timeStr} - Triage genomförd\n${patient.triageSBAR}\n\n${patient.notes}`;
      
      console.log(`[Triage] Triage klar för patient ${patient.name}, färg: ${triageColor}`);
      
      // Uppdatera triagekön - sätt sjuksköterskan som ledig nu
      let triageQueue = JSON.parse(localStorage.getItem('triageQueue') || '{}');
      if (triageQueue[selectedHospital]) {
        triageQueue[selectedHospital].nurseAvailableAt = currentMinutes;
        localStorage.setItem('triageQueue', JSON.stringify(triageQueue));
        console.log(`[Triage] Triagesjuksköterska nu ledig (nurseAvailableAt=${currentMinutes})`);
      }
      
      // Om personal redan är tilldelad, starta vårdflödet nu
      if (patient.doctor || patient.nurse) {
        console.log(`[Triage] Personal redan tilldelad, startar vårdflöde för patient ${patient.name}`);
        // Spara först innan vi startar vårdflödet
        akutPatients[selectedHospital][i] = patient;
        localStorage.setItem('akutPatients', JSON.stringify(akutPatients));
        
        // Starta vårdflöde
        const role = patient.doctor ? 'doctor' : 'nurse';
        startAutomatedCare(patient, i, selectedHospital, role);
      }
      
      updated = true;
    }
  }
  
  if (updated) {
    localStorage.setItem('akutPatients', JSON.stringify(akutPatients));
    window.dispatchEvent(new CustomEvent('storage', { detail: { key: 'akutPatients' } }));
  }
}

// Hjälpfunktioner
export function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}
