const fs = require('fs');
const path = require('path');

const firstNamesBySex = {
  kvinna: [
    'Alma', 'Beata', 'Disa', 'Freja', 'Hilda', 'Julia', 'Klara', 'Maja', 'Olivia', 'Saga',
    'Tilda', 'Vera', 'Ylva', 'Zara', 'Agnes', 'Clara', 'Elin', 'Greta', 'Ida', 'Lilly',
    'Nora', 'Ronja', 'Stina', 'Alicia', 'Astrid', 'Bianca', 'Cecilia', 'Ellen', 'Elsa', 'Emilia',
    'Frida', 'Hanna', 'Helena', 'Iris', 'Juni', 'Linnea', 'Lova', 'Matilda', 'Nova', 'Sigrid',
    'Stella', 'Tove', 'Vilma', 'Amanda', 'Annika', 'Bodil', 'Ester', 'Ingrid', 'Josefin', 'Karin',
    'Märta', 'Moa', 'Petra', 'Selma'
  ],
  man: [
    'Arvid', 'Carl', 'Edvin', 'Gustav', 'Isak', 'Ludvig', 'Nils', 'Pelle', 'Viggo', 'Bertil',
    'David', 'Filip', 'Hugo', 'Joel', 'Malte', 'Otto', 'Tage', 'Anton', 'August', 'Daniel',
    'Ebbe', 'Emil', 'Felix', 'Gabriel', 'Kevin', 'Magnus', 'Milo', 'Noah', 'Olle', 'Rasmus',
    'Simon', 'Sven', 'Valter', 'Viktor', 'Albin', 'Andreas', 'Axel', 'Christian', 'Elis', 'Erik',
    'Hjalmar', 'Johan', 'Lars', 'Melker', 'Niklas'
  ]
};
const lastNames = [
  'Andersson', 'Berg', 'Dahl', 'Ek', 'Forsberg', 'Gran', 'Holm', 'Isaksson', 'Jansson', 'Kallio',
  'Lind', 'Marklund', 'Norberg', 'Olofsson', 'Persson', 'Qvist', 'Rydberg', 'Sundin', 'Viklund', 'Åström',
  'Björk', 'Carlsson', 'Engström', 'Frisk', 'Hedlund', 'Jonsson', 'Lundberg', 'Nyström', 'Sandström', 'Öberg',
  'Boman', 'Edlund', 'Hansson', 'Lindgren', 'Månsson', 'Nordin', 'Sjöberg', 'Ström', 'Wahlberg', 'Åkerman',
  'Ahlström', 'Berglund', 'Blom', 'Bäckström', 'Dahlberg', 'Eklund', 'Ericsson', 'Falk', 'Ferm', 'Granström',
  'Gustafsson', 'Hagström', 'Hammar', 'Hellström', 'Holmqvist', 'Högberg', 'Ivarsson', 'Järvinen', 'Johansson', 'Kvist',
  'Lindholm', 'Lindqvist', 'Lundin', 'Lundström', 'Malm', 'Malmberg', 'Mattsson', 'Norén', 'Nyberg', 'Olsson',
  'Palm', 'Pettersson', 'Rosén', 'Samuelsson', 'Sandberg', 'Sjögren', 'Skoglund', 'Söderberg', 'Söderström', 'Törnqvist',
  'Vallin', 'Westin', 'Widén', 'Åberg', 'Ågren', 'Öhman', 'Östlund', 'Bergman', 'Dahlgren', 'Ekström'
];

