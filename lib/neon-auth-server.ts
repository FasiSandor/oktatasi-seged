import {createHash} from 'node:crypto';
import {createNeonAuth} from '@neondatabase/auth/next/server';

/**
 * A sütik aláíró kulcsa: NEON_AUTH_COOKIE_SECRET, ha meg van adva,
 * különben a titkos DATABASE_URL-ből képzett állandó, kívülről nem
 * kitalálható kulcs (így nem kell új Vercel-beállítás).
 */
function cookieSecret():string{
 const own=process.env.NEON_AUTH_COOKIE_SECRET;
 if(own&&own.length>=32)return own;
 const base=process.env.DATABASE_URL;
 if(!base)throw new Error('NEON_AUTH_COOKIE_SECRET vagy DATABASE_URL szükséges');
 return createHash('sha256').update('oktatasi-seged:auth-cookie:'+base).digest('hex');
}

type NeonAuth=ReturnType<typeof createNeonAuth>;
let cached:NeonAuth|null=null;

/** A Neon Auth szerveroldali példánya (közvetítő és munkamenet-ellenőrzés). */
export function neonAuth():NeonAuth{
 if(!cached){
  const baseUrl=process.env.NEON_AUTH_URL;
  if(!baseUrl)throw new Error('NEON_AUTH_URL hiányzik');
  cached=createNeonAuth({baseUrl,cookies:{secret:cookieSecret()}});
 }
 return cached;
}
