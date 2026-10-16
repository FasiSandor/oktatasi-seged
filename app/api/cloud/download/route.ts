import {NextRequest} from 'next/server';
import {GetObjectCommand,HeadObjectCommand} from '@aws-sdk/client-s3';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';
import {database,ownerFromRequest,s3,bucket,apiError} from '../../../../lib/server';
export const runtime='nodejs';
export async function GET(request:NextRequest){
 try{const owner=await ownerFromRequest(request),id=request.nextUrl.searchParams.get('id');if(!id||!/^[0-9a-f-]{36}$/i.test(id))throw Error('INVALID');
 const sql=database();const rows=await sql`SELECT storage_key,state FROM os_documents WHERE id=${id} AND owner_id=${owner}`;if(rows.length!==1||!rows[0].storage_key)throw Error('FORBIDDEN');
 const storage=s3();const key=String(rows[0].storage_key);
 await storage.send(new HeadObjectCommand({Bucket:bucket(),Key:key}));
 const url=await getSignedUrl(storage,new GetObjectCommand({Bucket:bucket(),Key:key}),{expiresIn:180});
 return Response.json({url,expiresIn:180})}catch(e){return apiError(e)}
}
