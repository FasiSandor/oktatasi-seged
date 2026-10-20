'use client';
import {useState} from 'react';
import {api} from '../../lib/client-api';
import {konyvCim} from '../../lib/konyv-cim';
import {Icon} from './icons';
import {Valasz} from './olvaso/AiSegitseg';

export type Task={
 id:string;topic_id:string|null;topic_name:string|null;subject_id?:string|null;document_id:string|null;document_title:string|null;document_filename:string|null;
 pdf_page:number|null;image_url:string|null;mode:'hint'|'steps'|'similar';answer:string;note:string;created_at:string;
};
const MODE_LABEL={hint:'Tipp',steps:'Megoldás lépésenként',similar:'Hasonló feladat'};

/** Mentett feladatok kártyái: kép a könyvből, AI-válasz, megjegyzés, ugrás a könyvbe. */
export default function Feladatok({tasks,onRemoved,onError,showTopic}:{tasks:Task[];onRemoved:(id:string)=>void;onError:(e:unknown)=>void;showTopic?:boolean}){
 return <div className="fl-grid">{tasks.map(t=><Kartya key={t.id} task={t} onRemoved={onRemoved} onError={onError} showTopic={showTopic}/>)}</div>;
}

function Kartya({task,onRemoved,onError,showTopic}:{task:Task;onRemoved:(id:string)=>void;onError:(e:unknown)=>void;showTopic?:boolean}){
 const [open,setOpen]=useState(false);
 const [note,setNote]=useState(task.note);
 const [savedNote,setSavedNote]=useState(task.note);
 const short=task.answer.split('\n').filter(l=>l.trim()).slice(0,3).join('\n').replace(/\*\*/g,'').replace(/^\*\s+/gm,'• ');
 const href=task.document_id?'/olvaso?doc='+encodeURIComponent(task.document_id)+(task.pdf_page?'&page='+task.pdf_page:'')+(task.topic_id?'&topic='+encodeURIComponent(task.topic_id)+'&label='+encodeURIComponent(task.topic_name||''):''):'';
 async function saveNote(){
  if(note===savedNote)return;
  try{await api('tasks',{method:'PATCH',body:JSON.stringify({id:task.id,note})});setSavedNote(note)}catch(e){onError(e)}
 }
 async function remove(){
  if(!window.confirm('Törlöd ezt a mentett feladatot? A könyvben semmi nem változik.'))return;
  try{await api('tasks?id='+encodeURIComponent(task.id),{method:'DELETE'});onRemoved(task.id)}catch(e){onError(e)}
 }
 return <article className={'fl-card'+(open?' is-open':'')}>
  {/* eslint-disable-next-line @next/next/no-img-element */}
  {task.image_url&&<img className="fl-img" src={task.image_url} alt="A feladat a könyvből" onClick={()=>setOpen(v=>!v)}/>}
  <div className="fl-body">
   <div className="fl-top">
    <span className="fl-mode">{MODE_LABEL[task.mode]}</span>
    <small>{new Date(task.created_at).toLocaleDateString('hu-HU')}{showTopic&&task.topic_name?' · '+task.topic_name:''}</small>
   </div>
   {open?<Valasz text={task.answer}/>:<p className="fl-short">{short}</p>}
   <button type="button" className="us-btn us-btn-ghost fl-toggle" onClick={()=>setOpen(v=>!v)}>{open?'Kevesebb':'Teljes válasz'}</button>
   <label className="sr-only" htmlFor={'fl-note-'+task.id}>Megjegyzés</label>
   <input id={'fl-note-'+task.id} className="pg-input fl-note" value={note} onChange={e=>setNote(e.target.value)} onBlur={()=>void saveNote()} placeholder="Megjegyzés, pl. 9.b, jó volt bemelegítésnek" maxLength={2000}/>
   <div className="fl-actions">
    {href&&<a className="us-btn us-btn-ghost" href={href}><Icon name="book" size={16}/>{task.document_title?konyvCim(task.document_title,task.document_filename)+(task.pdf_page?', '+task.pdf_page+'. o.':''):'Megnyitás a könyvben'}</a>}
    <button type="button" className="us-icon-btn" aria-label="Törlés" onClick={()=>void remove()}><Icon name="trash" size={16}/></button>
   </div>
  </div>
 </article>;
}
