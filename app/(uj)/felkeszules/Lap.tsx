'use client';
import {useState} from 'react';
import {Icon} from '../icons';
import {Valasz} from '../olvaso/AiSegitseg';
import {forrasSzoveg,LIMITS,type PrepContent,type PrepItem,type PrepKind} from '../../../lib/orafelkeszito';
import type {Ellenorzes} from '../../../lib/felkeszules-kliens';

export type Szakasz='prereq'|'concepts'|'examples'|'practice';

const SZAKASZOK:{key:Szakasz;kind:PrepKind;cim:string;ures:string;max:number}[]=[
 {key:'prereq',kind:'prereq',cim:'Előismeretek',ures:'Nincs előismeret a lapon.',max:10},
 {key:'concepts',kind:'concept',cim:'Fogalmak, definíciók',ures:'Nincs fogalom a lapon.',max:14},
 {key:'examples',kind:'example',cim:'Mintafeladatok',ures:'Nincs mintafeladat a lapon.',max:10},
 {key:'practice',kind:'practice',cim:'Gyakorló feladatok',ures:'Nincs gyakorló feladat a lapon.',max:14}
];

export type Muveletek={
 /** Egy új elem a megadott fajtából; az `avoid` a már meglévők szövege. */
 uj:(kind:PrepKind,avoid:string[])=>Promise<PrepItem>;
 ellenoriz:(item:PrepItem)=>Promise<Ellenorzes>;
 ujra:(s:Szakasz)=>void;
};

const uzenet=(e:unknown)=>e instanceof Error?e.message:'Ismeretlen hiba';

/** A felkészülési lap szerkeszthető nézete: négy rész, minden elem külön törölhető, átírható, cserélhető. */
export default function Lap({content,onChange,ops,foglalt}:{content:PrepContent;onChange:(c:PrepContent)=>void;ops:Muveletek;foglalt:boolean}){
 return <>{SZAKASZOK.map(f=><Resz key={f.key} f={f} list={content[f.key]} foglalt={foglalt} ops={ops} onList={l=>onChange({...content,[f.key]:l})}/>)}</>;
}

function Resz({f,list,onList,ops,foglalt}:{f:typeof SZAKASZOK[number];list:PrepItem[];onList:(l:PrepItem[])=>void;ops:Muveletek;foglalt:boolean}){
 const [uj,setUj]=useState(false);
 const [hiba,setHiba]=useState('');
 const mind=()=>list.map(x=>x.title||x.text);

 async function ujElem(){
  setUj(true);setHiba('');
  try{onList([...list,await ops.uj(f.kind,mind())])}
  catch(e){setHiba(uzenet(e))}
  finally{setUj(false)}
 }
 function ujra(){
  if(list.length&&!window.confirm('Az egész résznél újat kérek, a mostani elemek (a kézi javításaiddal együtt) eltűnnek. Mehet?'))return;
  ops.ujra(f.key);
 }

 return <section className="pf-card" aria-label={f.cim}>
  <div className="pf-head">
   <h2>{f.cim}<small>{list.length} db</small></h2>
   <div className="pf-head-btn">
    <button type="button" className="us-btn us-btn-ghost" onClick={()=>void ujElem()} disabled={foglalt||uj||list.length>=f.max}><Icon name="plus" size={16}/>{uj?'Készül…':'Új elem'}</button>
    <button type="button" className="us-btn us-btn-ghost" onClick={ujra} disabled={foglalt||uj}><Icon name="undo" size={16}/>Újra az egész rész</button>
   </div>
  </div>
  {hiba&&<p className="up-error" role="alert">{hiba}</p>}
  {list.length===0&&<p className="us-status" style={{margin:0}}>{f.ures}</p>}
  <ol className="pf-list">
   {list.map((x,i)=><Elem key={x.id} item={x} kind={f.kind} nr={i+1} foglalt={foglalt}
    onChange={n=>onList(list.map(y=>y.id===x.id?n:y))}
    onDelete={()=>onList(list.filter(y=>y.id!==x.id))}
    ops={ops} mind={mind}/>)}
  </ol>
 </section>;
}

