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
 useEffect(()=>{let alive=true;
  (async()=>{try{const token=await authenticatedJWT();const response=await fetch('/api/cloud/curriculum/blueprint',{headers:{Authorization:'Bearer '+token}});
   if(!response.ok)throw new Error(response.status===401?'Jelentkezz be a felhős könyvtárba.':'A tananyagfa nem tölthető be.');
   const data=await response.json();if(alive)setBlueprint(data.blueprint);
  }catch(e){if(alive)setError(e instanceof Error?e.message:'Betöltési hiba')}})();return()=>{alive=false};
 },[]);
 const filtered=useMemo(()=>blueprint?.topics.filter(g=>!query.trim()||g.name.toLocaleLowerCase('hu').includes(query.toLocaleLowerCase('hu'))||g.lessons.some(l=>l.toLocaleLowerCase('hu').includes(query.toLocaleLowerCase('hu'))))||[],[blueprint,query]);
 const panel={background:'#172033',border:'1px solid #2A3445',borderRadius:14,padding:16} as const;
 return <main style={{background:'#0B0F14',color:'#eff6ff',minHeight:'100vh',padding:'min(4vw,24px)',fontFamily:'system-ui,sans-serif'}}>
  <div style={{maxWidth:1000,margin:'auto'}}>
   <Link href="/cloud" style={{color:'#60A5FA'}}>← Vissza a felhős könyvtárba</Link>
   <h1 style={{fontSize:'clamp(24px,4vw,34px)',marginBottom:5}}>Matematika – központi tananyagfa</h1>
   <p style={{color:'#9CA9C0'}}>Technikum · 9–12. évfolyam · NAT-alapú munkaváltozat</p>
   <section style={{...panel,marginBottom:18,background:'#142338'}}>
    <strong style={{color:'#60A5FA'}}>Fontos: ellenőrzés alatt</strong>
    <p style={{marginBottom:0,lineHeight:1.55}}>A fő témacsoportokhoz készített leckeindex még javaslat. A pontos évfolyamos bontást és óraszámokat a kerettanterv és érettségi követelmények alapján külön ellenőrizni kell. Az itt látható témák nem jelentenek jóváhagyott, kötelező tanmenetet. Ez a nézet nem módosít könyveket vagy adatbázist.</p>
   </section>
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
       <button type="button" onClick={()=>setSelected(v=>v===g.id+'::'+l?null:g.id+'::'+l)} style={{width:'100%',textAlign:'left',padding:'10px 12px',borderRadius:10,background:selected===g.id+'::'+l?'#1D3B66':'#111827',color:'#e6f0ff',border:selected===g.id+'::'+l?'1px solid #3B82F6':'1px solid #2A3445',cursor:'pointer'}}>▸ {l}</button>
       {selected===g.id+'::'+l&&<div style={{margin:'6px 0 8px 12px',padding:12,background:'#111827',borderRadius:10,color:'#AABCD5'}}>Tananyag-tervezet. A könyvek és feladatgyűjtemények ehhez a leckéhez a későbbi forrás-hozzárendeléskor kapcsolódnak.</div>}
      </div>)}
     </div>}
    </section>})}
   </div>
   {blueprint&&filtered.length===0&&<p>Nincs ilyen témakör vagy lecke.</p>}
  </div>
 </main>
}
