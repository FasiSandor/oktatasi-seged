'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {api,ApiError,hasSession,localPrefs,signOut} from '../../lib/client-api';
import {Icon,spineColor} from './icons';
import {konyvCim} from '../../lib/konyv-cim';
import Belepes from './Belepes';

type Subject={id:string;name:string};
type Topic={id:string;name:string;parent_id:string|null;position:number};
type Profile={id:string;name:string;grade_from:number;grade_to:number};
type Placement={id:string;topic_id:string;grade:number;suggested_minutes:number|null};
type Doc={id:string;title:string;filename:string;mime_type:string;link_id?:string;pdf_page?:number|null;chapter_title?:string|null;category?:string};
type Tool={id:string;label:string;url:string;provider:string};
type Workspace={notes:string;questions:{question:string;answer:string}[]};
type LastRead={document_id:string;pdf_page:number|null;title:string;filename:string|null};
type SearchHit={kind:'topic';id:string;name:string;subject_id:string;subject_name:string}|{kind:'doc';id:string;title:string};

/** Egy tanóra 45 perc: az adatbázis percben tárolja az ajánlott időt. */
const LESSON_MINUTES=45;
const GRADES=[9,10,11,12];
const KIND:Record<string,string>={reference:'Tankönyv',exercise:'Feladatgyűjtemény',worksheet:'Feladatlap',solution:'Megoldókulcs',notes:'Jegyzet',table:'Függvénytáblázat'};

