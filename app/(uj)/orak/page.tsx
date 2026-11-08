'use client';
import {useCallback,useEffect,useState} from 'react';
import {api,ApiError,hasSession} from '../../../lib/client-api';
import {Icon} from '../icons';
import Belepes from '../Belepes';
import Kereso from '../Kereso';
import Fiokmenu from '../Fiokmenu';
import {datumSzoveg,type PrepBookSource} from '../../../lib/orafelkeszito';
import {oldalFelirat} from '../../../lib/felkeszules-kliens';

type Ora={id:string;taught_on:string;class_name:string;grade:number|null;topic_id:string|null;topic_name:string;sources:PrepBookSource[];note:string;examples:number;practice:number};

/** Megtartott órák: dátum szerint, szűrés osztályra és témára, kereséssel; megnyitás, nyomtatás, törlés. */
export default function MegtartottOrak(){
 const [phase,setPhase]=useState<'checking'|'login'|'ready'>('checking');
 const [orak,setOrak]=useState<Ora[]|null>(null);
 const [osztalyok,setOsztalyok]=useState<{name:string;lessons:number}[]>([]);
 const [osztaly,setOsztaly]=useState('');
 const [kereses,setKereses]=useState('');
 const [tema,setTema]=useState('');
 const [kesz,setKesz]=useState(true);
 const [toast,setToast]=useState('');

 const fail=useCallback((e:unknown)=>{
  if(e instanceof ApiError&&e.status===401){setPhase('login');return}
  setToast(e instanceof Error?e.message:'Ismeretlen hiba');
 },[]);

 useEffect(()=>{let el=true;hasSession().then(ok=>{if(el)setPhase(ok?'ready':'login')});return()=>{el=false}},[]);
 useEffect(()=>{setTema(new URLSearchParams(window.location.search).get('topic')||'')},[]);
 useEffect(()=>{
  if(phase!=='ready')return;
  api<{classes:{name:string;lessons:number}[];schemaReady:boolean}>('lessons?classes=1').then(r=>{setOsztalyok(r.classes);setKesz(r.schemaReady)}).catch(fail);
 },[phase,fail]);

 useEffect(()=>{
  if(phase!=='ready')return;
  let el=true;
  const t=setTimeout(()=>{
   const p=new URLSearchParams();
   if(osztaly)p.set('class',osztaly);
   if(kereses.trim())p.set('q',kereses.trim());
   if(tema)p.set('topicId',tema);
   api<{lessons:Ora[];schemaReady:boolean}>('lessons'+(p.toString()?'?'+p.toString():'')).then(r=>{if(el){setOrak(r.lessons);setKesz(r.schemaReady)}}).catch(e=>{if(el)fail(e)});
  },kereses?250:0);
  return()=>{el=false;clearTimeout(t)};
 },[phase,osztaly,kereses,tema,fail]);

 async function torol(o:Ora){
  if(!window.confirm('Törlöd ezt a megtartott órát: '+o.topic_name+', '+o.class_name+', '+datumSzoveg(o.taught_on)+'? Nem hozható vissza.'))return;
  try{
   await api('lessons?id='+encodeURIComponent(o.id),{method:'DELETE'});
   setOrak(v=>v?v.filter(x=>x.id!==o.id):v);
   setToast('Törölve.');
  }catch(e){fail(e)}
 }

 if(phase==='checking')return <div className="us-login"><p className="us-status">Betöltés…</p></div>;
 if(phase==='login')return <Belepes onDone={()=>setPhase('ready')}/>;

 const szurt=!!(osztaly||kereses.trim()||tema);
 return <div className="us-app">
  <header className="rd-top">
   <a href="/" className="rd-back"><Icon name="back" size={20} strokeWidth={2.2}/><span>Főoldal</span></a>
   <h1 className="pg-title">Megtartott órák</h1>
   <div className="rd-right">
    <Kereso onAuth={()=>setPhase('login')}/>
    <Fiokmenu/>
   </div>
  </header>
  <main className="pg-main">
   {!kesz&&<p className="up-warn">A megtartott órákhoz le kell futtatni a 012-es adatbázis-frissítést.</p>}
   <div className="pf-szuro">
    <input className="pg-input" type="search" value={kereses} onChange={e=>setKereses(e.target.value)} placeholder="Keresés a témában, osztályban, megjegyzésben" aria-label="Keresés a megtartott órák között" maxLength={100}/>
    {osztalyok.length>0&&<select className="up-select" value={osztaly} onChange={e=>setOsztaly(e.target.value)} aria-label="Osztály">
     <option value="">Minden osztály</option>
     {osztalyok.map(o=><option key={o.name} value={o.name}>{o.name} ({o.lessons})</option>)}
    </select>}
    {tema&&<button type="button" className="us-chip" aria-pressed="true" onClick={()=>{setTema('');window.history.replaceState(null,'','/orak')}}>Egy téma órái ✕</button>}
   </div>

   {orak===null&&<p className="us-status">Betöltés…</p>}
   {orak&&orak.length===0&&kesz&&<section className="us-empty">
    <h2>{szurt?'Nincs ilyen megtartott óra':'Még nincs megtartott óra'}</h2>
    <p>{szurt?'Próbálj másik szűrőt vagy keresést.':'A főoldalon egy téma mellett a „Felkészülés az órára” gombbal készíthetsz felkészülési lapot, és az elmentett lap ide kerül.'}</p>
   </section>}

   <div className="pf-orak">
    {(orak||[]).map(o=><article key={o.id} className="pf-ora">
     <div className="pf-ora-fej">
      <b className="pf-ora-datum">{datumSzoveg(o.taught_on)}</b>
      <span className="pf-tag">{o.class_name}</span>
     </div>
     <a className="pf-ora-tema" href={'/felkeszules?lesson='+encodeURIComponent(o.id)}>{o.topic_name||'Téma nélkül'}</a>
     <p className="pg-meta">{o.examples} mintafeladat, {o.practice} gyakorló feladat{o.sources?.length?' · '+o.sources.map(f=>f.title+' ('+oldalFelirat(f.pages)+')').join('; '):''}</p>
     {o.note&&<p className="pf-ora-jegyzet">{o.note}</p>}
     <div className="pf-actions">
      <a className="us-btn us-btn-ghost" href={'/felkeszules?lesson='+encodeURIComponent(o.id)}><Icon name="pen" size={16}/>Megnyitás</a>
      <a className="us-btn us-btn-ghost" href={'/felkeszules?lesson='+encodeURIComponent(o.id)+'&nezet=tanari'}><Icon name="note" size={16}/>Tanári lap</a>
      <a className="us-btn us-btn-ghost" href={'/felkeszules?lesson='+encodeURIComponent(o.id)+'&nezet=tanuloi'}><Icon name="lines" size={16}/>Tanulói lap</a>
      <button type="button" className="us-icon-btn pf-del" aria-label="Óra törlése" onClick={()=>void torol(o)}><Icon name="trash" size={16}/></button>
     </div>
    </article>)}
   </div>
  </main>
  {toast&&<div className="us-toast" role="status"><span style={{flex:1}}>{toast}</span><button type="button" onClick={()=>setToast('')}>Rendben</button></div>}
 </div>;
}
