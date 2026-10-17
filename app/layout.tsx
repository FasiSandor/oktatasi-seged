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

 .academy-curriculum{padding-right:385px!important}
 .academy-playlist{position:fixed;right:16px;top:16px;bottom:16px;width:350px;background:white;border:1px solid #e0e8f4;border-radius:20px;box-shadow:0 10px 40px #24436b14;display:flex;flex-direction:column;overflow:hidden;z-index:20}
 .academy-playlist-head{padding:22px 18px 15px;display:flex;flex-direction:column;gap:5px;border-bottom:1px solid #e7edf6}.academy-playlist-head strong{font-size:20px}.academy-playlist-head small{color:#64748b}
 .academy-playlist-scroll{overflow-y:auto;padding:10px;overscroll-behavior:contain}
 .academy-playlist-item{width:100%;display:flex;align-items:center;gap:10px;padding:9px 7px;border:0;border-radius:12px;text-align:left;background:transparent;color:#1d2e48;cursor:pointer}
 .academy-playlist-item:hover{background:#eef5ff}.academy-playlist-item.is-selected{background:#dceaff;color:#0759e6}
 .academy-playlist-number{width:20px;text-align:center;color:#7890ae;font-size:12px}
 .academy-playlist-thumb{width:68px;height:48px;border-radius:9px;display:grid;place-items:center;flex-shrink:0;background:linear-gradient(135deg,#dcecff,#a7ceff);color:#125cff;font-size:25px}
 .academy-playlist-item:nth-child(3n+2) .academy-playlist-thumb{background:linear-gradient(135deg,#d5f9ec,#8ddac2);color:#0a9270}
 .academy-playlist-item:nth-child(3n+3) .academy-playlist-thumb{background:linear-gradient(135deg,#f2e7ff,#d5c1ff);color:#7651c2}
 .academy-playlist-copy{min-width:0;flex:1;display:flex;flex-direction:column;gap:5px}.academy-playlist-copy b{font-size:12px;line-height:1.4}.academy-playlist-copy small{font-size:11px;color:#71839c}.academy-playlist-dots{color:#8393ac}
 @media(max-width:1050px){.academy-curriculum{padding-right:20px!important}.academy-playlist{position:relative;right:auto;top:auto;bottom:auto;width:100%;margin-top:20px;max-height:460px}}

 .academy-lesson-viewer{background:#fff;border:1px solid #e0e8f4;border-radius:20px;overflow:hidden;box-shadow:0 8px 30px #24436b12;margin:0 0 22px}
 .academy-lesson-stage{width:100%;aspect-ratio:16/9;background:linear-gradient(130deg,#10234c,#0a4cbb 55%,#0097d4);overflow:hidden}
 .academy-lesson-frame{display:block;width:100%;height:100%;border:0;background:white}
 .academy-lesson-placeholder{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:30px;text-align:center;color:white}
 .academy-lesson-placeholder-icon{font-size:clamp(34px,6vw,70px);line-height:1;color:#d2e7ff}
 .academy-lesson-eyebrow{letter-spacing:.16em;font-size:11px;font-weight:750;color:#9edfff}
 .academy-lesson-placeholder h2{font-size:clamp(19px,2.6vw,30px);line-height:1.2;max-width:650px;margin:0}
 .academy-lesson-placeholder p{color:#d1e5ff;max-width:540px;font-size:14px;line-height:1.5;margin:0}
 .academy-lesson-primary{background:#fff;color:#0753d2;border:0;border-radius:25px;padding:12px 18px;font-weight:750;cursor:pointer;max-width:90%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
 .academy-lesson-meta{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:19px 20px 8px}.academy-lesson-meta h2{font-size:clamp(18px,2vw,24px);margin:0 0 5px}.academy-lesson-meta p{font-size:13px;color:#64748b;margin:0}.academy-lesson-meta button{border:1px solid #d8e3f2;background:#f2f7ff;border-radius:10px;padding:9px;cursor:pointer}
 .academy-lesson-tabs{display:flex;gap:8px;flex-wrap:wrap;padding:13px 20px 11px}.academy-lesson-tabs button{border:0;border-radius:24px;background:#edf3fb;color:#526a8a;padding:11px 18px;font-weight:700;cursor:pointer}.academy-lesson-tabs button.active{background:#125cff;color:white;box-shadow:0 6px 17px #125cff30}
 .academy-lesson-tab-content{margin:0 20px 20px;background:#f5f8fe;border:1px solid #e5ecf7;border-radius:14px;padding:17px 19px;line-height:1.6;color:#465c7b;min-height:100px}.academy-lesson-tab-content h3{margin:0 0 7px;font-size:17px;color:#192e4d}.academy-lesson-tab-content p{margin:7px 0}.academy-lesson-tab-content a{color:#125cff;font-weight:700}
 .academy-lesson-source{display:flex;align-items:center;gap:8px;width:100%;padding:11px;margin:7px 0;background:white;color:#1c4f94;border:1px solid #d8e7ff;border-radius:10px;text-align:left;cursor:pointer}.academy-lesson-source span{flex:1}
 @media(max-width:680px){.academy-lesson-placeholder{padding:14px;gap:7px}.academy-lesson-placeholder p{font-size:11px}.academy-lesson-primary{font-size:11px;padding:8px 12px}.academy-lesson-meta{padding:12px}.academy-lesson-tabs{padding:10px 12px}.academy-lesson-tabs button{padding:9px 12px;font-size:12px}.academy-lesson-tab-content{margin:0 12px 12px;padding:12px}}
 .academy-lesson-notepad{display:block;width:100%;min-height:155px;resize:vertical;padding:15px;border:1px solid #d2e0f4;border-radius:12px;background:white;color:#1b3050;font:inherit;line-height:1.6;outline-offset:2px}.academy-lesson-notepad:focus{border-color:#125cff;box-shadow:0 0 0 3px #125cff19}.academy-lesson-local-note{font-size:12px;color:#64748b!important}
 .academy-lesson-question{margin:8px 0;background:white;border:1px solid #dbe6f5;border-radius:12px;padding:13px}.academy-lesson-question summary{cursor:pointer;color:#1d3b66;font-weight:700}.academy-lesson-question p{margin:12px 0;white-space:pre-wrap}.academy-lesson-question button{background:#fff3f3;border:1px solid #f5caca;color:#a32c2c;border-radius:8px;padding:7px 10px;cursor:pointer}.academy-question-compose{display:grid;gap:10px;margin-top:14px}.academy-question-compose input,.academy-question-compose textarea{width:100%;padding:12px;border:1px solid #d1def1;border-radius:10px;background:white;color:#20314e;font:inherit}.academy-question-compose button{justify-self:start;border:0;background:#125cff;color:white;border-radius:10px;padding:11px 16px;font-weight:700;cursor:pointer}.academy-question-compose button:disabled{opacity:.5;cursor:not-allowed}
 .academy-cloud-controls{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:10px 20px 0;padding:11px 13px;background:#eff7ff;border:1px solid #d8eaff;border-radius:12px}.academy-cloud-controls span{font-size:12px;color:#456184;flex:1;min-width:180px}.academy-cloud-controls button{background:#125cff;color:#fff;border:0;border-radius:10px;padding:10px 14px;font-weight:700;cursor:pointer}.academy-cloud-controls button:disabled{opacity:.5;cursor:not-allowed}
 @media(prefers-reduced-motion:reduce){*,*:before,*:after{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
 `}</style>
 </body></html>}