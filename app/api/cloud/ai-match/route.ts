import {NextRequest} from 'next/server';
import {database,ownerFromRequest,apiError} from '../../../../lib/server';
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
  const {subjectId,chapters}=await req.json() as {subjectId?:string;chapters?:Chapter[]};
  if(!subjectId||!/^[0-9a-f-]{36}$/i.test(subjectId)||!Array.isArray(chapters)||chapters.length<1||chapters.length>150)throw Error('INVALID');
  if(chapters.some(c=>!Number.isInteger(c?.key)||typeof c.title!=='string'||c.title.length>160||(c.group!==undefined&&(typeof c.group!=='string'||c.group.length>120))))throw Error('INVALID');
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
  const prompt='Egy magyar középiskolai tankönyv fejezeteit kell párosítanod a tanár tananyagfájával.\n'
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

  const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{responseMimeType:'application/json',temperature:0,maxOutputTokens:16384}}),signal:AbortSignal.timeout(55000)});
  if(!response.ok){console.error('Gemini match HTTP',response.status);return Response.json({error:response.status===429?'Gemini kéréslimit. Próbáld meg később.':'A Gemini-párosítás nem sikerült (HTTP '+response.status+').'},{status:502})}
  const output=await response.json();
  const txt=output?.candidates?.[0]?.content?.parts?.map((x:{text?:string})=>x.text||'').join('')||'';
  let parsed:{matches?:{chapter?:string;topic?:string|null;confidence?:string}[]};
  try{parsed=JSON.parse(txt)}catch{return Response.json({error:'A Gemini nem adott értelmezhető párosítást.'},{status:502})}
  const validKeys=new Set(chapters.map(c=>c.key));
  const matches:{key:number;topicId:string;confidence:'high'|'low'}[]=[];
  for(const m of Array.isArray(parsed.matches)?parsed.matches:[]){
   const k=Number(String(m?.chapter||'').replace(/^C/i,''));
   const id=typeof m?.topic==='string'?codes.get(m.topic.trim().toUpperCase()):undefined;
   if(!Number.isInteger(k)||!validKeys.has(k)||!id||matches.some(x=>x.key===k))continue;
   matches.push({key:k,topicId:id,confidence:m.confidence==='high'?'high':'low'});
  }
  return Response.json({matches});
 }catch(e){return apiError(e)}
}
