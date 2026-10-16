'use client';
import {useState} from 'react';
type Subject={id:string;name:string};
type Topic={id:string;name:string};
type Doc={id:string;title:string;filename:string;mime_type:string};
export default function Cloud(){
 const [token,setToken]=useState(''),[subjects,setSubjects]=useState<Subject[]>([]),[topics,setTopics]=useState<Topic[]>([]),[docs,setDocs]=useState<Doc[]>([]);
 const [subject,setSubject]=useState(''),[topic,setTopic]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 async function api(path:string,options:RequestInit={}){if(!token.trim())throw Error('Jelentkezz be előbb.');const r=await fetch('/api/cloud/'+path,{...options,headers:{'Authorization':'Bearer '+token.trim(),...(options.body?{'Content-Type':'application/json'}:{})}});const data=await r.json();if(!r.ok)throw Error(data.error||'Sikertelen kérés');return data}
 async function run(work:()=>Promise<void>){setBusy(true);setMessage('');try{await work()}catch(e){setMessage(e instanceof Error?e.message:'Hiba')}finally{setBusy(false)}}
 async function getSubjects(){const v=await api('subjects');setSubjects(v.subjects)}
 async function getTopics(id:string){setSubject(id);setTopic('');setDocs([]);setTopics((await api('topics?subjectId='+encodeURIComponent(id))).topics)}
 async function getDocs(id:string){setTopic(id);setDocs((await api('documents?topicId='+encodeURIComponent(id))).documents)}
 async function createSubject(){const name=prompt('Tantárgy neve');if(!name)return;await api('subjects',{method:'POST',body:JSON.stringify({name})});await getSubjects()}
 async function createTopic(){const name=prompt('Új témakör');if(!name||!subject)return;await api('topics',{method:'POST',body:JSON.stringify({name,subjectId:subject})});await getTopics(subject)}
 async function upload(file:File){if(!topic)throw Error('Előbb válassz témakört.');const up=await api('upload',{method:'POST',body:JSON.stringify({filename:file.name,mimeType:file.type,size:file.size})});
 const put=await fetch(up.uploadUrl,{method:'PUT',headers:{'Content-Type':file.type},body:file});if(!put.ok)throw Error('Fájlátvitel sikertelen');
 await api('upload/complete',{method:'POST',body:JSON.stringify({documentId:up.documentId})});
 await api('links',{method:'POST',body:JSON.stringify({topicId:topic,documentId:up.documentId,category:'reference'})});await getDocs(topic)}
 async function open(id:string){const {url}=await api('download?id='+encodeURIComponent(id));window.open(url,'_blank','noopener,noreferrer')}
 const btn={padding:'10px 14px',borderRadius:10,border:'1px solid #deddf4',background:'#7855d9',color:'white',cursor:'pointer'};
 return <main style={{margin:'auto',padding:24,maxWidth:1100,color:'#26304f'}}><h1>Oktatási Segéd — Felhős könyvtár</h1><p style={{color:'#6a7890'}}>Fejlesztői felület. A hitelesítés végleges bejelentkező felülete még készül.</p>
 <section style={{background:'white',padding:18,borderRadius:14,marginBottom:20}}><label>Neon Auth hozzáférési token (fejlesztési teszthez) <input type="password" value={token} onChange={e=>setToken(e.target.value)} placeholder="Bejelentkezett felhasználó hozzáférési tokenje" autoComplete="off" style={{display:'block',width:'100%',padding:12,margin:'8px 0'}}/></label><button style={btn} onClick={()=>run(getSubjects)} disabled={busy}>Könyvtár betöltése</button></section>
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:14}}>
 <section style={{background:'white',padding:16,borderRadius:14}}><h2>Tantárgyak</h2><button style={btn} disabled={busy} onClick={()=>run(createSubject)}>＋ Tantárgy</button>{subjects.map(s=><p key={s.id}><button onClick={()=>run(()=>getTopics(s.id))} style={{...btn,background:subject===s.id?'#7855d9':'#eef0fb',color:subject===s.id?'white':'#20253c'}}>{s.name}</button></p>)}</section>
 <section style={{background:'white',padding:16,borderRadius:14}}><h2>Témakörök</h2><button style={btn} disabled={!subject||busy} onClick={()=>run(createTopic)}>＋ Témakör</button>{topics.map(t=><p key={t.id}><button onClick={()=>run(()=>getDocs(t.id))} style={{...btn,background:topic===t.id?'#7855d9':'#eef0fb',color:topic===t.id?'white':'#20253c'}}>{t.name}</button></p>)}</section>
 <section style={{background:'white',padding:16,borderRadius:14}}><h2>Dokumentumok</h2><label style={{...btn,display:'inline-block',opacity:topic?1:.4}}>＋ Feltöltés<input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx,.pptx" disabled={!topic||busy} style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)run(()=>upload(f));e.target.value=''}}/></label>{docs.map(d=><p key={d.id}><button style={{...btn,background:'#edf5ff',color:'#21436a'}} onClick={()=>run(()=>open(d.id))}>📄 {d.title}</button></p>)}</section>
 </div><p role="status" style={{color:'#a32f47'}}>{message}</p><p style={{color:'#67728c'}}>Az Office-fájlok eredetiben tölthetők le, a böngészős előnézet még fejlesztés alatt.</p></main>
}