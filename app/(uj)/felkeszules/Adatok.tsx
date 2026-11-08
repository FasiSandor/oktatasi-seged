'use client';
import {useEffect,useRef,useState} from 'react';
import {api} from '../../../lib/client-api';

export type Adat={takenOn:string;className:string;grade:number|null;note:string};

export const ma=()=>{
 const d=new Date();
 return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
};

/** „7.b”, „9/A”, „10 c” → 7, 9, 10. Más szövegből nem tippel. */
const evfolyamTipp=(s:string)=>{
 const m=s.match(/^\s*(\d{1,2})\s*[.\-/]?/);
 const n=m?Number(m[1]):0;
 return n>=1&&n<=13?n:null;
};

/**
 * Az óra adatai: dátum, osztály (szabad szöveg, a korábbiakat felkínálja), évfolyam, megjegyzés.
 * Az évfolyamot az osztály nevéből tippeli, de átállítható.
 */
export default function Adatok({adat,onChange,jegyzet}:{adat:Adat;onChange:(a:Adat)=>void;jegyzet?:boolean}){
 const [osztalyok,setOsztalyok]=useState<string[]>([]);
 const kezi=useRef(adat.grade!==null);
 useEffect(()=>{
  api<{classes:{name:string}[]}>('lessons?classes=1').then(r=>setOsztalyok(r.classes.map(c=>c.name).slice(0,8))).catch(()=>{});
 },[]);

 function osztaly(nev:string){
  const tipp=evfolyamTipp(nev);
  onChange({...adat,className:nev,grade:!kezi.current&&tipp?tipp:adat.grade});
 }

 return <div className="pf-adatok">
  <div className="pf-grid">
   <label className="pf-field">Az óra napja
    <input type="date" className="pg-input" value={adat.takenOn} onChange={e=>onChange({...adat,takenOn:e.target.value})}/>
   </label>
   <label className="pf-field">Osztály
    <input className="pg-input" value={adat.className} maxLength={40} placeholder="pl. 7.b" onChange={e=>osztaly(e.target.value)}/>
   </label>
   <label className="pf-field">Évfolyam
    <select className="up-select" value={adat.grade??''} onChange={e=>{kezi.current=true;onChange({...adat,grade:e.target.value?Number(e.target.value):null})}}>
     <option value="">Nincs megadva</option>
     {Array.from({length:13},(_,i)=>i+1).map(g=><option key={g} value={g}>{g}. évfolyam</option>)}
    </select>
   </label>
  </div>
  {osztalyok.length>0&&<div className="us-chips" role="group" aria-label="Korábbi osztályok">
   {osztalyok.map(o=><button key={o} type="button" className="us-chip" aria-pressed={adat.className===o} onClick={()=>osztaly(o)}>{o}</button>)}
  </div>}
  {jegyzet&&<label className="pf-field">Megjegyzés
   <textarea className="pf-area" value={adat.note} maxLength={2000} placeholder="pl. a 4. feladat nem fért bele" onChange={e=>onChange({...adat,note:e.target.value})}/>
  </label>}
 </div>;
}
