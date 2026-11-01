'use client';
import {api,ApiError,localPrefs} from '../../../lib/client-api';
import {TEMAK,TEMAKOROK,temaNev} from '../../../lib/feladatbank/temak';
import {honapNev,szintNev} from '../../../lib/feladatbank/felismeres';

export type Vizsga={id:string;szint:string;datum:string;ev:number;honap:number;vizsgakod:string|null;kovetelmeny:string|null;allapot:string;bontas_hibak:string[];
 feladatok?:number;besorolt?:number;ellenorizendo?:number;pontok?:number;van_fl?:boolean;van_ut?:boolean};
export type Feladat={id:string;vizsga_id?:string;sorszam:number;reszfeladat:string;resz:string;sorrend?:number;fl_oldal:number|null;ut_oldal:number|null;pont:number|null;
 bontas_megjegyzes:string[];fo_kod:string|null;mellek_kod:string|null;szoveges:boolean;megjegyzes:string|null;biztos:boolean|null;ai_fo_kod?:string|null;ai_futott:boolean;
 jovahagyva?:boolean;kezzel?:boolean;ellenorizendo?:boolean;szint?:string;ev?:number;honap?:number};

export const vizsgaCim=(v:{ev?:number;honap?:number;szint?:string})=>(v.ev||'')+'. '+honapNev(v.honap)+', '+szintNev(v.szint);
export const ALLAPOT:Record<string,string>={hianyos:'Hiányos',bontva:'Feladatokra bontva',besorolva:'Besorolva'};

export const gondolkodasBe=()=>localPrefs.get<boolean>('fb-gondolkodas',false);
export const gondolkodasMent=(v:boolean)=>localPrefs.set('fb-gondolkodas',v);

/**
 * Egy lappár besorolása: előbb az I., aztán a II. rész, külön kérésben
 * (így egy kérés biztosan belefér a Vercel kb. 60 másodperces korlátjába).
 */
export async function besorol(vizsgaId:string,gondolkodas:boolean,jelez:(s:string)=>void){
 const eredmeny:string[]=[];
 for(const resz of ['I','II'] as const){
  jelez((resz==='I'?'I. rész':'II. rész')+' besorolása…');
  try{
   const r=await api<{besorolt:number;osszes:number;mp:number}>('feladatbank/besorolas',{method:'POST',body:JSON.stringify({vizsgaId,resz,gondolkodas})},65000);
   eredmeny.push((resz==='I'?'I. rész: ':'II. rész: ')+r.besorolt+'/'+r.osszes+' ('+String(r.mp).replace('.',',')+' mp)');
  }catch(e){
   if(e instanceof ApiError&&e.status===401)throw e;
   eredmeny.push((resz==='I'?'I. rész: ':'II. rész: ')+(e instanceof Error?e.message:'hiba'));
  }
 }
 return eredmeny.join(' · ');
}

/** Altémaválasztó a témakörlistából, témakörök szerint csoportosítva. */
export function TemaValaszto({value,onChange,ures,label}:{value:string|null;onChange:(kod:string)=>void;ures?:string;label:string}){
 return <select className="up-select fb-select" value={value||''} aria-label={label} onChange={e=>onChange(e.target.value)}>
  <option value="">{ures||'Válassz altémát…'}</option>
  {TEMAKOROK.map(k=><optgroup key={k.szam} label={k.szam+'. '+k.nev}>
   {TEMAK.filter(t=>t.kod.split('.')[0]===k.szam).map(t=><option key={t.kod} value={t.kod}>{t.kod} {t.nev}</option>)}
  </optgroup>)}
 </select>;
}

export const temaFelirat=(kod:string|null)=>kod?kod+' '+temaNev(kod):'nincs besorolva';

/** Miért van egy feladat az Ellenőrizendő listán, hétköznapi mondatokban. */
export function ellenorzesOkai(f:Feladat){
 const ok=[...(f.bontas_megjegyzes||[])];
 if(f.fo_kod&&f.biztos===false)ok.push('Az AI nem biztos a besorolásban.');
 if(f.ai_futott&&!f.fo_kod)ok.push('Az AI nem adott besorolást.');
 return ok;
}

export const lapLink=(vizsgaId:string,tipus:'fl'|'ut',f?:{fl_oldal:number|null;ut_oldal:number|null}|null)=>
 '/feladatbank/lap?vizsga='+vizsgaId+'&tipus='+tipus+(f?.fl_oldal?'&fl='+f.fl_oldal:'')+(f?.ut_oldal?'&ut='+f.ut_oldal:'');
