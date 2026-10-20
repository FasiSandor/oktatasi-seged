'use client';
import {useEffect,useRef,useState} from 'react';
import {api,ApiError,localPrefs} from '../../lib/client-api';
import {Icon} from './icons';

type Cel={href:string;kulso?:boolean}|{topicId:string;subjectId:string};
type Talalat={kind:'topic'|'doc'|'chapter'|'note'|'task'|'lesson'|'video';id:string;cim:string;alcim:string;cel:Cel;miert?:string};

const IKON:Record<Talalat['kind'],Parameters<typeof Icon>[0]['name']>={topic:'lines',doc:'book',chapter:'book',note:'note',task:'pen',lesson:'lines',video:'wave'};
const FAJTA:Record<Talalat['kind'],string>={topic:'Témák',chapter:'Fejezetek a könyvekben',doc:'Könyvek',lesson:'Tanmenet',task:'Mentett feladatok',note:'Cetlik',video:'Videók'};
const SORREND:Talalat['kind'][]=['topic','chapter','doc','lesson','task','note','video'];

/**
 * Kereső minden oldalon. Ékezet- és elírástűrő keresés a témákban, a könyvek fejezeteiben,
 * a cetlikben, a mentett feladatokban, a tanmenetben és a videókban; kérésre AI-jal tartalmilag is.
 * `kompakt`: csak egy nagyító gomb, rányomva nyílik le (az olvasóban és a Könyvtárban).
 */
export default function Kereso({kompakt,onTopic,onAuth}:{kompakt?:boolean;onTopic?:(topicId:string,subjectId:string)=>void;onAuth?:()=>void}){
 const [nyitva,setNyitva]=useState(!kompakt);
 const [query,setQuery]=useState('');
 const [hits,setHits]=useState<Talalat[]|null>(null);
 const [ai,setAi]=useState<{q:string;hits:Talalat[]}|null>(null);
 const [aiAll,setAiAll]=useState<'idle'|'busy'>('idle');
 const [hiba,setHiba]=useState('');
 const [lista,setLista]=useState(false);
 const doboz=useRef<HTMLDivElement>(null);
 const input=useRef<HTMLInputElement>(null);
 const kerdes=query.trim();

 function hibaKezeles(e:unknown){
  if(e instanceof ApiError&&e.status===401&&onAuth){onAuth();return}
  setHiba(e instanceof Error?e.message:'A keresés nem sikerült.');
 }

 useEffect(()=>{
  setHiba('');
  if(kerdes.length<2){setHits(null);return}
  let el=true;
  const timer=setTimeout(()=>{
   api<{hits:Talalat[]}>('search?q='+encodeURIComponent(kerdes)).then(r=>{if(el){setHits(r.hits);setLista(true)}}).catch(e=>{if(el)hibaKezeles(e)});
  },250);
  return()=>{el=false;clearTimeout(timer)};
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[kerdes]);

 useEffect(()=>{
  function kivul(e:PointerEvent){if(doboz.current&&!doboz.current.contains(e.target as Node)){setLista(false);if(kompakt)setNyitva(false)}}
  window.addEventListener('pointerdown',kivul);return()=>window.removeEventListener('pointerdown',kivul);
 },[kompakt]);
 useEffect(()=>{if(kompakt&&nyitva)setTimeout(()=>input.current?.focus(),30)},[kompakt,nyitva]);

 async function aiKereses(){
  if(kerdes.length<2||aiAll==='busy')return;
  setAiAll('busy');setHiba('');
  try{const r=await api<{hits:Talalat[]}>('ai-search',{method:'POST',body:JSON.stringify({q:kerdes})},60000);setAi({q:kerdes,hits:r.hits});setLista(true)}
  catch(e){hibaKezeles(e)}
  finally{setAiAll('idle')}
 }

 function megnyit(t:Talalat){
  setLista(false);if(kompakt)setNyitva(false);
  const c=t.cel;
  if('topicId' in c){
   if(onTopic){setQuery('');onTopic(c.topicId,c.subjectId);return}
   localPrefs.set('us-subject',c.subjectId);
   window.location.href='/?topic='+encodeURIComponent(c.topicId);return;
  }
  if(c.kulso){window.open(c.href,'_blank','noopener,noreferrer');return}
  window.location.href=c.href;
 }

 const csoportok=SORREND.map(k=>[k,(hits||[]).filter(h=>h.kind===k)] as const).filter(([,l])=>l.length);
 const aiFriss=ai&&ai.q===kerdes;
 const panel=lista&&kerdes.length>=2&&<div className="ks-results" role="listbox" aria-label="Találatok">
  {hits&&hits.length===0&&<p className="ks-empty">Nincs pontos találat erre: „{kerdes}”.</p>}
  {csoportok.map(([k,l])=><div key={k} className="ks-group">
   <p className="ks-head">{FAJTA[k]}</p>
   {l.map(h=><Sor key={h.kind+h.id} t={h} onPick={megnyit}/>)}
  </div>)}
  {aiFriss&&<div className="ks-group ks-ai">
   <p className="ks-head">AI-javaslatok, tartalom alapján</p>
   {ai.hits.length===0?<p className="ks-empty">Az AI sem talált ide illő témát vagy fejezetet.</p>:ai.hits.map(h=><Sor key={'ai'+h.kind+h.id} t={h} onPick={megnyit}/>)}
  </div>}
  {!aiFriss&&<button type="button" className="ks-aibtn" onClick={()=>void aiKereses()} disabled={aiAll==='busy'}>
   <span className="ks-aitag">AI</span>
   <span style={{flex:1}}>{aiAll==='busy'?'Az AI keres a témák és fejezetek között…':'Keresés AI-jal: tartalmilag hasonló is'}</span>
  </button>}
  {hiba&&<p className="ks-empty" role="alert" style={{color:'#9B1C2C'}}>{hiba}</p>}
 </div>;

 if(kompakt&&!nyitva)return <button type="button" className="us-icon-btn" aria-label="Keresés" onClick={()=>setNyitva(true)}><Icon name="search" size={18}/></button>;

 return <div className={'us-search'+(kompakt?' ks-kompakt':'')} ref={doboz}>
  <label className="us-search-field"><Icon name="search" size={18}/><span className="sr-only">Keresés</span>
   <input ref={input} type="search" value={query} onChange={e=>setQuery(e.target.value)} onFocus={()=>{if(hits)setLista(true)}}
    onKeyDown={e=>{if(e.key==='Escape'){setLista(false);if(kompakt)setNyitva(false)}if(e.key==='Enter'&&hits?.[0])megnyit(hits[0])}}
    placeholder="Keresés mindenben" enterKeyHint="search"/>
   {kompakt&&<button type="button" className="ks-close" aria-label="Kereső bezárása" onClick={()=>{setNyitva(false);setLista(false)}}><Icon name="close" size={16}/></button>}
  </label>
  {panel}
 </div>;
}

function Sor({t,onPick}:{t:Talalat;onPick:(t:Talalat)=>void}){
 return <button type="button" role="option" aria-selected="false" className="ks-row" onClick={()=>onPick(t)}>
  <Icon name={IKON[t.kind]} size={18}/>
  <span className="ks-text"><b>{t.cim}</b><small>{t.alcim}{t.miert?' · '+t.miert:''}</small></span>
  {'href' in t.cel&&t.cel.kulso&&<Icon name="external" size={14}/>}
 </button>;
}
