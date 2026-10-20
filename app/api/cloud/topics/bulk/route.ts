import {NextRequest} from 'next/server';
import {database,ownerFromRequest,apiError,isUuid} from '../../../../../lib/server';
export const runtime='nodejs';

type Item={name:string;children:string[]};
const clean=(v:unknown)=>typeof v==='string'?v.replace(/\s+/g,' ').trim().slice(0,120):'';
const key=(v:string)=>v.toLocaleLowerCase('hu');

/**
 * Témamutató építése egy könyv tartalomjegyzékéből: témakörök és alattuk altémák.
 * A már meglévő, azonos nevű témát nem hozza létre újra, hanem azt használja.
 * Válasz: a bemenet sorrendjében minden témakör és altéma azonosítója.
 */
export async function POST(req:NextRequest){
 try{
  const owner=await ownerFromRequest(req),b=await req.json();
  if(!isUuid(b?.subjectId)||!Array.isArray(b.items)||b.items.length<1||b.items.length>300)throw Error('INVALID');
  const items:Item[]=b.items.map((x:{name?:unknown;children?:unknown})=>({
   name:clean(x?.name),
   children:Array.isArray(x?.children)?x.children.map(clean).filter(Boolean).slice(0,200):[]
  }));
  if(items.some(i=>!i.name)||items.reduce((n,i)=>n+i.children.length,0)>1500)throw Error('INVALID');
  const sql=database();
  const subject=await sql`SELECT id FROM os_subjects WHERE id=${b.subjectId} AND owner_id=${owner}`;
  if(!subject.length)throw Error('FORBIDDEN');

  const existing=await sql`SELECT id,name,parent_id FROM os_topics WHERE owner_id=${owner} AND subject_id=${b.subjectId}`;
  const mainByName=new Map<string,string>();
  for(const t of existing)if(!t.parent_id)mainByName.set(key(String(t.name)),String(t.id));

  // 1. Hiányzó témakörök egyetlen lépésben.
  const newMains=[...new Map(items.filter(i=>!mainByName.has(key(i.name))).map(i=>[key(i.name),i.name])).values()];
  if(newMains.length){
   const rows=await sql`
    INSERT INTO os_topics(owner_id,subject_id,parent_id,name,position)
    SELECT ${owner},${b.subjectId}::uuid,NULL,x.name,base.p+x.ord
    FROM jsonb_to_recordset(${JSON.stringify(newMains.map((name,ord)=>({name,ord})))}::jsonb) AS x(name text,ord int),
     (SELECT COALESCE(max(position)+1,0) AS p FROM os_topics WHERE owner_id=${owner} AND subject_id=${b.subjectId}) base
    RETURNING id,name`;
   for(const r of rows)mainByName.set(key(String(r.name)),String(r.id));
  }

  // 2. Hiányzó altémák, szintén egyben.
  const childByName=new Map<string,string>();
  for(const t of existing)if(t.parent_id)childByName.set(String(t.parent_id)+'|'+key(String(t.name)),String(t.id));
  const wanted:{parent:string;name:string;ord:number}[]=[];const seen=new Set<string>();
  for(const i of items){
   const parent=mainByName.get(key(i.name))!;
   i.children.forEach(name=>{const k=parent+'|'+key(name);if(!childByName.has(k)&&!seen.has(k)){seen.add(k);wanted.push({parent,name,ord:wanted.length})}});
  }
  if(wanted.length){
   const rows=await sql`
    INSERT INTO os_topics(owner_id,subject_id,parent_id,name,position)
    SELECT ${owner},${b.subjectId}::uuid,x.parent,x.name,x.ord
    FROM jsonb_to_recordset(${JSON.stringify(wanted)}::jsonb) AS x(parent uuid,name text,ord int)
    RETURNING id,name,parent_id`;
   for(const r of rows)childByName.set(String(r.parent_id)+'|'+key(String(r.name)),String(r.id));
  }

  const result=items.map(i=>{
   const id=mainByName.get(key(i.name))!;
   return {id,name:i.name,children:i.children.map(name=>({id:childByName.get(id+'|'+key(name))!,name}))};
  });
  const topics=await sql`SELECT id,name,position,parent_id FROM os_topics WHERE owner_id=${owner} AND subject_id=${b.subjectId} ORDER BY position,name`;
  return Response.json({items:result,topics},{status:201});
 }catch(e){return apiError(e)}
}
