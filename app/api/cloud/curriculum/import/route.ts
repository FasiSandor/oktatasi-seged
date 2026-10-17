import {NextRequest} from 'next/server';
import {database,ownerFromRequest,apiError} from '../../../../../lib/server';
import {mathematicsTechnikumBlueprint} from '../../../../../lib/curriculum-blueprint';
export const runtime='nodejs';
/** Idempotent import: user explicitly clicks in the curriculum page. Never alters existing topic links. */
export async function POST(req:NextRequest){
 try {
  const owner=await ownerFromRequest(req);
  const body=await req.json().catch(()=>({}));
  if(body.confirm!==true)throw Error('INVALID');
  const sql=database();
  const subjects=await sql`SELECT id FROM os_subjects WHERE owner_id=${owner} AND name='Matematika' ORDER BY created_at LIMIT 1`;
  let subjectId:string;
  if(subjects.length)subjectId=String(subjects[0].id);
  else {
   const created=await sql`INSERT INTO os_subjects(owner_id,name,position) VALUES(${owner},'Matematika',COALESCE((SELECT MAX(position)+1 FROM os_subjects WHERE owner_id=${owner}),0)) ON CONFLICT(owner_id,name) DO UPDATE SET name=EXCLUDED.name RETURNING id`;
   subjectId=String(created[0].id);
  }
  let createdCount=0,existingCount=0;
  for(const group of mathematicsTechnikumBlueprint.topics){
   let rows=await sql`SELECT id FROM os_topics WHERE owner_id=${owner} AND subject_id=${subjectId} AND parent_id IS NULL AND name=${group.name} LIMIT 1`;
   let parentId:string;
   if(rows.length){parentId=String(rows[0].id);existingCount++}
   else {
    rows=await sql`INSERT INTO os_topics(owner_id,subject_id,parent_id,name,position)
     SELECT ${owner},${subjectId},NULL,${group.name},COALESCE(MAX(position),-1)+1 FROM os_topics WHERE owner_id=${owner} AND subject_id=${subjectId}
     RETURNING id`;
    parentId=String(rows[0].id);createdCount++;
   }
   for(const lesson of group.lessons){
    const found=await sql`SELECT id FROM os_topics WHERE owner_id=${owner} AND subject_id=${subjectId} AND parent_id=${parentId} AND name=${lesson} LIMIT 1`;
    if(found.length){existingCount++;continue}
    await sql`INSERT INTO os_topics(owner_id,subject_id,parent_id,name,position)
      SELECT ${owner},${subjectId},${parentId},${lesson},COALESCE(MAX(position),-1)+1 FROM os_topics WHERE owner_id=${owner} AND subject_id=${subjectId} AND parent_id=${parentId}`;
    createdCount++;
   }
  }
  return Response.json({subjectId,createdCount,existingCount,notice:'A tananyagfa szerkeszthető tervezet. Nem hivatalos évfolyamonkénti beosztás.'});
 }catch(e){return apiError(e)}
}
