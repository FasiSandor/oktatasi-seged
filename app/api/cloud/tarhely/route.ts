import {NextRequest} from 'next/server';
import {DeleteObjectCommand,ListObjectsV2Command} from '@aws-sdk/client-s3';
import {database,ownerFromRequest,s3,bucket,apiError,schemaMissing} from '../../../../lib/server';
export const runtime='nodejs';
export const maxDuration=60;

/**
 * Tárhely-takarítás. Gazdátlan az a fájl, amelyre sem könyv vagy dokumentum, sem mentett feladat
 * nem hivatkozik (pl. egy félbemaradt feltöltés maradéka). Az utolsó 24 órában feltöltött fájlokat
 * nem tekintjük gazdátlannak, mert egy éppen futó feltöltés is ilyen lehet.
 * Törölni csak a tanár jóváhagyásával lehet, és a szerver törlés előtt mindent újra ellenőriz.
 */
const FRISS_MS=24*60*60*1000;
const MAX_OBJEKTUM=20000;
type Objektum={key:string;size:number;modified:string|null};

async function hivatkozott(owner:string):Promise<Set<string>>{
 const sql=database();
 const out=new Set<string>();
 const docs=await sql`SELECT storage_key FROM os_documents WHERE owner_id=${owner} AND storage_key IS NOT NULL`;
 for(const d of docs)out.add(String(d.storage_key));
 try{
  const tasks=await sql`SELECT image_key FROM os_tasks WHERE owner_id=${owner} AND image_key IS NOT NULL`;
  for(const t of tasks)out.add(String(t.image_key));
 }catch(e){if(!schemaMissing(e))throw e}
 return out;
}

async function listaz(prefix:string):Promise<{lista:Objektum[];csonka:boolean}>{
 const client=s3(),Bucket=bucket();
 const lista:Objektum[]=[];let token:string|undefined;
 do{
  const r=await client.send(new ListObjectsV2Command({Bucket,Prefix:prefix,ContinuationToken:token,MaxKeys:1000}));
  for(const o of r.Contents||[])if(o.Key)lista.push({key:o.Key,size:Number(o.Size||0),modified:o.LastModified?o.LastModified.toISOString():null});
  token=r.IsTruncated?r.NextContinuationToken:undefined;
 }while(token&&lista.length<MAX_OBJEKTUM);
 return {lista,csonka:!!token};
}

function gazdatlan(o:Objektum,ref:Set<string>,most:number){
 if(ref.has(o.key))return false;
 const ido=o.modified?Date.parse(o.modified):NaN;
 return Number.isFinite(ido)&&most-ido>FRISS_MS;
}

export async function GET(req:NextRequest){
 try{
  const owner=await ownerFromRequest(req);
  const prefix=owner.replace(/[^A-Za-z0-9_-]/g,'_')+'/';
  const [{lista,csonka},ref]=await Promise.all([listaz(prefix),hivatkozott(owner)]);
  const most=Date.now();
  const arvak=lista.filter(o=>gazdatlan(o,ref,most)).map(o=>({...o,name:o.key.slice(prefix.length)}));
  return Response.json({
   osszes:{db:lista.length,bajt:lista.reduce((n,o)=>n+o.size,0)},
   gazdatlan:{db:arvak.length,bajt:arvak.reduce((n,o)=>n+o.size,0),lista:arvak},
   csonka
  },{headers:{'Cache-Control':'no-store'}});
 }catch(e){
  if(e instanceof Error&&e.message==='Storage not configured')return Response.json({error:'A tárhely nincs beállítva.'},{status:503});
  return apiError(e);
 }
}

/** Törlés: csak a kért és most is gazdátlan fájlok. */
export async function POST(req:NextRequest){
 try{
  const owner=await ownerFromRequest(req),b=await req.json();
  const prefix=owner.replace(/[^A-Za-z0-9_-]/g,'_')+'/';
  if(!Array.isArray(b?.keys)||!b.keys.length||b.keys.length>500)throw Error('INVALID');
  const kert=new Set<string>();
  for(const k of b.keys){
   if(typeof k!=='string'||!k.startsWith(prefix)||k.length>600||k.includes('..'))throw Error('INVALID');
   kert.add(k);
  }
  const [{lista},ref]=await Promise.all([listaz(prefix),hivatkozott(owner)]);
  const most=Date.now();
  const torolheto=lista.filter(o=>kert.has(o.key)&&gazdatlan(o,ref,most));
  const client=s3(),Bucket=bucket();
  let torolve=0,bajt=0;
  for(const o of torolheto){
   await client.send(new DeleteObjectCommand({Bucket,Key:o.key}));
   torolve++;bajt+=o.size;
  }
  return Response.json({torolve,bajt,kihagyva:kert.size-torolve});
 }catch(e){return apiError(e)}
}
