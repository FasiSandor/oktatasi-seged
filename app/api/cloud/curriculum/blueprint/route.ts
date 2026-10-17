import {NextRequest} from 'next/server';
import {ownerFromRequest,apiError} from '../../../../../lib/server';
import {mathematicsTechnikumBlueprint} from '../../../../../lib/curriculum-blueprint';
export const runtime='nodejs';
export async function GET(req:NextRequest){
 try{await ownerFromRequest(req);return Response.json({blueprint:mathematicsTechnikumBlueprint})}
 catch(e){return apiError(e)}
}
