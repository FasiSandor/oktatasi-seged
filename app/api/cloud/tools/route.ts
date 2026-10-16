import {NextRequest} from 'next/server';
import {database,ownerFromRequest,apiError} from '../../../../lib/server';
export const runtime='nodejs';
const uuid=(x:unknown):x is string=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
export async function GET(request:NextRequest){
 try{const owner=await ownerFromRequest(request),topicId=request.nextUrl.searchParams.get('topicId');if(!uuid(topicId))throw Error('INVALID');
 const sql=database();const rows=await sql`SELECT l.id,l.provider,l.label,l.url FROM os_tool_links l JOIN os_topics t ON t.id=l.topic_id AND t.owner_id=${owner} WHERE l.owner_id=${owner} AND l.topic_id=${topicId} ORDER BY l.position,l.label`;
 return Response.json({tools:rows})}catch(e){return apiError(e)}
}
export async function POST(request:NextRequest){
 try{const owner=await ownerFromRequest(request),b=await request.json();if(!uuid(b.topicId)||typeof b.label!=='string'||!b.label.trim()||b.label.length>140||typeof b.url!=='string'||b.url.length>2048)throw Error('INVALID');
 let parsed:URL;try{parsed=new URL(b.url)}catch{throw Error('INVALID')}if(parsed.protocol!=='https:'||parsed.username||parsed.password)throw Error('INVALID');
 const provider=typeof b.provider==='string'?b.provider.slice(0,50):'egyéb';
 const sql=database();const result=await sql`INSERT INTO os_tool_links(owner_id,topic_id,provider,label,url,position)
 SELECT ${owner},t.id,${provider},${b.label.trim()},${parsed.toString()},COALESCE((SELECT max(position)+1 FROM os_tool_links WHERE topic_id=t.id AND owner_id=${owner}),0)
 FROM os_topics t JOIN os_subjects s ON s.id=t.subject_id AND s.owner_id=${owner} WHERE t.id=${b.topicId} AND t.owner_id=${owner}
 RETURNING id,provider,label,url`;if(!result.length)throw Error('FORBIDDEN');return Response.json({tool:result[0]},{status:201})}catch(e){return apiError(e)}
}
export async function DELETE(request:NextRequest){
 try{const owner=await ownerFromRequest(request),id=request.nextUrl.searchParams.get('id');if(!uuid(id))throw Error('INVALID');const sql=database();const result=await sql`DELETE FROM os_tool_links WHERE id=${id} AND owner_id=${owner} RETURNING id`;if(!result.length)throw Error('FORBIDDEN');return Response.json({deleted:true})}catch(e){return apiError(e)}
}
