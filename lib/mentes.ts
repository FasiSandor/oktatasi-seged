'use client';
import type JSZipType from 'jszip';
// A ZIP-kezelő csak mentéskor és visszaállításkor töltődik be.
const loadZip=async()=>(await import('jszip')).default;
import {api} from './client-api';

/**
 * Biztonsági mentés ZIP-ben (a központi szabályzat 6. pontja szerint):
 * - manifest.json: alkalmazás, formátumverzió, időpont, táblánként sorszám és SHA-256 ellenőrzőösszeg,
 *   és a mentésből kimaradt fájlok (a könyvek PDF-jei) listája;
 * - data/<tábla>.json: az adatok;
 * - OLVASSEL.txt: rövid magyarázat.
 * A PDF-ek a privát tárhelyen maradnak; méretük miatt nincsenek a csomagban.
 */
export const APP_ID='oktatasi-seged';
export const FORMAT_VERSION=2;

type Rows=Record<string,unknown>[];
export type TableInfo={name:string;rows:number;file:string;sha256:string};
export type Manifest={
 app:string;format:'oktatasi-seged-mentes';formatVersion:number;appVersion:string;createdAt:string;
 tables:TableInfo[];notIncluded:{what:string;count:number;totalBytes:number;files:{id:string;title:string;filename:string|null;bytes:number|null}[]};
};
export type ReadResult={manifest:Pick<Manifest,'createdAt'|'appVersion'|'formatVersion'>;tables:Record<string,Rows>;checks:{name:string;rows:number;ok:boolean}[];problems:string[]};

const enc=new TextEncoder();
async function sha256(text:string){
 const digest=await crypto.subtle.digest('SHA-256',enc.encode(text));
 return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
export const tableLabel=(name:string)=>({
 os_subjects:'Tantárgyak',os_topics:'Témák',os_documents:'Könyvek és dokumentumok adatai',os_document_links:'Párosítások (fejezet → téma)',
 os_tool_links:'Eszközlinkek',os_reading_positions:'Olvasási helyek',os_curriculum_profiles:'Tantervi profilok',os_curriculum_sources:'Tantervi források',
 os_curriculum_placements:'Óraszámok',os_topic_requirements:'Követelmények a témákhoz',os_pdf_notes:'Oldaljegyzetek',os_pdf_marks:'Régi kiemelések',
 os_pdf_ink:'Kiemelések és rajzok',os_videos:'Videók',os_lesson_workspaces:'Témajegyzetek',os_plans:'Tanmenetek',os_plan_lessons:'Tanmenetórák',os_ai_usage:'AI-használat',os_tasks:'Mentett feladatok'
} as Record<string,string>)[name]||name;

export async function makeBackup(onProgress:(text:string)=>void):Promise<{blob:Blob;manifest:Manifest}>{
 const {tables}=await api<{tables:string[]}>('backup');
 const JSZip=await loadZip();
 const zip=new JSZip();
 const infos:TableInfo[]=[];let docs:Rows=[];
 for(const name of tables){
  const rows:Rows=[];let offset=0;
  for(;;){
   const r=await api<{rows:Rows;more:boolean}>('backup?table='+name+'&offset='+offset,{},60000);
   rows.push(...r.rows);offset+=r.rows.length;onProgress('Mentés: '+tableLabel(name)+' ('+rows.length+')');
   if(!r.more)break;
  }
  if(name==='os_documents')docs=rows;
  const text=JSON.stringify(rows);
  const file='data/'+name+'.json';
  zip.file(file,text);
  infos.push({name,rows:rows.length,file,sha256:await sha256(text)});
 }
 const files=docs.filter(d=>d.storage_key).map(d=>({id:String(d.id),title:String(d.title||''),filename:(d.filename as string)||null,bytes:d.byte_size==null?null:Number(d.byte_size)}));
 const manifest:Manifest={
  app:APP_ID,format:'oktatasi-seged-mentes',formatVersion:FORMAT_VERSION,appVersion:process.env.NEXT_PUBLIC_APP_VERSION||'',createdAt:new Date().toISOString(),
  tables:infos,
  notIncluded:{what:'A feltöltött fájlok (könyvek PDF-jei, dokumentumok) és a mentett feladatok képei a privát tárhelyen maradnak, nincsenek a mentésben.',count:files.length,totalBytes:files.reduce((n,f)=>n+(f.bytes||0),0),files}
 };
 zip.file('manifest.json',JSON.stringify(manifest,null,1));
 zip.file('OLVASSEL.txt',[
  'Oktatási Segéd – biztonsági mentés',
  'Készült: '+new Date(manifest.createdAt).toLocaleString('hu-HU'),
  '',
  'Benne: tantárgyak, témák, könyvek adatai és párosításai, jegyzetek, kiemelések, óraszámok, tanmenetek, videók.',
  'Nincs benne: a könyvek PDF-jei és a feltöltött dokumentumok ('+files.length+' fájl). Ezek a privát tárhelyen maradnak.',
  'Visszaállítás: Oktatási Segéd → Beállítások → Mentés és visszaállítás → Visszaállítás fájlból.',
  'A visszaállítás csak a hiányzó adatot veszi vissza, a meglévőt nem írja felül.'
 ].join('\n'));
 onProgress('Tömörítés…');
 const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}});
 return {blob,manifest};
}

