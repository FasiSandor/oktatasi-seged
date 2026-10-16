import {NextRequest} from 'next/server';
import {PutObjectCommand} from '@aws-sdk/client-s3';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';
import {database,ownerFromRequest,s3,bucket,apiError} from '../../../../lib/server';
export const runtime='nodejs';
export async function GET(request:NextRequest){
 let owner:string;
 try{owner=await ownerFromRequest(request)}catch(error){return apiError(error)}
 try{
  const sql=database();
  await sql`SELECT 1 AS ok`;
 }catch(error){
  console.error('Preflight database failure',error);
  return Response.json({error:'Az adatbázis-kapcsolat nem működik.',code:'DATABASE_UNAVAILABLE'},{status:503});
 }
 try{
  const key=owner.replace(/[^A-Za-z0-9_-]/g,'_')+'/preflight-'+crypto.randomUUID();
  const url=await getSignedUrl(s3(),new PutObjectCommand({Bucket:bucket(),Key:key,ContentType:'application/pdf'}),{expiresIn:60});
  if(!url.startsWith('https://'))throw Error('Invalid upload URL');
 }catch(error){
  console.error('Preflight storage signing failure',error);
  return Response.json({error:'A tárhely aláírt feltöltési hivatkozása nem készíthető el.',code:'STORAGE_CONFIG_FAILED'},{status:503});
 }
 // Signing a URL does not confirm that the remote storage accepts a PUT.
 return Response.json({auth:true,database:true,storageSigning:true,storageTransferTested:false});
}
