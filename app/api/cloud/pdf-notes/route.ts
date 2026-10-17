import {NextRequest} from 'next/server';
import {database,ownerFromRequest,apiError} from '../../../../lib/server';
export const runtime='nodejs';
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export async function GET(req:NextRequest){
 try{const owner=await ownerFromRequest(req),id=req.nextUrl.searchParams.get('documentId');if(!uuid(id))throw Error('INVALID');const sql=database();
 const docs=await sql`SELECT id FROM os_documents WHERE id=${id} AND owner_id=${owner} AND state='ready'`;if(!docs.length)throw Error('FORBIDDEN');
 const notes=await sql`SELECT id,pdf_page,body,created_at,updated_at FROM os_pdf_notes WHERE owner_id=${owner} AND document_id=${id} ORDER BY pdf_page,created_at`;return Response.json({notes})}catch(e){return apiError(e)}
}
export async function POST(req:NextRequest){
 try{const owner=await ownerFromRequest(req),b=await req.json();if(!uuid(b.documentId)||!Number.isInteger(b.page)||b.page<1||b.page>100000||typeof b.body!=='string'||!b.body.trim()||b.body.length>4000)throw Error('INVALID');const sql=database();
 const rows=await sql`INSERT INTO os_pdf_notes(owner_id,document_id,pdf_page,body) SELECT ${owner},d.id,${b.page},${b.body.trim()} FROM os_documents d WHERE d.id=${b.documentId} AND d.owner_id=${owner} AND d.state='ready' RETURNING id,pdf_page,body,created_at`;if(!rows.length)throw Error('FORBIDDEN');return Response.json({note:rows[0]},{status:201})}catch(e){return apiError(e)}
}
export async function DELETE(req:NextRequest){
 try{const owner=await ownerFromRequest(req),id=req.nextUrl.searchParams.get('id');if(!uuid(id))throw Error('INVALID');const sql=database();const rows=await sql`DELETE FROM os_pdf_notes WHERE id=${id} AND owner_id=${owner} RETURNING id`;if(!rows.length)throw Error('FORBIDDEN');return Response.json({deleted:true})}catch(e){return apiError(e)}
}
