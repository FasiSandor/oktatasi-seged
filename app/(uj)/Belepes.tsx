'use client';
import {useState} from 'react';
import {signIn} from '../../lib/client-api';
import {Icon} from './icons';

export default function Belepes({onDone}:{onDone:()=>void}){
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 async function submit(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError('');
  try{await signIn(email.trim(),password);setPassword('');onDone()}
  catch(err){setError(err instanceof Error?err.message:'A belépés nem sikerült.')}
  finally{setBusy(false)}
 }
 return <main className="us-login">
  <form onSubmit={submit}>
   <span className="us-logo"><Icon name="book" size={22} stroke="#fff" strokeWidth={1.8}/></span>
   <h1>Oktatási Segéd</h1>
   <p>Lépj be, és ott folytatod, ahol abbahagytad: a könyveid, kiemeléseid és jegyzeteid minden eszközödön ugyanazok.</p>
   <label className="us-field">E-mail-cím<input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required/></label>
   <label className="us-field">Jelszó<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>
   {error&&<p className="us-error" role="alert">{error}</p>}
   <button type="submit" className="us-btn us-btn-dark" disabled={busy} style={{minHeight:48}}>{busy?'Belépés…':'Belépés'}</button>
  </form>
 </main>;
}
