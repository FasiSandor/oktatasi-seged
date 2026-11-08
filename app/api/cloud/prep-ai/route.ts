import {NextRequest} from 'next/server';
import {ownerFromRequest,apiError} from '../../../../lib/server';
import {recordAiUsage} from '../../../../lib/ai-usage';
import {cleanSource,LIMITS,newId,type PrepItem,type PrepSource} from '../../../../lib/orafelkeszito';
export const runtime='nodejs';
export const maxDuration=60;

/**
 * Órafelkészítő AI-kérések (0.5.0). Részenként külön kérés, mert a Vercelen egy kérés kb. 60 másodpercig futhat,
 * és az ingyenes Gemini-keret is véges:
 *  - alap: előismeretek és fogalmak az oldalakból
 *  - feladat: mintafeladatok vagy gyakorló feladatok (megoldással)
 *  - elem: egyetlen előismeret vagy fogalom cseréje
 *  - ellenorzes: egy megoldás újraszámolása (kép nélkül)
 * Az oldalakat a böngésző JPEG-képpé rendereli (nem digitalizálunk), a kép előtt a könyv és az oldal címkéje áll.
 */

type Img={book:string;page:number|null;data:string};
const MAX_IMAGES=6;
// A Vercel egy kérésben kb. 4,5 MB-ot enged, ezért az összméretet is korlátozzuk.
const MAX_TOTAL=4_000_000;
const MAX_ONE=1_800_000;

const clean=(v:unknown,max:number)=>typeof v==='string'?v.replace(/\s+/g,' ').trim().slice(0,max):'';
const list=(v:unknown,n:number,len:number)=>Array.isArray(v)?v.map(x=>clean(x,len)).filter(Boolean).slice(0,n):[];

function head(grade:number|null,subject:string,topic:string){
 return [
  'Egy magyar '+(grade&&grade<=8?'általános iskolai':'középiskolai')+' tanárnak ('+(subject||'matematika')+') készítesz felkészülési anyagot a következő órához.',
  topic?'Az óra témája: '+topic+'.':'',
  grade?'Évfolyam: '+grade+'.':'',
  'A képek a tanár által kijelölt tankönyvi és munkafüzeti oldalak. Minden kép előtt szerepel, melyik könyvből és hányadik oldalról van.',
  'Írj magyarul, egyszerűen, a diákok szintjén, tanári nyelven, hogy az óra előtt gyorsan át lehessen nézni, és órán használni lehessen.',
  'Ne használj LaTeX-et, Markdown-formázást és címsorokat. A képleteket egyszerű szövegként írd (pl. x², √2, a·b, 3/4, ≤, ≠).',
  'Ne írj bevezetőt és zárszót, csak a kért JSON-t add vissza.'
 ].filter(Boolean);
}

const SOURCE_RULE='A "source" mezőben: "book" pontosan az a könyvcím, amely a feladat képe előtti címkében áll; "page" az oldalszám, amelyen a feladat van (a címke alapján, vagy ha a lapon látszik a nyomtatott szám, az); "task" a feladat jelölése a könyvben (pl. "3." vagy "12. feladat"), ha nincs jelölése, üres szöveg.';

function promptAlap(grade:number|null,subject:string,topic:string,wish:string){
 return [
  ...head(grade,subject,topic),
  'Készíts két részt.',
  '1. "prereq" (előismeretek): 2–6 elem. Mit kell a diáknak már tudnia ehhez a témához a korábbi évfolyamokról vagy témákból. Ha egy előismerethez szabály, azonosság vagy képlet tartozik (pl. a hatványozás azonosságai), azt írd a "rule" mezőbe, egyszerű szövegként; ha nincs hozzá szabály, a "rule" legyen üres szöveg.',
  '2. "concepts" (fogalmak, definíciók): az oldalakon szereplő új fogalmak, definíciók, tételek, szabályok, 3–8 elem. A "title" a fogalom neve, a "text" a definíció vagy a szabály a könyv megfogalmazásához igazodva, de tömören. Ne találj ki olyan definíciót, amely a könyvben nem szerepel.',
  wish?'A tanár kérése: '+wish:'',
  'Válasz: {"prereq":[{"text":"","rule":""}],"concepts":[{"title":"","text":""}]}'
 ].filter(Boolean).join('\n');
}

