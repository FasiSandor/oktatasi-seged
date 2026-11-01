import {NextRequest} from 'next/server';
import {ownerFromRequest,apiError,isUuid} from '../../../../../lib/server';
import {fbDatabase,fbHiba,ellenorzesFrissites} from '../../../../../lib/feladatbank/server';
import {letezoKod} from '../../../../../lib/feladatbank/temak';
export const runtime='nodejs';

/**
 * Egy feladat besorolásának jóváhagyása vagy javítása.
 * - jovahagy: a mostani javaslat jó, lekerül az Ellenőrizendő listáról
 * - foKod / mellekKod / szoveges: kézi javítás (ez is lekerül a listáról, és újrabontásnál megmarad)
 */
export async function PATCH(req:NextRequest){
 try{
  await ownerFromRequest(req);
  const b=await req.json();
  if(!isUuid(b.id))throw Error('INVALID');
  const sql=fbDatabase();
  const [f]=await sql`SELECT id,vizsga_id,fo_kod FROM fb_feladatok WHERE id=${b.id}`;
  if(!f)throw Error('FORBIDDEN');
  if(b.jovahagy===true){
   await sql`UPDATE fb_feladatok SET jovahagyva=true,updated_at=now() WHERE id=${f.id}`;
  }else{
   const fo=b.foKod===undefined?f.fo_kod:b.foKod;
   if(!letezoKod(fo))throw Error('INVALID');
   const mellek=b.mellekKod===undefined?undefined:(b.mellekKod===null||b.mellekKod===''?null:b.mellekKod);
   if(mellek!==undefined&&mellek!==null&&!letezoKod(mellek))throw Error('INVALID');
   const szoveges=typeof b.szoveges==='boolean'?b.szoveges:undefined;
   await sql`UPDATE fb_feladatok SET fo_kod=${fo},
     mellek_kod=CASE WHEN ${mellek===undefined} THEN mellek_kod ELSE ${mellek??null} END,
     szoveges=coalesce(${szoveges??null}::boolean,szoveges),
     kezzel=true,biztos=true,updated_at=now() WHERE id=${f.id}`;
  }
  await ellenorzesFrissites(String(f.vizsga_id));
  await sql`UPDATE fb_vizsgak v SET allapot='besorolva',updated_at=now() WHERE v.id=${f.vizsga_id} AND v.allapot='bontva'
   AND NOT EXISTS(SELECT 1 FROM fb_feladatok x WHERE x.vizsga_id=v.id AND x.fo_kod IS NULL)`;
  const [uj]=await sql`SELECT id,fo_kod,mellek_kod,szoveges,biztos,jovahagyva,kezzel,ellenorizendo FROM fb_feladatok WHERE id=${f.id}`;
  return Response.json({feladat:uj});
 }catch(e){return fbHiba(e)||apiError(e)}
}
