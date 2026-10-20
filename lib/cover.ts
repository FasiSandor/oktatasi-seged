'use client';
import {api} from './client-api';

/**
 * Könyvborító (az első PDF-oldal kis képe) a kártyákhoz.
 * Csak a borítóhoz szükséges részt tölti le (részletes letöltés), egyszer rajzolja ki,
 * és az eszközön megjegyzi, így legközelebb azonnal megjelenik.
 */
const PREFIX='us-cover-v1-';
const inflight=new Map<string,Promise<string|null>>();
let running=0;const queue:(()=>void)[]=[];

function cached(id:string):string|null{
 try{return window.localStorage.getItem(PREFIX+id)}catch{return null}
}
function remember(id:string,url:string){
 try{window.localStorage.setItem(PREFIX+id,url)}catch{/* megtelt tár: legközelebb újra kirajzoljuk */}
}
async function slot<T>(work:()=>Promise<T>):Promise<T>{
 // Egyszerre legfeljebb két borító készül, hogy az iPad ne lassuljon be.
 if(running>=2)await new Promise<void>(r=>queue.push(r));
 running++;
 try{return await work()}finally{running--;queue.shift()?.()}
}

async function render(id:string):Promise<string|null>{
 const {url}=await api<{url:string}>('download?id='+encodeURIComponent(id));
 const pdfjs=await import('pdfjs-dist');
 pdfjs.GlobalWorkerOptions.workerSrc=new URL('pdfjs-dist/build/pdf.worker.min.mjs',import.meta.url).toString();
 const task=pdfjs.getDocument({url,withCredentials:false,disableAutoFetch:true,disableStream:true,rangeChunkSize:131072});
 const pdf=await task.promise;
 try{
  const page=await pdf.getPage(1);
  const base=page.getViewport({scale:1});
  const viewport=page.getViewport({scale:180/base.width});
  const canvas=document.createElement('canvas');
  canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
  const ctx=canvas.getContext('2d');if(!ctx)return null;
  await page.render({canvasContext:ctx,viewport}).promise;
  const data=canvas.toDataURL('image/jpeg',0.72);
  canvas.width=0;canvas.height=0;
  return data;
 }finally{void pdf.destroy()}
}

export function coverFor(id:string):Promise<string|null>{
 const hit=cached(id);if(hit)return Promise.resolve(hit);
 const pending=inflight.get(id);if(pending)return pending;
 const job=slot(()=>render(id)).then(url=>{if(url)remember(id,url);return url}).catch(()=>null).finally(()=>inflight.delete(id));
 inflight.set(id,job);
 return job;
}
export function cachedCover(id:string){return typeof window==='undefined'?null:cached(id)}
