'use client';
import type {PDFDocumentProxy} from 'pdfjs-dist';
import {api,ApiError} from './client-api';
import {pageJpeg} from './pdf-pages';
import {konyvCim} from './konyv-cim';
import {newId,type PrepBookSource,type PrepItem,type PrepKind} from './orafelkeszito';

/**
 * Az órafelkészítő kliensoldali rétege: a kijelölt oldalak képpé alakítása (nem digitalizálunk),
 * adagolás a szerver korlátai szerint, és a prep-ai hívások egységes burkolói.
 */

export type Kep={book:string;page:number|null;data:string};
export type Kontextus={grade:number|null;subject:string;topic:string};

/** Egy kérésbe legfeljebb ennyi kép és ennyi (base64) karakter mehet; a szerver 6 képet és kb. 4 MB-ot enged. */
const MAX_KEP=6;
const MAX_ADAG=3_600_000;
/** Összesen ennyi oldalt lehet egy lapra kijelölni, hogy az AI-keret és az idő ne fogyjon el. */
export const MAX_OLDAL=24;

/* ---------- Források a témaoldal hivatkozásaiból ---------- */

export type Sor={key:string;docId:string;book:string;kind:string;grade:number|null;title:string;from:number|null;to:number|null;on:boolean;free:boolean};

type Kapcs={id:string;title:string;filename:string|null;mime_type:string;grade?:number|null;kind?:string|null;pdf_page:number|null;chapter_title:string|null};

/** A fejezet alapértelmezett utolsó oldala: a következő fejezet kezdete előtti oldal, legfeljebb 6 oldal. */
export function fejezetVege(kezdetek:number[],from:number):number{
 const kovetkezo=kezdetek.find(n=>n>from);
 const vege=kovetkezo?kovetkezo-1:from+3;
 return Math.max(from,Math.min(vege,from+5));
}

/** Az ajánlott források: a témához (és altémáihoz) kötött PDF-fejezetek, könyvenként, plusz egy „más oldalak” sor. */
export async function forrasSorok(topicId:string):Promise<Sor[]>{
 const d=await api<{links:Kapcs[]}>('topic-page?topicId='+encodeURIComponent(topicId));
 const konyvek=new Map<string,Kapcs[]>();
 for(const l of d.links){
  if(l.mime_type!=='application/pdf')continue;
  const lista=konyvek.get(l.id);if(lista)lista.push(l);else konyvek.set(l.id,[l]);
 }
 const sorok:Sor[]=[];
 for(const [id,lista] of konyvek){
  const elso=lista[0];
  const book=konyvCim(elso.title,elso.filename);
  let kezdetek=lista.map(l=>l.pdf_page||0);
  try{
   const lib=await api<{document:{contents:{page:number}[]|null}|null;links:{pdf_page:number|null}[]}>('library?doc='+encodeURIComponent(id)+'&links=1');
   if(Array.isArray(lib.document?.contents))kezdetek=kezdetek.concat(lib.document.contents.map(c=>Number(c.page)||0));
   kezdetek=kezdetek.concat((lib.links||[]).map(l=>l.pdf_page||0));
  }catch(e){if(e instanceof ApiError&&e.status===401)throw e}
  kezdetek=[...new Set(kezdetek.filter(n=>Number.isInteger(n)&&n>0))].sort((a,b)=>a-b);
  const latott=new Set<number>();
  for(const l of lista.filter(x=>x.pdf_page).sort((a,b)=>(a.pdf_page||0)-(b.pdf_page||0))){
   const from=l.pdf_page as number;
   if(latott.has(from))continue;latott.add(from);
   sorok.push({key:id+':'+from,docId:id,book,kind:elso.kind||'',grade:elso.grade??null,title:l.chapter_title||'Fejezet',from,to:fejezetVege(kezdetek,from),on:false,free:false});
  }
  sorok.push({key:id+':szabad',docId:id,book,kind:elso.kind||'',grade:elso.grade??null,title:'Más oldalak ebből a könyvből',from:null,to:null,on:false,free:true});
 }
 return sorok.sort((a,b)=>((a.grade||99)-(b.grade||99))||a.book.localeCompare(b.book,'hu')||(a.free?1:0)-(b.free?1:0)||(a.from||0)-(b.from||0));
}

