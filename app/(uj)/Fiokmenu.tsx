'use client';
import {useEffect,useRef,useState} from 'react';
import {signOut} from '../../lib/client-api';
import {Icon} from './icons';

const OLDALAK:[string,string][]=[['/','Főoldal (Tananyag)'],['/feltoltes','Új könyv feltöltése'],['/konyvtar','Könyvtár'],['/tanmenet','Tanmenet'],['/feladatok','Feladataim'],['/beallitasok','Beállítások'],['/cloud/videos','Videótár']];

/** Profilgomb a menüvel. Minden oldal fejlécében ugyanez, a jobb szélen. */
export default function Fiokmenu({onSignedOut}:{onSignedOut?:()=>void}){
 const [open,setOpen]=useState(false);
 const box=useRef<HTMLDivElement>(null);
 const [itt,setItt]=useState('');
 useEffect(()=>{setItt(window.location.pathname)},[]);
 useEffect(()=>{
  function kivul(e:PointerEvent){if(box.current&&!box.current.contains(e.target as Node))setOpen(false)}
  window.addEventListener('pointerdown',kivul);return()=>window.removeEventListener('pointerdown',kivul);
 },[]);
 return <div className="us-account" ref={box}>
  <button type="button" className="us-avatar" aria-label="Fiók és beállítások" aria-expanded={open} onClick={()=>setOpen(v=>!v)}><Icon name="user" size={20}/></button>
  {open&&<div className="us-menu">
   {OLDALAK.map(([href,nev])=><a key={href} href={href} aria-current={itt===href?'page':undefined}>{nev}</a>)}
   <hr/>
   <a href="/cloud/curriculum">Tananyagfa (régi nézet)</a>
   <a href="/cloud">Könyvtár (régi nézet)</a>
   <hr/>
   <button type="button" onClick={()=>{void signOut().then(()=>{if(onSignedOut)onSignedOut();else window.location.href='/'})}}>Kijelentkezés</button>
  </div>}
 </div>;
}
