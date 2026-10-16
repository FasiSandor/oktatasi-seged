import {NextRequest} from 'next/server';
import {HeadObjectCommand} from '@aws-sdk/client-s3';
import {database,ownerFromRequest,s3,bucket,apiError} from '../../../../../lib/server';
export const runtime='nodejs';
export async function POST(request:NextRequest){
 try{const owner=await ownerFromRequest(request),b=await request.json();if(typeof b.documentId!=='string'||!/^[0-9a-f-]{36}$/i.test(b.documentId))throw Error('INVALID');
 const sql=database();const rows=await sql`SELECT storage_key,byte_size,mime_type,state FROM os_documents WHERE id=${b.documentId} AND owner_id=${owner}`;
 if(rows.length!==1||rows[0].state!=='pending')throw Error('FORBIDDEN');
 const info=await s3().send(new HeadObjectCommand({Bucket:bucket(),Key:String(rows[0].storage_key)}));
 if(Number(info.ContentLength)!==Number(rows[0].byte_size)||info.ContentType!==rows[0].mime_type)throw Error('INVALID');
 await sql`UPDATE os_documents SET state='ready' WHERE id=${b.documentId} AND owner_id=${owner} AND state='pending'`;
 return Response.json({success:true})}catch(e){return apiError(e)}
}
