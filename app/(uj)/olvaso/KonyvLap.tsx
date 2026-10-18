'use client';
import {useEffect,useRef,useState} from 'react';

export type Stroke={id:string;pdf_page:number;tool:'marker'|'pen';color:string;width:number;points:number[][];local?:boolean};
export type Mark={id:string;pdf_page:number;kind:'highlight'|'underline';color:'yellow'|'cyan'|'green';x:number;y:number;w:number;h:number};
export type Tool='read'|'marker'|'pen'|'eraser';

// A minimális PDF.js-felület, amire szükségünk van (a teljes típus nagy és változékony).
type PdfPage={getViewport:(o:{scale:number})=>{width:number;height:number};render:(o:{canvasContext:CanvasRenderingContext2D;viewport:unknown;transform?:number[]})=>{promise:Promise<void>;cancel:()=>void}};
export type PdfDoc={numPages:number;getPage:(n:number)=>Promise<PdfPage>;destroy:()=>Promise<void>};

const MARK_FILL={yellow:'rgba(255,216,77,.42)',cyan:'rgba(168,212,255,.5)',green:'rgba(155,231,196,.5)'};
const MARK_LINE={yellow:'#E0B000',cyan:'#3B82C4',green:'#16A34A'};
const W=1000; // az SVG-réteg szélessége; a magasság az oldal arányából jön

