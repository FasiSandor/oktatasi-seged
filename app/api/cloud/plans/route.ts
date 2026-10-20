import {NextRequest} from 'next/server';
import {database,ownerFromRequest,apiError,schemaMissing,isUuid} from '../../../../lib/server';
export const runtime='nodejs';

const PENDING={error:'A tanmenethez előbb le kell futtatni a 009-es adatbázis-frissítést.'};
const text=(v:unknown,max:number)=>typeof v==='string'?v.replace(/\s+/g,' ').trim().slice(0,max):'';

/** Tanmenetek listája (tantárgyanként), vagy egy tanmenet az óráival. */
export async function GET(req:NextRequest){
 try{
  const owner=await ownerFromRequest(req),sql=database(),q=req.nextUrl.searchParams;
  try{
   const id=q.get('id');
   if(id!==null){
    if(!isUuid(id))throw Error('INVALID');
    const plan=await sql`SELECT p.id,p.subject_id,p.name,p.grade,p.school_year,p.document_id,p.created_at,s.name AS subject_name
     FROM os_plans p JOIN os_subjects s ON s.id=p.subject_id AND s.owner_id=${owner} WHERE p.id=${id} AND p.owner_id=${owner}`;
    if(!plan.length)throw Error('FORBIDDEN');
    const lessons=await sql`SELECT l.id,l.position,l.month,l.week,l.lesson_no,l.content,l.topic_id,t.name AS topic_name,pt.name AS parent_name
     FROM os_plan_lessons l LEFT JOIN os_topics t ON t.id=l.topic_id AND t.owner_id=${owner} LEFT JOIN os_topics pt ON pt.id=t.parent_id
     WHERE l.plan_id=${id} AND l.owner_id=${owner} ORDER BY l.position`;
    return Response.json({plan:plan[0],lessons,schemaReady:true});
   }
   const subjectId=q.get('subjectId');
   if(subjectId!==null&&!isUuid(subjectId))throw Error('INVALID');
   const plans=await sql`SELECT p.id,p.subject_id,p.name,p.grade,p.school_year,p.created_at,
     (SELECT count(*)::int FROM os_plan_lessons l WHERE l.plan_id=p.id) AS lessons,
     (SELECT count(*)::int FROM os_plan_lessons l WHERE l.plan_id=p.id AND l.topic_id IS NOT NULL) AS matched
    FROM os_plans p WHERE p.owner_id=${owner} AND (${subjectId}::uuid IS NULL OR p.subject_id=${subjectId}::uuid) ORDER BY p.created_at DESC`;
   return Response.json({plans,schemaReady:true});
  }catch(e){
   if(!schemaMissing(e))throw e;
   return Response.json({plans:[],schemaReady:false});
  }
 }catch(e){return apiError(e)}
}

/** Új tanmenet a beolvasott Excel óráiból. */
export async function POST(req:NextRequest){
 try{
  const owner=await ownerFromRequest(req),b=await req.json(),sql=database();
  if(!isUuid(b?.subjectId)||!Array.isArray(b.lessons)||b.lessons.length<1||b.lessons.length>400)throw Error('INVALID');
  const name=text(b.name,160);if(!name)throw Error('INVALID');
  const grade=b.grade==null||b.grade===''?null:Number(b.grade);
  if(grade!==null&&(!Number.isInteger(grade)||grade<1||grade>13))throw Error('INVALID');
  if(b.documentId!=null&&!isUuid(b.documentId))throw Error('INVALID');
  const lessons=b.lessons.map((l:Record<string,unknown>,i:number)=>{
   const content=text(l?.content,2000);if(!content)throw Error('INVALID');
   const week=Number(l?.week),no=Number(l?.lesson_no);
   return {position:i,month:text(l?.month,40)||null,week:Number.isInteger(week)&&week>0&&week<100?week:null,lesson_no:Number.isInteger(no)&&no>0&&no<1000?no:null,content};
  });
  const own=await sql`SELECT id FROM os_subjects WHERE id=${b.subjectId} AND owner_id=${owner}`;
  if(!own.length)throw Error('FORBIDDEN');
  try{
   const plan=await sql`INSERT INTO os_plans(owner_id,subject_id,name,grade,school_year,document_id)
    SELECT ${owner},${b.subjectId}::uuid,${name},${grade},${text(b.schoolYear,20)||null},d.id
    FROM (SELECT 1) x LEFT JOIN os_documents d ON d.id=${b.documentId??null}::uuid AND d.owner_id=${owner}
    RETURNING id`;
   const id=String(plan[0].id);
   await sql`INSERT INTO os_plan_lessons(owner_id,plan_id,position,month,week,lesson_no,content)
    SELECT ${owner},${id}::uuid,x.position,x.month,x.week,x.lesson_no,x.content
    FROM jsonb_to_recordset(${JSON.stringify(lessons)}::jsonb) AS x(position int,month text,week int,lesson_no int,content text)`;
   return Response.json({plan:{id}},{status:201});
  }catch(e){if(schemaMissing(e))return Response.json(PENDING,{status:409});throw e}
 }catch(e){return apiError(e)}
}

/** Órák témához kötése (egyszerre több). Csak a tanmenet tantárgyának témái választhatók. */
export async function PATCH(req:NextRequest){
 try{
  const owner=await ownerFromRequest(req),b=await req.json(),sql=database();
  if(!isUuid(b?.planId)||!Array.isArray(b.assignments)||b.assignments.length<1||b.assignments.length>400)throw Error('INVALID');
  const list=b.assignments.map((a:{lessonId?:unknown;topicId?:unknown})=>{
   if(!isUuid(a?.lessonId)||!(a.topicId===null||isUuid(a.topicId)))throw Error('INVALID');
   return {lesson:a.lessonId,topic:a.topicId};
  });
  try{
   const rows=await sql`
    UPDATE os_plan_lessons l SET topic_id=x.topic
    FROM jsonb_to_recordset(${JSON.stringify(list)}::jsonb) AS x(lesson uuid,topic uuid), os_plans p
    WHERE l.id=x.lesson AND l.plan_id=p.id AND p.id=${b.planId} AND p.owner_id=${owner} AND l.owner_id=${owner}
     AND (x.topic IS NULL OR EXISTS (SELECT 1 FROM os_topics t WHERE t.id=x.topic AND t.owner_id=${owner} AND t.subject_id=p.subject_id))
    RETURNING l.id`;
   return Response.json({updated:rows.length});
  }catch(e){if(schemaMissing(e))return Response.json(PENDING,{status:409});throw e}
 }catch(e){return apiError(e)}
}

/** Tanmenet törlése (az órákkal együtt). Az eredeti Excel a Dokumentumok között marad. */
export async function DELETE(req:NextRequest){
 try{
  const owner=await ownerFromRequest(req),id=req.nextUrl.searchParams.get('id');
  if(!isUuid(id))throw Error('INVALID');
  const rows=await database()`DELETE FROM os_plans WHERE id=${id} AND owner_id=${owner} RETURNING id`;
  if(!rows.length)throw Error('FORBIDDEN');
  return Response.json({deleted:true});
 }catch(e){return apiError(e)}
}
