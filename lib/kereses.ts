/**
 * Elírás- és ékezettűrő keresés. Szerveren és kliensen is futhat, adatbázis-bővítmény nem kell hozzá.
 *
 * Példák, amelyek mind megtalálják a „Pitagorasz-tétel” fejezetet:
 * „pitagorasz”, „Pitagórasz”, „pithagorasz tetel”, „pitagor”, „pitagoraszt”.
 */

/** Kisbetű, ékezet nélkül, csak betű és szám, szóközzel elválasztva. */
export function normalizal(s:string):string{
 return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'')
  .replace(/[^a-z0-9]+/g,' ').trim();
}

/** Szerkesztési távolság (betűcsere, kihagyás, beszúrás, két szomszédos betű felcserélése). Korlát felett leáll. */
function tavolsag(a:string,b:string,max:number):number{
 if(Math.abs(a.length-b.length)>max)return max+1;
 let prev2:number[]=[],prev=Array.from({length:b.length+1},(_,j)=>j);
 for(let i=1;i<=a.length;i++){
  const cur=[i];let rowMin=i;
  for(let j=1;j<=b.length;j++){
   let v=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
   if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])v=Math.min(v,prev2[j-2]+1);
   cur.push(v);if(v<rowMin)rowMin=v;
  }
  if(rowMin>max)return max+1;
  prev2=prev;prev=cur;
 }
 return prev[b.length];
}

/** Hány elírás fér bele egy szóba a hossza alapján. */
function turesKeret(len:number){return len<=3?0:len<=5?1:2}

/** Egy keresőszó mennyire illik egy szövegszóhoz: 1 = pontos vagy eleje, 0,7 = elírással, 0 = nem. */
function szoIlles(token:string,word:string):number{
 if(word.startsWith(token))return 1;
 if(token.length>=5&&token.startsWith(word)&&word.length>=token.length-2)return 0.9; // pl. „pitagoraszt” → „pitagorasz”
 const keret=turesKeret(token.length);
 if(!keret)return 0;
 const d=Math.min(tavolsag(token,word,keret),word.length>token.length?tavolsag(token,word.slice(0,token.length),keret):keret+1);
 return d<=keret?0.7-0.1*(d-1):0;
}

export type Elokeszitett={norm:string;szavak:string[]};
export function elokeszit(s:string):Elokeszitett{const norm=normalizal(s);return {norm,szavak:norm?norm.split(' '):[]}}

/**
 * Pontszám 0 és 100 között. 0 = nincs találat.
 * Minden keresőszónak meg kell lennie (pontosan vagy elírással), a teljes kifejezés egyben többet ér.
 */
export function pontoz(kerdes:Elokeszitett,szoveg:Elokeszitett):number{
 if(!kerdes.szavak.length||!szoveg.szavak.length)return 0;
 const idx=szoveg.norm.indexOf(kerdes.norm);
 if(idx>=0){
  const szoElejen=idx===0||szoveg.norm[idx-1]===' ';
  const egesz=szoveg.norm===kerdes.norm;
  return egesz?100:szoElejen?(idx===0?95:90):75;
 }
 let osszeg=0;
 for(const t of kerdes.szavak){
  let legjobb=0;
  for(const w of szoveg.szavak){const v=szoIlles(t,w);if(v>legjobb){legjobb=v;if(v===1)break}}
  if(!legjobb)return 0;
  osszeg+=legjobb;
 }
 return Math.round(65*osszeg/kerdes.szavak.length);
}

/** Rövid részlet egy hosszú szövegből a találat körül, a megjelenítéshez. */
export function reszlet(szoveg:string,kerdes:Elokeszitett,hossz=110):string{
 const tiszta=szoveg.replace(/\*\*/g,'').replace(/\s+/g,' ').trim();
 if(tiszta.length<=hossz)return tiszta;
 const norm=tiszta.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
 let pos=-1;
 for(const t of kerdes.szavak){pos=norm.indexOf(t.slice(0,Math.max(3,t.length-2)));if(pos>=0)break}
 if(pos<0)return tiszta.slice(0,hossz-1)+'…';
 const start=Math.max(0,pos-30);
 return (start>0?'…':'')+tiszta.slice(start,start+hossz).trim()+(start+hossz<tiszta.length?'…':'');
}