/** A kijelölt sorok oldalszámai könyvenként összevonva (az oldalak sorrendben, ismétlés nélkül). */
export function forrasokBol(sorok:Sor[]):PrepBookSource[]{
 const konyvek=new Map<string,PrepBookSource>();
 for(const s of sorok){
  if(!s.on||!s.from||!s.to)continue;
  const b=konyvek.get(s.docId)||{documentId:s.docId,title:s.book,pages:[] as number[]};
  for(let n=s.from;n<=Math.min(s.to,s.from+11);n++)if(!b.pages.includes(n))b.pages.push(n);
  konyvek.set(s.docId,b);
 }
 return [...konyvek.values()].map(b=>({...b,pages:b.pages.sort((x,y)=>x-y)}));
}

export const oldalSzam=(f:PrepBookSource[])=>f.reduce((s,x)=>s+x.pages.length,0);

/** Az oldalszámok tömör felirata: [3,4,5,9] → „3–5., 9.” */
export function oldalFelirat(pages:number[]):string{
 const out:string[]=[];
 for(let i=0;i<pages.length;){
  let j=i;while(j+1<pages.length&&pages[j+1]===pages[j]+1)j++;
  out.push(j>i?pages[i]+'–'+pages[j]:String(pages[i]));i=j+1;
 }
 return out.join(', ')+'.';
}

/* ---------- Oldalak képpé alakítása ---------- */

const pdfok=new Map<string,Promise<PDFDocumentProxy>>();
const kepTar=new Map<string,string>();

async function pdfNyit(docId:string):Promise<PDFDocumentProxy>{
 let p=pdfok.get(docId);
 if(!p){
  p=(async()=>{
   const {url}=await api<{url:string}>('download?id='+encodeURIComponent(docId));
   const pdfjs=await import('pdfjs-dist');
   pdfjs.GlobalWorkerOptions.workerSrc=new URL('pdfjs-dist/build/pdf.worker.min.mjs',import.meta.url).toString();
   return pdfjs.getDocument({url,withCredentials:false}).promise;
  })();
  pdfok.set(docId,p);
  p.catch(()=>{pdfok.delete(docId)});
 }
 return p;
}

/** A forrásokban megadott oldalak JPEG-képei. Már elkészített oldalt nem renderel újra. */
export async function kepekKeszit(forrasok:PrepBookSource[],jelzes?:(kesz:number,ossz:number)=>void):Promise<Kep[]>{
 const ossz=oldalSzam(forrasok);
 const ki:Kep[]=[];let kesz=0;
 for(const f of forrasok){
  if(!f.pages.length)continue;
  if(!f.documentId)throw new Error('A(z) „'+f.title+'” könyv már nincs meg, ezért az oldalait nem tudom újra beolvasni.');
  const pdf=await pdfNyit(f.documentId);
  for(const n of f.pages){
   kesz++;
   if(n<1||n>pdf.numPages)continue;
   const kulcs=f.documentId+':'+n;
   let data=kepTar.get(kulcs);
   if(!data){data=await pageJpeg(pdf,n);kepTar.set(kulcs,data)}
   ki.push({book:f.title,page:n,data});
   jelzes?.(kesz,ossz);
  }
 }
 if(!ki.length)throw new Error('A kijelölt oldalak nem olvashatók be. Ellenőrizd az oldalszámokat.');
 return ki;
}

