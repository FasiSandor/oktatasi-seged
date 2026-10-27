import {NextRequest} from 'next/server';
import {database,ownerFromRequest,apiError,schemaMissing,isUuid} from '../../../../lib/server';
export const runtime='nodejs';

const KINDS=['reference','exercise','worksheet','solution','notes','table'];
const ROLES=['book','plan','requirement','other'];

/** Minden feltöltött fájl a besorolásával és a saját tartalomjegyzékével. */
export async function GET(req:NextRequest){
 try{
  const owner=await ownerFromRequest(req),sql=database();
  // Egy könyv párosított fejezetei (régi könyveknél ebből áll a tartalomjegyzék).
  const one=req.nextUrl.searchParams.get('doc');
  if(one!==null){
   if(!isUuid(one))throw Error('INVALID');
   // Újrapárosításhoz: a könyv mentett adatai és minden egyes kapcsolata azonosítóval.
   if(req.nextUrl.searchParams.get('links')==='1'){
    const docs=await sql`SELECT id,title,filename,subject_id,grade,level,kind,contents FROM os_documents WHERE id=${one} AND owner_id=${owner} AND state='ready'`;
    if(!docs.length)throw Error('FORBIDDEN');
    const links=await sql`
     SELECT l.id,l.topic_id,l.pdf_page,l.chapter_title,l.category
     FROM os_document_links l JOIN os_topics t ON t.id=l.topic_id AND t.owner_id=${owner}
     WHERE l.document_id=${one} AND l.owner_id=${owner}
     ORDER BY l.pdf_page NULLS FIRST,l.position`;
    return Response.json({document:docs[0],links});
   }
   const chapters=await sql`
    SELECT l.pdf_page AS page,COALESCE(l.chapter_title,'') AS title,string_agg(DISTINCT t.name,', ') AS topics
    FROM os_document_links l JOIN os_topics t ON t.id=l.topic_id AND t.owner_id=${owner}
    WHERE l.document_id=${one} AND l.owner_id=${owner}
    GROUP BY l.pdf_page,l.chapter_title ORDER BY l.pdf_page NULLS FIRST`;
   return Response.json({chapters});
  }
  try{
   const documents=await sql`
    SELECT d.id,d.title,d.filename,d.mime_type,d.byte_size,d.created_at,d.subject_id,d.grade,d.level,d.kind,d.role,d.contents,
     (SELECT count(*)::int FROM os_document_links l WHERE l.document_id=d.id AND l.owner_id=${owner}) AS link_count,
     (SELECT t.subject_id FROM os_document_links l JOIN os_topics t ON t.id=l.topic_id AND t.owner_id=${owner} WHERE l.document_id=d.id AND l.owner_id=${owner} LIMIT 1) AS link_subject_id,
     (SELECT l.category FROM os_document_links l WHERE l.document_id=d.id AND l.owner_id=${owner} LIMIT 1) AS link_kind
    FROM os_documents d WHERE d.owner_id=${owner} AND d.state='ready' ORDER BY d.created_at DESC`;
   return Response.json({documents,schemaReady:true});
  }catch(e){
   if(!schemaMissing(e))throw e;
   // A 008-as adatbázis-frissítés előtt: besorolás nélkül, de a könyvek látszanak.
   const documents=await sql`
    SELECT d.id,d.title,d.filename,d.mime_type,d.byte_size,d.created_at,
     (SELECT count(*)::int FROM os_document_links l WHERE l.document_id=d.id AND l.owner_id=${owner}) AS link_count,
     (SELECT t.subject_id FROM os_document_links l JOIN os_topics t ON t.id=l.topic_id AND t.owner_id=${owner} WHERE l.document_id=d.id AND l.owner_id=${owner} LIMIT 1) AS link_subject_id,
     (SELECT l.category FROM os_document_links l WHERE l.document_id=d.id AND l.owner_id=${owner} LIMIT 1) AS link_kind
    FROM os_documents d WHERE d.owner_id=${owner} AND d.state='ready' ORDER BY d.created_at DESC`;
   return Response.json({documents,schemaReady:false});
  }
 }catch(e){return apiError(e)}
}

