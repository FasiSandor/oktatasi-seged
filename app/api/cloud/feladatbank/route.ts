import {NextRequest} from 'next/server';
import {ownerFromRequest,apiError} from '../../../../lib/server';
import {fbDatabase,fbHiba,fbBeallitva} from '../../../../lib/feladatbank/server';
export const runtime='nodejs';

/**
 * A feladatbank áttekintése: a lappárok listája feladat- és ellenőrzési számokkal,
 * valamint (?ellenorizendo=1) az Ellenőrizendő lista.
 */
export async function GET(req:NextRequest){
 try{
  await ownerFromRequest(req);
  if(!fbBeallitva())return Response.json({notConfigured:true,vizsgak:[],ellenorizendo:[]});
  const sql=fbDatabase();
  if(req.nextUrl.searchParams.get('ellenorizendo')==='1'){
   const rows=await sql`SELECT f.id,f.vizsga_id,f.sorszam,f.reszfeladat,f.resz,f.pont,f.fl_oldal,f.ut_oldal,f.bontas_megjegyzes,
     f.fo_kod,f.mellek_kod,f.szoveges,f.megjegyzes,f.biztos,f.ai_futott,v.szint,v.ev,v.honap,v.datum
    FROM fb_feladatok f JOIN fb_vizsgak v ON v.id=f.vizsga_id
    WHERE f.ellenorizendo ORDER BY v.datum DESC,v.szint,f.sorrend LIMIT 500`;
   return Response.json({ellenorizendo:rows});
  }
  const vizsgak=await sql`SELECT v.id,v.szint,v.datum::text AS datum,v.ev,v.honap,v.vizsgakod,v.kovetelmeny,v.allapot,v.bontas_hibak,
    (SELECT count(*)::int FROM fb_feladatok f WHERE f.vizsga_id=v.id) AS feladatok,
    (SELECT count(*)::int FROM fb_feladatok f WHERE f.vizsga_id=v.id AND f.fo_kod IS NOT NULL) AS besorolt,
    (SELECT count(*)::int FROM fb_feladatok f WHERE f.vizsga_id=v.id AND f.ellenorizendo) AS ellenorizendo,
    (SELECT coalesce(sum(f.pont),0)::int FROM fb_feladatok f WHERE f.vizsga_id=v.id) AS pontok,
    EXISTS(SELECT 1 FROM fb_fajlok x WHERE x.vizsga_id=v.id AND x.tipus='fl' AND x.allapot='kesz') AS van_fl,
    EXISTS(SELECT 1 FROM fb_fajlok x WHERE x.vizsga_id=v.id AND x.tipus='ut' AND x.allapot='kesz') AS van_ut
   FROM fb_vizsgak v ORDER BY v.datum DESC,v.szint`;
  return Response.json({vizsgak});
 }catch(e){return fbHiba(e)||apiError(e)}
}
