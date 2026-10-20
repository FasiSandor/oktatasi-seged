import {NextRequest} from 'next/server';
import {database,ownerFromRequest,apiError,schemaMissing,isUuid} from '../../../../lib/server';
export const runtime='nodejs';

/** Melyik témához melyik évfolyamú könyvből van anyag (a témamutató évfolyamszűrőjéhez). */
export async function GET(req:NextRequest){
 try{
  const owner=await ownerFromRequest(req),subjectId=req.nextUrl.searchParams.get('subjectId');
  if(!isUuid(subjectId))throw Error('INVALID');
  const sql=database();
  try{
   const rows=await sql`
    SELECT l.topic_id,array_agg(DISTINCT d.grade) AS grades,count(*)::int AS links
    FROM os_document_links l
    JOIN os_topics t ON t.id=l.topic_id AND t.owner_id=${owner} AND t.subject_id=${subjectId}
    JOIN os_documents d ON d.id=l.document_id AND d.owner_id=${owner} AND d.state='ready'
    WHERE l.owner_id=${owner}
    GROUP BY l.topic_id`;
   return Response.json({topics:rows.map(r=>({topic_id:r.topic_id,links:r.links,grades:(r.grades as (number|null)[]).filter((g):g is number=>g!==null)})),schemaReady:true});
  }catch(e){
   if(!schemaMissing(e))throw e;
   const rows=await sql`
    SELECT l.topic_id,count(*)::int AS links FROM os_document_links l
    JOIN os_topics t ON t.id=l.topic_id AND t.owner_id=${owner} AND t.subject_id=${subjectId}
    WHERE l.owner_id=${owner} GROUP BY l.topic_id`;
   return Response.json({topics:rows.map(r=>({topic_id:r.topic_id,links:r.links,grades:[]})),schemaReady:false});
  }
 }catch(e){return apiError(e)}
}
