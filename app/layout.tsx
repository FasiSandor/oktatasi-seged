import type { ReactNode } from 'react';
import Link from 'next/link';
const links=[['⌂','Főoldal','/'],['◇','Tananyagfa','/cloud/curriculum'],['▣','Könyvtár','/cloud'],['▶','Videótár','/cloud/videos'],['▤','Órai anyagok','/cloud/curriculum']];
export default function RootLayout({children}:{children:ReactNode}){return <html lang="hu"><body className="academy-body">
 <aside className="academy-rail" aria-label="Oktatási Segéd navigáció"><Link href="/" className="academy-logo" title="Oktatási Segéd">◫</Link><nav>{links.map(([icon,label,url])=><Link key={label} href={url} title={label} className="academy-nav-link"><span className="academy-nav-icon">{icon}</span><span>{label}</span></Link>)}</nav><div className="academy-rail-bottom"><Link href="/cloud" title="Könyvtár és beállítások"><span className="academy-nav-icon">⚙</span><span>Beállítások</span></Link></div></aside>
 <div className="academy-content">{children}</div>
 <style>{`
 :root{--academy-blue:#125cff;--academy-text:#18253e;--academy-muted:#64748b;--academy-border:#e2e9f4;--academy-shadow:0 8px 32px #253c6810}
 *{box-sizing:border-box}
 html{scroll-behavior:smooth}
 body.academy-body{margin:0;background:#f6f9ff;color:var(--academy-text);font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
 .academy-rail{position:fixed;z-index:110;top:0;left:0;bottom:0;width:94px;background:linear-gradient(180deg,#fafdff,#eef4ff);border-right:1px solid #e0e8f5;display:flex;flex-direction:column;align-items:center;padding:16px 6px;box-shadow:5px 0 25px #26467a08}
 .academy-logo{display:grid;place-items:center;width:61px;height:61px;background:linear-gradient(135deg,#0665ff,#0041da);color:white;text-decoration:none;font-size:36px;font-weight:800;border-radius:17px;box-shadow:0 8px 22px #125cff3b;margin-bottom:22px}
 .academy-rail nav{width:100%;display:flex;flex-direction:column;gap:8px}
 .academy-nav-link,.academy-rail-bottom a{display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 3px;border-radius:13px;text-decoration:none;color:#526787;font-size:11px;font-weight:600;text-align:center;transition:background .22s ease,transform .22s ease,color .22s ease}
 .academy-nav-link:hover,.academy-rail-bottom a:hover{background:#e0ecff;color:#0959dd;transform:translateY(-2px)}
 .academy-nav-icon{font-size:26px;line-height:1.2;color:#273d65}
 .academy-nav-link:hover .academy-nav-icon{color:#125cff}
 .academy-rail-bottom{margin-top:auto}
 .academy-content{margin-left:94px;min-height:100dvh}
 .academy-content :is(button,a,input,select,textarea){font-family:inherit}
 .academy-content button{transition:background-color .2s ease,box-shadow .2s ease,transform .2s ease}
 .academy-content button:hover:not(:disabled){filter:brightness(1.035)}
 .academy-content button:active:not(:disabled){transform:scale(.985)}
 .academy-content :focus-visible{outline:3px solid #60a5fa;outline-offset:2px}
 @media(max-width:680px){.academy-rail{width:65px;padding:10px 3px}.academy-logo{width:48px;height:48px;font-size:29px}.academy-nav-link,.academy-rail-bottom a{font-size:9px}.academy-nav-icon{font-size:22px}.academy-content{margin-left:65px}}
 @media(prefers-reduced-motion:reduce){*,*:before,*:after{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
 `}</style>
 </body></html>}