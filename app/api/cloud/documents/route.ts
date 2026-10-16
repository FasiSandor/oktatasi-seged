import {NextRequest} from 'next/server';
import {database,ownerFromRequest,apiError} from '../../../../lib/server';
export const runtime='nodejs';
export async function GET(request:NextRequest){
 try{const owner=await ownerFromRequest(request),sql=database();const topic=request.nextUrl.searchParams.get('topicId');
 if(topic&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(topic))throw Error('INVALID');
 const documents=topic?await sql`SELECT d.id,d.title,d.filename,d.mime_type,d.byte_size,l.id AS link_id,l.pdf_page,l.category FROM os_documents d JOIN os_document_links l ON l.document_id=d.id AND l.owner_id=${owner} JOIN os_topics t ON t.id=l.topic_id AND t.owner_id=${owner} WHERE d.owner_id=${owner} AND t.id=${topic} AND d.state='ready' ORDER BY l.position,d.created_at DESC`:await sql`SELECT id,title,filename,mime_type,byte_size FROM os_documents WHERE owner_id=${owner} AND state='ready' ORDER BY created_at DESC`;
 return Response.json({documents})}catch(e){return apiError(e)}
}
