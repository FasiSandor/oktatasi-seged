import {NextRequest} from 'next/server';
import {ownerFromRequest,apiError} from '../../../../lib/server';
import {recordAiUsage} from '../../../../lib/ai-usage';
import {keresoElemek,type KeresoElem} from '../../../../lib/kereses-adat';
import {normalizal} from '../../../../lib/kereses';
export const runtime='nodejs';
export const maxDuration=60;

/**
 * Tartalmi keresés AI-jal: akkor is megtalálja a témát vagy fejezetet, ha a szó nem szerepel a címben
 * (pl. „derékszögű háromszög oldalai” → Pitagorasz-tétel). Csak gombnyomásra fut, egy Gemini-hívás.
 * Az AI csak a címlistát látja (témák, fejezetcímek, tanmenet), a könyvek szövegét nem.
 */
export async function POST(req:NextRequest){
 try{
  const owner=await ownerFromRequest(req),b=await req.json();
  const query=typeof b?.q==='string'?b.q.replace(/\s+/g,' ').trim():'';
  if(query.length<2||query.length>200)throw Error('INVALID');
  const key=process.env.GEMINI_API_KEY;
  if(!key)return Response.json({error:'A Gemini API-kulcs még nincs beállítva az Oktatási Segéd Vercel-projektjében.'},{status:503});
  const model=process.env.GEMINI_MODEL||'gemini-2.5-flash';
  if(!/^gemini-[a-z0-9.-]+$/.test(model))throw Error('INVALID');

  // Címlista: az azonos című fejezetek (több könyvben) egy sorba kerülnek, így rövidebb a kérés.
  const elemek=(await keresoElemek(owner)).filter(e=>e.kind==='topic'||e.kind==='chapter'||e.kind==='lesson'||e.kind==='video');
  const sorok:{szoveg:string;elemek:KeresoElem[]}[]=[];
  const index=new Map<string,number>();
  for(const e of elemek){
   const fajta=e.kind==='topic'?'téma':e.kind==='chapter'?'fejezet':e.kind==='lesson'?'tanmenet':'videó';
   const szoveg=fajta+': '+e.cim.slice(0,160)+(e.kind==='topic'&&e.alcim?' ('+e.alcim+')':'');
   const k=fajta+'|'+normalizal(e.cim);
   const i=index.get(k);
   if(i!==undefined){sorok[i].elemek.push(e);continue}
   index.set(k,sorok.length);sorok.push({szoveg,elemek:[e]});
   if(sorok.length>=4000)break;
  }
  if(!sorok.length)return Response.json({hits:[]});

  const prompt=[
   'Egy magyar középiskolai tanár saját tananyag-könyvtárában keresel. Alább a könyvtár témáinak, könyvfejezeteinek, tanmenetóráinak és videóinak listája, sorszámmal.',
   'A tanár keresése: „'+query+'”',
   'Válaszd ki azokat a sorokat, amelyek tartalmilag ehhez a kereséshez tartoznak, akkor is, ha a keresett szó nem szerepel bennük (rokon fogalom, tétel, módszer, alkalmazás, gyakori elírás vagy köznapi megnevezés).',
   'Legfeljebb 12 sort adj vissza, a legrelevánsabbal kezdve. Ha semmi nem illik, üres listát adj. Ne találj ki sorszámot.',
   'Minden sorhoz írj egy nagyon rövid magyar indoklást (legfeljebb 8 szó), például: „ez a tétel szól a derékszögű háromszög oldalairól”.',
   'Válasz JSON: {"talalatok":[{"n":<sorszám>,"miert":"<indoklás>"}]}',
   '',
   ...sorok.map((s,i)=>i+': '+s.szoveg)
  ].join('\n');

  let response:Response;
  try{
   response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent',{
    method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},
    body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{responseMimeType:'application/json',temperature:0,maxOutputTokens:2048,...(/2\.5/.test(model)?{thinkingConfig:{thinkingBudget:0}}:{})}}),
    signal:AbortSignal.timeout(45000)
   });
  }catch{
   await recordAiUsage(owner,'other',model,undefined,false);
   return Response.json({error:'Az AI most nem válaszolt időben. Próbáld újra.'},{status:504});
  }
  if(!response.ok){
   await recordAiUsage(owner,'other',model,undefined,false);
   return Response.json({error:response.status===429?'Az AI-keret most betelt. Próbáld meg kicsit később.':'Az AI most nem válaszolt (HTTP '+response.status+').'},{status:502});
  }
  const output=await response.json();
  await recordAiUsage(owner,'other',model,output?.usageMetadata);
  const text=(output?.candidates?.[0]?.content?.parts||[]).map((x:{text?:string})=>x.text||'').join('');
  let lista:{n?:unknown;miert?:unknown}[]=[];
  try{const j=JSON.parse(text);lista=Array.isArray(j?.talalatok)?j.talalatok:[]}catch{lista=[]}

  const hits=[];const volt=new Set<number>();
  for(const t of lista.slice(0,12)){
   const n=Number(t?.n);
   if(!Number.isInteger(n)||n<0||n>=sorok.length||volt.has(n))continue;volt.add(n);
   const miert=typeof t.miert==='string'?t.miert.replace(/\s+/g,' ').trim().slice(0,120):'';
   for(const e of sorok[n].elemek.slice(0,3))hits.push({kind:e.kind,id:e.id,cim:e.cim,alcim:e.alcim,cel:e.cel,miert});
  }
  return Response.json({hits});
 }catch(e){return apiError(e)}
}
