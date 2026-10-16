import {NextRequest} from 'next/server';
import {database,ownerFromRequest,apiError} from '../../../../lib/server';
export const runtime='nodejs';
export async function GET(request:NextRequest){
 try{const owner=await ownerFromRequest(request);const subjectId=request.nextUrl.searchParams.get('subjectId');if(!subjectId||!(/^[0-9a-f-]{36}$/i.test(subjectId)))throw Error('INVALID');const sql=database();const topics=await sql`SELECT t.id,t.name,t.position,t.parent_id FROM os_topics t JOIN os_subjects s ON s.id=t.subject_id AND s.owner_id=${owner} WHERE t.owner_id=${owner} AND t.subject_id=${subjectId} ORDER BY t.position,t.name`;return Response.json({topics})}catch(e){return apiError(e)}
}
export async function POST(request:NextRequest){
 try{const owner=await ownerFromRequest(request);const b=await request.json();if(typeof b.name!=='string'||!b.name.trim()||b.name.length>120||typeof b.subjectId!=='string'||!(/^[0-9a-f-]{36}$/i.test(b.subjectId)))throw Error('INVALID');const sql=database();const rows=await sql`INSERT INTO os_topics(owner_id,subject_id,name,position) SELECT ${owner},s.id,${b.name.trim()},COALESCE((SELECT max(position)+1 FROM os_topics t WHERE t.subject_id=s.id AND t.owner_id=${owner}),0) FROM os_subjects s WHERE s.id=${b.subjectId} AND s.owner_id=${owner} RETURNING id,name,position`;if(!rows.length)throw Error('FORBIDDEN');return Response.json({topic:rows[0]},{status:201})}catch(e){return apiError(e)}
}
