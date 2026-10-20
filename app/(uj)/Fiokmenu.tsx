'use client';
import {useEffect,useRef,useState} from 'react';
import {signOut} from '../../lib/client-api';
import {Icon} from './icons';

/** Profilgomb a menüvel. Minden oldal fejlécében ugyanez, a jobb szélen. */
export default function Fiokmenu({onSignedOut}:{onSignedOut?:()=>void}){
 const [open,setOpen]=useState(false);
 const box=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  function kivul(e:PointerEvent){if(box.current&&!box.current.contains(e.target as Node))setOpen(false)}
  window.addEventListener('pointerdown',kivul);return()=>window.removeEventListener('pointerdown',kivul);
 },[]);
 return <div className="us-account" ref={box}>
  <button type="button" className="us-avatar" aria-label="Fiók és beállítások" aria-expanded={open} onClick={()=>setOpen(v=>!v)}><Icon name="user" size={20}/></button>
  {open&&<div className="us-menu">
   <a href="/">Tananyag</a>
   <a href="/feltoltes">Új könyv feltöltése</a>
   <a href="/konyvtar">Könyvtár</a>
   <a href="/tanmenet">Tanmenet</a>
   <a href="/feladatok">Feladataim</a>
   <a href="/beallitasok">Beállítások</a>
   <a href="/cloud/videos">Videótár</a>
   <hr/>
   <a href="/cloud/curriculum">Tananyagfa (régi nézet)</a>
   <a href="/cloud">Könyvtár (régi nézet)</a>
   <hr/>
   <button type="button" onClick={()=>{void signOut().then(()=>{if(onSignedOut)onSignedOut();else window.location.href='/'})}}>Kijelentkezés</button>
  </div>}
 </div>;
}
