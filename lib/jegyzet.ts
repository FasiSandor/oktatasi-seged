/**
 * Word- és szöveges jegyzetek (nem PDF). Ezek a /jegyzet oldalon nyílnak meg,
 * a címsoraikból készült kattintható tartalomjegyzékkel.
 * A mentett tartalomjegyzékben a `page` itt a címsor sorszáma (1, 2, 3…), nem oldalszám.
 */
export const DOCX_MIME='application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const TXT_MIME='text/plain';
export const MD_MIME='text/markdown';
export const JEGYZET_MIMES=[DOCX_MIME,TXT_MIME,MD_MIME];

export function jegyzetE(mime:string|null|undefined):boolean{
 return !!mime&&JEGYZET_MIMES.includes(mime);
}

/** Hova vigyen egy könyv vagy jegyzet megnyitása (PDF: olvasó oldallal, jegyzet: címsorral). */
export function megnyitoCim(doc:string,mime:string|null|undefined,page?:number|null):string{
 if(jegyzetE(mime))return '/jegyzet?doc='+encodeURIComponent(doc)+(page?'&h='+page:'');
 return '/olvaso?doc='+encodeURIComponent(doc)+(page?'&page='+page:'');
}
