'use client';
import {useEffect,useRef,useState} from 'react';
import {cachedCover,coverFor} from '../../lib/cover';
import {spineColor} from './icons';

/** A könyv borítója; amíg nincs kész (vagy nem PDF), a könyv saját színű gerince látszik. */
export default function Borito({id,pdf,className}:{id:string;pdf:boolean;className?:string}){
 const [src,setSrc]=useState<string|null>(null);
 const box=useRef<HTMLSpanElement>(null);
 useEffect(()=>{
  if(!pdf)return;
  const hit=cachedCover(id);if(hit){setSrc(hit);return}
  const el=box.current;if(!el)return;
  let alive=true;
  // Csak akkor rajzoljuk ki, amikor a kártya a képernyőre ér.
  const io=new IntersectionObserver(entries=>{
   if(entries.some(e=>e.isIntersecting)){io.disconnect();void coverFor(id).then(url=>{if(alive&&url)setSrc(url)})}
  },{rootMargin:'200px'});
  io.observe(el);
  return()=>{alive=false;io.disconnect()};
 },[id,pdf]);
 return <span ref={box} className={'us-cover'+(className?' '+className:'')} style={{background:spineColor(id)}} aria-hidden="true">
  {/* eslint-disable-next-line @next/next/no-img-element */}
  {src&&<img src={src} alt=""/>}
 </span>;
}
