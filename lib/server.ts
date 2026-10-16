import { neon } from '@neondatabase/serverless';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { S3Client } from '@aws-sdk/client-s3';
import { NextRequest } from 'next/server';

export function database(){
 const url=process.env.DATABASE_URL;
 if(!url) throw new Error('DATABASE_URL is missing');
 return neon(url);
}
export async function ownerFromRequest(req:NextRequest):Promise<string>{
 const auth=req.headers.get('authorization');
 if(!auth?.startsWith('Bearer ')) throw new Error('UNAUTHORIZED');
 const endpoint=process.env.NEON_AUTH_URL;
 if(!endpoint) throw new Error('NEON_AUTH_URL is missing');
 const base=endpoint.replace(/\/$/,'');
 const jwks=createRemoteJWKSet(new URL(base+'/.well-known/jwks.json'));
 const {payload}=await jwtVerify(auth.slice(7),jwks,{issuer:base,algorithms:['EdDSA','RS256','ES256'],audience:process.env.NEON_AUTH_AUDIENCE||undefined});
 if(!payload.sub)throw new Error('UNAUTHORIZED');
 return payload.sub;
}
export function s3(){
 const endpoint=process.env.S3_ENDPOINT,accessKeyId=process.env.S3_ACCESS_KEY_ID,secretAccessKey=process.env.S3_SECRET_ACCESS_KEY;
 if(!endpoint||!accessKeyId||!secretAccessKey)throw new Error('Storage not configured');
 return new S3Client({region:process.env.S3_REGION||'eu-central-1',endpoint,forcePathStyle:true,credentials:{accessKeyId,secretAccessKey}});
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
