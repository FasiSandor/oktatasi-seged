'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {authenticatedJWT} from '../../../lib/auth-client';
type Video={id:string;title:string;url:string;provider:string;category:string;note:string;topic_id:string|null;topic_name:string|null};
type Topic={id:string;name:string};
export default function VideoLibrary(){
 const [videos,setVideos]=useState<Video[]>([]),[topics,setTopics]=useState<Topic[]>([]);
 const [category,setCategory]=useState('matematika'),[title,setTitle]=useState(''),[url,setUrl]=useState(''),[note,setNote]=useState(''),[topic,setTopic]=useState('');
 const [filter,setFilter]=useState('osszes'),[search,setSearch]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 async function request(path:string,init?:RequestInit){const token=await authenticatedJWT();const r=await fetch('/api/cloud/'+path,{...init,headers:{Authorization:'Bearer '+token,...(init?.body?{'Content-Type':'application/json'}:{})}});const data=await r.json();if(!r.ok)throw Error(data.error||'Hálózati hiba');return data}
 async function reload(){const data=await request('videos');setVideos(data.videos||[]);setTopics(data.topics||[])}
 useEffect(()=>{void reload().catch(e=>setMessage(e.message));},[]);
 const visible=useMemo(()=>videos.filter(v=>(filter==='osszes'||v.category===filter)&&[v.title,v.note,v.provider,v.topic_name||''].join(' ').toLocaleLowerCase('hu').includes(search.toLocaleLowerCase('hu'))),[videos,filter,search]);
 async function add(e:React.FormEvent){e.preventDefault();setBusy(true);setMessage('');try{await request('videos',{method:'POST',body:JSON.stringify({title,url,note,category,topicId:topic||null})});setTitle('');setUrl('');setNote('');setTopic('');await reload();setMessage('Videólink elmentve.')}catch(e){setMessage(e instanceof Error?e.message:'Mentési hiba')}finally{setBusy(false)}}
 async function remove(id:string){if(!confirm('Eltávolítod a videótárból ezt a linket?'))return;setBusy(true);try{await request('videos?id='+encodeURIComponent(id),{method:'DELETE'});await reload()}catch(e){setMessage(e instanceof Error?e.message:'Törlési hiba')}finally{setBusy(false)}}
 return <main style={{maxWidth:1160,margin:'auto',padding:'clamp(14px,3vw,34px)',fontFamily:'system-ui',color:'#21314e'}}>
 <nav style={{display:'flex',gap:18,marginBottom:24}}><Link href="/">← Munkafelület</Link><Link href="/cloud">Könyvtár</Link><Link href="/cloud/curriculum">Tananyagfa</Link></nav>
 <h1 style={{fontSize:32,marginBottom:6}}>🎬 Videótár</h1><p style={{color:'#61718b'}}>Matematika és vendéglátás videói egy helyen. Külső videóknál a hivatkozást tároljuk; automatikusan nem töltünk le jogvédett videókat.</p>
 <form onSubmit={add} style={{display:'grid',gap:12,background:'#f3f7ff',border:'1px solid #d9e5f6',borderRadius:16,padding:18,margin:'20px 0'}}>
 <h2 style={{margin:0}}>Új videó mentése</h2><label>Cím<input required maxLength={200} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Pl. Másodfokú egyenletek magyarázata" style={input}/></label>
 <label>Videólink<input required type="url" pattern="https://.*" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://…" style={input}/></label>
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:12}}>
 <label>Gyűjtemény<select value={category} onChange={e=>setCategory(e.target.value)} style={input}><option value="matematika">Matematika</option><option value="vendeglatas">Vendéglátás</option><option value="egyeb">Egyéb</option></select></label>
 <label>Kapcsolódó témakör (nem kötelező)<select value={topic} onChange={e=>setTopic(e.target.value)} style={input}><option value="">Nincs hozzárendelve</option>{topics.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label></div>
 <label>Saját megjegyzés<textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={2000} rows={2} placeholder="Miért hasznos ez a videó?" style={input}/></label>
 <button type="submit" disabled={busy} style={{background:'#2868d8',color:'white',padding:13,border:0,borderRadius:10,fontWeight:700,cursor:'pointer'}}>＋ Videólink mentése</button></form>
 <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:16}}><input aria-label="Keresés a videótárban" placeholder="Keresés cím, téma, megjegyzés szerint" value={search} onChange={e=>setSearch(e.target.value)} style={{...input,flex:1,minWidth:230}}/><select aria-label="Gyűjtemény szűrése" value={filter} onChange={e=>setFilter(e.target.value)} style={{...input,width:190}}><option value="osszes">Összes</option><option value="matematika">Matematika</option><option value="vendeglatas">Vendéglátás</option><option value="egyeb">Egyéb</option></select></div>
 {message&&<p role="status">{message}</p>}
 <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(265px,1fr))',gap:14}}>{visible.map(v=><article key={v.id} style={{background:'white',border:'1px solid #dbe3ef',borderRadius:15,overflow:'hidden',boxShadow:'0 5px 18px #1f3d7211'}}><div style={{background:'linear-gradient(135deg,#263c6c,#3e78b9)',height:112,display:'grid',placeItems:'center',color:'white',fontSize:42}}>▶</div><div style={{padding:16}}><small style={{color:'#61718b'}}>{v.provider} · {v.category==='matematika'?'Matematika':v.category==='vendeglatas'?'Vendéglátás':'Egyéb'}</small><h3 style={{fontSize:17,margin:'8px 0'}}>{v.title}</h3>{v.topic_name&&<p style={{fontSize:12,color:'#2868d8'}}>Témakör: {v.topic_name}</p>}{v.note&&<p style={{fontSize:13,whiteSpace:'pre-wrap'}}>{v.note}</p>}<div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><a href={v.url} target="_blank" rel="noopener noreferrer" style={{color:'#2868d8',fontWeight:700}}>Videó megnyitása ↗</a><button disabled={busy} onClick={()=>void remove(v.id)} aria-label={v.title+' eltávolítása'} style={{background:'transparent',border:'1px solid #dbe3ef',padding:8,borderRadius:8}}>Törlés</button></div></div></article>)}</section>
 {!visible.length&&<p style={{padding:22,background:'#f3f7ff',borderRadius:12}}>Még nincs videó ebben a gyűjteményben.</p>}
 </main>
}
const input:React.CSSProperties={display:'block',width:'100%',boxSizing:'border-box',padding:11,borderRadius:9,border:'1px solid #c5d1e2',background:'white',marginTop:5,font:'inherit'};
