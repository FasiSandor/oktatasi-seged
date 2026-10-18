import {NextRequest} from 'next/server';
import {database,ownerFromRequest,apiError} from '../../../../lib/server';
export const runtime='nodejs';
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export async function GET(req:NextRequest){
 try{const owner=await ownerFromRequest(req),id=req.nextUrl.searchParams.get('documentId');
 const sql=database();
 // Könyv megadása nélkül: az utoljára olvasott könyv (a főoldal „Folytatás” sorához).
 if(id===null){
  const last=await sql`SELECT p.document_id,p.pdf_page,p.updated_at,d.title,d.filename FROM os_reading_positions p JOIN os_documents d ON d.id=p.document_id AND d.owner_id=${owner} AND d.state='ready' WHERE p.owner_id=${owner} ORDER BY p.updated_at DESC LIMIT 1`;
  return Response.json({last:last[0]||null});
 }
 if(!uuid(id))throw Error('INVALID');
 const rows=await sql`SELECT p.pdf_page,p.updated_at FROM os_reading_positions p JOIN os_documents d ON d.id=p.document_id AND d.owner_id=${owner} WHERE p.owner_id=${owner} AND p.document_id=${id}`;
 return Response.json({position:rows[0]||null})}catch(e){return apiError(e)}
}
export async function PUT(req:NextRequest){
 try{const owner=await ownerFromRequest(req),body=await req.json();if(!uuid(body.documentId)||!Number.isInteger(body.page)||body.page<1||body.page>100000)throw Error('INVALID');
 const sql=database();
 const rows=await sql`INSERT INTO os_reading_positions(owner_id,document_id,pdf_page) SELECT ${owner},d.id,${body.page} FROM os_documents d WHERE d.id=${body.documentId} AND d.owner_id=${owner} AND d.state='ready' ON CONFLICT(owner_id,document_id) DO UPDATE SET pdf_page=EXCLUDED.pdf_page,updated_at=now() RETURNING pdf_page,updated_at`;
 if(!rows.length)throw Error('FORBIDDEN');return Response.json({position:rows[0]})}catch(e){return apiError(e)}
}
