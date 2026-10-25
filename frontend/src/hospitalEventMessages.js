import { addSimulationMinutes, elapsedSimulationMinutes } from './simulationTime.js';

const FIRST_REPORT_START_MINUTE = 5;
const FIRST_REPORT_END_MINUTE = 50;
export const MAX_EVENT_MESSAGES_PER_SIM_MINUTE = 3;

const RESPONSE_STYLES = [
  'Verksamheten lämnar en samlad lägesbild.',
  'Uppgifterna är preliminära och kompletteras vid nästa kontakt.',
  'Verksamheten efterfrågar tydlig prioritering från LSSL.'
];

const OPERATIONAL_RESPONSE_VARIANTS = {
  'power-outage': {
    critical: [
      ['Nätelen är borta. Endast blå UPS-uttag fungerar; reservkraftsproduktionen har inte startat. Patientnära utrustning kontrolleras.', 'Kritiska vårdmiljöer försörjs just nu bara via blå UPS-uttag. Ingen reservkraftsproduktion är inkopplad.'],
      ['Utrustning kopplas vid behov till blå UPS-uttag. Batterier och återstående UPS-uthållighet inventeras; övriga uttag saknar ström.', 'Personal kontrollerar vilka apparater som sitter i blå uttag. Reservkraften är fortfarande inte aktiverad.'],
      ['UPS-uthållighet och vilka patienter som är beroende av blå uttag rapporteras till LSSL. Besked om eventuell start av reservkraft efterfrågas.', 'LSSL får en lägesbild över blå UPS-uttag, batteritider och behov av att starta sjukhusets egen kraftproduktion.'],
      ['Om UPS-tiden tar slut innan reservkraften startas påverkas utrustning utanför blå uttag. Förflyttning bedöms individuellt.', 'Fortsatt drift kräver att UPS-uthålligheten räcker eller att LSSL beslutar om reservkraft och verifierad övergång.']
    ],
    ward: [
      ['Nätelen är borta. Endast blå UPS-uttag fungerar; reservkraften har inte startat. Patientutrustning kontrolleras.', 'Personal kontrollerar vilka patientplatser som har blå UPS-uttag. Vanliga uttag saknar ström och reservkraften är inte inkopplad.'],
      ['Batterier och blå UPS-uttag inventeras. Icke-kritisk utrustning begränsas.', 'Patienter med elberoende utrustning identifieras; batteribehov och UPS-uthållighet rapporteras.'],
      ['LSSL behöver ge besked om prognos och eventuell omfördelning av patienter.', 'Vårdplatser och säkra förflyttningsvägar ses över inför ett längre avbrott.'],
      ['Avdelningen kan fortsätta med reducerad funktion så länge blå UPS-uttag räcker. Reservkraft måste startas separat.', 'Planerad verksamhet begränsas tills reservkraft har startats och elförsörjningen verifierats.']
    ],
    outpatient: [
      ['Nätelen är borta. Endast blå UPS-uttag fungerar; reservkraften har inte startat. Elberoende moment säkras.', 'Mottagningen kontrollerar blå UPS-uttag. Vanliga uttag fungerar inte och reservkraft är ännu inte inkopplad.'],
      ['Pågående besök avslutas säkert. Icke-akuta tider börjar bokas om.', 'Personal går igenom dagens patienter och skiljer tidskritiska kontakter från besök som kan flyttas.'],
      ['LSSL behöver besked om återställningstid innan nya patienter kallas.', 'Mottagningen rapporterar vilka behandlingar som kräver stabil el och hur många patienter som påverkas.'],
      ['Planerad verksamhet hålls reducerad tills reservkraft har startats och lokalerna verifierats.', 'Endast prioriterade kontakter planeras medan blå UPS-uttag är den enda aktiva elkällan.']
    ],
    emergency: [
      ['Nätelen är borta. Endast blå UPS-uttag fungerar; reservkraften har inte startat. Akuten kontrollerar kritisk utrustning.', 'Akuten identifierar patientutrustning på blå UPS-uttag. Vanliga uttag saknar ström i väntan på eventuell reservkraft.'],
      ['Icke-kritisk verksamhet begränsas och flödet anpassas till de ytor som har fungerande el.', 'Patientflödet styrs om från påverkade rum. LSSL får en lista över kritiska elbehov.'],
      ['Prognos för el och stöd från fastighet efterfrågas; extra inflöde kan inte tas emot oförändrat.', 'Akuten behöver beslut om prioritering, reservutrymmen och förstärkning om avbrottet fortsätter.'],
      ['Akut uppdrag fortsätter med reducerad kapacitet så länge UPS-uttag och batterier räcker.', 'Nya patienter prioriteras; reservkraft behöver startas och verifieras innan normal kapacitet återtas.']
    ],
    diagnostics: [
      ['Nätelen är borta. Endast blå UPS-uttag fungerar; reservkraften har inte startat. Elberoende utrustning säkras.', 'Bild- och laboratorieutrustning kontrolleras: vanliga uttag saknar ström, blå UPS-uttag fungerar.'],
      ['Akuta analyser och undersökningar prioriteras; planerade flöden pausas.', 'UPS-uttag, provförvaring och utrustningens säkra avstängning inventeras.'],
      ['LSSL behöver besked om teknisk återstart och vilka analyser som kan utföras.', 'Verksamheten rapporterar kapacitet under reservdrift och kritiska beroenden.'],
      ['Akut diagnostik återupptas i ordinarie omfattning först när reservkraft har startats och utrustningen kontrollerats.', 'Reducerad produktion fortsätter medan blå UPS-uttag är den enda aktiva elkällan.']
    ]
  },
  'it-outage': {
    critical: [
      ['Patientidentifiering och ordinationer verifieras med reservrutiner. Kritiska infusioner och övervakning dubbelkontrolleras.', 'Personal går över till pappersdokumentation. Patientidentitet, läkemedel och kritiska ordinationer stäms av manuellt.'],
      ['Aktuella läkemedel, allergier och behandlingsplaner sammanställs där åtkomst finns; saknade uppgifter markeras.', 'Överlämningar sker muntligt med skriftlig kvittens. Dubbelkontroll inför läkemedel och kritiska åtgärder förstärks.'],
      ['LSSL behöver besked om systemprognos och gemensam reservrutin för dokumentation och provsvar.', 'Kritisk information som saknas rapporteras. En prioriterad kanal för akuta ordinationer efterfrågas.'],
      ['Vården fortsätter med reservjournal och tydlig överlämning tills systemen är verifierat återställda.', 'Pappersunderlag säkras för senare registrering; återgång sker först efter gemensamt klartecken.']
    ],
    ward: [
      ['Journalsystemet är otillgängligt. Avdelningen tar fram patientlista, läkemedelsunderlag och pappersjournal.', 'Rapportering sker på reservblanketter. Patientidentitet och aktuella ordinationer kontrolleras manuellt.'],
      ['Läkemedelslistor och provsvar dubbelkontrolleras via tillgängliga reservvägar.', 'Överlämningar dokumenteras på papper och ansvarig personal kvitterar utförda moment.'],
      ['Avdelningen behöver gemensam instruktion om dokumentation, provsvar och kontakt med andra enheter.', 'LSSL efterfrågas om systemprognos och hur externa remisser ska hanteras.'],
      ['Slutenvården fortsätter med pappersrutiner. Efterregistrering planeras när systemet är säkert tillgängligt.', 'Nya planerade aktiviteter begränsas om patientinformation inte kan verifieras.']
    ],
    outpatient: [
      ['Mottagningen kan inte läsa ordinarie journaler. Patienter på plats identifieras och tidskritiska besök sorteras.', 'Personal går över till reservlista och pappersanteckningar; patienter informeras om fördröjningar.'],
      ['Icke-akuta besök bokas om. Akuta kontakter hanteras via verifierad reservrutin.', 'Tidbokning och remissflöde stäms av manuellt där det är möjligt.'],
      ['Mottagningen behöver besked om systemprognos och gemensam väg för provsvar och remisser.', 'LSSL efterfrågas om vilka patientkontakter som ska prioriteras.'],
      ['Verksamheten förblir reducerad tills journalåtkomst och bokningsdata är kontrollerade.', 'Ombokningar och pappersunderlag samlas för säker efterregistrering.']
    ],
    emergency: [
      ['Akuten går över till manuell registrering och identifiering. Triage och kritiska ordinationer dokumenteras på reservblanketter.', 'Patientflödet hålls igång med pappersbaserad triage och tydliga muntliga överlämningar.'],
      ['Provsvar, remisser och läkemedelsuppgifter verifieras via alternativa kontaktvägar.', 'En samlad manuell patientlista upprättas för att minska risken för dubbelregistrering.'],
      ['LSSL behöver samordna informationsvägar till laboratorier, röntgen och vårdavdelningar.', 'Akuten rapporterar väntande kritiska provsvar och behov av systemstöd.'],
      ['Akut verksamhet fortsätter med pappersrutiner; planerat flöde hålls nere tills systemen är stabila.', 'Efterregistrering planeras efter kontrollerad återstart och avstämning av patientlistor.']
    ],
    diagnostics: [
      ['Beställningar och svar hanteras på reservblanketter. Akuta prover och undersökningar prioriteras.', 'Verksamheten säkrar prov-ID och manuell svarskanal innan nya beställningar tas emot.'],
      ['Resultat kommuniceras direkt till ansvarig enhet och kvitteras manuellt.', 'Planerade analyser och undersökningar begränsas om remiss- eller journalsamband inte kan verifieras.'],
      ['LSSL behöver prioritera kritiska analyser, bilddiagnostik och extern informationsöverföring.', 'Provsvarskö och kapacitet sammanställs för gemensam lägesbild.'],
      ['Akut diagnostik fortsätter i reducerad reservdrift tills systemen är testade.', 'Pappersunderlag arkiveras för efterregistrering och kontroll vid återstart.']
    ]
  },
  'oxygen-disruption': {
    critical: [
      ['Patienter med högst syrgas- och ventilationsbehov identifieras. Tillgängliga uttag och tuber kontrolleras.', 'Syrgasbehov prioriteras patient för patient. Reservtuber och återstående försörjning inventeras.'],
      ['Förbrukning och reservkapacitet följs tätt. Icke-kritisk användning omprövas av ansvarig kliniker.', 'Personal rapporterar patienternas behov, reservtuber och beräknad uthållighet till LSSL.'],
      ['Prioriterad påfyllning och prognos behövs. Flytt av svårflyttade patienter kräver samordnat beslut.', 'LSSL efterfrågas om transport- och mottagningsalternativ om lokal försörjning försämras.'],
      ['Kritisk vård kan fortsätta om leverans och personal säkras. Förflyttning planeras endast som beslutat omfall.', 'Nya inläggningar med stort syrgasbehov måste vägas mot bekräftad kapacitet och regionalt stöd.']
    ],
    ward: [
      ['Patienter med syrgasbehov identifieras. Portabla tuber, flöden och anslutningar inventeras.', 'Avdelningen sammanställer syrgasbehov och kontrollerar att reservutrustning är tillgänglig.'],
      ['Förbrukning följs och patienternas ordinerade behov dubbelkontrolleras av vårdteamet.', 'Portabla lösningar reserveras för patienter som behöver förflyttas eller saknar fungerande uttag.'],
      ['LSSL behöver besked om leveranstid, prioritering och möjlighet att förstärka försörjningen.', 'Avdelningen rapporterar uthållighet och vilka patienter som påverkas om leverans uteblir.'],
      ['Vården fortsätter enligt klinisk prioritering om syrgasleverans säkras.', 'Nya planerade inläggningar med syrgasbehov begränsas tills kapaciteten är bekräftad.']
    ],
    outpatient: [
      ['Patienter med planerad syrgas eller syrgasberoende behandling identifieras och bedöms individuellt.', 'Mottagningen kontrollerar utrustning och förbrukning innan syrgasberoende besök genomförs.'],
      ['Icke-akuta behandlingar med stort syrgasbehov bokas om efter klinisk bedömning.', 'Patienter på plats får besked om väntan och alternativa tider; akut behov hänvisas enligt lokal rutin.'],
      ['Verksamheten behöver besked om leveransprognos och prioriterade patientgrupper.', 'LSSL efterfrågas om gemensam hänvisningsväg för syrgasberoende patienter.'],
      ['Planerad verksamhet förblir reducerad tills försörjningen är stabil.', 'Akuta undantag hanteras efter individuell klinisk bedömning och tillgänglig kapacitet.']
    ],
    emergency: [
      ['Akuten inventerar syrgasuttag, portabla tuber och patienter med pågående syrgasbehandling.', 'Patienter med andningspåverkan prioriteras; tillgängliga syrgasresurser och reservflöden kontrolleras.'],
      ['Förbrukning följs och patienter sorteras efter kliniskt behov. Försörjningen rapporteras till LSSL.', 'Akuten behöver en gemensam prioritering för tuber, uttag och eventuella inkommande patienter.'],
      ['LSSL behöver samordna leverans, transportkapacitet och mottagande enheter.', 'Prognos för inflöde och syrgasförbrukning efterfrågas för kommande timmar.'],
      ['Akutflödet fortsätter med prioritering och regelbunden rapportering av kapacitet.', 'Patienter med stort syrgasbehov hänvisas eller flyttas endast efter medicinskt och logistiskt beslut.']
    ],
    diagnostics: [
      ['Syrgasberoende undersökningar och utrustning inventeras. Akuta undersökningar prioriteras.', 'Berörda tekniska system kontrolleras och planerade syrgasberoende undersökningar pausas vid osäker försörjning.'],
      ['Patienter och mottagande enheter informeras om begränsad kapacitet.', 'Teknisk personal sammanställer utrustningsbehov och möjliga reservlösningar.'],
      ['LSSL behöver prioritera diagnostik med direkt betydelse för akut behandling.', 'Leveransprognos och transport av syrgasutrustning efterfrågas.'],
      ['Akut diagnostik fortsätter i reducerad omfattning om försörjningen är säker.', 'Planerad produktion återupptas först när teknisk kapacitet är bekräftad.']
    ]
  },
  custom: {
    critical: [
      ['Kritiska patientberoenden inventeras och verksamheten rapporterar omedelbar påverkan till LSSL.', 'Patienter med störst risk prioriteras medan enheten fastställer vilka funktioner som påverkas.'],
      ['Reservrutiner aktiveras där det är möjligt. Personal, material och beroenden sammanställs.', 'Enheten rapporterar förändringar i patientläge och vilka resurser som snabbt kan ta slut.'],
      ['LSSL behöver besluta om prioritering, förstärkning och eventuell omfördelning.', 'Prognos och tydligt beslut om nästa åtgärd efterfrågas.'],
      ['Minsta säkra drift planeras för nästa period. Kvarstående risker rapporteras till LSSL.', 'Fortsatt verksamhet villkoras av säkrad bemanning, resurser och tydliga besked.']
    ],
    ward: [
      ['Avdelningen inventerar patientpåverkan och vilka vårdmoment som behöver ändras.', 'Patienter och personal informeras. Lokala resurser och omedelbara risker sammanställs.'],
      ['Vården prioriteras efter behov. Planerade moment ses över och reservrutiner används.', 'Enheten rapporterar vilka patienter som behöver extra tillsyn eller samordning.'],
      ['LSSL får besked om konkret hjälpbehov, uthållighet och möjliga omfall.', 'Resursläget sammanställs inför beslut om fortsatt drift.'],
      ['Minsta säkra verksamhet planeras. Utskrivning eller flytt föreslås bara efter individuell bedömning.', 'Avdelningen fortsätter enligt LSSL:s prioritering och rapporterar förändringar.']
    ],
    outpatient: [
      ['Mottagningen identifierar patienter på plats och bedömer vilka besök som påverkas.', 'Patienter informeras och tidskritiska kontakter skiljs från besök som kan bokas om.'],
      ['Planerad verksamhet begränsas efter patient- och resursbedömning.', 'Mottagningen sammanställer ombokningar, patientkontakter och behov av alternativ hänvisning.'],
      ['LSSL efterfrågas om prioritering och gemensamt informationsbudskap.', 'Verksamheten rapporterar resursbehov och vilka kontakter som inte kan anstå.'],
      ['Reducerad drift fortsätter enligt beslutad prioritering. Återstart planeras när förutsättningarna är klara.', 'Patienter som bokas om får en gemensam hänvisningsväg och tid för nästa uppdatering.']
    ],
    emergency: [
      ['Akuten bedömer påverkan på patientflöde, kritiska resurser och pågående vård.', 'Triage och patientinformation anpassas till händelsen; påverkan rapporteras till LSSL.'],
      ['Kapacitet och väntande patienter sammanställs. Icke-akuta flöden kan behöva styras om.', 'Akuten efterfrågar samordning med berörda avdelningar och mottagningar.'],
      ['LSSL behöver besluta om prioritering, resursstöd och extern hänvisning.', 'Prognos för inflöde och kapacitet begärs.'],
      ['Akut uppdrag fortsätter enligt beslutad prioritering med återkommande lägesrapport.', 'Eventuella begränsningar kommuniceras tydligt till patienter och samverkansparter.']
    ],
    diagnostics: [
      ['Påverkade processer identifieras. Akuta analyser och undersökningar prioriteras.', 'Utrustning, provflöden och beroenden kontrolleras innan fortsatt produktion.'],
      ['Planerade flöden begränsas vid behov. Akuta resultat hanteras via beslutad reservväg.', 'Tekniskt och operativt resursläge rapporteras till LSSL.'],
      ['LSSL behöver ange vilka analyser och undersökningar som ska prioriteras.', 'Prognos och eventuellt behov av extern kapacitet efterfrågas.'],
      ['Akut diagnostik fortsätter om säker drift kan upprätthållas.', 'Återgång till full produktion sker när ansvarig funktion bekräftat förutsättningarna.']
    ]
  }
};

