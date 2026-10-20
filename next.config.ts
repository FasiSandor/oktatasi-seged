import type {NextConfig} from 'next';
import pkg from './package.json';

/**
 * A Beállítások → Alkalmazás adatai rész kiadási adatai. A Vercel a kitelepítéskor
 * adja meg a commitot és az ágat; helyi fordításnál ezek üresek maradnak.
 */
const config:NextConfig={
 env:{
  NEXT_PUBLIC_APP_VERSION:pkg.version,
  NEXT_PUBLIC_BUILD_TIME:new Date().toISOString(),
  NEXT_PUBLIC_BUILD_COMMIT:(process.env.VERCEL_GIT_COMMIT_SHA||'').slice(0,7),
  NEXT_PUBLIC_BUILD_BRANCH:process.env.VERCEL_GIT_COMMIT_REF||'',
  NEXT_PUBLIC_BUILD_ENV:process.env.VERCEL_ENV||'helyi'
 }
};
export default config;
