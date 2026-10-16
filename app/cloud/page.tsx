'use client';
import {useState} from 'react';
import {authClient,authenticatedJWT} from '../../lib/auth-client';
type Subject={id:string;name:string};
type Topic={id:string;name:string};
type Doc={id:string;title:string;filename:string;mime_type:string};
export default function Cloud(){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState(''),[loggedIn,setLoggedIn]=useState(false),[subjects,setSubjects]=useState<Subject[]>([]),[topics,setTopics]=useState<Topic[]>([]),[docs,setDocs]=useState<Doc[]>([]);
 const [subject,setSubject]=useState(''),[topic,setTopic]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[preview,setPreview]=useState(''),[previewType,setPreviewType]=useState(''),[previewTitle,setPreviewTitle]=useState('');
 async function api(path:string,options:RequestInit={}){const token=await authenticatedJWT();const r=await fetch('/api/cloud/'+path,{...options,headers:{'Authorization':'Bearer '+token,...(options.body?{'Content-Type':'application/json'}:{})}});const data=await r.json();if(!r.ok)throw Error(data.error||'Sikertelen kérés');return data}
 async function run(work:()=>Promise<void>){setBusy(true);setMessage('');try{await work()}catch(e){setMessage(e instanceof Error?e.message:'Hiba')}finally{setBusy(false)}}
 async function signIn(){const res=await authClient().signIn.email({email,password});if(res.error)throw Error(res.error.message||'Hibás bejelentkezés');setLoggedIn(true);setPassword('');await getSubjects()}
 async function signUp(){if(!name.trim())throw Error('Adj meg nevet');const res=await authClient().signUp.email({email,password,name:name.trim()});if(res.error)throw Error(res.error.message||'Sikertelen regisztráció');setLoggedIn(true);setPassword('');await getSubjects()}
 async function signOut(){await authClient().signOut();setLoggedIn(false);setSubjects([]);setTopics([]);setDocs([])}
 async function getSubjects(){const v=await api('subjects');setSubjects(v.subjects)}
 async function getTopics(id:string){setSubject(id);setTopic('');setDocs([]);setTopics((await api('topics?subjectId='+encodeURIComponent(id))).topics)}
 async function getDocs(id:string){setTopic(id);setDocs((await api('documents?topicId='+encodeURIComponent(id))).documents)}
 async function createSubject(){const name=prompt('Tantárgy neve');if(!name)return;await api('subjects',{method:'POST',body:JSON.stringify({name})});await getSubjects()}
 async function createTopic(){const name=prompt('Új témakör');if(!name||!subject)return;await api('topics',{method:'POST',body:JSON.stringify({name,subjectId:subject})});await getTopics(subject)}
 async function upload(file:File){if(!topic)throw Error('Előbb válassz témakört.');const up=await api('upload',{method:'POST',body:JSON.stringify({filename:file.name,mimeType:file.type,size:file.size})});
 const put=await fetch(up.uploadUrl,{method:'PUT',headers:{'Content-Type':file.type},body:file});if(!put.ok)throw Error('Fájlátvitel sikertelen');
 await api('upload/complete',{method:'POST',body:JSON.stringify({documentId:up.documentId})});
 await api('links',{method:'POST',body:JSON.stringify({topicId:topic,documentId:up.documentId,category:'reference'})});await getDocs(topic)}
 async function open(d:Doc){const {url}=await api('download?id='+encodeURIComponent(d.id));setPreview(url+(d.mime_type==='application/pdf'?'#page=1':''));setPreviewType(d.mime_type);setPreviewTitle(d.title)}
 const btn={padding:'10px 14px',borderRadius:10,border:'1px solid #deddf4',background:'#7855d9',color:'white',cursor:'pointer'};
 return <main style={{margin:'auto',padding:24,maxWidth:1100,color:'#26304f'}}><h1>Oktatási Segéd — Felhős könyvtár</h1><p style={{color:'#6a7890'}}>Felhős fejlesztési felület. A bejelentkezés és a dokumentumkezelés éles tesztelése folyamatban.</p>
 <section style={{background:'white',padding:18,borderRadius:14,marginBottom:20}}>
 {!loggedIn ? <><h2>Belépés a saját könyvtárba</h2><p>E-mailes Neon Auth-fiókkal.</p>
 <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:12}}>
 <input aria-label="Név" value={name} onChange={e=>setName(e.target.value)} placeholder="Név (új fiókhoz)" style={{padding:12,flex:'1 1 180px'}}/>
 <input type="email" autoComplete="username" aria-label="E-mail" value={email} onChange={e=>setEmail(e.target.value)} placeholder="E-mail-cím" style={{padding:12,flex:'1 1 180px'}}/>
 <input type="password" autoComplete="current-password" aria-label="Jelszó" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Jelszó" style={{padding:12,flex:'1 1 180px'}}/></div>
 <button style={btn} onClick={()=>run(signIn)} disabled={busy}>Belépés</button> <button style={{...btn,background:'#10a8bd'}} onClick={()=>run(signUp)} disabled={busy}>Fiók létrehozása</button>
 </> : <div><span>✓ Bejelentkezve</span> <button style={btn} onClick={()=>run(getSubjects)} disabled={busy}>Frissítés</button> <button style={{...btn,background:'#6b758e'}} onClick={()=>run(signOut)}>Kijelentkezés</button></div>}
 </section>
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:14}}>
 <section style={{background:'white',padding:16,borderRadius:14}}><h2>Tantárgyak</h2><button style={btn} disabled={busy} onClick={()=>run(createSubject)}>＋ Tantárgy</button>{subjects.map(s=><p key={s.id}><button onClick={()=>run(()=>getTopics(s.id))} style={{...btn,background:subject===s.id?'#7855d9':'#eef0fb',color:subject===s.id?'white':'#20253c'}}>{s.name}</button></p>)}</section>
 <section style={{background:'white',padding:16,borderRadius:14}}><h2>Témakörök</h2><button style={btn} disabled={!subject||busy} onClick={()=>run(createTopic)}>＋ Témakör</button>{topics.map(t=><p key={t.id}><button onClick={()=>run(()=>getDocs(t.id))} style={{...btn,background:topic===t.id?'#7855d9':'#eef0fb',color:topic===t.id?'white':'#20253c'}}>{t.name}</button></p>)}</section>
 <section style={{background:'white',padding:16,borderRadius:14}}><h2>Dokumentumok</h2><label style={{...btn,display:'inline-block',opacity:topic?1:.4}}>＋ Feltöltés<input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx,.pptx" disabled={!topic||busy} style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)run(()=>upload(f));e.target.value=''}}/></label>{docs.map(d=><p key={d.id}><button style={{...btn,background:'#edf5ff',color:'#21436a'}} onClick={()=>run(()=>open(d))}>📄 {d.title}</button></p>)}</section>
 </div><section style={{background:'white',padding:16,borderRadius:14,marginTop:16}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><h2>📖 {previewTitle||'Dokumentumolvasó'}</h2>{preview&&<a href={preview} target="_blank" rel="noopener noreferrer">Teljes nézet ↗</a>}</div><div style={{height:'min(68vh,700px)',minHeight:350,background:'#f0f3f8',marginTop:10,display:'grid',placeItems:'center'}}>{preview?(previewType==='application/pdf'?<iframe title={previewTitle} src={preview} style={{width:'100%',height:'100%',border:0}}/>:previewType.startsWith('image/')?<img alt={previewTitle} src={preview} style={{maxHeight:'100%',maxWidth:'100%',objectFit:'contain'}}/>:<a href={preview} target="_blank" rel="noopener noreferrer">Eredeti Office-fájl megnyitása ↗</a>):<span>Válassz dokumentumot a megnyitáshoz.</span>}</div></section><p role="status" style={{color:'#a32f47'}}>{message}</p><p style={{color:'#67728c'}}>Az Office-fájlok eredetiben tölthetők le, a böngészős előnézet még fejlesztés alatt.</p></main>
}