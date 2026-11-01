import {NextRequest} from 'next/server';
import {ownerFromRequest,apiError,isUuid} from '../../../../../lib/server';
import {fbDatabase,fbHiba,bontasMentese} from '../../../../../lib/feladatbank/server';
export const runtime='nodejs';
export const maxDuration=60;

/** Egy lappár adatai a feladatokkal és az AI-hívások naplójával. */
export async function GET(req:NextRequest){
 try{
  await ownerFromRequest(req);
  const id=req.nextUrl.searchParams.get('id');
  if(!isUuid(id))throw Error('INVALID');
  const sql=fbDatabase();
  const [vizsga]=await sql`SELECT id,szint,datum::text AS datum,ev,honap,vizsgakod,kovetelmeny,allapot,bontas_hibak FROM fb_vizsgak WHERE id=${id}`;
  if(!vizsga)throw Error('FORBIDDEN');
  const [feladatok,fajlok,naplo]=await Promise.all([
   sql`SELECT id,sorszam,reszfeladat,resz,sorrend,fl_oldal,ut_oldal,pont,bontas_megjegyzes,fo_kod,mellek_kod,szoveges,megjegyzes,biztos,ai_fo_kod,ai_futott,jovahagyva,kezzel,ellenorizendo
    FROM fb_feladatok WHERE vizsga_id=${id} ORDER BY sorrend,sorszam,reszfeladat`,
   sql`SELECT tipus,fajlnev,oldalszam,byte_size,created_at FROM fb_fajlok WHERE vizsga_id=${id} AND allapot='kesz'`,
   sql`SELECT resz,modell,gondolkodas,mp,bemenet,kimenet,gondolat,ok,hiba,created_at FROM fb_besorolasok WHERE vizsga_id=${id} ORDER BY created_at DESC LIMIT 12`
  ]);
  return Response.json({vizsga,feladatok,fajlok,naplo});
 }catch(e){return fbHiba(e)||apiError(e)}
}

/** Újrabontás a mentett szövegből (pl. egy felismerési javítás után). A besorolás megmarad. */
export async function POST(req:NextRequest){
 try{
  await ownerFromRequest(req);
  const b=await req.json();
  if(!isUuid(b.id)||b.muvelet!=='ujrabontas')throw Error('INVALID');
  return Response.json(await bontasMentese(b.id));
 }catch(e){return fbHiba(e)||apiError(e)}
}
