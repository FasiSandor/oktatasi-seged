import {NextRequest} from 'next/server';
import {apiError,database,ownerFromRequest} from '../../../../lib/server';

export const runtime='nodejs';
const validId=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
type Question={question:string;answer:string};
function validateQuestions(value:unknown):value is Question[]{
 return Array.isArray(value)&&value.length<=100&&value.every(item=>item&&typeof item==='object'&&typeof item.question==='string'&&item.question.trim().length>0&&item.question.length<=1000&&typeof item.answer==='string'&&item.answer.length<=4000);
}
export async function GET(request:NextRequest){
 try{
  const owner=await ownerFromRequest(request);
  const topicId=request.nextUrl.searchParams.get('topicId');
  if(!validId(topicId))throw Error('INVALID');
  const sql=database();
  const rows=await sql`SELECT w.notes,w.questions,w.updated_at FROM os_lesson_workspaces w JOIN os_topics t ON t.id=w.topic_id AND t.owner_id=${owner} WHERE w.owner_id=${owner} AND w.topic_id=${topicId} LIMIT 1`;
  return Response.json({workspace:rows[0]||{notes:'',questions:[],updated_at:null}});
 }catch(error){return apiError(error)}
}
export async function PUT(request:NextRequest){
 try{
  const owner=await ownerFromRequest(request);
  const body=await request.json();
  if(!validId(body.topicId)||typeof body.notes!=='string'||body.notes.length>20000||!validateQuestions(body.questions))throw Error('INVALID');
  const sql=database();
  const questions=JSON.stringify(body.questions);
  const rows=await sql`INSERT INTO os_lesson_workspaces(owner_id,topic_id,notes,questions)
   SELECT ${owner},t.id,${body.notes},${questions}::jsonb FROM os_topics t WHERE t.id=${body.topicId} AND t.owner_id=${owner}
   ON CONFLICT(owner_id,topic_id) DO UPDATE SET notes=EXCLUDED.notes,questions=EXCLUDED.questions,updated_at=now()
   RETURNING updated_at`;
  if(!rows.length)throw Error('FORBIDDEN');
  return Response.json({saved:true,updatedAt:rows[0].updated_at});
 }catch(error){return apiError(error)}
}
