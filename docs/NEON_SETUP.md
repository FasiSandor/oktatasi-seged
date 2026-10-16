# Oktatási Segéd — Neon adatbázis

A projekthez külön Neon projekt készült, a többi alkalmazás adatbázisát nem módosítjuk.

- Projekt neve: Oktatasi-Seged
- Projektazonosító: cool-bonus-87476537
- Régió: aws-eu-central-1
- PostgreSQL: 18
- Telepített séma: `db/migrations/001_library.sql`
- Ellenőrzés: 6 darab `os_*` tábla létrejött.

## Biztonsági szabályok
Ne írj Neon kapcsolati karakterláncot, felhasználói jelszót vagy tárolókulcsot GitHubra, a frontendbe vagy publikus környezeti változóba. A kapcsolat csak szerveroldali kódban legyen használható.

A `owner_id` sosem érkezhet megbízhatóként a böngészőtől; az alkalmazásszerver a hitelesített munkamenetből állapítja meg. Az összes SELECT/INSERT/UPDATE/DELETE műveletet ezzel kell korlátozni, és az érintett szülőobjektum tulajdonjogát is ellenőrizni kell.

Az adatbázis csak metaadatoknak való. A könyvek, képek és Office fájlok privát objektumtárba kerülnek, ellenőrzött, rövid életű letöltési/feltöltési hivatkozásokkal. A fájlneveket és MIME-típusokat validálni kell, és az alkalmazás nem szolgálhat ki tetszőleges külső URL-t proxyként.

## Felhős funkció kapcsolásának blokkolói
1. Hitelesítés szolgáltatójának és bejelentkezési folyamatának kialakítása (például Neon Auth).
2. Külön, privát objektumtár és annak kulcsai szerveroldali környezeti változókban.
3. Biztonságos API végpontok az adatbázis műveletekhez.
4. Tényleges integrációs teszt több felhasználóval: A ne lássa B dokumentumát.
5. Csak ezután: felhős feltöltés és szinkron bekapcsolása.

A jelenlegi statikus fejlesztési `library.html` továbbra is lokális IndexedDB-t használ. A felhőadatbázis létrehozása NEM jelenti, hogy a frontend már hozzá kapcsolódik.