function promptFeladat(grade:number|null,subject:string,topic:string,kind:'example'|'practice',count:number,avoid:string[],wish:string){
 return [
  ...head(grade,subject,topic),
  kind==='example'
   ?'Válassz '+count+' MINTAFELADATOT: tipikus feladat, amely a téma lényegét mutatja be. A megoldást dolgozd ki lépésenként: számozott lépések (1., 2., 3. …), minden lépésnél rövid indoklással és a számolással, az utolsó sor: „Végeredmény: …”.'
   :'Válassz '+count+' GYAKORLÓ FELADATOT a tanulók önálló gyakorlásához, könnyebbtől a nehezebb felé. A megoldás legyen tömör: a számolás főbb lépései, az utolsó sor: „Végeredmény: …”.',
  'Elsősorban az oldalakon látható feladatokból válassz, a könyv szövegéhez hűen. Ne válassz olyan feladatot, amely ábrára hivatkozik, ha az ábra nélkül nem érthető. Csak akkor írj új feladatot, ha a látható feladatok száma nem elég; az új feladatnál "fromBook": false és "source": null.',
  SOURCE_RULE,
  'A megoldásokat gondosan számold ki, hibás megoldás nem elfogadható.',
  avoid.length?'Ezeket a feladatokat már felhasználtuk, ne válaszd őket újra:\n- '+avoid.join('\n- '):'',
  wish?'A tanár kérése: '+wish:'',
  'Válasz: {"tasks":[{"text":"","solution":"","fromBook":true,"source":{"book":"","page":0,"task":""}}]}'
 ].filter(Boolean).join('\n');
}

function promptElem(grade:number|null,subject:string,topic:string,kind:'prereq'|'concept',avoid:string[],wish:string){
 return [
  ...head(grade,subject,topic),
  kind==='prereq'
   ?'Adj EGY előismeretet: mit kell a diáknak már tudnia ehhez a témához. Ha tartozik hozzá szabály vagy képlet, írd a "rule" mezőbe (egyszerű szöveg), különben a "rule" legyen üres szöveg.'
   :'Adj EGY fogalmat vagy definíciót az oldalakról. A "title" a fogalom neve, a "text" a definíció a könyv megfogalmazásához igazodva, tömören. Ne találj ki olyan definíciót, amely a könyvben nem szerepel.',
  avoid.length?'Ezek már szerepelnek, ne ismételd őket:\n- '+avoid.join('\n- '):'',
  wish?'A tanár kérése: '+wish:'',
  'Válasz: {"item":{"title":"","text":"","rule":""}}'
 ].filter(Boolean).join('\n');
}

function promptEllenorzes(grade:number|null,subject:string,text:string,solution:string){
 return [
  'Egy magyar '+(grade&&grade<=8?'általános iskolai':'középiskolai')+' tanár ('+(subject||'matematika')+') megoldását ellenőrzöd.',
  'Előbb oldd meg önállóan a feladatot úgy, hogy a megadott megoldást még nem nézed meg. Utána hasonlítsd össze a saját végeredményedet a megadott megoldással.',
  '"agrees": igaz, ha a végeredmény azonos (egyenértékű alakban is). "ownResult": a te végeredményed röviden. "note": ha eltér, 1–3 mondatban írd le, melyik lépésnél lehet a hiba; ha egyezik, üres szöveg.',
  'Ne használj LaTeX-et, a képleteket egyszerű szövegként írd (pl. x², √2, 3/4).',
  'FELADAT:\n'+text,
  'MEGADOTT MEGOLDÁS:\n'+solution,
  'Válasz: {"agrees":true,"ownResult":"","note":""}'
 ].join('\n');
}

type Part={text:string}|{inlineData:{mimeType:string;data:string}};

/** Egy Gemini-hívás, legfeljebb egy automatikus újrapróbálással az átmeneti hibáknál. */
async function gemini(owner:string,model:string,key:string,parts:Part[],config:Record<string,unknown>,started:number){
 let last:{status:number;slow:boolean}={status:0,slow:false};
 for(let attempt=0;attempt<2;attempt++){
  const left=55000-(Date.now()-started);
  if(attempt>0&&left<12000)break;
  let response:Response;
  try{
   response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent',{
    method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},
    body:JSON.stringify({contents:[{role:'user',parts}],generationConfig:config}),
    signal:AbortSignal.timeout(Math.min(attempt===0?40000:left,left))
   });
  }catch(e){
   await recordAiUsage(owner,'prep',model,undefined,false);
   last={status:0,slow:e instanceof Error&&(e.name==='TimeoutError'||e.name==='AbortError')};
   console.error('Gemini prep',last.slow?'timeout':'network','attempt',attempt+1);
   if(last.slow)break;
   continue;
  }
  if(!response.ok){
   await recordAiUsage(owner,'prep',model,undefined,false);
   last={status:response.status,slow:false};
   console.error('Gemini prep HTTP',response.status,'attempt',attempt+1);
   // Csak az átmeneti hibákat érdemes újrapróbálni (túlterhelés, kéréslimit, szerverhiba).
   if(![429,500,503].includes(response.status))break;
   continue;
  }
  const output=await response.json();
  await recordAiUsage(owner,'prep',model,output?.usageMetadata);
  const text=(output?.candidates?.[0]?.content?.parts||[]).map((x:{text?:string})=>x.text||'').join('');
  return {ok:true as const,text,cut:output?.candidates?.[0]?.finishReason==='MAX_TOKENS'};
 }
 return {ok:false as const,...last};
}

