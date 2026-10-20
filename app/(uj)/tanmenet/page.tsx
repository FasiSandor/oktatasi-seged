'use client';
import {Suspense,useCallback,useEffect,useMemo,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {api,ApiError,hasSession,localPrefs} from '../../../lib/client-api';
import {readPlanExcel,type ParsedPlan} from '../../../lib/tanmenet-excel';
import {Icon} from '../icons';
import Belepes from '../Belepes';
import Kereso from '../Kereso';
import Fiokmenu from '../Fiokmenu';

type Subject={id:string;name:string};
type Topic={id:string;name:string;parent_id:string|null};
type PlanRow={id:string;subject_id:string;name:string;grade:number|null;school_year:string|null;lessons:number;matched:number};
type Lesson={id:string;position:number;month:string|null;week:number|null;lesson_no:number|null;content:string;topic_id:string|null;topic_name:string|null;parent_name:string|null};
type Plan={id:string;subject_id:string;subject_name:string;name:string;grade:number|null;school_year:string|null};
const XLSX='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export default function TanmenetOldal(){
 return <Suspense fallback={<div className="us-login"><p className="us-status">Betöltés…</p></div>}><Tanmenet/></Suspense>;
}

function putFile(url:string,file:Blob,mime:string):Promise<void>{
 return new Promise((resolve,reject)=>{
  const xhr=new XMLHttpRequest();xhr.open('PUT',url,true);xhr.setRequestHeader('Content-Type',mime);
  xhr.onload=()=>xhr.status>=200&&xhr.status<300?resolve():reject(new Error('A tárhely visszautasította a feltöltést ('+xhr.status+').'));
  xhr.onerror=()=>reject(new Error('Nem sikerült elérni a privát tárhelyet.'));xhr.send(file);
 });
}

