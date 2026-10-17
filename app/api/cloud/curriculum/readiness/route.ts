import {NextRequest} from 'next/server';
import {database,ownerFromRequest,apiError} from '../../../../../lib/server';
export const runtime='nodejs';
export async function GET(req:NextRequest){
 try{
  await ownerFromRequest(req);
  const sql=database();
  const rows=await sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('os_curriculum_profiles','os_curriculum_sources','os_curriculum_placements','os_topic_requirements')`;
  const available=new Set(rows.map(r=>String(r.table_name)));
  const expected=['os_curriculum_profiles','os_curriculum_sources','os_curriculum_placements','os_topic_requirements'];
  return Response.json({ready:expected.every(name=>available.has(name)),missing:expected.filter(name=>!available.has(name))});
 }catch(e){return apiError(e)}
}
