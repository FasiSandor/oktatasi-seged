'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {api,ApiError,hasSession} from '../../../lib/client-api';
import {Icon} from '../icons';
import Belepes from '../Belepes';
import Kereso from '../Kereso';
import Fiokmenu from '../Fiokmenu';
import Adatok,{ma,type Adat} from './Adatok';
import Lap,{type Muveletek,type Szakasz} from './Lap';
import Nyomtatas from './Nyomtatas';
import {EMPTY_CONTENT,datumSzoveg,itemCount,type PrepBookSource,type PrepContent} from '../../../lib/orafelkeszito';
import {adagok,alapKeres,elemKeres,feladatKeres,felszabadit,forrasSorok,forrasokBol,kepekKeszit,megoldasEllenoriz,oldalFelirat,oldalSzam,MAX_OLDAL,type Kep,type Kontextus,type Sor} from '../../../lib/felkeszules-kliens';

type Tema={id:string|null;name:string;subjectId:string|null};
type Megtartott={id:string;taught_on:string;class_name:string;grade:number|null;subject_id:string|null;topic_id:string|null;topic_name:string;sources:PrepBookSource[];content:PrepContent;note:string};
type Munka={szoveg:string};

const uzenet=(e:unknown)=>e instanceof Error?e.message:'Ismeretlen hiba';

/**
 * Felkészülés az órára (0.5.0): források kiválasztása, a lap elkészítése részenként,
 * átnézés és javítás elemenként, tanári és tanulói nyomtatás, mentés a megtartott órák közé.
 * Megnyitható egy témából (?topic=…) vagy egy elmentett órából (?lesson=…).
 */
