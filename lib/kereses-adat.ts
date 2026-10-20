import {database,schemaMissing} from './server';
import {konyvCim} from './konyv-cim';

/** Egy kereshető elem. A `cel` mondja meg, hová ugrik a találat. */
export type KeresoElem={
 kind:'topic'|'doc'|'chapter'|'note'|'task'|'lesson'|'video';
 id:string;
 cim:string;      // ami a találati sorban vastagon látszik
 alcim:string;    // könyv, tantárgy, oldal
 szoveg:string;   // amiben keresünk (a cím mellett)
 cel:{href:string;kulso?:boolean}|{topicId:string;subjectId:string};
};

/** Ha egy tábla még nincs meg (régebbi adatbázis-frissítés hiányzik), üres listát adunk. */
async function biztos<T>(p:PromiseLike<unknown>):Promise<T[]>{
 try{return (await p) as T[]}catch(e){if(schemaMissing(e))return [];throw e}
}
const olvaso=(doc:string,page?:number|null)=>'/olvaso?doc='+encodeURIComponent(doc)+(page?'&page='+page:'');

/** A felhasználó összes kereshető adata. Néhány ezer sor, a pontozás a szerveren fut. */
export async function keresoElemek(owner:string):Promise<KeresoElem[]>{
 const sql=database();
 type Topic={id:string;name:string;subject_id:string;subject_name:string;parent_name:string|null};
 type Doc={id:string;title:string;filename:string|null;contents:{title:string;page:number;group?:string}[]|null};
 type Link={document_id:string;chapter_title:string;pdf_page:number|null};
 type Note={id:string;document_id:string;pdf_page:number;body:string;title:string;filename:string|null};
 type Task={id:string;answer:string;note:string;topic_name:string|null;title:string|null;filename:string|null;pdf_page:number|null};
 type Lesson={id:string;content:string;lesson_no:number|null;plan_name:string;topic_id:string|null;subject_id:string};
 type Video={id:string;title:string;note:string;url:string;provider:string};
 const [topics,docs,links,notes,tasks,lessons,videos]=await Promise.all([
  biztos<Topic>(sql`SELECT t.id,t.name,t.subject_id,s.name AS subject_name,p.name AS parent_name FROM os_topics t JOIN os_subjects s ON s.id=t.subject_id AND s.owner_id=${owner} LEFT JOIN os_topics p ON p.id=t.parent_id WHERE t.owner_id=${owner} ORDER BY s.position,t.position`),
  (async()=>{
   try{return (await sql`SELECT id,title,filename,contents FROM os_documents WHERE owner_id=${owner} AND state='ready' ORDER BY created_at DESC`) as Doc[]}
   catch(e){if(!schemaMissing(e))throw e;return (await sql`SELECT id,title,filename,NULL::jsonb AS contents FROM os_documents WHERE owner_id=${owner} AND state='ready'`) as Doc[]}
  })(),
  biztos<Link>(sql`SELECT DISTINCT document_id,chapter_title,pdf_page FROM os_document_links WHERE owner_id=${owner} AND chapter_title IS NOT NULL AND chapter_title<>''`),
  biztos<Note>(sql`SELECT n.id,n.document_id,n.pdf_page,n.body,d.title,d.filename FROM os_pdf_notes n JOIN os_documents d ON d.id=n.document_id WHERE n.owner_id=${owner}`),
  biztos<Task>(sql`SELECT k.id,k.answer,k.note,t.name AS topic_name,d.title,d.filename,k.pdf_page FROM os_tasks k LEFT JOIN os_topics t ON t.id=k.topic_id LEFT JOIN os_documents d ON d.id=k.document_id WHERE k.owner_id=${owner}`),
  biztos<Lesson>(sql`SELECT l.id,l.content,l.lesson_no,p.name AS plan_name,l.topic_id,p.subject_id FROM os_plan_lessons l JOIN os_plans p ON p.id=l.plan_id WHERE l.owner_id=${owner}`),
  biztos<Video>(sql`SELECT id,title,note,url,provider FROM os_videos WHERE owner_id=${owner}`)
 ]);
 const out:KeresoElem[]=[];
 const topicById=new Map(topics.map(t=>[t.id,t]));
 for(const t of topics)out.push({kind:'topic',id:t.id,cim:t.name,alcim:t.parent_name?t.parent_name:t.subject_name,szoveg:'',cel:{topicId:t.id,subjectId:t.subject_id}});
 const docName=new Map<string,string>();
 const seen=new Set<string>();
 for(const d of docs){
  const nev=konyvCim(d.title,d.filename);docName.set(d.id,nev);
  out.push({kind:'doc',id:d.id,cim:nev,alcim:'könyv',szoveg:d.filename||'',cel:{href:olvaso(d.id)}});
  for(const c of Array.isArray(d.contents)?d.contents:[]){
   const key=d.id+'|'+c.page+'|'+c.title.toLowerCase();if(seen.has(key))continue;seen.add(key);
   out.push({kind:'chapter',id:key,cim:c.title,alcim:nev+', '+c.page+'. oldal',szoveg:c.group||'',cel:{href:olvaso(d.id,c.page)}});
  }
 }
 // Régebben párosított könyvek: a fejezetcím csak a párosításban van meg.
 for(const l of links){
  const nev=docName.get(l.document_id);if(!nev)continue;
  const key=l.document_id+'|'+(l.pdf_page||0)+'|'+l.chapter_title.toLowerCase();if(seen.has(key))continue;seen.add(key);
  out.push({kind:'chapter',id:key,cim:l.chapter_title,alcim:nev+(l.pdf_page?', '+l.pdf_page+'. oldal':''),szoveg:'',cel:{href:olvaso(l.document_id,l.pdf_page)}});
 }
 for(const n of notes)out.push({kind:'note',id:n.id,cim:n.body,alcim:'cetli · '+konyvCim(n.title,n.filename)+', '+n.pdf_page+'. oldal',szoveg:'',cel:{href:olvaso(n.document_id,n.pdf_page)}});
 for(const k of tasks)out.push({kind:'task',id:k.id,cim:k.note||k.answer,alcim:'mentett feladat'+(k.topic_name?' · '+k.topic_name:k.title?' · '+konyvCim(k.title,k.filename)+(k.pdf_page?', '+k.pdf_page+'. oldal':''):''),szoveg:k.note?k.answer:'',cel:{href:'/feladatok?task='+encodeURIComponent(k.id)}});
 for(const l of lessons){
  const t=l.topic_id?topicById.get(l.topic_id):undefined;
  out.push({kind:'lesson',id:l.id,cim:l.content,alcim:'tanmenet · '+l.plan_name+(l.lesson_no?', '+l.lesson_no+'. óra':''),szoveg:'',cel:t?{topicId:t.id,subjectId:t.subject_id}:{href:'/tanmenet'}});
 }
 for(const v of videos)if(/^https?:\/\//i.test(v.url))out.push({kind:'video',id:v.id,cim:v.title,alcim:'videó · '+v.provider,szoveg:v.note,cel:{href:v.url,kulso:true}});
 return out;
}
