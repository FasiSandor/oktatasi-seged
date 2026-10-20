import {NextRequest} from 'next/server';
import {ownerFromRequest,apiError} from '../../../../lib/server';
import {recordAiUsage} from '../../../../lib/ai-usage';
export const runtime='nodejs';
export const maxDuration=60;

/**
 * Segítség egy könyvbeli feladathoz. A kliens csak a bekeretezett részt küldi el képként.
 * Három mód: tipp (nem árulja el a megoldást), lépésről lépésre, hasonló feladat.
 */
const MODES={
 hint:'Adj egy rövid, 1–2 mondatos tippet, amely elindítja a gondolkodást. NE áruld el a végeredményt, és ne oldd meg a feladatot.',
 steps:'Oldd meg a feladatot lépésről lépésre, számozott lépésekben (1., 2., 3. …), minden lépésnél egy rövid magyarázattal. Ha több részfeladat van, mindegyiket oldd meg. A végén külön sorban: „Végeredmény: …”.',
 similar:'Írj egy ugyanilyen típusú és nehézségű új feladatot más adatokkal. Utána „Megoldás:” címmel oldd meg röviden, számozott lépésekben, a végén „Végeredmény: …” sorral.'
} as const;

export async function POST(req:NextRequest){
 try{
  const owner=await ownerFromRequest(req),b=await req.json();
  const mode=b?.mode as keyof typeof MODES;
  if(!MODES[mode]||typeof b.image!=='string'||b.image.length<100||b.image.length>1_800_000||!/^[A-Za-z0-9+/=]+$/.test(b.image))throw Error('INVALID');
  const grade=Number.isInteger(b.grade)&&b.grade>=1&&b.grade<=13?b.grade:null;
  const level=b.level==='emelt'?'emelt':b.level==='kozep'?'közép':null;
  const subject=typeof b.subject==='string'?b.subject.replace(/\s+/g,' ').trim().slice(0,60):'';
  const key=process.env.GEMINI_API_KEY;
  if(!key)return Response.json({error:'A Gemini API-kulcs még nincs beállítva az Oktatási Segéd Vercel-projektjében.'},{status:503});
  const model=process.env.GEMINI_MODEL||'gemini-2.5-flash';
  if(!/^gemini-[a-z0-9.-]+$/.test(model))throw Error('INVALID');

  const prompt=[
   'Egy magyar középiskolai tanárnak segítesz'+(subject?' ('+subject+')':'')+'. A képen egy tankönyvi vagy feladatgyűjteménybeli feladat van, amelyet a tanár bekeretezett.',
   'Csak ezzel a feladattal foglalkozz. Ha a képen több feladat is látszik, a legteljesebben látszóval.',
   grade?'Évfolyam: '+grade+'.'+(level?' Szint: '+level+'szint.':''):'',
   'Írj magyarul, egyszerűen, a diákok szintjén, hogy a tanár órán is használhassa.',
   'Ne használj LaTeX-et, Markdown-táblázatot és címsorokat. A képleteket egyszerű szövegként írd (pl. x², √2, a·b, 3/4, ≤).',
   'Ha a feladat nem olvasható vagy nem egyértelmű, ezt írd meg röviden, és ne találgass.',
   MODES[mode]
  ].filter(Boolean).join('\n');

  let response:Response;
  try{
   response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent',{
    method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},
    body:JSON.stringify({contents:[{role:'user',parts:[{inlineData:{mimeType:'image/jpeg',data:b.image}},{text:prompt}]}],generationConfig:{temperature:0.2,maxOutputTokens:6000}}),
    signal:AbortSignal.timeout(50000)
   });
  }catch(e){
   await recordAiUsage(owner,'help',model,undefined,false);
   const slow=e instanceof Error&&(e.name==='TimeoutError'||e.name==='AbortError');
   return Response.json({error:slow?'Az AI túl sokáig dolgozott a feladaton. Próbáld újra.':'Nem sikerült elérni az AI-t. Próbáld újra.'},{status:504});
  }
  if(!response.ok){
   await recordAiUsage(owner,'help',model,undefined,false);
   return Response.json({error:response.status===429?'Az AI-keret most betelt. Próbáld meg kicsit később.':'Az AI most nem válaszolt (HTTP '+response.status+').'},{status:502});
  }
  const output=await response.json();
  await recordAiUsage(owner,'help',model,output?.usageMetadata);
  const text=(output?.candidates?.[0]?.content?.parts||[]).map((x:{text?:string})=>x.text||'').join('').trim();
  if(!text)return Response.json({error:'Az AI nem adott választ. Próbáld újra, vagy keretezd be pontosabban a feladatot.'},{status:502});
  return Response.json({text:text.slice(0,20000)});
 }catch(e){return apiError(e)}
}