// skip: a tanár a párosításnál kihagyta ezt a sort; újrapárosításnál nem kér rá újra AI-javaslatot.
type Entry={title:string;page:number;group:string;skip?:true};
function cleanContents(raw:unknown):Entry[]|null{
 if(raw===null)return null;
 if(!Array.isArray(raw)||raw.length>1500)throw Error('INVALID');
 return raw.map(x=>{
  const title=typeof x?.title==='string'?x.title.replace(/\s+/g,' ').trim().slice(0,200):'';
  const page=Number(x?.page);
  const group=typeof x?.group==='string'?x.group.replace(/\s+/g,' ').trim().slice(0,200):'';
  if(!title||!Number.isInteger(page)||page<1||page>100000)throw Error('INVALID');
  return x?.skip===true?{title,page,group,skip:true}:{title,page,group};
 });
}

/** Besorolás módosítása. Csak a megadott mezők változnak. */
export async function PATCH(req:NextRequest){
 try{
  const owner=await ownerFromRequest(req),b=await req.json(),sql=database();
  if(!isUuid(b?.id))throw Error('INVALID');
  const has=(k:string)=>Object.prototype.hasOwnProperty.call(b,k);
  const subjectId=has('subjectId')?(b.subjectId===null||b.subjectId===''?null:b.subjectId):undefined;
  if(subjectId!==undefined&&subjectId!==null&&!isUuid(subjectId))throw Error('INVALID');
  const grade=has('grade')?(b.grade===null||b.grade===''?null:Number(b.grade)):undefined;
  if(grade!==undefined&&grade!==null&&(!Number.isInteger(grade)||grade<1||grade>13))throw Error('INVALID');
  const level=has('level')?(b.level||null):undefined;
  if(level!==undefined&&level!==null&&!['kozep','emelt'].includes(level))throw Error('INVALID');
  const kind=has('kind')?(b.kind||null):undefined;
  if(kind!==undefined&&kind!==null&&!KINDS.includes(kind))throw Error('INVALID');
  const role=has('role')?b.role:undefined;
  if(role!==undefined&&!ROLES.includes(role))throw Error('INVALID');
  const contents=has('contents')?cleanContents(b.contents):undefined;
  if(subjectId){
   const own=await sql`SELECT id FROM os_subjects WHERE id=${subjectId} AND owner_id=${owner}`;
   if(!own.length)throw Error('FORBIDDEN');
  }
  try{
   const rows=await sql`
    UPDATE os_documents SET
     subject_id=CASE WHEN ${subjectId!==undefined} THEN ${subjectId??null}::uuid ELSE subject_id END,
     grade=CASE WHEN ${grade!==undefined} THEN ${grade??null}::smallint ELSE grade END,
     level=CASE WHEN ${level!==undefined} THEN ${level??null}::text ELSE level END,
     kind=CASE WHEN ${kind!==undefined} THEN ${kind??null}::text ELSE kind END,
     role=CASE WHEN ${role!==undefined} THEN ${role??'book'}::text ELSE role END,
     contents=CASE WHEN ${contents!==undefined} THEN ${contents===undefined||contents===null?null:JSON.stringify(contents)}::jsonb ELSE contents END
    WHERE id=${b.id} AND owner_id=${owner}
    RETURNING id,subject_id,grade,level,kind,role`;
   if(!rows.length)throw Error('FORBIDDEN');
   return Response.json({document:rows[0]});
  }catch(e){
   if(schemaMissing(e))return Response.json({error:'Ehhez előbb le kell futtatni a 008-as adatbázis-frissítést.'},{status:409});
   throw e;
  }
 }catch(e){return apiError(e)}
}
