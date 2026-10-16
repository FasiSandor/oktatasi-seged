import {NextRequest} from 'next/server';
import {CreateMultipartUploadCommand,UploadPartCommand,CompleteMultipartUploadCommand,AbortMultipartUploadCommand,HeadObjectCommand} from '@aws-sdk/client-s3';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';
import {database,ownerFromRequest,s3,bucket,apiError} from '../../../../lib/server';
export const runtime='nodejs';
const valid=(x:unknown):x is string=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const maxBytes=250*1024*1024,partSize=8*1024*1024;
export async function POST(req:NextRequest){
 try{const owner=await ownerFromRequest(req),body=await req.json(),action=body?.action;
 const sql=database();
 if(action==='start'){
  if(typeof body.filename!=='string'||!body.filename.trim()||body.filename.length>240||body.mimeType!=='application/pdf'||!Number.isSafeInteger(body.size)||body.size<partSize||body.size>maxBytes)throw Error('INVALID');
  const id=crypto.randomUUID(),key=owner.replace(/[^a-z0-9_-]/gi,'_')+'/'+id;
  const client=s3();
  const session=await client.send(new CreateMultipartUploadCommand({Bucket:bucket(),Key:key,ContentType:body.mimeType}));
  if(!session.UploadId)throw Error('Storage initiation failed');
  try{
   await sql`INSERT INTO os_documents(id,owner_id,title,filename,mime_type,byte_size,storage_key,state) VALUES(${id},${owner},${body.filename},${body.filename},${body.mimeType},${body.size},${key},'pending')`;
  }catch(error){
   await client.send(new AbortMultipartUploadCommand({Bucket:bucket(),Key:key,UploadId:session.UploadId})).catch(()=>{});
   throw error;
  }
  return Response.json({documentId:id,uploadId:session.UploadId,partSize});
 }
 if(!valid(body?.documentId)||typeof body?.uploadId!=='string'||body.uploadId.length>500)throw Error('INVALID');
 const rows=await sql`SELECT storage_key,byte_size,mime_type,state FROM os_documents WHERE id=${body.documentId} AND owner_id=${owner}`;
 if(rows.length!==1||rows[0].state!=='pending'||!rows[0].storage_key)throw Error('FORBIDDEN');
 const key=String(rows[0].storage_key),client=s3(),Bucket=bucket();
 if(action==='part'){
  const count=Math.ceil(Number(rows[0].byte_size)/partSize);
  if(!Number.isInteger(body.number)||body.number<1||body.number>count)throw Error('INVALID');
  const url=await getSignedUrl(client,new UploadPartCommand({Bucket,Key:key,UploadId:body.uploadId,PartNumber:body.number}),{expiresIn:900});
  return Response.json({url,number:body.number});
 }
 if(action==='finish'){
  const count=Math.ceil(Number(rows[0].byte_size)/partSize);
  if(!Array.isArray(body.parts)||body.parts.length!==count||body.parts.some((p:unknown,i:number)=>{if(!p||typeof p!=='object')return true;const v=p as {ETag?:unknown;PartNumber?:unknown};return v.PartNumber!==i+1||typeof v.ETag!=='string'||v.ETag.length>200||!v.ETag}))throw Error('INVALID');
  await client.send(new CompleteMultipartUploadCommand({Bucket,Key:key,UploadId:body.uploadId,MultipartUpload:{Parts:body.parts}}));
  const object=await client.send(new HeadObjectCommand({Bucket,Key:key}));
  if(Number(object.ContentLength)!==Number(rows[0].byte_size))throw Error('INVALID');
  await sql`UPDATE os_documents SET state='ready' WHERE id=${body.documentId} AND owner_id=${owner} AND state='pending'`;
  return Response.json({success:true});
 }
 if(action==='abort'){
  await client.send(new AbortMultipartUploadCommand({Bucket,Key:key,UploadId:body.uploadId}));
  await sql`UPDATE os_documents SET state='failed' WHERE id=${body.documentId} AND owner_id=${owner} AND state='pending'`;
  return Response.json({aborted:true});
 }
 throw Error('INVALID');
 }catch(e){return apiError(e)}
}
