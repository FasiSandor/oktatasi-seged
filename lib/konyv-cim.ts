/**
 * A könyv olvasható címe.
 * A régi feltöltőnél a cím a fájlnév lett (pl. „OH-MAT09TA_II__teljes.pdf”).
 * Ilyenkor levágjuk a kiterjesztést, és az aláhúzásokat szóközre cseréljük.
 * A rendesen megadott címhez nem nyúlunk.
 */
export function konyvCim(title?:string|null,filename?:string|null):string{
 const raw=(title||filename||'').trim();
 if(!raw)return 'Névtelen könyv';
 const looksLikeFile=/\.(pdf|docx?|xlsx?|pptx?|png|jpe?g|webp)$/i.test(raw)||(!!filename&&raw===filename);
 if(!looksLikeFile)return raw;
 const clean=raw.replace(/\.[a-z0-9]{2,5}$/i,'').replace(/_+/g,' ').replace(/\s+/g,' ').trim();
 return clean||raw;
}
