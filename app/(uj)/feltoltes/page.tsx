'use client';
import {Suspense,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import type {PDFDocumentProxy} from 'pdfjs-dist';
import {api,ApiError,hasSession,localPrefs} from '../../../lib/client-api';
import {inspectPdf} from '../../../lib/pdf-contents';
import {detectOffset,guessContentsPages,openPdf,pageJpeg,thumbnail} from '../../../lib/pdf-pages';
import {suggestedTopicMatch} from '../../../lib/topic-matching';
import {Icon,spineColor} from '../icons';
import {konyvCim} from '../../../lib/konyv-cim';
import Belepes from '../Belepes';

type Subject={id:string;name:string};
type Topic={id:string;name:string;parent_id:string|null};
type Doc={id:string;title:string;filename:string;mime_type:string};
type Step='pick'|'upload'|'contents'|'offset'|'reading'|'match'|'saving'|'done';
type Row={key:number;title:string;group:string;page:number;target:string;state:'suggested'|'approved'|'skipped'|'open';newParent:string;extra:string[];picked?:boolean;adding?:boolean};
type Audit={numberedCount:number;range:number[]|null;missing:number[];duplicated:number[]};

const KINDS:[string,string][]=[['reference','Tankönyv'],['exercise','Feladatgyűjtemény'],['worksheet','Feladatlap'],['solution','Megoldókulcs'],['notes','Jegyzet'],['table','Függvénytáblázat']];
const MIME:Record<string,string>={pdf:'application/pdf',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation'};
const MAX_AI_PAGES=4;

export default function FeltoltesOldal(){
 return <Suspense fallback={<div className="us-login"><p className="us-status">Betöltés…</p></div>}><Feltoltes/></Suspense>;
}

/** A fájl közvetlen feltöltése a privát tárhelyre, haladásjelzéssel. */
function putFile(url:string,file:File,mime:string,onProgress:(pct:number)=>void):Promise<void>{
 return new Promise((resolve,reject)=>{
  const xhr=new XMLHttpRequest();
  xhr.open('PUT',url,true);xhr.timeout=10*60*1000;xhr.setRequestHeader('Content-Type',mime);
  xhr.upload.onprogress=e=>{if(e.lengthComputable&&e.total)onProgress(Math.min(99,Math.round(e.loaded/e.total*100)))};
  xhr.onload=()=>{
   if(xhr.status>=200&&xhr.status<300){resolve();return}
   // Csak a tárhely hibakódját mutatjuk, aláírt címet soha.
   const code=xhr.responseText.match(/<Code>([A-Za-z0-9_-]{2,80})<\/Code>/)?.[1]||'ismeretlen';
   reject(new Error('A tárhely visszautasította a feltöltést ('+xhr.status+', '+code+').'));
  };
  xhr.onerror=()=>reject(new Error('Nem sikerült elérni a privát tárhelyet. Ellenőrizd az internetkapcsolatot.'));
  xhr.ontimeout=()=>reject(new Error('A feltöltés időtúllépés miatt megszakadt.'));
  xhr.send(file);
 });
}

function Feltoltes(){
 const params=useSearchParams();
 const linkTopic=params.get('topicId')||'';
 const [phase,setPhase]=useState<'checking'|'login'|'ready'>('checking');
 const [step,setStep]=useState<Step>('pick');
 const [subjects,setSubjects]=useState<Subject[]>([]);
 const [subjectId,setSubjectId]=useState('');
 const [topics,setTopics]=useState<Topic[]>([]);
 const [library,setLibrary]=useState<Doc[]>([]);
 const [kind,setKind]=useState('reference');
 const [title,setTitle]=useState('');
 const [file,setFile]=useState<File|null>(null);
 const [progress,setProgress]=useState(0);
 const [docId,setDocId]=useState('');
 const [pdf,setPdf]=useState<PDFDocumentProxy|null>(null);
 const [thumbs,setThumbs]=useState<{page:number;url:string}[]>([]);
 const [picked,setPicked]=useState<number[]>([]);
 const [offset,setOffset]=useState<number|null>(null);
 const [offsetPage,setOffsetPage]=useState(10);
 const [offsetThumb,setOffsetThumb]=useState('');
 const [printed,setPrinted]=useState('');
 const [rows,setRows]=useState<Row[]>([]);
 const [audit,setAudit]=useState<Audit|null>(null);
 const [status,setStatus]=useState('');
 const [error,setError]=useState('');
 const [savedCount,setSavedCount]=useState(0);
 const [aiState,setAiState]=useState<'idle'|'running'|'done'|'failed'>('idle');
 const pdfRef=useRef<PDFDocumentProxy|null>(null);

 const fail=useCallback((e:unknown)=>{
  if(e instanceof ApiError&&e.status===401){setPhase('login');return}
  setError(e instanceof Error?e.message:'Ismeretlen hiba');
 },[]);

 useEffect(()=>{let alive=true;hasSession().then(ok=>{if(alive)setPhase(ok?'ready':'login')});return()=>{alive=false}},[]);
 useEffect(()=>()=>{void pdfRef.current?.destroy()},[]);

 useEffect(()=>{
  if(phase!=='ready')return;
  (async()=>{
   const [s,d]=await Promise.all([api<{subjects:Subject[]}>('subjects'),api<{documents:Doc[]}>('documents')]);
   setSubjects(s.subjects);setLibrary(d.documents);
   const saved=localPrefs.get<string>('us-subject','');
   setSubjectId(s.subjects.find(x=>x.id===saved)?.id||s.subjects[0]?.id||'');
  })().catch(fail);
 },[phase,fail]);
 useEffect(()=>{
  if(!subjectId)return;
  api<{topics:Topic[]}>('topics?subjectId='+encodeURIComponent(subjectId)).then(r=>setTopics(r.topics)).catch(fail);
 },[subjectId,fail]);

 const mains=useMemo(()=>topics.filter(t=>!t.parent_id||!topics.some(p=>p.id===t.parent_id)),[topics]);
 const label=useCallback((id:string)=>{
  const t=topics.find(x=>x.id===id);if(!t)return '';
  const parent=t.parent_id?topics.find(x=>x.id===t.parent_id):null;
  return parent?parent.name+' › '+t.name:t.name;
 },[topics]);

 function chooseFile(f:File|null){
  setFile(f);setError('');
  if(f&&!title)setTitle(f.name.replace(/\.[a-z0-9]{2,5}$/i,'').replace(/[_-]+/g,' ').trim());
 }

 /** A PDF előkészítése: beépített könyvjelzők, majd a tartalomjegyzék-oldalak kiválasztása. */
 async function preparePdf(data:ArrayBuffer,source:File){
  setStatus('A könyv beolvasása…');
  const opened=await openPdf(data);
  pdfRef.current=opened;setPdf(opened);
  // 1. Ha a PDF-ben vannak könyvjelzők, azok a legpontosabbak.
  try{
   const local=await inspectPdf(source);
   if(local.chapters.some(c=>c.source==='outline')){
    buildRows(local.chapters.map(c=>({title:c.title,page:c.page,group:''})));
    setStatus('A PDF saját könyvjelzőiből olvastam ki a fejezeteket.');
    setStep('match');return;
   }
  }catch{/* a helyi elemzés hibája nem akadály, jön az AI */}
  // 2. Különben a tanár kiválasztja a tartalomjegyzék oldalait.
  const n=opened.numPages;
  const pages=[...new Set([...Array.from({length:Math.min(16,n)},(_,i)=>i+1),...Array.from({length:Math.min(8,n)},(_,i)=>n-7+i).filter(p=>p>16)])];
  setStep('contents');setThumbs([]);
  const guessed=await guessContentsPages(opened,pages);
  setPicked(guessed.slice(0,MAX_AI_PAGES));
  for(const p of pages){
   const url=await thumbnail(opened,p);
   setThumbs(v=>[...v,{page:p,url}]);
  }
  setStatus(guessed.length?'Bejelöltem, ahol a TARTALOM szót láttam. Ellenőrizd.':'Koppints azokra az oldalakra, ahol a tartalomjegyzék van.');
 }

 async function startUpload(){
  if(!file)return;
  setError('');setStep('upload');setProgress(0);
  try{
   if(file.size>500*1024*1024)throw new Error('Legfeljebb 500 MB-os fájl tölthető fel.');
   const mime=file.type||MIME[file.name.split('.').pop()?.toLowerCase()||'']||'';
   if(!mime)throw new Error('Ezt a fájltípust nem tudom fogadni. PDF, kép, Word, Excel vagy PowerPoint lehet.');
   setStatus('Feltöltés előkészítése…');
   const up=await api<{documentId:string;uploadUrl:string}>('upload',{method:'POST',body:JSON.stringify({filename:file.name,title:title.trim()||file.name,mimeType:mime,size:file.size})});
   setStatus('Feltöltés a privát tárhelyre…');
   await putFile(up.uploadUrl,file,mime,setProgress);
   setProgress(100);setStatus('Ellenőrzés…');
   await api('upload/complete',{method:'POST',body:JSON.stringify({documentId:up.documentId})});
   setDocId(up.documentId);
   if(mime!=='application/pdf'){
    if(linkTopic)await api('links',{method:'POST',body:JSON.stringify({topicId:linkTopic,documentId:up.documentId,category:kind,page:null})});
    setSavedCount(linkTopic?1:0);setStep('done');return;
   }
   await preparePdf(await file.arrayBuffer(),file);
  }catch(e){setStep('pick');fail(e)}
 }

 async function useExisting(d:Doc){
  setError('');setTitle(konyvCim(d.title,d.filename));setDocId(d.id);setStep('upload');setProgress(100);setStatus('A könyv megnyitása…');
  try{
   const {url}=await api<{url:string}>('download?id='+encodeURIComponent(d.id));
   const response=await fetch(url);if(!response.ok)throw new Error('A könyv nem olvasható ('+response.status+').');
   const blob=await response.blob();
   const asFile=new File([blob],d.filename,{type:'application/pdf'});
   await preparePdf(await asFile.arrayBuffer(),asFile);
  }catch(e){setStep('pick');fail(e)}
 }

 function togglePage(p:number){
  setPicked(v=>v.includes(p)?v.filter(x=>x!==p):v.length>=MAX_AI_PAGES?v:[...v,p].sort((a,b)=>a-b));
 }

 async function confirmContents(){
  if(!pdf||!picked.length)return;
  setError('');setStatus('A lapalji oldalszám keresése…');
  const auto=await detectOffset(pdf);
  if(auto!==null){setOffset(auto);await readContents(auto);return}
  // Szkennelt könyvnél a tanár olvassa le egyszer egy lap alján a számot.
  const sample=Math.min(pdf.numPages,Math.max(...picked)+4);
  setOffsetPage(sample);setOffsetThumb(await thumbnail(pdf,sample,420));setPrinted('');setStep('offset');
 }
 async function confirmOffset(){
  const n=Number(printed);
  if(!Number.isInteger(n)||n<1||n>5000){setError('Írd be a lap alján látható számot.');return}
  setError('');const value=offsetPage-n;setOffset(value);await readContents(value);
 }

 async function readContents(shift:number){
  if(!pdf)return;
  setStep('reading');setStatus('A tartalomjegyzék oldalainak előkészítése…');
  try{
   const images=[];
   for(const p of picked)images.push({page:p,data:await pageJpeg(pdf,p)});
   setStatus('A Gemini olvassa a tartalomjegyzéket…');
   const data=await api<{lessons:{title:string;printedPage:number;chapterTitle?:string}[];diagnostics:Audit}>('ai-contents',{method:'POST',body:JSON.stringify({documentId:docId,images})},70000);
   const seen=new Set<string>();const found:{title:string;page:number;group:string}[]=[];
   for(const item of data.lessons||[]){
    const name=item.title.replace(/\s+/g,' ').trim().replace(/^(?:\d{1,3}|R)\s+/,'');
    const page=item.printedPage+shift;
    const key=name.toLocaleLowerCase('hu')+':'+page;
    if(name.length<3||page<1||page>pdf.numPages||seen.has(key))continue;
    seen.add(key);found.push({title:name,page,group:(item.chapterTitle||'').trim()});
   }
   if(!found.length)throw new Error('A Gemini nem talált fejezetet ezeken az oldalakon. Válassz más oldalakat.');
   found.sort((a,b)=>a.page-b.page);
   setAudit(data.diagnostics);buildRows(found);
   setStatus(found.length+' fejezetet találtam. Az AI javasol, te döntesz.');setStep('match');
  }catch(e){setStep('contents');fail(e)}
 }

 function buildRows(items:{title:string;page:number;group:string}[]){
  setAiState('idle');
  const subs=topics.filter(t=>t.parent_id);
  const candidates=subs.length?subs:topics;
  setRows(items.map((it,i)=>{
   const match=suggestedTopicMatch(it.title,candidates);
   return {key:i,title:it.title,group:it.group,page:it.page,target:match?.id||'',state:match?'suggested':'open',newParent:'',extra:[]};
  }));
 }
 // Ha a témák később érkeznek, mint a fejezetek, a javaslatokat frissítjük.
 useEffect(()=>{
  if(step!=='match'||!topics.length)return;
  setRows(v=>v.some(r=>r.state!=='open'||r.target)?v:v.map(r=>{
   const subs=topics.filter(t=>t.parent_id);const m=suggestedTopicMatch(r.title,subs.length?subs:topics);
   return m?{...r,target:m.id,state:'suggested'}:r;
  }));
 },[topics,step]);

 // A Gemini tartalom alapján párosít; a pontos szóegyezést (fent) nem írja felül.
 useEffect(()=>{
  if(step!=='match'||aiState!=='idle'||!topics.length||!subjectId||!rows.length)return;
  setAiState('running');
  const chapters=rows.filter(r=>r.state==='open'&&!r.target).map(r=>({key:r.key,title:r.title,group:r.group}));
  if(!chapters.length){setAiState('done');return}
  setStatus(rows.length+' fejezetet találtam. Az AI most keresi a párjukat…');
  api<{matches:{key:number;topicId:string;confidence:'high'|'low'}[]}>('ai-match',{method:'POST',body:JSON.stringify({subjectId,chapters})},60000)
   .then(r=>{
    const found=new Map(r.matches.map(m=>[m.key,m]));
    setRows(v=>v.map(row=>{const m=found.get(row.key);return m&&row.state==='open'&&!row.target&&topics.some(t=>t.id===m.topicId)?{...row,target:m.topicId,state:'suggested'}:row}));
    setStatus(rows.length+' fejezetből '+(r.matches.length+rows.length-chapters.length)+' fejezethez találtam párt. Az AI javasol, te döntesz.');
    setAiState('done');
   })
   .catch(e=>{
    setAiState('failed');
    if(e instanceof ApiError&&e.status===401){fail(e);return}
    setStatus('Az AI-párosítás most nem sikerült, ezért csak a pontos névegyezéseket javasoltam. '+(e instanceof Error?e.message:''));
   });
 },[step,aiState,topics,subjectId,rows,fail]);

 const update=(key:number,patch:Partial<Row>)=>setRows(v=>v.map(r=>r.key===key?{...r,...patch}:r));
 /** Kézi választás: a következő, még párosítatlan (vagy korábban így kitöltött) sorokba javaslatként átvisszük. */
 function pick(key:number,target:string){
  if(!target)return;
  setRows(v=>{
   const at=v.findIndex(r=>r.key===key);
   return v.map((r,i)=>{
    if(r.key===key)return {...r,target,state:'approved',picked:false};
    if(i>at&&r.state!=='approved'&&r.state!=='skipped'&&(!r.target||r.picked))return {...r,target,state:'suggested',picked:true};
    return r;
   });
  });
 }
 function addExtra(key:number,target:string){
  setRows(v=>v.map(r=>r.key===key?{...r,adding:false,extra:target&&target!==r.target&&!r.extra.includes(target)?[...r.extra,target]:r.extra}:r));
 }

 async function createSub(r:Row){
  if(!r.newParent)return;
  try{
   const created=await api<{topic:Topic}>('topics',{method:'POST',body:JSON.stringify({name:r.title.slice(0,120),subjectId,parentId:r.newParent})});
   setTopics(v=>[...v,created.topic]);update(r.key,{target:created.topic.id,state:'approved',newParent:''});
  }catch(e){fail(e)}
 }

 const approved=rows.filter(r=>r.state==='approved'&&r.target);
 const waiting=rows.filter(r=>r.state==='open'||(r.state==='suggested'&&r.target)).length;

 async function save(all:boolean){
  const list=rows.filter(r=>r.target&&(r.state==='approved'||(all&&r.state==='suggested')));
  if(!list.length){setError('Még egy fejezetet sem hagytál jóvá.');return}
  // Egy altémához több fejezet, egy fejezethez több altéma is tartozhat.
  const jobs:{topicId:string;page:number;title:string}[]=[];const seen=new Set<string>();
  for(const r of list)for(const t of [r.target,...r.extra]){const k=t+':'+r.page;if(!seen.has(k)){seen.add(k);jobs.push({topicId:t,page:r.page,title:r.title})}}
  setError('');setStep('saving');let count=0;
  try{
   for(const j of jobs){
    setStatus('Mentés: '+(count+1)+' / '+jobs.length);
    await api('links',{method:'POST',body:JSON.stringify({topicId:j.topicId,documentId:docId,category:kind,page:j.page,chapterTitle:j.title})});
    count++;
   }
   setSavedCount(count);setStep('done');
  }catch(e){setSavedCount(count);setStep('match');fail(e)}
 }

 if(phase==='checking')return <div className="us-login"><p className="us-status">Betöltés…</p></div>;
 if(phase==='login')return <Belepes onDone={()=>setPhase('ready')}/>;

 const steps=[
  {n:1,t:'Feltöltve',d:'Privát tárhelyre mentve',done:['contents','offset','reading','match','saving','done'].includes(step),now:step==='pick'||step==='upload'},
  {n:2,t:'Tartalomjegyzék megtalálva',d:'AI olvassa ki a könyv elejéről',done:['match','saving','done'].includes(step),now:['contents','offset','reading'].includes(step)},
  {n:3,t:'Párosítás a témakörökkel',d:'Az AI javasol, te döntesz',done:step==='done',now:step==='match'||step==='saving'},
  {n:4,t:'Kész',d:'Rányomsz, és kinyílik',done:step==='done',now:false}
 ];

 return <div className="us-app">
  <header className="rd-top">
   <a href="/" className="rd-back"><Icon name="back" size={20} strokeWidth={2.2}/><span>Tananyag</span></a>
   <h1 style={{margin:0,fontSize:20,fontWeight:800,letterSpacing:'-.2px'}}>Új könyv a könyvtárba</h1>
  </header>
  <div className="up-body">
   <aside className="up-side">
    {(title||docId)&&<div className="up-book">
     <span className="up-spine" style={{background:spineColor(docId||title)}}/>
     <div style={{minWidth:0}}><b>{title||'Új könyv'}</b><small>{(KINDS.find(k=>k[0]===kind)?.[1]||'')+(subjects.find(s=>s.id===subjectId)?' · '+subjects.find(s=>s.id===subjectId)!.name:'')}</small></div>
    </div>}
    <ol className="up-steps">
     {steps.map(s=><li key={s.n}>
      <span className={'up-step-dot'+(s.done?' is-done':s.now?' is-now':'')}>{s.done?<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>:s.n}</span>
      <div><b style={s.now?{fontWeight:800}:undefined}>{s.t}</b><small>{s.d}</small></div>
     </li>)}
    </ol>
    <p className="up-hint">Ha a tartalomjegyzékből valami nem egyértelmű, nem párosítok helyetted. Az ilyen sort sárgán jelzem, és te döntöd el, hova tartozik.</p>
   </aside>

   <main className="up-main">
    {error&&<p className="up-error" role="alert">{error}</p>}

    {step==='pick'&&<section className="up-card">
     <h2>Melyik könyvet töltöd fel?</h2>
     <div className="up-grid">
      <label className="us-field">A könyv címe<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="pl. OH Matematika 10." maxLength={160}/></label>
      <label className="us-field">Típusa<select className="up-select" value={kind} onChange={e=>setKind(e.target.value)}>{KINDS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
      <label className="us-field">Tantárgy<select className="up-select" value={subjectId} onChange={e=>{setSubjectId(e.target.value);localPrefs.set('us-subject',e.target.value)}}>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
     </div>
     <label className="up-drop">
      <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx,.pptx,application/pdf" onChange={e=>chooseFile(e.currentTarget.files?.[0]||null)}/>
      <span className="up-drop-icon"><Icon name="upload" size={24}/></span>
      <b>{file?file.name:'Fájl kiválasztása'}</b>
      <small>{file?Math.max(1,Math.round(file.size/1048576))+' MB':'iPaden a Fájlok alkalmazásból, Macen a Finderből. Legfeljebb 500 MB.'}</small>
     </label>
     <div className="up-actions"><button type="button" className="us-btn us-btn-dark" disabled={!file||!subjectId} onClick={()=>void startUpload()}>Feltöltés és folytatás<Icon name="arrow" size={16}/></button></div>
     {library.filter(d=>d.mime_type==='application/pdf').length>0&&<div className="up-existing">
      <h3 className="us-label">Vagy egy már feltöltött könyv újrapárosítása</h3>
      <ul>{library.filter(d=>d.mime_type==='application/pdf').map(d=><li key={d.id}><button type="button" className="us-row" onClick={()=>void useExisting(d)}><span className="up-mini-spine" style={{background:spineColor(d.id)}}/><span style={{flex:1,textAlign:'left'}}>{konyvCim(d.title,d.filename)}</span><Icon name="next" size={16}/></button></li>)}</ul>
     </div>}
    </section>}

    {step==='upload'&&<section className="up-card">
     <h2>Feltöltés</h2>
     <div className="up-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{width:progress+'%'}}/></div>
     <p className="us-status" role="status">{status} {progress>0&&progress<100?progress+'%':''}</p>
    </section>}

    {step==='contents'&&<section className="up-card">
     <h2>Hol van a tartalomjegyzék?</h2>
     <p className="us-status" role="status">{status} Legfeljebb {MAX_AI_PAGES} oldalt jelölhetsz ki.</p>
     <div className="up-thumbs">
      {thumbs.map(t=><button key={t.page} type="button" className="up-thumb" aria-pressed={picked.includes(t.page)} onClick={()=>togglePage(t.page)}>
       {/* eslint-disable-next-line @next/next/no-img-element */}
       <img src={t.url} alt={t.page+'. PDF-oldal'}/>
       <span>{t.page}.</span>
      </button>)}
      {pdf&&thumbs.length<Math.min(24,pdf.numPages)&&<p className="us-status">Előnézetek készítése…</p>}
     </div>
     <div className="up-actions"><span>{picked.length?picked.length+' oldal kijelölve':'Még nincs kijelölt oldal'}</span><button type="button" className="us-btn us-btn-dark" disabled={!picked.length} onClick={()=>void confirmContents()}>Tartalomjegyzék kiolvasása<Icon name="arrow" size={16}/></button></div>
    </section>}

    {step==='offset'&&<section className="up-card">
     <h2>Egy gyors kérdés</h2>
     <p className="us-status">A könyv oldalszámait nem tudom gépileg leolvasni. Nézd meg ennek a lapnak az alját: milyen szám áll ott? Ebből tudom, hova kell majd ugranom.</p>
     <div className="up-offset">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {offsetThumb&&<img src={offsetThumb} alt={offsetPage+'. PDF-oldal'}/>}
      <div style={{display:'flex',flexDirection:'column',gap:12}}>
       <label className="us-field">A lap alján lévő szám<input inputMode="numeric" value={printed} onChange={e=>setPrinted(e.target.value.replace(/\D/g,''))} onKeyDown={e=>{if(e.key==='Enter')void confirmOffset()}} autoFocus/></label>
       <button type="button" className="us-btn us-btn-dark" disabled={!printed} onClick={()=>void confirmOffset()}>Mehet</button>
       <button type="button" className="us-btn us-btn-ghost" onClick={()=>{if(pdf){const p=Math.min(pdf.numPages,offsetPage+1);setOffsetPage(p);void thumbnail(pdf,p,420).then(setOffsetThumb)}}}>Ezen nincs szám, mutass másikat</button>
      </div>
     </div>
    </section>}

    {(step==='reading'||step==='saving')&&<section className="up-card"><h2>{step==='reading'?'A tartalomjegyzék olvasása':'Mentés'}</h2><p className="us-status" role="status">{status}</p><div className="up-bar is-busy"><span/></div></section>}

    {step==='match'&&<section className="up-card up-match">
     <div className="up-match-head"><h2>Hova kerüljenek a fejezetek?</h2><span className="us-status">{status}</span></div>
     {audit&&(audit.missing.length>0||audit.duplicated.length>0)&&<p className="up-warn">A fejezetszámozásban {audit.missing.length?'hiány van ('+audit.missing.join(', ')+')':''}{audit.missing.length&&audit.duplicated.length?', és ':''}{audit.duplicated.length?'ismétlődés van ('+audit.duplicated.join(', ')+')':''}. Lehet, hogy egy tartalomjegyzék-oldal kimaradt.</p>}
     {aiState==='running'&&<div className="up-ai-busy" role="status"><span className="up-ai-bar" aria-hidden="true"/><span>Az AI a tananyagfádban keresi a fejezetek párját. Ez fél percig is eltarthat.</span></div>}
     <div className="up-table" role="table" aria-label="Fejezetek párosítása" aria-busy={aiState==='running'}>
      <div className="up-tr up-th" role="row"><span role="columnheader">A könyvben</span><span role="columnheader">Nálad, a tananyagfában</span><span role="columnheader" style={{textAlign:'right'}}>Döntés</span></div>
      {rows.map(r=><div key={r.key} role="row" className={'up-tr'+(r.state==='approved'?' is-approved':'')+(r.state==='skipped'?' is-skipped':'')}>
       <span role="cell" className="up-chapter"><b>{r.title}</b>{r.group&&<small>{r.group}</small>}</span>
       <span role="cell">
        {r.state==='open'&&!r.target?<span className="up-missing">
         <select className="up-select" value="" onChange={e=>pick(r.key,e.target.value)} aria-label={r.title+': altéma választása'}>
          <option value="">Nincs párja, válassz…</option>
          {mains.map(m=><optgroup key={m.id} label={m.name}>{[m,...topics.filter(t=>t.parent_id===m.id)].map(t=><option key={t.id} value={t.id}>{t.id===m.id?m.name+' (egész témakör)':t.name}</option>)}</optgroup>)}
         </select>
        </span>:<span className="up-target">{label(r.target).split(' › ').map((part,i,arr)=>i<arr.length-1?<span key={i} style={{color:'#586274'}}>{part} › </span>:<b key={i}>{r.state==='approved'?<span className="us-marker">{part}</span>:part}</b>)}</span>}
        {r.target&&(r.extra.length>0||r.adding||r.state!=='skipped')&&<span className="up-extra">
         {r.extra.map(x=><span key={x} className="up-extra-chip">{label(x)}<button type="button" aria-label={label(x)+' eltávolítása'} onClick={()=>update(r.key,{extra:r.extra.filter(y=>y!==x)})}>×</button></span>)}
         {r.adding?<select className="up-select" value="" autoFocus onChange={e=>addExtra(r.key,e.target.value)} onBlur={()=>update(r.key,{adding:false})} aria-label={r.title+': még egy altéma'}>
          <option value="">Melyik altémához tartozik még?</option>
          {mains.map(m=><optgroup key={m.id} label={m.name}>{[m,...topics.filter(t=>t.parent_id===m.id)].map(t=><option key={t.id} value={t.id}>{t.id===m.id?m.name+' (egész témakör)':t.name}</option>)}</optgroup>)}
         </select>:r.state!=='skipped'&&<button type="button" className="us-btn us-btn-ghost up-extra-add" onClick={()=>update(r.key,{adding:true})}>+ még egy altéma</button>}
        </span>}
        {r.newParent!==''&&<span className="up-newsub">
         <select className="up-select" value={r.newParent==='?'?'':r.newParent} onChange={e=>update(r.key,{newParent:e.target.value||'?'})} aria-label="Melyik témakör alá?">
          <option value="">Melyik témakör alá?</option>{mains.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
         </select>
         <button type="button" className="us-btn us-btn-dark" disabled={r.newParent==='?'} onClick={()=>void createSub(r)}>Létrehozás</button>
        </span>}
       </span>
       <span role="cell" className="up-decide">
        {r.state==='approved'?<button type="button" className="us-btn us-btn-teal" onClick={()=>update(r.key,{state:r.target?'suggested':'open'})} aria-label={r.title+': jóváhagyva, visszavonás'}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>Jóváhagyva</button>
        :r.state==='skipped'?<button type="button" className="us-btn" onClick={()=>update(r.key,{state:r.target?'suggested':'open'})}>Mégis kell</button>
        :<>
         {r.target&&<button type="button" className="us-btn up-ok" onClick={()=>update(r.key,{state:'approved'})}>Jó</button>}
         {r.target&&<button type="button" className="us-btn" onClick={()=>update(r.key,{target:'',state:'open',picked:false})}>Másik</button>}
         {!r.target&&<button type="button" className="us-btn" onClick={()=>update(r.key,{newParent:'?'})}>Új altéma</button>}
         <button type="button" className="us-btn us-btn-soft" onClick={()=>update(r.key,{state:'skipped',newParent:''})}>Kihagyom</button>
        </>}
       </span>
      </div>)}
     </div>
     <div className="up-foot">
      <span><b>{rows.length} fejezet</b> · {approved.length} jóváhagyva{waiting?' · '+waiting+' vár a döntésedre':''}</span>
      <button type="button" className="us-btn" disabled={!approved.length} onClick={()=>void save(false)}>Csak a jóváhagyottakat mentem</button>
      <button type="button" className="us-btn us-btn-dark" disabled={!rows.some(r=>r.target&&r.state!=='skipped')} onClick={()=>void save(true)}>Mindet elfogadom és mentem</button>
     </div>
    </section>}

    {step==='done'&&<section className="up-card">
     <h2>Kész</h2>
     <p className="us-status">{savedCount?savedCount+' helyen kapcsoltam a könyvet a témáidhoz. A tananyagban rányomsz a témára, és ott nyílik ki.':'A fájl a könyvtáradban van. Témához később is rendelheted.'}</p>
     <div className="up-actions"><a className="us-btn us-btn-dark" href="/">Vissza a tananyaghoz</a><button type="button" className="us-btn" onClick={()=>{setStep('pick');setFile(null);setTitle('');setDocId('');setRows([]);setThumbs([]);setPicked([]);setAudit(null);setStatus('');setSavedCount(0)}}>Másik könyv</button></div>
    </section>}
   </main>
  </div>
 </div>;
}
