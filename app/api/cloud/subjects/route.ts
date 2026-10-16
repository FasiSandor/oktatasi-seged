import {NextRequest} from 'next/server';
import {database,ownerFromRequest,apiError} from '../../../../lib/server';
export const runtime='nodejs';
export async function GET(request:NextRequest){
 try{const owner=await ownerFromRequest(request);const sql=database();const subjects=await sql`SELECT id,name,position FROM os_subjects WHERE owner_id=${owner} ORDER BY position,name`;return Response.json({subjects})}catch(e){return apiError(e)}
}
export async function POST(request:NextRequest){
 try{const owner=await ownerFromRequest(request);const body=await request.json();if(typeof body.name!=='string'||!body.name.trim()||body.name.length>120)throw Error('INVALID');const sql=database();const rows=await sql`INSERT INTO os_subjects(owner_id,name,position) VALUES(${owner},${body.name.trim()},COALESCE((SELECT max(position)+1 FROM os_subjects WHERE owner_id=${owner}),0)) RETURNING id,name,position`;return Response.json({subject:rows[0]},{status:201})}catch(e){return apiError(e)}
}
