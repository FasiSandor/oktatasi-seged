// Cloud API negative-access smoke test; runs against the built app without database credentials.
// Confirms anonymous callers cannot browse teaching materials or get signed object URLs.
const host=process.env.SMOKE_BASE_URL||'http://127.0.0.1:3000';
const cases=[
 ['GET','/api/cloud/subjects'],
 ['GET','/api/cloud/curriculum?subjectId=00000000-0000-4000-8000-000000000000'],
 ['GET','/api/cloud/curriculum/blueprint'],
 ['GET','/api/cloud/curriculum/readiness'],
 ['GET','/api/cloud/curriculum/placements?profileId=00000000-0000-4000-8000-000000000000'],
 ['POST','/api/cloud/curriculum'],
 ['POST','/api/cloud/curriculum/import'],
 ['POST','/api/cloud/curriculum/placements'],
 ['DELETE','/api/cloud/curriculum/placements?id=00000000-0000-4000-8000-000000000000'],
 ['GET','/api/cloud/topics?subjectId=00000000-0000-4000-8000-000000000000'],
 ['GET','/api/cloud/documents'],
 ['GET','/api/cloud/pdf-notes?documentId=00000000-0000-4000-8000-000000000000'],
 ['POST','/api/cloud/pdf-notes'],
 ['DELETE','/api/cloud/pdf-notes?id=00000000-0000-4000-8000-000000000000'],
 ['GET','/api/cloud/search?q=book'],
 ['GET','/api/cloud/reading?documentId=00000000-0000-4000-8000-000000000000'],
 ['GET','/api/cloud/download?id=00000000-0000-4000-8000-000000000000'],
 ['GET','/api/cloud/tools?topicId=00000000-0000-4000-8000-000000000000'],
 ['POST','/api/cloud/subjects'],
 ['POST','/api/cloud/topics'],
 ['POST','/api/cloud/upload'],
 ['POST','/api/cloud/upload/complete'],
 ['POST','/api/cloud/multipart'],
 ['POST','/api/cloud/links'],
 ['POST','/api/cloud/tools'],
 ['PUT','/api/cloud/reading'],
 ['DELETE','/api/cloud/links?id=00000000-0000-4000-8000-000000000000']
];
let failed=false;
for(const [method,path] of cases){
 const response=await fetch(host+path,{method,headers:{'content-type':'application/json'},...(method==='GET'?{}:{body:'{}'})});
 const content=await response.text();
 if(response.status!==401||!content.includes('Unauthorized')){
   console.error('FAIL',method,path,response.status,content.slice(0,180));failed=true;
 } else console.log('OK',method,path,'401');
}
if(failed)process.exit(1);
console.log('Anonymous cloud API access is denied for all',cases.length,'cases.');
