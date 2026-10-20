import {database,schemaMissing} from './server';

/** A Gemini válaszában visszaküldött tokenszámok (ebben a mértékegységben számláz a Google). */
type Usage={promptTokenCount?:number;candidatesTokenCount?:number;thoughtsTokenCount?:number};

/**
 * Egy AI-hívás rögzítése a számlálóhoz. Soha nem dob hibát: ha a 009-es
 * adatbázis-frissítés még nincs lefuttatva, vagy a mentés nem sikerül, a hívás attól még működik.
 */
export async function recordAiUsage(owner:string,feature:'contents'|'match'|'plan'|'help'|'other',model:string,usage:Usage|undefined,ok=true){
 try{
  const input=Math.max(0,Math.round(usage?.promptTokenCount||0));
  // A „gondolkodás” tokenjeit is kimenetként számlázza a Google.
  const output=Math.max(0,Math.round((usage?.candidatesTokenCount||0)+(usage?.thoughtsTokenCount||0)));
  await database()`INSERT INTO os_ai_usage(owner_id,feature,model,input_tokens,output_tokens,ok) VALUES(${owner},${feature},${model.slice(0,80)},${input},${output},${ok})`;
 }catch(e){if(!schemaMissing(e))console.error('AI usage log failed')}
}
