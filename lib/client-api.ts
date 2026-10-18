'use client';
import {authClient,authenticatedJWT} from './auth-client';

/** Hiba, amely a felhasználónak megmutatható magyar üzenetet hordoz. */
export class ApiError extends Error{
 status:number;
 constructor(message:string,status:number){super(message);this.status=status}
}

function withTimeout<T>(promise:PromiseLike<T>,ms:number):Promise<T>{
 return Promise.race([
  Promise.resolve(promise),
  new Promise<T>((_,reject)=>setTimeout(()=>reject(new ApiError('A kapcsolat nem válaszol. Próbáld újra.',0)),ms))
 ]);
}

/** Hitelesített hívás a saját /api/cloud végpontokra. */
export async function api<T=unknown>(path:string,options:RequestInit={},timeoutMs=20000):Promise<T>{
 // A JWT a gyorsabb út; ha nem kapjuk meg, a saját domainen lévő
 // bejelentkezési süti is elég (a szerver azt is elfogadja).
 let token='';
 try{token=await withTimeout(authenticatedJWT(),12000)}catch{}
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeoutMs);
 let response:Response;
 try{
  response=await fetch('/api/cloud/'+path,{
   ...options,
   credentials:'same-origin',
   headers:{...(token?{Authorization:'Bearer '+token}:{}),...(options.body?{'Content-Type':'application/json'}:{})},
   signal:controller.signal
  });
 }catch{
  throw new ApiError('Nem sikerült elérni a szervert.',0);
 }finally{clearTimeout(timer)}
 let data:unknown=null;
 try{data=await response.json()}catch{}
 if(!response.ok){
  const message=data&&typeof data==='object'&&'error' in data&&typeof (data as {error:unknown}).error==='string'?(data as {error:string}).error:'Sikertelen kérés';
  throw new ApiError(response.status===401?'Jelentkezz be ismét.':message,response.status);
 }
 return data as T;
}

export async function hasSession():Promise<boolean>{
 try{
  const result=await withTimeout(authClient().getSession(),12000);
  return !!result.data?.session;
 }catch{return false}
}

export async function signIn(email:string,password:string){
 const result=await withTimeout(authClient().signIn.email({email,password}),15000);
 if(result.error)throw new ApiError(result.error.message||'Hibás e-mail-cím vagy jelszó.',401);
}

export async function signOut(){await authClient().signOut()}

/** Böngészőtár, amely privát módban vagy tiltott tárolásnál sem dob hibát. */
export const localPrefs={
 get<T>(key:string,fallback:T):T{
  try{const raw=window.localStorage.getItem(key);return raw?JSON.parse(raw) as T:fallback}catch{return fallback}
 },
 set(key:string,value:unknown){
  try{window.localStorage.setItem(key,JSON.stringify(value))}catch{}
 }
};