/** A képek adagokra osztása: adagonként legfeljebb 6 kép és kb. 3,6 MB. */
export function adagok(kepek:Kep[]):Kep[][]{
 const ki:Kep[][]=[];let akt:Kep[]=[];let meret=0;
 for(const k of kepek){
  if(akt.length&&(akt.length>=MAX_KEP||meret+k.data.length>MAX_ADAG)){ki.push(akt);akt=[];meret=0}
  akt.push(k);meret+=k.data.length;
 }
 if(akt.length)ki.push(akt);
 return ki;
}

export function felszabadit(){
 for(const p of pdfok.values())void p.then(d=>d.destroy()).catch(()=>{});
 pdfok.clear();kepTar.clear();
}

/* ---------- AI-hívások ---------- */

const norm=(s:string)=>s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,' ').trim().slice(0,80);
const hivas=<T,>(body:Record<string,unknown>)=>api<T>('prep-ai',{method:'POST',body:JSON.stringify(body)},65000);
const auth=(e:unknown)=>e instanceof ApiError&&e.status===401;

/** Előismeretek és fogalmak. Több adagnál az eredményeket összefűzi, az ismétlődőket elhagyja. */
export async function alapKeres(ctx:Kontextus,adag:Kep[][],wish:string){
 const prereq:PrepItem[]=[],concepts:PrepItem[]=[];
 const latott=new Set<string>();
 let figyelmeztetes='';
 for(let i=0;i<adag.length;i++){
  try{
   const r=await hivas<{prereq:PrepItem[];concepts:PrepItem[]}>({part:'alap',...ctx,wish,images:adag[i]});
   for(const x of r.prereq){const k='p'+norm(x.text);if(!latott.has(k)){latott.add(k);prereq.push(x)}}
   for(const x of r.concepts){const k='c'+norm(x.title||x.text);if(!latott.has(k)){latott.add(k);concepts.push(x)}}
  }catch(e){
   if(auth(e)||(!prereq.length&&!concepts.length&&i===adag.length-1))throw e;
   figyelmeztetes='Néhány oldalnál az AI nem válaszolt, ezekből nincs elem.';
  }
 }
 return {prereq:prereq.slice(0,8),concepts:concepts.slice(0,12),figyelmeztetes};
}

/** Mintafeladatok vagy gyakorló feladatok. Több adagnál elosztja a darabszámot, és a már meglévőket nem ismétli. */
export async function feladatKeres(ctx:Kontextus,kind:'example'|'practice',count:number,adag:Kep[][],avoid:string[],wish:string){
 const ki:PrepItem[]=[];
 const per=Math.max(1,Math.ceil(count/adag.length));
 let figyelmeztetes='';
 for(let i=0;i<adag.length&&ki.length<count;i++){
  try{
   const r=await hivas<{items:PrepItem[]}>({part:'feladat',kind,count:Math.min(10,Math.max(1,adag.length===1?count:per)),...ctx,wish,images:adag[i],avoid:[...avoid,...ki.map(x=>x.text)].slice(-20)});
   ki.push(...r.items);
  }catch(e){
   if(auth(e)||(!ki.length&&i===adag.length-1))throw e;
   figyelmeztetes='Néhány oldalnál az AI nem válaszolt, ezekből nincs feladat.';
  }
 }
 return {items:ki.slice(0,count),figyelmeztetes};
}

/** Egyetlen új előismeret vagy fogalom. */
export async function elemKeres(ctx:Kontextus,kind:'prereq'|'concept',adag:Kep[],avoid:string[],wish:string):Promise<PrepItem>{
 const r=await hivas<{item:PrepItem}>({part:'elem',kind,...ctx,wish,images:adag,avoid:avoid.slice(-20)});
 return {...r.item,id:r.item.id||newId()};
}

export type Ellenorzes={agrees:boolean;ownResult:string;note:string};
export const megoldasEllenoriz=(ctx:Kontextus,text:string,solution:string)=>hivas<Ellenorzes>({part:'ellenorzes',grade:ctx.grade,subject:ctx.subject,topic:ctx.topic,text,solution});

export type {PrepKind};
