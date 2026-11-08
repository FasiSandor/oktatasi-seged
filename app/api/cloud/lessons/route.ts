import {NextRequest} from 'next/server';
import {database,ownerFromRequest,apiError,schemaMissing,isUuid} from '../../../../lib/server';
import {cleanContent,cleanSources,itemCount} from '../../../../lib/orafelkeszito';
export const runtime='nodejs';

/**
 * Megtartott órák (0.5.0): a jóváhagyott felkészülési lap dátummal, osztállyal, témával és forrásokkal.
 * GET ?id=…        : egy óra a teljes lappal
 * GET ?classes=1   : eddig használt osztályok (a mezőhöz felkínálható)
 * GET (szűrőkkel)  : lista a lap nélkül; szűrők: topicId (az altémákkal együtt), class, q, from, to
 */
const PENDING={error:'A megtartott órákhoz előbb le kell futtatni a 012-es adatbázis-frissítést.'};
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const validDate=(v:unknown):v is string=>typeof v==='string'&&DATE.test(v)&&!Number.isNaN(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().startsWith(v);
const text=(v:unknown,max:number)=>typeof v==='string'?v.replace(/\s+/g,' ').trim().slice(0,max):'';
const bad=():never=>{throw Error('INVALID')};
const like=(v:string)=>'%'+v.replace(/[\\%_]/g,m=>'\\'+m)+'%';

export async function GET(req:NextRequest){
 try{
  const owner=await ownerFromRequest(req),sql=database(),p=req.nextUrl.searchParams;
  try{
   const id=p.get('id');
   if(id!==null){
    if(!isUuid(id))throw Error('INVALID');
    const rows=await sql`SELECT id,to_char(taught_on,'YYYY-MM-DD') AS taught_on,class_name,grade,subject_id,topic_id,topic_name,sources,content,note,created_at,updated_at FROM os_lessons WHERE id=${id} AND owner_id=${owner}`;
    if(!rows.length)throw Error('FORBIDDEN');
    return Response.json({lesson:rows[0],schemaReady:true},{headers:{'Cache-Control':'no-store'}});
   }
   if(p.get('classes')==='1'){
    const rows=await sql`SELECT class_name,count(*)::int AS lessons,max(taught_on) AS last FROM os_lessons WHERE owner_id=${owner} GROUP BY class_name ORDER BY max(taught_on) DESC LIMIT 100`;
    return Response.json({classes:rows.map(r=>({name:r.class_name,lessons:r.lessons})),schemaReady:true});
   }
   const topicId=p.get('topicId');
   if(topicId!==null&&!isUuid(topicId))throw Error('INVALID');
   const cls=text(p.get('class'),40),q=text(p.get('q'),100);
   const from=p.get('from'),to=p.get('to');
   if((from&&!validDate(from))||(to&&!validDate(to)))throw Error('INVALID');
   const rows=await sql`
    WITH RECURSIVE tree AS (
     SELECT id,0 AS depth FROM os_topics WHERE id=${topicId}::uuid AND owner_id=${owner}
     UNION ALL SELECT c.id,tree.depth+1 FROM os_topics c JOIN tree ON c.parent_id=tree.id WHERE c.owner_id=${owner} AND tree.depth<6
    )
    SELECT l.id,to_char(l.taught_on,'YYYY-MM-DD') AS taught_on,l.class_name,l.grade,l.subject_id,l.topic_id,l.topic_name,l.sources,l.note,l.created_at,
     COALESCE(jsonb_array_length(l.content->'examples'),0) AS examples,COALESCE(jsonb_array_length(l.content->'practice'),0) AS practice
    FROM os_lessons l
    WHERE l.owner_id=${owner}
     AND (${topicId}::uuid IS NULL OR l.topic_id IN (SELECT id FROM tree))
     AND (${cls}='' OR l.class_name=${cls})
     AND (${q}='' OR l.topic_name ILIKE ${like(q)} OR l.class_name ILIKE ${like(q)} OR l.note ILIKE ${like(q)})
     AND (${from}::date IS NULL OR l.taught_on>=${from}::date)
     AND (${to}::date IS NULL OR l.taught_on<=${to}::date)
    ORDER BY l.taught_on DESC,l.created_at DESC LIMIT 300`;
   return Response.json({lessons:rows,schemaReady:true},{headers:{'Cache-Control':'no-store'}});
  }catch(e){
   if(!schemaMissing(e))throw e;
   return Response.json({lessons:[],classes:[],schemaReady:false});
  }
 }catch(e){return apiError(e)}
}

/** Új megtartott óra mentése: csak a jóváhagyott lap kerül ide. */
export async function POST(req:NextRequest){
 try{
  const owner=await ownerFromRequest(req),b=await req.json(),sql=database();
  if(!validDate(b?.takenOn))throw Error('INVALID');
  const className=text(b.className,40);
  if(!className)throw Error('INVALID');
  const grade=Number.isInteger(b.grade)&&b.grade>=1&&b.grade<=13?Number(b.grade):null;
  if((b.subjectId!=null&&!isUuid(b.subjectId))||(b.topicId!=null&&!isUuid(b.topicId)))throw Error('INVALID');
  const content=cleanContent(b.content);
  if(itemCount(content)<1)throw Error('INVALID');
  const sources=cleanSources(b.sources);
  const note=typeof b.note==='string'?b.note.trim().slice(0,2000):'';
  const topicName=text(b.topicName,300);
  try{
   const rows=await sql`
    INSERT INTO os_lessons(owner_id,taught_on,class_name,grade,subject_id,topic_id,topic_name,sources,content,note)
    SELECT ${owner},${b.takenOn}::date,${className},${grade}::smallint,COALESCE(s.id,t.subject_id),t.id,COALESCE(t.name,${topicName}),${JSON.stringify(sources)}::jsonb,${JSON.stringify(content)}::jsonb,${note}
    FROM (SELECT 1) x
     LEFT JOIN os_subjects s ON s.id=${b.subjectId??null}::uuid AND s.owner_id=${owner}
     LEFT JOIN os_topics t ON t.id=${b.topicId??null}::uuid AND t.owner_id=${owner}
    RETURNING id`;
   return Response.json({lesson:{id:rows[0].id}},{status:201});
  }catch(e){if(schemaMissing(e))return Response.json(PENDING,{status:409});throw e}
 }catch(e){return apiError(e)}
}

/** Módosítás: dátum, osztály, évfolyam, megjegyzés, a lap tartalma, a források. Csak a megadott mezők változnak. */
export async function PATCH(req:NextRequest){
 try{
  const owner=await ownerFromRequest(req),b=await req.json();
  if(!isUuid(b?.id))throw Error('INVALID');
  const takenOn=b.takenOn==null?null:validDate(b.takenOn)?b.takenOn:bad();
  const className=b.className==null?null:text(b.className,40)||bad();
  const grade=b.grade==null?null:Number.isInteger(b.grade)&&b.grade>=1&&b.grade<=13?Number(b.grade):bad();
  const note=b.note==null?null:typeof b.note==='string'&&b.note.length<=2000?b.note.trim():bad();
  let content:string|null=null;
  if(b.content!=null){const c=cleanContent(b.content);if(itemCount(c)<1)throw Error('INVALID');content=JSON.stringify(c)}
  const sources=b.sources==null?null:JSON.stringify(cleanSources(b.sources));
  const rows=await database()`
   UPDATE os_lessons SET
    taught_on=COALESCE(${takenOn}::date,taught_on),
    class_name=COALESCE(${className},class_name),
    grade=COALESCE(${grade}::smallint,grade),
    note=COALESCE(${note},note),
    content=COALESCE(${content}::jsonb,content),
    sources=COALESCE(${sources}::jsonb,sources),
    updated_at=now()
   WHERE id=${b.id} AND owner_id=${owner} RETURNING id`;
  if(!rows.length)throw Error('FORBIDDEN');
  return Response.json({updated:true});
 }catch(e){return apiError(e)}
}

/** Törlés (a felület előbb megerősítést kér). */
export async function DELETE(req:NextRequest){
 try{
  const owner=await ownerFromRequest(req),id=req.nextUrl.searchParams.get('id');
  if(!isUuid(id))throw Error('INVALID');
  const rows=await database()`DELETE FROM os_lessons WHERE id=${id} AND owner_id=${owner} RETURNING id`;
  if(!rows.length)throw Error('FORBIDDEN');
  return Response.json({deleted:true});
 }catch(e){return apiError(e)}
}
