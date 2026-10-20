/** A könyvek besorolásához közös címkék és egyszerű javaslatok a címből. */
export const KIND_LABEL:Record<string,string>={reference:'Tankönyv',exercise:'Feladatgyűjtemény',worksheet:'Feladatlap',solution:'Megoldókulcs',notes:'Jegyzet',table:'Függvénytáblázat'};
export const KINDS=Object.entries(KIND_LABEL) as [string,string][];
export const LEVEL_LABEL:Record<string,string>={kozep:'Középszint',emelt:'Emelt szint'};
export const GRADE_CHOICES=[9,10,11,12,13];

/** Évfolyam a címből, ha egyértelmű (pl. „OH-MAT09TA”, „Matematika 10.”, „11. évfolyam”). */
export function guessGrade(title:string):number|null{
 const t=title.replace(/_/g,' ');
 const patterns=[/\b(9|1[0-3])\s*\.?\s*(?:évf|évfolyam|osztály|o\.)/i,/MAT\s*0?(9|1[0-3])(?!\d)/i,/(?:^|[\s(])(9|1[0-3])\.(?:\s|$|\))/,/(?:^|\s)(9|1[0-3])(?:\s|$)/];
 for(const p of patterns){const m=t.match(p);if(m)return Number(m[1])}
 return null;
}
export function guessLevel(title:string):'emelt'|null{return /emelt/i.test(title)?'emelt':null}
