# Oktatási Segéd

Saját tanári könyvtár iPadre, Macre és iPhone-ra. A lényege: a témakörre vagy altémára koppintva a feltöltött tankönyv a megfelelő helyen nyílik ki, és Apple Pencillel úgy lehet benne kiemelni, mintha a saját könyvedben húznád alá.

Technika: Next.js (App Router), React, TypeScript, Neon PostgreSQL és Neon Auth, S3-kompatibilis privát tárhely, Vercel.

## Képernyők

| Cím | Mire való |
|---|---|
| `/` | **Tananyag.** Tantárgy, évfolyam (9–12.), témakörök óraszámmal, altémák. A kiválasztott altémánál a hozzá rendelt könyvek „Kinyitom” gombbal, a témához tartozó linkek (Desmos, GeoGebra, WolframAlpha…) és egy saját jegyzet. |
| `/olvaso?doc=…&page=…&topic=…` | **Olvasó.** A könyv a megadott oldalon nyílik. Fülön lehet váltani a téma másik könyvére. Pencil-eszköztár: lapozás, kiemelő, toll, radír, színek, visszavonás. Oldalanként cetli. Az utolsó olvasott oldalt megjegyzi. |
| `/feltoltes` | **Feltöltés.** Könyv feltöltése címmel és típussal (vagy egy már feltöltött újrapárosítása). Ha a PDF-ben vannak könyvjelzők, azokból dolgozik; különben a kis előnézetekből te jelölöd meg a tartalomjegyzék oldalait (legfeljebb 4), ezeket olvassa ki a Gemini. A lapalji oldalszámot magától keresi; szkennelt könyvnél egyszer megkérdezi. A fejezeteket a tananyagfa altémáihoz javasolja, te hagyod jóvá, választasz mást, hozol létre új altémát vagy hagyod ki. |
| `/cloud` | Könyvtár (korábbi felület), változatlan működéssel. |
| `/cloud/curriculum` | A tananyagfa részletes szerkesztése (korábbi felület). |
| `/cloud/videos` | Videótár (korábbi felület). |

Az új felület a `app/(uj)`, a korábbi a `app/(regi)` mappában van. A mappanevek zárójele miatt ez az URL-eket nem változtatja meg.

## Adatok

- Az óraszám a meglévő `os_curriculum_placements.suggested_minutes` mezőben tárolódik (1 óra = 45 perc), évfolyamonként. Új adatbázismező nem kellett hozzá.
- A Pencil-vonások az új `os_pdf_ink` táblába kerülnek (`db/migrations/006_pdf_ink.sql`). Amíg ez a migráció nincs lefuttatva, a rajz látszik a képernyőn, de nem mentődik, és az app ezt ki is írja. Semmi más nem romlik el tőle.
- A régi, téglalapos kiemelések (`os_pdf_marks`) megmaradnak, és az új olvasó is megjeleníti őket.

## Migrációk sorrendje

1. `db/migrations/001` – `005`: a korábbi, már ismert lépések.
2. `migrations/20261017_lesson_workspaces.sql`: jegyzetek és kérdések témánként.
3. `db/migrations/006_pdf_ink.sql`: Pencil-vonások.

Mindegyik csak hozzáad. Előbb külön Neon-tesztágon kell lefuttatni, csak utána a fő ágon.

## Környezeti változók

Lásd `.env.example`. A titkos kulcsok (adatbázis, tárhely, `GEMINI_API_KEY`) csak a Vercel beállításaiban lehetnek, a böngészőbe soha nem kerülnek.

## Ellenőrzés

```
npm install --legacy-peer-deps
npm run check   # TypeScript
npm run build   # Next.js build
node scripts/smoke.mjs   # futó app mellett: bejelentkezés nélkül minden API 401-et ad
```
