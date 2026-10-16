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
  // Fallback: extract lines resembling a printed contents list from the first pages.
  // Printed page numbers can differ from actual PDF page indices: these remain suggestions.
  const limit=Math.min(pdf.numPages,16);
  for(let i=1;i<=limit&&found.length<90;i++){
   const page=await pdf.getPage(i);const content=await page.getTextContent();
   const lines=new Map<number,string[]>();
   for(const part of content.items){
    if(!('str'in part)||!part.str?.trim()||!('transform'in part))continue;
    const y=Math.round(part.transform[5]/4)*4;
    lines.set(y,[...(lines.get(y)||[]),part.str]);
   }
   for(const line of lines.values()){
    const text=line.join(' ').replace(/\s+/g,' ').trim();
    const match=text.match(/^(.{5,115}?)(?:\s*\.{2,}\s*|\s{2,})(\d{1,4})\s*$/);
    if(!match)continue;
    const printed=Number(match[2]);
    // Never pretend printed pagination equals PDF pagination.
    if(printed>=1&&printed<=pdf.numPages)add(match[1],printed,'contents');
   }
  }
  return {chapters:found,notice:found.length?'A nyomtatott tartalomjegyzék alapján oldalszámjavaslat készült. Ezek NINCSENEK kijelölve: a nyomtatott oldalszám nem feltétlenül egyezik a PDF-oldallal. Ellenőrizd és jelöld ki egyenként a helyes PDF-oldalakat.':'Nem találtam megbízható tartalomjegyzéket. A könyv ettől függetlenül feltölthető, a témakörök később kézzel hozzáadhatók.'};
 }finally{await pdf.destroy()}
}
