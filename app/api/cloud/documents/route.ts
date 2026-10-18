import {NextRequest} from 'next/server';
import {database,ownerFromRequest,apiError} from '../../../../lib/server';
export const runtime='nodejs';
export async function GET(request:NextRequest){
 try{const owner=await ownerFromRequest(request),sql=database();const topic=request.nextUrl.searchParams.get('topicId');
 if(topic&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(topic))throw Error('INVALID');
 const documents=topic?await sql`SELECT d.id,d.title,d.filename,d.mime_type,d.byte_size,l.id AS link_id,l.pdf_page,l.chapter_title,l.category FROM os_documents d JOIN os_document_links l ON l.document_id=d.id AND l.owner_id=${owner} JOIN os_topics t ON t.id=l.topic_id AND t.owner_id=${owner} WHERE d.owner_id=${owner} AND t.id=${topic} AND d.state='ready' ORDER BY l.position,d.created_at DESC,l.pdf_page`:await sql`SELECT id,title,filename,mime_type,byte_size FROM os_documents WHERE owner_id=${owner} AND state='ready' ORDER BY created_at DESC`;
 return Response.json({documents})}catch(e){return apiError(e)}
}
// Könyv átnevezése. Csak a cím változik, a fájl és a párosítások maradnak.
export async function PATCH(request:NextRequest){
 try{const owner=await ownerFromRequest(request),b=await request.json();
 if(typeof b?.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(b.id))throw Error('INVALID');
 const title=typeof b.title==='string'?b.title.replace(/\s+/g,' ').trim():'';
 if(!title||title.length>160)throw Error('INVALID');
 const sql=database();
 const rows=await sql`UPDATE os_documents SET title=${title} WHERE id=${b.id} AND owner_id=${owner} RETURNING id,title`;
 if(!rows.length)throw Error('FORBIDDEN');
 return Response.json({document:rows[0]})}catch(e){return apiError(e)}
}