export default function Tananyag(){
 const [phase,setPhase]=useState<'checking'|'login'|'ready'>('checking');
 const [subjects,setSubjects]=useState<Subject[]>([]);
 const [subjectId,setSubjectId]=useState('');
 const [topics,setTopics]=useState<Topic[]>([]);
 const [profile,setProfile]=useState<Profile|null>(null);
 const [placements,setPlacements]=useState<Placement[]>([]);
 const [curriculumReady,setCurriculumReady]=useState(true);
 const [grade,setGrade]=useState(9);
 const [showAll,setShowAll]=useState(false);
 const [openId,setOpenId]=useState('');
 const [selectedId,setSelectedId]=useState('');
 const [docs,setDocs]=useState<Doc[]|null>(null);
 const [tools,setTools]=useState<Tool[]>([]);
 const [workspace,setWorkspace]=useState<Workspace|null>(null);
 const [notesDraft,setNotesDraft]=useState('');
 const [notesState,setNotesState]=useState<'idle'|'saving'|'saved'|'unavailable'>('idle');
 const [busy,setBusy]=useState(false);
 const [toast,setToast]=useState('');
 const [menuOpen,setMenuOpen]=useState(false);
 const [query,setQuery]=useState('');
 const [hits,setHits]=useState<SearchHit[]|null>(null);
 const [editBooks,setEditBooks]=useState(false);
 const [lastRead,setLastRead]=useState<LastRead|null>(null);
 const searchBox=useRef<HTMLDivElement>(null);
 const menuBox=useRef<HTMLDivElement>(null);

 const fail=useCallback((e:unknown)=>{
  if(e instanceof ApiError&&e.status===401){setPhase('login');return}
  setToast(e instanceof Error?e.message:'Ismeretlen hiba');
 },[]);

 useEffect(()=>{let alive=true;hasSession().then(ok=>{if(alive)setPhase(ok?'ready':'login')});return()=>{alive=false}},[]);

 const loadSubjects=useCallback(async()=>{
  const data=await api<{subjects:Subject[]}>('subjects');
  setSubjects(data.subjects);
  const saved=localPrefs.get<string>('us-subject','');
  const pick=data.subjects.find(s=>s.id===saved)?.id||data.subjects[0]?.id||'';
  setSubjectId(pick);
 },[]);
 useEffect(()=>{if(phase==='ready')loadSubjects().catch(fail)},[phase,loadSubjects,fail]);
 // Az utoljára olvasott könyv és oldal, bármelyik eszközön nyitottad meg.
 useEffect(()=>{if(phase==='ready')api<{last:LastRead|null}>('reading').then(r=>setLastRead(r.last)).catch(()=>{})},[phase]);
 // Az olvasóból visszatérve (/?topic=…) ugyanaz a téma legyen kiválasztva.
 const backTopic=useRef(typeof window!=='undefined'?new URLSearchParams(window.location.search).get('topic')||'':'');
 useEffect(()=>{
  const id=backTopic.current;if(!id||!topics.length)return;
  if(topics.some(t=>t.id===id)){setShowAll(true);setSelectedId(id)}
  backTopic.current='';window.history.replaceState(null,'','/');
 },[topics]);

 const loadCurriculum=useCallback(async(id:string)=>{
  const [t]=await Promise.all([api<{topics:Topic[]}>('topics?subjectId='+encodeURIComponent(id))]);
  setTopics(t.topics);
  try{
   const p=await api<{profiles:Profile[]}>('curriculum?subjectId='+encodeURIComponent(id));
   const first=p.profiles[0]||null;setProfile(first);setCurriculumReady(true);
   if(first){const pl=await api<{placements:Placement[]}>('curriculum/placements?profileId='+encodeURIComponent(first.id));setPlacements(pl.placements)}
   else setPlacements([]);
  }catch(e){
   if(e instanceof ApiError&&e.status===401)throw e;
   // A tantervi táblák hiánya nem akadályozhatja a könyvek megnyitását.
   setProfile(null);setPlacements([]);setCurriculumReady(false);
  }
 },[]);

 useEffect(()=>{
  if(!subjectId)return;
  localPrefs.set('us-subject',subjectId);
  const prefs=localPrefs.get<{grade?:number;open?:string;selected?:string}>('us-view-'+subjectId,{});
  setGrade(GRADES.includes(prefs.grade||0)?prefs.grade!:9);
  setOpenId(prefs.open||'');setSelectedId(prefs.selected||'');setShowAll(false);
  setTopics([]);setDocs(null);
  loadCurriculum(subjectId).catch(fail);
 },[subjectId,loadCurriculum,fail]);

 useEffect(()=>{if(subjectId)localPrefs.set('us-view-'+subjectId,{grade,open:openId,selected:selectedId})},[subjectId,grade,openId,selectedId]);

 const mains=useMemo(()=>topics.filter(t=>!t.parent_id||!topics.some(p=>p.id===t.parent_id)),[topics]);
 const childrenOf=useCallback((id:string)=>topics.filter(t=>t.parent_id===id),[topics]);
 const minutesFor=useCallback((topicId:string,g:number)=>placements.filter(p=>p.topic_id===topicId&&p.grade===g).reduce((sum,p)=>sum+(p.suggested_minutes||0),0),[placements]);
 const inGrade=useCallback((t:Topic,g:number)=>placements.some(p=>p.grade===g&&(p.topic_id===t.id||childrenOf(t.id).some(c=>c.id===p.topic_id))),[placements,childrenOf]);
 const gradeHasPlan=placements.some(p=>p.grade===grade);
 const visible=showAll||!gradeHasPlan?mains:mains.filter(t=>inGrade(t,grade));
 const selected=topics.find(t=>t.id===selectedId)||null;
 const selectedParent=selected?.parent_id?topics.find(t=>t.id===selected.parent_id)||null:null;
 const subject=subjects.find(s=>s.id===subjectId)||null;

 const loadSelection=useCallback(async(topicId:string)=>{
  setDocs(null);setTools([]);setWorkspace(null);setNotesDraft('');setNotesState('idle');
  const [d,t]=await Promise.all([
   api<{documents:Doc[]}>('documents?topicId='+encodeURIComponent(topicId)),
   api<{tools:Tool[]}>('tools?topicId='+encodeURIComponent(topicId))
  ]);
  setDocs(d.documents);setTools(t.tools);
  try{
   const w=await api<{workspace:Workspace}>('lesson-workspace?topicId='+encodeURIComponent(topicId));
   setWorkspace(w.workspace);setNotesDraft(w.workspace.notes||'');
  }catch(e){if(e instanceof ApiError&&e.status===401)throw e;setNotesState('unavailable')}
 },[]);
 useEffect(()=>{if(selectedId&&topics.some(t=>t.id===selectedId))loadSelection(selectedId).catch(fail)},[selectedId,topics,loadSelection,fail]);
 useEffect(()=>{setEditBooks(false)},[selectedId]);

 async function run(work:()=>Promise<void>){setBusy(true);try{await work()}catch(e){fail(e)}finally{setBusy(false)}}

 function chooseMain(t:Topic){
  if(openId===t.id&&selectedId===t.id){setOpenId('');return}
  setOpenId(t.id);setSelectedId(t.id);
 }

 async function ensureProfile():Promise<Profile>{
  if(profile)return profile;
  if(!subject)throw new ApiError('Válassz tantárgyat.',400);
  const created=await api<{profile:Profile}>('curriculum',{method:'POST',body:JSON.stringify({subjectId:subject.id,name:subject.name+' – technikum 9–12.',educationType:'technikum',gradeFrom:9,gradeTo:12})});
  setProfile(created.profile);
  return created.profile;
 }

 function setHours(t:Topic){
  const current=Math.round(minutesFor(t.id,grade)/LESSON_MINUTES);
  const answer=window.prompt('Hány óra jut a(z) „'+t.name+'” témakörre a '+grade+'. évfolyamon?',current?String(current):'');
  if(answer===null)return;
  const hours=Number(answer.replace(',','.'));
  if(!Number.isInteger(hours)||hours<1||hours>40){setToast('Egész óraszámot adj meg 1 és 40 között.');return}
  void run(async()=>{
   const p=await ensureProfile();
   await api('curriculum/placements',{method:'POST',body:JSON.stringify({profileId:p.id,topicId:t.id,grade,minutes:hours*LESSON_MINUTES,depth:'core'})});
   const pl=await api<{placements:Placement[]}>('curriculum/placements?profileId='+encodeURIComponent(p.id));
   setPlacements(pl.placements);
   setToast(t.name+': '+hours+' óra a '+grade+'. évfolyamon.');
  });
 }

 function addSub(parent:Topic){
  const name=window.prompt('Új altéma a(z) „'+parent.name+'” alá:');
  if(!name?.trim())return;
  void run(async()=>{
   const created=await api<{topic:Topic}>('topics',{method:'POST',body:JSON.stringify({name:name.trim(),subjectId,parentId:parent.id})});
   await loadCurriculum(subjectId);setOpenId(parent.id);setSelectedId(created.topic.id);
  });
 }

 function addTopic(){
  const name=window.prompt('Új témakör neve:');
  if(!name?.trim())return;
  void run(async()=>{
   const created=await api<{topic:Topic}>('topics',{method:'POST',body:JSON.stringify({name:name.trim(),subjectId})});
   await loadCurriculum(subjectId);setOpenId(created.topic.id);setSelectedId(created.topic.id);setShowAll(true);
  });
 }

 function addSubject(){
  const name=window.prompt('Új tantárgy neve:');
  if(!name?.trim())return;
  void run(async()=>{
   const created=await api<{subject:Subject}>('subjects',{method:'POST',body:JSON.stringify({name:name.trim()})});
   await loadSubjects();setSubjectId(created.subject.id);
  });
 }

 function importMath(){
  if(!window.confirm('Betöltöm a matematika témaköreit (technikum, 9–12.) szerkeszthető tervezetként. A meglévő adataidat nem módosítja. Mehet?'))return;
  void run(async()=>{
   const result=await api<{subjectId:string}>('curriculum/import',{method:'POST',body:JSON.stringify({confirm:true})});
   await loadSubjects();setSubjectId(result.subjectId);
  });
 }

 function addTool(){
  if(!selected)return;
  const label=window.prompt('A link neve (pl. GeoGebra):');
  if(!label?.trim())return;
  const url=window.prompt('A link címe (https://…):','https://');
  if(!url?.trim()||url.trim()==='https://')return;
  void run(async()=>{
   await api('tools',{method:'POST',body:JSON.stringify({topicId:selected.id,label:label.trim(),url:url.trim(),provider:'egyéb'})});
   const t=await api<{tools:Tool[]}>('tools?topicId='+encodeURIComponent(selected.id));setTools(t.tools);
  });
 }
 function removeTool(tool:Tool){
  if(!selected||!window.confirm('Eltávolítod ezt a linket: '+tool.label+'?'))return;
  void run(async()=>{
   await api('tools?id='+encodeURIComponent(tool.id),{method:'DELETE'});
   setTools(v=>v.filter(x=>x.id!==tool.id));
  });
 }

 async function saveNotes(){
  if(!selected||!workspace)return;
  setNotesState('saving');
  try{
   await api('lesson-workspace',{method:'PUT',body:JSON.stringify({topicId:selected.id,notes:notesDraft,questions:workspace.questions||[]})});
   setWorkspace({...workspace,notes:notesDraft});setNotesState('saved');
  }catch(e){setNotesState('idle');fail(e)}
 }

 function renameBook(d:Doc){
  const current=konyvCim(d.title,d.filename);
  const answer=window.prompt('A könyv új címe:',current);
  if(answer===null)return;
  const title=answer.replace(/\s+/g,' ').trim();
  if(!title||title===current)return;
  if(title.length>160){setToast('Legfeljebb 160 karakter lehet a cím.');return}
  void run(async()=>{
   await api('documents',{method:'PATCH',body:JSON.stringify({id:d.id,title})});
   setDocs(v=>v?v.map(x=>x.id===d.id?{...x,title}:x):v);
   setLastRead(v=>v&&v.document_id===d.id?{...v,title}:v);
   setToast('Átneveztem: '+title);
  });
 }
 function unlink(d:Doc){
  if(!selected||!d.link_id)return;
  const what=d.chapter_title?'„'+d.chapter_title+'” ('+d.pdf_page+'. oldal)':d.pdf_page?d.pdf_page+'. oldal':'ez a könyv';
  if(!window.confirm('Leveszem a(z) „'+selected.name+'” témáról: '+what+'. A könyv a könyvtárban marad, csak ez a párosítás törlődik. Mehet?'))return;
  void run(async()=>{
   await api('links?id='+encodeURIComponent(d.link_id!),{method:'DELETE'});
   setDocs(v=>v?v.filter(x=>x.link_id!==d.link_id):v);
  });
 }

 // Egy könyv több fejezettel is tartozhat egy altémához: könyvenként egy kártya.
 const bookGroups=useMemo(()=>{
  const m=new Map<string,Doc[]>();
  for(const d of docs||[]){const k=d.id+':'+(d.category||'');const g=m.get(k);if(g)g.push(d);else m.set(k,[d])}
  return [...m.values()];
 },[docs]);
 async function openDoc(d:Doc){
  if(d.mime_type==='application/pdf'){
   const params=new URLSearchParams({doc:d.id});
   if(d.pdf_page)params.set('page',String(d.pdf_page));
   if(selected){params.set('topic',selected.id);params.set('label',selected.name)}
   window.location.href='/olvaso?'+params.toString();
   return;
  }
  await run(async()=>{
   const {url}=await api<{url:string}>('download?id='+encodeURIComponent(d.id));
   window.open(url,'_blank','noopener,noreferrer');
  });
 }

 // Keresés: témakörök és könyvek, rövid késleltetéssel.
 useEffect(()=>{
  const q=query.trim();
  if(q.length<2){setHits(null);return}
  const timer=setTimeout(()=>{
   api<{documents:{id:string;title:string}[];topics:{id:string;name:string;subject_id:string;subject_name:string}[]}>('search?q='+encodeURIComponent(q))
    .then(r=>setHits([...r.topics.map(t=>({kind:'topic' as const,...t})),...r.documents.map(d=>({kind:'doc' as const,id:d.id,title:d.title}))]))
    .catch(fail);
  },300);
  return()=>clearTimeout(timer);
 },[query,fail]);
 useEffect(()=>{
  function outside(e:PointerEvent){
   if(searchBox.current&&!searchBox.current.contains(e.target as Node))setHits(null);
   if(menuBox.current&&!menuBox.current.contains(e.target as Node))setMenuOpen(false);
  }
  window.addEventListener('pointerdown',outside);return()=>window.removeEventListener('pointerdown',outside);
 },[]);
 function pickHit(h:SearchHit){
  setHits(null);setQuery('');
  if(h.kind==='doc'){window.location.href='/olvaso?doc='+encodeURIComponent(h.id);return}
  const go=()=>{setShowAll(true);setSelectedId(h.id)};
  if(h.subject_id!==subjectId){setSubjectId(h.subject_id);setTimeout(go,0)}else go();
 }
 // A találat altémájának szülőjét is nyissuk ki.
 useEffect(()=>{if(selected?.parent_id&&openId!==selected.parent_id)setOpenId(selected.parent_id)},[selected,openId]);

 if(phase==='checking')return <div className="us-login"><p className="us-status">Betöltés…</p></div>;
 if(phase==='login')return <Belepes onDone={()=>setPhase('ready')}/>;

 return <div className="us-app">
  <header className="us-top">
   <a href="/" className="us-brand"><span className="us-logo"><Icon name="book" size={22} stroke="#fff" strokeWidth={1.8}/></span>Oktatási Segéd</a>
   <nav className="us-subjects" aria-label="Tantárgy">
    {subjects.map(s=><button key={s.id} type="button" className="us-pill" aria-pressed={s.id===subjectId} onClick={()=>setSubjectId(s.id)}>{s.name}</button>)}
    <button type="button" className="us-pill us-pill-add" aria-label="Új tantárgy" onClick={addSubject} disabled={busy}><Icon name="plus" size={18}/></button>
   </nav>
   <div className="us-search" ref={searchBox}>
    <label className="us-search-field"><Icon name="search" size={18}/><span className="sr-only">Keresés</span>
     <input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Keress témakörre vagy könyvre"/>
    </label>
    {hits&&<div className="us-search-results" role="listbox" aria-label="Találatok">
     {hits.length===0&&<p className="us-status" style={{padding:'8px 12px',margin:0}}>Nincs találat.</p>}
     {hits.map(h=><button key={h.kind+h.id} type="button" role="option" aria-selected="false" onClick={()=>pickHit(h)}>
      <Icon name={h.kind==='doc'?'book':'lines'} size={18}/>
      <span style={{flex:1}}>{h.kind==='doc'?konyvCim(h.title):h.name}</span>
      <small>{h.kind==='doc'?'könyv':h.subject_name}</small>
     </button>)}
    </div>}
   </div>
   <a href={'/feltoltes'+(selected?'?topicId='+encodeURIComponent(selected.id):'')} className="us-btn us-btn-teal"><Icon name="upload" size={18}/>Feltöltés</a>
   <div style={{position:'relative'}} ref={menuBox}>
    <button type="button" className="us-avatar" aria-label="Fiók és beállítások" aria-expanded={menuOpen} onClick={()=>setMenuOpen(v=>!v)}><Icon name="user" size={20}/></button>
    {menuOpen&&<div className="us-menu">
     <a href="/feltoltes">Új könyv feltöltése</a>
     <a href="/cloud">Könyvtár (régi nézet)</a>
     <a href="/cloud/curriculum">Tananyagfa szerkesztése</a>
     <a href="/cloud/videos">Videótár</a>
     <hr/>
     <button type="button" onClick={()=>{void signOut().then(()=>setPhase('login'))}}>Kijelentkezés</button>
    </div>}
   </div>
  </header>

  {subjects.length===0?<main className="us-main" style={{maxWidth:760}}>
   <section className="us-empty">
    <h2>Kezdjük a tananyaggal</h2>
    <p>Még nincs tantárgy a fiókodban. Betölthetem a matematika témaköreit a technikum 9–12. évfolyamára szerkeszthető tervezetként, vagy felvehetsz egy saját tantárgyat.</p>
    <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
     <button type="button" className="us-btn us-btn-dark" onClick={importMath} disabled={busy}>Matematika betöltése</button>
     <button type="button" className="us-btn" onClick={addSubject} disabled={busy}>Saját tantárgy</button>
    </div>
   </section>
  </main>:<div className="us-body">
   <aside className="us-side" aria-label="Témakörök">
    {lastRead&&<a className="us-continue" href={'/olvaso?doc='+encodeURIComponent(lastRead.document_id)+(lastRead.pdf_page?'&page='+lastRead.pdf_page:'')}>
     <span className="us-continue-spine" style={{background:spineColor(lastRead.document_id)}}/>
     <span className="us-continue-body"><small>Folytatás</small><b>{konyvCim(lastRead.title,lastRead.filename)}</b><small>{lastRead.pdf_page?lastRead.pdf_page+'. oldal':'az elejétől'}</small></span>
     <Icon name="arrow" size={18} strokeWidth={2.2}/>
    </a>}
    <div className="us-seg" role="group" aria-label="Évfolyam">
     {GRADES.map(g=><button key={g} type="button" aria-pressed={g===grade} onClick={()=>{setGrade(g);setShowAll(false)}}>{g}.</button>)}
    </div>
    <div className="us-side-head">
     <h2 className="us-label">Témakörök</h2>
     <small>{showAll||!gradeHasPlan?'mind':grade+'. évfolyam'}</small>
    </div>
    {!curriculumReady&&<p className="us-note">Az óraszámok és évfolyamok mentése még nincs bekapcsolva az adatbázisban. A könyvek ettől függetlenül megnyithatók.</p>}
    {curriculumReady&&!gradeHasPlan&&mains.length>0&&<p className="us-note">A {grade}. évfolyamhoz még nincs témakör rendelve. Koppints egy témakör óraszámára, és az bekerül ebbe az évfolyamba.</p>}
    <ul className="us-topics">
     {visible.map((t,i)=>{
      const open=openId===t.id;const subs=childrenOf(t.id);const minutes=minutesFor(t.id,grade);const hours=Math.round(minutes/LESSON_MINUTES);
      return <li key={t.id} className={'us-topic'+(open?' is-open':'')}>
       <div className="us-topic-row">
        <button type="button" className="us-topic-btn" aria-expanded={open} onClick={()=>chooseMain(t)}>
         <span className="us-topic-num">{i+1}</span>
         <span>{selectedId===t.id?<span className="us-marker">{t.name}</span>:t.name}</span>
        </button>
        {curriculumReady&&<button type="button" className={'us-hours'+(hours?' is-set':'')} onClick={()=>setHours(t)} disabled={busy} aria-label={hours?t.name+': '+hours+' óra, módosítás':t.name+': óraszám megadása'}>{hours?hours+' óra':'óra?'}</button>}
       </div>
       {open&&<ul className="us-subs">
        {subs.map(s=><li key={s.id}><button type="button" className="us-sub" aria-current={selectedId===s.id} onClick={()=>setSelectedId(s.id)}>
         <span>{selectedId===s.id?<span className="us-marker">{s.name}</span>:s.name}</span>
        </button></li>)}
        <li><button type="button" className="us-btn us-btn-ghost" onClick={()=>addSub(t)} disabled={busy}><Icon name="plus" size={16}/>Altéma hozzáadása</button></li>
       </ul>}
      </li>;
     })}
    </ul>
    <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
     {gradeHasPlan&&<button type="button" className="us-btn us-btn-ghost" onClick={()=>setShowAll(v=>!v)}>{showAll?'Csak a '+grade+'. évfolyam':'Minden témakör mutatása'}</button>}
     <button type="button" className="us-btn us-btn-ghost" onClick={addTopic} disabled={busy}><Icon name="plus" size={16}/>Új témakör</button>
    </div>
   </aside>

   <main className="us-main">
    {!selected?<section className="us-empty">
     <h2>Válassz témát</h2>
     <p>Bal oldalt nyiss ki egy témakört, és koppints egy altémára. Itt látod majd, melyik könyvedben van meg, és egy érintéssel ott nyílik ki.</p>
    </section>:<>
     <div style={{display:'flex',flexDirection:'column',gap:6}}>
      <div className="us-crumb">{[subject?.name,grade+'. évfolyam',selectedParent?.name].filter(Boolean).join(' · ')}</div>
      <h1 className="us-title"><span className="us-marker">{selected.name}</span></h1>
     </div>

     <section style={{display:'flex',flexDirection:'column',gap:12}} aria-label="Könyvek">
      <div className="us-books-head">
       <h2 className="us-label">{editBooks&&bookGroups.length?'Könyvek szerkesztése':'Kinyitom a könyvben'}</h2>
       {bookGroups.length>0&&<button type="button" className="us-btn us-btn-ghost" aria-pressed={editBooks} onClick={()=>setEditBooks(v=>!v)}>{editBooks?'Kész':'Szerkesztés'}</button>}
      </div>
      {editBooks&&bookGroups.length>0&&<p className="us-status" style={{margin:0}}>Itt átnevezheted a könyvet, és leveheted a rossz párosítást erről a témáról. A könyv a könyvtárban marad.</p>}
      <div className="us-books">
       {docs===null&&<p className="us-status">Könyvek betöltése…</p>}
       {bookGroups.map(g=>{const d=g[0];const color=spineColor(d.id);
        const chapters=d.mime_type==='application/pdf'?g.filter(x=>x.pdf_page).sort((a,b)=>(a.pdf_page||0)-(b.pdf_page||0)):[];
        if(editBooks){const rows=[...g].sort((a,b)=>(a.pdf_page||0)-(b.pdf_page||0));
         return <div key={d.id+':'+(d.category||'')} className={'us-book is-edit'+(rows.length>1?' has-ch':'')}>
          <span className="us-book-spine" style={{background:color}}/>
          <span className="us-book-body">
           <span className="us-book-kind" style={{color}}>{KIND[d.category||'reference']||'Anyag'}</span>
           <span className="us-book-title">{konyvCim(d.title,d.filename)}</span>
           <button type="button" className="us-btn us-btn-ghost us-edit-rename" onClick={()=>renameBook(d)} disabled={busy}><Icon name="pen" size={16}/>Átnevezés</button>
           <span className="us-ch">
            {rows.map(c=><span key={c.link_id||c.pdf_page||0} className="us-ch-edit">
             <span className="us-ch-page">{c.pdf_page?c.pdf_page+'. o.':'eleje'}</span>
             <span className="us-ch-title">{c.chapter_title||(c.pdf_page?'Fejezet':'Az egész könyv')}</span>
             <button type="button" className="us-icon-btn" aria-label={'Levétel erről a témáról: '+(c.chapter_title||c.pdf_page||'')} onClick={()=>unlink(c)} disabled={busy||!c.link_id}><Icon name="trash" size={16}/></button>
            </span>)}
           </span>
          </span>
         </div>}
        if(chapters.length>1)return <div key={d.id+':'+(d.category||'')} className="us-book has-ch">
         <span className="us-book-spine" style={{background:color}}/>
         <span className="us-book-body">
          <span className="us-book-kind" style={{color}}>{KIND[d.category||'reference']||'Anyag'}</span>
          <span className="us-book-title">{konyvCim(d.title,d.filename)}</span>
          <span className="us-book-where">{chapters.length} fejezet tartozik ehhez a témához. Koppints arra, amelyiket most tanítod.</span>
          <span className="us-ch">
           {chapters.map(c=><button key={c.link_id||c.pdf_page} type="button" className="us-ch-btn" onClick={()=>void openDoc(c)}>
            <span className="us-ch-page">{c.pdf_page}. o.</span>
            <span className="us-ch-title"><span>{c.chapter_title||'Fejezet'}</span></span>
           </button>)}
          </span>
          <button type="button" className="us-book-open" onClick={()=>void openDoc(chapters[0])}>Kinyitom az első fejezetnél<Icon name="arrow" size={16} strokeWidth={2.2}/></button>
         </span>
        </div>;
        return <button key={d.link_id||d.id} type="button" className="us-book" onClick={()=>void openDoc(chapters[0]||d)}>
        <span className="us-book-spine" style={{background:color}}/>
        <span className="us-book-body">
         <span className="us-book-kind" style={{color}}>{KIND[d.category||'reference']||'Anyag'}</span>
         <span className="us-book-title">{konyvCim(d.title,d.filename)}</span>
         <span className="us-book-where">{d.mime_type==='application/pdf'?(d.pdf_page?'A témánál nyílik ki':'Még nincs megadva a hely, az elején nyílik'):'Eredeti fájl megnyitása'}</span>
         <span className="us-book-open">Kinyitom<Icon name="arrow" size={16} strokeWidth={2.2}/></span>
        </span>
       </button>})}
       <a className="us-book-add" href={'/feltoltes?topicId='+encodeURIComponent(selected.id)}>
        <span><Icon name="plus" size={22}/></span>
        <b>Könyv vagy feladatgyűjtemény</b>
        <small>Feltöltés vagy hozzárendelés ehhez a témához</small>
       </a>
      </div>
     </section>

     <div className="us-panels">
      <section className="us-panel" aria-label="Eszközök a témához">
       <h2 className="us-label">Eszközök a témához</h2>
       {tools.map(t=><div key={t.id} className="us-row">
        <a href={t.url} target="_blank" rel="noopener noreferrer"><span className="us-row-icon"><Icon name={/desmos/i.test(t.url)?'wave':/geogebra/i.test(t.url)?'shape':'lines'} size={16}/></span><span style={{flex:1}}>{t.label}</span><Icon name="external" size={16} stroke="#586274"/></a>
        <button type="button" className="us-icon-btn" aria-label={t.label+' eltávolítása'} onClick={()=>removeTool(t)} disabled={busy}><Icon name="close" size={16}/></button>
       </div>)}
       {tools.length===0&&<p className="us-status" style={{margin:0}}>Ide jöhet a Desmos, a GeoGebra, a WolframAlpha vagy bármilyen link, amit ennél a témánál használsz.</p>}
       <div><button type="button" className="us-btn us-btn-ghost" onClick={addTool} disabled={busy}><Icon name="plus" size={16}/>Link hozzáadása</button></div>
      </section>

      <section className="us-panel" aria-label="Saját jegyzet">
       <h2 className="us-label">Jegyzetem a témához</h2>
       {notesState==='unavailable'?<p className="us-status" style={{margin:0}}>A jegyzetek felhőmentése még nincs bekapcsolva az adatbázisban.</p>:<>
        <label className="sr-only" htmlFor="us-notes">Jegyzet</label>
        <textarea id="us-notes" className="us-notes" value={notesDraft} onChange={e=>{setNotesDraft(e.target.value);if(notesState==='saved')setNotesState('idle')}} placeholder="Mire figyelj órán, milyen példát hozz…" disabled={!workspace} maxLength={20000}/>
        <div className="us-panel-foot">
         <span>{notesState==='saving'?'Mentés…':notesState==='saved'?'Elmentve, minden eszközödön látszik.':workspace&&notesDraft!==workspace.notes?'Nincs még elmentve.':''}</span>
         <button type="button" className="us-btn us-btn-dark" onClick={()=>void saveNotes()} disabled={!workspace||notesState==='saving'||notesDraft===workspace?.notes}>Mentés</button>
        </div>
       </>}
      </section>
     </div>
    </>}
   </main>
  </div>}
  {toast&&<div className="us-toast" role="status"><span style={{flex:1}}>{toast}</span><button type="button" onClick={()=>setToast('')}>Rendben</button></div>}
 </div>;
}
