import {NextRequest} from 'next/server';
import {DeleteObjectCommand} from '@aws-sdk/client-s3';
import {database,ownerFromRequest,s3,bucket,apiError,schemaMissing,isUuid} from '../../../../lib/server';
export const runtime='nodejs';
export const maxDuration=60;

/**
 * Lomtár. A törölt könyv (vagy jegyzet) állapota 'archived' lesz: mindenhonnan eltűnik
 * (Könyvtár, témaoldalak, kereső, Feladataim), de 30 napig visszahozható.
 * Végleges törléskor minden vele együtt megy: a párosítások, a kiemelések, a cetlik,
 * a tollrajzok, az olvasási hely, a belőle mentett feladatok (a képükkel), és maga a fájl.
 */
const NAPOK=30;
const NINCS_SEMA='Ehhez előbb le kell futtatni a 011-es adatbázis-frissítést (lomtár).';

type Sql=ReturnType<typeof database>;

/** Véglegesen töröl egy lomtárban lévő könyvet. Csak 'archived' állapotút. */
async function vegleges(sql:Sql,owner:string,id:string):Promise<boolean>{
 const docs=await sql`SELECT storage_key FROM os_documents WHERE id=${id} AND owner_id=${owner} AND state='archived'`;
 if(!docs.length)return false;
 let kepek:string[]=[];
 try{
  const t=await sql`DELETE FROM os_tasks WHERE owner_id=${owner} AND document_id=${id} RETURNING image_key`;
  kepek=t.map(r=>r.image_key).filter((k):k is string=>typeof k==='string'&&!!k);
 }catch(e){if(!schemaMissing(e))throw e}
 // A párosítások, cetlik, kiemelések, tollrajzok és az olvasási hely az adatbázisban a könyvvel együtt törlődnek.
 const del=await sql`DELETE FROM os_documents WHERE id=${id} AND owner_id=${owner} AND state='archived' RETURNING id`;
 if(!del.length)return false;
 // A fájlokat az adatbázis után töröljük; ha ez elakad, a Tárhely-takarítás később megtalálja a maradékot.
 const kulcsok=[docs[0].storage_key,...kepek].filter((k):k is string=>typeof k==='string'&&!!k);
 try{
  const client=s3(),Bucket=bucket();
  for(const Key of kulcsok)await client.send(new DeleteObjectCommand({Bucket,Key}));
 }catch{/* a fájl maradéka gazdátlan lesz, a Tárhely-takarítás elviszi */}
 return true;
}

export async function GET(req:NextRequest){
 try{
  const owner=await ownerFromRequest(req),sql=database();
  try{
   // A 30 napnál régebben törölt könyvek véglegesen törlődnek (adagonként, hogy beleférjen az időbe).
   const lejart=await sql`SELECT id FROM os_documents WHERE owner_id=${owner} AND state='archived' AND archived_at < now()-${NAPOK}::int*interval '1 day' ORDER BY archived_at LIMIT 20`;
   for(const r of lejart)await vegleges(sql,owner,String(r.id));
   const items=await sql`
    SELECT d.id,d.title,d.filename,d.mime_type,d.byte_size,d.archived_at,
     (SELECT count(*)::int FROM os_document_links l WHERE l.document_id=d.id AND l.owner_id=${owner}) AS link_count
    FROM os_documents d WHERE d.owner_id=${owner} AND d.state='archived' ORDER BY d.archived_at DESC NULLS LAST`;
   return Response.json({items,napok:NAPOK,schemaReady:true},{headers:{'Cache-Control':'no-store'}});
  }catch(e){
   if(!schemaMissing(e))throw e;
   return Response.json({items:[],napok:NAPOK,schemaReady:false});
  }
 }catch(e){return apiError(e)}
}

/** action: 'torles' (lomtárba), 'vissza' (visszahozás), 'vegleges' (egy könyv), 'urites' (az egész lomtár). */
export async function POST(req:NextRequest){
 try{
  const owner=await ownerFromRequest(req),b=await req.json(),sql=database();
  const action=b?.action;
  try{
   if(action==='torles'){
    if(!isUuid(b.id))throw Error('INVALID');
    const rows=await sql`UPDATE os_documents SET state='archived',archived_at=now() WHERE id=${b.id} AND owner_id=${owner} AND state='ready' RETURNING id`;
    if(!rows.length)throw Error('FORBIDDEN');
    return Response.json({ok:true,napok:NAPOK});
   }
   if(action==='vissza'){
    if(!isUuid(b.id))throw Error('INVALID');
    const rows=await sql`UPDATE os_documents SET state='ready',archived_at=NULL WHERE id=${b.id} AND owner_id=${owner} AND state='archived' RETURNING id`;
    if(!rows.length)throw Error('FORBIDDEN');
    return Response.json({ok:true});
   }
   if(action==='vegleges'){
    if(!isUuid(b.id))throw Error('INVALID');
    if(!await vegleges(sql,owner,b.id))throw Error('FORBIDDEN');
    return Response.json({torolve:1,maradt:0});
   }
   if(action==='urites'){
    const ids=await sql`SELECT id FROM os_documents WHERE owner_id=${owner} AND state='archived' ORDER BY archived_at LIMIT 40`;
    let torolve=0;
    for(const r of ids)if(await vegleges(sql,owner,String(r.id)))torolve++;
    const maradt=await sql`SELECT count(*)::int AS n FROM os_documents WHERE owner_id=${owner} AND state='archived'`;
    return Response.json({torolve,maradt:maradt[0].n});
   }
   throw Error('INVALID');
  }catch(e){
   if(schemaMissing(e))return Response.json({error:NINCS_SEMA},{status:409});
   throw e;
  }
 }catch(e){return apiError(e)}
}
