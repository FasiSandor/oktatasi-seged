import {NextRequest} from 'next/server';
import {database,ownerFromRequest,apiError,schemaMissing} from '../../../../lib/server';
import {estimateUsd} from '../../../../lib/ai-arak';
export const runtime='nodejs';

/** AI-használat havonta (az app saját számlálása), funkciónként és modellenként, becsült költséggel. */
export async function GET(req:NextRequest){
 try{
  const owner=await ownerFromRequest(req),sql=database();
  try{
   const rows=await sql`
    SELECT to_char(date_trunc('month',created_at AT TIME ZONE 'Europe/Budapest'),'YYYY-MM') AS month,feature,model,
     count(*)::int AS calls,count(*) FILTER (WHERE NOT ok)::int AS failed,
     COALESCE(sum(input_tokens),0)::bigint AS input,COALESCE(sum(output_tokens),0)::bigint AS output
    FROM os_ai_usage WHERE owner_id=${owner} AND created_at>now()-interval '13 months'
    GROUP BY 1,2,3 ORDER BY 1 DESC`;
   const months=new Map<string,{month:string;calls:number;failed:number;input:number;output:number;usd:number;unknownPrice:boolean;features:Record<string,number>}>();
   for(const r of rows){
    const m=months.get(String(r.month))||{month:String(r.month),calls:0,failed:0,input:0,output:0,usd:0,unknownPrice:false,features:{}};
    const input=Number(r.input),output=Number(r.output);
    m.calls+=r.calls;m.failed+=r.failed;m.input+=input;m.output+=output;
    m.features[String(r.feature)]=(m.features[String(r.feature)]||0)+r.calls;
    const usd=estimateUsd(String(r.model),input,output);
    if(usd===null)m.unknownPrice=true;else m.usd+=usd;
    months.set(m.month,m);
   }
   return Response.json({months:[...months.values()],model:process.env.GEMINI_MODEL||'gemini-2.5-flash',schemaReady:true});
  }catch(e){
   if(!schemaMissing(e))throw e;
   return Response.json({months:[],model:process.env.GEMINI_MODEL||'gemini-2.5-flash',schemaReady:false});
  }
 }catch(e){return apiError(e)}
}
