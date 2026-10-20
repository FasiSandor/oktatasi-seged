import {NextRequest} from 'next/server';
import {ownerFromRequest,apiError} from '../../../../lib/server';
import {keresoElemek,type KeresoElem} from '../../../../lib/kereses-adat';
import {elokeszit,pontoz,reszlet} from '../../../../lib/kereses';
export const runtime='nodejs';

/** Hány találat jöhet egy-egy fajtából, hogy a lista áttekinthető maradjon. */
const KERET:Record<KeresoElem['kind'],number>={topic:8,chapter:14,doc:5,lesson:6,task:6,note:6,video:5};
const ELONY:Record<KeresoElem['kind'],number>={topic:4,chapter:3,doc:2,lesson:1,task:0,note:0,video:0};

/**
 * Keresés mindenben: témakörök, altémák, könyvek, a könyvek fejezetei (tartalomjegyzék),
 * cetlik, mentett feladatok, tanmenet, videók. Ékezet- és elírástűrő.
 */
export async function GET(req:NextRequest){
 try{
  const owner=await ownerFromRequest(req);
  const query=(req.nextUrl.searchParams.get('q')||'').trim();
  if(query.length<2||query.length>120)throw Error('INVALID');
  const kerdes=elokeszit(query);
  if(!kerdes.szavak.length)return Response.json({hits:[]});
  const elemek=await keresoElemek(owner);
  const pontozott=elemek.map(e=>{
   const p=Math.max(pontoz(kerdes,elokeszit(e.cim)),e.szoveg?pontoz(kerdes,elokeszit(e.szoveg))-8:0);
   return {e,p};
  }).filter(x=>x.p>=40).sort((a,b)=>(b.p+ELONY[b.e.kind])-(a.p+ELONY[a.e.kind]));
  const db:Partial<Record<KeresoElem['kind'],number>>={};
  const hits=[];
  for(const {e,p} of pontozott){
   const n=db[e.kind]||0;if(n>=KERET[e.kind])continue;db[e.kind]=n+1;
   const hosszu=e.kind==='task'||e.kind==='note'||e.kind==='lesson';
   hits.push({kind:e.kind,id:e.id,cim:hosszu?reszlet(e.cim,kerdes):e.cim,alcim:e.alcim,cel:e.cel,pont:p});
   if(hits.length>=40)break;
  }
  return Response.json({hits});
 }catch(e){return apiError(e)}
}