function Elem({item,kind,nr,foglalt,onChange,onDelete,ops,mind}:{item:PrepItem;kind:PrepKind;nr:number;foglalt:boolean;onChange:(i:PrepItem)=>void;onDelete:()=>void;ops:Muveletek;mind:()=>string[]}){
 const [szerk,setSzerk]=useState(false);
 const [dolgozik,setDolgozik]=useState<''|'csere'|'ell'>('');
 const [hiba,setHiba]=useState('');
 const feladat=kind==='example'||kind==='practice';
 // A szöveg vagy a megoldás átírása után a korábbi „Ellenőrizd újra” eredmény már nem érvényes.
 const mod=(p:Partial<PrepItem>,nullaz=false)=>onChange({...item,...p,...(nullaz?{check:null,checkNote:undefined}:{})});

 async function csere(){
  setDolgozik('csere');setHiba('');
  try{onChange(await ops.uj(kind,mind()))}
  catch(e){setHiba(uzenet(e))}
  finally{setDolgozik('')}
 }
 async function ellenoriz(){
  if(!item.solution)return;
  setDolgozik('ell');setHiba('');
  try{
   const r=await ops.ellenoriz(item);
   onChange({...item,check:r.agrees?'ok':'diff',checkNote:r.agrees?undefined:('Az újraszámolás eredménye: '+(r.ownResult||'?')+'. '+r.note).trim().slice(0,LIMITS.note)});
  }catch(e){setHiba(uzenet(e))}
  finally{setDolgozik('')}
 }
 function torol(){
  if(window.confirm('Törlöd ezt az elemet a lapról?'))onDelete();
 }

 const cim=kind==='concept'?item.title:'';
 return <li className={'pf-item'+(item.check==='diff'?' is-diff':'')}>
  <div className="pf-item-top">
   <span className="pf-nr">{nr}.</span>
   {feladat&&(item.ai
    ?<span className="pf-tag is-ai">AI-feladat</span>
    :item.source&&<span className="pf-tag">{forrasSzoveg(item.source)}</span>)}
   {item.check==='ok'&&<span className="pf-tag is-ok">Újraszámolva: egyezik</span>}
   {item.check==='diff'&&<span className="pf-tag is-warn">Eltér az újraszámolástól</span>}
  </div>

  {szerk?<div className="pf-edit">
   {kind==='concept'&&<input className="pg-input" value={item.title||''} maxLength={LIMITS.title} placeholder="A fogalom neve" aria-label="A fogalom neve" onChange={e=>mod({title:e.target.value})}/>}
   <textarea className="pf-area" value={item.text} maxLength={LIMITS.text} aria-label={feladat?'A feladat szövege':'Szöveg'} onChange={e=>mod({text:e.target.value},feladat)}/>
   {kind==='prereq'&&<textarea className="pf-area" value={item.rule||''} maxLength={LIMITS.rule} placeholder="Hozzá tartozó szabály, képlet (nem kötelező)" aria-label="Szabály" onChange={e=>mod({rule:e.target.value})}/>}
   {feladat&&<textarea className="pf-area" value={item.solution||''} maxLength={LIMITS.solution} placeholder="A megoldás" aria-label="A megoldás" onChange={e=>mod({solution:e.target.value},true)}/>}
  </div>:<div className="pf-body">
   {cim&&<b className="pf-title">{cim}</b>}
   <p className="pf-text">{item.text}</p>
   {item.rule&&<p className="pf-rule"><span>Szabály</span>{item.rule}</p>}
   {item.solution&&<div className="pf-sol"><span className="us-label">Megoldás</span><Valasz text={item.solution}/></div>}
  </div>}

  {item.check==='diff'&&item.checkNote&&<p className="up-warn" role="status">{item.checkNote}</p>}
  {hiba&&<p className="up-error" role="alert">{hiba}</p>}

  <div className="pf-actions">
   <button type="button" className="us-btn us-btn-ghost" onClick={()=>setSzerk(v=>!v)} aria-pressed={szerk}><Icon name="pen" size={16}/>{szerk?'Kész':'Átírom'}</button>
   <button type="button" className="us-btn us-btn-ghost" onClick={()=>void csere()} disabled={foglalt||!!dolgozik}><Icon name="undo" size={16}/>{dolgozik==='csere'?'Készül…':'Másikat kérek'}</button>
   {feladat&&<button type="button" className="us-btn us-btn-ghost" onClick={()=>void ellenoriz()} disabled={foglalt||!!dolgozik||!item.solution}><Icon name="lines" size={16}/>{dolgozik==='ell'?'Számolom…':'Ellenőrizd újra'}</button>}
   <button type="button" className="us-icon-btn pf-del" aria-label="Elem törlése" onClick={torol}><Icon name="trash" size={16}/></button>
  </div>
 </li>;
}
