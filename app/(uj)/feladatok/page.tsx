'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {api,ApiError,hasSession,localPrefs} from '../../../lib/client-api';
import {Icon} from '../icons';
import Belepes from '../Belepes';
import Feladatok,{type Task} from '../Feladatok';

type Subject={id:string;name:string};

/** Feladataim: az összes mentett feladat, témánként csoportosítva. */
export default function FeladataimOldal(){
 const [phase,setPhase]=useState<'checking'|'login'|'ready'>('checking');
 const [tasks,setTasks]=useState<Task[]|null>(null);
 const [subjects,setSubjects]=useState<Subject[]>([]);
 const [subjectId,setSubjectId]=useState('');
 const [schemaReady,setSchemaReady]=useState(true);
 const [toast,setToast]=useState('');
 const fail=useCallback((e:unknown)=>{
  if(e instanceof ApiError&&e.status===401){setPhase('login');return}
  setToast(e instanceof Error?e.message:'Ismeretlen hiba');
 },[]);
 useEffect(()=>{let alive=true;hasSession().then(ok=>{if(alive)setPhase(ok?'ready':'login')});return()=>{alive=false}},[]);
 useEffect(()=>{
  if(phase!=='ready')return;
  Promise.all([api<{tasks:Task[];schemaReady:boolean}>('tasks'),api<{subjects:Subject[]}>('subjects')]).then(([t,s])=>{
   setTasks(t.tasks);setSchemaReady(t.schemaReady);setSubjects(s.subjects);
   const saved=localPrefs.get<string>('us-subject','');
   setSubjectId(s.subjects.some(x=>x.id===saved)?saved:'');
  }).catch(fail);
 },[phase,fail]);

 const groups=useMemo(()=>{
  const list=(tasks||[]).filter(t=>!subjectId||t.subject_id===subjectId);
  const m=new Map<string,Task[]>();
  for(const t of list){const k=t.topic_name||'Téma nélkül';const g=m.get(k);if(g)g.push(t);else m.set(k,[t])}
  return [...m.entries()];
 },[tasks,subjectId]);

 if(phase==='checking')return <div className="us-login"><p className="us-status">Betöltés…</p></div>;
 if(phase==='login')return <Belepes onDone={()=>setPhase('ready')}/>;

 return <div className="us-app">
  <header className="rd-top">
   <a href="/" className="rd-back"><Icon name="back" size={20} strokeWidth={2.2}/><span>Tananyag</span></a>
   <h1 className="pg-title">Feladataim</h1>
   <select className="up-select" value={subjectId} onChange={e=>setSubjectId(e.target.value)} aria-label="Tantárgy" style={{marginLeft:'auto'}}>
    <option value="">Minden tantárgy</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
   </select>
  </header>
  <main className="pg-main">
   {!schemaReady&&<p className="up-warn">A mentett feladatokhoz le kell futtatni a 010-es adatbázis-frissítést.</p>}
   {tasks===null&&<p className="us-status">Betöltés…</p>}
   {tasks&&groups.length===0&&schemaReady&&<section className="us-empty"><h2>Még nincs mentett feladat</h2><p>Az olvasóban az AI gombbal keretezz be egy feladatot, kérj hozzá segítséget, és mentsd el. Itt és a témaoldalon is megtalálod.</p></section>}
   {groups.map(([topic,list])=><section key={topic} className="pg-group" aria-label={topic}>
    <h2 className="us-grade-head">{topic}<small>{list.length} feladat</small></h2>
    <Feladatok tasks={list} onRemoved={id=>setTasks(v=>v?v.filter(x=>x.id!==id):v)} onError={fail}/>
   </section>)}
  </main>
  {toast&&<div className="us-toast" role="status"><span style={{flex:1}}>{toast}</span><button type="button" onClick={()=>setToast('')}>Rendben</button></div>}
 </div>;
}
