'use client';
import type {Oldalak} from './felismeres';

/**
 * A PDF szövege oldalanként, sorokra tördelve, a böngészőben (PDF.js).
 * Az azonos magasságban lévő szövegdarabok egy sorba kerülnek, balról jobbra.
 * A képletek ebben a szövegben szétesnek, ezért a besoroláshoz a Gemini magát a PDF-et kapja;
 * ez a szöveg csak a szerkezet (feladatszám, oldal, pont) kiolvasásához kell.
 */
export async function pdfSzoveg(file:File):Promise<{oldalak:Oldalak;oldalszam:number}>{
 const pdfjs=await import('pdfjs-dist');
 pdfjs.GlobalWorkerOptions.workerSrc=new URL('pdfjs-dist/build/pdf.worker.min.mjs',import.meta.url).toString();
 const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),useSystemFonts:true}).promise;
 try{
  const oldalak:Oldalak=[];
  for(let i=1;i<=pdf.numPages;i++){
   const page=await pdf.getPage(i);
   const content=await page.getTextContent();
   type D={s:string;x:number;y:number;w:number;h:number};
   const darabok:D[]=[];
   for(const it of content.items){
    if(!('str' in it)||!it.str.trim())continue;
    const t=it.transform as number[];
    darabok.push({s:it.str,x:t[4],y:t[5],w:it.width||0,h:Math.abs(t[3])||10});
   }
   // Fentről lefelé (a PDF-ben az y alulról nő), azon belül balról jobbra.
   darabok.sort((a,b)=>b.y-a.y||a.x-b.x);
   const sorok:D[][]=[];
   for(const d of darabok){
    const s=sorok.at(-1);
    if(s&&Math.abs(s[0].y-d.y)<=Math.max(2.5,Math.min(s[0].h,d.h)*0.45))s.push(d);
    else sorok.push([d]);
   }
   oldalak.push(sorok.map(s=>{
    s.sort((a,b)=>a.x-b.x);
    let out='';let veg=-Infinity;
    for(const d of s){
     if(out&&d.x-veg>1.5&&!out.endsWith(' ')&&!d.s.startsWith(' '))out+=' ';
     out+=d.s;veg=d.x+d.w;
    }
    return out.replace(/\s+/g,' ').trim();
   }).filter(Boolean).slice(0,400));
   page.cleanup();
  }
  return {oldalak,oldalszam:pdf.numPages};
 }finally{void pdf.destroy()}
}

/** SHA-256 ujjlenyomat: ugyanazt a fájlt nem töltjük fel kétszer. */
export async function ujjlenyomat(file:File){
 const hash=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());
 return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
