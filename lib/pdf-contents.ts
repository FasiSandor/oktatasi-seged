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
  // Fallback: inspect pages headed TARTALOM, not arbitrary textbook body text.
  // A printed page number is NOT a PDF page index. Calibrate using the TOC page's own label.
  const candidatePages=[...new Set([...Array.from({length:Math.min(pdf.numPages,20)},(_,i)=>i+1),...Array.from({length:Math.min(pdf.numPages,14)},(_,i)=>pdf.numPages-i)])];
  // Printed pages can be offset by cover and copyright pages.
  // Infer it only from a clearly identifiable numbered page footer.
  let offset:number|null=null;
  for(const index of [5,6,7,8,9]){
   if(index>pdf.numPages)break;
   const p=await pdf.getPage(index);const c=await p.getTextContent();
   const footer=c.items.filter(t=>'str' in t&&'transform' in t&&t.transform[5]<85&&/^\\d{1,3}$/.test(t.str.trim()));
   const labels=footer.map(t=>Number(('str'in t?t.str:'').trim())).filter(n=>n>=1&&n<index);
   if(labels.length===1){offset=index-labels[0];break}
  }
  for(const i of candidatePages){
   if(found.length>=120)break;
   const page=await pdf.getPage(i);const content=await page.getTextContent();
   const items=content.items.filter((part):part is typeof part & {str:string;transform:number[]} => 'str'in part&&typeof part.str==='string'&&'transform'in part);
   const preview=items.slice(0,15).map(x=>x.str.trim()).filter(Boolean);
   const heading=preview.some(x=>/^TARTALOM(?:JEGYZÉK)?$/i.test(x))||items.some(x=>/^TARTALOM(?:JEGYZÉK)?$/i.test(x.str.trim()));
   if(!heading)continue;
   if(offset===null){
    const headingIndex=preview.findIndex(x=>/^TARTALOM(?:JEGYZÉK)?$/i.test(x));
    const printedLabel=preview.slice(headingIndex+1,headingIndex+4).find(x=>/^\d{1,3}$/.test(x));
    if(printedLabel){const candidate=(i-Number(printedLabel));if(candidate>=-25&&candidate<=30)offset=candidate}
   }
   const lines=new Map<number,{x:number;text:string}[]>();
   for(const part of items){
    if(!part.str.trim())continue;
    const y=Math.round(part.transform[5]/3)*3;
    const line=lines.get(y)||[];line.push({x:part.transform[4],text:part.str});lines.set(y,line);
   }
   const ordered=[...lines.entries()].sort((a,b)=>b[0]-a[0]);
   let pendingTitle='';
   let previousLine='';
   for(const [,parts] of ordered){
    const line=parts.sort((a,b)=>a.x-b.x).map(x=>x.text).join(' ').replace(/\s+/g,' ').trim();
    if(!line||/^TARTALOM(?:JEGYZÉK)?$/i.test(line))continue;
    // Dot leaders can be printed as spaced dots: ". . . . .".
    const match=line.match(/^(.{5,135}?)(?:\s*(?:\.\s*){3,}|\s{3,})(\d{1,4})\s*$/);
    if(match){
     const printed=Number(match[2]);
     const pdfPage=offset===null?0:printed+offset;
     if(pdfPage>=1&&pdfPage<=pdf.numPages)add(match[1].replace(/^\s*\d{1,3}\.\s*/,''),pdfPage,'contents');
     pendingTitle='';continue;
    }
    // Some PDF generators put the title and page number on separate text rows.
    if(/^\d{1,4}$/.test(line)&&pendingTitle){
     const printed=Number(line),pdfPage=offset===null?0:printed+offset;
     if(pdfPage>=1&&pdfPage<=pdf.numPages)add(pendingTitle||previousLine,pdfPage,'contents');
     pendingTitle='';continue;
    }
    if(/(?:\.\s*){4,}/.test(line))pendingTitle=line.replace(/(?:\.\s*){3,}.*$/,'').replace(/^\s*\d{1,3}\.\s*/,'').trim();
    else if(line.length>70)pendingTitle='';
   }
  }
  return {chapters:found,notice:found.length?'A tartalomjegyzék fejezeteit és a PDF-oldalakra számított hivatkozásokat megtaláltam. A javaslatok nincsenek kijelölve; ellenőrizd és hagyd jóvá őket.':'Nem találtam megbízható tartalomjegyzéket. A könyv ettől függetlenül feltölthető, a témakörök később kézzel hozzáadhatók.'};
 }finally{await pdf.destroy()}
}