const CLINIC_PROFILE_VARIANTS = {
  alertUnsure: ['alertUnsure', 'alertUnclear', 'alertPrepared'],
  alertUnclear: ['alertUnclear', 'alertLate', 'alertUnsure'],
  alertLate: ['alertLate', 'alertUnclear', 'alertPrepared'],
  alertPrepared: ['alertPrepared', 'alertUnsure', 'alertLate']
};

const RESPONSE_PROFILES = {
  childWard: [
    'Kranvattnet är stoppat. Ett barn med underliggande sjukdom har diarré. Vatten till dryck, läkemedel, sondmatning och munvård inventeras.',
    'Flera barn kan inte försörja sig själva. Ett barn behöver extra vätskeövervakning. Bemanningen är oförändrad.',
    'Lokalt vatten räcker kort tid. Prioriterad leverans och besked om sondnäring, läkemedel och hygien behövs.',
    'Vården kan fortsätta ett dygn om vatten levereras. Barn med dehydrationsrisk och stora omvårdnadsbehov prioriteras.'
  ],
  neonatal: [
    'Kranvatten är stoppat och förpackat vatten säkrat. Inga omfattande symtom, men patienterna har små marginaler.',
    'Säkert vatten behövs till läkemedel, nutrition, munvård och hygien. Flera patienter är svårflyttade.',
    'Vattenlagret minskar. Regelbunden prioriterad leverans och säkra rutiner för näringsberedning behövs.',
    'Verksamheten måste prioriteras för nästa dygn. Förflyttning är endast omfall för enstaka patienter.'
  ],
  cancerWard: [
    'Avbrottsplanen är aktiverad. Patienterna är informerade. En immunsupprimerad patient har diarré men är stabil.',
    'Vatten ransoneras och engångsmaterial används. Behov finns till dryck, läkemedel, munvård och hygien.',
    'Lokalt vatten räcker inte ett dygn. Tilldelad volym och leveranstid behövs.',
    'Nödvändig vård kan fortsätta vid leverans. Vid försening prioriteras utskrivningar och nya inläggningar begränsas.'
  ],
  hematologyWard: [
    'Kranvatten är stoppat. Produkter som kan ha beretts med vatten inventeras.',
    'Få symtomatiska patienter. Huvudrisken är immunsuppression och behov av säker hygien.',
    'Dunkvatten, engångsmaterial och gemensamt hygienbesked behövs.',
    'Slutenvården fortsätter begränsat. Icke-akut mottagnings- och behandlingsverksamhet är inställd.'
  ],
  intensiveCare: [
    'Kranvatten är stoppat. Patienterna är omhändertagna. Flera är mycket svåra att flytta.',
    'Ett mindre antal patienter har GI-symtom. Vatten, engångsmaterial och bemanning inventeras via ANOPIVA.',
    'Lokalt lager minskar. ANOPIVA behöver bekräftad prioriterad leverans och volym.',
    'IVA kan fortsätta ett dygn om vatten och personal säkras. Förflyttning är ett senare omfall.'
  ],
  neuroIntensiveCare: [
    'Kranvatten är stoppat. Flera patienter kan inte rapportera symtom och är mycket svåra att flytta.',
    'En patient har diarré. Samband är oklart. Extra övervakning och omvårdnad pågår.',
    'Lokalt vatten minskar. Prioriterad leverans enligt intensivvårdsbehov behövs.',
    'Kan fortsätta ett dygn om vatten och personal säkras. Flytt kräver regional planering och specialtransport.'
  ],
  intermediateCare: [
    'Vattenanvändningen är stoppad. Ingen patient har allvarliga GI-symtom.',
    'Kontinuerligt vattenbehov finns. Vid försämring kan patienter behöva IVA.',
    'ANOPIVA behöver inkludera intermediärvårdens vatten- och bemanningsbehov.',
    'Vid resursbrist krävs omfördelning mellan intermediärvård, IVA och vårdavdelning.'
  ],
  obstetricWard: [
    'Kranvattnet används inte. Inga omfattande symtom. En medarbetare har gått hem med magsjukesymtom.',
    'Vatten behövs till patienter, läkemedel, munvård och hygien. Planerade inskrivningar bedöms.',
    'Lokalt förråd är begränsat. Leveransbesked och gemensam patientinformation behövs.',
    'Inneliggande kan vårdas ett dygn vid leverans. Nya icke-akuta inskrivningar begränsas.'
  ],
  geriatricsWard: [
    'Tre sköra patienter har diarré och en undersköterska har gått hem. Risk för dehydrering finns.',
    'Patienter för särskild vätskebalanskontroll är identifierade. Vatten behövs till dryck, läkemedel och omvårdnad.',
    'Bemanningen är något ansträngd. Vatten och engångsmaterial behövs.',
    'De mest sköra prioriteras. Utskrivningsbara patienter bedöms för att minska belastningen.'
  ],
  psychGeriatrics: [
    'Patienter har svårt att förstå restriktionerna. En patient har druckit från handfat.',
    'Ökad tillsyn behövs. Vattenbehållare måste placeras säkert.',
    'En patient har diarré. Vatten, engångsmaterial och lokalvårdsstöd behövs.',
    'Avdelningen bör ändras så lite som möjligt. Långvarigt avbrott kräver säker återkommande distribution.'
  ],
  cardiacWard: [
    'Kranvatten används inte. Enstaka patienter behöver hjälp att följa restriktionerna.',
    'Vattenbehov är inventerat. Patienter som kan skrivas ut vid långvarigt avbrott är identifierade.',
    'Leveransbesked och gemensam information till patienter och närstående behövs.',
    'Verksamheten är stabil. Planerade inläggningar begränsas tills försörjningen är säkrad.'
  ],
  cardiacIcu: [
    'Vattenrestriktion är aktiverad. Patienterna är stabila och inga tydliga nya GI-symtom finns.',
    'Patienterna är känsliga för vätskebalans. Vatten behövs men inget omedelbart flyttbehov finns.',
    'Lokalt lager minskar. Leverans och tydliga hygienrutiner behövs.',
    'HIA kan fortsätta med regelbundna leveranser. Bemanning samordnas inom Hjärtcentrum vid behov.'
  ],
  cardiologyDiagnostics: [
    'Planerade undersökningar och inläggningar ses över. Kranvattnet används inte.',
    'Icke-akuta utredningar skjuts upp. Inneliggande bedöms för utskrivning eller prioriterad vård.',
    'Prognos behövs för ombokning och resursplanering.',
    'Verksamheten kan reduceras ytterligare och frigöra personal till högre prioriterade enheter.'
  ],
  thoracicSurgery: [
    'Kranvatten används inte. Flera patienter är nyopererade med betydande omvårdnadsbehov.',
    'En patient har diarré men är stabil. Vatten behövs till dryck, läkemedel, munvård och sårvård.',
    'Vattenbehovet överstiger lokalt lager. Prioriterad leverans och operationsinformation behövs.',
    'Inneliggande kan vårdas. Nya icke-akuta operationer bör inte skapa ytterligare vårdbehov.'
  ],
  thoracicStepDown: [
    'Avdelningen har inga eller få patienter. Vattenrestriktionen är aktiverad.',
    'Kan avlasta Thorax-IVA eller Thoraxavdelning men kräver vatten, bemanning och material.',
    'Om avdelningen öppnas måste behovet läggas till distributionsplanen.',
    'Avlastning kan ske först efter beslut om bemanning, patienturval och försörjning.'
  ],
  thoracicIcu: [
    'Rapporterar separat. Kranvatten är stoppat och flera patienter är mycket svåra att flytta.',
    'En vårdkrävande patient har GI-symtom. Läget är stabilt men omvårdnadsbehovet har ökat.',
    'Prioriterad leverans och uthållighetsbesked behövs. Rapporten ingår inte i ANOPIVA.',
    'Kan fortsätta ett dygn om vatten och personal säkras. Förflyttning är ett sent, komplicerat omfall.'
  ],
  infectionWard: [
    'Ett begränsat antal patienter har GI-symtom. Isoleringskapaciteten är tillräcklig.',
    'Stöd lämnas till provtagning och hygien. Inget specifikt smittämne kan ännu fastställas.',
    'En samlad fallista behövs. Alla patienter med lindriga symtom kan inte tas över.',
    'Platser reserveras för medicinskt behov av infektionsvård. Riskbaserad isolering och gemensam provtagning rekommenderas.'
  ],
  abdominalSurgery: [
    'Kranvatten används inte. Enstaka patienter har GI-symtom och flera är postoperativa.',
    'Vatten behövs till omvårdnad, läkemedel och sårvård. Planerade inläggningar och operationer ses över.',
    'Hög beläggning och liten mottagningsmarginal. Vatten och operationsbesked behövs.',
    'Utskrivningsbara prioriteras. Minskad operation kräver omprövning av vårdplatser och personal.'
  ],
  acuteSurgery: [
    'Akut uppdrag fortsätter. Kranvatten är stoppat och patienterna informerade.',
    'Få patienter har kräkningar eller diarré. Ingen anhopning och personalstyrkan är oförändrad.',
    'Säkert vatten och prioriteringsbesked för kirurgiska patienter behövs.',
    'Fortsätter som akut resurs. Planerade patienter ska inte belasta kapaciteten.'
  ],
  urologyGynecologyWard: [
    'Kranvatten är stoppat. Planerade patienter bedöms för ombokning.',
    'Nödvändig slutenvård fortsätter. Vatten behövs till dryck, läkemedel, hygien och patientnära vård.',
    'Lokalt lager är begränsat. Leverans och prioritering av vård som inte kan anstå behövs.',
    'Verksamheten kan reduceras genom utskrivningar och inställda planerade inläggningar.'
  ],
  medicalSpecialtyWard: [
    'Kranvatten är stoppat. Några patienter är sköra och kan inte själva ordna dryck.',
    'En patient har diarré men är stabil. Vatten, vätskeövervakning och personal inventeras.',
    'Någon personal saknas men läget är hanterbart. Vatten och engångsmaterial behövs.',
    'Vården fortsätter med prioritering av de mest vårdkrävande. Utskrivningsbara bedöms.'
  ],
  acuteMedicalWard: [
    'Akut uppdrag fortsätter. Ett antal patienter har misstänkt magsjuka men ingen massiv ökning ses.',
    'Några patienter behöver IV-vätska. Övrigt omvårdnadsbehov är inventerat.',
    'Säkert vatten och kriterier för inläggning kontra behandling/utskrivning behövs.',
    'Läget är hanterbart om flödet inte fylls med patienter som kan vårdas på annan nivå.'
  ],
  neuroRehab: [
    'Vattenrestriktion är aktiverad. Patienterna behöver hjälp med dryck och hygien.',
    'Inga allvarliga nya symtom. Tidigare hemgång eller annan rehabiliteringsplats bedöms.',
    'En mindre men tillförlitlig leverans och tydlig patientinformation behövs.',
    'Verksamheten kan reduceras för att frigöra resurser, men utskrivningar måste vara säkra.'
  ],
  neurosurgeryWard: [
    'Kranvatten används inte. Flera patienter är postoperativa med stora omvårdnadsbehov.',
    'Vatten behövs till dryck, läkemedel, munvård och sårvård. Inga omfattande symtom.',
    'Leverans och information om operationspåverkan behövs.',
    'Kan fortsätta vid säkrad försörjning. Planerade neurokirurgiska patienter begränsas.'
  ],
  neurologyWard: [
    'Patienterna är informerade. Några behöver hjälp att förstå eller följa restriktionerna.',
    'En patient har GI-symtom men är stabil. Vätskebalans följs.',
    'Vatten och extra material för munvård och hygien behövs.',
    'Kan fortsätta, men nya planerade inläggningar begränsas tills uthålligheten är klar.'
  ],
  strokeWard: [
    'Kranvatten är stoppat. Flera patienter har sväljsvårigheter och behöver kontrollerad vätska.',
    'Vatten behövs till läkemedel, förtjockad dryck, nutrition och munvård.',
    'Lokalt lager minskar. Prioriterad leverans behövs eftersom patienterna inte kan försörja sig själva.',
    'Kan fortsätta om vatten och nutrition säkras. Utskrivning eller flytt bedöms individuellt.'
  ],
  entWard: [
    'Kranvatten är stoppat. Några patienter har särskilda behov av munvård, sårvård eller nutrition.',
    'Planerade patienter ombokas. Inneliggande behöver säkert vatten till patientnära vård.',
    'Leverans och alternativ till vattenberoende rengöring behövs.',
    'Begränsad vård kan fortsätta. Icke-akut verksamhet förblir reducerad.'
  ],
  orthopedicWard: [
    'Vattenrestriktion är aktiverad. Flera patienter behöver omfattande hjälp med hygien och toalettbesök.',
    'En skör patient har diarré. Omvårdnads- och lokalvårdsbehovet ökar men inget större utbrott finns.',
    'Vatten, engångsmaterial och förstärkt rengöring behövs.',
    'Kan fortsätta, men planerade ortopediska inläggningar och operationer begränsas. Utskrivningsbara prioriteras.'
  ],
  alertUnsure: [
    'Larmet är mottaget och kranvattnet används inte. Personalen informerar patienter men är osäker på om hela verksamheten ska stängas.',
    'Icke-akuta besök begränsas, men några planerade patienter tas fortfarande emot. Vattenberoende moment är bara delvis inventerade.',
    'Verksamheten lämnar en ofullständig lägesbild och efterfrågar beslut om vad som får fortsätta. Uppgift om lokalt lager och uthållighet saknas.',
    'Planerad verksamhet är nu stängd. Besked behövs om nästa dygn och om frigjord personal ska stödja annan verksamhet.'
  ],
  alertUnclear: [
    'Larmet är mottaget men personalen vet inte vad nödvattenplanen innebär. Några kranar används fortfarande och verksamheten frågar om det räcker att koka vattnet.',
    'Kranvattnet stoppas efter förtydligande. Ingen har hittat åtgärdskortet och verksamheten saknar egen prioritering av patienter och arbetsmoment.',
    'Verksamheten väntar på detaljerade instruktioner från LSSL och kan inte ange konkret resursbehov, uthållighet eller första omfall.',
    'Planerad verksamhet har till slut stängts. Patientkontakter, bemanning och återstart är ännu inte planerade.'
  ],
  alertLate: [
    'Verksamheten har inte fått något larm och arbetar inledningsvis som vanligt. Personalen får kännedom om problemet genom frågor från patienter och andra enheter.',
    'Efter egen kontakt med växeln stoppas användning av kranvatten. Det lokala åtgärdskortet är inte känt och ansvarsfördelningen är oklar.',
    'Planerad verksamhet börjar avvecklas. Verksamheten kan inte redovisa samlat patientläge, vattenbehov eller uthållighet och behöver tydlig styrning från LSSL.',
    'De flesta patienter har skickats hem eller ombokats. Besked behövs om nästa dygn, akut hänvisningsväg och eventuell personalomfördelning.'
  ],
  alertPrepared: [
    'Larmet är mottaget. Åtgärdskortet är aktiverat, kranvatten används inte och patienter samt personal informeras. Tidskritiska behov identifieras.',
    'Icke-akut verksamhet är avbokad. Patienter på plats, vattenberoende moment, personal och lokalt material är inventerade.',
    'Verksamheten rapporterar nuläge, konkret hjälpbehov, lokal uthållighet och första omfall till LSSL. Akuta undantag hanteras enligt beslutad väg.',
    'Minsta säkra verksamhet för nästa dygn är planerad. Övrig verksamhet förblir stängd och frigjord personal kan omfördelas.'
  ],
  dialysis: [
    'Åtgärdskortet är aktiverat och dialysverksamheten har stoppats. Dagens dialyspatienter är identifierade och kontaktas enligt nödvattenplanen. Ingen dialys genomförs med ordinarie vatten.',
    'Samtliga berörda patienter är kontaktade. Medicinskt behov och hur länge behandlingen kan anstå bedöms. Patienter hänvisas enligt överenskommelse till annat sjukhus eller hembehandling där det är möjligt.',
    'Patienter som behöver dialys inom dygnet har fått en plan. Behov av patientförflyttning och transport är förmedlat till LSSL. Dialysen inväntar besked om avbrottstid och eventuell omprioritering.',
    'Plan för nästa dygn är fastställd och patienterna följs upp. Vid fortsatt avbrott fortsätter hänvisning eller förflyttning till andra sjukhus.'
  ],
  emergencyClinic: [
    'Ett antal patienter har sökt för diarré och kräkningar. Några har koppling till sjukhuset. Några medarbetare är sjuka, så akuten är något kort om personal. Belastningen är hanterbar.',
    'Fallen är fortfarande få men kommer från flera håll. Några patienter behöver intravenös vätska. Ingen del av akuten har stängts.',
    'Akuten klarar inflödet men behöver säkert vatten, hygienmaterial och besked om vart personal med lindriga symtom ska vända sig.',
    'Verksamheten kan fortsätta men behöver förstärkning om personalfrånvaron ökar. Inget massivt patientinflöde ses.'
  ],
  radiotherapy: [
    'Planerade patienter gås igenom. Kranvatten används inte och maskinernas slutna system kontrolleras.',
    'Icke-akuta besök begränsas. Behov av avjoniserat vatten och tekniskt stöd inventeras.',
    'Tidskritiska behandlingar behöver medicinsk prioritering. Besked behövs om teknisk försörjning och eventuell hänvisning.',
    'Endast behandling som inte kan anstå planeras. Övriga patienter ombokas.'
  ],
  laboratory: [
    'Patientnära provtagning kan fortsätta begränsat. Vattenberoende hygien- och analysflöden inventeras.',
    'Icke-akut provtagning begränsas. Akuta prover prioriteras och personal kan omfördelas.',
    'Laboratoriemedicin behöver besked om prioriterade analyser, trycksatt vatten och provtransport.',
    'Akut provtagning fortsätter. Planerad provtagning förblir begränsad.'
  ],
  gynecologyLate: [
    'Verksamheten har inte fått något larm och arbetar inledningsvis som vanligt. Personalen får kännedom om problemet genom frågor från patienter och andra enheter.',
    'Efter egen kontakt med växeln stoppas användning av kranvatten. Det lokala åtgärdskortet är inte känt och ansvarsfördelningen är oklar.',
    'Planerad verksamhet börjar avvecklas. Verksamheten kan inte redovisa samlat patientläge, vattenbehov eller uthållighet och behöver tydlig styrning från LSSL.',
    'De flesta patienter har skickats hem eller ombokats. Besked behövs om nästa dygn, akut hänvisningsväg och eventuell personalomfördelning.'
  ]
};

