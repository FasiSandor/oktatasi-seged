'use client';
import {useEffect,useRef,useState} from 'react';
import {authenticatedJWT} from '../../lib/auth-client';
type Mark={id:string;pdf_page:number;kind:'highlight'|'underline';color:'yellow'|'cyan'|'green';x:number;y:number;w:number;h:number};
type Props={documentId:string;pdfUrl:string;page:number;onPageChange:(p:number)=>void};
export default function PdfMarkup({documentId,pdfUrl,page,onPageChange}:Props){
 const canvas=useRef<HTMLCanvasElement>(null),container=useRef<HTMLDivElement>(null);
 const [pdf,setPdf]=useState<any>(null),[count,setCount]=useState(0),[width,setWidth]=useState(600);
 const [saving,setSaving]=useState(false);
 const [marks,setMarks]=useState<Mark[]>([]),[tool,setTool]=useState<'navigate'|'highlight'|'underline'>('navigate');
 const [color,setColor]=useState<'yellow'|'cyan'|'green'>('yellow'),[start,setStart]=useState<{x:number;y:number}|null>(null);
 const [draft,setDraft]=useState<{x:number;y:number;w:number;h:number}|null>(null),[error,setError]=useState('');
 const [pageInput,setPageInput]=useState(String(page));
 useEffect(()=>setPageInput(String(page)),[page]);
 useEffect(()=>{let disposed=false;let loaded:any;
 (async()=>{try{const pdfjs=await import('pdfjs-dist');pdfjs.GlobalWorkerOptions.workerSrc=new URL('pdfjs-dist/build/pdf.worker.min.mjs',import.meta.url).toString();
 const loading=pdfjs.getDocument({url:pdfUrl,withCredentials:false});loaded=await loading.promise;if(!disposed){setPdf(loaded);setCount(loaded.numPages)}}catch(e){if(!disposed)setError('A PDF nem tölthető be: '+(e instanceof Error?e.message:'ismeretlen hiba'))}})();
 return()=>{disposed=true;setPdf(null);if(loaded)void loaded.destroy()};
 },[pdfUrl]);
 useEffect(()=>{const root=container.current;if(!root)return;const resize=new ResizeObserver(entries=>setWidth(Math.max(200,Math.floor(entries[0]?.contentRect.width||600))));resize.observe(root);return()=>resize.disconnect()},[]);
 useEffect(()=>{if(!pdf||!canvas||page<1||page>count)return;let cancelled=false;let task:any;
 (async()=>{try{const pg=await pdf.getPage(page);if(cancelled)return;const viewport=pg.getViewport({scale:1});const scale=Math.min(2.25,(width-4)/viewport.width);
 const view=pg.getViewport({scale}),c=canvas.current;if(!c)return;c.width=Math.ceil(view.width);c.height=Math.ceil(view.height);c.style.width=Math.ceil(view.width)+'px';c.style.height=Math.ceil(view.height)+'px';
 task=pg.render({canvasContext:c.getContext('2d')!,viewport:view});await task.promise}catch(e){if(!cancelled&&!(e instanceof Error&&e.name==='RenderingCancelledException'))setError('Az oldal nem jeleníthető meg')}})();
 return()=>{cancelled=true;if(task)task.cancel()};
 },[pdf,page,width,count]);
 useEffect(()=>{let cancelled=false;setMarks([]);(async()=>{try{const token=await authenticatedJWT();const r=await fetch('/api/cloud/pdf-marks?documentId='+encodeURIComponent(documentId),{headers:{Authorization:'Bearer '+token}});if(!r.ok)throw Error('A jelölések betöltése nem sikerült');const d=await r.json();if(!cancelled)setMarks(d.marks||[])}catch(e){if(!cancelled)setError(e instanceof Error?e.message:'Jelöléshiba')}})();return()=>{cancelled=true}},[documentId]);
 function coords(e:React.PointerEvent<HTMLDivElement>){const rect=e.currentTarget.getBoundingClientRect();return{x:Math.min(1,Math.max(0,(e.clientX-rect.left)/rect.width)),y:Math.min(1,Math.max(0,(e.clientY-rect.top)/rect.height))}}
 function down(e:React.PointerEvent<HTMLDivElement>){if(tool==='navigate')return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);setStart(coords(e));setDraft(null)}
 function move(e:React.PointerEvent<HTMLDivElement>){if(!start)return;const p=coords(e);setDraft({x:Math.min(start.x,p.x),y:Math.min(start.y,p.y),w:Math.abs(start.x-p.x),h:Math.abs(start.y-p.y)})}
 async function up(e:React.PointerEvent<HTMLDivElement>){if(!start)return;const p=coords(e);const box={x:Math.min(start.x,p.x),y:Math.min(start.y,p.y),w:Math.abs(start.x-p.x),h:Math.abs(start.y-p.y)};
 setStart(null);setDraft(null);if(box.w<.008||box.h<.004||saving)return;
 setSaving(true);try{const token=await authenticatedJWT();const res=await fetch('/api/cloud/pdf-marks',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({documentId,page,kind:tool,color,...box})});if(!res.ok)throw Error('Jelölés mentése sikertelen');const data=await res.json();setMarks(v=>[...v,data.mark])}catch(e){setError(e instanceof Error?e.message:'Mentési hiba')}finally{setSaving(false)}
 }
 async function remove(id:string){try{const token=await authenticatedJWT();const r=await fetch('/api/cloud/pdf-marks?id='+encodeURIComponent(id),{method:'DELETE',headers:{Authorization:'Bearer '+token}});if(!r.ok)throw Error('Törlés sikertelen');setMarks(v=>v.filter(x=>x.id!==id))}catch(e){setError(e instanceof Error?e.message:'Hiba')}}
 const current=marks.filter(m=>m.pdf_page===page);const colors={yellow:'rgba(250,204,21,.35)',cyan:'rgba(34,211,238,.35)',green:'rgba(34,197,94,.3)'};
 return <section aria-label="Jelölhető PDF-olvasó" style={{display:'grid',gap:10}}>
 <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
 <button type="button" onClick={()=>onPageChange(Math.max(1,page-1))} disabled={page<=1}>← Előző</button><label>PDF-oldal <input aria-label="PDF-oldalszám" type="number" min={1} max={count||100000} value={pageInput} onChange={e=>setPageInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){onPageChange(Math.max(1,Math.min(count||100000,Number(pageInput)||1)))}}} style={{width:72,padding:5,borderRadius:7,border:'1px solid #cbd5e1'}}/> / {count||'…'}</label><button type="button" onClick={()=>onPageChange(Math.max(1,Math.min(count||100000,Number(pageInput)||1)))}>Ugrás</button><button type="button" onClick={()=>onPageChange(Math.min(count,page+1))} disabled={!count||page>=count}>Következő →</button>
 <label>Eszköz <select value={tool} onChange={e=>setTool(e.target.value as typeof tool)}><option value="navigate">Olvasás</option><option value="highlight">Kiemelés</option><option value="underline">Aláhúzás</option></select></label>
 <label>Szín <select value={color} onChange={e=>setColor(e.target.value as typeof color)}><option value="yellow">Sárga</option><option value="cyan">Cián</option><option value="green">Zöld</option></select></label>
 </div>
 <p style={{fontSize:12,color:'#65738b',margin:0}}>A Kiemelés vagy Aláhúzás eszközzel húzz téglalapot az oldalon. Apple Pencil használatakor válaszd ki az eszközt; Olvasás módban görgethetsz. A jelölés privát, és nem módosítja az eredeti PDF-et.</p>
 {saving&&<p role="status" style={{color:'#475569'}}>Jelölés mentése…</p>}{error&&<p role="alert" style={{color:'#b91c1c'}}>{error}</p>}
 <div ref={container} style={{width:'100%',overflow:'auto',background:'#e9eef7',display:'flex',justifyContent:'center',padding:'12px 2px',boxSizing:'border-box'}}>
 <div style={{position:'relative',width:'fit-content',maxWidth:'100%',touchAction:tool==='navigate'?'auto':'none',userSelect:'none'}} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={()=>{setStart(null);setDraft(null)}}>
 <canvas ref={canvas} style={{maxWidth:'100%',height:'auto',display:'block',boxShadow:'0 3px 16px #17203333'}}/>
 <div style={{position:'absolute',inset:0,pointerEvents:'none'}}>{current.map(m=><div key={m.id} style={{position:'absolute',left:(m.x*100)+'%',top:(m.y*100)+'%',width:(m.w*100)+'%',height:(m.h*100)+'%',background:m.kind==='highlight'?colors[m.color]:'transparent',borderBottom:m.kind==='underline'?'3px solid '+({yellow:'#eab308',cyan:'#0891b2',green:'#16a34a'}[m.color]):undefined}}/>)}{draft&&<div style={{position:'absolute',left:draft.x*100+'%',top:draft.y*100+'%',width:draft.w*100+'%',height:draft.h*100+'%',background:colors[color],border:'1px dashed #2563eb'}}/>}</div>
 </div></div>
 {current.length>0&&<div style={{display:'flex',gap:7,flexWrap:'wrap'}}>{current.map((m,i)=><button type="button" key={m.id} onClick={()=>void remove(m.id)} aria-label={'Jelölés '+(i+1)+' törlése'} style={{padding:'6px 9px',borderRadius:8,border:'1px solid #cbd5e1',background:'#fff'}}> {m.kind==='highlight'?'Kiemelés':'Aláhúzás'} {i+1} ×</button>)}</div>}
 </section>
}
