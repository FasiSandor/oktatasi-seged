/**
 * Érettségi lapok felismerése és feladatokra bontása, AI nélkül.
 * Bemenet: a PDF oldalai, oldalanként a sorok szövege fentről lefelé
 * (a böngészőben a PDF.js olvassa ki, lásd szoveg.ts).
 * Tiszta függvények: a böngésző (előnézet) és a szerver (mentés, újrabontás) is ezt használja.
 */
export type Oldalak=string[][];
export type Tipus='fl'|'ut';
export type Szint='kozep'|'emelt';
export type Kovetelmeny='2005'|'2017'|'2024';
export type Resz='I'|'II'|'II.A'|'II.B';

export type Azonositas={
 tipus:Tipus|null;szint:Szint|null;datum:string|null;ev:number|null;honap:number|null;
 vizsgakod:string|null;kovetelmeny:Kovetelmeny|null;
 /** Amit a fájlnévből lehetett kiolvasni (csak segítség). */
 nevbol:{tipus?:Tipus;szint?:Szint;ev?:number;honap?:number};
 figyelmeztetesek:string[];
};

const HONAPOK=['január','február','március','április','május','június','július','augusztus','szeptember','október','november','december'];
const ROVID:Record<string,number>={jan:1,feb:2,mar:3,mar_:3,apr:4,maj:5,jun:6,jul:7,aug:8,szep:9,szept:9,okt:10,nov:11,dec:12};
export const honapNev=(h:number|null|undefined)=>h&&h>=1&&h<=12?HONAPOK[h-1]:'';
export const szintNev=(s:string|null|undefined)=>s==='emelt'?'emelt szint':s==='kozep'?'középszint':'';

/** A sorok egységesítése: szóközök, kötőjelek, nem törhető szóköz. */
export function tisztit(s:string){
 return s.replace(/ /g,' ').replace(/[‐-‒]/g,'-').replace(/\s+/g,' ').trim();
}

export function nevbolOlvas(fajlnev:string):Azonositas['nevbol']{
 const n=fajlnev.toLowerCase().replace(/\.pdf$/,'');
 const out:Azonositas['nevbol']={};
 const m=n.match(/^([ke])_mat(?:_(\d{2})([a-z]+))?_(fl|ut)\b/);
 if(m){
  out.szint=m[1]==='k'?'kozep':'emelt';
  out.tipus=m[4] as Tipus;
  if(m[2]){out.ev=2000+Number(m[2]);const h=ROVID[m[3]]||ROVID[m[3].slice(0,3)];if(h)out.honap=h}
  else out.ev=2005;
 }else{
  if(/(^|[_-])fl([_.-]|$)/.test(n))out.tipus='fl';
  if(/(^|[_-])ut([_.-]|$)/.test(n))out.tipus='ut';
 }
 return out;
}

