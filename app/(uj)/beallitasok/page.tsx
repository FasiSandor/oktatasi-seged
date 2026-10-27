'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {api,ApiError,hasSession,localPrefs,signOut} from '../../../lib/client-api';
import {authClient} from '../../../lib/auth-client';
import {konyvCim} from '../../../lib/konyv-cim';
import {makeBackup,readBackup,restoreBackup,tableLabel,type ReadResult} from '../../../lib/mentes';
import {PRICES_CHECKED,USD_HUF} from '../../../lib/ai-arak';
import {Icon} from '../icons';
import Belepes from '../Belepes';
import Kereso from '../Kereso';
import Fiokmenu from '../Fiokmenu';

type Subject={id:string;name:string};
type Doc={id:string;title:string;filename:string|null;mime_type:string;created_at:string;subject_id?:string|null;role?:string};
type Arva={key:string;name:string;size:number;modified:string|null};
type Tarhely={osszes:{db:number;bajt:number};gazdatlan:{db:number;bajt:number;lista:Arva[]};csonka:boolean};
type Lomtar={items:{id:string;title:string;filename:string|null;mime_type:string;byte_size:number|null;archived_at:string|null;link_count:number}[];napok:number;schemaReady:boolean};
type Month={month:string;calls:number;failed:number;input:number;output:number;usd:number;unknownPrice:boolean;features:Record<string,number>};

const ROLE_LABEL:Record<string,string>={plan:'Tanmenet',requirement:'Követelmény',other:'Egyéb dokumentum'};
const FEATURE_LABEL:Record<string,string>={contents:'Tartalomjegyzék-olvasás',match:'Fejezetek párosítása',plan:'Tanmenet párosítása',help:'Segítség feladathoz',other:'Egyéb'};
const MIME:Record<string,string>={pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',txt:'text/plain',md:'text/markdown'};
const XLSX=MIME.xlsx;

// Az alkalmazás azonosítói (Beállítások → Alkalmazás adatai). Ellenőrizve: 2026. október.
const APP={
 name:'Oktatási Segéd',
 id:'oktatasi-seged',
 production:'https://oktatasi-seged.vercel.app',
 // Amíg a rövid címre nem élesítünk, ott nincs kiszolgált változat (404). Élesítéskor true-ra kell állítani.
 productionLive:false,
 github:'https://github.com/FasiSandor/oktatasi-seged',
 vercel:'https://vercel.com/fasi-sandor-s-projects/oktatasi-seged',
 vercelUsage:'https://vercel.com/fasi-sandor-s-projects/~/usage',
 aiStudio:'https://aistudio.google.com/',
 storage:'Neon Postgres (Oktatasi-Seged projekt) és Neon privát fájltárhely'
};

function putFile(url:string,file:Blob,mime:string):Promise<void>{
 return new Promise((resolve,reject)=>{
  const xhr=new XMLHttpRequest();xhr.open('PUT',url,true);xhr.timeout=10*60*1000;xhr.setRequestHeader('Content-Type',mime);
  xhr.onload=()=>xhr.status>=200&&xhr.status<300?resolve():reject(new Error('A tárhely visszautasította a feltöltést ('+xhr.status+').'));
  xhr.onerror=()=>reject(new Error('Nem sikerült elérni a privát tárhelyet.'));
  xhr.ontimeout=()=>reject(new Error('A feltöltés időtúllépés miatt megszakadt.'));
  xhr.send(file);
 });
}
function saveBlob(name:string,blob:Blob){
 const url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),60000);
}
const mb=(b:number)=>b<1048576?Math.max(1,Math.round(b/1024))+' KB':(b/1048576).toLocaleString('hu-HU',{maximumFractionDigits:1})+' MB';
const huf=(usd:number)=>Math.round(usd*USD_HUF).toLocaleString('hu-HU')+' Ft';
const monthName=(m:string)=>{const [y,mm]=m.split('-').map(Number);return new Date(y,mm-1,1).toLocaleDateString('hu-HU',{year:'numeric',month:'long'})};

