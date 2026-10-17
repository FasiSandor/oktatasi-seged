'use client';
import {useEffect,useState} from 'react';
import {authClient,authenticatedJWT} from '../../lib/auth-client';
import {inspectPdf,type ProposedChapter} from '../../lib/pdf-contents';
import {suggestedTopicMatch} from '../../lib/topic-matching';
type Subject={id:string;name:string};
type Topic={id:string;name:string;parent_id?:string|null};
type Doc={id:string;title:string;filename:string;mime_type:string;pdf_page?:number;category?:string;link_id?:string};
type ToolLink={id:string;label:string;url:string;provider:string};
export default function Cloud(){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState(''),[loggedIn,setLoggedIn]=useState(false),[subjects,setSubjects]=useState<Subject[]>([]),[topics,setTopics]=useState<Topic[]>([]),[docs,setDocs]=useState<Doc[]>([]);
 const [connectionStatus,setConnectionStatus]=useState('');const [uploadStatus,setUploadStatus]=useState(''),[selectedFilename,setSelectedFilename]=useState('');const [suggestionMatches,setSuggestionMatches]=useState<Record<number,string>>({}),[suggestions,setSuggestions]=useState<ProposedChapter[]>([]),[suggestionDoc,setSuggestionDoc]=useState(''),[suggestionNotice,setSuggestionNotice]=useState('');
 const [chapterNames,setChapterNames]=useState<Record<number,string>>({});
 const [aiAudit,setAiAudit]=useState<{numberedCount:number;range:number[]|null;missing:number[];duplicated:number[]}|null>(null);
 const [activeDocId,setActiveDocId]=useState(''),[sessionChecked,setSessionChecked]=useState(false);const [search,setSearch]=useState(''),[searchResults,setSearchResults]=useState<{documents:Doc[];topics:{id:string;name:string;subject_id:string;subject_name:string}[]}|null>(null),[readingPage,setReadingPage]=useState(1);const [category,setCategory]=useState('reference'),[startPage,setStartPage]=useState(1);const [allDocs,setAllDocs]=useState<Doc[]>([]),[existingId,setExistingId]=useState(''),[tools,setTools]=useState<ToolLink[]>([]);const [subject,setSubject]=useState(''),[topic,setTopic]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[preview,setPreview]=useState(''),[previewType,setPreviewType]=useState(''),[previewTitle,setPreviewTitle]=useState('');
 useEffect(()=>{let active=true;withTimeout(authClient().getSession(),12000).then(async r=>{if(active&&r.data?.session){try{await withTimeout(authenticatedJWT(),12000);if(active)setLoggedIn(true)}catch{if(active)setLoggedIn(false)}}}).catch(()=>{}).finally(()=>{if(active)setSessionChecked(true)});return()=>{active=false}},[]);
 async function withTimeout<T>(promise:PromiseLike<T>,ms=15000):Promise<T>{return Promise.race([Promise.resolve(promise),new Promise<T>((_,reject)=>setTimeout(()=>reject(new Error('A kapcsolat nem válaszol. Ellenőrizd a Neon Auth kapcsolatot és próbáld újra.')),ms))])}
 async function api(path:string,options:RequestInit={}){let token:string;try{token=await withTimeout(authenticatedJWT())}catch(e){if(e instanceof Error&&e.message==='Jelentkezz be ismét.'){setLoggedIn(false);setSubjects([]);setTopics([]);setDocs([]);setAllDocs([]);setMessage('A munkamenet lejárt. Jelentkezz be ismét a folytatáshoz.')}throw e}const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),path==='ai-contents'?65000:15000);let r:Response;try{r=await fetch('/api/cloud/'+path,{...options,headers:{'Authorization':'Bearer '+token,...(options.body?{'Content-Type':'application/json'}:{})},signal:controller.signal})}finally{clearTimeout(timeout)}const data=await r.json();if(!r.ok)throw Error(data.error||'Sikertelen kérés');return data}
 async function run(work:()=>Promise<void>){setBusy(true);setMessage('');try{await withTimeout(work(),20000)}catch(e){setMessage(e instanceof Error?e.message:'Hiba')}finally{setBusy(false)}}
 async function signIn(){const res=await withTimeout(authClient().signIn.email({email,password}));if(res.error)throw Error(res.error.message||'Hibás bejelentkezés');setLoggedIn(true);setPassword('');try{await getSubjects()}catch(e){setMessage('Belépés sikeres, de a könyvtár betöltése nem sikerült: '+(e instanceof Error?e.message:'Hiba'))}}
 async function signUp(){if(!name.trim())throw Error('Adj meg nevet');const res=await withTimeout(authClient().signUp.email({email,password,name:name.trim()}));if(res.error)throw Error(res.error.message||'Sikertelen regisztráció');setLoggedIn(true);setPassword('');await getSubjects()}
 async function signOut(){await authClient().signOut();setLoggedIn(false);setSubjects([]);setTopics([]);setDocs([]);setAllDocs([]);setTools([]);setPreview('');setPreviewTitle('');setSubject('');setTopic('');setActiveDocId('')}
 async function checkCloud(){setConnectionStatus('Kapcsolatok ellenőrzése…');try{const status=await api('preflight');setConnectionStatus(status.auth&&status.database&&status.storageSigning?'✓ Bejelentkezés, adatbázis és tárhely-előkészítés rendben. A tényleges fájlátvitel még nincs ellenőrizve.':'A kapcsolatellenőrzés nem sikerült.')}catch(e){setConnectionStatus('Kapcsolati hiba: '+(e instanceof Error?e.message:'Ismeretlen hiba'))}}
 async function getSubjects(){const v=await api('subjects');setSubjects(v.subjects);setAllDocs((await api('documents')).documents)}
 async function getTopics(id:string){setSubject(id);setTopic('');setDocs([]);setTopics((await api('topics?subjectId='+encodeURIComponent(id))).topics)}
 async function getDocs(id:string){setTopic(id);const [d,t]=await Promise.all([api('documents?topicId='+encodeURIComponent(id)),api('tools?topicId='+encodeURIComponent(id))]);setDocs(d.documents);setTools(t.tools)}
 async function createSubject(){const name=prompt('Tantárgy neve');if(!name)return;await api('subjects',{method:'POST',body:JSON.stringify({name})});await getSubjects()}
 async function createTopic(){const name=prompt('Új témakör');if(!name||!subject)return;await api('topics',{method:'POST',body:JSON.stringify({name,subjectId:subject})});await getTopics(subject)}
 async function directPut(url:string,file:File,mime:string):Promise<void>{
 return new Promise((resolve,reject)=>{
  const xhr=new XMLHttpRequest();
  xhr.open('PUT',url,true);
  xhr.timeout=10*60*1000;
  xhr.setRequestHeader('Content-Type',mime);
  xhr.upload.onprogress=event=>{
   if(event.lengthComputable&&event.total>0){
    const pct=Math.min(99,Math.round(event.loaded/event.total*100));
    setUploadStatus('Feltöltés: '+pct+'% ('+Math.round(event.loaded/1048576)+' / '+Math.round(event.total/1048576)+' MB)');
   }
  };
  xhr.onload=()=>{
   if(xhr.status>=200&&xhr.status<300){resolve();return}
   // Read only the S3 error code: never show signed URLs, keys, or request signatures.
   const code=xhr.responseText.match(/<Code>([A-Za-z0-9_-]{2,80})<\/Code>/)?.[1]||'UNKNOWN';
   const hint:Record<string,string>={
    SignatureDoesNotMatch:'A feltöltési URL aláírása nem egyezik a kéréssel. Ellenőrizendő az S3-régió, a Content-Type és az aláírás.',
    InvalidAccessKeyId:'A Neon Storage hozzáférési azonosítója érvénytelen.',
    AccessDenied:'A tárhely-hitelesítés jogosultsága nem megfelelő, vagy az aláírás nem elfogadható.',
    RequestTimeTooSkewed:'Az időeltérés miatt a tárhely elutasította a kérést.',
    ExpiredToken:'A feltöltési hivatkozás hitelesítése lejárt.'
   };
   reject(new Error('Tárhely HTTP '+xhr.status+' – '+code+'. '+(hint[code]||'A tárhely visszautasította a kérést.')));
  };
  xhr.onerror=()=>reject(new Error('Nem sikerült elérni a privát tárhelyet. Lehetséges hálózati vagy CORS-hiba.'));
  xhr.ontimeout=()=>reject(new Error('A fájl feltöltése időtúllépés miatt megszakadt.'));
  xhr.send(file);
 });
}
async function upload(file:File):Promise<string>{
 // A könyv önállóan is feltölthető; témakörhöz később rendelhető.
 if(file.size>500*1024*1024)throw Error('Legfeljebb 500 MB tölthető fel.');
 const mime=file.type||({pdf:'application/pdf',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation'} as Record<string,string>)[file.name.split('.').pop()?.toLowerCase()||''];
 setUploadStatus('Feltöltési hivatkozás előkészítése…');
 const up=await api('upload',{method:'POST',body:JSON.stringify({filename:file.name,mimeType:mime,size:file.size})});
 setUploadStatus('Kapcsolódás a privát tárhelyhez…');
 await directPut(up.uploadUrl,file,mime);
 setUploadStatus('Feltöltött fájl ellenőrzése…');
 await api('upload/complete',{method:'POST',body:JSON.stringify({documentId:up.documentId})});
 if(topic){await api('links',{method:'POST',body:JSON.stringify({topicId:topic,documentId:up.documentId,category,page:mime==='application/pdf'?startPage:null})});await getDocs(topic)}
 setMessage('A könyv feltöltve. Válassz témakört, és rendeld hozzá a megfelelő PDF-oldalt.');
 setAllDocs((await api('documents')).documents);
 return up.documentId;
}
 async function importBook(file:File){
  setBusy(true);setSelectedFilename(file.name);setUploadStatus('Kapcsolatok ellenőrzése…');setSuggestions([]);setSuggestionMatches({});setSuggestionDoc('');setSuggestionNotice('');setMessage('PDF tartalomjegyzék vizsgálata…');
  try{
   await api('preflight');setUploadStatus('PDF elemzése…');
   let chapters:ProposedChapter[]=[];let notice='';
   if(file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf')){
    try{const result=await inspectPdf(file);chapters=result.chapters;notice=result.notice}
    catch(e){notice='A PDF tartalomjegyzéke nem volt automatikusan olvasható. A könyv enélkül is feltölthető: '+(e instanceof Error?e.message:'Hiba')}
   }
   setUploadStatus('Fájl átvitele a privát könyvtárba…');const id=await upload(file);setUploadStatus('Feltöltés kész: '+file.name);setSuggestionDoc(id);setSuggestions(chapters);setSuggestionNotice(notice);
   setMessage(chapters.length?'Könyv feltöltve. Ellenőrizd a javasolt fejezeteket, majd rendeld őket a kiválasztott tantárgyhoz.':'A könyv feltöltve a központi tárba.');
  }catch(e){const error=e instanceof Error?e.message:'Sikertelen feltöltés';setUploadStatus('Hiba: '+error);setMessage(error)}
  finally{setBusy(false)}
 }
 async function reanalyzeDocument(d:Doc){
  if(!d.mime_type?.includes('pdf'))throw Error('Csak PDF-könyv tartalomjegyzéke ismerhető fel.');
  setBusy(true);setSuggestionDoc('');setSuggestions([]);setSuggestionMatches({});
  setSuggestionNotice('');setAiAudit(null);setChapterNames({});setSelectedFilename(d.filename);setUploadStatus('Már feltöltött könyv tartalomjegyzékének elemzése…');
  try{
   const info=await api('download?id='+encodeURIComponent(d.id));
   const response=await fetch(info.url);
   if(!response.ok)throw Error('A könyv olvasása sikertelen (HTTP '+response.status+').');
   const file=new File([await response.blob()],d.filename,{type:'application/pdf'});
   const result=await inspectPdf(file);
   setSuggestionDoc(d.id);setSuggestions(result.chapters);setSuggestionNotice(result.notice);
   setUploadStatus(result.chapters.length?result.chapters.length+' fejezetjavaslat. Ellenőrizd az oldalszámokat.':'A könyv megvan, de automatikus tartalomjegyzéket nem találtam.');
  }catch(e){setUploadStatus('Elemzési hiba: '+(e instanceof Error?e.message:'Ismeretlen hiba'))}
  finally{setBusy(false)}
 }
 async function aiAnalyzeDocument(d:Doc){
  if(!d.mime_type?.includes('pdf'))return;
  setBusy(true);setSuggestionDoc('');setSuggestions([]);setSuggestionMatches({});setSuggestionNotice('');
  setAiAudit(null);setChapterNames({});setSelectedFilename(d.filename);setUploadStatus('Gemini: a tartalomjegyzék előkészítése…');
  try{
   const info=await api('download?id='+encodeURIComponent(d.id));
   const response=await fetch(info.url);
   if(!response.ok)throw Error('Nem sikerült megnyitni a könyvet.');
   const pdfjs=await import('pdfjs-dist');
   pdfjs.GlobalWorkerOptions.workerSrc=new URL('pdfjs-dist/build/pdf.worker.min.mjs',import.meta.url).toString();
   const pdf=await pdfjs.getDocument({data:new Uint8Array(await response.arrayBuffer())}).promise;
   try{
    const possible=[...new Set([...Array.from({length:Math.min(16,pdf.numPages)},(_,i)=>i+1),...Array.from({length:Math.min(20,pdf.numPages)},(_,i)=>pdf.numPages-i)])];
    const tocPages:number[]=[];
    for(const index of possible){
     const page=await pdf.getPage(index);const contents=await page.getTextContent();
     const found=contents.items.some(t=>'str'in t&&/^TARTALOM(?:JEGYZÉK)?$/i.test(t.str.trim()));
     if(found)tocPages.push(index);
    }
    if(!tocPages.length)throw Error('Nem találtam TARTALOM feliratú oldalt. A Gemini-elemzés nem indult el.');
    // Use only validated printed-to-PDF page offsets. Never save a guessed jump target.
    let offset:number|null=null;
    for(const index of [5,6,7,8,9,10,11,12]){
     if(index>pdf.numPages)break;
     const page=await pdf.getPage(index),text=await page.getTextContent();
     const footer=text.items.filter(t=>'str'in t&&'transform'in t&&t.transform[5]<75&&/^\d{1,3}$/.test(t.str.trim()))
       .map(t=>Number(('str'in t?t.str:'').trim())).filter(v=>v>=1&&v<=index);
     if(footer.length===1){offset=index-footer[0];break}
    }
    if(offset===null)throw Error('A nyomtatott és PDF-oldalszám eltérése nem ellenőrizhető. Biztonságból nem készítek téves ugrásokat.');
    const images:{page:number;data:string}[]=[];
    for(const index of tocPages.slice(0,4)){
     const page=await pdf.getPage(index),viewport=page.getViewport({scale:1.65});
     const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
     const context=canvas.getContext('2d');if(!context)throw Error('A PDF megjelenítése nem lehetséges.');
     await page.render({canvasContext:context,viewport}).promise;
     images.push({page:index,data:canvas.toDataURL('image/jpeg',0.82).split(',')[1]});
     canvas.width=0;canvas.height=0;
    }
    setUploadStatus('Gemini: fejezetek és leckék felismerése…');
    const data=await api('ai-contents',{method:'POST',body:JSON.stringify({documentId:d.id,images})}) as {lessons:{title:string;printedPage:number;lessonNumber?:number;chapterTitle?:string}[];diagnostics:{numberedCount:number;range:number[]|null;missing:number[];duplicated:number[]}};
    const found:ProposedChapter[]=[];const seen=new Set<string>();const proposedGroups:Record<number,string>={};
    for(const item of data.lessons||[]){
     const title=item.title.replace(/\s+/g,' ').trim().replace(/^(?:\d{1,3}|R)\s+/,''),page=item.printedPage+offset;
     if(/^A tankönyv témakörei$/i.test(title)||/^A feladatok végeredményei$/i.test(title))continue;
     const key=title.toLocaleLowerCase('hu')+':'+page;
     if(title.length<4||page<1||page>pdf.numPages||seen.has(key))continue;
     seen.add(key);const group=(item.chapterTitle||'').trim().slice(0,120);proposedGroups[found.length]=group;found.push({title,page,source:'contents',selected:false});
    }
    const arranged=found.map((entry,index)=>({entry,group:proposedGroups[index]})).sort((a,b)=>a.entry.page-b.entry.page);
    setChapterNames(Object.fromEntries(arranged.map((x,i)=>[i,x.group])));
    setSuggestionDoc(d.id);setSuggestions(arranged.map(x=>x.entry));setAiAudit(data.diagnostics);
    setSuggestionNotice('✨ Gemini által felismert, ellenőrizendő leckejavaslatok. PDF-oldaleltolás: '+offset+'. Az AI nem ment automatikusan semmit. Ellenőrizd a címeket és az oldalszámokat.');
    setUploadStatus(found.length+' Gemini-leckejavaslat. Ellenőrizd, majd külön hagyd jóvá.');
   }finally{await pdf.destroy()}
  }catch(e){setUploadStatus('AI-elemzési hiba: '+(e instanceof Error?e.message:'Ismeretlen hiba'))}
  finally{setBusy(false)}
 }
 async function matchExistingTopics(){
  if(!subject)throw Error('Válassz tantárgyat az egyeztetéshez.');
  const existing=(await api('topics?subjectId='+encodeURIComponent(subject))).topics as Topic[];
  const matches:Record<number,string>={};let matched=0;
  const leaves=existing.filter(t=>t.parent_id);
  const candidates=leaves.length?leaves:existing;
  suggestions.forEach((chapter,i)=>{
   const match=suggestedTopicMatch(chapter.title,candidates);
   if(match){matches[i]=match.id;matched++}
  });
  setSuggestionMatches(matches);setTopics(existing);
  setMessage(matched+' / '+suggestions.length+' leckejavaslathoz találtam egyértelmű egyezést a mentett tananyagfában. A maradékhoz kézzel is választhatsz leckét. Az AI nem mentett automatikusan semmit.');
 }
 async function acceptSuggestions(){
  if(!subject||!suggestionDoc)throw Error('Előbb válassz tantárgyat és tölts fel egy PDF-et.');
  const selected=suggestions.filter(x=>x.selected);
  if(aiAudit&&(aiAudit.missing.length>0||aiAudit.duplicated.length>0))throw Error('A Gemini hiányzó vagy ismétlődő leckeszámokat talált. Előbb ellenőrizd és javítsd a teljes listát.');
  if(!selected.length)throw Error('Jelölj ki legalább egy fejezetet.');
  if(selected.length>80)throw Error('Egyszerre legfeljebb 80 fejezet fogadható el.');
  const existing=(await api('topics?subjectId='+encodeURIComponent(subject))).topics as Topic[];
  const duplicateAssignments=new Set<string>();
  for(const [index,chapter] of suggestions.entries()){if(!chapter.selected)continue;const label=chapter.title.trim().toLocaleLowerCase('hu');const assigned=suggestionMatches[index]||label;if(duplicateAssignments.has(assigned))throw Error('Ugyanahhoz a témakörhöz több fejezet van kijelölve ebben a könyvben. Egyenként ellenőrizd a kapcsolásokat.');duplicateAssignments.add(assigned)}
  const saved=new Map(existing.map(t=>[t.name.trim().toLocaleLowerCase('hu')+'|'+(t.parent_id||''),t.id]));
  const parents=new Map<string,string>();
  for(const [index,chapter] of suggestions.entries()){
   if(!chapter.selected)continue;
   const group=(chapterNames[index]||'').trim().slice(0,120);
   if(!group)continue;
   const key=group.toLocaleLowerCase('hu');
   if(parents.has(key))continue;
   let id=existing.find(t=>!t.parent_id&&t.name.trim().toLocaleLowerCase('hu')===key)?.id;
   if(!id){const data=await api('topics',{method:'POST',body:JSON.stringify({subjectId:subject,name:group})});id=String(data.topic.id)}
   parents.set(key,id);
  }
  let count=0;
  for(const [index,chapter] of suggestions.entries()){
   if(!chapter.selected)continue;
   const label=chapter.title.trim().slice(0,120);if(!label)continue;
   const parentId=parents.get((chapterNames[index]||'').trim().toLocaleLowerCase('hu'))||null;
   const key=label.toLocaleLowerCase('hu')+'|'+(parentId||'');
   let id=suggestionMatches[index]||saved.get(key);
   if(id&&!existing.some(t=>t.id===id)&&!Array.from(saved.values()).includes(id))throw Error('Érvénytelen témakörhozzárendelés.');
   if(!id){const data=await api('topics',{method:'POST',body:JSON.stringify({subjectId:subject,name:label,parentId})});id=String(data.topic.id);saved.set(key,id)}
   await api('links',{method:'POST',body:JSON.stringify({topicId:id,documentId:suggestionDoc,category:'reference',page:chapter.page})});count++;
  }
  await getTopics(subject);setSuggestions([]);setSuggestionMatches({});setSuggestionDoc('');setMessage(count+' fejezet kapcsolva a könyvhöz. A PDF-ugrások készen állnak.');
 }

 async function addTool(){if(!topic)throw Error('Válassz témakört.');const label=prompt('Eszköz neve');if(!label?.trim())return;const url=prompt('HTTPS-hivatkozás');if(!url?.trim())return;await api('tools',{method:'POST',body:JSON.stringify({topicId:topic,label:label.trim(),url,provider:'egyéb'})});await getDocs(topic)}
 async function removeTool(id:string){if(!confirm('Eltávolítod a hivatkozást?'))return;await api('tools?id='+encodeURIComponent(id),{method:'DELETE'});await getDocs(topic)}
 async function unlinkDocument(d:Doc){if(!d.link_id)throw Error('Hiányzó kapcsolatazonosító');if(!confirm('Eltávolítod a dokumentumot ebből a témakörből? A központi fájl megmarad.'))return;await api('links?id='+encodeURIComponent(d.link_id),{method:'DELETE'});await getDocs(topic)}
 async function reuseDocument(){if(!topic||!existingId)throw Error('Válassz témakört és dokumentumot.');await api('links',{method:'POST',body:JSON.stringify({topicId:topic,documentId:existingId,category,page:startPage})});await getDocs(topic)}
 async function setLinkPage(d:Doc){if(!topic)throw Error('Előbb válassz témakört.');const answer=prompt('A(z) '+d.title+' melyik PDF-oldalon kezdődik ez a témakör?',String(d.pdf_page||1));if(answer===null)return;const page=Number(answer);if(!Number.isSafeInteger(page)||page<1)throw Error('Adj meg pozitív egész PDF-oldalszámot.');await api('links',{method:'POST',body:JSON.stringify({topicId:topic,documentId:d.id,category:d.category||'reference',page})});await getDocs(topic)}
 async function lookup(){if(search.trim().length<2){setSearchResults(null);return}setSearchResults(await api('search?q='+encodeURIComponent(search.trim())))}
 async function saveReading(d:Doc,page:number){await api('reading',{method:'PUT',body:JSON.stringify({documentId:d.id,page})});setReadingPage(page);const {url}=await api('download?id='+encodeURIComponent(d.id));setPreview(url+'#page='+page)}
 async function open(d:Doc){setActiveDocId(d.id);const {url}=await api('download?id='+encodeURIComponent(d.id));const pos=d.mime_type==='application/pdf'?await api('reading?documentId='+encodeURIComponent(d.id)):null;const start=d.pdf_page||pos?.position?.pdf_page||1;setReadingPage(start);setPreview(url+(d.mime_type==='application/pdf'?'#page='+start:''));setPreviewType(d.mime_type);setPreviewTitle(d.title)}
 const btn={padding:'10px 14px',borderRadius:10,border:'1px solid #deddf4',background:'#7855d9',color:'white',cursor:'pointer'};
 return <main style={{margin:'auto',padding:24,maxWidth:1400,color:'#26304f'}}><h1>Oktatási Segéd — Felhős könyvtár</h1><p><a href="/cloud/curriculum" style={{display:"inline-block",padding:"10px 14px",background:"#142338",color:"#60A5FA",borderRadius:10,fontWeight:700}}>📚 Matematika 9–12. · Központi tananyagfa →</a></p><p style={{color:'#6a7890'}}>Felhős fejlesztési felület. A bejelentkezés és a dokumentumkezelés éles tesztelése folyamatban.</p>
 <section style={{background:'white',padding:18,borderRadius:14,marginBottom:20}}>
 {!sessionChecked ? <p>Bejelentkezés ellenőrzése…</p> : !loggedIn ? <><h2>Belépés a saját könyvtárba</h2><p>E-mailes Neon Auth-fiókkal.</p>
 <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:12}}>
 <input aria-label="Név" value={name} onChange={e=>setName(e.target.value)} placeholder="Név (új fiókhoz)" style={{padding:12,flex:'1 1 180px'}}/>
 <input type="email" autoComplete="username" aria-label="E-mail" value={email} onChange={e=>setEmail(e.target.value)} placeholder="E-mail-cím" style={{padding:12,flex:'1 1 180px'}}/>
 <input type="password" autoComplete="current-password" aria-label="Jelszó" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Jelszó" style={{padding:12,flex:'1 1 180px'}}/></div>
 <button style={btn} onClick={()=>run(signIn)} disabled={busy}>Belépés</button> <button style={{...btn,background:'#10a8bd'}} onClick={()=>run(signUp)} disabled={busy}>Fiók létrehozása</button>
 </> : <div><span>✓ Bejelentkezve</span> <button style={btn} onClick={()=>run(getSubjects)} disabled={busy}>Frissítés</button> <button style={{...btn,background:'#6b758e'}} onClick={()=>run(signOut)}>Kijelentkezés</button></div>}
 </section>
 <section style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',marginBottom:14}}><input aria-label="Keresés az összes dokumentumban és témakörben" placeholder="Tankönyv vagy témakör keresése…" value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')run(lookup)}} style={{flex:'1 1 240px',padding:12,border:'1px solid #dde2ef',borderRadius:11}}/><button style={btn} onClick={()=>run(lookup)} disabled={busy}>Keresés</button>{searchResults&&<button onClick={()=>setSearchResults(null)}>Bezárás</button>}</section>{searchResults&&<section style={{padding:14,background:'white',borderRadius:14,marginBottom:14}}><h2>Keresési találatok</h2>{searchResults.documents.map(d=><button key={d.id} style={{...btn,margin:5,background:'#e9efff',color:'#28416d'}} onClick={()=>run(()=>open(d))}>📄 {d.title}</button>)}{searchResults.topics.map(t=><button key={t.id} style={{...btn,margin:5,background:'#e6faf8',color:'#16646a'}} onClick={()=>run(async()=>{await getTopics(t.subject_id);await getDocs(t.id)})}>📚 {t.subject_name} / {t.name}</button>)}{!searchResults.documents.length&&!searchResults.topics.length&&<p>Nincs találat.</p>}</section>}<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:14}}>
 <section style={{background:'white',padding:16,borderRadius:14}}><h2>Tantárgyak</h2><button style={btn} disabled={busy} onClick={()=>run(createSubject)}>＋ Tantárgy</button>{subjects.map(s=><p key={s.id}><button onClick={()=>run(()=>getTopics(s.id))} style={{...btn,background:subject===s.id?'#7855d9':'#eef0fb',color:subject===s.id?'white':'#20253c'}}>{s.name}</button></p>)}</section>
 <section style={{background:'white',padding:16,borderRadius:14}}><h2>Témakörök</h2><button style={btn} disabled={!subject||busy} onClick={()=>run(createTopic)}>＋ Témakör</button>{topics.filter(t=>!t.parent_id||!topics.some(p=>p.id===t.parent_id)).map(t=><div key={t.id} style={{marginTop:9}}><button onClick={()=>run(()=>getDocs(t.id))} style={{...btn,background:topic===t.id?'#7855d9':'#eef0fb',color:topic===t.id?'white':'#20253c',fontWeight:700}}>{t.name}</button>{topics.filter(child=>child.parent_id===t.id).map(child=><div key={child.id} style={{marginLeft:16,marginTop:6}}><button onClick={()=>run(()=>getDocs(child.id))} style={{...btn,background:topic===child.id?'#7855d9':'#f1f6ff',color:topic===child.id?'white':'#20253c',textAlign:'left',width:'100%'}}>↳ {child.name}</button></div>)}</div>)}</section>
 <section style={{background:'white',padding:16,borderRadius:14}}><h2>Dokumentumok</h2><button style={{...btn,background:'#168aab',marginBottom:9}} onClick={()=>void checkCloud()} disabled={busy}>Kapcsolatok ellenőrzése</button>{connectionStatus&&<p role="status" style={{color:connectionStatus.startsWith('Kapcsolati hiba')?'#a32f47':'#16646a',overflowWrap:'anywhere'}}>{connectionStatus}</p>}<p style={{fontSize:13,color:'#65738b'}}>A könyvet először töltsd fel, nem kell hozzá témakör. Utána ugyanaz a könyv több leckéhez is kapcsolható, eltérő kezdőoldalakkal.</p><div style={{display:'flex',gap:8,flexWrap:'wrap',margin:'12px 0'}}><select aria-label="Anyag típusa" value={category} onChange={e=>setCategory(e.target.value)} style={{padding:8,borderRadius:8,border:'1px solid #dde2ef'}}><option value="reference">Tankönyv</option><option value="exercise">Feladatgyűjtemény</option><option value="worksheet">Feladatlap</option><option value="solution">Megoldókulcs</option><option value="notes">Jegyzet</option><option value="table">Függvénytáblázat</option></select><label>PDF oldal <input type="number" min="1" value={startPage} onChange={e=>setStartPage(Math.max(1,Number(e.target.value)||1))} style={{width:70,padding:8,border:'1px solid #dde2ef',borderRadius:8}}/></label></div><div style={{marginTop:12,padding:12,background:"#f4f7ff",border:"1px solid #cbd6ef",borderRadius:12}}><label htmlFor="book-upload-input" style={{display:"block",fontWeight:700,marginBottom:8}}>📚 Könyv vagy dokumentum feltöltése</label><input id="book-upload-input" aria-label="Könyv kiválasztása a Fájlok alkalmazásból" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx,.pptx,application/pdf" disabled={busy} style={{display:"block",width:"100%",maxWidth:"100%",fontSize:16,color:"#26304f"}} onChange={e=>{const file=e.currentTarget.files?.[0];if(file)void importBook(file)}}/><p style={{fontSize:12,color:"#65738b",margin:"8px 0 0"}}>iPhone-on koppints a fájlválasztóra, majd válaszd a Fájlok / Tallózás lehetőséget. Feltöltéshez nem kell előbb témakört választani.</p>{selectedFilename&&<p style={{fontWeight:700,overflowWrap:'anywhere'}}>Kiválasztott fájl: {selectedFilename}</p>}{(uploadStatus||busy)&&<p role="status" aria-live="polite" style={{fontWeight:700,color:uploadStatus.startsWith('Hiba:')?'#ab253f':'#186b84'}}>{uploadStatus||'Feldolgozás…'}</p>}</div><div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:12}}><select aria-label="Korábban feltöltött dokumentum" value={existingId} onChange={e=>setExistingId(e.target.value)} style={{maxWidth:'100%',padding:9,border:'1px solid #dde2ef',borderRadius:8}}><option value="">Meglévő dokumentum hozzárendelése…</option>{allDocs.map(d=><option value={d.id} key={d.id}>{d.title}</option>)}</select><button style={{...btn,background:'#168aab'}} disabled={!existingId||!topic||busy} onClick={()=>run(reuseDocument)}>＋ Kapcsolás</button></div>{suggestionDoc&&<div style={{padding:12,background:'#eef8fc',border:'1px solid #b9e4ef',borderRadius:12,marginTop:14}}><h3>📑 Felismert tartalomjegyzék</h3><p style={{fontSize:13}}>{suggestionNotice}</p>{aiAudit&&<p style={{fontSize:13,fontWeight:700,color:aiAudit.missing.length||aiAudit.duplicated.length?'#b42318':'#176b41'}}>AI-leckeszám audit: {aiAudit.numberedCount} számozott lecke; {aiAudit.range?'tartomány: '+aiAudit.range[0]+'–'+aiAudit.range[1]:'nincs azonosítható tartomány'}; hiányzó: {aiAudit.missing.length?aiAudit.missing.join(', '):'nincs'}; ismétlődő: {aiAudit.duplicated.length?aiAudit.duplicated.join(', '):'nincs'}. {aiAudit.range&&aiAudit.range[0]!==39?'A teljes, 39–76 közötti tankönyvi sorozatot külön is ellenőrizd.':''}</p>}{suggestions.length>0&&<><p style={{fontSize:13}}>Ellenőrizd a címeket és az oldalszámokat. A nyomtatott oldalszám nem mindig egyezik a PDF-oldallal. Válassz tantárgyat a bal oldali listából.</p><button style={{...btn,background:'#168aab',marginBottom:9}} disabled={busy||!subject} onClick={()=>run(matchExistingTopics)}>Kapcsolódó leckék javaslása</button><div style={{maxHeight:320,overflowY:'auto'}}>{suggestions.map((item,index)=><div key={index} style={{display:'flex',gap:8,alignItems:'center',padding:'8px 0',flexWrap:'wrap',borderBottom:'1px solid #d6e7ef'}}><input type="checkbox" checked={item.selected} aria-label={item.title+' kijelölése'} onChange={e=>setSuggestions(v=>v.map((x,i)=>i===index?{...x,selected:e.target.checked}:x))}/>{aiAudit&&<input aria-label={'Főfejezet '+(index+1)} placeholder="Főfejezet (ellenőrizd)" style={{flex:'1 1 100%',order:1,padding:8,border:'1px solid #8eb7ca',borderRadius:7}} value={chapterNames[index]||''} onChange={e=>setChapterNames(v=>({...v,[index]:e.target.value}))}/>}<input aria-label={'Fejezet címe '+(index+1)} style={{minWidth:200,flex:'1 1 100%',order:2,padding:9,border:'1px solid #d6deea',borderRadius:7}} value={item.title} onChange={e=>setSuggestions(v=>v.map((x,i)=>i===index?{...x,title:e.target.value}:x))}/><input type="number" min="1" aria-label={item.title+' PDF kezdőoldal'} style={{width:85,padding:7,border:'1px solid #d6deea',borderRadius:7}} value={item.page} onChange={e=>setSuggestions(v=>v.map((x,i)=>i===index?{...x,page:Math.max(1,Number(e.target.value)||1)}:x))}/><select aria-label={item.title+' kapcsolódó témaköre'} style={{maxWidth:160,padding:6}} value={suggestionMatches[index]||''} onChange={e=>setSuggestionMatches(v=>({...v,[index]:e.target.value}))}><option value="">Új témakör (ellenőrizd)</option>{topics.filter(t=>t.parent_id).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></div>)}</div><button style={{...btn,marginTop:10}} disabled={busy||!subject} onClick={()=>run(acceptSuggestions)}>✓ Fejezetek jóváhagyása és kapcsolása</button></>}</div>}<h3 style={{fontSize:15,marginTop:16}}>Központi könyveim</h3>{allDocs.map(d=><p key={d.id} style={{display:'flex',gap:8,alignItems:'center'}}><button style={{...btn,background:'#f2edff',color:'#44316c',flex:1,textAlign:'left'}} onClick={()=>run(()=>open(d))}>📖 {d.title} ↗</button>{d.mime_type==='application/pdf'&&<><button style={{...btn,background:'#168aab'}} disabled={busy} onClick={()=>void reanalyzeDocument(d)}>📑 Tartalomjegyzék</button><button style={{...btn,background:'#7254ce'}} disabled={busy} onClick={()=>void aiAnalyzeDocument(d)}>✨ AI</button></>}</p>)}<h3 style={{fontSize:15}}>A kiválasztott témakör forrásai</h3>{docs.map(d=><p key={d.link_id||d.id} style={{display:'flex',gap:6,alignItems:'center'}}><button style={{...btn,background:'#edf5ff',color:'#21436a',flex:1,textAlign:'left',overflowWrap:'anywhere'}} onClick={()=>run(()=>open(d))}>📄 {d.title}{d.pdf_page?' · '+d.pdf_page+'. oldal':''}</button><button title="PDF kezdőoldal módosítása" aria-label="PDF-oldal beállítása" disabled={busy} onClick={()=>run(()=>setLinkPage(d))}>✎ Oldal</button><button title="Eltávolítás a témakörből" aria-label="Hivatkozás eltávolítása" disabled={busy} onClick={()=>run(()=>unlinkDocument(d))}>×</button></p>)}</section>
 </div><section style={{background:'white',padding:16,borderRadius:14,marginTop:16}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}><h2>📖 {previewTitle||'Dokumentumolvasó'}</h2>{preview&&<a href={preview} target="_blank" rel="noopener noreferrer">Teljes nézet ↗</a>}</div>{preview&&previewType==='application/pdf'&&<div style={{display:'flex',alignItems:'center',gap:9,marginTop:12}}><label>Olvasás folytatása a(z) <input type="number" min="1" max="100000" value={readingPage} onChange={e=>setReadingPage(Math.max(1,Number(e.target.value)||1))} style={{width:78,padding:8,borderRadius:9,border:'1px solid #d6ddeb'}}/>. oldaltól</label><button style={btn} disabled={busy} onClick={()=>{const d=[...docs,...allDocs].find(d=>d.id===activeDocId);if(d)run(()=>saveReading(d,readingPage))}}>Mentés és ugrás</button></div>}<div style={{height:'min(68vh,700px)',minHeight:350,background:'#f0f3f8',marginTop:10,display:'grid',placeItems:'center'}}>{preview?(previewType==='application/pdf'?<iframe title={previewTitle} src={preview} style={{width:'100%',height:'100%',border:0}}/>:previewType.startsWith('image/')?<img alt={previewTitle} src={preview} style={{maxHeight:'100%',maxWidth:'100%',objectFit:'contain'}}/>:<a href={preview} target="_blank" rel="noopener noreferrer">Eredeti Office-fájl megnyitása ↗</a>):<span>Válassz dokumentumot a megnyitáshoz.</span>}</div></section><section style={{background:'white',padding:16,borderRadius:14,marginTop:12}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><b>Digitális eszközök és függvénytáblázat</b><button style={btn} disabled={!topic||busy} onClick={()=>run(addTool)}>＋ Link</button></div><div style={{display:'flex',gap:9,flexWrap:'wrap',marginTop:12}}>{tools.map(t=><span key={t.id} style={{background:'#eeebff',padding:8,borderRadius:9}}><a target="_blank" rel="noopener noreferrer" href={t.url}>{t.label} ↗</a> <button onClick={()=>run(()=>removeTool(t.id))} aria-label="Törlés">×</button></span>)}{topic&&tools.length===0&&<small>Nincs még témaköri eszköz.</small>}</div></section><p role="status" style={{color:'#a32f47'}}>{message}</p><p style={{color:'#67728c'}}>Az Office-fájlok eredetiben tölthetők le, a böngészős előnézet még fejlesztés alatt.</p></main>
}