const LEGACY_OPERATIONAL_RESPONSE_VARIANTS = {
  'power-outage': {
    critical: [
      ['Nätelen har fallit bort. Endast blå UPS-uttag fungerar; reservkraftsproduktionen har inte startat. Patientnära utrustning kontrolleras.', 'Kritiska vårdmiljöer har bara ström i blå UPS-uttag. Reservkraftsproduktionen är ännu inte inkopplad.'],
      ['Batteritider och reservkraftsstatus sammanställs. Icke-kritisk utrustning kopplas bort efter lokal prioritering.', 'Personal går över till reservrutiner. Utrustning med kort batteritid och patientrisk identifieras först.'],
      ['Förväntad UPS-uthållighet och behov av förstärkning rapporteras till LSSL.', 'LSSL får besked om blå UPS-uttag, uthållighet och vilka patienter som är beroende av dem.'],
      ['Fortsatt vård kräver att UPS-uthålligheten räcker eller att LSSL beslutar om start av reservkraft. Förflyttningar bedöms individuellt.', 'Nästa driftperiod planeras utifrån UPS-uthållighet och beslut om eventuell reservkraftsproduktion.']
    ],
    ward: [
      ['Belysning och eluttag påverkas. Patienter och medicinteknisk utrustning kontrolleras; manuella reservrutiner tas fram.', 'Avdelningen har gått över till lokal reservrutin. Kritisk patientutrustning identifieras och larmvägar kontrolleras.'],
      ['Laddade batterier och ficklampor inventeras. Icke-nödvändig utrustning begränsas.', 'Personal samlar status på patienter med elberoende hjälpmedel och rapporterar batteribehov.'],
      ['LSSL behöver ge besked om prognos och eventuell omfördelning av patienter.', 'Vårdplatser och säkra förflyttningsvägar ses över inför ett längre avbrott.'],
      ['Avdelningen kan fortsätta med reducerad funktion så länge blå UPS-uttag räcker; reservkraft har inte startat.', 'Planerad verksamhet begränsas tills reservkraft har startats och elförsörjningen verifierats.']
    ],
    outpatient: [
      ['Mottagningen stoppar elberoende moment och säkrar patienter som redan är på plats.', 'Patienter informeras om avbrottet. Elberoende behandlingar pausas tills utrustning och lokaler är kontrollerade.'],
      ['Pågående besök avslutas säkert. Icke-akuta tider börjar bokas om.', 'Personal går igenom dagens patienter och skiljer tidskritiska kontakter från besök som kan flyttas.'],
      ['LSSL behöver besked om återställningstid innan nya patienter kallas.', 'Mottagningen rapporterar vilka behandlingar som kräver stabil el och hur många patienter som påverkas.'],
      ['Planerad verksamhet hålls reducerad tills elförsörjningen är verifierad.', 'Endast prioriterade kontakter planeras medan blå UPS-uttag är den enda aktiva elkällan.']
    ],
    emergency: [
      ['Akutmottagningen kontrollerar kritiska uttag, belysning, larm och fungerande patientövervakning.', 'Patientnära drift säkras först. Elberoende utrustning och reservbelysning kontrolleras.'],
      ['Icke-kritisk verksamhet begränsas och flödet anpassas till de ytor som har fungerande el.', 'Patientflödet styrs om från påverkade rum. LSSL får en lista över kritiska elbehov.'],
      ['Prognos för el och stöd från fastighet efterfrågas; extra inflöde kan inte tas emot oförändrat.', 'Akuten behöver beslut om prioritering, reservutrymmen och förstärkning om avbrottet fortsätter.'],
      ['Akut uppdrag fortsätter med reducerad kapacitet och regelbunden återrapportering.', 'Nya patienter tas emot enligt prioritet; planerad verksamhet hålls nere tills elen är stabil.']
    ],
    diagnostics: [
      ['Elberoende utrustning stoppas säkert. Pågående undersökningar avbryts eller slutförs enligt lokal säkerhetsrutin.', 'Bild- och laboratorieutrustning kontrolleras. Prover och undersökningar prioriteras efter klinisk brådska.'],
      ['Akuta analyser och undersökningar prioriteras; planerade flöden pausas.', 'UPS-uttag, provförvaring och utrustningens säkra avstängning inventeras.'],
      ['LSSL behöver besked om teknisk återstart och vilka analyser som kan utföras.', 'Verksamheten rapporterar kapacitet under reservdrift och kritiska beroenden.'],
      ['Akut diagnostik återupptas endast efter teknisk kontroll; övriga tider bokas om.', 'Reducerad produktion fortsätter tills utrustning och arbetsmiljö är verifierade.']
    ]
  },
  'it-outage': {
    critical: [
      ['Patientidentifiering och ordinationer verifieras med reservrutiner. Kritiska infusioner och övervakning dubbelkontrolleras.', 'Personal går över till pappersdokumentation. Patientidentitet, läkemedel och kritiska ordinationer stäms av manuellt.'],
      ['Aktuella läkemedel, allergier och behandlingsplaner sammanställs där åtkomst finns; saknade uppgifter markeras.', 'Överlämningar sker muntligt med skriftlig kvittens. Dubbelkontroll inför läkemedel och kritiska åtgärder förstärks.'],
      ['LSSL behöver besked om systemprognos och gemensam reservrutin för dokumentation och provsvar.', 'Kritisk information som saknas rapporteras. En prioriterad kanal för akuta ordinationer efterfrågas.'],
      ['Vården fortsätter med reservjournal och tydlig överlämning tills systemen är verifierat återställda.', 'Pappersunderlag säkras för senare registrering; återgång sker först efter gemensamt klartecken.']
    ],
    ward: [
      ['Journalsystemet är otillgängligt. Avdelningen tar fram patientlista, läkemedelsunderlag och pappersjournal.', 'Rapportering sker på reservblanketter. Patientidentitet och aktuella ordinationer kontrolleras manuellt.'],
      ['Läkemedelslistor och provsvar dubbelkontrolleras via tillgängliga reservvägar.', 'Överlämningar dokumenteras på papper och ansvarig personal kvitterar utförda moment.'],
      ['Avdelningen behöver gemensam instruktion om dokumentation, provsvar och kontakt med andra enheter.', 'LSSL efterfrågas om systemprognos och hur externa remisser ska hanteras.'],
      ['Slutenvården fortsätter med pappersrutiner. Efterregistrering planeras när systemet är säkert tillgängligt.', 'Nya planerade aktiviteter begränsas om patientinformation inte kan verifieras.']
    ],
    outpatient: [
      ['Mottagningen kan inte läsa ordinarie journaler. Patienter på plats identifieras och tidskritiska besök sorteras.', 'Personal går över till reservlista och pappersanteckningar; patienter informeras om fördröjningar.'],
      ['Icke-akuta besök bokas om. Akuta kontakter hanteras via verifierad reservrutin.', 'Tidbokning och remissflöde stäms av manuellt där det är möjligt.'],
      ['Mottagningen behöver besked om systemprognos och gemensam väg för provsvar och remisser.', 'LSSL efterfrågas om vilka patientkontakter som ska prioriteras.'],
      ['Verksamheten förblir reducerad tills journalåtkomst och bokningsdata är kontrollerade.', 'Ombokningar och pappersunderlag samlas för säker efterregistrering.']
    ],
    emergency: [
      ['Akuten går över till manuell registrering och identifiering. Triage och kritiska ordinationer dokumenteras på reservblanketter.', 'Patientflödet hålls igång med pappersbaserad triage och tydliga muntliga överlämningar.'],
      ['Provsvar, remisser och läkemedelsuppgifter verifieras via alternativa kontaktvägar.', 'En samlad manuell patientlista upprättas för att minska risken för dubbelregistrering.'],
      ['LSSL behöver samordna informationsvägar till laboratorier, röntgen och vårdavdelningar.', 'Akuten rapporterar väntande kritiska provsvar och behov av systemstöd.'],
      ['Akut verksamhet fortsätter med pappersrutiner; planerat flöde hålls nere tills systemen är stabila.', 'Efterregistrering planeras efter kontrollerad återstart och avstämning av patientlistor.']
    ],
    diagnostics: [
      ['Beställningar och svar hanteras på reservblanketter. Akuta prover och undersökningar prioriteras.', 'Verksamheten säkrar prov-ID och manuell svarskanal innan nya beställningar tas emot.'],
      ['Resultat kommuniceras direkt till ansvarig enhet och kvitteras manuellt.', 'Planerade analyser och undersökningar begränsas om remiss- eller journalsamband inte kan verifieras.'],
      ['LSSL behöver prioritera kritiska analyser, bilddiagnostik och extern informationsöverföring.', 'Provsvarskö och kapacitet sammanställs för gemensam lägesbild.'],
      ['Akut diagnostik fortsätter i reducerad reservdrift tills systemen är testade.', 'Pappersunderlag arkiveras för efterregistrering och kontroll vid återstart.']
    ]
  },
  'oxygen-disruption': {
    critical: [
      ['Patienter med högst syrgas- och ventilationsbehov identifieras. Tillgängliga uttag och tuber kontrolleras.', 'Syrgasbehov prioriteras patient för patient. Reservtuber och återstående försörjning inventeras.'],
      ['Förbrukning och reservkapacitet följs tätt. Icke-kritisk användning omprövas av ansvarig kliniker.', 'Personal rapporterar patienternas behov, reservtuber och beräknad uthållighet till LSSL.'],
      ['Prioriterad påfyllning och prognos behövs. Flytt av svårflyttade patienter kräver samordnat beslut.', 'LSSL efterfrågas om transport- och mottagningsalternativ om lokal försörjning försämras.'],
      ['Kritisk vård kan fortsätta om leverans och personal säkras. Förflyttning planeras endast som beslutat omfall.', 'Nya inläggningar med stort syrgasbehov måste vägas mot bekräftad kapacitet och regionalt stöd.']
    ],
    ward: [
      ['Patienter med syrgasbehov identifieras. Portabla tuber, flöden och anslutningar inventeras.', 'Avdelningen sammanställer syrgasbehov och kontrollerar att reservutrustning är tillgänglig.'],
      ['Förbrukning följs och patienternas ordinerade behov dubbelkontrolleras av vårdteamet.', 'Portabla lösningar reserveras för patienter som behöver förflyttas eller saknar fungerande uttag.'],
      ['LSSL behöver besked om leveranstid, prioritering och möjlighet att förstärka försörjningen.', 'Avdelningen rapporterar uthållighet och vilka patienter som påverkas om leverans uteblir.'],
      ['Vården fortsätter enligt klinisk prioritering om syrgasleverans säkras.', 'Nya planerade inläggningar med syrgasbehov begränsas tills kapaciteten är bekräftad.']
    ],
    outpatient: [
      ['Patienter med planerad syrgas eller syrgasberoende behandling identifieras och bedöms individuellt.', 'Mottagningen kontrollerar utrustning och förbrukning innan syrgasberoende besök genomförs.'],
      ['Icke-akuta behandlingar med stort syrgasbehov bokas om efter klinisk bedömning.', 'Patienter på plats får besked om väntan och alternativa tider; akut behov hänvisas enligt lokal rutin.'],
      ['Verksamheten behöver besked om leveransprognos och prioriterade patientgrupper.', 'LSSL efterfrågas om gemensam hänvisningsväg för syrgasberoende patienter.'],
      ['Planerad verksamhet förblir reducerad tills försörjningen är stabil.', 'Akuta undantag hanteras efter individuell klinisk bedömning och tillgänglig kapacitet.']
    ],
    emergency: [
      ['Akuten inventerar syrgasuttag, portabla tuber och patienter med pågående syrgasbehandling.', 'Patienter med andningspåverkan prioriteras; tillgängliga syrgasresurser och reservflöden kontrolleras.'],
      ['Förbrukning följs och patienter sorteras efter kliniskt behov. Försörjningen rapporteras till LSSL.', 'Akuten behöver en gemensam prioritering för tuber, uttag och eventuella inkommande patienter.'],
      ['LSSL behöver samordna leverans, transportkapacitet och mottagande enheter.', 'Prognos för inflöde och syrgasförbrukning efterfrågas för kommande timmar.'],
      ['Akutflödet fortsätter med prioritering och regelbunden rapportering av kapacitet.', 'Patienter med stort syrgasbehov hänvisas eller flyttas endast efter medicinskt och logistiskt beslut.']
    ],
    diagnostics: [
      ['Syrgasberoende undersökningar och utrustning inventeras. Akuta undersökningar prioriteras.', 'Berörda tekniska system kontrolleras och planerade syrgasberoende undersökningar pausas vid osäker försörjning.'],
      ['Patienter och mottagande enheter informeras om begränsad kapacitet.', 'Teknisk personal sammanställer utrustningsbehov och möjliga reservlösningar.'],
      ['LSSL behöver prioritera diagnostik med direkt betydelse för akut behandling.', 'Leveransprognos och transport av syrgasutrustning efterfrågas.'],
      ['Akut diagnostik fortsätter i reducerad omfattning om försörjningen är säker.', 'Planerad produktion återupptas först när teknisk kapacitet är bekräftad.']
    ]
  },
  custom: {
    critical: [
      ['Kritiska patientberoenden inventeras och verksamheten rapporterar omedelbar påverkan till LSSL.', 'Patienter med störst risk prioriteras medan enheten fastställer vilka funktioner som påverkas.'],
      ['Reservrutiner aktiveras där det är möjligt. Personal, material och beroenden sammanställs.', 'Enheten rapporterar förändringar i patientläge och vilka resurser som snabbt kan ta slut.'],
      ['LSSL behöver besluta om prioritering, förstärkning och eventuell omfördelning.', 'Prognos och tydligt beslut om nästa åtgärd efterfrågas.'],
      ['Minsta säkra drift planeras för nästa period. Kvarstående risker rapporteras till LSSL.', 'Fortsatt verksamhet villkoras av säkrad bemanning, resurser och tydliga besked.']
    ],
    ward: [
      ['Avdelningen inventerar patientpåverkan och vilka vårdmoment som behöver ändras.', 'Patienter och personal informeras. Lokala resurser och omedelbara risker sammanställs.'],
      ['Vården prioriteras efter behov. Planerade moment ses över och reservrutiner används.', 'Enheten rapporterar vilka patienter som behöver extra tillsyn eller samordning.'],
      ['LSSL får besked om konkret hjälpbehov, uthållighet och möjliga omfall.', 'Resursläget sammanställs inför beslut om fortsatt drift.'],
      ['Minsta säkra verksamhet planeras. Utskrivning eller flytt föreslås bara efter individuell bedömning.', 'Avdelningen fortsätter enligt LSSL:s prioritering och rapporterar förändringar.']
    ],
    outpatient: [
      ['Mottagningen identifierar patienter på plats och bedömer vilka besök som påverkas.', 'Patienter informeras och tidskritiska kontakter skiljs från besök som kan bokas om.'],
      ['Planerad verksamhet begränsas efter patient- och resursbedömning.', 'Mottagningen sammanställer ombokningar, patientkontakter och behov av alternativ hänvisning.'],
      ['LSSL efterfrågas om prioritering och gemensamt informationsbudskap.', 'Verksamheten rapporterar resursbehov och vilka kontakter som inte kan anstå.'],
      ['Reducerad drift fortsätter enligt beslutad prioritering. Återstart planeras när förutsättningarna är klara.', 'Patienter som bokas om får en gemensam hänvisningsväg och tid för nästa uppdatering.']
    ],
    emergency: [
      ['Akuten bedömer påverkan på patientflöde, kritiska resurser och pågående vård.', 'Triage och patientinformation anpassas till händelsen; påverkan rapporteras till LSSL.'],
      ['Kapacitet och väntande patienter sammanställs. Icke-akuta flöden kan behöva styras om.', 'Akuten efterfrågar samordning med berörda avdelningar och mottagningar.'],
      ['LSSL behöver besluta om prioritering, resursstöd och extern hänvisning.', 'Prognos för inflöde och kapacitet begärs.'],
      ['Akut uppdrag fortsätter enligt beslutad prioritering med återkommande lägesrapport.', 'Eventuella begränsningar kommuniceras tydligt till patienter och samverkansparter.']
    ],
    diagnostics: [
      ['Påverkade processer identifieras. Akuta analyser och undersökningar prioriteras.', 'Utrustning, provflöden och beroenden kontrolleras innan fortsatt produktion.'],
      ['Planerade flöden begränsas vid behov. Akuta resultat hanteras via beslutad reservväg.', 'Tekniskt och operativt resursläge rapporteras till LSSL.'],
      ['LSSL behöver ange vilka analyser och undersökningar som ska prioriteras.', 'Prognos och eventuellt behov av extern kapacitet efterfrågas.'],
      ['Akut diagnostik fortsätter om säker drift kan upprätthållas.', 'Återgång till full produktion sker när ansvarig funktion bekräftat förutsättningarna.']
    ]
  }
};

