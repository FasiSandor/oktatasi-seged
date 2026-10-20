'use client';
import {Suspense,useCallback,useEffect,useRef,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {api,ApiError,hasSession,localPrefs} from '../../../lib/client-api';
import {Icon,spineColor} from '../icons';
import {konyvCim} from '../../../lib/konyv-cim';
import Belepes from '../Belepes';
import Kereso from '../Kereso';
import Fiokmenu from '../Fiokmenu';
import KonyvLap,{type Box,type Mark,type PdfDoc,type Stroke,type Tool} from './KonyvLap';
import AiSegitseg,{type Meta} from './AiSegitseg';

type Doc={id:string;title:string;filename?:string|null;mime_type:string;pdf_page?:number|null;link_id?:string};

// Egy könyv fejezetenként külön sorként jön vissza. A fülekhez könyvenként
// egy kell: a legkisebb oldalszámú fejezetét tartjuk meg, ott nyílik ki.
function konyvenkent(list:Doc[]):Doc[]{
 const byId=new Map<string,Doc>();
 for(const d of list){
  const prev=byId.get(d.id);
  if(!prev||(d.pdf_page&&(!prev.pdf_page||d.pdf_page<prev.pdf_page)))byId.set(d.id,d);
 }
 return [...byId.values()];
}
type Note={id:string;pdf_page:number;body:string};

const MARKER_COLORS=[{c:'#FFD84D',n:'Sárga'},{c:'#9BE7C4',n:'Zöld'},{c:'#FFB4C8',n:'Rózsaszín'},{c:'#A8D4FF',n:'Kék'}];
const PEN_COLORS=[{c:'#C0263A',n:'Piros'},{c:'#1E4FBF',n:'Kék'},{c:'#172033',n:'Fekete'}];

export default function OlvasoOldal(){
 return <Suspense fallback={<div className="us-login"><p className="us-status">Betöltés…</p></div>}><Olvaso/></Suspense>;
}

function Olvaso(){
 const params=useSearchParams();
 const topicId=params.get('topic')||'';
 const backLabel=params.get('label')||'Tananyag';
 const [phase,setPhase]=useState<'checking'|'login'|'ready'>('checking');
 const [docId,setDocId]=useState(params.get('doc')||'');
 const [page,setPage]=useState(Math.max(1,Number(params.get('page'))||0));
 const [books,setBooks]=useState<Doc[]>([]);
 const [title,setTitle]=useState('');
 const [pdf,setPdf]=useState<PdfDoc|null>(null);
 const [error,setError]=useState('');
 const [tool,setTool]=useState<Tool>('read');
 const [markerColor,setMarkerColor]=useState(MARKER_COLORS[0].c);
 const [penColor,setPenColor]=useState(PEN_COLORS[0].c);
 const [strokes,setStrokes]=useState<Stroke[]>([]);
 const [marks,setMarks]=useState<Mark[]>([]);
 const [notes,setNotes]=useState<Note[]>([]);
 const [noteDraft,setNoteDraft]=useState('');
 const [inkSaved,setInkSaved]=useState(true);
 const [pageInput,setPageInput]=useState('');
 const [focus,setFocus]=useState(false);
 const [toast,setToast]=useState('');
 const [stageWidth,setStageWidth]=useState(800);
 const stage=useRef<HTMLDivElement>(null);
 const history=useRef<string[]>([]);
 const [aiBox,setAiBox]=useState<Box|null>(null);
 const [aiMeta,setAiMeta]=useState<Meta|null>(null);

 const fail=useCallback((e:unknown)=>{
  if(e instanceof ApiError&&e.status===401){setPhase('login');return}
  setToast(e instanceof Error?e.message:'Ismeretlen hiba');
 },[]);

 useEffect(()=>{let alive=true;hasSession().then(ok=>{if(alive)setPhase(ok?'ready':'login')});return()=>{alive=false}},[]);
 useEffect(()=>{setTool(localPrefs.get<Tool>('rd-tool','read'))},[]);
 useEffect(()=>{localPrefs.set('rd-tool',tool==='ai'?'read':tool)},[tool]);
 // Lapozáskor vagy könyvváltáskor a keret eltűnik.
 useEffect(()=>{setAiBox(null)},[page,docId]);
 // Az AI-nak megmondjuk a könyv évfolyamát, szintjét és tantárgyát (ha be van sorolva).
 useEffect(()=>{
  if(tool!=='ai'||aiMeta||phase!=='ready')return;
  (async()=>{
   type B={id:string;grade?:number|null;level?:string|null;subject_id?:string|null;link_subject_id?:string|null};
   const [l,s]=await Promise.all([api<{documents:B[]}>('library'),api<{subjects:{id:string;name:string}[]}>('subjects')]);
   const d=l.documents.find(x=>x.id===docId);
   const sid=d?.subject_id||d?.link_subject_id||'';
   setAiMeta({grade:d?.grade??null,level:d?.level??null,subject:s.subjects.find(x=>x.id===sid)?.name||''});
  })().catch(()=>setAiMeta({grade:null,level:null,subject:''}));
 },[tool,aiMeta,phase,docId]);

 // A témához tartozó könyvek (fülek) és a megnyitott könyv címe.
 useEffect(()=>{
  if(phase!=='ready')return;
  (async()=>{
   if(topicId){
    const d=await api<{documents:Doc[]}>('documents?topicId='+encodeURIComponent(topicId));
    setBooks(konyvenkent(d.documents.filter(x=>x.mime_type==='application/pdf')));
    const own=d.documents.find(x=>x.id===docId);if(own)setTitle(konyvCim(own.title,own.filename));
   }
   if(!topicId||!title){
    const all=await api<{documents:Doc[]}>('documents');
    const own=all.documents.find(x=>x.id===docId);if(own)setTitle(konyvCim(own.title,own.filename));
   }
  })().catch(fail);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[phase,topicId,docId]);

 // A PDF betöltése. Nagy könyvnél a PDF.js csak a szükséges részeket kéri le.
 useEffect(()=>{
  if(phase!=='ready'||!docId)return;
  let disposed=false;let loaded:PdfDoc|null=null;
  setPdf(null);setError('');setStrokes([]);setMarks([]);setNotes([]);history.current=[];
  (async()=>{
   const [{url},position]=await Promise.all([
    api<{url:string}>('download?id='+encodeURIComponent(docId)),
    page?Promise.resolve(null):api<{position:{pdf_page:number}|null}>('reading?documentId='+encodeURIComponent(docId)).catch(()=>null)
   ]);
   if(!page)setPage(position?.position?.pdf_page||1);
   const pdfjs=await import('pdfjs-dist');
   pdfjs.GlobalWorkerOptions.workerSrc=new URL('pdfjs-dist/build/pdf.worker.min.mjs',import.meta.url).toString();
   loaded=await pdfjs.getDocument({url,withCredentials:false}).promise as unknown as PdfDoc;
   if(disposed){void loaded.destroy();return}
   setPdf(loaded);
   const [ink,mk,nt]=await Promise.all([
    api<{strokes:Stroke[];unavailable?:boolean}>('pdf-ink?documentId='+encodeURIComponent(docId)).catch(()=>({strokes:[],unavailable:true})),
    api<{marks:Mark[]}>('pdf-marks?documentId='+encodeURIComponent(docId)).catch(()=>({marks:[]})),
    api<{notes:Note[]}>('pdf-notes?documentId='+encodeURIComponent(docId)).catch(()=>({notes:[]}))
   ]);
   if(disposed)return;
   setStrokes(ink.strokes);setInkSaved(!ink.unavailable);setMarks(mk.marks);setNotes(nt.notes);
  })().catch(e=>{if(!disposed){if(e instanceof ApiError&&e.status===401)setPhase('login');else setError(e instanceof Error?e.message:'A könyv nem nyitható meg.')}});
  return()=>{disposed=true;if(loaded)void loaded.destroy()};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[phase,docId]);

 useEffect(()=>{setPageInput(page?String(page):'')},[page]);

 // Az URL kövesse a könyvet és az oldalt, hogy frissítés után ugyanott maradj.
 useEffect(()=>{
  if(!docId||!page)return;
  const next=new URLSearchParams(window.location.search);
  next.set('doc',docId);next.set('page',String(page));
  window.history.replaceState(null,'','/olvaso?'+next.toString());
  const timer=setTimeout(()=>{void api('reading',{method:'PUT',body:JSON.stringify({documentId:docId,page})}).catch(()=>{})},1200);
  return()=>clearTimeout(timer);
 },[docId,page]);

 useEffect(()=>{
  const el=stage.current;if(!el)return;
  const ro=new ResizeObserver(entries=>{const w=entries[0]?.contentRect.width||800;setStageWidth(Math.max(260,Math.floor(w)))});
  ro.observe(el);return()=>ro.disconnect();
 },[phase]);

 const count=pdf?.numPages||0;
 const go=useCallback((p:number)=>{if(!count)return;setPage(Math.max(1,Math.min(count,p)));stage.current?.scrollTo({top:0})},[count]);

 // Lapozás ujjal: olvasó (kéz) módban vízszintes húzás balra = következő, jobbra = előző oldal.
 // Függőleges húzás, két ujjas nagyítás, Pencil és rajzoló eszközök nem lapoznak.
 const swipeState=useRef({tool,page,go});
 swipeState.current={tool,page,go};
 useEffect(()=>{
  const el=stage.current;if(!el)return;
  let start:{x:number;y:number;t:number}|null=null;
  function onStart(e:TouchEvent){
   const t=e.touches[0] as Touch&{touchType?:string};
   if(e.touches.length!==1||t.touchType==='stylus'||swipeState.current.tool!=='read'){start=null;return}
   // A képernyő széléről induló húzás a böngészőé (vissza/előre), azt nem vesszük el.
   if(t.clientX<24||t.clientX>window.innerWidth-24){start=null;return}
   start={x:t.clientX,y:t.clientY,t:Date.now()};
  }
  function onMove(e:TouchEvent){if(e.touches.length>1)start=null}
  function onEnd(e:TouchEvent){
   const s=start;start=null;if(!s)return;
   const zoomed=(window.visualViewport?.scale||1)>1.05||el!.scrollWidth>el!.clientWidth+4;
   if(zoomed)return;
   const t=e.changedTouches[0];const dx=t.clientX-s.x,dy=t.clientY-s.y;
   if(Date.now()-s.t>900||Math.abs(dx)<60||Math.abs(dx)<Math.abs(dy)*1.6)return;
   const {page:p,go:g}=swipeState.current;
   g(dx<0?p+1:p-1);
  }
  // A vízszintes húzás ne lépjen vissza az előző oldalra a böngészőben.
  const root=document.documentElement,prevOverscroll=root.style.overscrollBehaviorX;
  root.style.overscrollBehaviorX='none';document.body.style.overscrollBehaviorX='none';
  el.addEventListener('touchstart',onStart,{passive:true});
  el.addEventListener('touchmove',onMove,{passive:true});
  el.addEventListener('touchend',onEnd,{passive:true});
  function onCancel(){start=null}
  el.addEventListener('touchcancel',onCancel,{passive:true});
  return()=>{el.removeEventListener('touchstart',onStart);el.removeEventListener('touchmove',onMove);el.removeEventListener('touchend',onEnd);el.removeEventListener('touchcancel',onCancel);root.style.overscrollBehaviorX=prevOverscroll;document.body.style.overscrollBehaviorX=''};
 },[phase]);

 useEffect(()=>{
  function key(e:KeyboardEvent){
   const target=e.target as HTMLElement;if(target.closest('input,textarea,select'))return;
   if(e.key==='ArrowRight'||e.key==='PageDown')go(page+1);
   if(e.key==='ArrowLeft'||e.key==='PageUp')go(page-1);
  }
  window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
 },[go,page]);

 function switchBook(b:Doc){
  if(b.id===docId)return;
  setTitle(konyvCim(b.title,b.filename));setPage(b.pdf_page||0);setDocId(b.id);
 }

 async function addStroke(s:{tool:'marker'|'pen';color:string;width:number;points:number[][]}){
  const temp:Stroke={id:'tmp-'+Date.now()+'-'+Math.random().toString(36).slice(2),pdf_page:page,...s,local:true};
  setStrokes(v=>[...v,temp]);history.current.push(temp.id);
  if(!inkSaved)return;
  try{
   const r=await api<{stroke:Stroke}>('pdf-ink',{method:'POST',body:JSON.stringify({documentId:docId,page,...s})});
   setStrokes(v=>v.map(x=>x.id===temp.id?r.stroke:x));
   history.current=history.current.map(id=>id===temp.id?r.stroke.id:id);
  }catch(e){
   if(e instanceof ApiError&&e.status===503){setInkSaved(false);setToast('A rajz látszik, de még nem menthető: az adatbázis-frissítés hiányzik.');return}
   fail(e);
  }
 }
 async function erase(id:string){
  setStrokes(v=>v.filter(x=>x.id!==id));
  history.current=history.current.filter(x=>x!==id);
  if(id.startsWith('tmp-')||!inkSaved)return;
  try{await api('pdf-ink?id='+encodeURIComponent(id),{method:'DELETE'})}catch(e){fail(e)}
 }
 function undo(){const last=history.current.pop();if(last)void erase(last)}

 async function removeMark(id:string){
  if(!window.confirm('Törlöd ezt a téglalapos kiemelést?'))return;
  try{await api('pdf-marks?id='+encodeURIComponent(id),{method:'DELETE'});setMarks(v=>v.filter(m=>m.id!==id))}catch(e){fail(e)}
 }
 async function addNote(){
  const body=noteDraft.trim();if(!body)return;
  try{
   await api('pdf-notes',{method:'POST',body:JSON.stringify({documentId:docId,page,body})});
   const n=await api<{notes:Note[]}>('pdf-notes?documentId='+encodeURIComponent(docId));
   setNotes(n.notes);setNoteDraft('');
  }catch(e){fail(e)}
 }
 async function removeNote(id:string){
  if(!window.confirm('Törlöd a cetlit?'))return;
  try{await api('pdf-notes?id='+encodeURIComponent(id),{method:'DELETE'});setNotes(v=>v.filter(n=>n.id!==id))}catch(e){fail(e)}
 }

 if(phase==='checking')return <div className="us-login"><p className="us-status">Betöltés…</p></div>;
 if(phase==='login')return <Belepes onDone={()=>setPhase('ready')}/>;
 if(!docId)return <div className="us-login"><p className="us-status">Nincs megadva könyv. <a href="/" style={{textDecoration:'underline'}}>Vissza a tananyaghoz</a></p></div>;

 const color=tool==='pen'?penColor:markerColor;
 const pageStrokes=strokes.filter(s=>s.pdf_page===page);
 const pageMarks=marks.filter(m=>m.pdf_page===page);
 const pageNotes=notes.filter(n=>n.pdf_page===page);
 const fitWidth=Math.min(stageWidth-(stageWidth>720?120:16),980);
 const tabs=books.length>1?books:[];

 return <div className="rd-app">
  <header className="rd-top" style={focus?{minHeight:56}:undefined}>
   <a href={topicId?'/?topic='+encodeURIComponent(topicId):'/'} className="rd-back"><Icon name="back" size={20} strokeWidth={2.2}/><span>{backLabel}</span></a>
   {tabs.length>0?<div className="rd-books" role="tablist" aria-label="Könyv">
    {tabs.map(b=><button key={b.id} type="button" role="tab" aria-selected={b.id===docId} onClick={()=>switchBook(b)}><i style={{background:spineColor(b.id)}}/>{konyvCim(b.title,b.filename)}</button>)}
   </div>:<strong style={{fontSize:16,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',minWidth:0}}>{title}</strong>}
   <div className="rd-pager">
    <button type="button" className="us-icon-btn" aria-label="Előző oldal" onClick={()=>go(page-1)} disabled={page<=1}><Icon name="back" size={18} strokeWidth={2.2}/></button>
    <label><span className="sr-only">Oldal</span>
     <input inputMode="numeric" value={pageInput} onChange={e=>setPageInput(e.target.value.replace(/\D/g,''))} onKeyDown={e=>{if(e.key==='Enter')go(Number(pageInput)||page)}} onBlur={()=>go(Number(pageInput)||page)} aria-label="Oldalszám"/>
     <span>/ {count||'…'}</span>
    </label>
    <button type="button" className="us-icon-btn" aria-label="Következő oldal" onClick={()=>go(page+1)} disabled={!count||page>=count}><Icon name="next" size={18} strokeWidth={2.2}/></button>
   </div>
   <div className="rd-right is-kompakt rd-right-olvaso">
    <Kereso kompakt onAuth={()=>setPhase('login')}/>
    <Fiokmenu/>
   </div>
   <button type="button" className="us-icon-btn" aria-label={focus?'Oldalsáv vissza':'Csak a könyv'} aria-pressed={focus} onClick={()=>setFocus(v=>!v)}><Icon name="expand" size={18}/></button>
  </header>

  <div className="rd-body">
   <div className="rd-tools" role="toolbar" aria-label="Pencil eszközök">
    <button type="button" className="rd-tool" aria-pressed={tool==='read'} aria-label="Lapozás és olvasás" title="Olvasás" onClick={()=>setTool('read')}><Icon name="hand" size={22}/></button>
    <button type="button" className="rd-tool" aria-pressed={tool==='marker'} aria-label="Kiemelő" title="Kiemelő" onClick={()=>setTool('marker')}>
     <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 4l6 6-8 8H6v-6z" stroke="currentColor" strokeWidth="1.8"/><path d="M4 21h9" stroke={markerColor} strokeWidth="3"/></svg>
    </button>
    <button type="button" className="rd-tool" aria-pressed={tool==='pen'} aria-label="Toll" title="Toll" onClick={()=>setTool('pen')}>
     <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 3l4 4L8 20l-5 1 1-5z" stroke="currentColor" strokeWidth="1.8"/><path d="M14 21h7" stroke={penColor} strokeWidth="3"/></svg>
    </button>
    <button type="button" className="rd-tool" aria-pressed={tool==='eraser'} aria-label="Radír" title="Radír" onClick={()=>setTool('eraser')}><Icon name="eraser" size={22} strokeWidth={1.8}/></button>
    <button type="button" className="rd-tool rd-tool-ai" aria-pressed={tool==='ai'} aria-label="AI-segítség: keretezd be a feladatot" title="AI-segítség" onClick={()=>setTool(t=>t==='ai'?'read':'ai')}>AI</button>
    <div className="rd-sep"/>
    {(tool==='pen'?PEN_COLORS:MARKER_COLORS).map(x=><button key={x.c} type="button" className="rd-swatch" style={{background:x.c,borderColor:'#fff'}} aria-label={x.n} aria-pressed={color===x.c&&tool!=='eraser'&&tool!=='read'} onClick={()=>{if(tool==='pen')setPenColor(x.c);else{setMarkerColor(x.c);if(tool!=='marker')setTool('marker')}}}/>)}
    <div className="rd-sep"/>
    <button type="button" className="rd-tool" aria-label="Visszavonás" title="Visszavonás" onClick={undo} disabled={!history.current.length}><Icon name="undo" size={20}/></button>
   </div>

   <div className="rd-stage" ref={stage}>
    {error?<p className="rd-loading" role="alert">{error}</p>:pdf&&page?<KonyvLap pdf={pdf} page={page} maxWidth={fitWidth} tool={tool} color={color} strokes={strokes} marks={marks} onStroke={s=>void addStroke(s)} onErase={id=>void erase(id)} selection={aiBox} onSelect={setAiBox}/>:<p className="rd-loading">A könyv megnyitása…</p>}
   </div>

   {tool==='ai'&&pdf&&page>0&&<div className="ai-dock"><AiSegitseg pdf={pdf} page={page} box={aiBox} docId={docId} topicId={topicId} meta={aiMeta} onClose={()=>{setTool('read');setAiBox(null)}} onAuth={()=>setPhase('login')}/></div>}
   {!focus&&tool!=='ai'&&<aside className="rd-side" aria-label="Ezen az oldalon">
    <section className="rd-card">
     <h2 className="us-label" style={{fontSize:12}}>Ezen az oldalon</h2>
     {pageStrokes.length+pageMarks.length===0?<p className="rd-hint">Még nincs kiemelés. Válaszd a kiemelőt vagy a tollat, és húzz a Pencillel.</p>:<ul className="rd-list">
      {pageStrokes.length>0&&<li><span className="rd-dot" style={{background:pageStrokes[pageStrokes.length-1].color}}/><span>{pageStrokes.length} kézzel húzott jelölés</span></li>}
      {pageMarks.map((m,i)=><li key={m.id}><span className="rd-dot" style={{background:'#FFD84D',borderRadius:2}}/><span>Téglalapos kiemelés {i+1}</span><button type="button" aria-label="Törlés" onClick={()=>void removeMark(m.id)}><Icon name="close" size={14}/></button></li>)}
     </ul>}
     {!inkSaved&&<p className="rd-hint" style={{color:'#7A4A00'}}>A kézi rajz most csak ezen a képernyőn látszik. A mentéshez le kell futtatni a 006-os adatbázis-frissítést.</p>}
     <p className="rd-hint">Pencillel rajzolsz, ujjal lapozol és görgetsz.</p>
    </section>
    <section className="rd-card">
     <h2 className="us-label" style={{fontSize:12}}>Cetli ehhez az oldalhoz</h2>
     {pageNotes.length>0&&<ul className="rd-list">{pageNotes.map(n=><li key={n.id}><span className="rd-dot" style={{background:'#FFE36B',borderRadius:2}}/><span>{n.body}</span><button type="button" aria-label="Cetli törlése" onClick={()=>void removeNote(n.id)}><Icon name="close" size={14}/></button></li>)}</ul>}
     <label className="sr-only" htmlFor="rd-note">Új cetli</label>
     <textarea id="rd-note" value={noteDraft} onChange={e=>setNoteDraft(e.target.value)} placeholder="Mire figyelj órán ennél az oldalnál…" maxLength={4000}/>
     <button type="button" className="us-btn us-btn-dark" onClick={()=>void addNote()} disabled={!noteDraft.trim()}>Cetli mentése</button>
    </section>
   </aside>}
  </div>
  {toast&&<div className="us-toast" role="status"><span style={{flex:1}}>{toast}</span><button type="button" onClick={()=>setToast('')}>Rendben</button></div>}
 </div>;
}
