import type {MetadataRoute} from 'next';

/** Kezdőképernyős (PWA) adatok: név, ikonok, színek. */
export default function manifest():MetadataRoute.Manifest{
 return {
  name:'Oktatási Segéd',
  short_name:'Oktatási Segéd',
  description:'Saját tanári könyvtár: témakörök, könyvek, kiemelések egy helyen.',
  start_url:'/',
  scope:'/',
  display:'standalone',
  background_color:'#EEF0F3',
  theme_color:'#EEF0F3',
  lang:'hu',
  icons:[
   {src:'/icon-192.png',sizes:'192x192',type:'image/png',purpose:'any'},
   {src:'/icon-512.png',sizes:'512x512',type:'image/png',purpose:'any'},
   {src:'/icon-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'}
  ]
 };
}
