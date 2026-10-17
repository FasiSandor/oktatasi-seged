import {NextRequest} from 'next/server';
import {database,ownerFromRequest,apiError} from '../../../../lib/server';
export const runtime='nodejs';
const valid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export async function GET(req:NextRequest){
 try{const owner=await ownerFromRequest(req),documentId=req.nextUrl.searchParams.get('documentId');if(!valid(documentId))throw Error('INVALID');const sql=database();
 const docs=await sql`SELECT id FROM os_documents WHERE id=${documentId} AND owner_id=${owner} AND state='ready'`;if(!docs.length)throw Error('FORBIDDEN');
 const marks=await sql`SELECT id,pdf_page,kind,x,y,w,h,color FROM os_pdf_marks WHERE owner_id=${owner} AND document_id=${documentId} ORDER BY pdf_page,created_at`;
 return Response.json({marks})}catch(e){return apiError(e)}
}
export async function POST(req:NextRequest){
 try{const owner=await ownerFromRequest(req),b=await req.json();const validNumber=(x:unknown)=>typeof x==='number'&&Number.isFinite(x);
 if(!valid(b.documentId)||!Number.isInteger(b.page)||b.page<1||b.page>100000||!['highlight','underline'].includes(b.kind)||!['yellow','cyan','green'].includes(b.color)||![b.x,b.y,b.w,b.h].every(validNumber)||b.x<0||b.y<0||b.w<=0||b.h<=0||b.x+b.w>1.000001||b.y+b.h>1.000001)throw Error('INVALID');
 const sql=database();const rows=await sql`INSERT INTO os_pdf_marks(owner_id,document_id,pdf_page,kind,x,y,w,h,color)
 SELECT ${owner},d.id,${b.page},${b.kind},${b.x},${b.y},${b.w},${b.h},${b.color} FROM os_documents d
 WHERE d.id=${b.documentId} AND d.owner_id=${owner} AND d.state='ready'
 RETURNING id,pdf_page,kind,x,y,w,h,color`;if(!rows.length)throw Error('FORBIDDEN');return Response.json({mark:rows[0]},{status:201})
 }catch(e){return apiError(e)}
}
export async function DELETE(req:NextRequest){
 try{const owner=await ownerFromRequest(req),id=req.nextUrl.searchParams.get('id');if(!valid(id))throw Error('INVALID');const sql=database();const removed=await sql`DELETE FROM os_pdf_marks WHERE id=${id} AND owner_id=${owner} RETURNING id`;if(!removed.length)throw Error('FORBIDDEN');return Response.json({deleted:true})}catch(e){return apiError(e)}
}