const departments = [
  { ward: 'Barnavdelning 2', capacity: 12, mediumFree: 0, category: 'pediatrics', age: [2, 17] },
  { ward: 'Barnavdelning 3', capacity: 11, mediumFree: 5, category: 'pediatrics', age: [1, 17] },
  { ward: 'Barnavdelning 4', capacity: 18, mediumFree: 5, category: 'pediatrics', age: [3, 17] },
  { ward: 'Onkologavdelning CDE', capacity: 18, mediumFree: -3, category: 'oncology', age: [31, 84] },
  { ward: 'Onkologavdelning Hematolog', capacity: 16, mediumFree: -2, category: 'oncology', age: [24, 82] },
  { ward: 'Intensivvårdsavdelning', capacity: 10, mediumFree: 1, category: 'icu', age: [18, 88] },
  { ward: 'Intermediärvårdsavdelning', capacity: 5, mediumFree: 0, category: 'intermediate', age: [20, 88] },
  { ward: 'BB Antenatalavdelning', capacity: 15, mediumFree: -4, category: 'obstetric', age: [19, 43], sex: 'kvinna' },
  { ward: 'Geriatrisk avdelning 1', capacity: 18, mediumFree: 0, category: 'geriatrics', age: [65, 94] },
  { ward: 'Geriatrisk avdelning 4', capacity: 16, mediumFree: 1, category: 'geriatrics', age: [65, 92] },
  { ward: 'Geriatrisk avdelning 2', capacity: 6, mediumFree: 0, category: 'geriatrics', age: [65, 96] },
  { ward: 'Hand- Plastik- Ögon avdelning', capacity: 5, mediumFree: -4, category: 'handPlastic', age: [18, 89] },
  { ward: 'Hjärtintensvvårdsavdelning', capacity: 5, mediumFree: 1, category: 'cardiac', age: [35, 89] },
  { ward: 'Kardiologisk avdelning', capacity: 10, mediumFree: 1, category: 'cardiac', age: [35, 89] },
  { ward: 'Kardiologisk utredningsavdelning', capacity: 8, mediumFree: -5, category: 'cardiac', age: [30, 86] },
  { ward: 'Thoraxavdelning', capacity: 15, mediumFree: -1, category: 'thorax', age: [30, 88] },
  { ward: 'Thorax intermediärvårdsavdelning', capacity: 5, mediumFree: 0, category: 'thoraxIntermediate', age: [30, 88] },
  { ward: 'Thoraxintensiv vårdavdelning', capacity: 12, mediumFree: 1, category: 'thoraxIcu', age: [25, 86] },
  { ward: 'Infektionsavdelning', capacity: 19, mediumFree: 5, category: 'infection', age: [18, 92] },
  { ward: 'Buk och kärlkirurgisk avdelning', capacity: 17, mediumFree: -6, category: 'abdominalSurgery', age: [24, 88] },
  { ward: 'Kirurgisk akutvårdsavdelning', capacity: 10, mediumFree: 0, category: 'acuteSurgery', age: [18, 89] },
  { ward: 'Urologisk och gynekologisk avdelning', capacity: 10, mediumFree: -5, category: 'urology', age: [24, 88] },
  { ward: 'Medicincentrum specialistvårdsavdelning', capacity: 15, mediumFree: -1, category: 'medicine', age: [18, 90] },
  { ward: 'Medicinsk akutvårdsavdelning', capacity: 18, mediumFree: 3, category: 'medicine', age: [18, 91] },
  { ward: 'Hjärt- och ryggmärgsskaderehab', capacity: 9, mediumFree: 1, category: 'cardiacRehab', age: [45, 89] },
  { ward: 'Neuro- och strokerehabilitering', capacity: 5, mediumFree: 1, category: 'neuroRehab', age: [38, 89] },
  { ward: 'Neurokirurgisk intensivvårdsavdelning', capacity: 6, mediumFree: 0, category: 'neuroIcu', age: [20, 87] },
  { ward: 'Neurokirurgisk avdelning', capacity: 12, mediumFree: 0, category: 'neurosurgery', age: [20, 88] },
  { ward: 'Neurologisk avdelning', capacity: 12, mediumFree: -2, category: 'neurology', age: [24, 91] },
  { ward: 'Strokecenter avdelning', capacity: 12, mediumFree: 1, category: 'stroke', age: [40, 92] },
  { ward: 'Öron- näsa- Hals avdelning', capacity: 5, mediumFree: -8, category: 'ent', age: [8, 88] },
  { ward: 'Ortopedavdelning', capacity: 18, mediumFree: -4, category: 'orthopedics', age: [18, 92] }
];

