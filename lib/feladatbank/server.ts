import {neon} from '@neondatabase/serverless';
import {S3Client} from '@aws-sdk/client-s3';
import {bontFeladatlap,bontUtmutato,osszevet,type Oldalak,type Szint} from './felismeres';

/**
 * Az érettségi feladatbank külön Neon-projektben van (adatbázis és privát tárhely),
 * hogy később a TéFEL_APP is elérhesse, de az Oktatási Segéd adataihoz ne férjen hozzá.
 */
export function fbDatabase(){
 const url=process.env.FB_DATABASE_URL;
 if(!url)throw new Error('FB_NOT_CONFIGURED');
 return neon(url);
}
export function fbS3(){
 const endpoint=process.env.FB_S3_ENDPOINT,accessKeyId=process.env.FB_S3_ACCESS_KEY_ID,secretAccessKey=process.env.FB_S3_SECRET_ACCESS_KEY;
 if(!endpoint||!accessKeyId||!secretAccessKey)throw new Error('FB_NOT_CONFIGURED');
 return new S3Client({region:process.env.FB_S3_REGION||process.env.S3_REGION||'eu-central-1',endpoint,forcePathStyle:true,requestChecksumCalculation:'WHEN_REQUIRED',credentials:{accessKeyId,secretAccessKey}});
}
export function fbBucket(){return process.env.FB_S3_BUCKET||'erettsegi-feladatbank'}
export const fbBeallitva=()=>!!(process.env.FB_DATABASE_URL&&process.env.FB_S3_ENDPOINT&&process.env.FB_S3_ACCESS_KEY_ID&&process.env.FB_S3_SECRET_ACCESS_KEY);

/** Hibaválasz: a beállítatlan feladatbankot érthetően jelezzük. */
export function fbHiba(e:unknown){
 const message=e instanceof Error?e.message:'';
 if(message==='FB_NOT_CONFIGURED')return Response.json({error:'A feladatbank adatbázisa még nincs bekötve (a Vercel beállításaiban hiányoznak a FB_ kezdetű változók).',notConfigured:true},{status:503});
 return null;
}

/**
 * Egy lappár feladatokra bontása a mentett szövegből, és a feladatok mentése.
 * A kézzel javított besorolás megmarad, ha ugyanaz a feladat (sorszám + részfeladat) újra előjön.
 * Ha csak a feladatlap van meg, az útmutatós adatok üresek maradnak.
 */
export async function bontasMentese(vizsgaId:string){
 const sql=fbDatabase();
 const [v]=await sql`SELECT id,szint FROM fb_vizsgak WHERE id=${vizsgaId}`;
 if(!v)throw new Error('FORBIDDEN');
 const fajlok=await sql`SELECT tipus,szoveg FROM fb_fajlok WHERE vizsga_id=${vizsgaId} AND allapot='kesz'`;
 const fl=fajlok.find(f=>f.tipus==='fl'),ut=fajlok.find(f=>f.tipus==='ut');
 if(!fl){
  await sql`UPDATE fb_vizsgak SET allapot='hianyos',bontas_hibak=${JSON.stringify(['Hiányzik a feladatlap.'])}::jsonb,updated_at=now() WHERE id=${vizsgaId}`;
  return {feladatok:0,hibak:['Hiányzik a feladatlap.']};
 }
 const flBontas=bontFeladatlap(fl.szoveg as Oldalak,v.szint as Szint);
 const utBontas=ut?bontUtmutato(ut.szoveg as Oldalak,[...new Set(flBontas.sorok.map(s=>s.sorszam))]):null;
 const {sorok,hibak}=osszevet(flBontas,utBontas);
 if(!ut)hibak.push('Hiányzik a javítási útmutató.');

 const kulcsok=sorok.map(s=>s.sorszam+'|'+s.reszfeladat);
 for(const s of sorok){
  await sql`INSERT INTO fb_feladatok(vizsga_id,sorszam,reszfeladat,resz,sorrend,fl_oldal,ut_oldal,pont,bontas_megjegyzes)
   VALUES(${vizsgaId},${s.sorszam},${s.reszfeladat},${s.resz},${s.sorrend},${s.flOldal},${s.utOldal},${s.pont},${s.ellenorzes})
   ON CONFLICT(vizsga_id,sorszam,reszfeladat) DO UPDATE SET resz=EXCLUDED.resz,sorrend=EXCLUDED.sorrend,fl_oldal=EXCLUDED.fl_oldal,
    ut_oldal=EXCLUDED.ut_oldal,pont=EXCLUDED.pont,bontas_megjegyzes=EXCLUDED.bontas_megjegyzes,updated_at=now()`;
 }
 // Ami az új bontásban már nincs benne (pl. hibás régi bontás), törlődik, kivéve a kézzel javítottakat.
 const meglevo=await sql`SELECT id,sorszam,reszfeladat,kezzel FROM fb_feladatok WHERE vizsga_id=${vizsgaId}`;
 const torlendo=meglevo.filter(r=>!kulcsok.includes(r.sorszam+'|'+r.reszfeladat)&&!r.kezzel).map(r=>String(r.id));
 if(torlendo.length)await sql`DELETE FROM fb_feladatok WHERE id = ANY(${torlendo}::uuid[])`;
 await ellenorzesFrissites(vizsgaId);
 const besorolt=await sql`SELECT count(*)::int AS n FROM fb_feladatok WHERE vizsga_id=${vizsgaId} AND fo_kod IS NOT NULL`;
 const allapot=!ut?'hianyos':besorolt[0].n>=sorok.length&&sorok.length>0?'besorolva':'bontva';
 await sql`UPDATE fb_vizsgak SET allapot=${allapot},bontas_hibak=${JSON.stringify(hibak)}::jsonb,updated_at=now() WHERE id=${vizsgaId}`;
 return {feladatok:sorok.length,hibak};
}

/**
 * Az „Ellenőrizendő” jelölés újraszámolása: bontási gond, bizonytalan vagy hiányzó besorolás.
 * Ha egyszer jóváhagytam vagy kézzel javítottam, többé nem kerül a listára.
 */
export async function ellenorzesFrissites(vizsgaId:string){
 const sql=fbDatabase();
 await sql`UPDATE fb_feladatok SET ellenorizendo = NOT (jovahagyva OR kezzel) AND (
   cardinality(bontas_megjegyzes)>0 OR (fo_kod IS NOT NULL AND biztos IS FALSE) OR (ai_futott AND fo_kod IS NULL)
  ) WHERE vizsga_id=${vizsgaId}`;
}
