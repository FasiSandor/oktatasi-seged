'use client';
import type {PDFDocumentProxy} from 'pdfjs-dist';

/** PDF megnyitása a böngészőben, a fájl tartalmából (feltöltés előtt vagy után). */
export async function openPdf(data:ArrayBuffer):Promise<PDFDocumentProxy>{
 const pdfjs=await import('pdfjs-dist');
 pdfjs.GlobalWorkerOptions.workerSrc=new URL('pdfjs-dist/build/pdf.worker.min.mjs',import.meta.url).toString();
 return pdfjs.getDocument({data:new Uint8Array(data),useSystemFonts:true}).promise;
}

async function renderToCanvas(pdf:PDFDocumentProxy,pageNumber:number,width:number){
 const page=await pdf.getPage(pageNumber);
 const base=page.getViewport({scale:1});
 const viewport=page.getViewport({scale:width/base.width});
 const canvas=document.createElement('canvas');
 canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
 const context=canvas.getContext('2d');
 if(!context)throw new Error('A PDF-oldal nem rajzolható ki.');
 await page.render({canvasContext:context,viewport}).promise;
 return canvas;
}

/** Kis előnézet egy oldalról (adat-URL). */
export async function thumbnail(pdf:PDFDocumentProxy,pageNumber:number,width=150):Promise<string>{
 const canvas=await renderToCanvas(pdf,pageNumber,width);
 const url=canvas.toDataURL('image/jpeg',0.7);
 canvas.width=0;canvas.height=0;
 return url;
}

/** Olvasható méretű JPEG az AI-nak, base64 formában (előtag nélkül). */
export async function pageJpeg(pdf:PDFDocumentProxy,pageNumber:number):Promise<string>{
 let width=1100,quality=0.82;
 for(let attempt=0;attempt<3;attempt++){
  const canvas=await renderToCanvas(pdf,pageNumber,width);
  const data=canvas.toDataURL('image/jpeg',quality).split(',')[1];
  canvas.width=0;canvas.height=0;
  // A szerver legfeljebb kb. 1,8 MB-os képet fogad oldalanként.
  if(data.length<1_600_000)return data;
  width=Math.round(width*0.8);quality-=0.1;
 }
 throw new Error('Az oldal képe túl nagy az AI-feldolgozáshoz.');
}

async function pageText(pdf:PDFDocumentProxy,pageNumber:number){
 const page=await pdf.getPage(pageNumber);
 const viewport=page.getViewport({scale:1});
 const content=await page.getTextContent();
 const items=content.items.flatMap(item=>'str' in item&&'transform' in item&&item.str.trim()?[{str:item.str.trim(),y:item.transform[5] as number}]:[]);
 return {items,height:viewport.height};
}

/** Azok az oldalak, amelyeken gépi szövegként szerepel a TARTALOM szó. Szkennelt könyvnél üres. */
export async function guessContentsPages(pdf:PDFDocumentProxy,candidates:number[]):Promise<number[]>{
 const found:number[]=[];
 for(const n of candidates){
  try{const {items}=await pageText(pdf,n);if(items.some(t=>/^TARTALOM(?:JEGYZÉK)?$/i.test(t.str)))found.push(n)}catch{}
 }
 return found;
}

/**
 * A nyomtatott és a PDF-oldalszám közti eltérés a lapalji számokból.
 * Csak akkor ad értéket, ha két különböző lapon ugyanaz az eltérés jön ki,
 * így a második kötetek (pl. 120. oldallal induló könyv) is működnek.
 */
export async function detectOffset(pdf:PDFDocumentProxy):Promise<number|null>{
 const seen=new Map<number,number>();
 for(const index of [5,6,7,8,9,10,11,12,14,16,18,20,24,30]){
  if(index>pdf.numPages)break;
  try{
   const {items,height}=await pageText(pdf,index);
   const labels=items.filter(t=>t.y<Math.min(75,height*.12)&&/^\d{1,4}$/.test(t.str)).map(t=>Number(t.str)).filter(n=>n>=1&&n<=5000);
   if(labels.length!==1)continue;
   const offset=index-labels[0];
   const count=(seen.get(offset)||0)+1;
   if(count>=2)return offset;
   seen.set(offset,count);
  }catch{}
 }
 return null;
}
