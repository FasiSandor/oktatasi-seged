'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {api,ApiError,hasSession,localPrefs} from '../../../lib/client-api';
import {azonosit,szintNev,honapNev,feladatCimke,type Azonositas,type Oldalak} from '../../../lib/feladatbank/felismeres';
import {pdfSzoveg,ujjlenyomat} from '../../../lib/feladatbank/szoveg';
import {Icon} from '../icons';
import Belepes from '../Belepes';
import Kereso from '../Kereso';
import Fiokmenu from '../Fiokmenu';
import {ALLAPOT,besorol,ellenorzesOkai,gondolkodasBe,gondolkodasMent,lapLink,temaFelirat,TemaValaszto,vizsgaCim,type Feladat,type Vizsga} from './kozos';

type Ful='lapok'|'ellenorizendo'|'feltoltes';
type Sor={kulcs:string;file:File;allapot:'olvasas'|'kesz'|'hiba'|'feltoltes'|'feltoltve'|'kihagyva'|'letezik';uzenet:string;az?:Azonositas;oldalak?:Oldalak;sha?:string;vizsgaId?:string};

const leiras=(az?:Azonositas)=>az&&az.ev?az.ev+'. '+honapNev(az.honap)+' · '+szintNev(az.szint)+' · '+(az.tipus==='ut'?'útmutató':'feladatlap')+(az.vizsgakod?' · '+az.vizsgakod:''):'';

