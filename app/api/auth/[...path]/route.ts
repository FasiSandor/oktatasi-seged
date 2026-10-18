import {createHash} from 'node:crypto';
import {createNeonAuth} from '@neondatabase/auth/next/server';

export const runtime='nodejs';

/**
 * A bejelentkezés a saját címünkön keresztül megy a Neon Auth felé.
 * Így a munkamenet-süti a saját domainünkön van, és a Safari
 * (főleg inkognitóban) nem dobja el újratöltéskor.
 */
function cookieSecret():string{
 const own=process.env.NEON_AUTH_COOKIE_SECRET;
 if(own&&own.length>=32)return own;
 // Ha nincs külön beállítva, a meglévő titkos adatbázis-kapcsolatból képzünk
 // egy állandó, kívülről nem kitalálható kulcsot.
 const base=process.env.DATABASE_URL;
 if(!base)throw new Error('NEON_AUTH_COOKIE_SECRET vagy DATABASE_URL szükséges');
 return createHash('sha256').update('oktatasi-seged:auth-cookie:'+base).digest('hex');
}

type Handler=ReturnType<ReturnType<typeof createNeonAuth>['handler']>;
let cached:Handler|null=null;
function handler():Handler{
 if(!cached){
  const baseUrl=process.env.NEON_AUTH_URL;
  if(!baseUrl)throw new Error('NEON_AUTH_URL hiányzik');
  cached=createNeonAuth({baseUrl,cookies:{secret:cookieSecret()}}).handler();
 }
 return cached;
}

type Ctx={params:Promise<{path:string[]}>};
export async function GET(req:Request,ctx:Ctx){return handler().GET(req,ctx)}
export async function POST(req:Request,ctx:Ctx){return handler().POST(req,ctx)}
export async function PUT(req:Request,ctx:Ctx){return handler().PUT(req,ctx)}
export async function DELETE(req:Request,ctx:Ctx){return handler().DELETE(req,ctx)}
export async function PATCH(req:Request,ctx:Ctx){return handler().PATCH(req,ctx)}
