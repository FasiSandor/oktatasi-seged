'use client';
/** Local-only PDF inspection. No book text is sent to an AI provider. */
export type ProposedChapter={title:string;page:number;source:'outline'|'contents';selected:boolean};
export async function inspectPdf(file:File):Promise<{chapters:ProposedChapter[];notice:string}>{
 const pdfjs=await import('pdfjs-dist');
 pdfjs.GlobalWorkerOptions.workerSrc=new URL('pdfjs-dist/build/pdf.worker.min.mjs',import.meta.url).toString();
 const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),useSystemFonts:true}).promise;
 try{
  const found:ProposedChapter[]=[];
  const unique=new Set<string>();
  const add=(title:string,page:number,source:ProposedChapter['source'])=>{
   const clean=title.replace(/\s+/g,' ').trim().slice(0,160);
   if(clean.length<3||!Number.isInteger(page)||page<1||page>pdf.numPages)return;
   const key=clean.toLocaleLowerCase('hu')+':'+page;
   if(unique.has(key))return;
   unique.add(key);found.push({title:clean,page,source,selected:source==='outline'});
  };
  const outline=await pdf.getOutline();
  const walk=async(items:NonNullable<typeof outline>,depth:number)=>{
   for(const item of items){
    if(found.length>=150)return;
    try{
     let dest=item.dest;
     if(typeof dest==='string')dest=await pdf.getDestination(dest);
     if(Array.isArray(dest)&&dest[0]){
      const page=(await pdf.getPageIndex(dest[0]))+1;
      add(item.title,page,'outline');
     }
    }catch{/* one damaged outline entry must not block other chapters */}
    if(item.items?.length&&depth<2)await walk(item.items,depth+1);
   }
  };
  if(outline?.length)await walk(outline,0);
  if(found.length)return {chapters:found.sort((a,b)=>a.page-b.page),notice:'PDF-könyvjelzőkből felismert fejezetek. Ellenőrizd a címeket és PDF-oldalakat.'};
  // Printed table of contents: inspect both ends of a textbook.
  const candidatePages=[...new Set([...Array.from({length:Math.min(pdf.numPages,20)},(_,i)=>i+1),...Array.from({length:Math.min(pdf.numPages,18)},(_,i)=>pdf.numPages-i)])];
  type Positioned={x:number;y:number;str:string};
  async function positioned(index:number):Promise<{items:Positioned[];width:number;height:number}>{
   const page=await pdf.getPage(index),viewport=page.getViewport({scale:1}),content=await page.getTextContent();
   return {width:viewport.width,height:viewport.height,items:content.items.filter((v):v is typeof v & {str:string;transform:number[]}=>'str'in v&&'transform'in v&&typeof v.str==='string'&&!!v.str.trim()).map(v=>({str:v.str,x:v.transform[4],y:v.transform[5]}))};
  }
  // A page number must be verified before generating a jump. Avoid treating a printed page as a PDF page.
  let offset:number|null=null;
  for(const index of [5,6,7,8,9,10,11,12]){
   if(index>pdf.numPages)break;
   const {items,height}=await positioned(index);
   const labels=items.filter(x=>x.y<Math.min(75,height*.12)&&/^\d{1,3}$/.test(x.str.trim()))
    .map(x=>Number(x.str.trim())).filter(n=>n>=1&&n<=index);
   if(labels.length===1){offset=index-labels[0];break}
  }
  // One side of a two-column TOC must not consume text from the other column.
  const candidates:{title:string;printed:number}[]=[];
  for(const index of candidatePages){
   const {items,width}=await positioned(index);
   if(!items.some(x=>/^TARTALOM(?:JEGYZÉK)?$/i.test(x.str.trim())))continue;
   const left=items.filter(x=>x.x<width*.5);
   const right=items.filter(x=>x.x>=width*.5);
   for(const column of [left,right]){
    const bands=new Map<number,Positioned[]>();
    for(const token of column){
     const band=Math.round(token.y/3)*3;
     bands.set(band,[...(bands.get(band)||[]),token]);
    }
    const rows=[...bands.entries()].sort((a,b)=>b[0]-a[0]).map(([,tokens])=>tokens.sort((a,b)=>a.x-b.x));
    let wrapped='';
    for(const tokens of rows){
     const text=tokens.map(t=>t.str).join(' ').replace(/\s+/g,' ').trim();
     if(!text||/^TARTALOM(?:JEGYZÉK)?$/i.test(text))continue;
     // Right-aligned printed page number, independent of dotted leaders or font spacing.
     const last=tokens[tokens.length-1];
     const match=text.match(/^(.{4,155}?)\s*(?:\.\s*){2,}(\d{1,4})$/)
       ||text.match(/^(.{4,155}?)\s{2,}(\d{1,4})$/);
     const pageNumber=/^\d{1,4}$/.test(last.str.trim())?Number(last.str.trim()):match?Number(match[2]):null;
     const title=pageNumber!==null
      ?(match?.[1]||tokens.slice(0,-1).map(t=>t.str).join(' ')).replace(/(?:\s*\.\s*){2,}$/,'').trim()
      :'';
     if(pageNumber!==null&&title.length>=4&&pageNumber<=pdf.numPages){
      const cleaned=(wrapped?wrapped+' ':'')+title;
      const safe=cleaned.replace(/^\s*(?:\d{1,3}|R)\s+/, '').replace(/\s+/g,' ').trim();
      if(safe.length>=4&&!/^A tankönyv témakörei$/i.test(safe)&&!/^A feladatok végeredményei$/i.test(safe))candidates.push({title:safe,printed:pageNumber});
      wrapped='';
     }else if(pageNumber!==null&&wrapped&&pageNumber<=pdf.numPages){
      candidates.push({title:wrapped,printed:pageNumber});wrapped='';
     }else if(text.length>5&&!/^\d+$/.test(text)&&!/^[A-ZÁÉÍÓÖŐÚÜŰ ,–-]{6,}$/.test(text)&&!/^A tankönyv témakörei/i.test(text)){
      wrapped=text.replace(/(?:\s*\.\s*){2,}$/,'').replace(/^\s*(?:\d{1,3}|R)\s+/,'').trim().slice(0,140);
     }else wrapped='';
    }
   }
  }
  if(offset!==null){
   for(const c of candidates){
    const page=c.printed+offset;
    add(c.title,page,'contents');
   }
  }
  return {chapters:found,notice:found.length?'Két hasábos tartalomjegyzékből készült javaslatok. Ellenőrizd az oldalszámokat, a javaslatok nincsenek automatikusan kijelölve.':'Nem sikerült ellenőrzött PDF-oldalszámú tartalomjegyzéket készíteni. A nyomtatott és PDF-oldal közötti eltérés nem volt igazolható; a könyv ettől függetlenül használható.'};
 }finally{await pdf.destroy()}
}