function failure(r:{status:number;slow:boolean}){
 if(r.slow)return Response.json({error:'Az AI túl sokáig dolgozott ezen a részen. Próbáld újra, vagy jelölj ki kevesebb oldalt.'},{status:504});
 if(r.status===429)return Response.json({error:'Az AI-keret most betelt. Próbáld meg kicsit később.'},{status:502});
 if(r.status===0)return Response.json({error:'Nem sikerült elérni az AI-t. Próbáld újra.'},{status:504});
 return Response.json({error:'Az AI most nem válaszolt (HTTP '+r.status+'). Próbáld újra.'},{status:502});
}

function parseJson(text:string):Record<string,unknown>|null{
 const body=text.replace(/^\s*```(?:json)?\s*/i,'').replace(/\s*```\s*$/,'');
 try{const v=JSON.parse(body);return v&&typeof v==='object'?v as Record<string,unknown>:null}catch{return null}
}

const field=(v:unknown,max:number)=>typeof v==='string'?v.trim().slice(0,max):'';

export async function POST(req:NextRequest){
 try{
  const started=Date.now();
  const owner=await ownerFromRequest(req),b=await req.json();
  const part=b?.part as 'alap'|'feladat'|'elem'|'ellenorzes';
  if(!['alap','feladat','elem','ellenorzes'].includes(part))throw Error('INVALID');
  const grade=Number.isInteger(b.grade)&&b.grade>=1&&b.grade<=13?Number(b.grade):null;
  const subject=clean(b.subject,60),topic=clean(b.topic,200),wish=clean(b.wish,300);
  const avoid=list(b.avoid,20,200);

  const key=process.env.GEMINI_API_KEY;
  if(!key)return Response.json({error:'A Gemini API-kulcs még nincs beállítva az Oktatási Segéd Vercel-projektjében.'},{status:503});
  const model=process.env.GEMINI_MODEL||'gemini-2.5-flash';
  if(!/^gemini-[a-z0-9.-]+$/.test(model))throw Error('INVALID');
  // A nagy kimenetű kéréseknél a gondolkodás ki van kapcsolva (gyorsabb, olcsóbb); az ellenőrzésnél marad.
  const noThink=/^gemini-2\.5-flash/.test(model)?{thinkingConfig:{thinkingBudget:0}}:{};

  if(part==='ellenorzes'){
   const text=field(b.text,LIMITS.text),solution=field(b.solution,LIMITS.solution);
   if(!text||!solution)throw Error('INVALID');
   const r=await gemini(owner,model,key,[{text:promptEllenorzes(grade,subject,text,solution)}],{
    responseMimeType:'application/json',temperature:0,maxOutputTokens:4096,
    ...(/2\.5/.test(model)?{thinkingConfig:{thinkingBudget:/flash-lite/.test(model)?0:2048}}:{})
   },started);
   if(!r.ok)return failure(r);
   const p=parseJson(r.text);
   if(!p||typeof p.agrees!=='boolean')return Response.json({error:'Az AI nem adott értelmezhető ellenőrzést. Próbáld újra.'},{status:502});
   return Response.json({agrees:p.agrees,ownResult:field(p.ownResult,500),note:field(p.note,LIMITS.note)});
  }

  // A többi résznél az oldalak képként mennek.
  const images:Img[]=Array.isArray(b.images)?b.images:[];
  if(images.length<1||images.length>MAX_IMAGES)throw Error('INVALID');
  let total=0;
  for(const i of images){
   if(!i||typeof i.data!=='string'||i.data.length<100||i.data.length>MAX_ONE||!/^[A-Za-z0-9+/=]+$/.test(i.data))throw Error('INVALID');
   if(typeof i.book!=='string'||!i.book.trim()||i.book.length>LIMITS.book)throw Error('INVALID');
   if(i.page!=null&&(!Number.isInteger(i.page)||i.page<1||i.page>5000))throw Error('INVALID');
   total+=i.data.length;
  }
  if(total>MAX_TOTAL)return Response.json({error:'A kijelölt oldalak együtt túl nagyok az AI-nak. Jelölj ki kevesebb oldalt, vagy készítsd el a lapot két részletben.'},{status:413});
  const books=new Set(images.map(i=>i.book.trim()));

  let prompt:string,tokens=8192;
  const kind=b.kind as string;
  if(part==='alap')prompt=promptAlap(grade,subject,topic,wish);
  else if(part==='feladat'){
   if(kind!=='example'&&kind!=='practice')throw Error('INVALID');
   const count=Number.isInteger(b.count)&&b.count>=1&&b.count<=10?Number(b.count):kind==='example'?3:7;
   prompt=promptFeladat(grade,subject,topic,kind,count,avoid,wish);tokens=12288;
  }else{
   if(kind!=='prereq'&&kind!=='concept')throw Error('INVALID');
   prompt=promptElem(grade,subject,topic,kind,avoid,wish);tokens=2048;
  }

  const parts:Part[]=[{text:prompt}];
  for(const i of images)parts.push({text:'Kép: '+i.book.trim()+(i.page?', '+i.page+'. oldal':'')},{inlineData:{mimeType:'image/jpeg',data:i.data}});

  const r=await gemini(owner,model,key,parts,{responseMimeType:'application/json',temperature:part==='feladat'?0.3:0.2,maxOutputTokens:tokens,...noThink},started);
  if(!r.ok)return failure(r);
  const p=parseJson(r.text);
  if(!p)return Response.json({error:r.cut?'Az AI válasza félbeszakadt. Kérj kevesebb elemet, vagy jelölj ki kevesebb oldalt.':'Az AI nem adott értelmezhető választ. Próbáld újra.'},{status:502});

  if(part==='alap'){
   const prereq:PrepItem[]=(Array.isArray(p.prereq)?p.prereq:[]).flatMap((x:Record<string,unknown>)=>{
    const text=field(x?.text,LIMITS.text);if(!text)return [];
    const rule=field(x?.rule,LIMITS.rule);
    return [{id:newId(),text,...(rule?{rule}:{}),ai:false}];
   }).slice(0,10);
   const concepts:PrepItem[]=(Array.isArray(p.concepts)?p.concepts:[]).flatMap((x:Record<string,unknown>)=>{
    const text=field(x?.text,LIMITS.text);if(!text)return [];
    const title=field(x?.title,LIMITS.title);
    return [{id:newId(),text,...(title?{title}:{}),ai:false}];
   }).slice(0,12);
   if(!prereq.length&&!concepts.length)return Response.json({error:'Az AI nem talált használható fogalmat az oldalakon. Próbáld újra, vagy jelölj ki más oldalakat.'},{status:502});
   return Response.json({prereq,concepts,cut:r.cut});
  }

  if(part==='elem'){
   const x=(p.item&&typeof p.item==='object'?p.item:{}) as Record<string,unknown>;
   const text=field(x.text,LIMITS.text);
   if(!text)return Response.json({error:'Az AI nem adott új elemet. Próbáld újra.'},{status:502});
   const item:PrepItem={id:newId(),text,ai:false};
   if(kind==='concept'){const t=field(x.title,LIMITS.title);if(t)item.title=t}
   else{const rule=field(x.rule,LIMITS.rule);if(rule)item.rule=rule}
   return Response.json({item});
  }

  // feladat
  const items:PrepItem[]=(Array.isArray(p.tasks)?p.tasks:[]).flatMap((x:Record<string,unknown>)=>{
   const text=field(x?.text,LIMITS.text),solution=field(x?.solution,LIMITS.solution);
   if(!text||!solution)return [];
   // A forrás csak akkor fogadható el, ha a megadott könyvek egyikére mutat; különben a feladatot AI-feladatnak jelöljük.
   let source:PrepSource=x.fromBook===false?null:cleanSource(x.source);
   if(source&&!books.has(source.book))source=null;
   return [{id:newId(),text,solution,source,ai:!source}];
  }).slice(0,10);
  if(!items.length)return Response.json({error:r.cut?'Az AI válasza félbeszakadt. Kérj kevesebb feladatot.':'Az AI nem adott használható feladatot. Próbáld újra.'},{status:502});
  return Response.json({items,cut:r.cut});
 }catch(e){return apiError(e)}
}
