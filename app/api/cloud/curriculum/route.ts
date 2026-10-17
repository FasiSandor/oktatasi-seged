import {NextRequest} from 'next/server';
import {database,ownerFromRequest,apiError} from '../../../../lib/server';
export const runtime='nodejs';
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export async function GET(req:NextRequest){
 try{
  const owner=await ownerFromRequest(req),sql=database(),subjectId=req.nextUrl.searchParams.get('subjectId');
  if(!uuid(subjectId))throw Error('INVALID');
  const profiles=await sql`SELECT p.id,p.name,p.education_type,p.grade_from,p.grade_to,p.status
    FROM os_curriculum_profiles p JOIN os_subjects s ON s.id=p.subject_id AND s.owner_id=${owner}
    WHERE p.owner_id=${owner} AND p.subject_id=${subjectId} ORDER BY p.created_at`;
  return Response.json({profiles});
 }catch(e){return apiError(e)}
}
export async function POST(req:NextRequest){
 try{
  const owner=await ownerFromRequest(req),b=await req.json(),sql=database();
  if(!uuid(b.subjectId)||typeof b.name!=='string'||!b.name.trim()||b.name.length>120)throw Error('INVALID');
  if(b.educationType!=='technikum'||b.gradeFrom!==9||b.gradeTo!==12)throw Error('INVALID');
  const rows=await sql`INSERT INTO os_curriculum_profiles(owner_id,subject_id,name,education_type,grade_from,grade_to)
   SELECT ${owner},s.id,${b.name.trim()},'technikum',9,12 FROM os_subjects s WHERE s.id=${b.subjectId} AND s.owner_id=${owner}
   ON CONFLICT(owner_id,subject_id,name) DO UPDATE SET name=EXCLUDED.name
   RETURNING id,name,education_type,grade_from,grade_to,status`;
  if(!rows.length)throw Error('FORBIDDEN');
  return Response.json({profile:rows[0]}, {status:201});
 }catch(e){return apiError(e)}
}
