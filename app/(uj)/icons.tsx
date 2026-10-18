import type {SVGProps} from 'react';

type Name='book'|'plus'|'search'|'upload'|'arrow'|'back'|'next'|'external'|'wave'|'shape'|'lines'|'note'|'marker'|'pen'|'eraser'|'undo'|'expand'|'close'|'trash'|'hand'|'user';
const paths:Record<Name,string>={
 book:'M12 6c-2-1.5-5-2-8-1.5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-13c-3-.5-6 0-8 1.5zM12 6v13',
 plus:'M12 5v14M5 12h14',
 search:'M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14zM20 20l-3.5-3.5',
 upload:'M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3',
 arrow:'M5 12h14M13 6l6 6-6 6',
 back:'M15 6l-6 6 6 6',
 next:'M9 6l6 6-6 6',
 external:'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
 wave:'M3 17c4 0 5-10 9-10s5 10 9 10',
 shape:'M12 3l8 6-3 10H7L4 9z',
 lines:'M4 7h16M4 12h10M4 17h7',
 note:'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h4',
 marker:'M14 4l6 6-8 8H6v-6z',
 pen:'M17 3l4 4L8 20l-5 1 1-5z',
 eraser:'M8 20h12M5 15l9-9 5 5-7 7H8z',
 undo:'M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',
 expand:'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
 close:'M6 6l12 12M18 6L6 18',
 trash:'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
 user:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5',
 hand:'M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10V4.5a1.5 1.5 0 0 1 3 0V11M14 10.5V6a1.5 1.5 0 0 1 3 0v7c0 4-2.5 7-6.5 7S5 17.5 4 15l-1.5-3.5a1.4 1.4 0 0 1 2.4-1.4L8 13'
};

export function Icon({name,size=20,...rest}:{name:Name;size?:number}&SVGProps<SVGSVGElement>){
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}><path d={paths[name]}/></svg>;
}

/** Könyvgerinc-színek: a könyv azonosítójából mindig ugyanaz jön ki. */
const spines=['#2F5D9E','#B9501C','#0E7C74','#7A3E9D','#8A6D0B','#A1324F'];
export function spineColor(id:string){
 let h=0;for(let i=0;i<id.length;i++)h=(h*31+id.charCodeAt(i))>>>0;
 return spines[h%spines.length];
}
