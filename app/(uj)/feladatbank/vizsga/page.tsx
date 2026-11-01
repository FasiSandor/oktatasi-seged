'use client';
import {Suspense,useCallback,useEffect,useMemo,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {api,ApiError,hasSession} from '../../../../lib/client-api';
import {feladatCimke,reszNev} from '../../../../lib/feladatbank/felismeres';
import {ARANYOK,TEMAKOROK,temakorSzam} from '../../../../lib/feladatbank/temak';
import {Icon} from '../../icons';
import Belepes from '../../Belepes';
import Kereso from '../../Kereso';
import Fiokmenu from '../../Fiokmenu';
import {ALLAPOT,besorol,ellenorzesOkai,gondolkodasBe,lapLink,temaFelirat,TemaValaszto,vizsgaCim,type Feladat,type Vizsga} from '../kozos';

type Naplo={resz:string;modell:string;gondolkodas:boolean;mp:string|null;bemenet:number|null;kimenet:number|null;gondolat:number|null;ok:boolean;hiba:string|null;created_at:string};
type Adat={vizsga:Vizsga;feladatok:Feladat[];fajlok:{tipus:string;fajlnev:string;oldalszam:number}[];naplo:Naplo[]};

export default function VizsgaOldal(){
 return <Suspense fallback={<div className="us-login"><p className="us-status">Betöltés…</p></div>}><Vizsga/></Suspense>;
}

/** Egy lappár feladatai: besorolás, javítás, arány-ellenőrzés, AI-napló. */
function Vizsga(){
 const id=useSearchParams().get('id')||'';
 const [phase,setPhase]=useState<'checking'|'login'|'ready'>('checking');
 const [adat,setAdat]=useState<Adat|null>(null);
 const [fut,setFut]=useState('');
 const [toast,setToast]=useState('');
 const fail=useCallback((e:unknown)=>{
  if(e instanceof ApiError&&e.status===401){setPhase('login');return}
  setToast(e instanceof Error?e.message:'Ismeretlen hiba');
 },[]);
 useEffect(()=>{let alive=true;hasSession().then(ok=>{if(alive)setPhase(ok?'ready':'login')});return()=>{alive=false}},[]);
 const betolt=useCallback(()=>api<Adat>('feladatbank/vizsga?id='+encodeURIComponent(id)).then(setAdat),[id]);
 useEffect(()=>{if(phase==='ready'&&id)betolt().catch(fail)},[phase,id,betolt,fail]);

 async function modosit(f:Feladat,body:object){
  try{
   const r=await api<{feladat:Partial<Feladat>}>('feladatbank/feladat',{method:'PATCH',body:JSON.stringify({id:f.id,...body})});
   setAdat(a=>a?{...a,feladatok:a.feladatok.map(x=>x.id===f.id?{...x,...r.feladat}:x)}:a);
  }catch(e){fail(e)}
 }
 async function ujraBesorol(){
  if(!adat)return;
  try{const vege=await besorol(adat.vizsga.id,gondolkodasBe(),setFut);setToast(vege);await betolt()}catch(e){fail(e)}finally{setFut('')}
 }
 async function ujraBont(){
  setFut('Újrabontás…');
  try{await api('feladatbank/vizsga',{method:'POST',body:JSON.stringify({id,muvelet:'ujrabontas'})},60000);await betolt();setToast('Újrabontva. A besorolás megmaradt.')}catch(e){fail(e)}finally{setFut('')}
 }

 // Témakörönként a pontok aránya a lapon, összevetve a vizsgaleírás irányadó arányával.
 const aranyok=useMemo(()=>{
  if(!adat)return [];
  const szint=adat.vizsga.szint==='emelt'?'emelt':'kozep';
  // A II. B részből csak kettő számít (középszinten): a választható feladatok pontjai felével.
  const suly=(f:Feladat)=>szint==='kozep'&&f.resz==='II.B'?2/3:1;
  const pont=new Map<string,number>();let ossz=0;
  for(const f of adat.feladatok){if(!f.fo_kod||f.pont===null)continue;const k=temakorSzam(f.fo_kod);const p=f.pont*suly(f);pont.set(k,(pont.get(k)||0)+p);ossz+=p}
  return TEMAKOROK.map(t=>({szam:t.szam,nev:t.nev,lap:ossz?Math.round((pont.get(t.szam)||0)/ossz*100):0,iranyado:ARANYOK[szint][t.szam]}));
 },[adat]);

 if(phase==='checking')return <div className="us-login"><p className="us-status">Betöltés…</p></div>;
 if(phase==='login')return <Belepes onDone={()=>setPhase('ready')}/>;
 const v=adat?.vizsga;
 const csoportok=adat?[...new Set(adat.feladatok.map(f=>f.resz))].map(r=>[r,adat.feladatok.filter(f=>f.resz===r)] as const):[];

 return <div className="us-app">
  <header className="rd-top">
   <a href="/feladatbank" className="rd-back"><Icon name="back" size={20} strokeWidth={2.2}/><span>Feladatbank</span></a>
   <h1 className="pg-title">{v?vizsgaCim(v):'Vizsga'}</h1>
   <div className="rd-right"><Kereso onAuth={()=>setPhase('login')}/><Fiokmenu/></div>
  </header>
  <main className="pg-main">
   {!adat&&<p className="us-status">Betöltés…</p>}
   {adat&&v&&<>
    <section className="us-panel">
     <p className="fb-meta">{ALLAPOT[v.allapot]||v.allapot} · {adat.feladatok.length} tétel · {v.vizsgakod||'vizsgakód nélkül'} · követelmény: {v.kovetelmeny==='2024'?'2024-től':v.kovetelmeny==='2017'?'2017–2023':'2005–2016'} · {v.datum.replaceAll('-','. ')}.</p>
     {(v.bontas_hibak||[]).map(h=><p key={h} className="fb-figy">{h}</p>)}
     <div className="fb-gombok">
      {adat.fajlok.some(f=>f.tipus==='fl')&&<a className="us-btn" href={lapLink(v.id,'fl')}>Feladatlap</a>}
      {adat.fajlok.some(f=>f.tipus==='ut')&&<a className="us-btn" href={lapLink(v.id,'ut')}>Útmutató</a>}
      <button type="button" className="us-btn us-btn-dark" disabled={!!fut||!adat.feladatok.length} onClick={()=>void ujraBesorol()}>{adat.feladatok.some(f=>f.fo_kod)?'Újra besorolás AI-jal':'Besorolás AI-jal'}</button>
      <button type="button" className="us-btn us-btn-ghost" disabled={!!fut} onClick={()=>void ujraBont()}>Újrabontás</button>
     </div>
     {fut&&<p className="fb-folyamat" role="status">{fut}</p>}
    </section>

    {csoportok.map(([resz,list])=><section key={resz} className="pg-group" aria-label={reszNev(resz)}>
     <h2 className="us-grade-head">{reszNev(resz)}<small>{list.reduce((s,f)=>s+(f.pont||0),0)} pont</small></h2>
     <div className="fb-lista">
      {list.map(f=>{const okok=ellenorzesOkai(f);return <article key={f.id} className={'fb-kartya'+(f.ellenorizendo?' is-ellenorizendo':'')}>
       <div className="fb-kartya-fej">
        <h3><a href={lapLink(v.id,'fl',f)}>{feladatCimke(f.sorszam,f.reszfeladat)}</a></h3>
        <span className="fb-pont">{f.pont??'?'} pont</span>
       </div>
       <p className="fb-meta"><b>{temaFelirat(f.fo_kod)}</b>{f.megjegyzes?' · '+f.megjegyzes:''}{f.kezzel?' · kézzel javítva':f.jovahagyva?' · jóváhagyva':''}</p>
       {f.ai_fo_kod&&f.kezzel&&f.ai_fo_kod!==f.fo_kod&&<p className="fb-halvany">Az AI javaslata: {temaFelirat(f.ai_fo_kod)}</p>}
       {f.ellenorizendo&&okok.map(o=><p key={o} className="fb-figy">{o}</p>)}
       <div className="fb-szerk">
        <TemaValaszto value={f.fo_kod} label={'Fő altéma, '+feladatCimke(f.sorszam,f.reszfeladat)} onChange={kod=>{if(kod)void modosit(f,{foKod:kod})}}/>
        <TemaValaszto value={f.mellek_kod} ures="Nincs mellék-altéma" label={'Mellék-altéma, '+feladatCimke(f.sorszam,f.reszfeladat)} onChange={kod=>{if(f.fo_kod)void modosit(f,{mellekKod:kod||null})}}/>
        <label className="fb-check"><input type="checkbox" checked={f.szoveges} disabled={!f.fo_kod} onChange={e=>void modosit(f,{szoveges:e.target.checked})}/> szöveges, modellalkotás</label>
       </div>
       <div className="fb-gombok">
        {f.ellenorizendo&&f.fo_kod&&<button type="button" className="us-btn us-btn-teal" onClick={()=>void modosit(f,{jovahagy:true})}>Jó így</button>}
        <a className="us-btn" href={lapLink(v.id,'fl',f)}>Feladat{f.fl_oldal?' ('+f.fl_oldal+'. o.)':''}</a>
        {f.ut_oldal&&<a className="us-btn" href={lapLink(v.id,'ut',f)}>Útmutató ({f.ut_oldal}. o.)</a>}
       </div>
      </article>})}
     </div>
    </section>)}

    {adat.feladatok.some(f=>f.fo_kod)&&<section className="us-panel" aria-label="Arány-ellenőrzés">
     <h2 className="us-grade-head">Témakörök aránya<small>a lap pontjai alapján, az irányadó arányhoz mérve</small></h2>
     {aranyok.map(a=><div key={a.szam} className="fb-arany">
      <span className="fb-arany-nev">{a.szam}. {a.nev}</span>
      <span className="fb-arany-sav" aria-hidden="true"><i style={{width:Math.min(100,a.lap)+'%'}}/><b style={{left:a.iranyado+'%'}}/></span>
      <span className={'fb-arany-szam'+(Math.abs(a.lap-a.iranyado)>=10?' is-elter':'')}>{a.lap}% <small>(irányadó {a.iranyado}%)</small></span>
     </div>)}
     <p className="fb-halvany">Középszinten a II. B rész feladatai kétharmad súllyal számítanak (háromból kettőt kell megoldani). Tíz százalékpontnál nagyobb eltérés besorolási hibára utalhat, de egy-egy lapon természetes is lehet.</p>
    </section>}

    {adat.naplo.length>0&&<section className="us-panel" aria-label="AI-napló">
     <h2 className="us-grade-head">AI-hívások<small>a gondolkodás be- és kikapcsolt állapotának összehasonlításához</small></h2>
     <table className="st-table">
      <thead><tr><th>Mikor</th><th>Rész</th><th>Gondolkodás</th><th>Idő</th><th>Token (be / ki / gondolat)</th><th>Eredmény</th></tr></thead>
      <tbody>{adat.naplo.map((n,i)=><tr key={i}>
       <td>{new Date(n.created_at).toLocaleString('hu-HU',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</td>
       <td>{n.resz}.</td><td>{n.gondolkodas?'be':'ki'}</td>
       <td>{n.mp?String(Number(n.mp)).replace('.',',')+' mp':'–'}</td>
       <td>{n.bemenet??'–'} / {n.kimenet??'–'} / {n.gondolat??0}</td>
       <td>{n.ok?'rendben':n.hiba||'hiba'}</td>
      </tr>)}</tbody>
     </table>
    </section>}
   </>}
  </main>
  {toast&&<div className="us-toast" role="status"><span style={{flex:1}}>{toast}</span><button type="button" onClick={()=>setToast('')}>Rendben</button></div>}
 </div>;
}
