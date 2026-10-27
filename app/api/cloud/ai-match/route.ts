import {NextRequest} from 'next/server';
import {database,ownerFromRequest,apiError} from '../../../../lib/server';
import {recordAiUsage} from '../../../../lib/ai-usage';
export const runtime='nodejs';
export const maxDuration=60;

type Chapter={key:number;title:string;group?:string};
type TopicRow={id:string;name:string;parent_id:string|null};

/**
 * A könyv fejezeteinek párosítása a tanár tananyagfájával (Gemini).
 * A témaköröket a szerver tölti be, a kliens csak a fejezetlistát küldi.
 * A választ csak javaslatnak tekintjük: a tanár hagyja jóvá a felületen.
 */
export async function POST(req:NextRequest){
 try{
  const owner=await ownerFromRequest(req);
  const {subjectId,chapters,purpose}=await req.json() as {subjectId?:string;chapters?:Chapter[];purpose?:string};
  // „plan”: tanmenet órái a fejezetek helyett (ugyanaz a párosítás, más magyarázattal).
  const forPlan=purpose==='plan';
  if(!subjectId||!/^[0-9a-f-]{36}$/i.test(subjectId)||!Array.isArray(chapters)||chapters.length<1||chapters.length>150)throw Error('INVALID');
  if(chapters.some(c=>!Number.isInteger(c?.key)||typeof c.title!=='string'||c.title.length>(forPlan?400:160)||(c.group!==undefined&&(typeof c.group!=='string'||c.group.length>120))))throw Error('INVALID');
  const sql=database();
  const topics=await sql`SELECT t.id,t.name,t.parent_id FROM os_topics t JOIN os_subjects s ON s.id=t.subject_id AND s.owner_id=${owner} WHERE t.owner_id=${owner} AND t.subject_id=${subjectId} ORDER BY t.position,t.name` as TopicRow[];
  if(!topics.length)return Response.json({matches:[]});
  const key=process.env.GEMINI_API_KEY;
  if(!key)return Response.json({error:'A Gemini API-kulcs még nincs beállítva az Oktatási Segéd Vercel-projektjében.'},{status:503});
  const model=process.env.GEMINI_MODEL||'gemini-2.5-flash';
  if(!/^gemini-[a-z0-9.-]+$/.test(model))throw Error('INVALID');

  // Rövid kódokat adunk a témáknak (T1, T2…), így a modell nem tudja elrontani az azonosítókat.
  const codes=new Map<string,string>();
  const lines:string[]=[];
  const byId=new Map(topics.map(t=>[t.id,t]));
  const mains=topics.filter(t=>!t.parent_id||!byId.has(t.parent_id));
  for(const m of mains){
   const mc='T'+(codes.size+1);codes.set(mc,m.id);
   lines.push(mc+' = TÉMAKÖR: '+m.name);
   for(const s of topics.filter(t=>t.parent_id===m.id)){
    const sc='T'+(codes.size+1);codes.set(sc,s.id);
    lines.push('  '+sc+' = altéma: '+m.name+' › '+s.name);
   }
  }
  const chapterLines=chapters.map(c=>'C'+c.key+' = '+c.title.trim()+(c.group?.trim()?' (nagy fejezet: '+c.group.trim()+')':''));
  const prompt=(forPlan
   ?'Egy magyar középiskolai tanmenet óráit kell párosítanod a tanár tananyagfájával. Minden „fejezet” egy tanóra leírása.\n'
    +'Összefoglaló, gyakorló és témazáró óránál azt a témakört add meg, amelyikről az óra szól. Bevezető, szintfelmérő, ismétlő év végi és szervezési óránál adj null-t.\n'
   :'Egy magyar középiskolai tankönyv fejezeteit kell párosítanod a tanár tananyagfájával.\n')
   +'A tananyagfában témakörök vannak, alattuk altémák. Minden évfolyam témakörei szerepelnek benne.\n\n'
   +'Szabályok:\n'
   +'- Minden fejezethez a tartalmilag legjobban illő ALTÉMÁT add meg, ha van ilyen.\n'
   +'- Ha egyik altéma sem illik, de a fejezet egyértelműen egy témakörhöz tartozik, add meg a TÉMAKÖRT.\n'
   +'- A tartalom számít, nem a szavak egyezése. Pl. „Általános és szimmetrikus háromszögek” → háromszögekről szóló altéma; „A kör” → körről szóló altéma.\n'
   +'- A nagy fejezet neve segít eldönteni a témakört.\n'
   +'- Nem tartalmi bejegyzéshez (pl. „A tankönyv témakörei”, tartalomjegyzék, előszó, megoldások, tárgymutató) adj null-t.\n'
   +'- Ha nem vagy biztos, adj null-t. Ne találgass.\n'
   +'- confidence: "high", ha egyértelmű, "low", ha csak valószínű.\n\n'
   +'TANANYAGFA:\n'+lines.join('\n')+'\n\nFEJEZETEK:\n'+chapterLines.join('\n')+'\n\n'
   +'Válasz csak JSON: {"matches":[{"chapter":"C0","topic":"T5","confidence":"high"},{"chapter":"C1","topic":null}]}. Minden fejezet szerepeljen.';

  const feature=forPlan?'plan':'match';
  // A párosításhoz nem kell „gondolkodás”: enélkül a hívás sokkal gyorsabb és olcsóbb.
  // A 2.5 Flash modelleknél ez kikapcsolható; más modellnél a modell alapbeállítása marad.
  const generationConfig:Record<string,unknown>={responseMimeType:'application/json',temperature:0,maxOutputTokens:16384};
  if(/^gemini-2\.5-flash/.test(model))generationConfig.thinkingConfig={thinkingBudget:0};
  const body=JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig});

  // A Vercel egy kérésre kb. 1 percet ad. Ha az első próba lassú vagy a Gemini túlterhelt,
  // a maradék időben még egyszer megpróbáljuk, és csak utána adunk hibát.
  const started=Date.now();
  let response:Response|null=null;let lastError='';
  for(let attempt=0;attempt<2;attempt++){
   const left=55000-(Date.now()-started);
   if(attempt>0&&left<10000)break;
   try{
    response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body,signal:AbortSignal.timeout(Math.min(attempt===0?30000:left,left))});
   }catch(e){
    response=null;
    const slow=e instanceof Error&&(e.name==='TimeoutError'||e.name==='AbortError');
    lastError=slow?'Az AI túl sokáig dolgozott ezen a részen. Próbáld újra.':'Nem sikerült elérni az AI-t. Próbáld újra.';
    console.error('Gemini match',slow?'timeout':'network','attempt',attempt+1);
    continue;
   }
   if(response.ok)break;
   console.error('Gemini match HTTP',response.status,'attempt',attempt+1);
   lastError=response.status===429?'Gemini kéréslimit. Próbáld meg később.':'A Gemini-párosítás nem sikerült (HTTP '+response.status+').';
   // Csak az átmeneti hibákat érdemes újrapróbálni (túlterhelés, kéréslimit, szerverhiba).
   if(![429,500,503].includes(response.status))break;
   response=null;
  }
  if(!response||!response.ok){
   await recordAiUsage(owner,feature,model,undefined,false);
   return Response.json({error:lastError||'A Gemini-párosítás nem sikerült.'},{status:response?502:504});
  }
  const output=await response.json();
  const txt=(output?.candidates?.[0]?.content?.parts?.map((x:{text?:string})=>x.text||'').join('')||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  let parsed:{matches?:{chapter?:string;topic?:string|null;confidence?:string}[]};
  try{parsed=JSON.parse(txt)}catch{
   // A számlálóban sikertelennek jelöljük: a token elfogyott, de használható válasz nem jött.
   console.error('Gemini match unparsable',output?.candidates?.[0]?.finishReason,txt.length);
   await recordAiUsage(owner,feature,model,output?.usageMetadata,false);
   return Response.json({error:output?.candidates?.[0]?.finishReason==='MAX_TOKENS'?'Az AI válasza túl hosszú lett és elvágódott. Próbáld újra.':'A Gemini nem adott értelmezhető párosítást. Próbáld újra.'},{status:502});
  }
  await recordAiUsage(owner,feature,model,output?.usageMetadata);
  const validKeys=new Set(chapters.map(c=>c.key));
  const matches:{key:number;topicId:string;confidence:'high'|'low'}[]=[];
  for(const m of Array.isArray(parsed.matches)?parsed.matches:[]){
   const k=Number(String(m?.chapter||'').replace(/^C/i,''));
   const id=typeof m?.topic==='string'?codes.get(m.topic.trim().toUpperCase()):undefined;
   if(!Number.isInteger(k)||!validKeys.has(k)||!id||matches.some(x=>x.key===k))continue;
   matches.push({key:k,topicId:id,confidence:m.confidence==='high'?'high':'low'});
  }
  // Ha a válaszban voltak sorok, de egyik sem volt használható, a naplóban nyoma marad.
  const given=Array.isArray(parsed.matches)?parsed.matches.filter(m=>m?.topic).length:0;
  if(given>0&&matches.length===0)console.error('Gemini match: no usable rows',given,'of',chapters.length);
  return Response.json({matches});
 }catch(e){return apiError(e)}
}