const templates = {
  pediatrics: [
    ['Pediatrik', 'Barn med pneumoni och feber', 'Pneumoni hos barn, antibiotikabehandling'],
    ['Pediatrik', 'Barn med astmaförsämring och andningsbesvär', 'Astmaexacerbation hos barn'],
    ['Pediatrik', 'Barn med gastroenterit och dehydrering', 'Gastroenterit, vätskebehandling'],
    ['Pediatrik', 'Barn med fraktur efter fall', 'Fraktur hos barn, ortopedisk bedömning'],
    ['Pediatrik', 'Barn med diabetesdebut och hyperglykemi', 'Nydebuterad diabetes hos barn']
  ],
  oncology: [
    ['Cancerbehandling', 'Bröstcancer med behandlingsrelaterad trötthet', 'Bröstcancer, planerad cytostatikabehandling'],
    ['Hematologisk cancer', 'Lymfom med feber under behandling', 'Lymfom, neutropen feber'],
    ['Onkologisk sjukdom', 'Kolorektal cancer med buksmärta', 'Kolorektal cancer, nutritions- och smärtbehandling'],
    ['Hematologisk cancer', 'Leukemi med infektionstecken', 'Leukemi, feber och infektionsutredning']
  ],
  obstetric: [
    ['Graviditet', 'Gravid patient med prematura sammandragningar', 'Graviditetskomplikation, observation'],
    ['Förlossning', 'Patient efter förlossning med förhöjt blodtryck', 'Postpartum hypertoni'],
    ['Obstetrik', 'Gravid patient med buksmärta och blödning', 'Graviditetsblödning, övervakning'],
    ['Förlossning', 'Induktion av förlossning på maternell indikation', 'Förlossningsvård, induktion']
  ],
  cardiac: [
    ['Hjärtinfarkt', 'Bröstsmärta med ST-höjning', 'STEMI, övervakning efter PCI'],
    ['Hjärtsvikt', 'Akut försämrad hjärtsvikt med andnöd', 'Hjärtsvikt, intravenös behandling'],
    ['Arytmi', 'Förmaksflimmer med snabb kammarfrekvens', 'Arytmi, frekvensreglering'],
    ['Kardiologi', 'Bröstsmärta med misstanke om instabil angina', 'Instabil angina, telemetriövervakning'],
    ['Hjärtinfarkt', 'NSTEMI med troponinstegring', 'NSTEMI, koronarutredning']
  ],
  thorax: [
    ['Thoraxkirurgi', 'Postoperativ vård efter bypassoperation', 'Bypassoperation, postoperativ övervakning'],
    ['Thoraxkirurgi', 'Aortasjukdom med planerad kärlkirurgisk åtgärd', 'Aortakirurgi, preoperativ utredning'],
    ['Thoraxkirurgi', 'Pleuraeffusion med andningspåverkan', 'Pleuraeffusion, thoraxkirurgisk bedömning']
  ],
  infection: [
    ['Infektion', 'Feber och frossa med misstänkt sepsis', 'Sepsis, intravenös antibiotika'],
    ['Infektion', 'Pneumoni med syrgasbehov', 'Pneumoni, inneliggande behandling'],
    ['Infektion', 'Urinvägsinfektion med feber', 'Febril urinvägsinfektion'],
    ['Infektion', 'Cellulit med tilltagande rodnad', 'Hud- och mjukdelsinfektion']
  ],
  abdominalSurgery: [
    ['Buk- och kärlkirurgi', 'Akut buksmärta med misstänkt appendicit', 'Appendicit, kirurgisk bedömning'],
    ['Kärlkirurgi', 'Symtomgivande aortaaneurysm under utredning', 'Aortasjukdom, kärlkirurgisk övervakning'],
    ['Buk- och kärlkirurgi', 'Gallblåseinflammation med feber', 'Kolecystit, kirurgisk behandling'],

    ['Buk- och kärlkirurgi', 'Tarmobstruktion med buksmärta', 'Ileus, kirurgisk utredning']
  ],
  acuteSurgery: [
    ['Akutkirurgi', 'Buktrauma efter trafikolycka', 'Buktrauma, akut kirurgisk observation'],
    ['Akutkirurgi', 'Akut buksmärta med peritonitretning', 'Akut buk, kirurgisk bedömning'],
    ['Akutkirurgi', 'Postoperativ observation efter akut ingrepp', 'Akutkirurgisk eftervård']
  ],
  urology: [
    ['Urologi', 'Urinretention med smärta över urinblåsan', 'Akut urinretention'],
    ['Urologi', 'Njursten med kolikartad flanksmärta', 'Uretärsten, smärtlindring och observation'],
    ['Urologi', 'Feber och flanksmärta vid pyelonefrit', 'Pyelonefrit, urologisk behandling'],
    ['Gynekologi', 'Gynekologisk blödning med cirkulatorisk påverkan', 'Akut gynekologisk blödning']
  ],
  medicine: [
    ['Internmedicin', 'KOL-försämring med ökat syrgasbehov', 'KOL-exacerbation'],
    ['Internmedicin', 'Diabetes med hyperglykemi', 'Diabetes, metabol kontroll'],
    ['Internmedicin', 'Yrsel med gångsvårigheter', 'Yrsel, medicinsk utredning'],
    ['Internmedicin', 'Anemi med trötthet och andfåddhet', 'Anemi, utredning och behandling']
  ],
  cardiacRehab: [
    ['Hjärtrehabilitering', 'Stabil patient efter hjärtinfarkt, inneliggande rehabilitering', 'Hjärtrehabilitering efter hjärtinfarkt'],
    ['Hjärtrehabilitering', 'Hjärtsvikt efter akut vård, fortsatt rehabilitering', 'Hjärtsviktsrehabilitering'],
    ['Hjärtrehabilitering', 'Rehabilitering efter hjärtkirurgi', 'Postoperativ hjärtrehabilitering']
  ],
  neuroRehab: [
    ['Neurorehabilitering', 'Stroke med kvarstående funktionsnedsättning', 'Stroke, inneliggande neurorehabilitering'],
    ['Neurorehabilitering', 'Ryggmärgsskada med rehabiliteringsbehov', 'Ryggmärgsskada, rehabilitering'],
    ['Neurorehabilitering', 'Förvärvad hjärnskada med rehabiliteringsbehov', 'Hjärnskada, rehabiliteringsplan']
  ],
  neuroIcu: [
    ['Neurointensivvård', 'Hjärnblödning med sjunkande medvetandegrad', 'Intracerebral blödning, neurointensiv övervakning'],
    ['Neurointensivvård', 'Svårt skalltrauma efter fall', 'Skalltrauma, neurointensivvård'],
    ['Neurointensivvård', 'Status epilepticus med behov av intensiv övervakning', 'Status epilepticus, IVA-vård']
  ],
  neurosurgery: [
    ['Neurokirurgi', 'Hjärntumör inför neurokirurgisk behandling', 'Hjärntumör, neurokirurgisk vård'],
    ['Neurokirurgi', 'Subduralhematom efter fall', 'Subduralhematom, neurokirurgisk observation'],
    ['Neurokirurgi', 'Ryggmärgskompression med nytillkommen svaghet', 'Ryggmärgskompression, neurokirurgisk utredning']
  ],
  neurology: [
    ['Neurologi', 'Akut ischemisk stroke med hemipares', 'Ischemisk stroke, neurologisk övervakning'],
    ['Neurologi', 'Epileptiskt anfall med kvarstående förvirring', 'Epilepsi, neurologisk observation'],
    ['Neurologi', 'Multipel skleros med akut skov', 'MS-skov, neurologisk behandling'],
    ['Neurologi', 'Parkinsons sjukdom med akut motorisk försämring', 'Parkinson, läkemedelsjustering']
  ],
  stroke: [
    ['Stroke', 'Cerebral infarkt med afasi', 'Cerebral infarkt, strokeenhetsvård'],
    ['Stroke', 'Stroke med nytillkommen hemipares', 'Stroke, strokeenhetsvård'],
    ['Stroke', 'TIA med behov av fortsatt strokeutredning', 'TIA, fortsatt observation']
  ],
  ent: [
    ['Öron-näsa-hals', 'Peritonsillit med sväljningssvårigheter', 'Peritonsillit, dränage och antibiotika'],
    ['Öron-näsa-hals', 'Epistaxis som krävt tamponad och övervakning', 'Näsblödning, observation'],
    ['Öron-näsa-hals', 'Akut otit med feber och svår öronvärk', 'Akut mediaotit'],
    ['Öron-näsa-hals', 'Larynxödem med heshet och andningspåverkan', 'Larynxödem, luftvägsövervakning']
  ],
  orthopedics: [
    ['Ortopedi', 'Höftfraktur efter fall', 'Höftfraktur, ortopedisk vård'],
    ['Ortopedi', 'Underbensfraktur efter olycka', 'Underbensfraktur, ortopedisk behandling'],
    ['Ortopedi', 'Handledsfraktur med smärta och svullnad', 'Handledsfraktur, ortopedisk bedömning'],
    ['Ortopedi', 'Knäskada med misstänkt ligamentskada', 'Knäskada, ortopedisk utredning']
  ],
  handPlastic: [
    ['Hand- och plastikkirurgi', 'Handfraktur med mjukdelsskada', 'Handskada, plastikkirurgisk bedömning'],
    ['Plastikkirurgi', 'Brännskada i ansikte och hand', 'Brännskada, plastikkirurgisk vård'],
    ['Ögon', 'Ögonskada efter olycka', 'Ögonskada, specialistbedömning']
  ],
  intermediate: [
    ['Intermediärvård', 'Stabiliserad patient med behov av tät övervakning', 'Intermediärvård efter akut behandling'],
    ['Intermediärvård', 'Andningspåverkan med behov av kontinuerlig monitorering', 'Intermediär övervakning'],
    ['Intermediärvård', 'Hjärtsvikt med behov av telemetri', 'Intermediär kardiologisk övervakning']
  ],
  icu: [
    ['Intensivvård', 'Svår sepsis med cirkulatorisk påverkan', 'Sepsis, intensivvård'],
    ['Intensivvård', 'Akut andningssvikt med respiratoriskt stöd', 'Andningssvikt, intensivvård'],
    ['Intensivvård', 'Postoperativ patient med behov av intensiv övervakning', 'Postoperativ intensivvård']
  ]
};

