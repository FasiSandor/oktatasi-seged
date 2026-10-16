import {NextRequest} from 'next/server';
import {PutObjectCommand} from '@aws-sdk/client-s3';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';
import {database,ownerFromRequest,s3,bucket,apiError} from '../../../../lib/server';
export const runtime='nodejs';
const allowed=new Set(['application/pdf','image/jpeg','image/png','image/webp','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.presentationml.presentation']);
export async function POST(request:NextRequest){
 try{const owner=await ownerFromRequest(request);const b=await request.json();
 if(typeof b.filename!=='string'||b.filename.length>240||!b.filename.trim()||!allowed.has(b.mimeType)||!Number.isSafeInteger(b.size)||b.size<=0||b.size>250*1024*1024)throw Error('INVALID');
 const id=crypto.randomUUID(),key=owner.replace(/[^A-Za-z0-9_-]/g,'_')+'/'+id,sql=database();
 const rows=await sql`INSERT INTO os_documents(id,owner_id,title,filename,mime_type,byte_size,storage_key,state) VALUES(${id},${owner},${b.filename},${b.filename},${b.mimeType},${b.size},${key},'pending') RETURNING id`;
 try{const command=new PutObjectCommand({Bucket:bucket(),Key:key,ContentType:b.mimeType});const uploadUrl=await getSignedUrl(s3(),command,{expiresIn:300});return Response.json({documentId:rows[0].id,uploadUrl,expiresIn:300})}catch(e){await sql`UPDATE os_documents SET state='failed' WHERE id=${id} AND owner_id=${owner}`;throw e}
 }catch(e){return apiError(e)}
}