/** Év, időszak, szint, típus és vizsgakód a tartalomból; a fájlnév csak segítség. */
export function azonosit(oldalak:Oldalak,fajlnev:string):Azonositas{
 const sorok=oldalak.flat().map(tisztit);
 const teljes=sorok.join('\n');
 const nevbol=nevbolOlvas(fajlnev);
 const fig:string[]=[];

 let tipus:Tipus|null=null;
 if(/javítási[- ]?értékelési\s*útmutató/i.test(teljes))tipus='ut';
 else if(/Név:|Azonosító jel|Időtartam:|Pótlapok száma/i.test(teljes))tipus='fl';

 const kozep=(teljes.match(/KÖZÉPSZINTŰ|középszint/gi)||[]).length;
 const emelt=(teljes.match(/EMELT SZINTŰ|emelt szint/gi)||[]).length;
 const szint:Szint|null=kozep>emelt?'kozep':emelt>kozep?'emelt':null;

 let datum:string|null=null,ev:number|null=null,honap:number|null=null;
 const dm=teljes.match(new RegExp('(20\\d\\d)\\.\\s*('+HONAPOK.join('|')+')\\s+(\\d{1,2})\\.','i'));
 if(dm){
  ev=Number(dm[1]);honap=HONAPOK.indexOf(dm[2].toLowerCase())+1;
  datum=ev+'-'+String(honap).padStart(2,'0')+'-'+String(Number(dm[3])).padStart(2,'0');
 }

 // Vizsgakód: újabban „K2613”/„E2613”, régen négy számjegy a láblécben (pl. „0511”).
 let vizsgakod:string|null=null;
 const szamol=(re:RegExp,forras:string[])=>{
  const c=new Map<string,number>();
  for(const s of forras)for(const m of s.matchAll(re)){const k=m[1];if(ev&&k===String(ev))continue;c.set(k,(c.get(k)||0)+1)}
  return [...c.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||null;
 };
 vizsgakod=szamol(/\b([KE]\d{4})\b/g,sorok);
 if(!vizsgakod){
  const lablec=sorok.filter(s=>/\d+\s*\/\s*\d+/.test(s)&&/vizsga|összetevő|Matematika/i.test(s));
  vizsgakod=szamol(/(?<![\d.])(\d{4})(?![.\d])/g,lablec);
 }

 let kovetelmeny:Kovetelmeny|null=null;
 if(/Nat\s?2020/i.test(teljes))kovetelmeny='2024';
 else if(ev)kovetelmeny=ev<2017?'2005':ev<2024?'2017':'2024';

 if(nevbol.tipus&&tipus&&nevbol.tipus!==tipus)fig.push('A fájlnév szerint '+(nevbol.tipus==='fl'?'feladatlap':'útmutató')+', a tartalom szerint '+(tipus==='fl'?'feladatlap':'útmutató')+'. A tartalom dönt.');
 if(nevbol.szint&&szint&&nevbol.szint!==szint)fig.push('A fájlnév szerint '+szintNev(nevbol.szint)+', a tartalom szerint '+szintNev(szint)+'. A tartalom dönt.');
 if(nevbol.ev&&ev&&nevbol.ev!==ev)fig.push('A fájlnév szerint '+nevbol.ev+', a tartalom szerint '+ev+'. A tartalom dönt.');
 if(!tipus){tipus=nevbol.tipus||null;fig.push(tipus?'A típust csak a fájlnévből lehetett kiolvasni.':'Nem derült ki, hogy feladatlap vagy útmutató.')}
 const vegsoSzint=szint||nevbol.szint||null;
 if(!szint)fig.push(vegsoSzint?'A szintet csak a fájlnévből lehetett kiolvasni.':'Nem derült ki a szint.');
 if(!datum)fig.push('A vizsga dátumát nem találtam a lapon.');
 return {tipus,szint:vegsoSzint,datum,ev,honap,vizsgakod,kovetelmeny,nevbol,figyelmeztetesek:fig};
}

/* ------------------------------------------------------------------ */
/* Feladatlap                                                          */
/* ------------------------------------------------------------------ */

export type FlSor={
 sorszam:number;reszfeladat:string;resz:Resz;sorrend:number;
 flOldal:number;pont:number|null;megjegyzesek:string[];
};
export type FlEredmeny={sorok:FlSor[];hibak:string[]};

const UGRO_OLDAL=/Fontos tudnivalók/i;
const TABLA_OLDAL=(t:string)=>/ÖSSZESEN|MINDÖSSZESEN/.test(t)&&/maximális|elért/i.test(t);

/** Melyik részhez (I. vagy II.) tartozik az oldal: a láblécből vagy a borítóból. */
function oldalReszek(oldalak:Oldalak):('I'|'II')[]{
 const ismert:(('I'|'II')|null)[]=oldalak.map(lines=>{
  const t=lines.map(tisztit).join(' ');
  const m=t.match(/(?:^|[\s,])(II|I)\.\s*(?:összetevő\s*,?\s*)?\d{1,2}\s*\/\s*\d{1,2}/);
  if(m)return m[1] as 'I'|'II';
  const b=t.match(/Matematika\s+(II|I)\.\s+(?:Nat|[KE]?\d{4})|(?:\d{4}\s+)(II|I)\.\s*összetevő/);
  if(b)return (b[1]||b[2]) as 'I'|'II';
  return null;
 });
 const out:('I'|'II')[]=[];
 let elozo:'I'|'II'='I';
 for(let i=0;i<ismert.length;i++){
  const v=ismert[i];
  if(v){elozo=v;out.push(v);continue}
  // Ismeretlen oldal (pl. üres pótlap): a következő ismert oldalé, ha az a rész eleje.
  const kov=ismert.slice(i+1).find(x=>x);
  out.push(kov==='II'&&elozo==='I'&&lines2(oldalak[i]).some(s=>/^II\.?$/.test(s))?'II':elozo);
 }
 return out;
}
const lines2=(l:string[])=>l.map(tisztit);

export function bontFeladatlap(oldalak:Oldalak,szint:Szint|null):FlEredmeny{
 const hibak:string[]=[];
 const reszek=oldalReszek(oldalak);
 type Munka={sorszam:number;resz:'I'|'II';oldal:number;kerdesOldal:Map<string,number>;reszPont:Map<string,number>;ossz:number|null;laza:number;tabla:number|null};
 const feladatok:Munka[]=[];
 let akt:Munka|null=null;
 let bTol=0,bIg=0;
 const tabla=new Map<number,number>();

 for(let p=0;p<oldalak.length;p++){
  const sorok=lines2(oldalak[p]).filter(Boolean);
  const t=sorok.join('\n');
  if(TABLA_OLDAL(t)){
   for(const m of t.matchAll(/(\d{1,2})\.\s*feladat\s+(\d{1,2})\b/g))tabla.set(Number(m[1]),Number(m[2]));
   for(const m of t.matchAll(/(?:^|\s)(\d{1,2})\.\s+(\d{1,2})(?=\s|$)/g))if(!tabla.has(Number(m[1])))tabla.set(Number(m[1]),Number(m[2]));
   continue;
  }
  if(UGRO_OLDAL.test(t))continue;
  for(const sor of sorok){
   const br=sor.match(/(\d{1,2})\.?\s*[–-]\s*(\d{1,2})\.\s*feladatok közül/);
   if(br){bTol=Number(br[1]);bIg=Number(br[2])}
   const varhato=(feladatok.at(-1)?.sorszam||0)+1;
   // Régi lapokon a fejléc („… Azonosító jel:”) egy sorba kerülhet a feladat elejével.
   const fm=sor.match(/^(?:.{0,60}Azonosító jel:?\s*)?(\d{1,2})\.(?:\s+(.*))?$/);
   if(fm&&Number(fm[1])===varhato&&!/^(feladat|ábra|oldal|rész|összetevő|osztály)/i.test(fm[2]||'')){
    akt={sorszam:varhato,resz:reszek[p],oldal:p+1,kerdesOldal:new Map(),reszPont:new Map(),ossz:null,laza:0,tabla:null};
    feladatok.push(akt);
    const elso=(fm[2]||'').match(/^([a-h])\)\s+\S/);
    if(elso)akt.kerdesOldal.set(elso[1],p+1);
    continue;
   }
   if(!akt)continue;
   const rp=sor.match(/^([a-h])\)\s*(\d{1,2})\s*pont\b/);
   if(rp){akt.reszPont.set(rp[1],Number(rp[2]));continue}
   const op=sor.match(/^Ö\.?\s*:?\s*(\d{1,3})\s*pont/);
   if(op){akt.ossz=Number(op[1]);continue}
   const kq=sor.match(/^([a-h])\)\s+(.+)/);
   if(kq&&!akt.kerdesOldal.has(kq[1]))akt.kerdesOldal.set(kq[1],p+1);
   const lp=sor.match(/(?:^|\s)(\d{1,2})\s*pont\s*\.?$/);
   if(lp&&!/feladat|összesen/i.test(sor))akt.laza+=Number(lp[1]);
  }
 }

 const sorok:FlSor[]=[];
 let sorrend=0;
 for(const f of feladatok){
  f.tabla=tabla.get(f.sorszam)??null;
  let resz:Resz=f.resz;
  if(f.resz==='II'&&szint!=='emelt'){
   if(bTol&&bIg)resz=f.sorszam>=bTol&&f.sorszam<=bIg?'II.B':'II.A';
  }
  const betuk=[...new Set([...f.reszPont.keys(),...f.kerdesOldal.keys()])].sort();
  const egybeVett=(osszeg:number,forras:string)=>{
   const m:string[]=[];
   if(f.ossz!==null&&f.ossz!==osszeg)m.push('A pontok összege ('+osszeg+') eltér a feladat összpontszámától ('+f.ossz+').');
   if(f.tabla!==null&&f.tabla!==osszeg&&resz!=='II.B')m.push('A '+forras+' összege ('+osszeg+') eltér a pontozótáblázattól ('+f.tabla+').');
   return m;
  };
  if(betuk.length){
   const osszeg=betuk.reduce((s,b)=>s+(f.reszPont.get(b)||0),0);
   const kozos=egybeVett(osszeg,'részpontok');
   for(const b of betuk){
    const pont=f.reszPont.get(b)??null;
    const m=[...kozos];
    if(pont===null)m.push('A részfeladat pontszáma nem olvasható ki.');
    sorok.push({sorszam:f.sorszam,reszfeladat:b,resz,sorrend:++sorrend,flOldal:f.kerdesOldal.get(b)||f.oldal,pont,megjegyzesek:m});
   }
  }else{
   const pont=f.ossz??(f.laza||f.tabla||null);
   const m=pont===null?['A pontszám nem olvasható ki.']:egybeVett(pont,'pontok');
   sorok.push({sorszam:f.sorszam,reszfeladat:'',resz,sorrend:++sorrend,flOldal:f.oldal,pont,megjegyzesek:m});
  }
 }

 const db=feladatok.length;
 if(!db)hibak.push('Egyetlen feladatot sem sikerült felismerni a lapon.');
 else if(szint==='kozep'&&db!==18)hibak.push('Középszinten 18 feladat szokott lenni, itt '+db+' lett.');
 else if(szint==='emelt'&&db!==9)hibak.push('Emelt szinten 9 feladat szokott lenni, itt '+db+' lett.');
 if(szint!=='emelt'&&feladatok.some(f=>f.resz==='II')&&!(bTol&&bIg))hibak.push('Nem találtam, melyik feladatok tartoznak a II. B részhez.');
 return {sorok,hibak};
}