function Tanmenet(){
 const params=useSearchParams();
 const [planId,setPlanId]=useState(params.get('plan')||'');
 const fromDoc=params.get('doc')||'';
 const [phase,setPhase]=useState<'checking'|'login'|'ready'>('checking');
 const [subjects,setSubjects]=useState<Subject[]>([]);
 const [subjectId,setSubjectId]=useState('');
 const [plans,setPlans]=useState<PlanRow[]|null>(null);
 const [schemaReady,setSchemaReady]=useState(true);
 const [plan,setPlan]=useState<Plan|null>(null);
 const [lessons,setLessons]=useState<Lesson[]|null>(null);
 const [topics,setTopics]=useState<Topic[]>([]);
 const [editing,setEditing]=useState(false);
 const [draft,setDraft]=useState<Record<string,string>>({});
 const [suggested,setSuggested]=useState<Set<string>>(new Set());
 const [parsed,setParsed]=useState<{data:ParsedPlan;file:Blob;fileName:string;docId:string}|null>(null);
 const [form,setForm]=useState({name:'',grade:'',schoolYear:''});
 const [busy,setBusy]=useState(false);
 const [status,setStatus]=useState('');
 const [toast,setToast]=useState('');

 const fail=useCallback((e:unknown)=>{
  if(e instanceof ApiError&&e.status===401){setPhase('login');return}
  setToast(e instanceof Error?e.message:'Ismeretlen hiba');
 },[]);
 useEffect(()=>{let alive=true;hasSession().then(ok=>{if(alive)setPhase(ok?'ready':'login')});return()=>{alive=false}},[]);

 useEffect(()=>{
  if(phase!=='ready')return;
  api<{subjects:Subject[]}>('subjects').then(s=>{
   setSubjects(s.subjects);
   const saved=localPrefs.get<string>('us-subject','');
   setSubjectId(v=>v||s.subjects.find(x=>x.id===saved)?.id||s.subjects[0]?.id||'');
  }).catch(fail);
 },[phase,fail]);

 const loadPlans=useCallback(async(sid:string)=>{
  const r=await api<{plans:PlanRow[];schemaReady:boolean}>('plans?subjectId='+encodeURIComponent(sid));
  setPlans(r.plans);setSchemaReady(r.schemaReady);
 },[]);
 useEffect(()=>{if(phase==='ready'&&subjectId&&!planId)loadPlans(subjectId).catch(fail)},[phase,subjectId,planId,loadPlans,fail]);

 const loadPlan=useCallback(async(id:string)=>{
  const r=await api<{plan:Plan;lessons:Lesson[]}>('plans?id='+encodeURIComponent(id));
  setPlan(r.plan);setLessons(r.lessons);
  const t=await api<{topics:Topic[]}>('topics?subjectId='+encodeURIComponent(r.plan.subject_id));setTopics(t.topics);
  setDraft(Object.fromEntries(r.lessons.map(l=>[l.id,l.topic_id||''])));setSuggested(new Set());
  if(!r.lessons.some(l=>l.topic_id))setEditing(true);
 },[]);
 useEffect(()=>{if(phase==='ready'&&planId)loadPlan(planId).catch(fail)},[phase,planId,loadPlan,fail]);

 // A Beállítások → Dokumentumok közül indítva: a feltöltött Excelből készül a tanmenet.
 useEffect(()=>{
  if(phase!=='ready'||!fromDoc||parsed)return;
  (async()=>{
   setStatus('Az Excel beolvasása…');
   const {url}=await api<{url:string}>('download?id='+encodeURIComponent(fromDoc));
   const res=await fetch(url);if(!res.ok)throw new Error('A fájl nem tölthető le ('+res.status+').');
   await takeFile(await res.blob(),'tanmenet.xlsx',fromDoc);
  })().catch(e=>{setStatus('');fail(e)});
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[phase,fromDoc]);

 async function takeFile(file:Blob,fileName:string,docId=''){
  const data=await readPlanExcel(file);
  setParsed({data,file,fileName,docId});setStatus('');
  const subj=subjects.find(s=>s.name.toLocaleLowerCase('hu')===data.subjectName.toLocaleLowerCase('hu'));
  if(subj)setSubjectId(subj.id);
  // A fájlban gyakran csupa nagybetű áll („MATEMATIKA”): mondatszerűre igazítjuk.
  const fromFile=data.subjectName&&data.subjectName===data.subjectName.toLocaleUpperCase('hu')?data.subjectName.charAt(0)+data.subjectName.slice(1).toLocaleLowerCase('hu'):data.subjectName;
  const subjName=subj?.name||fromFile||subjects.find(s=>s.id===subjectId)?.name||'Tanmenet';
  setForm({name:[subjName+(data.grade?' '+data.grade+'.':''),data.schoolYear].filter(Boolean).join(' – '),grade:data.grade?String(data.grade):'',schoolYear:data.schoolYear});
 }

 // Ha a fájl hamarabb jött, mint a tantárgylista, utólag választunk tantárgyat.
 useEffect(()=>{
  if(!parsed||subjectId||!subjects.length)return;
  const n=parsed.data.subjectName.toLocaleLowerCase('hu');
  setSubjectId(subjects.find(s=>s.name.toLocaleLowerCase('hu')===n)?.id||subjects[0].id);
 },[parsed,subjects,subjectId]);

 async function savePlan(){
  if(!parsed)return;
  if(!subjectId){setToast('Válaszd ki, melyik tantárgy tanmenete ez.');return}
  setBusy(true);
  try{
   let documentId=parsed.docId;
   if(!documentId){
    // Az eredeti Excel a Dokumentumok közé kerül, hogy később is megvan.
    setStatus('Az eredeti Excel mentése…');
    const up=await api<{documentId:string;uploadUrl:string}>('upload',{method:'POST',body:JSON.stringify({filename:parsed.fileName,title:form.name||parsed.fileName,mimeType:XLSX,size:parsed.file.size})});
    await putFile(up.uploadUrl,parsed.file,XLSX);
    await api('upload/complete',{method:'POST',body:JSON.stringify({documentId:up.documentId})});
    await api('library',{method:'PATCH',body:JSON.stringify({id:up.documentId,role:'plan',subjectId})}).catch(()=>{});
    documentId=up.documentId;
   }
   setStatus('A tanmenet mentése…');
   const r=await api<{plan:{id:string}}>('plans',{method:'POST',body:JSON.stringify({subjectId,name:form.name,grade:form.grade||null,schoolYear:form.schoolYear,documentId,lessons:parsed.data.lessons})});
   setParsed(null);setStatus('');localPrefs.set('us-subject',subjectId);
   window.history.replaceState(null,'','/tanmenet?plan='+r.plan.id);setPlanId(r.plan.id);
  }catch(e){setStatus('');fail(e)}finally{setBusy(false)}
 }

 // AI-javaslat a még üres órákhoz. Kis adagokban küldjük (egy kérés legfeljebb kb. 1 perc lehet),
 // és ha egy adag nem sikerül, a többi attól még megy tovább.
 const PLAN_BATCH=30;
 async function suggest(){
  if(!plan||!lessons)return;
  const open=lessons.filter(l=>!draft[l.id]);
  if(!open.length){setToast('Minden órának van már témája.');return}
  setBusy(true);const found=new Set<string>();const next={...draft};let failed=0;
  const parts=Math.ceil(open.length/PLAN_BATCH);
  try{
   for(let i=0;i<parts;i++){
    const part=open.slice(i*PLAN_BATCH,(i+1)*PLAN_BATCH);
    setStatus('Az AI párosítja az órákat a témákkal: '+(i+1)+'. rész a '+parts+'-ből…');
    try{
     const r=await api<{matches:{key:number;topicId:string}[]}>('ai-match',{method:'POST',body:JSON.stringify({subjectId:plan.subject_id,purpose:'plan',chapters:part.map(l=>({key:l.position,title:l.content.slice(0,400),group:l.month||undefined}))})},65000);
     for(const m of r.matches){const l=part.find(x=>x.position===m.key);if(l){next[l.id]=m.topicId;found.add(l.id)}}
     // Részenként is látszódjon, mi lett kész.
     setDraft({...next});setSuggested(new Set(found));setEditing(true);
    }catch(e){if(e instanceof ApiError&&e.status===401)throw e;failed++}
   }
   setDraft(next);setSuggested(found);setEditing(true);
   setStatus(found.size+' órához javasoltam témát.'+(failed?' '+failed+' rész most nem sikerült; a gombot újra megnyomva csak a még üres órákkal próbálkozom.':'')+' Nézd át, aztán mentsd.');
  }catch(e){setStatus('');fail(e)}finally{setBusy(false)}
 }
 async function saveAssignments(){
  if(!plan||!lessons)return;
  const changes=lessons.filter(l=>(l.topic_id||'')!==(draft[l.id]||'')).map(l=>({lessonId:l.id,topicId:draft[l.id]||null}));
  if(!changes.length){setEditing(false);return}
  setBusy(true);
  try{
   await api('plans',{method:'PATCH',body:JSON.stringify({planId:plan.id,assignments:changes})});
   await loadPlan(plan.id);setEditing(false);setStatus('');setToast(changes.length+' óra témáját elmentettem.');
  }catch(e){fail(e)}finally{setBusy(false)}
 }
 async function removePlan(){
  if(!plan||!window.confirm('Törlöd a(z) „'+plan.name+'” tanmenetet? Az órák és a párosításuk törlődik, az eredeti Excel a Dokumentumok között marad.'))return;
  try{await api('plans?id='+encodeURIComponent(plan.id),{method:'DELETE'});window.location.href='/tanmenet'}catch(e){fail(e)}
 }

 const mains=useMemo(()=>topics.filter(t=>!t.parent_id||!topics.some(p=>p.id===t.parent_id)),[topics]);
 const topicLabel=(id:string)=>{const t=topics.find(x=>x.id===id);if(!t)return '';const p=t.parent_id?topics.find(x=>x.id===t.parent_id):null;return p?p.name+' › '+t.name:t.name};
 const months=useMemo(()=>{
  const out:{month:string;items:Lesson[]}[]=[];
  for(const l of lessons||[]){const m=l.month||'';const last=out[out.length-1];if(last&&last.month===m)last.items.push(l);else out.push({month:m,items:[l]})}
  return out;
 },[lessons]);
 const openTopic=(l:Lesson)=>{
  if(!l.topic_id||!plan)return;
  localPrefs.set('us-subject',plan.subject_id);
  window.location.href='/?topic='+encodeURIComponent(l.topic_id);
 };

 if(phase==='checking')return <div className="us-login"><p className="us-status">Betöltés…</p></div>;
 if(phase==='login')return <Belepes onDone={()=>setPhase('ready')}/>;

 const matched=(lessons||[]).filter(l=>l.topic_id).length;
 return <div className="us-app">
  <header className="rd-top">
   <a href={plan?'/tanmenet':'/'} className="rd-back" onClick={e=>{if(plan){e.preventDefault();setPlan(null);setLessons(null);setPlanId('');window.history.replaceState(null,'','/tanmenet')}}}><Icon name="back" size={20} strokeWidth={2.2}/><span>{plan?'Tanmenetek':'Tananyag'}</span></a>
   <h1 className="pg-title">{plan?plan.name:'Tanmenet'}</h1>
   <div className="rd-right">
    <Kereso onAuth={()=>setPhase('login')}/>
    <Fiokmenu/>
   </div>
  </header>
  <main className="pg-main" style={{maxWidth:900}}>
   {!schemaReady&&<p className="up-warn">A tanmenethez le kell futtatni a 009-es adatbázis-frissítést.</p>}
   {status&&<p className="us-status" role="status" style={{margin:0}}>{status}</p>}

   {/* Lista és új tanmenet */}
   {!plan&&!parsed&&<>
    <section className="pg-section">
     <div className="up-grid">
      <label className="us-field">Tantárgy<select className="up-select" value={subjectId} onChange={e=>{setSubjectId(e.target.value);localPrefs.set('us-subject',e.target.value)}}>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
     </div>
     {plans===null&&<p className="us-status">Betöltés…</p>}
     {plans&&plans.length>0&&<ul className="pg-docs">
      {plans.map(p=><li key={p.id} className="pg-row">
       <Icon name="lines" size={18}/>
       <a href={'/tanmenet?plan='+p.id} onClick={e=>{e.preventDefault();window.history.replaceState(null,'','/tanmenet?plan='+p.id);setPlanId(p.id)}}>{p.name}<br/><small>{p.lessons} óra · {p.matched} témához kötve</small></a>
       <Icon name="next" size={18}/>
      </li>)}
     </ul>}
     {plans&&plans.length===0&&<p className="us-status" style={{margin:0}}>Ennél a tantárgynál még nincs tanmenet.</p>}
    </section>
    <section className="pg-section">
     <h2>Új tanmenet Excelből</h2>
     <p>Az iskolai tanmenet-sablon (Hónap, Hét, Óra, Tananyag oszlopokkal) beolvasható. Minden óra egy sor lesz, és az AI javasol hozzá témát. Az eredeti Excel a Beállítások → Dokumentumok közé kerül.</p>
     <label className={'up-drop'+(!schemaReady||busy?' is-disabled':'')} style={{minHeight:110}}>
      <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={!schemaReady||busy} onChange={e=>{const f=e.currentTarget.files?.[0];e.currentTarget.value='';if(f)void takeFile(f,f.name).catch(fail)}}/>
      <span className="up-drop-icon"><Icon name="upload" size={22}/></span>
      <b>Excel kiválasztása</b><small>.xlsx fájl</small>
     </label>
    </section>
   </>}

   {/* Előnézet mentés előtt */}
   {parsed&&<section className="pg-section">
    <h2>Ezt olvastam ki</h2>
    <p><b>{parsed.data.lessons.length} óra</b>{parsed.data.subjectName&&<> · tantárgy a fájlban: {parsed.data.subjectName}</>}{parsed.data.grade&&<> · {parsed.data.grade}. évfolyam</>}{parsed.data.schoolYear&&<> · {parsed.data.schoolYear}</>}</p>
    <div className="up-grid">
     <label className="us-field">Név<input className="pg-input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} maxLength={160}/></label>
     <label className="us-field">Tantárgy<select className="up-select" value={subjectId} onChange={e=>setSubjectId(e.target.value)}>{!subjectId&&<option value="">Válassz tantárgyat…</option>}{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
     <label className="us-field">Évfolyam<input className="pg-input" inputMode="numeric" value={form.grade} onChange={e=>setForm({...form,grade:e.target.value.replace(/\D/g,'').slice(0,2)})}/></label>
    </div>
    <ol className="pl-preview">{parsed.data.lessons.slice(0,6).map((l,i)=><li key={i}><span>{l.lesson_no??i+1}.</span>{l.content}</li>)}</ol>
    {parsed.data.lessons.length>6&&<p className="us-status" style={{margin:0}}>… és még {parsed.data.lessons.length-6} óra.</p>}
    <div className="up-actions"><button type="button" className="us-btn" onClick={()=>setParsed(null)}>Mégse</button><button type="button" className="us-btn us-btn-dark" disabled={busy||!form.name.trim()||!subjectId} onClick={()=>void savePlan()}>Tanmenet mentése</button></div>
   </section>}

   {/* Egy tanmenet órái */}
   {plan&&lessons&&<>
    <div className="pg-tip" style={{background:matched===lessons.length?'var(--teal-soft)':'var(--warn-soft)',color:matched===lessons.length?'var(--teal-ink)':'var(--warn-ink)'}}>
     <span>{lessons.length} óra, ebből {matched} témához kötve.{editing?' Válaszd ki az órák témáját, vagy kérj javaslatot az AI-tól.':matched?' Koppints egy órára, és megnyílik a témaoldal a könyvekkel.':''}</span>
     {!editing&&<button type="button" className="us-btn" onClick={()=>setEditing(true)}><Icon name="pen" size={16}/>Párosítás</button>}
     {editing&&<>
      <button type="button" className="us-btn" disabled={busy} onClick={()=>void suggest()}>AI-javaslat az üres órákhoz</button>
      <button type="button" className="us-btn us-btn-dark" disabled={busy} onClick={()=>void saveAssignments()}>Mentés</button>
     </>}
    </div>
    {months.map(g=><section key={g.month+g.items[0].id} className="pl-month" aria-label={g.month||'Hónap nélkül'}>
     {g.month&&<h2 className="us-grade-head">{g.month}<small>{g.items.length} óra</small></h2>}
     <ul className="pl-list">
      {g.items.map(l=><li key={l.id}>
       {editing?<div className={'pl-row is-edit'+(suggested.has(l.id)?' is-suggested':'')}>
        <span className="pl-no">{l.lesson_no??l.position+1}.</span>
        <span className="pl-body"><span className="pl-text">{l.content}</span>
         <select className="up-select" value={draft[l.id]||''} onChange={e=>{setDraft({...draft,[l.id]:e.target.value});setSuggested(s=>{const n=new Set(s);n.delete(l.id);return n})}} aria-label={(l.lesson_no??'')+'. óra témája'}>
          <option value="">Nincs témához kötve</option>
          {mains.map(m=><optgroup key={m.id} label={m.name}>{[m,...topics.filter(t=>t.parent_id===m.id)].map(t=><option key={t.id} value={t.id}>{t.id===m.id?m.name+' (egész témakör)':t.name}</option>)}</optgroup>)}
         </select>
         {suggested.has(l.id)&&<small className="pl-hint">AI-javaslat, ellenőrizd</small>}
        </span>
       </div>:<button type="button" className="pl-row" disabled={!l.topic_id} onClick={()=>openTopic(l)}>
        <span className="pl-no">{l.lesson_no??l.position+1}.</span>
        <span className="pl-body"><span className="pl-text">{l.content}</span>{l.topic_id&&<span className="pl-topic">{topicLabel(l.topic_id)||l.topic_name}</span>}</span>
        {l.topic_id&&<Icon name="arrow" size={18}/>}
       </button>}
      </li>)}
     </ul>
    </section>)}
    <div><button type="button" className="us-btn us-btn-ghost" onClick={()=>void removePlan()} style={{color:'var(--danger)'}}><Icon name="trash" size={16}/>Tanmenet törlése</button></div>
   </>}
  </main>
  {toast&&<div className="us-toast" role="status"><span style={{flex:1}}>{toast}</span><button type="button" onClick={()=>setToast('')}>Rendben</button></div>}
 </div>;
}
