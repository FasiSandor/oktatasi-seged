'use client';
import {useState} from 'react';
import {Icon} from '../icons';
import {datumSzoveg,forrasSzoveg,type PrepBookSource,type PrepContent,type PrepItem} from '../../../lib/orafelkeszito';
import {oldalFelirat} from '../../../lib/felkeszules-kliens';
import type {Adat} from './Adatok';

/**
 * Nyomtatási nézetek. Tanári lap: minden rész megoldásokkal és forrásokkal.
 * Tanulói lap: a feladatok megoldás nélkül, másolható (a fogalmak és a mintafeladatok kérhetők rá).
 * A nyomtatást a böngésző végzi (Safariban a Nyomtatás → PDF is megy); a felület többi része ilyenkor rejtve van.
 */
export default function Nyomtatas({nezet,content,adat,tema,forrasok,onBack}:{nezet:'tanari'|'tanuloi';content:PrepContent;adat:Adat;tema:string;forrasok:PrepBookSource[];onBack:()=>void}){
 const [fogalmak,setFogalmak]=useState(false);
 const [minta,setMinta]=useState(true);
 const tanari=nezet==='tanari';

 return <div className="pr-wrap">
  <div className="pr-bar no-print">
   <button type="button" className="us-btn" onClick={onBack}><Icon name="back" size={18}/>Vissza a szerkesztéshez</button>
   {!tanari&&<>
    <label className="fb-check"><input type="checkbox" checked={minta} onChange={e=>setMinta(e.target.checked)}/>Mintafeladatok is</label>
    <label className="fb-check"><input type="checkbox" checked={fogalmak} onChange={e=>setFogalmak(e.target.checked)}/>Fogalmak is</label>
   </>}
   <button type="button" className="us-btn us-btn-dark" onClick={()=>window.print()}>Nyomtatás</button>
   <p className="rd-hint" style={{flexBasis:'100%'}}>PDF-mentés Safariból: Nyomtatás → PDF. A {tanari?'tanári':'tanulói'} lap látszik lent, ahogy ki fog kerülni a papírra.</p>
  </div>

  <article className={'pr-sheet '+(tanari?'is-tanari':'is-tanuloi')}>
   <header className="pr-head">
    <h1>{tanari?'Felkészülés: ':''}{tema}</h1>
    <p>{[adat.className,adat.takenOn?datumSzoveg(adat.takenOn):''].filter(Boolean).join(' · ')}</p>
    {!tanari&&<p className="pr-name">Név: ______________________________</p>}
   </header>

   {tanari&&forrasok.length>0&&<p className="pr-src"><b>Források:</b> {forrasok.map(f=>f.title+' ('+oldalFelirat(f.pages)+')').join('; ')}</p>}

   {(tanari||fogalmak)&&<>
    {tanari&&content.prereq.length>0&&<Resz cim="Előismeretek">
     {content.prereq.map((x,i)=><div key={x.id} className="pr-item"><span className="pr-nr">{i+1}.</span><div><p>{x.text}</p>{x.rule&&<p className="pr-rule">{x.rule}</p>}</div></div>)}
    </Resz>}
    {content.concepts.length>0&&<Resz cim="Fogalmak, definíciók">
     {content.concepts.map(x=><div key={x.id} className="pr-item"><span className="pr-nr">•</span><div><p>{x.title&&<b>{x.title}. </b>}{x.text}</p></div></div>)}
    </Resz>}
   </>}

   {(tanari||minta)&&content.examples.length>0&&<Feladatok cim="Mintafeladatok" list={content.examples} tanari={tanari}/>}
   {content.practice.length>0&&<Feladatok cim="Gyakorló feladatok" list={content.practice} tanari={tanari}/>}
  </article>
 </div>;
}

function Resz({cim,children}:{cim:string;children:React.ReactNode}){
 return <section className="pr-sec"><h2>{cim}</h2>{children}</section>;
}

function Feladatok({cim,list,tanari}:{cim:string;list:PrepItem[];tanari:boolean}){
 return <Resz cim={cim}>
  {list.map((x,i)=><div key={x.id} className="pr-item pr-task">
   <span className="pr-nr">{i+1}.</span>
   <div>
    <p>{x.text}</p>
    {tanari&&<>
     {x.solution&&<div className="pr-sol"><b>Megoldás</b><p>{x.solution}</p></div>}
     <p className="pr-from">{x.ai?'AI-feladat':forrasSzoveg(x.source||undefined)}</p>
    </>}
   </div>
  </div>)}
 </Resz>;
}
