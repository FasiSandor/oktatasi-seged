/**
 * Az órafelkészítő lap szerkezete (0.5.0). A szerver és a felület is ezt használja.
 * A lap JSON-ként tárolódik az os_lessons.content oszlopban, nem PDF-ként.
 */

/** Honnan való egy feladat: könyv, oldal, feladat jelölése. Null, ha az AI találta ki. */
export type PrepSource={book:string;page:number|null;task:string}|null;

export type PrepItem={
 id:string;
 /** Fogalomnál a fogalom neve. */
 title?:string;
 /** Előismeretnél az előismeret, fogalomnál a definíció, feladatnál a feladat szövege. */
 text:string;
 /** Csak előismeretnél: a hozzá tartozó szabály, képlet. */
 rule?:string;
 /** Csak feladatnál: a megoldás. */
 solution?:string;
 source?:PrepSource;
 /** Igaz, ha a feladatot az AI írta (nem a könyvből van). Ezt a lap „AI-feladat” jelöléssel mutatja. */
 ai:boolean;
 /** A „Ellenőrizd újra” eredménye: egyezik-e az újraszámolás a megoldással. */
 check?:'ok'|'diff'|null;
 checkNote?:string;
};

export type PrepContent={
 v:1;
 prereq:PrepItem[];
 concepts:PrepItem[];
 examples:PrepItem[];
 practice:PrepItem[];
};

export type PrepKind='prereq'|'concept'|'example'|'practice';

export const SECTION_OF:Record<PrepKind,'prereq'|'concepts'|'examples'|'practice'>={prereq:'prereq',concept:'concepts',example:'examples',practice:'practice'};

export const EMPTY_CONTENT:PrepContent={v:1,prereq:[],concepts:[],examples:[],practice:[]};

/** Egy felhasznált forrás: könyv és a kijelölt oldalak. */
export type PrepBookSource={documentId?:string;title:string;pages:number[]};

export const LIMITS={items:40,title:200,text:4000,rule:2000,solution:6000,book:200,task:80,note:1000,total:200_000};

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID=/^[A-Za-z0-9_-]{1,60}$/;

export const newId=()=>globalThis.crypto.randomUUID();

const str=(v:unknown,max:number)=>typeof v==='string'?v.trim().slice(0,max):'';

export function cleanSource(raw:unknown):PrepSource{
 if(!raw||typeof raw!=='object')return null;
 const r=raw as Record<string,unknown>;
 const book=str(r.book,LIMITS.book);
 if(!book)return null;
 const page=Number.isInteger(r.page)&&Number(r.page)>=1&&Number(r.page)<=5000?Number(r.page):null;
 return {book,page,task:str(r.task,LIMITS.task)};
}

function cleanItem(raw:unknown,kind:'prereq'|'concepts'|'examples'|'practice'):PrepItem{
 if(!raw||typeof raw!=='object')throw Error('INVALID');
 const r=raw as Record<string,unknown>;
 const text=str(r.text,LIMITS.text);
 if(!text)throw Error('INVALID');
 const item:PrepItem={id:typeof r.id==='string'&&ID.test(r.id)?r.id:newId(),text,ai:false};
 if(kind==='concepts'){const title=str(r.title,LIMITS.title);if(title)item.title=title}
 if(kind==='prereq'){const rule=str(r.rule,LIMITS.rule);if(rule)item.rule=rule}
 if(kind==='examples'||kind==='practice'){
  const solution=str(r.solution,LIMITS.solution);
  if(solution)item.solution=solution;
  item.source=cleanSource(r.source);
  item.ai=r.ai===true;
  if(r.check==='ok'||r.check==='diff')item.check=r.check;
  const note=str(r.checkNote,LIMITS.note);
  if(note)item.checkNote=note;
 }
 return item;
}

/** A kliensből érkező lap ellenőrzése és tisztítása. Hibás szerkezetnél INVALID hibát dob. */
export function cleanContent(raw:unknown):PrepContent{
 if(!raw||typeof raw!=='object')throw Error('INVALID');
 const r=raw as Record<string,unknown>;
 const section=(key:'prereq'|'concepts'|'examples'|'practice')=>{
  const list=r[key];
  if(list==null)return [];
  if(!Array.isArray(list)||list.length>LIMITS.items)throw Error('INVALID');
  return list.map(x=>cleanItem(x,key));
 };
 const content:PrepContent={v:1,prereq:section('prereq'),concepts:section('concepts'),examples:section('examples'),practice:section('practice')};
 if(JSON.stringify(content).length>LIMITS.total)throw Error('INVALID');
 return content;
}

export const itemCount=(c:PrepContent)=>c.prereq.length+c.concepts.length+c.examples.length+c.practice.length;

/** A felhasznált források ellenőrzése: legfeljebb 20 könyv, könyvenként legfeljebb 100 oldal. */
export function cleanSources(raw:unknown):PrepBookSource[]{
 if(raw==null)return [];
 if(!Array.isArray(raw)||raw.length>20)throw Error('INVALID');
 return raw.map(x=>{
  if(!x||typeof x!=='object')throw Error('INVALID');
  const r=x as Record<string,unknown>;
  const title=str(r.title,LIMITS.book);
  if(!title)throw Error('INVALID');
  const pages=Array.isArray(r.pages)?r.pages.filter((p):p is number=>Number.isInteger(p)&&p>=1&&p<=5000).slice(0,100):[];
  const out:PrepBookSource={title,pages};
  if(typeof r.documentId==='string'&&UUID.test(r.documentId))out.documentId=r.documentId;
  return out;
 });
}

/** 2026-11-10 → „2026. 11. 10.” */
export function datumSzoveg(iso:string):string{
 const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(iso||'');
 return m?m[1]+'. '+m[2]+'. '+m[3]+'.':iso||'';
}

/** Egy feladat forrása olvasható szövegként: „Könyv, 12. oldal, 3.” */
export function forrasSzoveg(s:PrepSource|undefined):string{
 if(!s)return '';
 return s.book+(s.page?', '+s.page+'. oldal':'')+(s.task?', '+s.task:'');
}