const WATER_OUTAGE_UNITS = [
  { id: 'ward-peds-2', name: 'Barnavdelning 2 Umeå', group: 'Avdelning', aliases: ['Barnavdelning 2'], profile: 'childWard' },
  { id: 'ward-peds-3', name: 'Barnavdelning 3 Umeå', group: 'Avdelning', aliases: ['Barnavdelning 3'], profile: 'childWard' },
  { id: 'ward-neonatal', name: 'Barnavdelning 4 neonatal IVA Umeå', group: 'Avdelning', aliases: ['Barnavdelning 4'], profile: 'neonatal' },
  { id: 'ward-cancer-18', name: 'Cancercentrum vårdavdelning, 18 platser', group: 'Avdelning', aliases: ['Onkologavdelning CDE'], profile: 'cancerWard' },
  { id: 'ward-cancer-16', name: 'Cancercentrum vårdavdelning, 16 platser', group: 'Avdelning', aliases: ['Onkologavdelning Hematolog'], profile: 'hematologyWard' },
  { id: 'ward-icu', name: 'Intensivvårdsavdelning Umeå', group: 'Avdelning', aliases: ['Intensivvårdsavdelning'], profile: 'intensiveCare' },
  { id: 'ward-imc', name: 'Intermediärvårdsavdelning', group: 'Avdelning', aliases: ['Intermediärvårdsavdelning'], profile: 'intermediateCare' },
  { id: 'ward-bb', name: 'BB antenatalavdelning Umeå', group: 'Avdelning', aliases: ['BB Antenatalavdelning'], profile: 'obstetricWard' },
  { id: 'ward-ger-1', name: 'Allmängeriatrisk avdelning 1', group: 'Avdelning', aliases: ['Geriatrisk avdelning 1'], profile: 'geriatricsWard' },
  { id: 'ward-ger-4', name: 'Ortopedgeriatrisk avdelning 4', group: 'Avdelning', aliases: ['Geriatrisk avdelning 4'], profile: 'geriatricsWard' },
  { id: 'ward-ger-2', name: 'Psykogeriatrisk avdelning 2 Umeå', group: 'Avdelning', aliases: ['Geriatrisk avdelning 2'], profile: 'psychGeriatrics' },
  { id: 'ward-hand-plastic', name: 'Hand-, plastik- och ögonavdelning', group: 'Avdelning', aliases: ['Hand- Plastik- Ögon avdelning'], profile: 'entWard' },
  { id: 'ward-hia', name: 'Hjärtintensivvårdsavdelning', group: 'Avdelning', aliases: ['Hjärtintensvvårdsavdelning'], profile: 'cardiacIcu' },
  { id: 'ward-cardiology', name: 'Kardiologisk avdelning Umeå', group: 'Avdelning', aliases: ['Kardiologisk avdelning'], profile: 'cardiacWard' },
  { id: 'ward-cardiology-diagnostics', name: 'Kardiologisk utredningsavdelning', group: 'Avdelning', aliases: ['Kardiologisk utredningsavdelning'], profile: 'cardiologyDiagnostics' },
  { id: 'ward-thorax', name: 'Thoraxavdelning Umeå', group: 'Avdelning', aliases: ['Thoraxavdelning'], profile: 'thoracicSurgery' },
  { id: 'ward-thorax-imc', name: 'Thoraxintermediärvårdsavdelning', group: 'Avdelning', aliases: ['Thorax intermediärvårdsavdelning', 'Thoraxintermediär'], profile: 'thoracicStepDown' },
  { id: 'ward-thorax-icu', name: 'Thoraxkirurgisk IVA Umeå', group: 'Avdelning', aliases: ['Thoraxintensiv vårdavdelning'], profile: 'thoracicIcu' },
  { id: 'ward-infection', name: 'Infektionsavdelning Umeå', group: 'Avdelning', aliases: ['Infektionsavdelning'], profile: 'infectionWard' },
  { id: 'ward-abdominal-surgery', name: 'Buk- och kärlkirurgisk avdelning', group: 'Avdelning', aliases: ['Buk och kärlkirurgisk avdelning'], profile: 'abdominalSurgery' },
  { id: 'ward-acute-surgery', name: 'Kirurgisk akutvårdsavdelning', group: 'Avdelning', aliases: ['Kirurgisk akutvårdsavdelning', 'Kirurg avd'], profile: 'acuteSurgery' },
  { id: 'ward-urology-gyn', name: 'Urologisk och gynekologisk avdelning', group: 'Avdelning', aliases: ['Urologisk och gynekologisk avdelning'], profile: 'urologyGynecologyWard' },
  { id: 'ward-medicine-specialty', name: 'Medicincentrum specialistvårdsavdelning', group: 'Avdelning', aliases: ['Medicincentrum specialistvårdsavdelning'], profile: 'medicalSpecialtyWard' },
  { id: 'ward-acute-medicine', name: 'Medicinsk akutvårdsavdelning', group: 'Avdelning', aliases: ['Medicinsk akutvårdsavdelning'], profile: 'acuteMedicalWard' },
  { id: 'ward-brain-spinal', name: 'Hjärn- och ryggmärgsskadade', group: 'Avdelning', aliases: ['Hjärt- och ryggmärgsskaderehab', 'Hjärn- och ryggmärgsskaderehab'], profile: 'neuroRehab' },
  { id: 'ward-neuro-rehab', name: 'Neuro- och strokerehabilitering', group: 'Avdelning', aliases: ['Neuro- och strokerehabilitering'], profile: 'neuroRehab' },
  { id: 'ward-niva', name: 'Neurointensivvård NIVA Umeå', group: 'Avdelning', aliases: ['Neurokirurgisk intensivvårdsavdelning'], profile: 'neuroIntensiveCare' },
  { id: 'ward-neurosurgery', name: 'Neurokirurgisk avdelning Umeå', group: 'Avdelning', aliases: ['Neurokirurgisk avdelning'], profile: 'neurosurgeryWard' },
  { id: 'ward-neurology', name: 'Neurologisk avdelning Umeå', group: 'Avdelning', aliases: ['Neurologisk avdelning'], profile: 'neurologyWard' },
  { id: 'ward-stroke', name: 'Strokecenter avdelning Umeå', group: 'Avdelning', aliases: ['Strokecenter avdelning'], profile: 'strokeWard' },
  { id: 'ward-ent', name: 'Öron-, näs-, hals- och käkkirurgisk avdelning', group: 'Avdelning', aliases: ['Öron- näsa- Hals avdelning'], profile: 'entWard' },
  { id: 'ward-orthopedic', name: 'Ortopedavdelning Umeå', group: 'Avdelning', aliases: ['Ortopedavdelning', 'Ortoped avd'], profile: 'orthopedicWard' },
  { id: 'clinic-geriatric', name: 'Geriatriska mottagningar, samlad kontakt', group: 'Mottagning', aliases: [], profile: 'alertLate' },
  { id: 'clinic-medicine', name: 'Medicincentrumsmottagningar, samlad kontakt', group: 'Mottagning', aliases: ['Medicinmottagningen'], profile: 'alertUnclear' },
  { id: 'clinic-medicine-day', name: 'Medicincentrum dagvård', group: 'Mottagning', aliases: [], profile: 'alertUnsure' },
  { id: 'clinic-dialysis', name: 'Medicincentrum Dialysen', group: 'Mottagning', aliases: [], profile: 'dialysis' },
  { id: 'clinic-emergency', name: 'Akutmottagningen', group: 'Mottagning', aliases: [], profile: 'emergencyClinic' },
  { id: 'clinic-adult-psychiatry', name: 'Vuxenpsykiatriska mottagningar, samlad kontakt', group: 'Mottagning', aliases: [], profile: 'alertUnsure' },
  { id: 'clinic-infection', name: 'Infektionsmottagningen', group: 'Mottagning', aliases: ['Infektionsmottagningen'], profile: 'alertPrepared' },
  { id: 'clinic-cancer', name: 'Cancercentrums mottagningar, samlad kontakt', group: 'Mottagning', aliases: ['Onkologisk mottagning'], profile: 'alertUnsure' },
  { id: 'clinic-radiotherapy', name: 'Strålbehandling och onkologisk dagvård', group: 'Mottagning', aliases: [], profile: 'radiotherapy' },
  { id: 'clinic-lab', name: 'Laboratoriemedicin, provtagningsmottagning', group: 'Mottagning', aliases: [], profile: 'laboratory' },
  { id: 'clinic-surgery', name: 'Kirurgmottagningen', group: 'Mottagning', aliases: ['Kirurgmottagningen'], profile: 'alertUnclear' },
  { id: 'clinic-urology', name: 'Urologmottagningen', group: 'Mottagning', aliases: ['Urologmottagningen'], profile: 'alertUnsure' },
  { id: 'clinic-gynecology', name: 'Gynekologisk mottagning', group: 'Mottagning', aliases: ['Gynmottagningen'], profile: 'alertLate' },
  { id: 'clinic-maternity', name: 'Förlossningsmottagningen', group: 'Mottagning', aliases: [], profile: 'alertPrepared' },
  { id: 'clinic-bb', name: 'BB-mottagningen', group: 'Mottagning', aliases: [], profile: 'alertUnsure' },
  { id: 'clinic-cardiology', name: 'Hjärtcentrums mottagningar och klinisk fysiologi', group: 'Mottagning', aliases: ['Hjärt- och kärlmottagningen'], profile: 'alertPrepared' },
  { id: 'clinic-orthopedic', name: 'Ortopedmottagningen Umeå', group: 'Mottagning', aliases: ['Ortopedmottagningen'], profile: 'alertUnsure' },
  { id: 'clinic-orthotics', name: 'Ortopedteknik Umeå', group: 'Mottagning', aliases: [], profile: 'alertUnsure' },
  { id: 'clinic-rheumatology', name: 'Reumatologmottagningen', group: 'Mottagning', aliases: [], profile: 'alertLate' },
  { id: 'clinic-neurology', name: 'Neurologmottagningen', group: 'Mottagning', aliases: ['Neurologmottagningen'], profile: 'alertUnsure' },
  { id: 'clinic-neurosurgery', name: 'Neurokirurgisk mottagning', group: 'Mottagning', aliases: [], profile: 'alertLate' },
  { id: 'clinic-stroke', name: 'Strokemottagningen', group: 'Mottagning', aliases: [], profile: 'alertPrepared' },
  { id: 'clinic-ent', name: 'ÖNH-mottagningen', group: 'Mottagning', aliases: ['Öron-näsa-hals mottagningen'], profile: 'alertUnclear' },
  { id: 'clinic-jaw', name: 'Käkkirurgisk mottagning', group: 'Mottagning', aliases: ['Käkkirurgisk mottagning'], profile: 'alertUnsure' },
  { id: 'clinic-audiology', name: 'Hörselverksamhet och audiologi', group: 'Mottagning', aliases: [], profile: 'alertLate' },
  { id: 'clinic-speech', name: 'Logopedi och sväljbedömning', group: 'Mottagning', aliases: [], profile: 'alertUnsure' },
  { id: 'clinic-eye', name: 'Ögonmottagningen', group: 'Mottagning', aliases: ['Ögonmottagningen'], profile: 'alertUnclear' },
  { id: 'clinic-hand-plastic', name: 'Hand- och plastikkirurgisk mottagning', group: 'Mottagning', aliases: ['HAKI- mottagningen'], profile: 'alertPrepared' },
  { id: 'clinic-skin-std', name: 'Hud- och STD-mottagningen', group: 'Mottagning', aliases: ['STD-mottagningen'], profile: 'alertUnclear' },
  { id: 'clinic-bup', name: 'BUP-mottagningen NUS', group: 'Mottagning', aliases: ['Barnmottagningen'], profile: 'alertUnclear' },
  { id: 'clinic-habilitation', name: 'Ungdoms- och vuxenhabilitering', group: 'Mottagning', aliases: [], profile: 'alertUnsure' },
  { id: 'clinic-vision-rehab', name: 'Synrehabilitering', group: 'Mottagning', aliases: [], profile: 'alertLate' },
  { id: 'clinic-hearing-rehab', name: 'Hörselrehabilitering', group: 'Mottagning', aliases: [], profile: 'alertUnsure' },
  { id: 'clinic-child', name: 'Barnmottagningen NUS', group: 'Mottagning', aliases: ['Barnmottagningen'], profile: 'alertUnsure' },
  { id: 'clinic-dental', name: 'Sjukhustandvård och tandvård på NUS', group: 'Mottagning', aliases: [], profile: 'alertPrepared' }
];

