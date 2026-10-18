import {neonAuth} from '../../../../lib/neon-auth-server';

export const runtime='nodejs';

/**
 * A bejelentkezés a saját címünkön keresztül megy a Neon Auth felé.
 * Így a munkamenet-süti a saját domainünkön van, és a Safari
 * (főleg inkognitóban) nem dobja el újratöltéskor.
 */
type Ctx={params:Promise<{path:string[]}>};
export async function GET(req:Request,ctx:Ctx){return neonAuth().handler().GET(req,ctx)}
export async function POST(req:Request,ctx:Ctx){return neonAuth().handler().POST(req,ctx)}
export async function PUT(req:Request,ctx:Ctx){return neonAuth().handler().PUT(req,ctx)}
export async function DELETE(req:Request,ctx:Ctx){return neonAuth().handler().DELETE(req,ctx)}
export async function PATCH(req:Request,ctx:Ctx){return neonAuth().handler().PATCH(req,ctx)}
