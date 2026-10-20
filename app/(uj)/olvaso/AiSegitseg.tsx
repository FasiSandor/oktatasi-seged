'use client';
import {useEffect,useState} from 'react';
import {api,ApiError} from '../../../lib/client-api';
import {Icon} from '../icons';
import type {Box,PdfDoc} from './KonyvLap';

type Mode='hint'|'steps'|'similar';
export type Meta={grade:number|null;level:string|null;subject:string};
type Props={pdf:PdfDoc;page:number;box:Box|null;docId:string;topicId:string;meta:Meta|null;onClose:()=>void;onAuth:()=>void};

const MODES:{key:Mode;label:string;icon:'lines'|'note'|'undo'}[]=[
 {key:'hint',label:'Csak egy tipp',icon:'note'},
 {key:'steps',label:'Lépésről lépésre',icon:'lines'},
 {key:'similar',label:'Hasonló feladat',icon:'undo'}
];

type RenderablePage={getViewport:(o:{scale:number;offsetX?:number;offsetY?:number})=>{width:number;height:number};render:(o:{canvasContext:CanvasRenderingContext2D;viewport:unknown})=>{promise:Promise<void>}};

/**
 * A bekeretezett rész képe, élesen: csak ezt a részt rajzoljuk ki nagy felbontásban
 * (kb. 1400 pixel széles), nem az egész oldalt.
 */
async function cropImage(pdf:PdfDoc,pageNo:number,box:Box):Promise<string>{
 const page=await pdf.getPage(pageNo) as unknown as RenderablePage;
 const base=page.getViewport({scale:1});
 let scale=Math.min(5,Math.max(1,1400/(box.w*base.width)));
 for(let attempt=0;attempt<3;attempt++){
  const view=page.getViewport({scale,offsetX:-box.x*base.width*scale,offsetY:-box.y*base.height*scale});
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(box.w*base.width*scale));canvas.height=Math.max(1,Math.round(box.h*base.height*scale));
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('A kép nem készíthető el.');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
  await page.render({canvasContext:ctx,viewport:view}).promise;
  const data=canvas.toDataURL('image/jpeg',0.85).split(',')[1];
  canvas.width=0;canvas.height=0;
  if(data.length<1_500_000)return data;
  scale*=0.75;
 }
 throw new Error('A bekeretezett rész túl nagy. Keretezz be kisebb részt.');
}

/** Egyszerű megjelenítés: sorok, számozott lépések, **félkövér**. */
export function Valasz({text}:{text:string}){
 const lines=text.replace(/\r/g,'').split('\n');
 return <div className="ai-answer">
  {lines.map((line,i)=>{
   const t=line.trim();if(!t)return <div key={i} className="ai-gap"/>;
   const parts=t.split(/\*\*(.+?)\*\*/g).map((p,j)=>j%2?<b key={j}>{p}</b>:p.replace(/^\*\s+/,'• ').replace(/\*/g,''));
   const num=t.match(/^(\d{1,2})[.)]\s/);
   if(num)return <p key={i} className="ai-step"><span>{num[1]}.</span><span>{t.slice(num[0].length).split(/\*\*(.+?)\*\*/g).map((p,j)=>j%2?<b key={j}>{p}</b>:p.replace(/\*/g,''))}</span></p>;
   if(/^(Végeredmény|Megoldás)\s*:/i.test(t))return <p key={i} className="ai-final">{parts}</p>;
   return <p key={i}>{parts}</p>;
  })}
 </div>;
}

export default function AiSegitseg({pdf,page,box,docId,topicId,meta,onClose,onAuth}:Props){
 const [image,setImage]=useState('');
 const [mode,setMode]=useState<Mode|null>(null);
 const [answer,setAnswer]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [note,setNote]=useState('');
 const [saved,setSaved]=useState<'no'|'saving'|'yes'>('no');

 // Új keret: új kép, az előző válasz eltűnik.
 useEffect(()=>{
  setAnswer('');setMode(null);setError('');setSaved('no');setNote('');setImage('');
  if(!box)return;
  let alive=true;
  cropImage(pdf,page,box).then(d=>{if(alive)setImage(d)}).catch(e=>{if(alive)setError(e instanceof Error?e.message:'A kép nem készíthető el.')});
  return()=>{alive=false};
 },[pdf,page,box]);

 async function ask(m:Mode){
  if(!image||busy)return;
  setMode(m);setBusy(true);setError('');setAnswer('');setSaved('no');
  try{
   const r=await api<{text:string}>('ai-help',{method:'POST',body:JSON.stringify({image,mode:m,grade:meta?.grade??null,level:meta?.level??null,subject:meta?.subject||''})},65000);
   setAnswer(r.text);
  }catch(e){
   if(e instanceof ApiError&&e.status===401){onAuth();return}
   setError(e instanceof Error?e.message:'Az AI most nem válaszolt.');
  }finally{setBusy(false)}
 }
 async function save(){
  if(!answer||!mode||!image)return;
  setSaved('saving');setError('');
  try{
   await api('tasks',{method:'POST',body:JSON.stringify({image,mode,answer,note,documentId:docId,page,topicId:topicId||null})},30000);
   setSaved('yes');
  }catch(e){
   setSaved('no');
   if(e instanceof ApiError&&e.status===401){onAuth();return}
   setError(e instanceof Error?e.message:'A mentés nem sikerült.');
  }
 }

 return <section className="ai-panel" aria-label="AI-segítség a feladathoz">
  <div className="ai-head">
   <span className="ai-badge">AI</span><b>Segítség a feladathoz</b>
   <button type="button" className="us-icon-btn" aria-label="Bezárás" onClick={onClose}><Icon name="close" size={16}/></button>
  </div>
  {!box&&<p className="rd-hint">Keretezd be a feladatot az oldalon: húzd végig az ujjad vagy a Pencilt a feladat egyik sarkától az átellenes sarkáig.</p>}
  {box&&<>
   {image?<img className="ai-crop" src={'data:image/jpeg;base64,'+image} alt="A bekeretezett feladat"/>:!error&&<p className="rd-hint">A kép készül…</p>}
   <div className="ai-modes">
    {MODES.map(m=><button key={m.key} type="button" className={'ai-mode'+(mode===m.key?' is-on':'')} disabled={!image||busy} onClick={()=>void ask(m.key)}><Icon name={m.icon} size={16}/>{m.label}</button>)}
   </div>
  </>}
  {busy&&<div className="up-ai-busy" role="status" style={{margin:0}}><span className="up-ai-bar" aria-hidden="true"/><span>Az AI dolgozik a feladaton…</span></div>}
  {error&&<p className="up-error" role="alert">{error}</p>}
  {answer&&<>
   <Valasz text={answer}/>
   <p className="ai-warn">Az AI tévedhet. Mielőtt a táblára kerül, nézd át.</p>
   <div className="ai-save">
    <label className="sr-only" htmlFor="ai-note">Saját megjegyzés</label>
    <input id="ai-note" className="pg-input" value={note} onChange={e=>setNote(e.target.value)} placeholder="Megjegyzés (nem kötelező), pl. 9.b, bemelegítés" maxLength={2000} disabled={saved==='yes'}/>
    <button type="button" className="us-btn us-btn-dark" disabled={saved!=='no'} onClick={()=>void save()}>{saved==='yes'?'Elmentve':saved==='saving'?'Mentés…':'Mentés a feladatok közé'}</button>
   </div>
   {saved==='yes'&&<p className="rd-hint">A témaoldalon a „Mentett feladatok” között, és a menü „Feladataim” oldalán találod.</p>}
  </>}
 </section>;
}
