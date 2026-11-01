import {NextRequest} from 'next/server';
import {GetObjectCommand} from '@aws-sdk/client-s3';
import {ownerFromRequest,apiError,isUuid} from '../../../../../lib/server';
import {recordAiUsage} from '../../../../../lib/ai-usage';
import {fbDatabase,fbS3,fbBucket,fbHiba,ellenorzesFrissites} from '../../../../../lib/feladatbank/server';
import {TEMAK,letezoKod,temaListaSzoveg} from '../../../../../lib/feladatbank/temak';
import {feladatCimke,reszNev,szintNev} from '../../../../../lib/feladatbank/felismeres';
export const runtime='nodejs';
export const maxDuration=60;

/**
 * Egy lappár egyik részének (I. vagy II.) témakörbe sorolása a Geminivel.
 * A Gemini magát a feladatlapot és az útmutatót kapja PDF-ben (a kinyert szövegben
 * a képletek szétesnek, az ábrák elvesznek), a program által már kiolvasott feladatlistával
 * és a témakörlistával. Kézzel javított feladatot nem ír felül.
 */
export async function POST(req:NextRequest){
 const kezdes=Date.now();
 let owner='';
 try{
  owner=await ownerFromRequest(req);
  const b=await req.json();
  if(!isUuid(b.vizsgaId)||(b.resz!=='I'&&b.resz!=='II'))throw Error('INVALID');
  const gondolkodas=b.gondolkodas===true;
  const key=process.env.GEMINI_API_KEY;
  if(!key)return Response.json({error:'A Gemini API-kulcs nincs beállítva az Oktatási Segéd Vercel-projektjében.'},{status:503});
  const model=process.env.GEMINI_MODEL||'gemini-2.5-flash';
  if(!/^gemini-[a-z0-9.-]+$/.test(model))throw Error('INVALID');

  const sql=fbDatabase();
  const [v]=await sql`SELECT id,szint,ev,honap FROM fb_vizsgak WHERE id=${b.vizsgaId}`;
  if(!v)throw Error('FORBIDDEN');
  const feladatok=(await sql`SELECT id,sorszam,reszfeladat,resz,pont,kezzel FROM fb_feladatok WHERE vizsga_id=${v.id} ORDER BY sorrend`)
   .filter(f=>b.resz==='I'?f.resz==='I':String(f.resz).startsWith('II'));
  if(!feladatok.length)return Response.json({error:'Ebben a részben nincs feladat. Előbb a feladatokra bontásnak kell sikerülnie.'},{status:400});
  const fajlok=await sql`SELECT tipus,storage_key FROM fb_fajlok WHERE vizsga_id=${v.id} AND allapot='kesz'`;
  const s3=fbS3();
  const pdf=async(tipus:string)=>{
   const f=fajlok.find(x=>x.tipus===tipus);if(!f)return null;
   const o=await s3.send(new GetObjectCommand({Bucket:fbBucket(),Key:String(f.storage_key)}));
   return Buffer.from(await o.Body!.transformToByteArray()).toString('base64');
  };
  const [fl,ut]=await Promise.all([pdf('fl'),pdf('ut')]);
  if(!fl)return Response.json({error:'Hiányzik a feladatlap PDF-je.'},{status:400});

  const tetelek=feladatok.map((f,i)=>({azon:'t'+(i+1),f}));
  const kodok=TEMAK.map(t=>t.kod);
  const prompt=[
   'Magyar matematika érettségi feladatsort sorolsz be témakörök szerint ('+v.ev+', '+szintNev(String(v.szint))+').',
   'Megkapod a feladatlapot'+(ut?' és a javítási útmutatót':'')+' PDF-ben.'+(ut?' A témakört a megoldásból (útmutató) jobban látod, mint a feladat szövegéből.':''),
   'Csak a(z) '+(b.resz==='I'?'I. rész':'II. rész')+' alábbi tételeivel foglalkozz. A II. részben minden részfeladat (a, b, c…) külön tétel, mert egy feladaton belül más-más téma lehet.',
   '',
   'Szabályok:',
   '1. A „fo” a témakörlista legszűkebb illő altémájának kódja (például nem 2.8, hanem 2.8.1.2). Csak a listában szereplő kódot használhatsz.',
   '2. A megoldás dönt, nem a szöveg témája: egy viharjelzéses feladat, ha százalékot számol, 2.7.1.',
   '3. „szoveges”: csak akkor igaz, ha a vizsgázónak egy hosszabb, hétköznapi helyzetet leíró szövegből magának kell felállítania a matematikai modellt (egyenletet, összefüggést, számítási tervet). Hamis, ha a feladat matematikai nyelven van megfogalmazva (pl. „Egy derékszögű háromszög átfogója 50 cm…”, „Határozza meg az n értékét!”, „Hány átlója van…?”), akkor is, ha mértékegység vagy rövid szituáció szerepel benne. Az I. rész rövid feladatai általában nem szövegesek. Szöveges feladatnál se az 1. témakört add főnek, hanem a megoldás matematikai tartalmát.',
   '4. A képlet nélküli ábraolvasás (grafikon, diagram) annak a témának a része, amiről az ábra szól (függvénygrafikon 3.2.1, dobozdiagram 5.1.1 vagy 5.1.2).',
   '5. „mellek”: csak akkor adj meg mellék-altémát, ha a megoldásban lényeges szerepe van; különben null.',
   '6. „biztos”: legyen hamis, ha a megoldásban két altéma nagyjából egyforma súllyal szerepel, és egy másik tanár joggal választhatná a másikat főnek (például egyenlet és függvény, sorozat és exponenciális egyenlet, test és térelem). Ilyenkor a másikat add meg mellékként. Ne légy túl magabiztos: egy lapon általában van néhány ilyen tétel.',
   '7. „megjegyzes”: legfeljebb 6 szó a megoldás módjáról, például „szinusztétel”, „exponenciális függvény grafikonja”, „visszatevés nélküli mintavétel”.',
   '',
   'Tételek (azonosító | feladat | rész | pont):',
   ...tetelek.map(t=>t.azon+' | '+feladatCimke(t.f.sorszam,t.f.reszfeladat)+' | '+reszNev(String(t.f.resz))+' | '+(t.f.pont??'?')+' pont'),
   '',
   'Témakörlista:',
   temaListaSzoveg(),
   '',
   'Minden tételhez pontosan egy elemet adj vissza, a megadott azonosítóval.'
  ].join('\n');

  const parts:object[]=[{inlineData:{mimeType:'application/pdf',data:fl}}];
  if(ut)parts.push({inlineData:{mimeType:'application/pdf',data:ut}});
  parts.push({text:prompt});
  const schema={type:'ARRAY',items:{type:'OBJECT',properties:{
   id:{type:'STRING'},fo:{type:'STRING',enum:kodok},mellek:{type:'STRING',enum:kodok,nullable:true},
   szoveges:{type:'BOOLEAN'},biztos:{type:'BOOLEAN'},megjegyzes:{type:'STRING'}
  },required:['id','fo','szoveges','biztos','megjegyzes'],propertyOrdering:['id','fo','mellek','szoveges','biztos','megjegyzes']}};
  const thinking=/2\.5-flash/.test(model)&&!/lite/.test(model)?{thinkingConfig:{thinkingBudget:gondolkodas?2048:0}}:{};

  const naplo=async(ok:boolean,hiba:string|null,usage?:{promptTokenCount?:number;candidatesTokenCount?:number;thoughtsTokenCount?:number})=>{
   try{await sql`INSERT INTO fb_besorolasok(vizsga_id,resz,modell,gondolkodas,mp,bemenet,kimenet,gondolat,ok,hiba)
    VALUES(${v.id},${b.resz},${model},${gondolkodas},${(Date.now()-kezdes)/1000},${usage?.promptTokenCount??null},${usage?.candidatesTokenCount??null},${usage?.thoughtsTokenCount??null},${ok},${hiba})`}catch{}
   await recordAiUsage(owner,'other',model,usage,ok);
  };

  let response:Response;
  try{
   response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent',{
    method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},
    body:JSON.stringify({contents:[{role:'user',parts}],generationConfig:{temperature:0.1,maxOutputTokens:8192,responseMimeType:'application/json',responseSchema:schema,...thinking}}),
    signal:AbortSignal.timeout(52000)
   });
  }catch(e){
   const lassu=e instanceof Error&&(e.name==='TimeoutError'||e.name==='AbortError');
   await naplo(false,lassu?'időtúllépés':'nem elérhető');
   return Response.json({error:lassu?'Az AI nem végzett időben. Próbáld újra, vagy kapcsold ki a gondolkodást.':'Nem sikerült elérni az AI-t. Próbáld újra.',lassu},{status:504});
  }
  if(!response.ok){
   await naplo(false,'HTTP '+response.status);
   return Response.json({error:response.status===429?'Az AI-keret most betelt. Próbáld meg kicsit később.':'Az AI most nem válaszolt (HTTP '+response.status+').'},{status:502});
  }
  const output=await response.json();
  const text=(output?.candidates?.[0]?.content?.parts||[]).filter((x:{thought?:boolean})=>!x.thought).map((x:{text?:string})=>x.text||'').join('');
  let lista:unknown;
  try{lista=JSON.parse(text)}catch{lista=null}
  if(!Array.isArray(lista)){
   await naplo(false,'olvashatatlan válasz',output?.usageMetadata);
   return Response.json({error:output?.candidates?.[0]?.finishReason==='MAX_TOKENS'?'Az AI válasza félbemaradt. Próbáld újra.':'Az AI válasza nem volt használható. Próbáld újra.'},{status:502});
  }

  type V={id?:unknown;fo?:unknown;mellek?:unknown;szoveges?:unknown;biztos?:unknown;megjegyzes?:unknown};
  const byAzon=new Map((lista as V[]).filter(x=>x&&typeof x.id==='string').map(x=>[x.id as string,x]));
  let besorolt=0;
  for(const t of tetelek){
   const x=byAzon.get(t.azon);
   if(!x||!letezoKod(x.fo)){
    await sql`UPDATE fb_feladatok SET ai_futott=true,updated_at=now() WHERE id=${t.f.id}`;
    continue;
   }
   besorolt++;
   const mellek=letezoKod(x.mellek)&&x.mellek!==x.fo?x.mellek:null;
   const megj=typeof x.megjegyzes==='string'?x.megjegyzes.replace(/\s+/g,' ').trim().slice(0,120):null;
   const szoveges=x.szoveges===true,biztos=x.biztos!==false;
   if(t.f.kezzel){
    await sql`UPDATE fb_feladatok SET ai_fo_kod=${x.fo},ai_futott=true,updated_at=now() WHERE id=${t.f.id}`;
   }else{
    await sql`UPDATE fb_feladatok SET fo_kod=${x.fo},mellek_kod=${mellek},szoveges=${szoveges},megjegyzes=${megj},biztos=${biztos},
     ai_fo_kod=${x.fo},ai_futott=true,jovahagyva=false,updated_at=now() WHERE id=${t.f.id}`;
   }
  }
  await naplo(true,null,output?.usageMetadata);
  await ellenorzesFrissites(String(v.id));
  await sql`UPDATE fb_vizsgak x SET allapot='besorolva',updated_at=now() WHERE x.id=${v.id} AND x.allapot='bontva'
   AND NOT EXISTS(SELECT 1 FROM fb_feladatok f WHERE f.vizsga_id=x.id AND f.fo_kod IS NULL)`;
  return Response.json({besorolt,osszes:tetelek.length,mp:Math.round((Date.now()-kezdes)/100)/10,gondolkodas});
 }catch(e){return fbHiba(e)||apiError(e)}
}
