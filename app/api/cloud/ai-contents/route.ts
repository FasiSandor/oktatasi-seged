import {NextRequest} from 'next/server';
import {database,ownerFromRequest,apiError} from '../../../../lib/server';
export const runtime='nodejs';
export const maxDuration=60;
type Lesson={title:string;printedPage:number};
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
  const parts:({text:string}|{inlineData:{mimeType:string;data:string}})[]=[{text:'You read Hungarian printed school textbook TABLE OF CONTENTS. Images are full PDF pages. Extract exact lesson titles and their PRINTED START PAGE, not the page number of the TOC itself. Two-column reading order: left column top-to-bottom, then right column top-to-bottom. Join hyphenated/wrapped multi-line titles. Ignore header/footer page numbers, chapter headers, book section footers, decorative numbers. Return JSON object {"lessons":[{"title":"...","printedPage":12}]} only. Do not guess. Skip uncertain rows.'}];
  for(const image of images)parts.push({text:'PDF page '+image.page+' (table of contents image follows)'},{inlineData:{mimeType:'image/jpeg',data:image.data}});
  const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{role:'user',parts}],generationConfig:{responseMimeType:'application/json',temperature:0,maxOutputTokens:8192}}),signal:AbortSignal.timeout(55000)});
  if(!response.ok){console.error('Gemini TOC HTTP',response.status);return Response.json({error:response.status===429?'Gemini kéréslimit. Próbáld meg később.':'A Gemini-feldolgozás nem sikerült (HTTP '+response.status+').'},{status:502})}
  const output=await response.json();
  const txt=output?.candidates?.[0]?.content?.parts?.map((x:{text?:string})=>x.text||'').join('')||'';
  let parsed:{lessons?:Lesson[]};try{parsed=JSON.parse(txt)}catch{return Response.json({error:'A Gemini nem adott értelmezhető fejezetlistát.'},{status:502})}
  const lessons=(Array.isArray(parsed.lessons)?parsed.lessons:[]).filter((x):x is Lesson=>typeof x?.title==='string'&&x.title.trim().length>=4&&x.title.length<=160&&Number.isInteger(x.printedPage)&&x.printedPage>0&&x.printedPage<5000).slice(0,150);
  return Response.json({lessons});
 }catch(e){return apiError(e)}
}
