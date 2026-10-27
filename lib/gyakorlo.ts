/**
 * Gyakorló, tudáspróba, témazáró és hasonló fejezetek felismerése a címből.
 * Ezeknek a címéből nem derül ki a téma, ezért a nagy fejezet (csoport) témakörét kapják.
 * A cím elején, egész szóra illeszkedik: az „Ismétléses permutáció” és az „Ismétlés nélküli variáció” nem gyakorló fejezet.
 */
const MINTAK=[
 'gyakorlas','gyakorlo feladatok','gyakorlo','tudasproba','temazaro','temazaro feladatsor',
 'osszefoglalas','osszefoglalo','osszefoglalo feladatok','ismetles','ismetlo feladatok',
 'feladatgyujtemeny','vegyes feladatok','felmero','felmero feladatsor','probadolgozat'
];
const MINTA=new RegExp('^(?:\\d+\\.?\\s*)?('+MINTAK.sort((a,b)=>b.length-a.length).join('|')+')($|[^a-z])');
const KIVETEL=/^(?:\d+\.?\s*)?ismetles nelkul/;

export function normalCim(cim:string):string{
 return cim.toLocaleLowerCase('hu').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,' ').trim();
}

export function gyakorloFejezet(cim:string|null|undefined):boolean{
 if(!cim)return false;
 const c=normalCim(cim);
 return MINTA.test(c)&&!KIVETEL.test(c);
}

/**
 * Nem tartalmi sorok (végeredmények, megoldások, tárgymutató, előszó stb.).
 * Ezek semmilyen témához nem tartoznak: csak a tartalomjegyzékben és a keresőben látszanak.
 * A teljes címre illeszkedik, hogy pl. az „Egyenletek megoldása” ne essen bele.
 */
const NEM_TARTALMI=[
 'a feladatok vegeredmenyei','feladatok vegeredmenyei','vegeredmenyek','a feladatok megoldasai','feladatok megoldasai',
 'megoldasok','megoldokulcs','targymutato','nev- es targymutato','nevmutato','fogalomtar','irodalomjegyzek',
 'felhasznalt irodalom','forrasjegyzek','kepjegyzek','abrajegyzek','kepek forrasa','eloszo','tartalom','tartalomjegyzek','impresszum'
];
export function nemTartalmi(cim:string|null|undefined):boolean{
 if(!cim)return false;
 const c=normalCim(cim).replace(/^(?:\d+\.?\s*)/,'').replace(/[.:]+$/,'').trim();
 return NEM_TARTALMI.includes(c);
}
