'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {authenticatedJWT} from '../../../lib/auth-client';

type Lesson={name:string};
type Group={id:string;name:string;lessons:string[]};
type Blueprint={name:string;version:string;status:string;gradePlacementsVerified:boolean;topics:Group[]};
export default function Curriculum(){
 const [blueprint,setBlueprint]=useState<Blueprint|null>(null);
 const [query,setQuery]=useState('');
 const [expanded,setExpanded]=useState<Record<string,boolean>>({});
 const [error,setError]=useState('');
 const [selected,setSelected]=useState<string|null>(null);
 const [importMessage,setImportMessage]=useState('');
 const [importing,setImporting]=useState(false);
 const [sourceDocs,setSourceDocs]=useState<{id:string;title:string;pdf_page?:number;mime_type:string}[]>([]);
 const [sourceLoading,setSourceLoading]=useState(false);
 const [topicIds,setTopicIds]=useState<Record<string,string>>({});
 const [showSources,setShowSources]=useState(false);
 useEffect(()=>{let alive=true;
  (async()=>{try{const token=await authenticatedJWT();const response=await fetch('/api/cloud/curriculum/blueprint',{headers:{Authorization:'Bearer '+token}});
   if(!response.ok)throw new Error(response.status===401?'Jelentkezz be a felhős könyvtárba.':'A tananyagfa nem tölthető be.');
   const data=await response.json();if(alive){setBlueprint(data.blueprint);void loadSavedTopics();}
  }catch(e){if(alive)setError(e instanceof Error?e.message:'Betöltési hiba')}})();return()=>{alive=false};
 },[]);
 const filtered=useMemo(()=>blueprint?.topics.filter(g=>!query.trim()||g.name.toLocaleLowerCase('hu').includes(query.toLocaleLowerCase('hu'))||g.lessons.some(l=>l.toLocaleLowerCase('hu').includes(query.toLocaleLowerCase('hu'))))||[],[blueprint,query]);
 async function loadSavedTopics(){try{const token=await authenticatedJWT();const subjects=await fetch('/api/cloud/subjects',{headers:{Authorization:'Bearer '+token}}).then(r=>r.json());const math=subjects.subjects?.find((x:{id:string;name:string})=>x.name==='Matematika');if(!math)return;const response=await fetch('/api/cloud/topics?subjectId='+encodeURIComponent(math.id),{headers:{Authorization:'Bearer '+token}});if(!response.ok)return;const data=await response.json();const byId=new Map<string,{id:string;name:string;parent_id:string|null}>((data.topics||[]).map((t:{id:string;name:string;parent_id:string|null})=>[t.id,t]));const ids:Record<string,string>={};for(const t of byId.values()){const parent=t.parent_id?byId.get(t.parent_id):null;if(parent)ids[parent.name+'::'+t.name]=t.id;}setTopicIds(ids)}catch{} }
 async function importTree(){setImporting(true);setImportMessage('Mentés folyamatban…');try{const token=await authenticatedJWT();const response=await fetch('/api/cloud/curriculum/import',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({confirm:true})});const data=await response.json();if(!response.ok)throw Error(data.error||'Sikertelen mentés');setImportMessage('Elmentve: '+data.createdCount+' új elem, '+data.existingCount+' már létezett.');await loadSavedTopics()}catch(e){setImportMessage(e instanceof Error?e.message:'Hiba')}finally{setImporting(false)}}
 async function openLesson(group:string,lesson:string){const key=group+'::'+lesson;setSelected(v=>v===key?null:key);setSourceDocs([]);const topicId=topicIds[key];if(!topicId)return;setSourceLoading(true);try{const token=await authenticatedJWT();const response=await fetch('/api/cloud/documents?topicId='+encodeURIComponent(topicId),{headers:{Authorization:'Bearer '+token}});if(!response.ok)throw Error('A forrásokat nem sikerült betölteni');const data=await response.json();setSourceDocs(data.documents||[])}catch(e){setImportMessage(e instanceof Error?e.message:'Forráshiba')}finally{setSourceLoading(false)}}
 async function openDocument(id:string,page?:number){const tab=window.open('about:blank','_blank');try{const token=await authenticatedJWT();const response=await fetch('/api/cloud/download?id='+encodeURIComponent(id),{headers:{Authorization:'Bearer '+token}});if(!response.ok)throw Error('A PDF nem nyitható meg');const data=await response.json();if(typeof data.url!=='string')throw Error('Hiányzó dokumentumhivatkozás');const url=data.url+(page?'#page='+page:'');if(tab){tab.opener=null;tab.location.href=url}else{setImportMessage('A böngésző blokkolta az új lapot; engedélyezd a felugró ablakot a könyv megnyitásához.')}}catch(e){tab?.close();setImportMessage(e instanceof Error?e.message:'Megnyitási hiba')}}
 const panel={background:'#172033',border:'1px solid #2A3445',borderRadius:14,padding:16} as const;
 return <main style={{background:'#0B0F14',color:'#eff6ff',minHeight:'100vh',padding:'min(4vw,24px)',fontFamily:'system-ui,sans-serif'}}>
  <div style={{maxWidth:1000,margin:'auto'}}>
   <Link href="/cloud" style={{color:'#60A5FA'}}>← Vissza a felhős könyvtárba</Link>
   <h1 style={{fontSize:'clamp(24px,4vw,34px)',marginBottom:5}}>Matematika – központi tananyagfa</h1>
   <p style={{color:'#9CA9C0'}}>Technikum · 9–12. évfolyam · NAT-alapú munkaváltozat</p>
   <section style={{...panel,marginBottom:18}}><button onClick={()=>void importTree()} disabled={importing||!blueprint} style={{padding:'12px 16px',background:'#2563eb',border:'1px solid #60A5FA',borderRadius:10,color:'#fff',fontWeight:700,cursor:'pointer'}}> {importing?'Mentés…':'Tananyagfa mentése a saját könyvtáramba'} </button> <button onClick={()=>void loadSavedTopics()} style={{padding:'10px 12px',background:'#172033',border:'1px solid #2A3445',borderRadius:10,color:'#9fd7ff',cursor:'pointer'}}>Mentett források frissítése</button>{importMessage&&<p role='status' style={{color:'#c3d8ff'}}>{importMessage}</p>}</section>
   <section style={{...panel,marginBottom:18,background:'#142338'}}>
    <strong style={{color:'#60A5FA'}}>Fontos: ellenőrzés alatt</strong>
    <p style={{marginBottom:0,lineHeight:1.55}}>A fő témacsoportokhoz készített leckeindex még javaslat. A pontos évfolyamos bontást és óraszámokat a kerettanterv és érettségi követelmények alapján külön ellenőrizni kell. Az itt látható témák nem jelentenek jóváhagyott, kötelező tanmenetet. Ez a nézet nem módosít könyveket vagy adatbázist.</p>
   </section>
   <section style={{...panel,marginBottom:18}}><button aria-expanded={showSources} onClick={()=>setShowSources(v=>!v)} style={{background:'transparent',border:0,color:'#60A5FA',fontWeight:700,fontSize:15,cursor:'pointer',padding:0}}>▸ Források és a technikumi tanmenet módszere</button>{showSources&&<div style={{lineHeight:1.65,marginTop:12,color:'#ced8e8'}}><p>A tantárgyfa jelenleg évfolyamfüggetlen tématár. A 9–12. évfolyamos ütemezést a NAT2020, a megfelelő kerettanterv és a középszintű érettségi követelmények összevetésével kell létrehozni. Az egyes technikumok órakerete eltérhet, ezért nem állítunk be bizonyítatlan kötelező éves óraszámot.</p><p><a style={{color:'#60A5FA'}} href='https://njt.jog.gov.hu/jogszabaly/2020-5-20-22.0' target='_blank' rel='noopener noreferrer'>NAT2020 – jogszabály ↗</a></p><p><a style={{color:'#60A5FA'}} href='https://www.oktatas.hu/pub_bin/dload/kozoktatas/erettsegi/vizsgakovetelmenyek2024/matematika_2024_e.pdf' target='_blank' rel='noopener noreferrer'>Matematika érettségi követelmények ↗</a></p></div>}</section>
   <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:18}}>
    <input aria-label="Téma vagy lecke keresése" placeholder="Keress: variáció, kombináció, függvény…" value={query} onChange={e=>setQuery(e.target.value)} style={{flex:'1 1 250px',minWidth:0,padding:12,borderRadius:10,background:'#111827',border:'1px solid #344259',color:'white',fontSize:16}}/>
    <span style={{padding:12,color:'#AABCD5'}}>{filtered.length} témacsoport</span>
   </div>
   {error&&<section role="alert" style={panel}>{error} <Link href="/cloud" style={{color:'#60A5FA'}}>Belépés</Link></section>}
   {!blueprint&&!error&&<p>Tananyagfa betöltése…</p>}
   <div style={{display:'grid',gap:10}}>
    {filtered.map(g=>{const open=expanded[g.id]??Boolean(query.trim());return <section key={g.id} style={panel}>
     <button type="button" aria-expanded={open} onClick={()=>setExpanded(v=>({...v,[g.id]:!open}))} style={{display:'flex',gap:12,width:'100%',textAlign:'left',alignItems:'center',color:'white',background:'transparent',border:0,cursor:'pointer',fontSize:16,padding:0}}>
      <span style={{color:'#22D3EE'}}>{open?'▾':'▸'}</span><strong style={{flex:1}}>{g.name}</strong><span style={{color:'#9CA9C0',fontSize:13}}>{g.lessons.length} lecke</span>
     </button>
     {open&&<div style={{display:'grid',gap:7,marginTop:14}}>
      {g.lessons.filter(l=>!query.trim()||g.name.toLocaleLowerCase('hu').includes(query.toLocaleLowerCase('hu'))||l.toLocaleLowerCase('hu').includes(query.toLocaleLowerCase('hu'))).map(l=><div key={l}>
       <button type="button" onClick={()=>void openLesson(g.name,l)} style={{width:'100%',textAlign:'left',padding:'10px 12px',borderRadius:10,background:selected===g.id+'::'+l?'#1D3B66':'#111827',color:'#e6f0ff',border:selected===g.id+'::'+l?'1px solid #3B82F6':'1px solid #2A3445',cursor:'pointer'}}>▸ {l}</button>
       {selected===g.id+'::'+l&&<div style={{margin:'6px 0 8px 12px',padding:12,background:'#111827',borderRadius:10,color:'#AABCD5'}}>{sourceLoading?'Források betöltése…':topicIds[g.name+'::'+l]?(sourceDocs.length?sourceDocs.map(d=><button key={d.id} onClick={()=>void openDocument(d.id,d.pdf_page)} style={{display:'block',padding:'9px 12px',margin:'5px 0',borderRadius:9,border:'1px solid #3B82F6',background:'#172033',color:'#d7eaff',cursor:'pointer',textAlign:'left',width:'100%'}}>📖 {d.title}{d.pdf_page?' · PDF '+d.pdf_page+'. oldal':''} ↗</button>):'Ehhez a leckéhez még nincs hozzárendelt könyv vagy feladatgyűjtemény.'):'A tananyagfa mentése után kapcsolhatók a leckéhez a könyvek és feladatgyűjtemények.'}</div>}
      </div>)}
     </div>}
    </section>})}
   </div>
   {blueprint&&filtered.length===0&&<p>Nincs ilyen témakör vagy lecke.</p>}
  </div>
 </main>
}
