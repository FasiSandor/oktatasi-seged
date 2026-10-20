import {NextRequest} from 'next/server';
import {database,ownerFromRequest,apiError,schemaMissing,isUuid} from '../../../../lib/server';
export const runtime='nodejs';

/**
 * Témaoldal: egy témakör vagy altéma minden hivatkozása egy helyen.
 * A témakörnél az altémáihoz kötött fejezetek és videók is bekerülnek.
 */
export async function GET(req:NextRequest){
 try{
  const owner=await ownerFromRequest(req),topicId=req.nextUrl.searchParams.get('topicId');
  if(!isUuid(topicId))throw Error('INVALID');
  const sql=database();
  const own=await sql`SELECT t.id FROM os_topics t JOIN os_subjects s ON s.id=t.subject_id AND s.owner_id=${owner} WHERE t.id=${topicId} AND t.owner_id=${owner}`;
  if(!own.length)throw Error('FORBIDDEN');

  let schemaReady=true;
  let links;
  try{
   links=await sql`
    WITH RECURSIVE tree AS (
     SELECT id,name,0 AS depth FROM os_topics WHERE id=${topicId} AND owner_id=${owner}
     UNION ALL
     SELECT c.id,c.name,tree.depth+1 FROM os_topics c JOIN tree ON c.parent_id=tree.id WHERE c.owner_id=${owner} AND tree.depth<6
    )
    SELECT l.id AS link_id,l.topic_id,tree.name AS topic_name,tree.depth,l.pdf_page,l.chapter_title,l.category,l.position,
     d.id,d.title,d.filename,d.mime_type,d.grade,d.level,d.kind
    FROM os_document_links l
    JOIN tree ON tree.id=l.topic_id
    JOIN os_documents d ON d.id=l.document_id AND d.owner_id=${owner} AND d.state='ready'
    WHERE l.owner_id=${owner}
    ORDER BY d.grade NULLS LAST,d.title,l.pdf_page NULLS FIRST`;
  }catch(e){
   if(!schemaMissing(e))throw e;
   schemaReady=false;
   links=await sql`
    WITH RECURSIVE tree AS (
     SELECT id,name,0 AS depth FROM os_topics WHERE id=${topicId} AND owner_id=${owner}
     UNION ALL
     SELECT c.id,c.name,tree.depth+1 FROM os_topics c JOIN tree ON c.parent_id=tree.id WHERE c.owner_id=${owner} AND tree.depth<6
    )
    SELECT l.id AS link_id,l.topic_id,tree.name AS topic_name,tree.depth,l.pdf_page,l.chapter_title,l.category,l.position,
     d.id,d.title,d.filename,d.mime_type
    FROM os_document_links l
    JOIN tree ON tree.id=l.topic_id
    JOIN os_documents d ON d.id=l.document_id AND d.owner_id=${owner} AND d.state='ready'
    WHERE l.owner_id=${owner}
    ORDER BY d.title,l.pdf_page NULLS FIRST`;
  }

  let videos:Record<string,unknown>[]=[];
  try{
   videos=await sql`
    WITH RECURSIVE tree AS (
     SELECT id,name,0 AS depth FROM os_topics WHERE id=${topicId} AND owner_id=${owner}
     UNION ALL
     SELECT c.id,c.name,tree.depth+1 FROM os_topics c JOIN tree ON c.parent_id=tree.id WHERE c.owner_id=${owner} AND tree.depth<6
    )
    SELECT v.id,v.title,v.url,v.provider,v.note,v.category,v.topic_id,tree.name AS topic_name
    FROM os_videos v JOIN tree ON tree.id=v.topic_id WHERE v.owner_id=${owner} ORDER BY v.created_at DESC LIMIT 200`;
  }catch(e){if(!schemaMissing(e))throw e}

  return Response.json({links,videos,schemaReady});
 }catch(e){return apiError(e)}
}