export function createHospitalEventMessageSchedule(random = Math.random) {
  const schedule = Object.fromEntries(WATER_OUTAGE_UNITS.map(unit => [unit.id, []]));
  const units = [...WATER_OUTAGE_UNITS];
  const availableMinutes = Array.from(
    { length: FIRST_REPORT_END_MINUTE - FIRST_REPORT_START_MINUTE + 1 },
    (_, index) => FIRST_REPORT_START_MINUTE + index
  ).flatMap(minute => Array(MAX_EVENT_MESSAGES_PER_SIM_MINUTE).fill(minute));

  for (let index = units.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [units[index], units[swapIndex]] = [units[swapIndex], units[index]];
  }
  for (let index = availableMinutes.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [availableMinutes[index], availableMinutes[swapIndex]] = [availableMinutes[swapIndex], availableMinutes[index]];
  }

  units.forEach((unit, index) => {
    schedule[unit.id] = [availableMinutes[index]];
  });

  return schedule;
}

export const createWaterOutageMessageSchedule = createHospitalEventMessageSchedule;

export function createWaterOutageResponsePlan(random = Math.random) {
  const responsePlan = {};

  WATER_OUTAGE_UNITS.forEach(unit => {
    const possibleProfiles = CLINIC_PROFILE_VARIANTS[unit.profile] || [unit.profile];
    responsePlan[unit.id] = {
      profile: possibleProfiles[Math.floor(random() * possibleProfiles.length)],
      style: RESPONSE_STYLES[Math.floor(random() * RESPONSE_STYLES.length)]
    };
  });

  return responsePlan;
}

