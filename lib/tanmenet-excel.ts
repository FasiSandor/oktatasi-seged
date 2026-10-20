'use client';

/**
 * Tanmenet beolvasása Excelből (.xlsx). Az iskolai sablonhoz igazodik:
 * fejléc „Hónap | Hét | Óra | Tananyag”, a hónap és a hét csak a csoport első sorában szerepel.
 * Felül a „Tantárgy:”, „Osztály:” és a tanév sorát is kiolvassa, ha megtalálja.
 */
export type ParsedLesson={month:string|null;week:number|null;lesson_no:number|null;content:string};
export type ParsedPlan={lessons:ParsedLesson[];subjectName:string;grade:number|null;schoolYear:string;sheet:string};

type Cell=string|number|boolean|Date|null;
const str=(c:Cell|undefined)=>c==null?'':c instanceof Date?c.toISOString():String(c).trim();
const norm=(s:string)=>s.toLocaleLowerCase('hu').replace(/[:.]/g,'').trim();

export async function readPlanExcel(file:Blob):Promise<ParsedPlan>{
 const readXlsxFile=(await import('read-excel-file')).default;
 let rows:Cell[][];
 try{rows=await readXlsxFile(file) as Cell[][]}catch{throw new Error('Ezt a fájlt nem tudom Excelként megnyitni. .xlsx formátum kell (Excelben: Mentés másként → Excel-munkafüzet).')}

 // Fejlécsor: kell egy „Óra” és egy „Tananyag” (vagy „Téma”) oszlop.
 let head=-1,col={month:-1,week:-1,no:-1,content:-1};
 for(let i=0;i<Math.min(rows.length,40)&&head<0;i++){
  const cells=rows[i].map(c=>norm(str(c)));
  const no=cells.findIndex(c=>c==='óra'||c==='óraszám'||c==='sorszám'||c==='ó');
  const content=cells.findIndex(c=>/^(tananyag|téma|az óra témája|óra anyaga|tartalom)/.test(c));
  if(no>=0&&content>=0){head=i;col={month:cells.findIndex(c=>c==='hónap'),week:cells.findIndex(c=>c==='hét'),no,content}}
 }
 if(head<0)throw new Error('Nem találom a fejlécet. A táblázatban kell egy „Óra” és egy „Tananyag” oszlop.');

 // Fejadatok a fejléc fölött: „Tantárgy: MATEMATIKA”, „Osztály: 9.”, „2026/2027. tanév”.
 let subjectName='',grade:number|null=null,schoolYear='';
 for(const r of rows.slice(0,head)){
  const cells=r.map(str);
  cells.forEach((c,i)=>{
   const n=norm(c);const next=cells.slice(i+1).find(Boolean)||'';
   if(n==='tantárgy'&&next)subjectName=next;
   if((n==='osztály'||n==='évfolyam')&&next){const m=next.match(/\d{1,2}/);if(m)grade=Number(m[0])}
   const y=c.match(/(20\d\d)\s*\/\s*(20\d\d|\d\d)/);if(y&&!schoolYear)schoolYear=y[1]+'/'+(y[2].length===2?y[2]:y[2].slice(2));
  });
 }

 const lessons:ParsedLesson[]=[];let month:string|null=null,week:number|null=null;
 for(const r of rows.slice(head+1)){
  const m=col.month>=0?str(r[col.month]):'';if(m)month=m;
  const w=col.week>=0?Number(str(r[col.week])):NaN;if(Number.isInteger(w)&&w>0)week=w;
  const content=str(r[col.content]).replace(/\s+/g,' ');
  if(!content)continue;
  const no=Number(str(r[col.no]));
  lessons.push({month,week,lesson_no:Number.isInteger(no)&&no>0?no:null,content:content.slice(0,2000)});
 }
 if(!lessons.length)throw new Error('A fejléc alatt nem találtam órát.');
 return {lessons,subjectName,grade,schoolYear,sheet:''};
}
