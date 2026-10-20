/**
 * A Gemini fizetős árai 1 millió tokenre, USD-ben (a Google hivatalos árlistája szerint,
 * ellenőrizve: 2026. október 20.). Csak becsléshez: az ingyenes kereten a tényleges költség 0.
 */
export const PRICES_CHECKED='2026. október 20.';
export const USD_HUF=325; // kb. árfolyam 2026. október 20-án
const TABLE:[RegExp,number,number][]=[
 [/^gemini-2\.5-flash-lite/,0.10,0.40],
 [/^gemini-2\.5-flash/,0.30,2.50],
 [/^gemini-3\.1-flash-lite/,0.25,1.50],
 [/^gemini-3\.5-flash-lite/,0.30,2.50],
 [/^gemini-3\.[68]-flash/,0.75,3.75]
];
/** Becsült költség USD-ben, vagy null, ha a modell ára nem ismert. */
export function estimateUsd(model:string,input:number,output:number):number|null{
 const row=TABLE.find(([re])=>re.test(model));
 if(!row)return null;
 return (input*row[1]+output*row[2])/1_000_000;
}
