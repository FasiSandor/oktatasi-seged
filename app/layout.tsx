import type {ReactNode} from 'react';
import type {Metadata,Viewport} from 'next';

export const metadata:Metadata={
 title:'Oktatási Segéd',
 description:'Saját tanári könyvtár: témakörök, könyvek, kiemelések egy helyen.',
 appleWebApp:{capable:true,title:'Oktatási Segéd',statusBarStyle:'default'}
};
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#EEF0F3'};

export default function RootLayout({children}:{children:ReactNode}){
 return <html lang="hu">
  <head>
   <link rel="preconnect" href="https://fonts.googleapis.com"/>
   <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin=""/>
   <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"/>
  </head>
  <body style={{margin:0}}>{children}</body>
 </html>;
}