/* ------------------------------------------------------------------ */
/* Javítási útmutató                                                   */
/* ------------------------------------------------------------------ */

export type UtTalalat={oldal:Map<string,number>;pont:Map<string,number>;hibak:string[]};
const UT_UTASITAS=/Fontos tudnivalók|Tartalmi kérések|Formai előírások|jutalompont|pontlevonás/i;

export function bontUtmutato(oldalak:Oldalak,feladatSzamok:number[]):UtTalalat{
 const hibak:string[]=[];
 const ismert=new Set(feladatSzamok);
 const tiszta=oldalak.map(lines2);
 // Honnan indulnak a megoldások: az „I.” címtől, ha nincs, az utolsó utasításoldal után.
 let kezdo=tiszta.findIndex(l=>l.some(s=>/^I\.?(\s*rész)?$/.test(s)));
 if(kezdo<0){
  let utolso=-1;tiszta.forEach((l,i)=>{if(UT_UTASITAS.test(l.join(' ')))utolso=i});
  kezdo=utolso+1;
 }
 const oldal=new Map<string,number>(),pont=new Map<string,number>();
 let aktFeladat=0,aktKulcs='';
 for(let p=Math.max(0,kezdo);p<tiszta.length;p++){
  for(const sor of tiszta[p]){
   const m=sor.match(/^(\d{1,2})\.\s*(?:([a-h])\))?(?=\s|$|[a-h]\))/);
   if(m&&ismert.has(Number(m[1]))&&Number(m[1])>=aktFeladat){
    const n=Number(m[1]),b=m[2]||'';
    // Egy feladat sorszáma csak előre haladhat; ugyanaz a szám újra jöhet (második megoldás).
    if(n>aktFeladat||b||sor.length<=4){
     aktFeladat=n;aktKulcs=n+'|'+b;
     if(!oldal.has(aktKulcs))oldal.set(aktKulcs,p+1);
     if(!oldal.has(n+'|'))oldal.set(n+'|',p+1);
    }
   }
   const o=sor.match(/Összesen:?\s*(\d{1,3})\s*pont/);
   if(o&&aktKulcs&&!pont.has(aktKulcs))pont.set(aktKulcs,Number(o[1]));
  }
 }
 const hianyzo=feladatSzamok.filter(n=>!oldal.has(n+'|'));
 if(hianyzo.length)hibak.push('Az útmutatóban nem találtam ezeket a feladatokat: '+hianyzo.join(', ')+'.');
 return {oldal,pont,hibak};
}

