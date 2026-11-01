/**
 * Az érettségi feladatbank témakörlistája: a 2024-től érvényes matematika
 * részletes érettségi követelmény számozott témakörei és altémái.
 * A régebbi (2005–2023) lapok feladatai is ebbe a listába kerülnek.
 * Forrás és szabályok: claude/erettsegi-temakorlista.md
 */
export type Tema={kod:string;nev:string;emelt?:boolean};

export const TEMAKOROK:{szam:string;nev:string}[]=[
 {szam:'1',nev:'Gondolkodási módszerek, halmazok, logika, kombinatorika, gráfok'},
 {szam:'2',nev:'Számelmélet, algebra'},
 {szam:'3',nev:'Függvények, az analízis elemei'},
 {szam:'4',nev:'Geometria, koordinátageometria, trigonometria'},
 {szam:'5',nev:'Valószínűség-számítás, statisztika'}
];

export const TEMAK:Tema[]=[
 {kod:'1.1',nev:'Halmazok (megadás, részhalmaz, komplementer)'},
 {kod:'1.1.1',nev:'Halmazműveletek'},
 {kod:'1.1.2',nev:'Számosság, részhalmazok (logikai szita)'},
 {kod:'1.2',nev:'Matematikai logika'},
 {kod:'1.2.1',nev:'Fogalmak, tételek és bizonyítások a matematikában'},
 {kod:'1.3',nev:'Kombinatorika'},
 {kod:'1.4',nev:'Gráfok'},
 {kod:'2.1',nev:'Alapműveletek'},
 {kod:'2.2',nev:'A természetes számok halmaza, számelméleti ismeretek'},
 {kod:'2.2.1',nev:'Oszthatóság'},
 {kod:'2.2.2',nev:'Számrendszerek'},
 {kod:'2.3',nev:'Racionális és irracionális számok'},
 {kod:'2.4',nev:'Valós számok (intervallum, abszolút érték, normálalak, kerekítés)'},
 {kod:'2.5',nev:'Hatvány, gyök, logaritmus'},
 {kod:'2.6',nev:'Betűkifejezések'},
 {kod:'2.6.1',nev:'Nevezetes azonosságok'},
 {kod:'2.7',nev:'Arányosság'},
 {kod:'2.7.1',nev:'Százalékszámítás'},
 {kod:'2.8',nev:'Egyenletek, egyenletrendszerek, egyenlőtlenségek'},
 {kod:'2.8.1.1',nev:'Elsőfokú egyenletek, egyenletrendszerek'},
 {kod:'2.8.1.2',nev:'Másodfokú egyenletek, egyenletrendszerek'},
 {kod:'2.8.1.3',nev:'Magasabb fokú egyenletek'},
 {kod:'2.8.1.4',nev:'Négyzetgyökös egyenletek'},
 {kod:'2.8.2.1',nev:'Abszolútértékes egyenletek'},
 {kod:'2.8.2.2',nev:'Exponenciális egyenletek'},
 {kod:'2.8.2.3',nev:'Logaritmusos egyenletek'},
 {kod:'2.8.2.4',nev:'Trigonometrikus egyenletek'},
 {kod:'2.8.3',nev:'Egyenlőtlenségek, egyenlőtlenség-rendszerek'},
 {kod:'2.9',nev:'Középértékek, egyenlőtlenségek'},
 {kod:'3.1',nev:'A függvény (alapfogalmak, helyettesítési érték)'},
 {kod:'3.2',nev:'Egyváltozós valós függvények'},
 {kod:'3.2.1',nev:'A függvények grafikonja, függvénytranszformációk'},
 {kod:'3.2.2',nev:'A függvények jellemzése'},
 {kod:'3.3',nev:'Sorozatok'},
 {kod:'3.3.1',nev:'Számtani és mértani sorozatok'},
 {kod:'3.3.2',nev:'Végtelen mértani sor'},
 {kod:'3.3.3',nev:'Kamatos kamat, járadékszámítás'},
 {kod:'3.4',nev:'Az analízis elemei',emelt:true},
 {kod:'3.4.1',nev:'Határérték, folytonosság',emelt:true},
 {kod:'3.4.2',nev:'Differenciálszámítás',emelt:true},
 {kod:'3.4.3',nev:'Integrálszámítás',emelt:true},
 {kod:'4.1',nev:'Elemi geometria'},
 {kod:'4.1.1',nev:'Térelemek (szögek, távolság, hajlásszög)'},
 {kod:'4.1.2',nev:'Távolsággal definiált ponthalmazok'},
 {kod:'4.2',nev:'Geometriai transzformációk'},
 {kod:'4.2.1',nev:'Egybevágósági transzformációk'},
 {kod:'4.2.2',nev:'Hasonlósági transzformációk'},
 {kod:'4.2.3',nev:'Egyéb transzformációk (merőleges vetítés)'},
 {kod:'4.3',nev:'Síkbeli és térbeli alakzatok'},
 {kod:'4.3.1.1',nev:'Háromszögek (Pitagorasz-tétel, nevezetes vonalak)'},
 {kod:'4.3.1.2',nev:'Négyszögek'},
 {kod:'4.3.1.3',nev:'Sokszögek'},
 {kod:'4.3.1.4',nev:'Kör (középponti és kerületi szög, Thalész-tétel)'},
 {kod:'4.3.2',nev:'Térbeli alakzatok'},
 {kod:'4.4',nev:'Vektorok síkban és térben'},
 {kod:'4.5',nev:'Trigonometria (szögfüggvények, szinusz- és koszinusztétel)'},
 {kod:'4.6',nev:'Koordinátageometria'},
 {kod:'4.6.1',nev:'Pontok, vektorok (két pont távolsága, felezőpont)'},
 {kod:'4.6.2',nev:'Egyenes'},
 {kod:'4.6.3',nev:'Kör'},
 {kod:'4.6.4',nev:'Parabola'},
 {kod:'4.7',nev:'Kerület, terület'},
 {kod:'4.8',nev:'Felszín, térfogat'},
 {kod:'5.1',nev:'Leíró statisztika'},
 {kod:'5.1.1',nev:'Adatok gyűjtése, rendszerezése, ábrázolása'},
 {kod:'5.1.2',nev:'Statisztikai mutatók'},
 {kod:'5.2',nev:'A valószínűség-számítás elemei'}
];

const BY_KOD=new Map(TEMAK.map(t=>[t.kod,t]));
export const temaNev=(kod:string|null|undefined)=>kod?BY_KOD.get(kod)?.nev||kod:'';
export const letezoKod=(kod:unknown):kod is string=>typeof kod==='string'&&BY_KOD.has(kod);
/** A fő témakör száma (1–5) egy altémakódból. */
export const temakorSzam=(kod:string|null|undefined)=>kod?kod.split('.')[0]:'';

/** Irányadó pontarányok a vizsgaleírásból (százalék), témakörönként. */
export const ARANYOK:Record<'kozep'|'emelt',Record<string,number>>={
 kozep:{'1':20,'2':25,'3':15,'4':25,'5':15},
 emelt:{'1':20,'2':25,'3':20,'4':20,'5':15}
};

/** A Gemininek átadott lista szövegként. */
export function temaListaSzoveg(){
 const out:string[]=[];
 for(const k of TEMAKOROK){
  out.push(k.szam+'. '+k.nev);
  for(const t of TEMAK.filter(x=>x.kod.split('.')[0]===k.szam))out.push('  '+t.kod+' '+t.nev+(t.emelt?' (emelt)':''));
 }
 return out.join('\n');
}
