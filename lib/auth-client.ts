'use client';
import { createAuthClient } from '@neondatabase/auth';

const make=(url:string)=>createAuthClient(url);
type Client=ReturnType<typeof make>;
let cachedClient:Client|null=null;

/**
 * A kliens a saját címünk /api/auth útvonalát használja (lásd app/api/auth),
 * nem közvetlenül a Neon Auth címét. Így a bejelentkezés süti a saját
 * domainen marad, és a Safari nem felejti el oldalfrissítéskor.
 */
export function authClient():Client{
  if(typeof window==='undefined')throw new Error('A bejelentkezés csak böngészőben érhető el.');
  if(!cachedClient)cachedClient=make(window.location.origin+'/api/auth');
  return cachedClient;
}

export async function authenticatedJWT():Promise<string> {
  const client = authClient();
  const result = await client.token();
  const token = result.data?.token;
  if (!token || typeof token !== 'string') throw new Error('Jelentkezz be ismét.');
  return token;
}
