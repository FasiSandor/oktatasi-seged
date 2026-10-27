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
