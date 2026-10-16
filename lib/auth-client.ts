'use client';
import { createAuthClient } from '@neondatabase/auth';

const url = process.env.NEXT_PUBLIC_NEON_AUTH_URL;
if (!url) {
  // Throw only at runtime when an auth operation is requested.
}
export function authClient() {
  if (!url) throw new Error('Neon Auth nincs beállítva.');
  return createAuthClient(url);
}
export async function authenticatedJWT():Promise<string> {
  const client = authClient();
  const token = await client.getJWTToken?.();
  if (!token || typeof token !== 'string') throw new Error('Jelentkezz be ismét.');
  return token;
}
