'use client';
import { createAuthClient } from '@neondatabase/auth';

const url = process.env.NEXT_PUBLIC_NEON_AUTH_URL;
if (!url) {
  // Throw only at runtime when an auth operation is requested.
}
let cachedClient: ReturnType<typeof createAuthClient> | null = null;
export function authClient() {
  if (!url) throw new Error('Neon Auth nincs beállítva.');
  if(!cachedClient)cachedClient=createAuthClient(url);
  return cachedClient;
}
export async function authenticatedJWT():Promise<string> {
  const client = authClient();
  const result = await client.token();
  const token = result.data?.token;
  if (!token || typeof token !== 'string') throw new Error('Jelentkezz be ismét.');
  return token;
}
