'use client';
import {useMemo,useState} from 'react';
import {Icon,spineColor} from './icons';
import Borito from './Borito';
import {konyvCim} from '../../lib/konyv-cim';
import {KIND_LABEL} from '../../lib/besorolas';

export type LinkRow={
 link_id:string;topic_id:string;topic_name:string;depth:number;pdf_page:number|null;chapter_title:string|null;category:string;
 id:string;title:string;filename:string|null;mime_type:string;grade?:number|null;level?:string|null;kind?:string|null;
};
export type VideoRow={id:string;title:string;url:string;provider:string;note:string;topic_id:string;topic_name:string};

type Props={
 rows:LinkRow[]|null;videos:VideoRow[];editing:boolean;busy:boolean;
 onOpen:(row:LinkRow)=>void;onRename:(row:LinkRow)=>void;onUnlink:(row:LinkRow)=>void;
};

/**
 * Témaoldal: a téma (és altémái) minden könyvi hivatkozása, évfolyamonként,
 * könyvenként egy kártyán, borítóval. Rányomsz, és a könyv ott nyílik ki.
 */
export default function Temaoldal({rows,videos,editing,busy,onOpen,onRename,onUnlink}:Props){
 const [gradeFilter,setGradeFilter]=useState<number|'all'>('all');
 const [onlyEmelt,setOnlyEmelt]=useState(false);

 const grades=useMemo(()=>[...new Set((rows||[]).map(r=>r.grade??0))].sort((a,b)=>(a||99)-(b||99)),[rows]);
 const hasEmelt=(rows||[]).some(r=>r.level==='emelt');
 const shown=(rows||[]).filter(r=>(gradeFilter==='all'||(r.grade??0)===gradeFilter)&&(!onlyEmelt||r.level==='emelt'));

 // Évfolyam → könyv (+ típus) → fejezetek.
 const sections=useMemo(()=>{
  const byGrade=new Map<number,Map<string,LinkRow[]>>();
  for(const r of shown){
   const g=r.grade??0;const k=r.id+':'+(r.kind||r.category||'');
   if(!byGrade.has(g))byGrade.set(g,new Map());
   const books=byGrade.get(g)!;const list=books.get(k);if(list)list.push(r);else books.set(k,[r]);
  }
  return [...byGrade.entries()].sort((a,b)=>(a[0]||99)-(b[0]||99)).map(([g,books])=>({grade:g,books:[...books.values()].map(list=>[...list].sort((a,b)=>(a.pdf_page||0)-(b.pdf_page||0)))}));
 },[shown]);

 if(rows===null)return <p className="us-status">Anyagok betöltése…</p>;

 return <div className="us-topicpage">
  {(grades.length>1||hasEmelt)&&<div className="us-chips" role="group" aria-label="Szűrés">
   {grades.length>1&&<>
    <button type="button" className="us-chip" aria-pressed={gradeFilter==='all'} onClick={()=>setGradeFilter('all')}>Minden évfolyam</button>
    {grades.map(g=><button key={g} type="button" className="us-chip" aria-pressed={gradeFilter===g} onClick={()=>setGradeFilter(g)}>{g?g+'.':'Évfolyam nélkül'}</button>)}
   </>}
   {hasEmelt&&<button type="button" className="us-chip us-chip-emelt" aria-pressed={onlyEmelt} onClick={()=>setOnlyEmelt(v=>!v)}>Csak emelt</button>}
  </div>}

  {sections.length===0&&<p className="us-status" style={{margin:0}}>Ehhez a témához még nincs könyvi hivatkozás.</p>}

  {sections.map(sec=><section key={sec.grade} className="us-grade" aria-label={sec.grade?sec.grade+'. évfolyam':'Évfolyam nélkül'}>
   {(sections.length>1||sec.grade>0)&&<h3 className="us-grade-head">{sec.grade?sec.grade+'. évfolyam':'Évfolyam nincs megadva'}<small>{sec.books.length} könyv</small></h3>}
   <div className="us-books">
    {sec.books.map(list=>{
     const d=list[0];const color=spineColor(d.id);const isPdf=d.mime_type==='application/pdf';
     const kind=KIND_LABEL[d.kind||d.category||'reference']||'Anyag';
     const chapters=isPdf?list.filter(x=>x.pdf_page):[];
     const head=<>
      <span className="us-book-kind" style={{color}}>{kind}{d.level==='emelt'&&<span className="us-badge">Emelt</span>}</span>
      <span className="us-book-title">{konyvCim(d.title,d.filename)}</span>
     </>;
     if(editing)return <div key={d.link_id} className={'us-book is-edit'+(list.length>1?' has-ch':'')}>
      <Borito id={d.id} pdf={isPdf}/>
      <span className="us-book-body">
       {head}
       <span className="us-edit-actions">
        <button type="button" className="us-btn us-btn-ghost us-edit-rename" onClick={()=>onRename(d)} disabled={busy}><Icon name="pen" size={16}/>Átnevezés</button>
        <a className="us-btn us-btn-ghost us-edit-rename" href={'/konyvtar?doc='+encodeURIComponent(d.id)}><Icon name="lines" size={16}/>Besorolás</a>
       </span>
       <span className="us-ch">
        {list.map(c=><span key={c.link_id} className="us-ch-edit">
         <span className="us-ch-page">{c.pdf_page?c.pdf_page+'. o.':'eleje'}</span>
         <span className="us-ch-title">{c.chapter_title||(c.pdf_page?'Fejezet':'Az egész könyv')}{c.depth>0&&<small className="us-ch-topic">{c.topic_name}</small>}</span>
         <button type="button" className="us-icon-btn" aria-label={'Levétel erről a témáról: '+(c.chapter_title||c.pdf_page||'')} onClick={()=>onUnlink(c)} disabled={busy}><Icon name="trash" size={16}/></button>
        </span>)}
       </span>
      </span>
     </div>;
     if(chapters.length>1)return <div key={d.link_id} className="us-book has-ch">
      <Borito id={d.id} pdf={isPdf}/>
      <span className="us-book-body">
       {head}
       <span className="us-book-where">{chapters.length} helyen szerepel ez a téma. Koppints arra, amelyiket most tanítod.</span>
       <span className="us-ch">
        {chapters.map(c=><button key={c.link_id} type="button" className="us-ch-btn" onClick={()=>onOpen(c)}>
         <span className="us-ch-page">{c.pdf_page}. o.</span>
         <span className="us-ch-title"><span>{c.chapter_title||'Fejezet'}</span>{c.depth>0&&<small className="us-ch-topic">{c.topic_name}</small>}</span>
        </button>)}
       </span>
      </span>
     </div>;
     const only=chapters[0]||d;
     return <button key={d.link_id} type="button" className="us-book" onClick={()=>onOpen(only)}>
      <Borito id={d.id} pdf={isPdf}/>
      <span className="us-book-body">
       {head}
       <span className="us-book-where">{isPdf?(only.pdf_page?(only.chapter_title?only.chapter_title+' · ':'')+only.pdf_page+'. oldal':'Még nincs megadva a hely, az elején nyílik'):'Eredeti fájl megnyitása'}</span>
       {only.depth>0&&<span className="us-ch-topic">{only.topic_name}</span>}
       <span className="us-book-open">Kinyitom<Icon name="arrow" size={16} strokeWidth={2.2}/></span>
      </span>
     </button>;
    })}
   </div>
  </section>)}

  {videos.length>0&&<section className="us-grade" aria-label="Videók">
   <h3 className="us-grade-head">Videók és linkek<small>{videos.length} db</small></h3>
   <div className="us-videos">
    {videos.map(v=><a key={v.id} className="us-video" href={v.url} target="_blank" rel="noopener noreferrer">
     <span className="us-video-play" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor"/></svg></span>
     <span className="us-video-body"><small>{v.provider} · videó</small><b>{v.title}</b>{v.topic_name&&<small>{v.topic_name}</small>}</span>
     <Icon name="external" size={16} stroke="#586274"/>
    </a>)}
   </div>
  </section>}
 </div>;
}
