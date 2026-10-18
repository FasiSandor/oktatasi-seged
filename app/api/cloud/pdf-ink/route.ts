import {NextRequest} from 'next/server';
import {database,ownerFromRequest,apiError} from '../../../../lib/server';
export const runtime='nodejs';

const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const COLORS:Record<'marker'|'pen',string[]>={marker:['#FFD84D','#9BE7C4','#FFB4C8','#A8D4FF'],pen:['#C0263A','#1E4FBF','#172033']};
const MAX_POINTS=2000;
const NOT_MIGRATED='A Pencil-rajzok mentéséhez az adatbázis-frissítés (006_pdf_ink) még nincs alkalmazva.';

/** Igaz, ha a hiba azt jelzi, hogy a tábla még nem létezik (a migráció nem futott le). */
function missingTable(e:unknown){return !!e&&typeof e==='object'&&'code' in e&&(e as {code?:string}).code==='42P01'}

function cleanPoints(value:unknown):number[][]|null{
 if(!Array.isArray(value)||value.length<1||value.length>MAX_POINTS)return null;
 const out:number[][]=[];
 for(const p of value){
  if(!Array.isArray(p)||p.length<2)return null;
  const x=Number(p[0]),y=Number(p[1]);
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>1||y<0||y>1)return null;
  out.push([Math.round(x*10000)/10000,Math.round(y*10000)/10000]);
 }
 return out;
}

export async function GET(req:NextRequest){
 try{
  const owner=await ownerFromRequest(req),documentId=req.nextUrl.searchParams.get('documentId');
  if(!uuid(documentId))throw Error('INVALID');
  const sql=database();
  const docs=await sql`SELECT id FROM os_documents WHERE id=${documentId} AND owner_id=${owner} AND state='ready'`;
  if(!docs.length)throw Error('FORBIDDEN');
  try{
   const strokes=await sql`SELECT id,pdf_page,tool,color,width,points FROM os_pdf_ink WHERE owner_id=${owner} AND document_id=${documentId} ORDER BY pdf_page,created_at`;
   return Response.json({strokes});
  }catch(e){
   if(missingTable(e))return Response.json({strokes:[],unavailable:true});
   throw e;
  }
 }catch(e){return apiError(e)}
}

export async function POST(req:NextRequest){
 try{
  const owner=await ownerFromRequest(req),b=await req.json();
  const tool=b.tool==='marker'||b.tool==='pen'?b.tool as 'marker'|'pen':null;
  const points=cleanPoints(b.points);
  const width=Number(b.width);
  if(!uuid(b.documentId)||!Number.isInteger(b.page)||b.page<1||b.page>100000||!tool||typeof b.color!=='string'||!COLORS[tool].includes(b.color)||!Number.isFinite(width)||width<=0||width>0.05||!points)throw Error('INVALID');
  const sql=database();
  try{
   const rows=await sql`INSERT INTO os_pdf_ink(owner_id,document_id,pdf_page,tool,color,width,points)
    SELECT ${owner},d.id,${b.page},${tool},${b.color},${width},${JSON.stringify(points)}::jsonb
    FROM os_documents d WHERE d.id=${b.documentId} AND d.owner_id=${owner} AND d.state='ready'
    RETURNING id,pdf_page,tool,color,width,points`;
   if(!rows.length)throw Error('FORBIDDEN');
   return Response.json({stroke:rows[0]},{status:201});
  }catch(e){
   if(missingTable(e))return Response.json({error:NOT_MIGRATED,unavailable:true},{status:503});
   throw e;
  }
 }catch(e){return apiError(e)}
}

export async function DELETE(req:NextRequest){
 try{
  const owner=await ownerFromRequest(req),id=req.nextUrl.searchParams.get('id');
  if(!uuid(id))throw Error('INVALID');
  const sql=database();
  try{
   const rows=await sql`DELETE FROM os_pdf_ink WHERE id=${id} AND owner_id=${owner} RETURNING id`;
   if(!rows.length)throw Error('FORBIDDEN');
   return Response.json({deleted:true});
  }catch(e){
   if(missingTable(e))return Response.json({error:NOT_MIGRATED,unavailable:true},{status:503});
   throw e;
  }
 }catch(e){return apiError(e)}
}
