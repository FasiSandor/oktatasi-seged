import {NextRequest} from 'next/server';
import {database,ownerFromRequest,apiError} from '../../../../../lib/server';
export const runtime='nodejs';
const valid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export async function GET(req:NextRequest){
 try{
  const owner=await ownerFromRequest(req),profileId=req.nextUrl.searchParams.get('profileId');
  if(!valid(profileId))throw Error('INVALID');
  const sql=database();
  const records=await sql`SELECT p.id,p.topic_id,p.grade,p.depth,p.position,p.suggested_minutes,p.required_for_exam,p.notes,t.name AS topic_name
   FROM os_curriculum_placements p JOIN os_curriculum_profiles pr ON pr.id=p.profile_id AND pr.owner_id=${owner}
   JOIN os_topics t ON t.id=p.topic_id AND t.owner_id=${owner} AND t.subject_id=pr.subject_id
   WHERE p.owner_id=${owner} AND p.profile_id=${profileId} ORDER BY p.grade,p.position,t.name`;
  return Response.json({placements:records});
 }catch(e){return apiError(e)}
}
export async function POST(req:NextRequest){
 try{
  const owner=await ownerFromRequest(req),b=await req.json();
  if(!valid(b.profileId)||!valid(b.topicId)||![9,10,11,12].includes(b.grade))throw Error('INVALID');
  const depth=typeof b.depth==='string'&&['foundation','core','advanced','review'].includes(b.depth)?b.depth:'core';
  const minutes=b.minutes==null?null:Number(b.minutes);
  if(minutes!==null&&(!Number.isSafeInteger(minutes)||minutes<1||minutes>2000))throw Error('INVALID');
  const note=typeof b.notes==='string'?b.notes.trim().slice(0,1000):'';
  const sql=database();
  const rows=await sql`INSERT INTO os_curriculum_placements(owner_id,profile_id,topic_id,grade,depth,suggested_minutes,notes)
   SELECT ${owner},pr.id,t.id,${b.grade},${depth},${minutes},${note}
   FROM os_curriculum_profiles pr JOIN os_topics t ON t.subject_id=pr.subject_id AND t.owner_id=${owner}
   WHERE pr.id=${b.profileId} AND pr.owner_id=${owner} AND t.id=${b.topicId} AND pr.education_type='technikum'
   AND ${b.grade} BETWEEN pr.grade_from AND pr.grade_to
   ON CONFLICT(owner_id,profile_id,topic_id,grade,depth) DO UPDATE
   SET suggested_minutes=EXCLUDED.suggested_minutes,notes=EXCLUDED.notes RETURNING id,grade,depth,topic_id`;
  if(!rows.length)throw Error('FORBIDDEN');
  return Response.json({placement:rows[0]},{status:201});
 }catch(e){return apiError(e)}
}
export async function DELETE(req:NextRequest){
 try{
  const owner=await ownerFromRequest(req),id=req.nextUrl.searchParams.get('id');
  if(!valid(id))throw Error('INVALID');
  const sql=database();
  const rows=await sql`DELETE FROM os_curriculum_placements WHERE owner_id=${owner} AND id=${id} RETURNING id`;
  if(!rows.length)throw Error('FORBIDDEN');
  return Response.json({deleted:true});
 }catch(e){return apiError(e)}
}
