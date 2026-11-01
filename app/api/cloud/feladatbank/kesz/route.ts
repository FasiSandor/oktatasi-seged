import {NextRequest} from 'next/server';
import {HeadObjectCommand} from '@aws-sdk/client-s3';
import {ownerFromRequest,apiError,isUuid} from '../../../../../lib/server';
import {fbDatabase,fbS3,fbBucket,fbHiba,bontasMentese} from '../../../../../lib/feladatbank/server';
import type {Azonositas} from '../../../../../lib/feladatbank/felismeres';
export const runtime='nodejs';
export const maxDuration=60;

/**
 * A feltöltés lezárása: ellenőrzi, hogy a fájl tényleg a tárhelyen van, a lappárhoz köti
 * (ha még nincs ilyen vizsga, létrehozza), és ha a feladatlap megvan, feladatokra bontja.
 * Cserénél a régi fájl „csere” állapotba kerül, a besorolás javításai megmaradnak.
 */
export async function POST(req:NextRequest){
 try{
  await ownerFromRequest(req);
  const b=await req.json();
  if(!isUuid(b.fajlId))throw Error('INVALID');
  const sql=fbDatabase();
  const [f]=await sql`SELECT id,tipus,storage_key,byte_size,felismert,allapot FROM fb_fajlok WHERE id=${b.fajlId}`;
  if(!f||f.allapot!=='feltoltes')throw Error('FORBIDDEN');
  const info=await fbS3().send(new HeadObjectCommand({Bucket:fbBucket(),Key:String(f.storage_key)}));
  if(Number(info.ContentLength)!==Number(f.byte_size))throw Error('INVALID');

  const az=f.felismert as Azonositas;
  const [v]=await sql`INSERT INTO fb_vizsgak(szint,datum,ev,honap,vizsgakod,kovetelmeny)
   VALUES(${az.szint},${az.datum},${az.ev},${az.honap},${az.vizsgakod},${az.kovetelmeny})
   ON CONFLICT(szint,datum) DO UPDATE SET vizsgakod=coalesce(fb_vizsgak.vizsgakod,EXCLUDED.vizsgakod),
    kovetelmeny=coalesce(fb_vizsgak.kovetelmeny,EXCLUDED.kovetelmeny),updated_at=now()
   RETURNING id`;
  await sql`UPDATE fb_fajlok SET allapot='csere' WHERE vizsga_id=${v.id} AND tipus=${f.tipus} AND allapot='kesz'`;
  await sql`UPDATE fb_fajlok SET allapot='kesz',vizsga_id=${v.id} WHERE id=${f.id}`;
  const bontas=await bontasMentese(String(v.id));
  return Response.json({vizsgaId:v.id,...bontas});
 }catch(e){return fbHiba(e)||apiError(e)}
}
