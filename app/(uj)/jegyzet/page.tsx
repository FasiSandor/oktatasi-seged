'use client';
import {Suspense,useCallback,useEffect,useMemo,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {api,ApiError,hasSession} from '../../../lib/client-api';
import {konyvCim} from '../../../lib/konyv-cim';
import {DOCX_MIME,jegyzetE} from '../../../lib/jegyzet';
import {Icon} from '../icons';
import Belepes from '../Belepes';
import Kereso from '../Kereso';
import Fiokmenu from '../Fiokmenu';

type Entry={title:string;page:number;group:string;skip?:boolean};
type Doc={id:string;title:string;filename:string|null;mime_type?:string;contents:Entry[]|null};
type Cimsor={n:number;szint:number;cim:string;csoport:string};

export default function JegyzetOldal(){
 return <Suspense fallback={<div className="us-login"><p className="us-status">Betöltés…</p></div>}><Jegyzet/></Suspense>;
}

const esc=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const sor=(s:string)=>esc(s).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');

/**
 * Szöveges (TXT vagy Markdown) jegyzet átalakítása. Címsor:
 * a # jellel kezdődő sor, az === vagy --- vonallal aláhúzott sor,
 * és a csupa nagybetűs, önálló rövid sor.
 */
function szovegbol(text:string):string{
 const lines=text.replace(/^﻿/,'').replace(/\r\n?/g,'\n').split('\n');
 const out:string[]=[];let para:string[]=[];
 const flush=()=>{if(para.length){out.push('<p>'+para.map(sor).join('<br>')+'</p>');para=[]}};
 for(let i=0;i<lines.length;i++){
  const line=lines[i].replace(/\s+$/,'');const t=line.trim();const next=(lines[i+1]||'').trim();
  const md=t.match(/^(#{1,6})\s+(.+)$/);
  if(md){flush();const l=Math.min(md[1].length,3);out.push('<h'+l+'>'+sor(md[2].replace(/\s*#+$/,''))+'</h'+l+'>');continue}
  if(t&&!para.length&&/^={3,}$/.test(next)){out.push('<h1>'+sor(t)+'</h1>');i++;continue}
  if(t&&!para.length&&/^-{3,}$/.test(next)){out.push('<h2>'+sor(t)+'</h2>');i++;continue}
  if(!t){flush();continue}
  const nagybetus=t.length>=3&&t.length<=80&&/[A-ZÁÉÍÓÖŐÚÜŰ]/.test(t)&&t===t.toLocaleUpperCase('hu')&&!/[.,;]$/.test(t);
  if(!para.length&&!next&&nagybetus){out.push('<h2>'+sor(t)+'</h2>');continue}
  para.push(line);
 }
 flush();
 return out.join('\n');
}

/** A Wordből készült HTML-ből kivesszük, ami nem jegyzetbe való (szkript, külső hivatkozás furcsa címmel). */
function tisztit(html:string):Document{
 const doc=new DOMParser().parseFromString('<div id="jz-root">'+html+'</div>','text/html');
 doc.querySelectorAll('script,style,iframe,object,embed,form').forEach(el=>el.remove());
 doc.querySelectorAll('*').forEach(el=>{
  for(const a of [...el.attributes]){
   if(/^on/i.test(a.name))el.removeAttribute(a.name);
   if(a.name==='href'&&!/^(https?:|mailto:|#)/i.test(a.value.trim()))el.removeAttribute('href');
   if(a.name==='src'&&!/^data:image\//i.test(a.value.trim()))el.removeAttribute('src');
  }
  if(el.tagName==='A'&&/^https?:/i.test(el.getAttribute('href')||'')){el.setAttribute('target','_blank');el.setAttribute('rel','noopener noreferrer')}
 });
 return doc;
}

/** A címsorok sorszámot kapnak (h-1, h-2…), ebből lesz a kattintható tartalomjegyzék. */
function cimsorok(doc:Document):{html:string;lista:Cimsor[]}{
 const root=doc.getElementById('jz-root')!;
 const lista:Cimsor[]=[];let csoport='';let n=0;
 root.querySelectorAll('h1,h2,h3').forEach(h=>{
  const cim=(h.textContent||'').replace(/\s+/g,' ').trim();
  if(!cim){h.removeAttribute('id');return}
  const szint=Number(h.tagName.slice(1));
  n++;h.id='h-'+n;
  if(szint===1)csoport=cim;
  lista.push({n,szint,cim,csoport:szint===1?'':csoport});
 });
 return {html:root.innerHTML,lista};
}

function Jegyzet(){
 const params=useSearchParams();
 const docId=params.get('doc')||'';
 const kezdo=Number(params.get('h'))||0;
 const [phase,setPhase]=useState<'checking'|'login'|'ready'>('checking');
 const [doc,setDoc]=useState<Doc|null>(null);
 const [html,setHtml]=useState('');
 const [lista,setLista]=useState<Cimsor[]>([]);
 const [aktiv,setAktiv]=useState(0);
 const [nyitva,setNyitva]=useState(true);
 const [error,setError]=useState('');
 const [toast,setToast]=useState('');

 const fail=useCallback((e:unknown)=>{
  if(e instanceof ApiError&&e.status===401){setPhase('login');return}
  setError(e instanceof Error?e.message:'A jegyzet nem nyitható meg.');
 },[]);
 useEffect(()=>{let alive=true;hasSession().then(ok=>{if(alive)setPhase(ok?'ready':'login')});return()=>{alive=false}},[]);
 // Telefonon a tartalomjegyzék alapból csukva van, hogy a szöveg látsszon.
 useEffect(()=>{setNyitva(window.innerWidth>900)},[]);

 useEffect(()=>{
  if(phase!=='ready'||!docId)return;
  let alive=true;
  (async()=>{
   const [info,all]=await Promise.all([
    api<{document:Doc}>('library?doc='+encodeURIComponent(docId)+'&links=1'),
    api<{documents:{id:string;mime_type:string}[]}>('documents')
   ]);
   const mime=all.documents.find(d=>d.id===docId)?.mime_type||'';
   if(!alive)return;
   setDoc({...info.document,mime_type:mime});
   if(!jegyzetE(mime))throw new Error('Ez a fájl nem Word- vagy szöveges jegyzet.');
   const {url}=await api<{url:string}>('download?id='+encodeURIComponent(docId));
   const res=await fetch(url);if(!res.ok)throw new Error('A jegyzet nem olvasható ('+res.status+').');
   let nyers:string;
   if(mime===DOCX_MIME){
    const mammoth=await import('mammoth');
    const r=await mammoth.convertToHtml({arrayBuffer:await res.arrayBuffer()},{styleMap:[
     "p[style-name='Title'] => h1:fresh","p[style-name='Cím'] => h1:fresh",
     "p[style-name='Subtitle'] => h2:fresh","p[style-name='Alcím'] => h2:fresh"
    ]});
    nyers=r.value;
   }else nyers=szovegbol(await res.text());
   const kesz=cimsorok(tisztit(nyers));
   if(!alive)return;
   setHtml(kesz.html);setLista(kesz.lista);
   // A címsorokat tartalomjegyzékként elmentjük, hogy a Könyvtárban és a keresőben is megjelenjenek.
   const uj:Entry[]=kesz.lista.slice(0,1500).map(c=>({title:c.cim.slice(0,200),page:c.n,group:c.csoport.slice(0,200)}));
   const regi=(info.document.contents||[]).map(c=>({title:c.title,page:c.page,group:c.group||''}));
   if(JSON.stringify(uj)!==JSON.stringify(regi)){
    api('library',{method:'PATCH',body:JSON.stringify({id:docId,contents:uj.length?uj:null})}).catch(()=>{});
   }
  })().catch(e=>{if(alive)fail(e)});
  return()=>{alive=false};
 },[phase,docId,fail]);

 const ugras=useCallback((n:number,sima=true)=>{
  const el=document.getElementById('h-'+n);if(!el)return;
  el.scrollIntoView({behavior:sima?'smooth':'auto',block:'start'});
  setAktiv(n);
  el.classList.remove('is-target');void el.getBoundingClientRect();el.classList.add('is-target');
  const p=new URLSearchParams(window.location.search);p.set('h',String(n));
  window.history.replaceState(null,'','/jegyzet?'+p.toString());
  if(window.innerWidth<=900)setNyitva(false);
 },[]);

 // Betöltés után a keresőből vagy a Könyvtárból kért címsorhoz ugrunk.
 useEffect(()=>{if(html&&kezdo)setTimeout(()=>ugras(kezdo,false),50)},[html,kezdo,ugras]);

 // Görgetés közben a tartalomjegyzékben az éppen olvasott rész látszik kiemelve.
 useEffect(()=>{
  if(!html||!lista.length)return;
  const els=lista.map(c=>document.getElementById('h-'+c.n)).filter((x):x is HTMLElement=>!!x);
  const io=new IntersectionObserver(entries=>{
   const lathato=entries.filter(e=>e.isIntersecting).map(e=>Number(e.target.id.slice(2)));
   if(lathato.length)setAktiv(Math.min(...lathato));
  },{rootMargin:'-80px 0px -65% 0px'});
  els.forEach(e=>io.observe(e));
  return()=>io.disconnect();
 },[html,lista]);

 async function eredeti(){
  try{const {url}=await api<{url:string}>('download?id='+encodeURIComponent(docId));window.open(url,'_blank','noopener,noreferrer')}
  catch(e){if(e instanceof ApiError&&e.status===401)setPhase('login');else setToast(e instanceof Error?e.message:'Nem sikerült.')}
 }

 const nev=doc?konyvCim(doc.title,doc.filename):'Jegyzet';
 const fo=useMemo(()=>lista.some(c=>c.szint===1),[lista]);

 if(phase==='checking')return <div className="us-login"><p className="us-status">Betöltés…</p></div>;
 if(phase==='login')return <Belepes onDone={()=>setPhase('ready')}/>;

 return <div className="us-app">
  <header className="rd-top">
   <a href="/" className="rd-back"><Icon name="back" size={20} strokeWidth={2.2}/><span>Főoldal</span></a>
   <h1 className="pg-title jz-title">{nev}</h1>
   <div className="rd-right is-kompakt">
    <button type="button" className="us-btn us-btn-ghost" onClick={()=>void eredeti()} disabled={!doc}><Icon name="external" size={16}/>Eredeti fájl</button>
    <Kereso kompakt onAuth={()=>setPhase('login')}/>
    <Fiokmenu/>
   </div>
  </header>
  <main className="jz-wrap">
   {!docId&&<p className="up-error" role="alert">Nincs megadva, melyik jegyzetet nyissam meg.</p>}
   {error&&<p className="up-error" role="alert">{error}</p>}
   {!error&&docId&&!html&&<p className="us-status">A jegyzet betöltése…</p>}
   {html&&<>
    <details className="jz-toc" open={nyitva} onToggle={e=>setNyitva((e.currentTarget as HTMLDetailsElement).open)}>
     <summary><Icon name="lines" size={16}/>Tartalom{lista.length?' ('+lista.length+')':''}</summary>
     {lista.length?<ol>
      {lista.map(c=><li key={c.n}>
       <button type="button" className={'jz-toc-item lvl-'+(fo?c.szint:Math.max(1,c.szint-1))+(aktiv===c.n?' is-active':'')} aria-current={aktiv===c.n?'location':undefined} onClick={()=>ugras(c.n)}><span>{c.cim}</span></button>
      </li>)}
     </ol>:<p className="pg-hint" style={{margin:'8px 0 0'}}>Ebben a jegyzetben nem találtam címsort. Wordben a Címsor 1, Címsor 2 és Címsor 3 stílusból lesz tartalomjegyzék, szöveges fájlban a # jellel kezdődő sorokból.</p>}
    </details>
    <article className="jz-doc" dangerouslySetInnerHTML={{__html:html}}/>
   </>}
  </main>
  {toast&&<div className="us-toast" role="status"><span style={{flex:1}}>{toast}</span><button type="button" onClick={()=>setToast('')}>Rendben</button></div>}
 </div>;
}
