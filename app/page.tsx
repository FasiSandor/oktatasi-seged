'use client';
import {useEffect,useState} from 'react';
import './workspace.css';
type Tile={id:string;title:string;subtitle:string;icon:string;preview:string;url?:string;items:string[]};
const tiles:Tile[]=[
 {id:'curriculum',title:'Tananyagfa',subtitle:'Technikum · Matematika 9–12',icon:'◈',preview:'Témakörök, leckék, évfolyamok',url:'/cloud/curriculum',items:['Halmazok és logika','Kombinatorika','Algebra és függvények','Geometria']},
 {id:'library',title:'Könyvtár',subtitle:'Saját tankönyvek és feladatgyűjtemények',icon:'▣',preview:'Privát felhős források',url:'/cloud',items:['Feltöltött könyvek','PDF-tartalomjegyzék','Oldalhoz kapcsolás','AI-felismerés']},
 {id:'lessons',title:'Órai anyagok',subtitle:'A leckékhez kapcsolt tanári anyagok',icon:'▤',preview:'Tananyag szerinti gyűjtemény',url:'/cloud/curriculum',items:['Tanmeneti tervezet','Leckék és hivatkozások','PDF-oldalak','Feladatgyűjtemények']},
 {id:'tools',title:'Eszközök',subtitle:'Tanítást segítő digitális eszközök',icon:'✧',preview:'Külső segédletek',items:['GeoGebra','Desmos','WolframAlpha','Digitális függvénytáblázat']}
];
export default function Home(){
 const [active,setActive]=useState<string|null>(null);
 const [maximized,setMaximized]=useState(false);
 const selected=tiles.find(t=>t.id===active);
 useEffect(()=>{if(!active)return;function key(e:KeyboardEvent){if(e.key==='Escape'){setActive(null);setMaximized(false)}}window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[active]);
 function open(id:string){setActive(id);setMaximized(false)}
 function close(){setActive(null);setMaximized(false)}
 return <main className="os-workspace">
  <div className="os-halo" aria-hidden="true"/>
  <header className="os-header"><div className="os-brand"><span className="os-logo">◧</span><div><h1>Oktatási Segéd</h1><p>Digitális tanári munkafelület</p></div></div><div className="os-header-links"><a href="/cloud">Felhős könyvtár ↗</a><span className="os-state">Fejlesztési Preview</span></div></header>
  <section className="os-intro"><div><span className="os-kicker">MATEMATIKA · TECHNIKUM · 9–12.</span><h2>A tananyagaim egy helyen</h2><p>Nyiss meg egy kártyát. iPaden a munkafelületed fölött marad, és bármikor teljes képernyőre nagyíthatod.</p></div><a href="/cloud/curriculum" className="os-quicklink">Ugrás a tananyagfához ↗</a></section>
  <div className="os-tiles">{tiles.map((t,i)=><button type="button" key={t.id} className={'os-tile os-tile-'+t.id} onClick={()=>open(t.id)} aria-label={t.title+' megnyitása'}>
    <span className="os-tile-top"><span className="os-tile-icon">{t.icon}</span><span className="os-tile-arrow">↗</span></span>
    <strong>{t.title}</strong><span className="os-tile-subtitle">{t.subtitle}</span>
    <span className="os-tile-preview"><span className="os-preview-label">{t.preview}</span>{t.items.map(x=><span key={x} className="os-preview-line"><span className="os-dot"/> {x}</span>)}</span>
    <span className="os-tile-footer">Megnyitás <span>→</span></span>
   </button>)}</div>
  <footer className="os-footer">A munkafelület kártyás megjelenése fejlesztés alatt áll; a meglévő könyvtár és tananyagfa külön is megnyitható.</footer>
  {selected&&<div className="os-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}>
    <section className={'os-floating '+(maximized?'is-full':'')} role="dialog" aria-modal="true" aria-label={selected.title}>
      <div className="os-dialog-bar"><div className="os-dialog-title"><span className="os-dialog-icon">{selected.icon}</span><div><strong>{selected.title}</strong><small>{selected.subtitle}</small></div></div><div className="os-dialog-actions"><button onClick={()=>setMaximized(v=>!v)} aria-label={maximized?'Vissza a kártyanézethez':'Teljes képernyő'} title={maximized?'Kártyanézet':'Teljes képernyő'}>{maximized?'❐':'⛶'} <span>{maximized?'Kártyanézet':'Teljes képernyő'}</span></button><button className="os-close" onClick={close} aria-label="Bezárás">✕</button></div></div>
      <div className="os-dialog-body">{selected.url?<iframe key={selected.url} title={selected.title} src={selected.url}/>:<div className="os-tools"><h3>Hasznos matematikai eszközök</h3><p>Ezek külön böngészőlapon nyílnak meg; az Oktatási Segéd nyitva marad.</p><a href="https://www.geogebra.org/" target="_blank" rel="noopener noreferrer">GeoGebra ↗</a><a href="https://www.desmos.com/calculator" target="_blank" rel="noopener noreferrer">Desmos grafikus számológép ↗</a><a href="https://www.wolframalpha.com/" target="_blank" rel="noopener noreferrer">WolframAlpha ↗</a><a href="/cloud" >Saját tananyagokhoz kapcsolt eszközök →</a></div>}</div>
      <div className="os-dialog-bottom"><span>Oktatási Segéd · Egy munkafelület, több kártya</span>{selected.url&&<a href={selected.url} target="_blank" rel="noopener noreferrer">Külön lapon ↗</a>}</div>
    </section>
  </div>}
 </main>
}
