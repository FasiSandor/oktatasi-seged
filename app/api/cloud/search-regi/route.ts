import {NextRequest} from 'next/server';
// A régi nézet (Könyvtár, régi nézet) keresője, változatlanul. Az új kereső: /api/cloud/search.
import {database,ownerFromRequest,apiError} from '../../../../lib/server';
export const runtime='nodejs';
export async function GET(req:NextRequest){
 try{
  const owner=await ownerFromRequest(req);
  const query=(req.nextUrl.searchParams.get('q')||'').trim();
  if(query.length<2||query.length>120)throw Error('INVALID');
  const pattern='%'+query.replace(/[\\%_]/g,m=>'\\'+m)+'%';
  const sql=database();
  const [documents,topics]=await Promise.all([
   sql`SELECT id,title,filename,mime_type,byte_size,created_at FROM os_documents WHERE owner_id=${owner} AND state='ready' AND (title ILIKE ${pattern} ESCAPE '\' OR filename ILIKE ${pattern} ESCAPE '\') ORDER BY created_at DESC LIMIT 60`,
   sql`SELECT t.id,t.name,t.subject_id,s.name AS subject_name FROM os_topics t JOIN os_subjects s ON s.id=t.subject_id AND s.owner_id=${owner} WHERE t.owner_id=${owner} AND t.name ILIKE ${pattern} ESCAPE '\' ORDER BY s.position,t.position LIMIT 40`
  ]);
  return Response.json({documents,topics});
 }catch(e){return apiError(e)}
}
