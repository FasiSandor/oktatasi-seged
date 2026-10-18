import { neon } from '@neondatabase/serverless';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { S3Client } from '@aws-sdk/client-s3';
import { NextRequest } from 'next/server';
import { neonAuth } from './neon-auth-server';

export function database(){
 const url=process.env.DATABASE_URL;
 if(!url) throw new Error('DATABASE_URL is missing');
 return neon(url);
}
/**
 * A kérést küldő felhasználó azonosítója.
 * 1. Ha van érvényes Neon Auth JWT (Bearer), azt fogadjuk el (a korábbi működés).
 * 2. Különben a saját domainen tárolt, aláírt bejelentkezési sütit ellenőrizzük
 *    (a /api/auth közvetítő állítja be). Ez kell a Safarihoz.
 */
export async function ownerFromRequest(req:NextRequest):Promise<string>{
 const auth=req.headers.get('authorization');
 if(auth?.startsWith('Bearer ')){
  try{return await ownerFromJwt(auth.slice(7))}catch{/* jöhet a süti */}
 }
 return ownerFromCookie(req);
}

async function ownerFromJwt(token:string):Promise<string>{
 const endpoint=process.env.NEON_AUTH_URL;
 if(!endpoint) throw new Error('UNAUTHORIZED');
 const base=endpoint.replace(/\/$/,'');
 const jwks=createRemoteJWKSet(new URL(base+'/.well-known/jwks.json'));
 const {payload}=await jwtVerify(token,jwks,{issuer:new URL(base).origin,algorithms:['EdDSA','RS256','ES256'],audience:process.env.NEON_AUTH_AUDIENCE||undefined});
 if(!payload.sub)throw new Error('UNAUTHORIZED');
 return payload.sub;
}

async function ownerFromCookie(req:NextRequest):Promise<string>{
 const cookie=req.headers.get('cookie')||'';
 // Bejelentkezési süti nélkül nem is kérdezzük a Neont.
 if(!/neon-auth/i.test(cookie))throw new Error('UNAUTHORIZED');
 // Más oldalról indított, adatot módosító kérést nem fogadunk el sütivel.
 if(req.method!=='GET'){
  const origin=req.headers.get('origin');
  if(origin&&origin!==req.nextUrl.origin)throw new Error('UNAUTHORIZED');
 }
 try{
  const {data}=await neonAuth().getSession();
  const id=data?.user?.id;
  if(typeof id==='string'&&id)return id;
 }catch{/* hibás vagy lejárt munkamenet */}
 throw new Error('UNAUTHORIZED');
}
export function s3(){
 const endpoint=process.env.S3_ENDPOINT,accessKeyId=process.env.S3_ACCESS_KEY_ID,secretAccessKey=process.env.S3_SECRET_ACCESS_KEY;
 if(!endpoint||!accessKeyId||!secretAccessKey)throw new Error('Storage not configured');
 return new S3Client({region:process.env.S3_REGION||'eu-central-1',endpoint,forcePathStyle:true,requestChecksumCalculation:'WHEN_REQUIRED',credentials:{accessKeyId,secretAccessKey}});
}
export function bucket(){const name=process.env.S3_BUCKET;if(!name)throw new Error('S3_BUCKET is missing');return name}
export function apiError(e:unknown){
 const message=e instanceof Error?e.message:'';
 if(message==='UNAUTHORIZED')return Response.json({error:'Unauthorized'},{status:401});
 if(message==='FORBIDDEN')return Response.json({error:'Forbidden'},{status:403});
 if(message==='INVALID')return Response.json({error:'Invalid request'},{status:400});
 console.error('Cloud API failure',message);
 return Response.json({error:'Internal server error'},{status:500});
}