/** Érettségi feladatbank: lapok, ellenőrzés, feltöltés. */
export default function FeladatbankOldal(){
 const [phase,setPhase]=useState<'checking'|'login'|'ready'>('checking');
 const [ful,setFul]=useState<Ful>('lapok');
 const [vizsgak,setVizsgak]=useState<Vizsga[]|null>(null);
 const [nincsBekotve,setNincsBekotve]=useState(false);
 const [ellenorizendo,setEllenorizendo]=useState<Feladat[]|null>(null);
 const [sorok,setSorok]=useState<Sor[]>([]);
 const [fut,setFut]=useState(false);
 const [folyamat,setFolyamat]=useState<Record<string,string>>({});
 const [gondolkodas,setGondolkodas]=useState(false);
 const [toast,setToast]=useState('');

 const fail=useCallback((e:unknown)=>{
  if(e instanceof ApiError&&e.status===401){setPhase('login');return}
  setToast(e instanceof Error?e.message:'Ismeretlen hiba');
 },[]);
 useEffect(()=>{let alive=true;hasSession().then(ok=>{if(alive)setPhase(ok?'ready':'login')});return()=>{alive=false}},[]);
 useEffect(()=>{setGondolkodas(gondolkodasBe());setFul(localPrefs.get<Ful>('fb-ful','lapok'))},[]);
 useEffect(()=>{localPrefs.set('fb-ful',ful)},[ful]);

 const betolt=useCallback(async()=>{
  const r=await api<{vizsgak:Vizsga[];notConfigured?:boolean}>('feladatbank');
  setVizsgak(r.vizsgak);setNincsBekotve(!!r.notConfigured);
  if(!r.notConfigured){const e=await api<{ellenorizendo:Feladat[]}>('feladatbank?ellenorizendo=1');setEllenorizendo(e.ellenorizendo)}
  else setEllenorizendo([]);
 },[]);
 useEffect(()=>{if(phase==='ready')betolt().catch(fail)},[phase,betolt,fail]);

 const frissit=(kulcs:string,v:Partial<Sor>)=>setSorok(list=>list.map(s=>s.kulcs===kulcs?{...s,...v}:s));

 // A kiválasztott PDF-ek beolvasása a böngészőben: szöveg, ujjlenyomat, felismerés (előnézet).
 async function valaszt(files:FileList|null){
  if(!files?.length)return;
  const uj:Sor[]=[...files].filter(f=>/\.pdf$/i.test(f.name)||f.type==='application/pdf').map(f=>({kulcs:f.name+':'+f.size+':'+Math.random(),file:f,allapot:'olvasas',uzenet:'Beolvasás…'}));
  if(!uj.length){setToast('Csak PDF-fájlt lehet feltölteni.');return}
  setSorok(v=>[...v.filter(s=>s.allapot!=='feltoltve'&&s.allapot!=='kihagyva'),...uj]);
  for(const s of uj){
   try{
    const [{oldalak},sha]=await Promise.all([pdfSzoveg(s.file),ujjlenyomat(s.file)]);
    const az=azonosit(oldalak,s.file.name);
    const rossz=!az.tipus||!az.szint||!az.datum;
    frissit(s.kulcs,{allapot:rossz?'hiba':'kesz',az,oldalak,sha,uzenet:rossz?'Nem sikerült felismerni. '+az.figyelmeztetesek.join(' '):az.figyelmeztetesek.join(' ')});
   }catch{frissit(s.kulcs,{allapot:'hiba',uzenet:'A PDF-et nem sikerült beolvasni.'})}
  }
 }

 const parHiany=useMemo(()=>{
  const m=new Map<string,Set<string>>();
  for(const s of sorok)if(s.az?.datum&&s.az.szint&&s.az.tipus){const k=s.az.szint+'|'+s.az.datum;const t=m.get(k)||new Set();t.add(s.az.tipus);m.set(k,t)}
  return (s:Sor)=>!!s.az?.datum&&(m.get(s.az.szint+'|'+s.az.datum)?.size||0)<2;
 },[sorok]);

 async function egyetFeltolt(s:Sor,csere=false):Promise<string|null>{
  frissit(s.kulcs,{allapot:'feltoltes',uzenet:'Feltöltés…'});
  try{
   const r=await api<{fajlId?:string;uploadUrl?:string;duplikalt?:boolean;letezik?:boolean}>('feladatbank/feltoltes',{method:'POST',body:JSON.stringify({fajlnev:s.file.name,byteSize:s.file.size,sha256:s.sha,oldalak:s.oldalak,csere})},30000);
   if(r.duplikalt){frissit(s.kulcs,{allapot:'kihagyva',uzenet:'Ez a fájl már fent van, kihagytam.'});return null}
   if(r.letezik){frissit(s.kulcs,{allapot:'letezik',uzenet:'Ehhez a vizsgához már van ilyen lap. Ha ez a jobb, cseréld le (a javítások megmaradnak).'});return null}
   const put=await fetch(r.uploadUrl!,{method:'PUT',headers:{'Content-Type':'application/pdf'},body:s.file});
   if(!put.ok)throw new Error('A fájl feltöltése nem sikerült (HTTP '+put.status+').');
   const k=await api<{vizsgaId:string;feladatok:number;hibak:string[]}>('feladatbank/kesz',{method:'POST',body:JSON.stringify({fajlId:r.fajlId})},60000);
   // A „Hiányzik a …” jelzés itt félrevezető lenne, ha a pár a csomag következő fájlja:
   // a Lapok fülön úgyis látszik, ha a végén tényleg hiányzik valami.
   const gondok=k.hibak.filter(h=>!/^Hiányzik/.test(h));
   frissit(s.kulcs,{allapot:'feltoltve',vizsgaId:k.vizsgaId,uzenet:(k.feladatok?k.feladatok+' feladat felismerve.':'Feltöltve.')+(gondok.length?' '+gondok.join(' '):'')});
   return k.vizsgaId;
  }catch(e){
   if(e instanceof ApiError&&e.status===401)throw e;
   frissit(s.kulcs,{allapot:'hiba',uzenet:e instanceof Error?e.message:'Hiba a feltöltésnél.'});return null;
  }
 }

 async function feltolt(){
  setFut(true);
  try{
   const erintett=new Set<string>();
   for(const s of sorok.filter(x=>x.allapot==='kesz')){const id=await egyetFeltolt(s);if(id)erintett.add(id)}
   await betolt();
   await sorbanBesorol([...erintett]);
  }catch(e){fail(e)}finally{setFut(false)}
 }

 /** Feltöltés után a teljes lappárok (feladatlap + útmutató) besorolása, egymás után. */
 async function sorbanBesorol(ids:string[]){
  const friss=await api<{vizsgak:Vizsga[]}>('feladatbank');
  const kesz=friss.vizsgak.filter(v=>ids.includes(v.id)&&v.van_fl&&v.van_ut&&(v.feladatok||0)>0&&(v.besorolt||0)<(v.feladatok||0));
  for(const v of kesz){
   const vege=await besorol(v.id,gondolkodas,s=>setFolyamat(f=>({...f,[v.id]:s})));
   setFolyamat(f=>({...f,[v.id]:vege}));
  }
  if(kesz.length)await betolt();
 }

 async function egyVizsgaBesorol(v:Vizsga){
  setFut(true);
  try{const vege=await besorol(v.id,gondolkodas,s=>setFolyamat(f=>({...f,[v.id]:s})));setFolyamat(f=>({...f,[v.id]:vege}));await betolt()}
  catch(e){fail(e)}finally{setFut(false)}
 }

 async function modosit(f:Feladat,body:object){
  try{
   await api('feladatbank/feladat',{method:'PATCH',body:JSON.stringify({id:f.id,...body})});
   setEllenorizendo(list=>list?list.filter(x=>x.id!==f.id):list);
   setVizsgak(list=>list?list.map(v=>v.id===f.vizsga_id?{...v,ellenorizendo:Math.max(0,(v.ellenorizendo||1)-1)}:v):list);
  }catch(e){fail(e)}
 }

 const evek=useMemo(()=>{
  const m=new Map<number,Vizsga[]>();
  for(const v of vizsgak||[]){const g=m.get(v.ev);if(g)g.push(v);else m.set(v.ev,[v])}
  return [...m.entries()].sort((a,b)=>b[0]-a[0]);
 },[vizsgak]);

 if(phase==='checking')return <div className="us-login"><p className="us-status">Betöltés…</p></div>;
 if(phase==='login')return <Belepes onDone={()=>setPhase('ready')}/>;
 const varo=sorok.filter(s=>s.allapot==='kesz').length;

 return <div className="us-app">
  <header className="rd-top">
   <a href="/" className="rd-back"><Icon name="back" size={20} strokeWidth={2.2}/><span>Főoldal</span></a>
   <h1 className="pg-title">Érettségi feladatbank</h1>
   <div className="rd-right"><Kereso onAuth={()=>setPhase('login')}/><Fiokmenu/></div>
  </header>
  <main className="pg-main">
   <div className="us-seg fb-seg" role="group" aria-label="Nézet">
    <button type="button" aria-pressed={ful==='lapok'} onClick={()=>setFul('lapok')}>Lapok</button>
    <button type="button" aria-pressed={ful==='ellenorizendo'} onClick={()=>setFul('ellenorizendo')}>Ellenőrizendő{ellenorizendo?.length?' ('+ellenorizendo.length+')':''}</button>
    <button type="button" aria-pressed={ful==='feltoltes'} onClick={()=>setFul('feltoltes')}>Feltöltés</button>
   </div>
   {nincsBekotve&&<p className="up-warn">A feladatbank adatbázisa még nincs bekötve. Amíg a Vercel beállításaiba nem kerülnek be a feladatbank kulcsai, itt nem lehet feltölteni.</p>}

   {ful==='lapok'&&<>
    <label className="fb-check"><input type="checkbox" checked={gondolkodas} onChange={e=>{setGondolkodas(e.target.checked);gondolkodasMent(e.target.checked)}}/> AI gondolkodás a besorolásnál (pontosabb, de lassabb)</label>
    {vizsgak===null&&<p className="us-status">Betöltés…</p>}
    {vizsgak?.length===0&&!nincsBekotve&&<section className="us-empty"><h2>Még nincs feltöltött lap</h2><p>A Feltöltés fülön válaszd ki a Drive-mappából a feladatlapot és a hozzá tartozó javítási útmutatót. Egyszerre több fájlt is kijelölhetsz.</p><button type="button" className="us-btn us-btn-dark" onClick={()=>setFul('feltoltes')}>Feltöltés</button></section>}
    {evek.map(([ev,list])=><section key={ev} className="pg-group" aria-label={String(ev)}>
     <h2 className="us-grade-head">{ev}<small>{list.length} vizsga</small></h2>
     <div className="fb-lista">
      {list.map(v=><article key={v.id} className="fb-kartya">
       <div className="fb-kartya-fej">
        <h3><a href={'/feladatbank/vizsga?id='+v.id}>{honapNev(v.honap)} {Number(v.datum.slice(8,10))}. · {szintNev(v.szint)}</a></h3>
        <span className={'fb-allapot is-'+v.allapot}>{ALLAPOT[v.allapot]||v.allapot}</span>
       </div>
       <p className="fb-meta">{v.feladatok||0} feladat · {v.besorolt||0} besorolva{v.ellenorizendo?' · '+v.ellenorizendo+' ellenőrizendő':''} · {v.pontok||0} pont{v.szint!=='emelt'&&v.pontok?' (a II. B mind a három feladatával)':''}{v.vizsgakod?' · '+v.vizsgakod:''}</p>
       {!v.van_ut&&<p className="fb-figy">Hiányzik a javítási útmutató.</p>}
       {!v.van_fl&&<p className="fb-figy">Hiányzik a feladatlap.</p>}
       {(v.bontas_hibak||[]).filter(h=>!/^Hiányzik/.test(h)).map(h=><p key={h} className="fb-figy">{h}</p>)}
       {folyamat[v.id]&&<p className="fb-folyamat" role="status">{folyamat[v.id]}</p>}
       <div className="fb-gombok">
        <a className="us-btn us-btn-dark" href={'/feladatbank/vizsga?id='+v.id}>Feladatok</a>
        {v.van_fl&&<a className="us-btn" href={lapLink(v.id,'fl')}>Feladatlap</a>}
        {v.van_ut&&<a className="us-btn" href={lapLink(v.id,'ut')}>Útmutató</a>}
        {(v.feladatok||0)>0&&<button type="button" className="us-btn us-btn-ghost" disabled={fut} onClick={()=>void egyVizsgaBesorol(v)}>{(v.besorolt||0)>0?'Újra besorolás':'Besorolás AI-jal'}</button>}
       </div>
      </article>)}
     </div>
    </section>)}
   </>}

   {ful==='ellenorizendo'&&<>
    {ellenorizendo===null&&<p className="us-status">Betöltés…</p>}
    {ellenorizendo?.length===0&&<section className="us-empty"><h2>Nincs ellenőrizendő feladat</h2><p>Ide azok kerülnek, ahol az AI bizonytalan volt, ahol a pontszámok nem egyeztek, vagy ahol a feladatokra bontás nem sikerült rendesen.</p></section>}
    <div className="fb-lista">
     {ellenorizendo?.map(f=><article key={f.id} className="fb-kartya">
      <div className="fb-kartya-fej">
       <h3>{feladatCimke(f.sorszam,f.reszfeladat)} <span className="fb-halvany">{vizsgaCim(f)}</span></h3>
       {f.pont!==null&&<span className="fb-pont">{f.pont} pont</span>}
      </div>
      {ellenorzesOkai(f).map(o=><p key={o} className="fb-figy">{o}</p>)}
      <p className="fb-meta"><b>{temaFelirat(f.fo_kod)}</b>{f.mellek_kod?' · mellék: '+f.mellek_kod:''}{f.szoveges?' · szöveges':''}{f.megjegyzes?' · '+f.megjegyzes:''}</p>
      <div className="fb-gombok">
       <button type="button" className="us-btn us-btn-teal" disabled={!f.fo_kod} onClick={()=>void modosit(f,{jovahagy:true})}>Jó így</button>
       <TemaValaszto value={null} ures="Másik altéma…" label="Másik altéma" onChange={kod=>{if(kod)void modosit(f,{foKod:kod})}}/>
       <a className="us-btn" href={lapLink(String(f.vizsga_id),'fl',f)}>Megnyitás</a>
      </div>
     </article>)}
    </div>
   </>}

   {ful==='feltoltes'&&<>
    <section className="us-panel">
     <p className="fb-meta">Válaszd ki a feladatlapot és a hozzá tartozó javítási útmutatót (az Oktatási Hivatal eredeti fájlnevei maradhatnak). Egyszerre több fájl is mehet. Az app a lap tartalmából ismeri fel az évet, a szintet és a típust, a fájlnév csak segítség.</p>
     <label className="us-btn us-btn-dark fb-fajlgomb"><Icon name="upload" size={18}/>PDF-ek kiválasztása<input type="file" accept="application/pdf,.pdf" multiple className="sr-only" disabled={fut||nincsBekotve} onChange={e=>{void valaszt(e.target.files);e.target.value=''}}/></label>
    </section>
    {sorok.length>0&&<section className="us-panel">
     <table className="st-table fb-tabla">
      <thead><tr><th>Fájl</th><th>Felismerve</th><th>Állapot</th></tr></thead>
      <tbody>{sorok.map(s=><tr key={s.kulcs}>
       <td className="fb-fajlnev">{s.file.name}</td>
       <td>{leiras(s.az)||'–'}{s.allapot==='kesz'&&parHiany(s)&&<div className="fb-halvany">A párja nincs ebben a csomagban (ha már fent van, nem gond).</div>}</td>
       <td className={'fb-st is-'+s.allapot}>{s.uzenet||({kesz:'Feltöltésre kész',olvasas:'Beolvasás…'} as Record<string,string>)[s.allapot]||''}
        {s.allapot==='letezik'&&<button type="button" className="us-btn us-btn-ghost" disabled={fut} onClick={()=>{setFut(true);void egyetFeltolt(s,true).then(async id=>{await betolt();if(id)await sorbanBesorol([id])}).catch(fail).finally(()=>setFut(false))}}>Csere</button>}
       </td>
      </tr>)}</tbody>
     </table>
     <div className="fb-gombok">
      <button type="button" className="us-btn us-btn-dark" disabled={fut||!varo} onClick={()=>void feltolt()}>{fut?'Dolgozom…':'Feltöltés ('+varo+' fájl)'}</button>
      {!fut&&<button type="button" className="us-btn us-btn-ghost" onClick={()=>setSorok([])}>Lista ürítése</button>}
     </div>
     {fut&&<p className="fb-folyamat" role="status">Hagyd nyitva az oldalt, amíg végez. A feltöltés után az app magától besorolja a teljes lappárokat (lappáronként kb. fél–egy perc).</p>}
     {Object.entries(folyamat).length>0&&<ul className="fb-naplo">{Object.entries(folyamat).map(([id,s])=>{const v=vizsgak?.find(x=>x.id===id);return <li key={id}>{v?vizsgaCim(v):'Vizsga'}: {s}</li>})}</ul>}
    </section>}
   </>}
  </main>
  {toast&&<div className="us-toast" role="status"><span style={{flex:1}}>{toast}</span><button type="button" onClick={()=>setToast('')}>Rendben</button></div>}
 </div>;
}