/** Sima vonal a pontokon át: a szomszédos pontok felezőpontjain futó másodfokú ívek. */
function pathOf(points:number[][],h:number){
 if(!points.length)return '';
 const pt=(p:number[])=>[p[0]*W,p[1]*h];
 if(points.length===1){const [x,y]=pt(points[0]);return `M${x} ${y}l0.01 0`}
 let [px,py]=pt(points[0]);let d=`M${px.toFixed(1)} ${py.toFixed(1)}`;
 for(let i=1;i<points.length;i++){
  const [x,y]=pt(points[i]);const mx=(px+x)/2,my=(py+y)/2;
  d+=` Q${px.toFixed(1)} ${py.toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;px=x;py=y;
 }
 return d+` L${px.toFixed(1)} ${py.toFixed(1)}`;
}

function distToSegment(x:number,y:number,a:number[],b:number[]){
 const dx=b[0]-a[0],dy=b[1]-a[1];const len=dx*dx+dy*dy;
 const t=len?Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/len)):0;
 const cx=a[0]+t*dx,cy=a[1]+t*dy;return Math.hypot(x-cx,y-cy);
}

type Props={
 pdf:PdfDoc;page:number;maxWidth:number;tool:Tool;color:string;
 strokes:Stroke[];marks:Mark[];
 onStroke:(s:{tool:'marker'|'pen';color:string;width:number;points:number[][]})=>void;
 onErase:(id:string)=>void;
};

export const STROKE_WIDTH={marker:0.018,pen:0.0032};

export default function KonyvLap({pdf,page,maxWidth,tool,color,strokes,marks,onStroke,onErase}:Props){
 const canvas=useRef<HTMLCanvasElement>(null);
 const svg=useRef<SVGSVGElement>(null);
 const [size,setSize]=useState<{w:number;h:number}|null>(null);
 const [error,setError]=useState('');
 const [draft,setDraft]=useState<number[][]|null>(null);
 const drawing=useRef<{id:number;points:number[][]}|null>(null);
 const penSeen=useRef(false);
 const erased=useRef<Set<string>>(new Set());

 useEffect(()=>{try{penSeen.current=window.localStorage.getItem('rd-pen')==='1'}catch{}},[]);

 // Oldal kirajzolása élesen, a kijelző pixelsűrűségéhez igazítva.
 useEffect(()=>{
  let cancelled=false;let task:{promise:Promise<void>;cancel:()=>void}|null=null;
  (async()=>{
   try{
    setError('');
    const pg=await pdf.getPage(page);if(cancelled)return;
    const base=pg.getViewport({scale:1});
    const scale=Math.min(3,Math.max(0.3,maxWidth/base.width));
    const view=pg.getViewport({scale});
    const ratio=Math.min(window.devicePixelRatio||1,2);
    const c=canvas.current;if(!c)return;
    // A nagyon nagy vásznat az iPad Safari nem rajzolja ki, ezért korlátozzuk.
    const limit=Math.min(ratio,Math.sqrt(16_000_000/(view.width*view.height)));
    c.width=Math.floor(view.width*limit);c.height=Math.floor(view.height*limit);
    c.style.width=Math.floor(view.width)+'px';c.style.height=Math.floor(view.height)+'px';
    const ctx=c.getContext('2d');if(!ctx)return;
    setSize({w:Math.floor(view.width),h:Math.floor(view.height)});
    task=pg.render({canvasContext:ctx,viewport:view,transform:limit!==1?[limit,0,0,limit,0,0]:undefined});
    await task.promise;
   }catch(e){
    if(!cancelled&&!(e instanceof Error&&e.name==='RenderingCancelledException'))setError('Ez az oldal nem jeleníthető meg.');
   }
  })();
  return()=>{cancelled=true;task?.cancel()};
 },[pdf,page,maxWidth]);

 // Apple Pencil: a toll ne görgessen, az ujj viszont igen.
 useEffect(()=>{
  const el=svg.current;if(!el)return;
  function stylusOnly(e:TouchEvent){
   if(tool==='read')return;
   const touch=e.changedTouches[0] as Touch&{touchType?:string};
   if(touch?.touchType==='stylus'||!penSeen.current)e.preventDefault();
  }
  el.addEventListener('touchstart',stylusOnly,{passive:false});
  el.addEventListener('touchmove',stylusOnly,{passive:false});
  return()=>{el.removeEventListener('touchstart',stylusOnly);el.removeEventListener('touchmove',stylusOnly)};
 },[tool,size]);

 const h=size?W*size.h/size.w:W*1.4;

 function local(e:React.PointerEvent){
  const r=svg.current!.getBoundingClientRect();
  return [Math.min(1,Math.max(0,(e.clientX-r.left)/r.width)),Math.min(1,Math.max(0,(e.clientY-r.top)/r.height))];
 }
 function accepts(e:React.PointerEvent){
  if(tool==='read')return false;
  if(e.pointerType==='pen'&&!penSeen.current){penSeen.current=true;try{window.localStorage.setItem('rd-pen','1')}catch{}}
  // Ha már Pencil-lel rajzoltál, az ujjad lapoz és görget, nem rajzol.
  if(e.pointerType==='touch'&&penSeen.current)return false;
  if(e.pointerType==='mouse'&&e.button!==0)return false;
  return true;
 }
 function eraseAt(p:number[]){
  const x=p[0]*W,y=p[1]*h;
  for(const s of strokes){
   if(erased.current.has(s.id))continue;
   const pts=s.points.map(q=>[q[0]*W,q[1]*h]);
   const reach=s.width*W/2+10;
   const hit=pts.length===1?Math.hypot(x-pts[0][0],y-pts[0][1])<reach:pts.some((q,i)=>i>0&&distToSegment(x,y,pts[i-1],q)<reach);
   if(hit){erased.current.add(s.id);onErase(s.id)}
  }
 }
 function down(e:React.PointerEvent<SVGSVGElement>){
  if(!accepts(e))return;
  e.preventDefault();
  e.currentTarget.setPointerCapture(e.pointerId);
  erased.current=new Set();
  const p=local(e);
  if(tool==='eraser'){drawing.current={id:e.pointerId,points:[]};eraseAt(p);return}
  drawing.current={id:e.pointerId,points:[p]};setDraft([p]);
 }
 function move(e:React.PointerEvent<SVGSVGElement>){
  const d=drawing.current;if(!d||d.id!==e.pointerId)return;
  e.preventDefault();
  const events=typeof e.nativeEvent.getCoalescedEvents==='function'?e.nativeEvent.getCoalescedEvents():[e.nativeEvent];
  const r=svg.current!.getBoundingClientRect();
  for(const ev of events.length?events:[e.nativeEvent]){
   const p=[Math.min(1,Math.max(0,(ev.clientX-r.left)/r.width)),Math.min(1,Math.max(0,(ev.clientY-r.top)/r.height))];
   if(tool==='eraser'){eraseAt(p);continue}
   const last=d.points[d.points.length-1];
   if(Math.hypot((p[0]-last[0])*W,(p[1]-last[1])*h)<1.5)continue;
   if(d.points.length<1990)d.points.push(p);
  }
  if(tool!=='eraser')setDraft([...d.points]);
 }
 function up(e:React.PointerEvent<SVGSVGElement>){
  const d=drawing.current;if(!d||d.id!==e.pointerId)return;
  drawing.current=null;setDraft(null);
  if(tool==='marker'||tool==='pen'){
   if(d.points.length>=1)onStroke({tool,color,width:STROKE_WIDTH[tool],points:d.points});
  }
 }
 function cancel(){drawing.current=null;setDraft(null)}

 const pageStrokes=strokes.filter(s=>s.pdf_page===page);
 const pageMarks=marks.filter(m=>m.pdf_page===page);
 const drawingTool=tool==='marker'||tool==='pen'?tool:null;

 return <div className="rd-page" style={size?{width:size.w}:{width:Math.min(maxWidth,700),minHeight:400}}>
  <canvas ref={canvas} aria-label={page+'. oldal'} role="img"/>
  {!size&&!error&&<p className="rd-loading">Az oldal betöltése…</p>}
  {error&&<p className="rd-loading" role="alert">{error}</p>}
  {size&&<svg ref={svg} className={'rd-ink'+(tool!=='read'?' is-drawing':'')} viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="none"
   style={{touchAction:tool==='read'?'auto':penSeen.current?'pan-x pan-y pinch-zoom':'none'}}
   onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onLostPointerCapture={cancel}
   aria-hidden="true">
   {pageMarks.map(m=>m.kind==='highlight'
    ?<rect key={m.id} x={m.x*W} y={m.y*h} width={m.w*W} height={m.h*h} fill={MARK_FILL[m.color]} style={{mixBlendMode:'multiply'}}/>
    :<line key={m.id} x1={m.x*W} y1={(m.y+m.h)*h} x2={(m.x+m.w)*W} y2={(m.y+m.h)*h} stroke={MARK_LINE[m.color]} strokeWidth={3}/>)}
   {pageStrokes.map(s=><path key={s.id} d={pathOf(s.points,h)} fill="none" stroke={s.color} strokeWidth={s.width*W}
    strokeLinecap="round" strokeLinejoin="round" opacity={s.tool==='marker'?0.5:0.95}
    style={s.tool==='marker'?{mixBlendMode:'multiply'}:undefined}/>)}
   {draft&&drawingTool&&<path d={pathOf(draft,h)} fill="none" stroke={color} strokeWidth={STROKE_WIDTH[drawingTool]*W}
    strokeLinecap="round" strokeLinejoin="round" opacity={drawingTool==='marker'?0.5:0.95}
    style={drawingTool==='marker'?{mixBlendMode:'multiply'}:undefined}/>}
  </svg>}
 </div>;
}
