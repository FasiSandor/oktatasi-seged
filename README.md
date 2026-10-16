# Oktatási Segéd

Tanári dokumentumkönyvtár – első, helyi fejlesztési prototípus.

## Megnyitás
Nyisd meg az `index.html` fájlt böngészőben. Ebben a fázisban nincs szerver, adatbázis vagy bejelentkezés.

## Prototípus-funkciók
- Tantárgyak és témakörök böngészése.
- Témakörök átrendezése.
- Új témakör hozzáadása.
- PDF- és képfájlok kiválasztása, alapvető megnyitása.
- Matematikai eszközök hivatkozásai.
- Világos, mobileszközre is tervezett felület.

## Korlátok
A böngésző helyi tárolója nem megbízható dokumentumarchívum. Nem kész a Neon-integráció, a központi fájltár, a többeszközös szinkron és az Office-előnézet. A prototípust éles oktatási tartalom egyetlen tárolóhelyeként ne használd.

## Tervezett infrastruktúra
GitHub + Vercel (mérföldkőnkénti deploy), Neon PostgreSQL és külön objektumtár.

## Deploy
Automatikus Vercel telepítés még nincs beállítva. A következő funkciókat egyetlen ellenőrzött csomagként kell elkészíteni és tesztelni az első deploy előtt.