/** Mentésfájl beolvasása és ellenőrzése (ZIP, vagy a korábbi egyfájlos JSON). */
export async function readBackup(file:File):Promise<ReadResult>{
 const problems:string[]=[];
 if(/\.json$/i.test(file.name)||file.type==='application/json'){
  const data=JSON.parse(await file.text());
  if(data?.app!==APP_ID||!data.tables)throw new Error('Ez nem egy Oktatási Segéd mentésfájl.');
  problems.push('Régi formátumú mentés: ellenőrzőösszeg nincs benne, ezért az épségét nem tudom igazolni.');
  return {manifest:{createdAt:data.created_at,appVersion:'',formatVersion:1},tables:data.tables,checks:Object.entries(data.tables as Record<string,Rows>).map(([name,rows])=>({name,rows:rows.length,ok:true})),problems};
 }
 const JSZip=await loadZip();
 let zip:JSZipType;
 try{zip=await JSZip.loadAsync(file)}catch{throw new Error('A fájl nem nyitható meg ZIP-ként.')}
 const mf=zip.file('manifest.json');if(!mf)throw new Error('A ZIP-ben nincs manifest.json, ez nem Oktatási Segéd mentés.');
 const manifest=JSON.parse(await mf.async('string')) as Manifest;
 if(manifest.app!==APP_ID||manifest.format!=='oktatasi-seged-mentes')throw new Error('Ez nem egy Oktatási Segéd mentésfájl.');
 if(manifest.formatVersion>FORMAT_VERSION)throw new Error('Ezt a mentést az app egy újabb változata készítette. Előbb frissíteni kell az appot.');
 const tables:Record<string,Rows>={};const checks:ReadResult['checks']=[];
 for(const t of manifest.tables){
  const f=zip.file(t.file);
  if(!f){problems.push(tableLabel(t.name)+': a fájl hiányzik a csomagból.');checks.push({name:t.name,rows:t.rows,ok:false});continue}
  const text=await f.async('string');
  const ok=(await sha256(text))===t.sha256;
  if(!ok)problems.push(tableLabel(t.name)+': az ellenőrzőösszeg nem egyezik, a fájl sérült vagy módosult. Ezt a részt kihagyom.');
  const rows=ok?JSON.parse(text) as Rows:[];
  if(ok&&rows.length!==t.rows)problems.push(tableLabel(t.name)+': a sorok száma eltér a jegyzéktől.');
  tables[t.name]=rows;checks.push({name:t.name,rows:t.rows,ok});
 }
 return {manifest:{createdAt:manifest.createdAt,appVersion:manifest.appVersion,formatVersion:manifest.formatVersion},tables,checks,problems};
}

/** Visszaállítás a szerver táblasorrendjében, 500 soros részletekben. Csak hiányzó sorokat vesz fel. */
export async function restoreBackup(data:ReadResult,onProgress:(text:string)=>void){
 const {tables}=await api<{tables:string[]}>('backup');
 const lines:{name:string;inserted:number;skipped:number;error:boolean}[]=[];
 for(const name of tables){
  const rows=data.tables[name]||[];
  if(!rows.length)continue;
  let inserted=0,skipped=0,error=false;
  for(let i=0;i<rows.length;i+=500){
   onProgress('Visszaállítás: '+tableLabel(name)+' ('+i+' / '+rows.length+')');
   const r=await api<{inserted:number;skipped:number;error?:string}>('backup',{method:'POST',body:JSON.stringify({table:name,rows:rows.slice(i,i+500)})},60000);
   inserted+=r.inserted;skipped+=r.skipped;if(r.error)error=true;
  }
  lines.push({name,inserted,skipped,error});
 }
 return lines;
}
