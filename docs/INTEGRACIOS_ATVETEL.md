# Integrációs elfogadás – Oktatási Segéd

## Már elkészült
- Neon Auth Better Auth környezet és privát Neon Storage bucket, saját Neon-projektben.
- Hitelesítést megkövetelő, tulajdonoshoz kötött SQL API-k.
- Tantárgy-, témakör-, dokumentum-, PDF-oldal- és eszközkapcsolatok.
- Azonos fájl több témakörben, a forrás törlése nélkül.
- Keresés, olvasási pozíció, böngészőben beágyazott PDF és kép.
- Nagy PDF-ek 8 MiB méretű S3 multipart részekre bontott felöltése; a szerver a kész fájl méretét ellenőrzi.

## Tényleges, még nem igazolt integrációs tesztek
1. Neon Auth regisztráció, e-mailes bejelentkezés és oldalfrissítés utáni munkamenet.
2. Egy kis PDF feltöltése, majd ugyanannak megnyitása.
3. A 166 MB méretű matematika-tankönyv feltöltése multipart módban.
4. Böngészős CORS beállítás: engedélyezni kell a választott Preview domainről a PUT kérést; nagy PDF-hez az `ETag` válaszfejléc láthatóságát is.
5. PDF 47. oldal megnyitása, olvasási pozíció mentése és másik eszközön visszaolvasása.
6. Második felhasználói fiókkal bizonyítani, hogy a könyvtár és az objektumok nem hozzáférhetők.
7. A szerveroldali Neon Auth JWT `issuer` / `audience` és az aláírási kulcs ellenőrzése valódi tokennel.
8. A tárhely objektumméret-, kvóta-, költség- és multipart-támogatásának mérése.
9. Fájlok törlése, félbeszakadt multipart feltöltések takarítása, hibás feltöltések helyreállítása.
10. A publikus domain biztonsági ellenőrzése: privát buckethez, jelszóhoz, kapcsolatkulcshoz nincs szabad hozzáférés.

## Ne feledd
- A TypeScript build nem helyettesíti a funkcionális integrációs tesztet.
- A GitHubon lévő könyvtárfejlesztés még nem használatra kész publikus app.
- A Vercel projekt még nem lett importálva. Előbb be kell állítani a kizárólag szerveroldali titkokat és az Auth trusted origint.
- Az 250 MB alkalmazásoldali határ nem bizonyítja, hogy a Neon Storage ténylegesen elfogad ekkora feltöltést.
- A 250 MB PDF-ek ne kerüljenek PostgreSQL adatmezőkbe vagy GitHubba.
