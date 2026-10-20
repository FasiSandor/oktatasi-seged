import {NextRequest} from 'next/server';
import {DeleteObjectCommand,GetObjectCommand,PutObjectCommand} from '@aws-sdk/client-s3';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';
import {database,ownerFromRequest,apiError,schemaMissing,isUuid,s3,bucket} from '../../../../lib/server';
export const runtime='nodejs';

const PENDING={error:'A mentett feladatokhoz előbb le kell futtatni a 010-es adatbázis-frissítést.'};
const MODES=['hint','steps','similar'];

async function withImages(rows:Record<string,unknown>[]){
 const storage=s3();
 return Promise.all(rows.map(async r=>({...r,image_url:r.image_key?await getSignedUrl(storage,new GetObjectCommand({Bucket:bucket(),Key:String(r.image_key)}),{expiresIn:3600}):null,image_key:undefined})));
}

/** Mentett feladatok: egy téma (és altémái) szerint, vagy mind. */
export async function GET(req:NextRequest){
 try{
  const owner=await ownerFromRequest(req),sql=database(),topicId=req.nextUrl.searchParams.get('topicId');
  if(topicId!==null&&!isUuid(topicId))throw Error('INVALID');
  try{
   const rows=topicId
    ?await sql`
     WITH RECURSIVE tree AS (
      SELECT id,0 AS depth FROM os_topics WHERE id=${topicId} AND owner_id=${owner}
      UNION ALL SELECT c.id,tree.depth+1 FROM os_topics c JOIN tree ON c.parent_id=tree.id WHERE c.owner_id=${owner} AND tree.depth<6
     )
     SELECT k.id,k.topic_id,t.name AS topic_name,k.document_id,d.title AS document_title,d.filename AS document_filename,k.pdf_page,k.image_key,k.mode,k.answer,k.note,k.created_at
     FROM os_tasks k JOIN tree ON tree.id=k.topic_id LEFT JOIN os_topics t ON t.id=k.topic_id LEFT JOIN os_documents d ON d.id=k.document_id AND d.owner_id=${owner}
     WHERE k.owner_id=${owner} ORDER BY k.created_at DESC LIMIT 100`
    :await sql`
     SELECT k.id,k.topic_id,t.name AS topic_name,COALESCE(t.subject_id,d.subject_id) AS subject_id,k.document_id,d.title AS document_title,d.filename AS document_filename,k.pdf_page,k.image_key,k.mode,k.answer,k.note,k.created_at
     FROM os_tasks k LEFT JOIN os_topics t ON t.id=k.topic_id LEFT JOIN os_documents d ON d.id=k.document_id AND d.owner_id=${owner}
     WHERE k.owner_id=${owner} ORDER BY k.created_at DESC LIMIT 500`;
   return Response.json({tasks:await withImages(rows),schemaReady:true});
  }catch(e){
   if(!schemaMissing(e))throw e;
   return Response.json({tasks:[],schemaReady:false});
  }
 }catch(e){return apiError(e)}
}

/** Új mentett feladat: a bekeretezett kép a privát tárhelyre, a válasz az adatbázisba. */
export async function POST(req:NextRequest){
 try{
  const owner=await ownerFromRequest(req),b=await req.json(),sql=database();
  if(!MODES.includes(b?.mode)||typeof b.answer!=='string'||!b.answer.trim()||b.answer.length>20000)throw Error('INVALID');
  if(typeof b.image!=='string'||b.image.length<100||b.image.length>1_800_000||!/^[A-Za-z0-9+/=]+$/.test(b.image))throw Error('INVALID');
  if((b.topicId!=null&&!isUuid(b.topicId))||(b.documentId!=null&&!isUuid(b.documentId)))throw Error('INVALID');
  const page=b.page==null?null:Number(b.page);
  if(page!==null&&(!Number.isInteger(page)||page<1||page>100000))throw Error('INVALID');
  const note=typeof b.note==='string'?b.note.trim().slice(0,2000):'';
  const id=crypto.randomUUID();
  const key=owner.replace(/[^A-Za-z0-9_-]/g,'_')+'/feladatok/'+id+'.jpg';
  try{
   // Előbb az adatbázis (ha a 010 hiányzik, ne kerüljön árva kép a tárhelyre).
   const rows=await sql`
    INSERT INTO os_tasks(id,owner_id,topic_id,document_id,pdf_page,image_key,mode,answer,note)
    SELECT ${id}::uuid,${owner},t.id,d.id,${page},${key},${b.mode},${b.answer.trim()},${note}
    FROM (SELECT 1) x
     LEFT JOIN os_topics t ON t.id=${b.topicId??null}::uuid AND t.owner_id=${owner}
     LEFT JOIN os_documents d ON d.id=${b.documentId??null}::uuid AND d.owner_id=${owner}
    RETURNING id`;
   try{
    await s3().send(new PutObjectCommand({Bucket:bucket(),Key:key,Body:Buffer.from(b.image,'base64'),ContentType:'image/jpeg'}));
   }catch(e){await sql`DELETE FROM os_tasks WHERE id=${id}::uuid AND owner_id=${owner}`;throw e}
   return Response.json({task:{id:rows[0].id}},{status:201});
  }catch(e){if(schemaMissing(e))return Response.json(PENDING,{status:409});throw e}
 }catch(e){return apiError(e)}
}

/** Saját megjegyzés módosítása. */
export async function PATCH(req:NextRequest){
 try{
  const owner=await ownerFromRequest(req),b=await req.json();
  if(!isUuid(b?.id)||typeof b.note!=='string'||b.note.length>2000)throw Error('INVALID');
  const rows=await database()`UPDATE os_tasks SET note=${b.note.trim()} WHERE id=${b.id} AND owner_id=${owner} RETURNING id`;
  if(!rows.length)throw Error('FORBIDDEN');
  return Response.json({updated:true});
 }catch(e){return apiError(e)}
}

/** Törlés a képpel együtt. */
export async function DELETE(req:NextRequest){
 try{
  const owner=await ownerFromRequest(req),id=req.nextUrl.searchParams.get('id');
  if(!isUuid(id))throw Error('INVALID');
  const rows=await database()`DELETE FROM os_tasks WHERE id=${id} AND owner_id=${owner} RETURNING image_key`;
  if(!rows.length)throw Error('FORBIDDEN');
  if(rows[0].image_key){try{await s3().send(new DeleteObjectCommand({Bucket:bucket(),Key:String(rows[0].image_key)}))}catch{/* a kép később is törölhető */}}
  return Response.json({deleted:true});
 }catch(e){return apiError(e)}
}
