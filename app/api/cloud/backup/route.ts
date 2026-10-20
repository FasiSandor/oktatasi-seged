import {NextRequest} from 'next/server';
import {database,ownerFromRequest,apiError,schemaMissing} from '../../../../lib/server';
export const runtime='nodejs';
export const maxDuration=60;

/**
 * Mentés és visszaállítás táblánként, részletekben (a Vercel egy válaszban
 * legfeljebb kb. 4,5 MB-ot enged, ezért a böngésző rakja össze a teljes mentést).
 * A sorrend számít: előbb azok a táblák, amelyekre a többi hivatkozik.
 * A fájlok (PDF-ek) a tárhelyen maradnak, a mentés csak az adatokat tartalmazza.
 */
const TABLES:{name:string;order:string}[]=[
 {name:'os_subjects',order:'id'},
 {name:'os_topics',order:'id'},
 {name:'os_documents',order:'id'},
 {name:'os_document_links',order:'id'},
 {name:'os_tool_links',order:'id'},
 {name:'os_reading_positions',order:'document_id'},
 {name:'os_curriculum_profiles',order:'id'},
 {name:'os_curriculum_sources',order:'id'},
 {name:'os_curriculum_placements',order:'id'},
 {name:'os_topic_requirements',order:'id'},
 {name:'os_pdf_notes',order:'id'},
 {name:'os_pdf_marks',order:'id'},
 {name:'os_pdf_ink',order:'id'},
 {name:'os_videos',order:'id'},
 {name:'os_lesson_workspaces',order:'topic_id'},
 {name:'os_plans',order:'id'},
 {name:'os_plan_lessons',order:'id'},
 {name:'os_ai_usage',order:'id'}
];
const PAGE=1000;
const byName=(n:unknown)=>TABLES.find(t=>t.name===n);

export async function GET(req:NextRequest){
 try{
  const owner=await ownerFromRequest(req),sql=database();
  const name=req.nextUrl.searchParams.get('table');
  if(!name)return Response.json({tables:TABLES.map(t=>t.name),page:PAGE});
  const table=byName(name);if(!table)throw Error('INVALID');
  const offset=Math.max(0,Number(req.nextUrl.searchParams.get('offset'))||0);
  try{
   // A tábla- és oszlopnév a fenti fix listából jön, nem a kérésből.
   const rows=await sql.query(`SELECT * FROM ${table.name} WHERE owner_id=$1 ORDER BY ${table.order} LIMIT ${PAGE} OFFSET $2`,[owner,offset]);
   return Response.json({table:table.name,rows,more:rows.length===PAGE},{headers:{'Cache-Control':'no-store'}});
  }catch(e){
   if(schemaMissing(e))return Response.json({table:table.name,rows:[],more:false,missing:true});
   throw e;
  }
 }catch(e){return apiError(e)}
}

/** Visszaállítás: csak a hiányzó sorokat veszi fel, meglévőt soha nem ír felül. */
export async function POST(req:NextRequest){
 try{
  const owner=await ownerFromRequest(req),b=await req.json(),sql=database();
  const table=byName(b?.table);
  if(!table||!Array.isArray(b.rows)||b.rows.length>PAGE)throw Error('INVALID');
  const prefix=owner.replace(/[^A-Za-z0-9_-]/g,'_')+'/';
  const rows=b.rows.map((r:Record<string,unknown>)=>{
   if(!r||typeof r!=='object')throw Error('INVALID');
   const copy:Record<string,unknown>={...r,owner_id:owner};
   // Más felhasználó fájljára mutató bejegyzést nem fogadunk el.
   if(table.name==='os_documents'&&copy.storage_key!=null&&!(typeof copy.storage_key==='string'&&copy.storage_key.startsWith(prefix)))throw Error('FORBIDDEN');
   return copy;
  });
  if(!rows.length)return Response.json({inserted:0});
  try{
   const result=await sql.query(
    `INSERT INTO ${table.name} SELECT * FROM jsonb_populate_recordset(NULL::${table.name},$1::jsonb) ON CONFLICT DO NOTHING RETURNING 1`,
    [JSON.stringify(rows)]
   );
   return Response.json({inserted:result.length,skipped:rows.length-result.length});
  }catch(e){
   if(schemaMissing(e))return Response.json({inserted:0,skipped:rows.length,missing:true});
   const message=e instanceof Error?e.message:'';
   // Pl. hiányzó témára mutató sor: ezt a táblát kihagyjuk, a többi mehet tovább.
   return Response.json({inserted:0,skipped:rows.length,error:message.slice(0,200)});
  }
 }catch(e){return apiError(e)}
}
