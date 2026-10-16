// Cloud API negative-access smoke test; runs against the built app without database credentials.
// Confirms anonymous callers cannot browse teaching materials or get signed object URLs.
const host=process.env.SMOKE_BASE_URL||'http://127.0.0.1:3000';
const cases=[
 ['GET','/api/cloud/subjects'],
 ['GET','/api/cloud/topics?subjectId=00000000-0000-4000-8000-000000000000'],
 ['GET','/api/cloud/documents'],
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
