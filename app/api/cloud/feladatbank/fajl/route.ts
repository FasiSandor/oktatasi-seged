import {NextRequest} from 'next/server';
import {GetObjectCommand} from '@aws-sdk/client-s3';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';
import {ownerFromRequest,apiError,isUuid} from '../../../../../lib/server';
import {fbDatabase,fbS3,fbBucket,fbHiba} from '../../../../../lib/feladatbank/server';
export const runtime='nodejs';

/** Rövid életű olvasási cím egy lappár feladatlapjához vagy útmutatójához. */
export async function GET(req:NextRequest){
 try{
  await ownerFromRequest(req);
  const vizsga=req.nextUrl.searchParams.get('vizsga'),tipus=req.nextUrl.searchParams.get('tipus');
  if(!isUuid(vizsga)||(tipus!=='fl'&&tipus!=='ut'))throw Error('INVALID');
  const [f]=await fbDatabase()`SELECT storage_key,oldalszam FROM fb_fajlok WHERE vizsga_id=${vizsga} AND tipus=${tipus} AND allapot='kesz'`;
  if(!f)return Response.json({error:tipus==='ut'?'Ehhez a laphoz még nincs feltöltve az útmutató.':'Ehhez a laphoz még nincs feltöltve a feladatlap.'},{status:404});
  const url=await getSignedUrl(fbS3(),new GetObjectCommand({Bucket:fbBucket(),Key:String(f.storage_key)}),{expiresIn:3600});
  return Response.json({url,oldalszam:f.oldalszam});
 }catch(e){return fbHiba(e)||apiError(e)}
}
