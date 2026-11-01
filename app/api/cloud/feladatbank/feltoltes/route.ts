import {NextRequest} from 'next/server';
import {PutObjectCommand} from '@aws-sdk/client-s3';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';
import {ownerFromRequest,apiError} from '../../../../../lib/server';
import {fbDatabase,fbS3,fbBucket,fbHiba} from '../../../../../lib/feladatbank/server';
import {azonosit,type Oldalak} from '../../../../../lib/feladatbank/felismeres';
export const runtime='nodejs';

/**
 * Egy érettségi PDF feltöltésének első lépése. A böngésző elküldi a fájl adatait és a kiolvasott
 * szöveget; a szerver maga is felismeri (a tartalom dönt), ellenőrzi, hogy nincs-e már fent,
 * és ad egy rövid életű feltöltési címet a tárhelyre.
 */
export async function POST(req:NextRequest){
 try{
  const owner=await ownerFromRequest(req),b=await req.json();
  const fajlnev=typeof b.fajlnev==='string'?b.fajlnev.trim().slice(0,200):'';
  if(!fajlnev||!/\.pdf$/i.test(fajlnev)||!Number.isSafeInteger(b.byteSize)||b.byteSize<=0||b.byteSize>40*1024*1024)throw Error('INVALID');
  if(typeof b.sha256!=='string'||!/^[0-9a-f]{64}$/.test(b.sha256))throw Error('INVALID');
  const oldalak=b.oldalak as Oldalak;
  if(!Array.isArray(oldalak)||!oldalak.length||oldalak.length>80||!oldalak.every(p=>Array.isArray(p)&&p.length<=400&&p.every(s=>typeof s==='string'&&s.length<=2000)))throw Error('INVALID');
  const az=azonosit(oldalak,fajlnev);
  if(!az.tipus||!az.szint||!az.datum)return Response.json({error:'Nem sikerült felismerni a lapot ('+az.figyelmeztetesek.join(' ')+'). Biztosan matematika érettségi feladatlap vagy útmutató?',felismert:az},{status:422});

  const sql=fbDatabase();
  const dup=await sql`SELECT f.id,v.ev,v.honap,v.szint FROM fb_fajlok f LEFT JOIN fb_vizsgak v ON v.id=f.vizsga_id WHERE f.sha256=${b.sha256} AND f.allapot='kesz' LIMIT 1`;
  if(dup.length)return Response.json({duplikalt:true,felismert:az});
  const meglevo=await sql`SELECT f.id FROM fb_fajlok f JOIN fb_vizsgak v ON v.id=f.vizsga_id
   WHERE v.szint=${az.szint} AND v.datum=${az.datum} AND f.tipus=${az.tipus} AND f.allapot='kesz' LIMIT 1`;
  if(meglevo.length&&b.csere!==true)return Response.json({letezik:true,felismert:az});

  const id=crypto.randomUUID();
  const key='lapok/'+az.ev+'/'+az.szint+'/'+id+'.pdf';
  await sql`INSERT INTO fb_fajlok(id,tipus,fajlnev,byte_size,sha256,storage_key,oldalszam,szoveg,felismert,feltoltotte)
   VALUES(${id},${az.tipus},${fajlnev},${b.byteSize},${b.sha256},${key},${oldalak.length},${JSON.stringify(oldalak)}::jsonb,${JSON.stringify(az)}::jsonb,${owner})`;
  const uploadUrl=await getSignedUrl(fbS3(),new PutObjectCommand({Bucket:fbBucket(),Key:key,ContentType:'application/pdf'}),{expiresIn:900});
  return Response.json({fajlId:id,uploadUrl,felismert:az});
 }catch(e){return fbHiba(e)||apiError(e)}
}
