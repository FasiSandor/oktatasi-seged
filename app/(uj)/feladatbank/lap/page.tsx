'use client';
import {Suspense,useCallback,useEffect,useRef,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import type {PDFDocumentProxy,RenderTask} from 'pdfjs-dist';
import {api,ApiError,hasSession} from '../../../../lib/client-api';
import {Icon} from '../../icons';
import Belepes from '../../Belepes';
import Fiokmenu from '../../Fiokmenu';

export default function LapOldal(){
 return <Suspense fallback={<div className="us-login"><p className="us-status">Betöltés…</p></div>}><Lap/></Suspense>;
}

/**
 * Egyszerű lapnézegető a feladatbankhoz: a feladatlap vagy az útmutató a megadott oldalon nyílik,
 * és egy gombbal át lehet váltani a másikra, ugyanannál a feladatnál.
 */
function Lap(){
 const p=useSearchParams();
 const vizsga=p.get('vizsga')||'';
 const flOldal=Math.max(1,Number(p.get('fl'))||1),utOldal=Math.max(1,Number(p.get('ut'))||1);
 const [phase,setPhase]=useState<'checking'|'login'|'ready'>('checking');
 const [tipus,setTipus]=useState<'fl'|'ut'>(p.get('tipus')==='ut'?'ut':'fl');
 const [oldal,setOldal]=useState(p.get('tipus')==='ut'?utOldal:flOldal);
 const [pdf,setPdf]=useState<PDFDocumentProxy|null>(null);
 const [hiba,setHiba]=useState('');
 const vaszon=useRef<HTMLCanvasElement>(null);
 const doboz=useRef<HTMLDivElement>(null);
 const cache=useRef<Record<string,PDFDocumentProxy>>({});
 const rajz=useRef<RenderTask|null>(null);

 const fail=useCallback((e:unknown)=>{
  if(e instanceof ApiError&&e.status===401){setPhase('login');return}
  setHiba(e instanceof Error?e.message:'Ismeretlen hiba');
 },[]);
 useEffect(()=>{let alive=true;hasSession().then(ok=>{if(alive)setPhase(ok?'ready':'login')});return()=>{alive=false}},[]);

 useEffect(()=>{
  if(phase!=='ready'||!vizsga)return;
  let elhagyva=false;
  setPdf(null);setHiba('');
  (async()=>{
   if(cache.current[tipus]){setPdf(cache.current[tipus]);return}
   const {url}=await api<{url:string}>('feladatbank/fajl?vizsga='+encodeURIComponent(vizsga)+'&tipus='+tipus);
   const pdfjs=await import('pdfjs-dist');
   pdfjs.GlobalWorkerOptions.workerSrc=new URL('pdfjs-dist/build/pdf.worker.min.mjs',import.meta.url).toString();
   const d=await pdfjs.getDocument({url,withCredentials:false}).promise;
   cache.current[tipus]=d;
   if(!elhagyva)setPdf(d);
  })().catch(fail);
  return()=>{elhagyva=true};
 },[phase,vizsga,tipus,fail]);
 useEffect(()=>()=>{for(const d of Object.values(cache.current))void d.destroy()},[]);

 const kirajzol=useCallback(async()=>{
  if(!pdf||!vaszon.current||!doboz.current)return;
  const n=Math.min(Math.max(1,oldal),pdf.numPages);
  const page=await pdf.getPage(n);
  const alap=page.getViewport({scale:1});
  const szel=Math.min(doboz.current.clientWidth,1100);
  const scale=szel/alap.width,dpr=Math.min(window.devicePixelRatio||1,2.5);
  const vp=page.getViewport({scale:scale*dpr});
  const c=vaszon.current;
  c.width=Math.floor(vp.width);c.height=Math.floor(vp.height);
  c.style.width=Math.floor(vp.width/dpr)+'px';c.style.height=Math.floor(vp.height/dpr)+'px';
  rajz.current?.cancel();
  const task=page.render({canvasContext:c.getContext('2d')!,viewport:vp});
  rajz.current=task;
  try{await task.promise}catch{/* megszakított rajzolás lapozáskor */}
 },[pdf,oldal]);
 useEffect(()=>{void kirajzol()},[kirajzol]);
 useEffect(()=>{const r=()=>void kirajzol();window.addEventListener('resize',r);return()=>window.removeEventListener('resize',r)},[kirajzol]);

 // Billentyűvel is lehet lapozni (Macen).
 useEffect(()=>{
  const k=(e:KeyboardEvent)=>{if(e.key==='ArrowRight')setOldal(o=>o+1);if(e.key==='ArrowLeft')setOldal(o=>Math.max(1,o-1))};
  window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k);
 },[]);
 useEffect(()=>{if(pdf&&oldal>pdf.numPages)setOldal(pdf.numPages)},[pdf,oldal]);

 function valt(t:'fl'|'ut'){if(t===tipus)return;setTipus(t);setOldal(t==='ut'?utOldal:flOldal)}

 if(phase==='checking')return <div className="us-login"><p className="us-status">Betöltés…</p></div>;
 if(phase==='login')return <Belepes onDone={()=>setPhase('ready')}/>;
 const db=pdf?.numPages||0;
 return <div className="us-app fb-lapnezo">
  <header className="rd-top">
   <a href={'/feladatbank/vizsga?id='+vizsga} className="rd-back"><Icon name="back" size={20} strokeWidth={2.2}/><span>Feladatok</span></a>
   <div className="us-seg fb-seg2" role="group" aria-label="Dokumentum">
    <button type="button" aria-pressed={tipus==='fl'} onClick={()=>valt('fl')}>Feladatlap</button>
    <button type="button" aria-pressed={tipus==='ut'} onClick={()=>valt('ut')}>Útmutató</button>
   </div>
   <div className="rd-right">
    <button type="button" className="us-icon-btn" aria-label="Előző oldal" disabled={oldal<=1} onClick={()=>setOldal(o=>Math.max(1,o-1))}><Icon name="back" size={20}/></button>
    <span className="fb-oldalszam">{db?Math.min(oldal,db)+' / '+db:'…'}</span>
    <button type="button" className="us-icon-btn" aria-label="Következő oldal" disabled={!!db&&oldal>=db} onClick={()=>setOldal(o=>o+1)}><Icon name="next" size={20}/></button>
    <Fiokmenu/>
   </div>
  </header>
  <main className="fb-vaszon-doboz" ref={doboz}>
   {hiba&&<p className="up-warn">{hiba}</p>}
   {!pdf&&!hiba&&<p className="us-status">A lap betöltése…</p>}
   <canvas ref={vaszon} className="fb-vaszon" hidden={!pdf}/>
  </main>
 </div>;
}