export default function Felkeszules(){
 const [phase,setPhase]=useState<'checking'|'login'|'ready'>('checking');
 const [betoltve,setBetoltve]=useState(false);
 const [hiba,setHiba]=useState('');
 const [toast,setToast]=useState('');
 const [step,setStep]=useState<'beallitas'|'lap'>('beallitas');
 const [nezet,setNezet]=useState<'szerkeszt'|'tanari'|'tanuloi'>('szerkeszt');
 const [tema,setTema]=useState<Tema>({id:null,name:'',subjectId:null});
 const [tantargy,setTantargy]=useState('matematika');
 const [sorok,setSorok]=useState<Sor[]>([]);
 const [adat,setAdat]=useState<Adat>({takenOn:ma(),className:'',grade:null,note:''});
 const [db,setDb]=useState({examples:3,practice:7});
 const [wish,setWish]=useState('');
 const [sources,setSources]=useState<PrepBookSource[]>([]);
 const [content,setContent]=useState<PrepContent>(EMPTY_CONTENT);
 const [lessonId,setLessonId]=useState<string|null>(null);
 const [munka,setMunka]=useState<Munka|null>(null);
 const [mentesFolyik,setMentesFolyik]=useState(false);
 const [mentett,setMentett]=useState('');

 const adagRef=useRef<Kep[][]|null>(null);
 const forrasRef=useRef<PrepBookSource[]>([]);
 const contentRef=useRef(content);contentRef.current=content;
 const korforgas=useRef(0);

 const fail=useCallback((e:unknown)=>{
  if(e instanceof ApiError&&e.status===401){setPhase('login');return}
  setToast(uzenet(e));
 },[]);

 useEffect(()=>{let el=true;hasSession().then(ok=>{if(el)setPhase(ok?'ready':'login')});return()=>{el=false}},[]);
 useEffect(()=>()=>felszabadit(),[]);

 // Betöltés: új lap egy témából, vagy egy elmentett óra.
 useEffect(()=>{
  if(phase!=='ready'||betoltve)return;
  (async()=>{
   const p=new URLSearchParams(window.location.search);
   const tantargyak=await api<{subjects:{id:string;name:string}[]}>('subjects').then(r=>r.subjects).catch(e=>{if(e instanceof ApiError&&e.status===401)throw e;return []});
   const lessonQ=p.get('lesson');
   if(lessonQ){
    const r=await api<{lesson:Megtartott}>('lessons?id='+encodeURIComponent(lessonQ));
    const l=r.lesson;
    const tartalom:PrepContent={...EMPTY_CONTENT,...l.content};
    setLessonId(l.id);
    setTema({id:l.topic_id,name:l.topic_name,subjectId:l.subject_id});
    setTantargy(tantargyak.find(s=>s.id===l.subject_id)?.name||'matematika');
    const a:Adat={takenOn:l.taught_on,className:l.class_name,grade:l.grade,note:l.note};
    setAdat(a);setSources(l.sources||[]);forrasRef.current=l.sources||[];setContent(tartalom);
    setMentett(JSON.stringify([tartalom,a]));
    setStep('lap');
    const n=p.get('nezet');
    if(n==='tanari'||n==='tanuloi')setNezet(n);
   }else{
    const topicQ=p.get('topic');
    if(!topicQ){setHiba('Nincs kiválasztva téma. A főoldalon nyiss meg egy témát, és ott nyomd meg a „Felkészülés az órára” gombot.');return}
    const subjectQ=p.get('subject');
    setTema({id:topicQ,name:p.get('label')||'',subjectId:subjectQ});
    setTantargy(tantargyak.find(s=>s.id===subjectQ)?.name||'matematika');
    setSorok(await forrasSorok(topicQ));
   }
  })().then(()=>setBetoltve(true)).catch(e=>{if(e instanceof ApiError&&e.status===401)setPhase('login');else setHiba(uzenet(e))});
 },[phase,betoltve]);

 const lenyomat=useMemo(()=>JSON.stringify([content,adat]),[content,adat]);
 const piszkos=step==='lap'&&itemCount(content)>0&&lenyomat!==mentett;
 // Mentetlen munkánál a böngésző rákérdez kilépéskor (piszkozat nincs, ezért ez véd).
 useEffect(()=>{
  if(!piszkos)return;
  const f=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue=''};
  window.addEventListener('beforeunload',f);return()=>window.removeEventListener('beforeunload',f);
 },[piszkos]);

 const ctxOf=useCallback((g:number|null):Kontextus=>({grade:g,subject:tantargy,topic:tema.name}),[tantargy,tema.name]);
 const kijelolt=useMemo(()=>forrasokBol(sorok),[sorok]);
 const oldalak=oldalSzam(kijelolt);

 async function adagLeker():Promise<Kep[][]>{
  if(adagRef.current)return adagRef.current;
  const k=await kepekKeszit(forrasRef.current);
  adagRef.current=adagok(k);
  return adagRef.current;
 }
 const adagValaszt=(adag:Kep[][])=>adag[korforgas.current++%adag.length];

 /** Egy rész elkészítése, a mostani elemek helyére. A figyelmeztetést (ha van) visszaadja. */
 async function szakaszKeszit(s:Szakasz,g:number|null):Promise<string>{
  const ctx=ctxOf(g);
  const adag=await adagLeker();
  if(s==='prereq'||s==='concepts'){
   setMunka({szoveg:'Előismeretek és fogalmak készítése…'});
   const r=await alapKeres(ctx,adag,wish);
   setContent(c=>({...c,prereq:s==='concepts'?c.prereq:r.prereq,concepts:s==='prereq'?c.concepts:r.concepts}));
   return r.figyelmeztetes;
  }
  const kind=s==='examples'?'example':'practice';
  setMunka({szoveg:s==='examples'?'Mintafeladatok készítése…':'Gyakorló feladatok készítése…'});
  const avoid=s==='practice'?contentRef.current.examples.map(x=>x.text):[];
  const r=await feladatKeres(ctx,kind,s==='examples'?db.examples:db.practice,adag,avoid,wish);
  setContent(c=>({...c,[s]:r.items}));
  return r.figyelmeztetes;
 }

 async function futtat(munka:()=>Promise<string|void>){
  try{
   const f=await munka();
   if(f)setToast(f);
  }catch(e){fail(e)}
  finally{setMunka(null)}
 }

 async function keszit(){
  if(!oldalak){setToast('Jelölj ki legalább egy forrást, és add meg az oldalait.');return}
  if(oldalak>MAX_OLDAL){setToast('Legfeljebb '+MAX_OLDAL+' oldalt jelölhetsz ki egy lapra. Most '+oldalak+' van kijelölve.');return}
  if(!adat.className.trim()){setToast('Add meg az osztályt.');return}
  if(!/^\d{4}-\d{2}-\d{2}$/.test(adat.takenOn)){setToast('Add meg az óra napját.');return}
  // Ha az évfolyam üres, a kijelölt könyvek leggyakoribb évfolyamát használjuk.
  let g=adat.grade;
  if(g===null){
   const lista=sorok.filter(s=>s.on&&s.grade).map(s=>s.grade as number);
   if(lista.length)g=lista.sort((a,b)=>lista.filter(x=>x===b).length-lista.filter(x=>x===a).length)[0];
  }
  setAdat(a=>({...a,grade:g}));
  setSources(kijelolt);forrasRef.current=kijelolt;adagRef.current=null;korforgas.current=0;
  setContent(EMPTY_CONTENT);setLessonId(null);setMentett('');setNezet('szerkeszt');setStep('lap');
  window.scrollTo({top:0});
  await futtat(async()=>{
   setMunka({szoveg:'Az oldalak előkészítése…'});
   const k=await kepekKeszit(kijelolt,(kesz,ossz)=>setMunka({szoveg:'Az oldalak előkészítése: '+kesz+'/'+ossz}));
   adagRef.current=adagok(k);
   const f1=await szakaszKeszit('prereq',g);
   const f2=await szakaszKeszit('examples',g);
   const f3=await szakaszKeszit('practice',g);
   return f1||f2||f3;
  });
 }

 function auth(e:unknown){if(e instanceof ApiError&&e.status===401)setPhase('login')}
 const ops:Muveletek={
  uj:async(kind,avoid)=>{
   try{
    const adag=await adagLeker();const ctx=ctxOf(adat.grade);
    if(kind==='prereq'||kind==='concept')return await elemKeres(ctx,kind,adagValaszt(adag),avoid,wish);
    const r=await feladatKeres(ctx,kind,1,[adagValaszt(adag)],avoid,wish);
    return r.items[0];
   }catch(e){auth(e);throw e}
  },
  ellenoriz:async item=>{
   try{return await megoldasEllenoriz(ctxOf(adat.grade),item.text,item.solution||'')}
   catch(e){auth(e);throw e}
  },
  ujra:s=>{void futtat(()=>szakaszKeszit(s,adat.grade))}
 };

 async function ment(){
  const ures=[...content.prereq,...content.concepts,...content.examples,...content.practice].some(x=>!x.text.trim());
  if(ures){setToast('Az egyik elem szövege üres. Töltsd ki, vagy töröld az elemet.');return}
  if(itemCount(content)<1){setToast('Üres lapot nem lehet menteni.');return}
  if(!adat.className.trim()){setToast('Add meg az osztályt.');return}
  const eltero=[...content.examples,...content.practice].filter(x=>x.check==='diff').length;
  if(eltero&&!window.confirm(eltero+' megoldásnál az újraszámolás eltérést jelzett. Így is mented?'))return;
  setMentesFolyik(true);
  try{
   if(lessonId){
    await api('lessons',{method:'PATCH',body:JSON.stringify({id:lessonId,takenOn:adat.takenOn,className:adat.className.trim(),grade:adat.grade,note:adat.note,content,sources})},30000);
   }else{
    const r=await api<{lesson:{id:string}}>('lessons',{method:'POST',body:JSON.stringify({takenOn:adat.takenOn,className:adat.className.trim(),grade:adat.grade,subjectId:tema.subjectId,topicId:tema.id,topicName:tema.name,content,sources,note:adat.note})},30000);
    setLessonId(r.lesson.id);
    window.history.replaceState(null,'','/felkeszules?lesson='+encodeURIComponent(r.lesson.id));
   }
   setMentett(lenyomat);
   setToast('Elmentve a megtartott órák közé.');
  }catch(e){fail(e)}
  finally{setMentesFolyik(false)}
 }

 async function torol(){
  if(!lessonId||!window.confirm('Törlöd ezt a megtartott órát? Nem hozható vissza.'))return;
  try{await api('lessons?id='+encodeURIComponent(lessonId),{method:'DELETE'});setMentett(lenyomat);window.location.href='/orak'}
  catch(e){fail(e)}
 }

 function mezo(i:number,kulcs:'on'|'from'|'to',v:boolean|number|null){
  setSorok(l=>l.map((s,j)=>j===i?{...s,[kulcs]:v}:s));
 }

 if(phase==='checking')return <div className="us-login"><p className="us-status">Betöltés…</p></div>;
 if(phase==='login')return <Belepes onDone={()=>setPhase('ready')}/>;

 const toastEl=toast&&<div className="us-toast no-print" role="status"><span style={{flex:1}}>{toast}</span><button type="button" onClick={()=>setToast('')}>Rendben</button></div>;

 if(step==='lap'&&nezet!=='szerkeszt'){
  return <div className="us-app">
   <Nyomtatas nezet={nezet} content={content} adat={adat} tema={tema.name} forrasok={sources} onBack={()=>setNezet('szerkeszt')}/>
   {toastEl}
  </div>;
 }

 const vissza=tema.id?'/?topic='+encodeURIComponent(tema.id):'/';
 let elozo='';
 return <div className="us-app">
  <header className="rd-top">
   <a href={lessonId?'/orak':vissza} className="rd-back" onClick={e=>{if(piszkos&&!window.confirm('Van el nem mentett munkád. Kilépsz?'))e.preventDefault()}}><Icon name="back" size={20} strokeWidth={2.2}/><span>{lessonId?'Megtartott órák':'Főoldal'}</span></a>
   <h1 className="pg-title">Felkészülés az órára</h1>
   <div className="rd-right">
    <Kereso onAuth={()=>setPhase('login')}/>
    <Fiokmenu/>
   </div>
  </header>

  <main className="pf-main">
   {hiba&&<p className="up-error" role="alert">{hiba}</p>}
   {tema.name&&<h2 className="us-title pf-title"><span className="us-marker">{tema.name}</span></h2>}

   {step==='beallitas'&&betoltve&&<>
    <section className="pf-card" aria-label="Források">
     <h2>Miből dolgozzon?</h2>
     <p className="us-status" style={{margin:0}}>Pipáld ki a fejezeteket, és szükség esetén módosítsd az oldalszámokat (a PDF oldalszámai, nem a nyomtatottak). Az AI csak ezeket az oldalakat olvassa.</p>
     {sorok.length===0&&<p className="up-warn">Ehhez a témához még nincs PDF-könyv hivatkozás. <a href={'/feltoltes'+(tema.id?'?topicId='+encodeURIComponent(tema.id):'')} style={{textDecoration:'underline'}}>Feltöltés vagy hozzárendelés</a></p>}
     {sorok.map((s,i)=>{
      const fej=s.docId!==elozo;elozo=s.docId;
      return <div key={s.key}>
       {fej&&<h3 className="pf-book">{s.book}{s.grade?<small>{s.grade}. évfolyam</small>:null}</h3>}
       <div className={'pf-src'+(s.on?' is-on':'')}>
        <label className="fb-check"><input type="checkbox" checked={s.on} onChange={e=>mezo(i,'on',e.target.checked)}/><span>{s.title}</span></label>
        <span className="pf-range">
         <input className="pg-input" type="number" inputMode="numeric" min={1} max={5000} aria-label="Első oldal" value={s.from??''} placeholder="-tól" onChange={e=>{const n=e.target.value?Number(e.target.value):null;mezo(i,'from',n);if(n&&(s.to===null||s.to<n))mezo(i,'to',n)}}/>
         <span>–</span>
         <input className="pg-input" type="number" inputMode="numeric" min={1} max={5000} aria-label="Utolsó oldal" value={s.to??''} placeholder="-ig" onChange={e=>mezo(i,'to',e.target.value?Number(e.target.value):null)}/>
         <span className="pf-o">oldal</span>
        </span>
       </div>
      </div>;
     })}
     {sorok.length>0&&<p className={oldalak>MAX_OLDAL?'up-error':'rd-hint'}>{oldalak?oldalak+' oldal kijelölve'+(kijelolt.length?': '+kijelolt.map(f=>f.title+' ('+oldalFelirat(f.pages)+')').join('; '):'')+'.':'Még nincs kijelölt oldal.'}{oldalak>6&&oldalak<=MAX_OLDAL?' Hat oldalnál többet részletekben küldök az AI-nak.':''}{oldalak>MAX_OLDAL?' Legfeljebb '+MAX_OLDAL+' oldal lehet.':''}</p>}
    </section>

    <section className="pf-card" aria-label="Az óra adatai">
     <h2>Az óra</h2>
     <Adatok adat={adat} onChange={setAdat}/>
    </section>

    <section className="pf-card" aria-label="Beállítások">
     <h2>Mit készítsen?</h2>
     <div className="pf-grid">
      <label className="pf-field">Mintafeladatok száma
       <select className="up-select" value={db.examples} onChange={e=>setDb(d=>({...d,examples:Number(e.target.value)}))}>{[1,2,3,4,5,6].map(n=><option key={n} value={n}>{n}</option>)}</select>
      </label>
      <label className="pf-field">Gyakorló feladatok száma
       <select className="up-select" value={db.practice} onChange={e=>setDb(d=>({...d,practice:Number(e.target.value)}))}>{[3,4,5,6,7,8,9,10].map(n=><option key={n} value={n}>{n}</option>)}</select>
      </label>
     </div>
     <label className="pf-field">Kérés az AI-nak (nem kötelező)
      <input className="pg-input" value={wish} maxLength={300} placeholder="pl. a nehezebb feladatokra figyeljen, vagy csak a 2. fejezetből" onChange={e=>setWish(e.target.value)}/>
     </label>
     <div className="up-actions">
      <span>Az AI részenként dolgozik, az egész egy-két percig tarthat.</span>
      <button type="button" className="us-btn us-btn-teal" onClick={()=>void keszit()} disabled={!oldalak||oldalak>MAX_OLDAL||!!munka}>Lap készítése</button>
     </div>
    </section>
   </>}

   {step==='lap'&&<>
    <div className="pf-bar">
     <button type="button" className="us-btn" onClick={()=>setNezet('tanari')} disabled={itemCount(content)===0}><Icon name="note" size={18}/>Tanári lap</button>
     <button type="button" className="us-btn" onClick={()=>setNezet('tanuloi')} disabled={itemCount(content)===0}><Icon name="lines" size={18}/>Tanulói lap</button>
     <button type="button" className="us-btn us-btn-dark" onClick={()=>void ment()} disabled={!!munka||mentesFolyik||(!piszkos&&!!lessonId)}>{mentesFolyik?'Mentés…':lessonId&&!piszkos?'Elmentve':lessonId?'Módosítások mentése':'Jóváhagyom és mentem'}</button>
     {lessonId&&<button type="button" className="us-btn us-btn-ghost is-danger" onClick={()=>void torol()}><Icon name="trash" size={16}/>Óra törlése</button>}
    </div>

    {munka&&<div className="up-ai-busy" role="status" style={{margin:0}}><span className="up-ai-bar" aria-hidden="true"/><span>{munka.szoveg}</span></div>}

    <section className="pf-card" aria-label="Az óra adatai">
     <h2>Az óra adatai</h2>
     <Adatok adat={adat} onChange={setAdat} jegyzet/>
     {sources.length>0&&<p className="rd-hint">Források: {sources.map(f=>f.title+' ('+oldalFelirat(f.pages)+')').join('; ')}. Az AI tévedhet, a megoldásokat mentés előtt nézd át.</p>}
    </section>

    <Lap content={content} onChange={setContent} ops={ops} foglalt={!!munka}/>

    {!munka&&itemCount(content)>0&&<div className="pf-bar">
     <span className="us-status" style={{flex:1}}>{lessonId?'Megtartott óra: '+datumSzoveg(adat.takenOn)+', '+adat.className:'Ha rendben van a lap, mentsd el a megtartott órák közé.'}</span>
     <button type="button" className="us-btn us-btn-dark" onClick={()=>void ment()} disabled={mentesFolyik||(!piszkos&&!!lessonId)}>{mentesFolyik?'Mentés…':lessonId&&!piszkos?'Elmentve':lessonId?'Módosítások mentése':'Jóváhagyom és mentem'}</button>
    </div>}
   </>}
  </main>
  {toastEl}
 </div>;
}