export default function Beallitasok(){
 const [phase,setPhase]=useState<'checking'|'login'|'ready'>('checking');
 const [subjects,setSubjects]=useState<Subject[]>([]);
 const [subjectId,setSubjectId]=useState('');
 const [docs,setDocs]=useState<Doc[]>([]);
 const [schemaReady,setSchemaReady]=useState(true);
 const [usage,setUsage]=useState<{months:Month[];model:string;schemaReady:boolean}|null>(null);
 const [role,setRole]=useState('plan');
 const [busy,setBusy]=useState(false);
 const [docStatus,setDocStatus]=useState('');
 const [backupStatus,setBackupStatus]=useState('');
 const [pending,setPending]=useState<ReadResult|null>(null);
 const [restoreLines,setRestoreLines]=useState<string[]>([]);
 const [email,setEmail]=useState('');
 const [toast,setToast]=useState('');
 const [tar,setTar]=useState<Tarhely|null>(null);
 const [tarStatus,setTarStatus]=useState('');
 const [origin,setOrigin]=useState('');
 const [lomtar,setLomtar]=useState<Lomtar|null>(null);
 const [lomStatus,setLomStatus]=useState('');
 useEffect(()=>{setOrigin(window.location.origin)},[]);

 const fail=useCallback((e:unknown)=>{
  if(e instanceof ApiError&&e.status===401){setPhase('login');return}
  setToast(e instanceof Error?e.message:'Ismeretlen hiba');
 },[]);
 useEffect(()=>{let alive=true;hasSession().then(ok=>{if(alive)setPhase(ok?'ready':'login')});return()=>{alive=false}},[]);
 const load=useCallback(async()=>{
  const [s,l]=await Promise.all([api<{subjects:Subject[]}>('subjects'),api<{documents:Doc[];schemaReady:boolean}>('library')]);
  setSubjects(s.subjects);setDocs(l.documents);setSchemaReady(l.schemaReady);
  const saved=localPrefs.get<string>('us-subject','');
  setSubjectId(v=>v||s.subjects.find(x=>x.id===saved)?.id||s.subjects[0]?.id||'');
 },[]);
 useEffect(()=>{
  if(phase!=='ready')return;
  load().catch(fail);
  api<{months:Month[];model:string;schemaReady:boolean}>('usage').then(setUsage).catch(()=>{});
  api<Lomtar>('lomtar',{},60000).then(setLomtar).catch(()=>{});
  authClient().getSession().then(r=>setEmail(r.data?.user?.email||'')).catch(()=>{});
 },[phase,load,fail]);

 const own=useMemo(()=>docs.filter(d=>d.role&&d.role!=='book'&&d.subject_id===subjectId),[docs,subjectId]);

 async function upload(file:File|null){
  if(!file||!subjectId)return;
  const ext=file.name.split('.').pop()?.toLowerCase()||'';
  const mime=ext==='md'||ext==='txt'?MIME[ext]:file.type||MIME[ext]||'';
  if(!mime){setToast('Ezt a fájltípust nem tudom fogadni. PDF, Word, szöveg, Excel, PowerPoint vagy kép lehet.');return}
  setBusy(true);setDocStatus('Feltöltés…');
  try{
   const up=await api<{documentId:string;uploadUrl:string}>('upload',{method:'POST',body:JSON.stringify({filename:file.name,title:file.name.replace(/\.[a-z0-9]{2,5}$/i,''),mimeType:mime,size:file.size})});
   await putFile(up.uploadUrl,file,mime);
   await api('upload/complete',{method:'POST',body:JSON.stringify({documentId:up.documentId})});
   await api('library',{method:'PATCH',body:JSON.stringify({id:up.documentId,role,subjectId})});
   await load();setDocStatus(ROLE_LABEL[role]+' feltöltve.'+(role==='plan'&&mime===XLSX?' Az Excelből tanmenet nézet is készülhet (lent, a fájl mellett).':''));
  }catch(e){setDocStatus('');fail(e)}finally{setBusy(false)}
 }
 async function open(d:Doc){
  try{const {url}=await api<{url:string}>('download?id='+encodeURIComponent(d.id));window.open(url,'_blank','noopener,noreferrer')}catch(e){fail(e)}
 }
 async function makeBook(d:Doc){
  if(!window.confirm('A(z) „'+konyvCim(d.title,d.filename)+'” átkerül a könyvek közé. Mehet?'))return;
  try{await api('library',{method:'PATCH',body:JSON.stringify({id:d.id,role:'book'})});await load()}catch(e){fail(e)}
 }

 async function backup(){
  setBusy(true);setBackupStatus('Mentés készítése…');setRestoreLines([]);
  try{
   const {blob,manifest}=await makeBackup(setBackupStatus);
   const day=new Date().toISOString().slice(0,10);
   saveBlob('oktatasi-seged-mentes-'+day+'.zip',blob);
   localPrefs.set('us-last-backup',manifest.createdAt);
   const rows=manifest.tables.reduce((n,t)=>n+t.rows,0);
   setBackupStatus('Kész: '+rows+' adatsor, '+Math.max(1,Math.round(blob.size/1024))+' KB. A fájl a Letöltések vagy a Fájlok közé került. '
    +manifest.notIncluded.count+' feltöltött fájl (könyvek, dokumentumok) a tárhelyen maradt, ezek nincsenek a mentésben, de a listájuk benne van.');
  }catch(e){setBackupStatus('');fail(e)}finally{setBusy(false)}
 }
 async function pickRestore(file:File|null){
  if(!file)return;
  setRestoreLines([]);setBackupStatus('A mentés ellenőrzése…');
  try{setPending(await readBackup(file));setBackupStatus('')}catch(e){setBackupStatus('');fail(e)}
 }
 async function runRestore(){
  if(!pending)return;
  setBusy(true);
  try{
   const lines=await restoreBackup(pending,setBackupStatus);
   setRestoreLines(lines.map(l=>tableLabel(l.name)+': '+l.inserted+' visszaállítva, '+l.skipped+' már megvolt'+(l.error?' (egy része nem illeszthető vissza)':'')));
   setBackupStatus('Kész. A visszaállítás csak a hiányzó adatot vette vissza.');setPending(null);
  }catch(e){setBackupStatus('');fail(e)}finally{setBusy(false)}
 }
 async function tarhelyEllenorzes(){
  setBusy(true);setTar(null);setTarStatus('A tárhely átnézése…');
  try{
   const r=await api<Tarhely>('tarhely',{},60000);
   setTar(r);
   setTarStatus(r.osszes.db+' fájl van a tárhelyen, összesen '+mb(r.osszes.bajt)+'. '+(r.gazdatlan.db?'Ebből '+r.gazdatlan.db+' fájl ('+mb(r.gazdatlan.bajt)+') gazdátlan, ezeket lent látod.':'Gazdátlan fájlt nem találtam, nincs mit takarítani.')+(r.csonka?' (Nagyon sok fájl van, csak az első 20 000-et néztem át.)':''));
  }catch(e){setTarStatus('');fail(e)}finally{setBusy(false)}
 }
 async function tarhelyTorles(){
  if(!tar?.gazdatlan.db)return;
  if(!window.confirm(tar.gazdatlan.db+' gazdátlan fájlt ('+mb(tar.gazdatlan.bajt)+') véglegesen törlök a tárhelyről. Egyik könyvedhez, dokumentumodhoz vagy mentett feladatodhoz sem tartoznak. Ez nem vonható vissza. Mehet?'))return;
  setBusy(true);setTarStatus('Törlés…');
  try{
   const r=await api<{torolve:number;bajt:number;kihagyva:number}>('tarhely',{method:'POST',body:JSON.stringify({keys:tar.gazdatlan.lista.map(x=>x.key)})},60000);
   setTar(null);
   setTarStatus('Kész: '+r.torolve+' fájlt töröltem ('+mb(r.bajt)+').'+(r.kihagyva?' '+r.kihagyva+' fájlt kihagytam, mert közben gazdát kapott vagy már nem volt meg.':''));
  }catch(e){setTarStatus('');fail(e)}finally{setBusy(false)}
 }
 // Hány nap van még hátra a végleges törlésig.
 function hatra(at:string|null,napok:number){
  if(!at)return '';
  const nap=Math.ceil((Date.parse(at)+napok*86400000-Date.now())/86400000);
  return nap<=1?'holnap véglegesen törlődik':'még '+nap+' napig visszahozható';
 }
 async function lomVissza(id:string,name:string){
  setBusy(true);setLomStatus('');
  try{
   await api('lomtar',{method:'POST',body:JSON.stringify({action:'vissza',id})});
   setLomtar(v=>v?{...v,items:v.items.filter(x=>x.id!==id)}:v);
   setLomStatus('Visszahoztam: '+name+'. Ott van a Könyvtárban, minden párosításával együtt.');
   await load();
  }catch(e){fail(e)}finally{setBusy(false)}
 }
 async function lomVegleges(id:string,name:string){
  if(!window.confirm('A(z) „'+name+'” véglegesen törlődik, minden vele együtt: a párosítások, a kiemelések és cetlik, a belőle mentett feladatok és maga a fájl. Ez nem vonható vissza. Mehet?'))return;
  setBusy(true);setLomStatus('Törlés…');
  try{
   await api('lomtar',{method:'POST',body:JSON.stringify({action:'vegleges',id})},60000);
   setLomtar(v=>v?{...v,items:v.items.filter(x=>x.id!==id)}:v);
   setLomStatus('Véglegesen töröltem: '+name+'.');
  }catch(e){setLomStatus('');fail(e)}finally{setBusy(false)}
 }
 async function lomUrites(){
  if(!lomtar?.items.length)return;
  if(!window.confirm('A lomtárban lévő '+lomtar.items.length+' könyv véglegesen törlődik, mindegyik minden vele együtt. Ez nem vonható vissza. Mehet?'))return;
  setBusy(true);setLomStatus('A lomtár ürítése…');
  try{
   let osszes=0;
   for(let i=0;i<10;i++){
    const r=await api<{torolve:number;maradt:number}>('lomtar',{method:'POST',body:JSON.stringify({action:'urites'})},60000);
    osszes+=r.torolve;
    if(!r.maradt||!r.torolve)break;
   }
   setLomtar(await api<Lomtar>('lomtar',{},60000));
   setLomStatus('Kész: '+osszes+' könyvet töröltem véglegesen.');
  }catch(e){setLomStatus('');fail(e)}finally{setBusy(false)}
 }
 function copy(text:string){navigator.clipboard?.writeText(text).then(()=>setToast('Kimásolva.'),()=>setToast(text))}

 if(phase==='checking')return <div className="us-login"><p className="us-status">Betöltés…</p></div>;
 if(phase==='login')return <Belepes onDone={()=>setPhase('ready')}/>;
 const lastBackup=localPrefs.get<string>('us-last-backup','');
 const now=usage?.months[0];
 const thisMonth=new Date().toISOString().slice(0,7);
 const current=now&&now.month===thisMonth?now:null;
 const buildTime=process.env.NEXT_PUBLIC_BUILD_TIME;
 const commit=process.env.NEXT_PUBLIC_BUILD_COMMIT;

 return <div className="us-app">
  <header className="rd-top">
   <a href="/" className="rd-back"><Icon name="back" size={20} strokeWidth={2.2}/><span>Főoldal</span></a>
   <h1 className="pg-title">Beállítások</h1>
   <div className="rd-right">
    <Kereso onAuth={()=>setPhase('login')}/>
    <Fiokmenu/>
   </div>
  </header>
  <main className="pg-main" style={{maxWidth:860}}>
   {!schemaReady&&<p className="up-warn">A Dokumentumok részhez és a könyvek besorolásához le kell futtatni a 008-as adatbázis-frissítést. A mentés és a fiók ettől függetlenül működik.</p>}

   <section className="pg-section" aria-labelledby="docs-h">
    <h2 id="docs-h">Dokumentumok</h2>
    <p>Tantárgyanként ide kerül a tanmenet, a követelmény (érettségi vagy szakmai vizsga) és minden más alapdokumentum. Ezek nem jelennek meg könyvként a témáknál.</p>
    <div className="up-grid">
     <label className="us-field">Tantárgy<select className="up-select" value={subjectId} onChange={e=>setSubjectId(e.target.value)}>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
     <label className="us-field">Mi ez?<select className="up-select" value={role} onChange={e=>setRole(e.target.value)}>{Object.entries(ROLE_LABEL).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
    </div>
    <label className={'up-drop'+(!schemaReady||busy||!subjectId?' is-disabled':'')} style={{minHeight:110}}>
     <input type="file" disabled={!schemaReady||busy||!subjectId} accept=".pdf,.docx,.txt,.md,.xlsx,.pptx,.png,.jpg,.jpeg,.webp" onChange={e=>{void upload(e.currentTarget.files?.[0]||null);e.currentTarget.value=''}}/>
     <span className="up-drop-icon"><Icon name="upload" size={22}/></span>
     <b>{ROLE_LABEL[role]} feltöltése</b>
     <small>PDF, Word, Excel vagy PowerPoint</small>
    </label>
    {docStatus&&<p className="us-status" role="status" style={{margin:0}}>{docStatus}</p>}
    {own.length>0?<ul className="pg-docs">
     {own.map(d=><li key={d.id} className="pg-row">
      <Icon name="note" size={18}/>
      <a href="#" onClick={e=>{e.preventDefault();void open(d)}}>{konyvCim(d.title,d.filename)}<br/><small>{ROLE_LABEL[d.role||'other']} · {new Date(d.created_at).toLocaleDateString('hu-HU')}</small></a>
      {d.mime_type===XLSX&&d.role==='plan'&&<a className="us-btn us-btn-ghost" href={'/tanmenet?doc='+encodeURIComponent(d.id)} style={{flex:'none'}}>Tanmenet nézet</a>}
      {d.mime_type==='application/pdf'&&<button type="button" className="us-btn us-btn-ghost" onClick={()=>void makeBook(d)}>Legyen könyv</button>}
     </li>)}
    </ul>:<p className="us-status" style={{margin:0}}>Ennél a tantárgynál még nincs feltöltött dokumentum.</p>}
   </section>

   <section className="pg-section" aria-labelledby="usage-h">
    <h2 id="usage-h">Keretek és használat</h2>
    <p>Az AI (Gemini) minden hívását az app maga számolja. A Google „tokenben” számláz: ez a szöveg és a kép mennyiségének mértékegysége, nagyjából egy szótag. A költség <b>becslés</b> a fizetős árakkal ({PRICES_CHECKED}, 1 USD ≈ {USD_HUF} Ft). Ha az ingyenes kereten vagy, ténylegesen nem fizetsz. A pontos adatot csak a Google és a Vercel saját oldala mutatja.</p>
    {usage&&!usage.schemaReady&&<p className="up-warn">A számlálóhoz le kell futtatni a 009-es adatbázis-frissítést. Utána minden AI-hívás bekerül ide.</p>}
    {usage?.schemaReady&&<>
     <div className="st-stats">
      <div className="st-stat"><small>AI-hívás ebben a hónapban</small><b>{current?.calls??0}</b>{!!current?.failed&&<small>ebből {current.failed} sikertelen</small>}</div>
      <div className="st-stat"><small>Token (be / ki)</small><b>{((current?.input??0)+(current?.output??0)).toLocaleString('hu-HU')}</b><small>{(current?.input??0).toLocaleString('hu-HU')} / {(current?.output??0).toLocaleString('hu-HU')}</small></div>
      <div className="st-stat"><small>Becsült költség</small><b>{current?huf(current.usd):'0 Ft'}</b><small>{current?'$'+current.usd.toFixed(3):'$0'}{current?.unknownPrice?' · egy modell ára ismeretlen':''}</small></div>
     </div>
     {current&&Object.keys(current.features).length>0&&<p className="us-status" style={{margin:0}}>Mire ment: {Object.entries(current.features).map(([k,v])=>(FEATURE_LABEL[k]||k)+' '+v+'×').join(', ')}.</p>}
     {usage.months.length>1&&<table className="st-table"><thead><tr><th>Hónap</th><th>Hívás</th><th>Token</th><th>Becsült költség</th></tr></thead>
      <tbody>{usage.months.map(m=><tr key={m.month}><td>{monthName(m.month)}</td><td>{m.calls}</td><td>{(m.input+m.output).toLocaleString('hu-HU')}</td><td>{huf(m.usd)}</td></tr>)}</tbody></table>}
     <p className="us-status" style={{margin:0}}>Beállított modell: {usage.model}</p>
    </>}
    <div className="st-links">
     <a className="us-btn" href={APP.aiStudio} target="_blank" rel="noopener noreferrer"><Icon name="external" size={16}/>Google AI Studio</a>
     <a className="us-btn" href={APP.vercelUsage} target="_blank" rel="noopener noreferrer"><Icon name="external" size={16}/>Vercel – keret</a>
    </div>
   </section>

   <section className="pg-section" aria-labelledby="backup-h">
    <h2 id="backup-h">Mentés és visszaállítás</h2>
    <p>A mentés egy ZIP-fájl. Benne van minden adatod (tantárgyak, témák, könyvek adatai és párosításai, jegyzetek, kiemelések, óraszámok, tanmenetek, videók), egy tartalomjegyzék, és minden részhez egy ellenőrző szám. Ebből derül ki visszaállításkor, hogy a fájl ép-e. A könyvek PDF-jei a privát tárhelyen maradnak, ezek nincsenek a mentésben, csak a listájuk. Érdemes havonta menteni, és a fájlt a Fájlokban vagy az iCloudban tartani.</p>
    {lastBackup&&<p className="us-status" style={{margin:0}}>Legutóbbi mentés ezen az eszközön: {new Date(lastBackup).toLocaleString('hu-HU')}</p>}
    <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
     <button type="button" className="us-btn us-btn-dark" disabled={busy} onClick={()=>void backup()}><Icon name="upload" size={18} style={{transform:'rotate(180deg)'}}/>Mentés letöltése</button>
     <label className="us-btn" aria-disabled={busy}>
      <input type="file" accept=".zip,application/zip,application/json,.json" className="sr-only" disabled={busy} onChange={e=>{void pickRestore(e.currentTarget.files?.[0]||null);e.currentTarget.value=''}}/>
      <Icon name="undo" size={18}/>Visszaállítás fájlból
     </label>
    </div>
    {backupStatus&&<p className="pg-progress" role="status">{backupStatus}</p>}
    {pending&&<div className="pg-section" style={{background:'var(--surface-soft)',padding:16}}>
     <h3 style={{margin:0,fontSize:17}}>A mentés tartalma</h3>
     <p style={{margin:0}}>Készült: {new Date(pending.manifest.createdAt).toLocaleString('hu-HU')}{pending.manifest.appVersion?' · app '+pending.manifest.appVersion:''}</p>
     <ul className="st-check">{pending.checks.filter(c=>c.rows>0).map(c=><li key={c.name}><span className={c.ok?'ok':'bad'}>{c.ok?'✓':'✗'}</span>{tableLabel(c.name)}: {c.rows} sor{c.ok?'':' (sérült, kihagyom)'}</li>)}</ul>
     {pending.problems.map((p,i)=><p key={i} className="up-warn">{p}</p>)}
     <p style={{margin:0}}>Csak a hiányzó adatot veszem vissza, a meglévőt nem írom felül. Ha egy adat már megvan, kimarad.</p>
     <div className="up-actions"><button type="button" className="us-btn" onClick={()=>setPending(null)}>Mégse</button><button type="button" className="us-btn us-btn-dark" disabled={busy} onClick={()=>void runRestore()}>Visszaállítás indítása</button></div>
    </div>}
    {restoreLines.length>0&&<ul className="st-check">{restoreLines.map((l,i)=><li key={i}>{l}</li>)}</ul>}
   </section>

   <section className="pg-section" aria-labelledby="lom-h">
    <h2 id="lom-h">Lomtár</h2>
    <p>A Könyvtárban törölt könyvek és jegyzetek ide kerülnek. Innen {lomtar?.napok??30} napig minden párosításukkal, kiemelésükkel és mentett feladatukkal együtt visszahozhatók. Utána, vagy ha itt véglegesen törlöd őket, minden vele együtt megszűnik, a fájl is.</p>
    {lomtar&&!lomtar.schemaReady&&<p className="up-warn">A lomtárhoz le kell futtatni a 011-es adatbázis-frissítést. Addig könyvet törölni sem lehet.</p>}
    {lomtar?.schemaReady&&(lomtar.items.length?<>
     <ul className="pg-trash-list">{lomtar.items.map(x=>{const name=konyvCim(x.title,x.filename);return <li key={x.id}>
      <span className="pg-trash-name">{name}<small>{[x.archived_at?'törölve: '+new Date(x.archived_at).toLocaleDateString('hu-HU'):'',hatra(x.archived_at,lomtar.napok),x.link_count?x.link_count+' hivatkozás':''].filter(Boolean).join(' · ')}</small></span>
      <button type="button" className="us-btn" disabled={busy} onClick={()=>void lomVissza(x.id,name)}><Icon name="undo" size={16}/>Visszahozás</button>
      <button type="button" className="us-btn us-btn-ghost is-danger" disabled={busy} onClick={()=>void lomVegleges(x.id,name)}><Icon name="trash" size={16}/>Végleges törlés</button>
     </li>})}</ul>
     <div><button type="button" className="us-btn is-danger" disabled={busy} onClick={()=>void lomUrites()}><Icon name="trash" size={18}/>Lomtár ürítése</button></div>
    </>:<p className="us-status" style={{margin:0}}>A lomtár üres.</p>)}
    {!lomtar&&<p className="us-status" style={{margin:0}}>Betöltés…</p>}
    {lomStatus&&<p className="pg-progress" role="status">{lomStatus}</p>}
   </section>

   <section className="pg-section" aria-labelledby="tar-h">
    <h2 id="tar-h">Tárhely-takarítás</h2>
    <p>Megkeresem a privát tárhelyen azokat a fájlokat, amelyek egyik könyvedhez, dokumentumodhoz vagy mentett feladatodhoz sem tartoznak, például egy félbemaradt feltöltés maradékát. Előbb csak megmutatom őket, törölni csak a jóváhagyásod után fogok. Az elmúlt 24 órában feltöltött fájlokhoz nem nyúlok.</p>
    <div><button type="button" className="us-btn" disabled={busy} onClick={()=>void tarhelyEllenorzes()}><Icon name="search" size={18}/>Tárhely ellenőrzése</button></div>
    {tarStatus&&<p className="pg-progress" role="status">{tarStatus}</p>}
    {tar&&tar.gazdatlan.db>0&&<>
     <ul className="st-check">{tar.gazdatlan.lista.map(x=><li key={x.key}><span className="bad">•</span>{x.name} · {mb(x.size)}{x.modified?' · '+new Date(x.modified).toLocaleDateString('hu-HU'):''}</li>)}</ul>
     <div className="up-actions"><button type="button" className="us-btn" onClick={()=>{setTar(null);setTarStatus('')}}>Mégse</button><button type="button" className="us-btn us-btn-dark" disabled={busy} onClick={()=>void tarhelyTorles()}><Icon name="trash" size={18}/>Gazdátlan fájlok törlése</button></div>
    </>}
   </section>

   <section className="pg-section" aria-labelledby="app-h">
    <h2 id="app-h">Alkalmazás adatai</h2>
    <div className="st-head">
     {/* eslint-disable-next-line @next/next/no-img-element */}
     <img src="/icon-192.png" alt="Az app ikonja"/>
     <div><b style={{fontSize:18}}>{APP.name}</b><br/><small className="us-status">eredeti azonosító: {APP.id}</small></div>
    </div>
    <dl className="st-info">
     <dt>Éles webcím</dt><dd><span className="st-stack"><a href={APP.production} target="_blank" rel="noopener noreferrer">{APP.production}</a>{!APP.productionLive&&<small className="us-status">még nincs élesítve</small>}</span><button type="button" className="st-copy" onClick={()=>copy(APP.production)}>Másolás</button></dd>
     <dt>Ez a változat</dt><dd><span>{origin}</span><button type="button" className="st-copy" onClick={()=>copy(origin)}>Másolás</button></dd>
     <dt>GitHub</dt><dd><a href={APP.github} target="_blank" rel="noopener noreferrer">FasiSandor/oktatasi-seged</a><button type="button" className="st-copy" onClick={()=>copy(APP.github)}>Másolás</button></dd>
     <dt>Vercel-projekt</dt><dd><a href={APP.vercel} target="_blank" rel="noopener noreferrer">oktatasi-seged</a><button type="button" className="st-copy" onClick={()=>copy(APP.vercel)}>Másolás</button></dd>
     <dt>Verzió</dt><dd>{process.env.NEXT_PUBLIC_APP_VERSION||'–'}{commit?' · '+commit:''}{process.env.NEXT_PUBLIC_BUILD_BRANCH?' · ág: '+process.env.NEXT_PUBLIC_BUILD_BRANCH:''}</dd>
     <dt>Kiadás ideje</dt><dd>{buildTime?new Date(buildTime).toLocaleString('hu-HU'):'–'}{process.env.NEXT_PUBLIC_BUILD_ENV&&process.env.NEXT_PUBLIC_BUILD_ENV!=='production'?' ('+(process.env.NEXT_PUBLIC_BUILD_ENV==='preview'?'próbaváltozat':process.env.NEXT_PUBLIC_BUILD_ENV)+')':''}</dd>
     <dt>Adattároló</dt><dd>{APP.storage}</dd>
    </dl>
   </section>

   <section className="pg-section" aria-labelledby="account-h">
    <h2 id="account-h">Fiók</h2>
    <p>Bejelentkezve: <b>{email||'…'}</b>. A feltöltés, az AI-feldolgozás és a tárhely csak bejelentkezve érhető el, így más nem használhatja a keretedet.</p>
    <div><button type="button" className="us-btn" onClick={()=>{void signOut().then(()=>setPhase('login'))}}>Kijelentkezés</button></div>
   </section>
  </main>
  {toast&&<div className="us-toast" role="status"><span style={{flex:1}}>{toast}</span><button type="button" onClick={()=>setToast('')}>Rendben</button></div>}
 </div>;
}