/* ------------------------------------------------------------------ */
/* Összevetés                                                          */
/* ------------------------------------------------------------------ */

export type KeszSor=FlSor&{utOldal:number|null;ellenorzes:string[]};

export function osszevet(fl:FlEredmeny,ut:UtTalalat|null):{sorok:KeszSor[];hibak:string[]}{
 const hibak=[...fl.hibak,...(ut?.hibak||[])];
 const sorok:KeszSor[]=fl.sorok.map(s=>{
  const e=[...s.megjegyzesek];
  let utOldal:number|null=null;
  if(ut){
   utOldal=ut.oldal.get(s.sorszam+'|'+s.reszfeladat)??ut.oldal.get(s.sorszam+'|')??null;
   if(utOldal===null)e.push('A feladat nem található az útmutatóban.');
   const up=ut.pont.get(s.sorszam+'|'+s.reszfeladat)??(s.reszfeladat?undefined:ut.pont.get(s.sorszam+'|'));
   if(up!==undefined&&s.pont!==null&&up!==s.pont)e.push('Pontszám: a feladatlapon '+s.pont+', az útmutatóban '+up+'.');
  }
  return {...s,utOldal,ellenorzes:e};
 });
 return {sorok,hibak};
}

/** Rövid felirat egy feladathoz, pl. „17. e)”. */
export const feladatCimke=(sorszam:number,reszfeladat:string)=>sorszam+'.'+(reszfeladat?' '+reszfeladat+')':'');
export const reszNev=(r:string)=>r==='I'?'I. rész':r==='II.A'?'II. A rész':r==='II.B'?'II. B rész':'II. rész';
