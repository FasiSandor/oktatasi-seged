/**
 * NAT 2020 Mathematics 9–12: the 12 official main-topic headings.
 * Reference: 5/2020. (I. 31.) Korm. rendelet, NAT Mathematics B) FŐ TÉMAKÖRÖK.
 * https://njt.jog.gov.hu/jogszabaly/2020-5-20-22.0
 *
 * Teaching subtopics below are editorial DRAFT index suggestions, not quotes
 * and not a binding grade-by-grade syllabus. Reviewed framework and exam
 * requirements are needed before publishing any suggested placement.
 */
export const mathematicsTechnikumBlueprint = {
  version: 'nat2020-mathematics-9-12-draft-1',
  name: 'Matematika – technikum 9–12.',
  educationType: 'technikum',
  gradeFrom: 9,
  gradeTo: 12,
  status: 'draft',
  gradePlacementsVerified: false,
  sources: [
    {type:'nat',title:'NAT 2020 – Matematika, 9–12. évfolyam',
     url:'https://njt.jog.gov.hu/jogszabaly/2020-5-20-22.0',verified:true},
    {type:'framework',title:'NAT 2020-hoz illeszkedő matematika kerettanterv',verified:false},
    {type:'exam_requirements',title:'Matematika érettségi vizsgakövetelmények (2024-től)',url:'https://www.oktatas.hu/pub_bin/dload/kozoktatas/erettsegi/vizsgakovetelmenyek2024/matematika_2024_e.pdf',verified:false}
  ],
  topics: [
    {id:'sets-logic',name:'Gondolkodási módszerek – halmazok, matematikai logika',lessons:['Halmazok, részhalmazok','Halmazműveletek, Venn-diagramok','Állítások és logikai műveletek','Bizonyítási gondolatmenetek']},
    {id:'combinatorics',name:'Gondolkodási módszerek – kombinatorika, gráfok',lessons:['Leszámlálási alapelvek','Faktoriális és permutáció','Ismétléses permutáció','Variáció ismétlés nélkül','Variáció ismétléssel','Kombináció ismétlés nélkül','Kombináció ismétléssel','Gráfok és alkalmazásaik']},
    {id:'arithmetic',name:'Aritmetika, algebra – alapműveletek, valós számok, százalékszámítás, betűs kifejezések',lessons:['Számhalmazok, valós számok','Műveleti sorrend, becslés és kerekítés','Arányosság és százalékszámítás','Algebrai kifejezések és azonosságok','Polinomok és algebrai törtek']},
    {id:'powers',name:'Aritmetika, algebra – hatvány, gyök, logaritmus',lessons:['Hatványozás és azonosságai','Gyökvonás és gyökös kifejezések','Racionális kitevőjű hatványok','A logaritmus fogalma és azonosságai']},
    {id:'number-theory',name:'Aritmetika, algebra – természetes számok halmaza, számelméleti ismeretek',lessons:['Oszthatóság és oszthatósági szabályok','Prímtényezős felbontás','Legnagyobb közös osztó és legkisebb közös többszörös']},
    {id:'equations',name:'Aritmetika, algebra – egyenletek, egyenlőtlenségek, egyenletrendszerek',lessons:['Elsőfokú egyenletek, egyenlőtlenségek','Egyenletrendszerek','Másodfokú egyenletek és egyenlőtlenségek','Szöveges feladatok egyenletekkel','Egyszerű exponenciális és logaritmikus egyenletek']},
    {id:'functions',name:'Függvények és sorozatok',lessons:['Függvényfogalom és ábrázolás','Lineáris és abszolútérték-függvény','Másodfokú függvény','Függvénytranszformációk','Exponenciális és logaritmusfüggvény','Számtani és mértani sorozatok']},
    {id:'plane-geometry',name:'Geometria – síkgeometria',lessons:['Háromszögek, nevezetes vonalak','Négyszögek és sokszögek','Geometriai transzformációk','Kör, körcikk, körív','Kerület- és területszámítás']},
    {id:'solid-geometry',name:'Geometria – térgeometria',lessons:['Testek, felszín és térfogat','Hasáb és henger','Gúla és kúp','Gömb és összetett testek']},
    {id:'trigonometry',name:'Geometria – trigonometria',lessons:['Hegyesszögek szögfüggvényei','Derékszögű háromszög feladatai','Szinusz- és koszinusztétel','Trigonometria alkalmazásai']},
    {id:'analytic-geometry',name:'Geometria – koordinátageometria',lessons:['Vektorok és koordináták','Egyenes egyenlete','Két egyenes helyzete','A kör egyenlete']},
    {id:'statistics-probability',name:'Statisztika és valószínűség',lessons:['Adatok ábrázolása','Középértékek és szóródás','Események és valószínűség','Klasszikus valószínűségi modell','Függetlenség és alkalmazások']}
  ]
} as const;