function getOperationalUnitCategory(unit) {
  if (unit.id === 'clinic-emergency') return 'emergency';
  if (['clinic-radiotherapy', 'clinic-lab'].includes(unit.id)) return 'diagnostics';
  if (unit.group === 'Mottagning') return 'outpatient';
  if ([
    'neonatal', 'intensiveCare', 'intermediateCare', 'cardiacIcu', 'thoracicIcu', 'neuroIntensiveCare'
  ].includes(unit.profile)) return 'critical';
  return 'ward';
}

export function createHospitalEventResponsePlan(type, random = Math.random) {
  if (type === 'water-outage') return createWaterOutageResponsePlan(random);

  const responseCatalog = OPERATIONAL_RESPONSE_VARIANTS[type] || OPERATIONAL_RESPONSE_VARIANTS.custom;
  return Object.fromEntries(WATER_OUTAGE_UNITS.map(unit => {
    const category = getOperationalUnitCategory(unit);
    const stageVariants = responseCatalog[category];
    return [unit.id, {
      category,
      variantIndexes: stageVariants.map(variants => Math.floor(random() * variants.length)),
      style: RESPONSE_STYLES[Math.floor(random() * RESPONSE_STYLES.length)]
    }];
  }));
}

export function getHospitalEventMessages(event, simTime) {
  if (!event || event.hospital !== 'Norrlands universitetssjukhus') return [];
  const responseCatalog = OPERATIONAL_RESPONSE_VARIANTS[event.type];
  if (event.type !== 'water-outage' && !responseCatalog) return [];

  const endTime = event.status === 'resolved' && event.resolvedAtSimTime
    ? event.resolvedAtSimTime
    : simTime;
  const elapsed = elapsedSimulationMinutes(event.createdAtSimTime, endTime);
  const messages = [];

  WATER_OUTAGE_UNITS.forEach(unit => {
    const response = event.responsePlan?.[unit.id];
    const fullProfile = event.type === 'water-outage'
      ? RESPONSE_PROFILES[response?.profile] || RESPONSE_PROFILES[unit.profile]
      : responseCatalog[response?.category || getOperationalUnitCategory(unit)];
    const profile = fullProfile.slice(0, 1);
    const updateOffsets = event.messageSchedule?.[unit.id] || [];
    profile.forEach((text, index) => {
      const offsetMinutes = updateOffsets[index] ?? FIRST_REPORT_START_MINUTE;
      if (elapsed < offsetMinutes) return;
      messages.push({
        id: `${event.id}:${unit.id}:${offsetMinutes}`,
        eventId: event.id,
        eventTitle: event.title,
        hospital: event.hospital,
        unit: unit.name,
        unitType: unit.group,
        simTime: addSimulationMinutes(event.createdAtSimTime, offsetMinutes),
        updateIndex: index,
        offsetMinutes,
        message: event.type === 'custom'
          ? `${event.title}: ${text}${event.description ? ` ${event.description}` : ''} ${response?.style || ''}`.trim()
          : response?.variantIndexes
            ? `${fullProfile[index][response.variantIndexes[index]]} ${response.style || ''}`.trim()
            : response?.style ? `${text} ${response.style}` : text
      });
    });
  });

  return messages.sort((left, right) => left.offsetMinutes - right.offsetMinutes || left.unit.localeCompare(right.unit, 'sv'));
}