function createPersonnummer(age, serial, referenceDate) {
  let birthYear = referenceDate.getFullYear() - age;
  const month = ((serial * 7) % 12) + 1;
  const day = ((serial * 11) % 27) + 1;
  if (month > referenceDate.getMonth() + 1 || (month === referenceDate.getMonth() + 1 && day > referenceDate.getDate())) birthYear -= 1;
  const date = `${String(birthYear).padStart(4, '0')}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`;
  const birthDate = date.slice(2);
  const serialPart = String(serial % 1000).padStart(3, '0');
  const base = `${birthDate}${serialPart}`;
  let sum = 0;
  for (let index = 0; index < base.length; index += 1) {
    const product = Number(base[index]) * (index % 2 === 0 ? 2 : 1);
    sum += Math.floor(product / 10) + (product % 10);
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return `${date}-${serialPart}${checkDigit}`;
}

function normalizeText(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('sv');
}

function getFirstName(sex, serial) {
  const names = firstNamesBySex[sex] || firstNamesBySex.man;
  return names[(serial - 1) % names.length];
}

function wardCount(department) {
  const mediumPatients = Math.max(0, department.capacity - department.mediumFree);
  return Math.max(Math.ceil(department.capacity * 1.2), mediumPatients + Math.ceil(department.capacity * 0.2));
}

function generatePatients() {
  const today = new Date();
  const patients = [];
  let serial = 1;

  departments.forEach(department => {
    const templates = templatesByCategory[department.category];
    const count = wardCount(department);
    for (let index = 0; index < count; index += 1) {
      const ageRange = department.age;
      const age = ageRange[0] + ((index * 7 + department.ward.length * 3) % (ageRange[1] - ageRange[0] + 1));
      const template = templates[index % templates.length];
      const sex = department.sex || (index % 2 === 0 ? 'kvinna' : 'man');
      const firstName = getFirstName(sex, serial);
      const lastName = lastNames[(serial * 37 + department.ward.length * 17) % lastNames.length];
      const severity = index % 4 === 0;
      const surgeryNeeded = ['acuteSurgery', 'abdominalSurgery', 'neurosurgery'].includes(department.category)
        || (['thorax', 'urology'].includes(department.category) && index % 3 === 0);
      const triage = severity ? 'Röd' : 'Gul';
      const xabcde = {
        X: { Exanguination: '-' },
        A: { airway: department.category.includes('Icu') && severity ? 'Hotad' : 'Fri' },
        B: { AF: severity ? 25 : 17, Sat: severity ? 91 : 97 },
        C: { Puls: severity ? 110 : 82, BT: severity ? '102/64' : '124/78', Bleeding: 'Ingen' },
        D: { GCS: department.category.includes('Icu') && severity ? 11 : 15 },
        E: { Temp: department.category === 'infection' ? 38.2 : 36.8 }
      };
      const sourceId = `SPEC-${department.category.toUpperCase()}-${String(index + 1).padStart(3, '0')}`;

      patients.push({
        id: sourceId,
        name: `${firstName} ${lastName}`,
        sex,
        age,
        personnummer: createPersonnummer(age, serial, today),
        baselineHealth: department.category === 'oncology' ? 'Aktiv cancersjukdom' : department.category === 'cardiac' ? 'Kardiovaskulär sjukdom' : 'I övrigt frisk',
        mechanism: template[0],
        injuryDescription: template[1],
        cause: template[2],
        patientType: department.category,
        triage: { scene: triage, collectionPoint: triage, emergencyDept: triage },
        XABCDE: xabcde,
        ABCDE: xabcde,
        activities: [],
        medications: [],
        interventions: {
          AKM: [],
          Radiology: department.category.includes('neuro') ? 'CT hjärna' : 'Ingen',
          Surgery: surgeryNeeded ? template[2] : 'Ingen'
        },
        medicalHistory: department.category === 'oncology' ? 'Cancersjukdom med pågående specialistbehandling.' : '',
        referral: '',
        team: '',
        timeCritical: {
          avoidableComplicationMinutes: severity ? 30 : 120,
          avoidableDeathMinutes: severity ? 120 : 360
        },
        outcome: {
          opNeeded: surgeryNeeded,
          postOpCare: department.category.toLowerCase().includes('icu') ? 'IVA' : '-',
          ward: department.ward
        }
      });
      serial += 1;
    }
  });

  return patients;
}

const templatesByCategory = {
  pediatrics: [
    ['Pediatrik', 'Barn med pneumoni och feber', 'Pneumoni hos barn, antibiotikabehandling'],
    ['Pediatrik', 'Barn med astmaförsämring och andningsbesvär', 'Astmaexacerbation hos barn'],
    ['Pediatrik', 'Barn med gastroenterit och dehydrering', 'Gastroenterit, vätskebehandling'],
    ['Pediatrik', 'Barn med fraktur efter fall', 'Fraktur hos barn, ortopedisk bedömning']
  ],
  oncology: [
    ['Onkologi', 'Bröstcancer med behandlingsrelaterad trötthet', 'Bröstcancer, cytostatikabehandling'],
    ['Onkologi', 'Lymfom med feber under behandling', 'Lymfom, neutropen feber'],
    ['Onkologi', 'Kolorektal cancer med buksmärta', 'Kolorektal cancer, nutritions- och smärtbehandling'],
    ['Hematologi', 'Leukemi med infektionstecken', 'Leukemi, feber och infektionsutredning']
  ],
  obstetric: [
    ['Obstetrik', 'Gravid patient med prematura sammandragningar', 'Graviditetskomplikation, observation'],
    ['Förlossning', 'Patient efter förlossning med förhöjt blodtryck', 'Postpartum hypertoni'],
    ['Obstetrik', 'Gravid patient med buksmärta och blödning', 'Graviditetsblödning, övervakning']
  ],
  cardiac: [
    ['Kardiologi', 'Bröstsmärta med ST-höjning', 'STEMI, övervakning efter PCI'],
    ['Kardiologi', 'Akut försämrad hjärtsvikt med andnöd', 'Hjärtsvikt, intravenös behandling'],
    ['Kardiologi', 'Förmaksflimmer med snabb kammarfrekvens', 'Arytmi, frekvensreglering'],
    ['Kardiologi', 'Bröstsmärta med misstanke om instabil angina', 'Instabil angina, telemetriövervakning']
  ],
  geriatrics: [
    ['Geriatrik', 'Äldre patient med fall och nedsatt gångförmåga', 'Fallrisk, geriatrisk bedömning'],
    ['Geriatrik', 'Äldre patient med konfusion vid infektion', 'Akut konfusion, geriatrisk utredning'],
    ['Geriatrik', 'Äldre patient med dehydrering och svaghet', 'Dehydrering, geriatrisk behandling'],
    ['Geriatrik', 'Äldre patient med flera samtidiga sjukdomar', 'Multisjuklighet, läkemedelsgenomgång']
  ],
  thorax: [
    ['Thoraxkirurgi', 'Postoperativ vård efter bypassoperation', 'Bypassoperation, postoperativ övervakning'],
    ['Thoraxkirurgi', 'Aortasjukdom med planerad kärlkirurgisk åtgärd', 'Aortakirurgi, preoperativ utredning'],
    ['Thoraxkirurgi', 'Pleuraeffusion med andningspåverkan', 'Pleuraeffusion, thoraxkirurgisk bedömning']
  ],
  thoraxIntermediate: [
    ['Thoraxintermediärvård', 'Stabiliserad efter hjärtkirurgi med behov av telemetri', 'Postoperativ thoraxövervakning'],
    ['Thoraxintermediärvård', 'Hjärtrytmrubbning efter thoraxingrepp', 'Thoraxintermediär, rytmövervakning']
  ],
  thoraxIcu: [
    ['Thoraxintensivvård', 'Kritiskt sjuk efter hjärtkirurgi', 'Postoperativ thoraxintensivvård'],
    ['Thoraxintensivvård', 'Akut cirkulatorisk svikt efter thoraxoperation', 'Thorax-IVA, intensiv övervakning']
  ],
  infection: [
    ['Infektion', 'Feber och frossa med misstänkt sepsis', 'Sepsis, intravenös antibiotika'],
    ['Infektion', 'Pneumoni med syrgasbehov', 'Pneumoni, inneliggande behandling'],
    ['Infektion', 'Urinvägsinfektion med feber', 'Febril urinvägsinfektion']
  ],
  abdominalSurgery: [
    ['Buk- och kärlkirurgi', 'Akut buksmärta med misstänkt appendicit', 'Appendicit, kirurgisk bedömning'],
    ['Kärlkirurgi', 'Symtomgivande aortaaneurysm under utredning', 'Aortasjukdom, kärlkirurgisk övervakning'],
    ['Buk- och kärlkirurgi', 'Gallblåseinflammation med feber', 'Kolecystit, kirurgisk behandling']
  ],
  acuteSurgery: [
    ['Akutkirurgi', 'Buktrauma efter trafikolycka', 'Buktrauma, akut kirurgisk observation'],
    ['Akutkirurgi', 'Akut buksmärta med peritonitretning', 'Akut buk, kirurgisk bedömning']
  ],
  urology: [
    ['Urologi', 'Urinretention med smärta över urinblåsan', 'Akut urinretention'],
    ['Urologi', 'Njursten med kolikartad flanksmärta', 'Uretärsten, smärtlindring och observation'],
    ['Gynekologi', 'Gynekologisk blödning med cirkulatorisk påverkan', 'Akut gynekologisk blödning']
  ],
  medicine: [
    ['Internmedicin', 'KOL-försämring med ökat syrgasbehov', 'KOL-exacerbation'],
    ['Internmedicin', 'Diabetes med hyperglykemi', 'Diabetes, metabol kontroll'],
    ['Internmedicin', 'Yrsel med gångsvårigheter', 'Yrsel, medicinsk utredning']
  ],
  cardiacRehab: [
    ['Hjärtrehabilitering', 'Stabil patient efter hjärtinfarkt, inneliggande rehabilitering', 'Hjärtrehabilitering efter hjärtinfarkt'],
    ['Hjärtrehabilitering', 'Hjärtsvikt efter akut vård, fortsatt rehabilitering', 'Hjärtsviktsrehabilitering']
  ],
  neuroRehab: [
    ['Neurorehabilitering', 'Stroke med kvarstående funktionsnedsättning', 'Stroke, inneliggande neurorehabilitering'],
    ['Neurorehabilitering', 'Ryggmärgsskada med rehabiliteringsbehov', 'Ryggmärgsskada, rehabilitering']
  ],
  neuroIcu: [
    ['Neurointensivvård', 'Hjärnblödning med sjunkande medvetandegrad', 'Intracerebral blödning, neurointensiv övervakning'],
    ['Neurointensivvård', 'Svårt skalltrauma efter fall', 'Skalltrauma, neurointensivvård']
  ],
  neurosurgery: [
    ['Neurokirurgi', 'Hjärntumör inför neurokirurgisk behandling', 'Hjärntumör, neurokirurgisk vård'],
    ['Neurokirurgi', 'Subduralhematom efter fall', 'Subduralhematom, neurokirurgisk observation']
  ],
  neurology: [
    ['Neurologi', 'Akut ischemisk stroke med hemipares', 'Ischemisk stroke, neurologisk övervakning'],
    ['Neurologi', 'Epileptiskt anfall med kvarstående förvirring', 'Epilepsi, neurologisk observation'],
    ['Neurologi', 'Multipel skleros med akut skov', 'MS-skov, neurologisk behandling']
  ],
  stroke: [
    ['Stroke', 'Cerebral infarkt med afasi', 'Cerebral infarkt, strokeenhetsvård'],
    ['Stroke', 'Stroke med nytillkommen hemipares', 'Stroke, strokeenhetsvård']
  ],
  ent: [
    ['Öron-näsa-hals', 'Peritonsillit med sväljningssvårigheter', 'Peritonsillit, dränage och antibiotika'],
    ['Öron-näsa-hals', 'Epistaxis som krävt tamponad och övervakning', 'Näsblödning, observation'],
    ['Öron-näsa-hals', 'Akut otit med feber och svår öronvärk', 'Akut mediaotit']
  ],
  orthopedics: [
    ['Ortopedi', 'Höftfraktur efter fall', 'Höftfraktur, ortopedisk vård'],
    ['Ortopedi', 'Underbensfraktur efter olycka', 'Underbensfraktur, ortopedisk behandling'],
    ['Ortopedi', 'Handledsfraktur med smärta och svullnad', 'Handledsfraktur, ortopedisk bedömning']
  ],
  handPlastic: [
    ['Hand- och plastikkirurgi', 'Handfraktur med mjukdelsskada', 'Handskada, plastikkirurgisk bedömning'],
    ['Plastikkirurgi', 'Brännskada i ansikte och hand', 'Brännskada, plastikkirurgisk vård']
  ],
  intermediate: [
    ['Intermediärvård', 'Stabiliserad patient med behov av tät övervakning', 'Intermediärvård efter akut behandling'],
    ['Intermediärvård', 'Andningspåverkan med behov av kontinuerlig monitorering', 'Intermediär övervakning']
  ],
  icu: [
    ['Intensivvård', 'Svår sepsis med cirkulatorisk påverkan', 'Sepsis, intensivvård'],
    ['Intensivvård', 'Akut andningssvikt med respiratoriskt stöd', 'Andningssvikt, intensivvård']
  ]
};

function checksum(baseDigits) {
  let sum = 0;
  for (let index = 0; index < baseDigits.length; index += 1) {
    const product = Number(baseDigits[index]) * (index % 2 === 0 ? 2 : 1);
    sum += Math.floor(product / 10) + (product % 10);
  }
  return String((10 - (sum % 10)) % 10);
}

function generatePersonnummer(age, serial, today) {
  let birthYear = today.getFullYear() - age;
  const month = (serial % 12) + 1;
  const day = (serial % 27) + 1;
  if (month > today.getMonth() + 1 || (month === today.getMonth() + 1 && day > today.getDate())) birthYear -= 1;
  const date = `${String(birthYear).padStart(4, '0')}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`;
  const serialNumber = String(serial).padStart(3, '0').slice(-3);
  const base = `${date.slice(2)}${serialNumber}`;
  return `${date}-${serialNumber}${checksum(base)}`;
}

function generateDepartmentPatients() {
  const today = new Date();
  let serial = 1;
  const patients = [];

  for (const department of departments) {
    const count = Math.max(
      Math.ceil(department.capacity * 1.2),
      Math.max(0, department.capacity - department.mediumFree) + Math.ceil(department.capacity * 0.2)
    );
    const departmentTemplates = templatesByCategory[department.category];

    for (let index = 0; index < count; index += 1) {
      const [mechanism, injuryDescription, cause] = departmentTemplates[index % departmentTemplates.length];
      const age = department.age[0] + ((index * 7 + department.ward.length * 3) % (department.age[1] - department.age[0] + 1));
      const sex = department.sex || (index % 2 === 0 ? 'kvinna' : 'man');
      const firstName = getFirstName(sex, serial);
      const lastName = lastNames[(serial * 37 + department.ward.length * 17) % lastNames.length];
      const severe = index % 4 === 0;
      const surgeryNeeded = ['acuteSurgery', 'abdominalSurgery', 'neurosurgery', 'thorax', 'urology'].includes(department.category) && index % 3 === 0;
      const triage = severe ? 'Röd' : 'Gul';
      const xabcde = {
        X: { Exanguination: '-' },
        A: { airway: department.category.toLowerCase().includes('icu') && severe ? 'Hotad' : 'Fri' },
        B: { AF: severe ? 25 : 17, Sat: severe ? 91 : 97 },
        C: { Puls: severe ? 110 : 82, BT: severe ? '102/64' : '124/78', Bleeding: 'Ingen' },
        D: { GCS: department.category.toLowerCase().includes('icu') && severe ? 11 : 15 },
        E: { Temp: department.category === 'infection' ? 38.2 : 36.8 }
      };

      patients.push({
        id: `SPEC-${String(serial).padStart(5, '0')}`,
        name: `${firstName} ${lastName}`,
        sex,
        age,
        personnummer: generatePersonnummer(age, serial, today),
        baselineHealth: department.category === 'oncology' ? 'Aktiv cancersjukdom' : department.category === 'cardiac' ? 'Kardiovaskulär sjukdom' : 'I övrigt frisk',
        mechanism,
        injuryDescription,
        cause,
        patientType: department.category,
        triage: { scene: triage, collectionPoint: triage, emergencyDept: triage },
        XABCDE: xabcde,
        ABCDE: xabcde,
        activities: [],
        medications: [],
        interventions: {
          AKM: [],
          Radiology: department.category.toLowerCase().includes('neuro') ? 'CT hjärna' : 'Ingen',
          Surgery: surgeryNeeded ? cause : 'Ingen'
        },
        medicalHistory: department.category === 'oncology' ? 'Aktiv cancersjukdom med specialistuppföljning.' : '',
        referral: '',
        team: '',
        timeCritical: {
          avoidableComplicationMinutes: severe ? 30 : 120,
          avoidableDeathMinutes: severe ? 120 : 360
        },
        outcome: {
          opNeeded: surgeryNeeded,
          postOpCare: department.category.toLowerCase().includes('icu') ? 'IVA' : '-',
          ward: department.ward
        }
      });
      serial += 1;
    }
  }

  return patients;
}

const output = path.join(__dirname, 'frontend', 'public', 'patients_department_specialties.json');
const patients = generateDepartmentPatients();
fs.writeFileSync(output, `${JSON.stringify(patients, null, 2)}\n`, 'utf8');
console.log(`Wrote ${patients.length} department-specific patients to ${output}`);
