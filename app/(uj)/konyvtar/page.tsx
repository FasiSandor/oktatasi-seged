'use client';
import {Suspense,useCallback,useEffect,useMemo,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {api,ApiError,hasSession} from '../../../lib/client-api';
import {konyvCim} from '../../../lib/konyv-cim';
import {GRADE_CHOICES,KINDS,KIND_LABEL,LEVEL_LABEL,guessGrade,guessLevel} from '../../../lib/besorolas';
import {Icon} from '../icons';
import Borito from '../Borito';
import Belepes from '../Belepes';
import Kereso from '../Kereso';
import Fiokmenu from '../Fiokmenu';

type Subject={id:string;name:string};
type Entry={title:string;page:number;group:string};
type Book={
 id:string;title:string;filename:string|null;mime_type:string;byte_size:number|null;created_at:string;link_count:number;
 subject_id?:string|null;grade?:number|null;level?:string|null;kind?:string|null;role?:string;contents?:Entry[]|null;
 link_subject_id?:string|null;link_kind?:string|null;
};
type Chapter={page:number|null;title:string;topics:string};
type Draft={subjectId:string;grade:string;level:string;kind:string};

export default function KonyvtarOldal(){
 return <Suspense fallback={<div className="us-login"><p className="us-status">Betöltés…</p></div>}><Konyvtar/></Suspense>;
}

function Konyvtar(){
 const params=useSearchParams();
 const focusId=params.get('doc')||'';
 const [phase,setPhase]=useState<'checking'|'login'|'ready'>('checking');
 const [subjects,setSubjects]=useState<Subject[]>([]);
 const [books,setBooks]=useState<Book[]|null>(null);
 const [schemaReady,setSchemaReady]=useState(true);
 const [editId,setEditId]=useState(focusId);
 const [draft,setDraft]=useState<Draft|null>(null);
 const [tocId,setTocId]=useState('');
 const [chapters,setChapters]=useState<Record<string,Chapter[]>>({});
 // A tartalomjegyzék szerkesztése (csoportok javítása); csak a mentett tartalomjegyzékű könyvnél.
 const [tocDraft,setTocDraft]=useState<Entry[]|null>(null);
 const [query,setQuery]=useState('');
 const [busy,setBusy]=useState(false);
 const [toast,setToast]=useState('');

 const fail=useCallback((e:unknown)=>{
  if(e instanceof ApiError&&e.status===401){setPhase('login');return}
  setToast(e instanceof Error?e.message:'Ismeretlen hiba');
 },[]);
 useEffect(()=>{let alive=true;hasSession().then(ok=>{if(alive)setPhase(ok?'ready':'login')});return()=>{alive=false}},[]);

 const load=useCallback(async()=>{
  const [s,l]=await Promise.all([api<{subjects:Subject[]}>('subjects'),api<{documents:Book[];schemaReady:boolean}>('library')]);
  setSubjects(s.subjects);setBooks(l.documents);setSchemaReady(l.schemaReady);
 },[]);
 useEffect(()=>{if(phase==='ready')load().catch(fail)},[phase,load,fail]);

 const subjectOf=(b:Book)=>b.subject_id||b.link_subject_id||'';
 const kindOf=(b:Book)=>b.kind||b.link_kind||'';
 const list=useMemo(()=>{
  const q=query.trim().toLocaleLowerCase('hu');
  return (books||[]).filter(b=>(b.role||'book')==='book'&&(!q||konyvCim(b.title,b.filename).toLocaleLowerCase('hu').includes(q)));
 },[books,query]);
 const groups=useMemo(()=>{
  const out=subjects.map(s=>({id:s.id,name:s.name,books:list.filter(b=>subjectOf(b)===s.id)}));
  const rest=list.filter(b=>!subjects.some(s=>s.id===subjectOf(b)));
  if(rest.length)out.push({id:'',name:'Tantárgy nélkül',books:rest});
  return out.filter(g=>g.books.length);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[list,subjects]);

 // Ha a témaoldalról jöttél (Besorolás), ennél a könyvnél nyílik a szerkesztő.
 useEffect(()=>{
  if(!focusId||!books)return;
  const b=books.find(x=>x.id===focusId);if(b)openEdit(b);
  setTimeout(()=>document.getElementById('book-'+focusId)?.scrollIntoView({block:'center'}),50);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[books]);

 function openEdit(b:Book){
  setEditId(b.id);
  const name=konyvCim(b.title,b.filename);
  setDraft({
   subjectId:subjectOf(b),
   grade:String(b.grade??guessGrade(name)??''),
   level:b.level??guessLevel(name)??'',
   kind:kindOf(b)||'reference'
  });
 }
 async function saveEdit(b:Book){
  if(!draft)return;
  setBusy(true);
  try{
   await api('library',{method:'PATCH',body:JSON.stringify({id:b.id,subjectId:draft.subjectId||null,grade:draft.grade?Number(draft.grade):null,level:draft.level||null,kind:draft.kind||null})});
   setBooks(v=>v?v.map(x=>x.id===b.id?{...x,subject_id:draft.subjectId||null,grade:draft.grade?Number(draft.grade):null,level:draft.level||null,kind:draft.kind||null}:x):v);
   setEditId('');setDraft(null);setToast('Elmentve: '+konyvCim(b.title,b.filename));
  }catch(e){fail(e)}finally{setBusy(false)}
 }

 // Évfolyam és szint kitöltése a címekből, csak ott, ahol még üres.
 const guessable=(books||[]).filter(b=>(b.role||'book')==='book'&&((b.grade==null&&guessGrade(konyvCim(b.title,b.filename))!==null)||(!b.subject_id&&b.link_subject_id)||(!b.kind&&b.link_kind)));
 async function fillFromTitles(){
  if(!guessable.length)return;
  if(!window.confirm(guessable.length+' könyvnél kitöltöm az üres mezőket: az évfolyamot a címből, a tantárgyat és a típust a meglévő párosításokból. Amit már megadtál, ahhoz nem nyúlok. Mehet?'))return;
  setBusy(true);
  try{
   for(const b of guessable){
    const name=konyvCim(b.title,b.filename);
    const patch:Record<string,unknown>={id:b.id};
    if(b.grade==null){const g=guessGrade(name);if(g!==null)patch.grade=g}
    if(b.level==null&&guessLevel(name))patch.level='emelt';
    if(!b.subject_id&&b.link_subject_id)patch.subjectId=b.link_subject_id;
    if(!b.kind&&b.link_kind)patch.kind=b.link_kind;
    await api('library',{method:'PATCH',body:JSON.stringify(patch)});
   }
   await load();setToast('Kész, nézd át a besorolást.');
  }catch(e){fail(e)}finally{setBusy(false)}
 }

 async function toggleToc(b:Book){
  setTocDraft(null);
  if(tocId===b.id){setTocId('');return}
  setTocId(b.id);
  if(!b.contents?.length&&!chapters[b.id]){
   try{const r=await api<{chapters:Chapter[]}>('library?doc='+encodeURIComponent(b.id));setChapters(v=>({...v,[b.id]:r.chapters}))}catch(e){fail(e)}
  }
 }
 /** Új csoport az adott sortól: a sor és az utána következő, eddig vele egy csoportban lévő sorok kapják az új nevet. */
 function splitGroup(i:number){
  if(!tocDraft)return;
  const name=window.prompt('Mi legyen az új csoport neve? Ettől a sortól kezdve, a jelenlegi csoport végéig minden sor ide kerül.',tocDraft[i].title);
  if(name===null)return;
  const clean=name.replace(/\s+/g,' ').trim().slice(0,200);
  if(!clean)return;
  const old=tocDraft[i].group;
  setTocDraft(tocDraft.map((e,j)=>{
   if(j<i)return e;
   const inBlock=tocDraft.slice(i,j+1).every(x=>x.group===old);
   return inBlock?{...e,group:clean}:e;
  }));
 }
 async function saveToc(b:Book){
  if(!tocDraft)return;
  const contents=tocDraft.map(e=>({...e,group:e.group.replace(/\s+/g,' ').trim().slice(0,200)}));
  setBusy(true);
  try{
   await api('library',{method:'PATCH',body:JSON.stringify({id:b.id,contents})});
   setBooks(v=>v?v.map(x=>x.id===b.id?{...x,contents}:x):v);
   setTocDraft(null);setToast('A tartalomjegyzék elmentve. A témákhoz kötött fejezetek nem változtak.');
  }catch(e){fail(e)}finally{setBusy(false)}
 }

 const read=(b:Book,page?:number|null)=>'/olvaso?doc='+encodeURIComponent(b.id)+(page?'&page='+page:'');

 if(phase==='checking')return <div className="us-login"><p className="us-status">Betöltés…</p></div>;
 if(phase==='login')return <Belepes onDone={()=>setPhase('ready')}/>;

 return <div className="us-app">
  <header className="rd-top">
   <a href="/" className="rd-back"><Icon name="back" size={20} strokeWidth={2.2}/><span>Főoldal</span></a>
   <h1 className="pg-title">Könyvtár</h1>
   <label className="us-search-field pg-search"><Icon name="search" size={18}/><span className="sr-only">Keresés a könyvek között</span>
    <input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Keresés a könyvek között"/>
   </label>
   <a href="/feltoltes" className="us-btn us-btn-teal"><Icon name="upload" size={18}/>Feltöltés</a>
   <div className="rd-right is-kompakt">
    <Kereso kompakt onAuth={()=>setPhase('login')}/>
    <Fiokmenu/>
   </div>
  </header>
  <main className="pg-main">
   {!schemaReady&&<p className="up-warn">A könyvek besorolásához (tantárgy, évfolyam, szint, típus) le kell futtatni a 008-as adatbázis-frissítést. Addig a könyvek megnyithatók, de a besorolás nem menthető.</p>}
   {schemaReady&&guessable.length>0&&<div className="pg-tip">
    <span>{guessable.length} könyvnél ki tudom tölteni az üres mezőket a címből és a meglévő párosításokból.</span>
    <button type="button" className="us-btn us-btn-dark" disabled={busy} onClick={()=>void fillFromTitles()}>Kitöltés</button>
   </div>}
   {books===null&&<p className="us-status">Könyvek betöltése…</p>}
   {books&&list.length===0&&<section className="us-empty"><h2>{query?'Nincs találat':'Még nincs könyv'}</h2><p>{query?'Próbálj más szót.':'Tölts fel egy PDF-et, és a tartalomjegyzéke alapján a témákhoz kötöm.'}</p></section>}
   {groups.map(g=><section key={g.id||'none'} className="pg-group" aria-label={g.name}>
    <h2 className="us-grade-head">{g.name}<small>{g.books.length} könyv</small></h2>
    <div className="pg-books">
     {g.books.map(b=>{
      const name=konyvCim(b.title,b.filename);const isPdf=b.mime_type==='application/pdf';
      const toc:Entry[]=b.contents?.length?b.contents:(chapters[b.id]||[]).filter(c=>c.page).map(c=>({title:c.title||'Fejezet',page:c.page!,group:c.topics}));
      return <article key={b.id} id={'book-'+b.id} className={'pg-book'+(editId===b.id?' is-edit':'')}>
       <div className="pg-book-main">
        <a href={read(b)} className="pg-cover-link" aria-label={name+' megnyitása'}><Borito id={b.id} pdf={isPdf} className="pg-cover"/></a>
        <div className="pg-book-body">
         <span className="us-book-kind">{KIND_LABEL[kindOf(b)]||'Anyag'}{b.level==='emelt'&&<span className="us-badge">Emelt</span>}</span>
         <a href={read(b)} className="pg-book-title">{name}</a>
         <span className="pg-meta">{[b.grade?b.grade+'. évfolyam':'évfolyam nincs megadva',b.link_count?b.link_count+' hivatkozás a témákban':'még nincs témához kötve'].join(' · ')}</span>
         <div className="pg-actions">
          {isPdf&&<button type="button" className="us-btn us-btn-ghost" aria-expanded={tocId===b.id} onClick={()=>void toggleToc(b)}><Icon name="lines" size={16}/>Tartalomjegyzék</button>}
          {schemaReady&&<button type="button" className="us-btn us-btn-ghost" onClick={()=>editId===b.id?(setEditId(''),setDraft(null)):openEdit(b)}><Icon name="pen" size={16}/>Besorolás</button>}
          {isPdf&&<a className="us-btn us-btn-ghost" href={'/feltoltes?doc='+encodeURIComponent(b.id)}><Icon name="next" size={16}/>Újrapárosítás</a>}
         </div>
        </div>
       </div>
       {editId===b.id&&draft&&<div className="pg-edit">
        <label className="us-field">Tantárgy<select className="up-select" value={draft.subjectId} onChange={e=>setDraft({...draft,subjectId:e.target.value})}><option value="">Nincs megadva</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="us-field">Évfolyam<select className="up-select" value={draft.grade} onChange={e=>setDraft({...draft,grade:e.target.value})}><option value="">Nincs megadva</option>{GRADE_CHOICES.map(g=><option key={g} value={g}>{g}.</option>)}</select></label>
        <label className="us-field">Szint<select className="up-select" value={draft.level} onChange={e=>setDraft({...draft,level:e.target.value})}><option value="">Nincs megadva</option>{Object.entries(LEVEL_LABEL).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
        <label className="us-field">Típus<select className="up-select" value={draft.kind} onChange={e=>setDraft({...draft,kind:e.target.value})}>{KINDS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
        <div className="up-actions" style={{gridColumn:'1/-1'}}>
         <span>{b.grade==null&&guessGrade(name)!==null?'Az évfolyamot a címből javasoltam, ellenőrizd.':''}</span>
         <button type="button" className="us-btn" onClick={()=>{setEditId('');setDraft(null)}}>Mégse</button>
         <button type="button" className="us-btn us-btn-dark" disabled={busy} onClick={()=>void saveEdit(b)}>Mentés</button>
        </div>
       </div>}
       {tocId===b.id&&<div className="pg-toc">
        {!b.contents?.length&&!chapters[b.id]&&<p className="us-status">Betöltés…</p>}
        {!b.contents?.length&&chapters[b.id]&&<p className="pg-hint">Ennél a könyvnél csak a témákhoz kötött fejezetek vannak meg. Az „Újrapárosítás” után a teljes tartalomjegyzék is elmentődik.</p>}
        {(b.contents?.length||chapters[b.id])&&toc.length===0&&<p className="us-status">Ehhez a könyvhöz még nincs fejezet mentve.</p>}
        {!!b.contents?.length&&(tocDraft?<>
         <div className="pg-toc-tools">
          <p className="pg-hint">Írd át a csoport nevét, vagy az „Új csoport innen” gombbal válaszd le a sort és az utána következőket. A témákhoz kötött fejezeteket ez nem változtatja meg.</p>
          <button type="button" className="us-btn" onClick={()=>setTocDraft(null)}>Mégse</button>
          <button type="button" className="us-btn us-btn-dark" disabled={busy} onClick={()=>void saveToc(b)}>Mentés</button>
         </div>
         <datalist id={'groups-'+b.id}>{[...new Set(tocDraft.map(e=>e.group).filter(Boolean))].map(g=><option key={g} value={g}/>)}</datalist>
         <ol className="pg-toc-edit">
          {tocDraft.map((e,i)=><li key={i} className={i>0&&tocDraft[i-1].group!==e.group?'is-start':undefined}>
           <span className="us-ch-page">{e.page}. o.</span>
           <b>{e.title}</b>
           <span className="pg-toc-edit-row">
            <input value={e.group} list={'groups-'+b.id} aria-label={e.title+': csoport'} placeholder="Csoport nélkül" onChange={ev=>setTocDraft(tocDraft.map((x,j)=>j===i?{...x,group:ev.target.value}:x))}/>
            <button type="button" className="us-btn us-btn-ghost" onClick={()=>splitGroup(i)}>Új csoport innen</button>
           </span>
          </li>)}
         </ol>
        </>:<div className="pg-toc-tools"><span/><button type="button" className="us-btn us-btn-ghost" onClick={()=>setTocDraft(b.contents!.map(e=>({...e,group:e.group||''})))}><Icon name="pen" size={16}/>Csoportok javítása</button></div>)}
        {!tocDraft&&<ol className="pg-toc-list">
         {toc.map((c,i)=><li key={i}>{c.group&&(i===0||toc[i-1].group!==c.group)&&b.contents?.length?<span className="pg-toc-group">{c.group}</span>:null}
          <a href={read(b,c.page)} className="us-ch-btn"><span className="us-ch-page">{c.page}. o.</span><span className="us-ch-title"><span>{c.title}</span>{!b.contents?.length&&c.group&&<small className="us-ch-topic">{c.group}</small>}</span></a>
         </li>)}
        </ol>}
       </div>}
      </article>;
     })}
    </div>
   </section>)}
  </main>
  {toast&&<div className="us-toast" role="status"><span style={{flex:1}}>{toast}</span><button type="button" onClick={()=>setToast('')}>Rendben</button></div>}
 </div>;
}
