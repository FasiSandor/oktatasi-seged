import {NextRequest} from 'next/server';
import {database,ownerFromRequest,apiError} from '../../../../lib/server';
export const runtime='nodejs';
const valid=(x:unknown):x is string=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
export async function POST(request:NextRequest){
 try{
  const owner=await ownerFromRequest(request),b=await request.json();
  if(!valid(b.topicId)||!valid(b.documentId)||b.page!=null&&(!Number.isInteger(b.page)||b.page<1))throw Error('INVALID');
  const category=typeof b.category==='string'&&['reference','exercise','worksheet','solution','notes','table'].includes(b.category)?b.category:'reference';
  const chapter=typeof b.chapterTitle==='string'&&b.chapterTitle.trim()?b.chapterTitle.trim().slice(0,160):null;
  const sql=database();
  const rows=await sql`
   INSERT INTO os_document_links(owner_id,topic_id,document_id,category,pdf_page,chapter_title,position)
   SELECT ${owner},t.id,d.id,${category},${b.page??null},${chapter},
    COALESCE((SELECT max(l.position)+1 FROM os_document_links l WHERE l.topic_id=t.id AND l.owner_id=${owner}),0)
   FROM os_topics t JOIN os_subjects s ON s.id=t.subject_id AND s.owner_id=${owner}
    JOIN os_documents d ON d.id=${b.documentId} AND d.owner_id=${owner} AND d.state='ready'
   WHERE t.id=${b.topicId} AND t.owner_id=${owner}
   ON CONFLICT(topic_id,document_id,category,(COALESCE(pdf_page,0))) DO UPDATE SET chapter_title=COALESCE(excluded.chapter_title,os_document_links.chapter_title)
   RETURNING id,topic_id,document_id,category,pdf_page,chapter_title,position`;
  if(!rows.length)throw Error('FORBIDDEN');
  return Response.json({link:rows[0]},{status:201});
 }catch(e){return apiError(e)}
}
export async function DELETE(request:NextRequest){
 try{
 const owner=await ownerFromRequest(request),id=request.nextUrl.searchParams.get('id');if(!valid(id))throw Error('INVALID');
 const sql=database();
 const deleted=await sql`DELETE FROM os_document_links WHERE id=${id} AND owner_id=${owner} RETURNING id`;
 if(!deleted.length)throw Error('FORBIDDEN');
 return Response.json({unlinked:true});
 }catch(e){return apiError(e)}
}
