'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {api,ApiError,hasSession,localPrefs,signOut} from '../../../lib/client-api';
import {authClient} from '../../../lib/auth-client';
import {konyvCim} from '../../../lib/konyv-cim';
import {Icon} from '../icons';
import Belepes from '../Belepes';

type Subject={id:string;name:string};
type Doc={id:string;title:string;filename:string|null;mime_type:string;created_at:string;subject_id?:string|null;role?:string};
type Backup={app:'oktatasi-seged';version:1;created_at:string;tables:Record<string,Record<string,unknown>[]>};

const ROLE_LABEL:Record<string,string>={plan:'Tanmenet',requirement:'Követelmény',other:'Egyéb dokumentum'};
const MIME:Record<string,string>={pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp'};

function putFile(url:string,file:File,mime:string):Promise<void>{
 return new Promise((resolve,reject)=>{
  const xhr=new XMLHttpRequest();xhr.open('PUT',url,true);xhr.timeout=10*60*1000;xhr.setRequestHeader('Content-Type',mime);
  xhr.onload=()=>xhr.status>=200&&xhr.status<300?resolve():reject(new Error('A tárhely visszautasította a feltöltést ('+xhr.status+').'));
  xhr.onerror=()=>reject(new Error('Nem sikerült elérni a privát tárhelyet.'));
  xhr.ontimeout=()=>reject(new Error('A feltöltés időtúllépés miatt megszakadt.'));
  xhr.send(file);
 });
}
function saveFile(name:string,text:string){
 const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),60000);
}

