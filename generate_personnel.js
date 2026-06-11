
const crypto = require('crypto');

const categories = [
  { key: "AL", name: "Akutläkare" },
  { key: "ANL", name: "Anestesiläkare" },
  { key: "ORT", name: "Ortopeder" },
  { key: "KIR", name: "Kirurger" },
  { key: "NSK", name: "Narkossköterskor" },
  { key: "USO", name: "Undersköterskor operation" },
  { key: "OSK", name: "Operationssköterskor" },
  { key: "ASK", name: "Akutsjuksköterskor" },
  { key: "USA", name: "Undersköterskor akuten" },
  { key: "IVS", name: "IVA-sköterskor" },
  { key: "AVS", name: "Avdelningssköterskor" },
  { key: "USI", name: "Undersköterskor IVA" },
  { key: "USV", name: "Undersköterskor avdelning" }
];

const firstNames = [
  "Anna", "Erik", "Maria", "Lars", "Karin", "Johan", "Eva", "Peter", "Lena", "Stefan",
  "Kerstin", "Anders", "Margareta", "Thomas", "Birgitta", "Jan", "Ingrid", "Mikael", "Gunilla", "Mats",
  "Elisabeth", "Bengt", "Christina", "Göran", "Marianne", "Björn", "Anita", "Håkan", "Inger", "Christer",
  "Kristina", "Ulf", "Monica", "Sven", "Ulla", "Lennart", "Barbro", "Rolf", "Agneta", "Leif",
  "Ann-Marie", "Kjell", "Berit", "Nils", "Britt", "Per", "Inga", "Bo", "Sonja", "Magnus",
  "Gunnel", "Åke", "Birgit", "Stig", "Maj", "Kurt", "Elsa", "Bertil", "Astrid", "Sune",
  "Siv", "Olle", "Elin", "Martin", "Sofia", "Daniel", "Emma", "David", "Sara", "Oskar",
  "Linda", "Andreas", "Jessica", "Mattias", "Malin", "Fredrik", "Hanna", "Jonas", "Josefin", "Henrik",
  "Amanda", "Niklas", "Emelie", "Patrik", "Ida", "Marcus", "Johanna", "Sebastian", "Rebecka", "Alexander",
  "Elin", "Filip", "Julia", "Gustav", "Sandra", "Viktor", "Madeleine", "Emil", "Victoria", "Adam"
];

const lastNames = [
  "Andersson", "Eriksson", "Larsson", "Nilsson", "Persson", "Johansson", "Karlsson", "Svensson", "Gustafsson", "Pettersson",
  "Olsson", "Berg", "Lindberg", "Lundgren", "Åberg", "Ström", "Wallin", "Björk", "Holm", "Lindström",
  "Forsberg", "Sundberg", "Sandberg", "Fransson", "Henriksson", "Sjöberg", "Danielsson", "Håkansson", "Engström", "Lind",
  "Lundqvist", "Eklund", "Holmberg", "Nyström", "Claesson", "Nordin", "Månsson", "Lundström", "Viklund", "Isaksson",
  "Blomqvist", "Söderberg", "Nordström", "Edlund", "Martinsson", "Holmgren", "Strömberg", "Samuelsson", "Lundberg", "Nyberg",
  "Mårtensson", "Bergström", "Björklund", "Åkesson", "Berglund", "Jakobsson", "Bergman", "Axelsson", "Carlsson", "Lundgren",
  "Olofsson", "Lindgren", "Magnusson", "Hansson", "Jansson", "Johnsson", "Bengtsson", "Jönsson", "Gustavsson", "Jonasson",
  "Sjögren", "Hedlund", "Arvidsson", "Gunnarsson", "Erlandsson", "Öberg", "Holmqvist", "Berggren", "Sandström", "Lund",
  "Mattsson", "Falk", "Lundberg", "Hedberg", "Strand", "Malmberg", "Hellström", "Malmström", "Boström", "Dahlberg",
  "Lindqvist", "Fredriksson", "Sundström", "Ek", "Söderström", "Dahl", "Åström", "Linder", "Norberg", "Andreasson"
];

function getRandomInt(max) {
  return crypto.randomInt(0, max);
}
function getRandomName(used) {
  let first, last, key;
  let tries = 0;
  do {
    first = firstNames[getRandomInt(firstNames.length)];
    last = lastNames[getRandomInt(lastNames.length)];
    key = first + ' ' + last;
    tries++;
  } while (used.has(key) && tries < 1000);
  used.add(key);
  return { firstName: first, lastName: last };
}


// Läs antal per kategori från process.argv eller default 50
let categoryCounts = {};
try {
  if (process.argv[2]) {
    categoryCounts = JSON.parse(process.argv[2]);
  }
} catch (e) {
  categoryCounts = {};
}

const personnel = [];
for (const category of categories) {
  const count = categoryCounts[category.name] || 50;
  const usedNames = new Set();
  for (let i = 1; i <= count; i++) {
    const { firstName, lastName } = getRandomName(usedNames);
    const paddedNum = String(i).padStart(3, '0');
    personnel.push({
      id: `${category.key}-${paddedNum}`,
      firstName,
      lastName,
      category: category.name,
      status: "available"
    });
  }
}

const fs = require('fs');
const output = {
  personnel: personnel
};

fs.writeFileSync('frontend/public/hospital_personnel.json', JSON.stringify(output, null, 2), 'utf8');
console.log(`Genererade ${personnel.length} personer i ${categories.length} kategorier`);
console.log('Sparad till: frontend/public/hospital_personnel.json');
