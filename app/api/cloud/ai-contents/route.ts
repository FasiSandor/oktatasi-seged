import {NextRequest} from 'next/server';
import {database,ownerFromRequest,apiError} from '../../../../lib/server';
import {recordAiUsage} from '../../../../lib/ai-usage';
export const runtime='nodejs';
export const maxDuration=60;
type Lesson={title:string;printedPage:number;lessonNumber?:number;chapterTitle?:string};
export async function POST(req:NextRequest){
 try{
  const owner=await ownerFromRequest(req);
  const {documentId,images}=await req.json() as {documentId?:string;images?:{page:number;data:string}[]};
  if(!documentId||!/^[0-9a-f-]{36}$/i.test(documentId)||!Array.isArray(images)||images.length<1||images.length>4)throw Error('INVALID');
  const sql=database();
  const rows=await sql`SELECT id FROM os_documents WHERE id=${documentId} AND owner_id=${owner} AND state='ready' AND mime_type='application/pdf'`;
  if(!rows.length)throw Error('FORBIDDEN');
  if(images.some(i=>!Number.isInteger(i.page)||i.page<1||typeof i.data!=='string'||i.data.length>1_800_000||!/^[A-Za-z0-9+/=]+$/.test(i.data)))throw Error('INVALID');
  const key=process.env.GEMINI_API_KEY;
  if(!key)return Response.json({error:'A Gemini API-kulcs még nincs beállítva az Oktatási Segéd Vercel-projektjében.'},{status:503});
  const model=process.env.GEMINI_MODEL||'gemini-2.5-flash';
  if(!/^gemini-[a-z0-9.-]+$/.test(model))throw Error('INVALID');
  const parts:({text:string}|{inlineData:{mimeType:string;data:string}})[]=[{text:'You read Hungarian printed school textbook TABLE OF CONTENTS. Images are full PDF pages. Extract exact lesson titles and their PRINTED START PAGE, not the page number of the TOC itself. Two-column reading order: left column top-to-bottom, then right column top-to-bottom. Join hyphenated/wrapped multi-line titles. Ignore header/footer page numbers, book section footers, decorative numbers. Associate every lesson with its nearest main chapter heading from the TABLE OF CONTENTS, e.g. BEVEZETÉS A GEOMETRIÁBA, FÜGGVÉNYEK, EGYBEVÁGÓSÁG, NÉGYSZÖGEK. If the chapter is unclear, use an empty chapterTitle instead of guessing. Return JSON object {"lessons":[{"lessonNumber":39,"title":"A sík geometriája","printedPage":4,"chapterTitle":"Bevezetés a geometriába"}]} only. lessonNumber is the numeric lesson identifier printed at the LEFT of each lesson row, NOT the printed page number at the right; for entries marked R or without numbered lessons, omit lessonNumber. Include every row, do not stop after eight. Do not guess. Skip uncertain rows.'}];
  for(const image of images)parts.push({text:'PDF page '+image.page+' (table of contents image follows)'},{inlineData:{mimeType:'image/jpeg',data:image.data}});
  const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{role:'user',parts}],generationConfig:{responseMimeType:'application/json',temperature:0,maxOutputTokens:8192}}),signal:AbortSignal.timeout(55000)});
  if(!response.ok){console.error('Gemini TOC HTTP',response.status);await recordAiUsage(owner,'contents',model,undefined,false);return Response.json({error:response.status===429?'Gemini kéréslimit. Próbáld meg később.':'A Gemini-feldolgozás nem sikerült (HTTP '+response.status+').'},{status:502})}
  const output=await response.json();
  await recordAiUsage(owner,'contents',model,output?.usageMetadata);
  const txt=output?.candidates?.[0]?.content?.parts?.map((x:{text?:string})=>x.text||'').join('')||'';
  let parsed:{lessons?:Lesson[]};try{parsed=JSON.parse(txt)}catch{return Response.json({error:'A Gemini nem adott értelmezhető fejezetlistát.'},{status:502})}
  const lessons=(Array.isArray(parsed.lessons)?parsed.lessons:[]).filter((x):x is Lesson=>typeof x?.title==='string'&&x.title.trim().length>=4&&x.title.length<=160&&(x.chapterTitle===undefined||(typeof x.chapterTitle==='string'&&x.chapterTitle.length<=120))&&Number.isInteger(x.printedPage)&&x.printedPage>0&&x.printedPage<5000).slice(0,150);
  const validNumbers=lessons.map(x=>x.lessonNumber).filter((n):n is number=>Number.isInteger(n)&&Number(n)>=1&&Number(n)<=999);
  const duplicated=[...new Set(validNumbers.filter((n,i)=>validNumbers.indexOf(n)!==i))].sort((a,b)=>a-b);
  // A sorszámtartományt a felismert leckékből számoljuk, így bármelyik könyvre működik.
  const min=validNumbers.length>=3?Math.min(...validNumbers):0;
  const max=validNumbers.length>=3?Math.max(...validNumbers):0;
  const expected=min&&max?Array.from({length:max-min+1},(_,i)=>min+i):[];
  const missing=expected.filter(n=>!validNumbers.includes(n));
  return Response.json({lessons,diagnostics:{numberedCount:validNumbers.length,range:expected.length?[expected[0],expected[expected.length-1]]:null,missing,duplicated}});
 }catch(e){return apiError(e)}
}