export default function Beallitasok(){
 const [phase,setPhase]=useState<'checking'|'login'|'ready'>('checking');
 const [subjects,setSubjects]=useState<Subject[]>([]);
 const [subjectId,setSubjectId]=useState('');
 const [docs,setDocs]=useState<Doc[]>([]);
 const [schemaReady,setSchemaReady]=useState(true);
 const [role,setRole]=useState('plan');
 const [busy,setBusy]=useState(false);
 const [docStatus,setDocStatus]=useState('');
 const [backupStatus,setBackupStatus]=useState('');
 const [email,setEmail]=useState('');
 const [toast,setToast]=useState('');

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
  authClient().getSession().then(r=>setEmail(r.data?.user?.email||'')).catch(()=>{});
 },[phase,load,fail]);

 const own=useMemo(()=>docs.filter(d=>d.role&&d.role!=='book'&&d.subject_id===subjectId),[docs,subjectId]);

 async function upload(file:File|null){
  if(!file||!subjectId)return;
  const mime=file.type||MIME[file.name.split('.').pop()?.toLowerCase()||'']||'';
  if(!mime){setToast('Ezt a fájltípust nem tudom fogadni. PDF, Word, Excel, PowerPoint vagy kép lehet.');return}
  setBusy(true);setDocStatus('Feltöltés…');
  try{
   const up=await api<{documentId:string;uploadUrl:string}>('upload',{method:'POST',body:JSON.stringify({filename:file.name,title:file.name.replace(/\.[a-z0-9]{2,5}$/i,''),mimeType:mime,size:file.size})});
   await putFile(up.uploadUrl,file,mime);
   await api('upload/complete',{method:'POST',body:JSON.stringify({documentId:up.documentId})});
   await api('library',{method:'PATCH',body:JSON.stringify({id:up.documentId,role,subjectId})});
   await load();setDocStatus(ROLE_LABEL[role]+' feltöltve.');
  }catch(e){setDocStatus('');fail(e)}finally{setBusy(false)}
 }
 async function open(d:Doc){
  try{const {url}=await api<{url:string}>('download?id='+encodeURIComponent(d.id));window.open(url,'_blank','noopener,noreferrer')}catch(e){fail(e)}
 }
 async function makeBook(d:Doc){
  if(!window.confirm('A(z) „'+konyvCim(d.title,d.filename)+'” átkerül a könyvek közé. Mehet?'))return;
  try{await api('library',{method:'PATCH',body:JSON.stringify({id:d.id,role:'book'})});await load()}catch(e){fail(e)}
 }

 async function makeBackup(){
  setBusy(true);setBackupStatus('Mentés készítése…');
  try{
   const {tables}=await api<{tables:string[]}>('backup');
   const out:Backup={app:'oktatasi-seged',version:1,created_at:new Date().toISOString(),tables:{}};
   for(const name of tables){
    const rows:Record<string,unknown>[]=[];let offset=0;
    for(;;){
     const r=await api<{rows:Record<string,unknown>[];more:boolean}>('backup?table='+name+'&offset='+offset,{},60000);
     rows.push(...r.rows);offset+=r.rows.length;setBackupStatus('Mentés: '+name.replace('os_','')+' ('+rows.length+' sor)');
     if(!r.more)break;
    }
    out.tables[name]=rows;
   }
   const day=new Date().toISOString().slice(0,10);
   saveFile('oktatasi-seged-mentes-'+day+'.json',JSON.stringify(out));
   localPrefs.set('us-last-backup',new Date().toISOString());
   const total=Object.values(out.tables).reduce((n,t)=>n+t.length,0);
   setBackupStatus('Kész: '+total+' sor elmentve. A fájl a Letöltések / Fájlok közé került. A könyvek PDF-jei a tárhelyen maradnak, ezek nincsenek a mentésben.');
  }catch(e){setBackupStatus('');fail(e)}finally{setBusy(false)}
 }

 async function restore(file:File|null){
  if(!file)return;
  let data:Backup;
  try{data=JSON.parse(await file.text())}catch{setToast('Ez nem egy Oktatási Segéd mentésfájl.');return}
  if(data?.app!=='oktatasi-seged'||!data.tables){setToast('Ez nem egy Oktatási Segéd mentésfájl.');return}
  const total=Object.values(data.tables).reduce((n,t)=>n+(Array.isArray(t)?t.length:0),0);
  if(!window.confirm('A mentés: '+new Date(data.created_at).toLocaleString('hu-HU')+', '+total+' sor. Csak a hiányzó adatokat veszem vissza, a meglévőkhöz nem nyúlok. Mehet?'))return;
  setBusy(true);
  const lines:string[]=[];
  try{
   const {tables}=await api<{tables:string[]}>('backup');
   for(const name of tables){
    const rows=Array.isArray(data.tables[name])?data.tables[name]:[];
    let inserted=0,skipped=0,errors=0;
    for(let i=0;i<rows.length;i+=500){
     setBackupStatus('Visszaállítás: '+name.replace('os_','')+' ('+i+' / '+rows.length+')');
     const r=await api<{inserted:number;skipped:number;error?:string}>('backup',{method:'POST',body:JSON.stringify({table:name,rows:rows.slice(i,i+500)})},60000);
     inserted+=r.inserted;skipped+=r.skipped;if(r.error)errors++;
    }
    if(rows.length)lines.push(name.replace('os_','')+': '+inserted+' visszaállítva, '+skipped+' már megvolt'+(errors?' (egy része nem illeszthető vissza)':''));
   }
   setBackupStatus('Kész.\n'+lines.join('\n'));
  }catch(e){setBackupStatus(lines.join('\n'));fail(e)}finally{setBusy(false)}
 }

 if(phase==='checking')return <div className="us-login"><p className="us-status">Betöltés…</p></div>;
 if(phase==='login')return <Belepes onDone={()=>setPhase('ready')}/>;
 const lastBackup=localPrefs.get<string>('us-last-backup','');

 return <div className="us-app">
  <header className="rd-top">
   <a href="/" className="rd-back"><Icon name="back" size={20} strokeWidth={2.2}/><span>Tananyag</span></a>
   <h1 className="pg-title">Beállítások</h1>
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
     <input type="file" disabled={!schemaReady||busy||!subjectId} accept=".pdf,.docx,.xlsx,.pptx,.png,.jpg,.jpeg,.webp" onChange={e=>{void upload(e.currentTarget.files?.[0]||null);e.currentTarget.value=''}}/>
     <span className="up-drop-icon"><Icon name="upload" size={22}/></span>
     <b>{ROLE_LABEL[role]} feltöltése</b>
     <small>PDF, Word, Excel vagy PowerPoint</small>
    </label>
    {docStatus&&<p className="us-status" role="status" style={{margin:0}}>{docStatus}</p>}
    {own.length>0?<ul className="pg-docs">
     {own.map(d=><li key={d.id} className="pg-row">
      <Icon name="note" size={18}/>
      <a href="#" onClick={e=>{e.preventDefault();void open(d)}}>{konyvCim(d.title,d.filename)}<br/><small>{ROLE_LABEL[d.role||'other']} · {new Date(d.created_at).toLocaleDateString('hu-HU')}</small></a>
      {d.mime_type==='application/pdf'&&<button type="button" className="us-btn us-btn-ghost" onClick={()=>void makeBook(d)}>Legyen könyv</button>}
     </li>)}
    </ul>:<p className="us-status" style={{margin:0}}>Ennél a tantárgynál még nincs feltöltött dokumentum.</p>}
   </section>

   <section className="pg-section" aria-labelledby="backup-h">
    <h2 id="backup-h">Mentés és visszaállítás</h2>
    <p>A mentés egy fájl, benne minden adatod: tantárgyak, témák, könyvek adatai és párosításai, jegyzetek, kiemelések, óraszámok, videók. A könyvek PDF-jei a privát tárhelyen maradnak. Érdemes havonta menteni, és a fájlt a Fájlokban vagy az iCloudban tartani.</p>
    {lastBackup&&<p className="us-status" style={{margin:0}}>Legutóbbi mentés ezen az eszközön: {new Date(lastBackup).toLocaleString('hu-HU')}</p>}
    <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
     <button type="button" className="us-btn us-btn-dark" disabled={busy} onClick={()=>void makeBackup()}><Icon name="upload" size={18} style={{transform:'rotate(180deg)'}}/>Mentés letöltése</button>
     <label className="us-btn" aria-disabled={busy}>
      <input type="file" accept="application/json,.json" className="sr-only" disabled={busy} onChange={e=>{void restore(e.currentTarget.files?.[0]||null);e.currentTarget.value=''}}/>
      <Icon name="undo" size={18}/>Visszaállítás fájlból
     </label>
    </div>
    {backupStatus&&<p className="pg-progress" role="status">{backupStatus}</p>}
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
