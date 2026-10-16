# Oktatási Segéd – ellenőrzött felhős alapok

A külön Neon projekt: `cool-bonus-87476537`, régió: `aws-eu-central-1`, branch: `br-sparkling-cherry-b9yacgyo`.

## Valóban létrehozott erőforrások
- PostgreSQL adattáblák: os_subjects, os_topics, os_documents, os_document_links, os_tool_links, os_reading_positions.
- Neon Auth: Better Auth alapú, bekapcsolva a Neon projekt main branch-én.
- Neon Storage: privát `oktatasi-seged-private` bucket, valóban létrehozva és kilistázva.
- A tároló branchable S3-végpontja: `https://br-sparkling-cherry-b9yacgyo.storage.c-7.eu-central-1.aws.neon.tech`.
- Neon Auth URL (nem titok): `https://ep-nameless-wave-b9mxquac.neonauth.c-7.eu-central-1.aws.neon.tech/neondb/auth`.

## Kötelező biztonsági feltételek
- S3/Neon titkok kizárólag szerveren. Nem kerülnek Githubra vagy `NEXT_PUBLIC_*` változóba.
- A jogosult felhasználó azonosítóját szerveroldalon ellenőrzött Neon Auth munkamenetből kell venni, nem böngészőből beküldött owner_id-ből.
- A bucket PRIVÁT marad. Fájlokhoz hitelesített, rövid ideig érvényes aláírt URL-ek használhatók.
- A szerver a fájlméretet, MIME-típust, fájltulajdonost és szerkesztési jogosultságot ellenőrizze.
- A jelenlegi statikus `library.html` továbbra is *helyi prototípus*. A Neon erőforrások megléte nem jelent élő szinkronizációt.
- A fájlokból a böngésző által tárolt példányok nem kerültek át automatikusan a privát tárhelyre.

## Következő integrációs egység
1. A Next.js App Router alkalmazásszerver és a szerveroldali auth-munkamenet ellenőrzése.
2. A Neon SQL szerveroldali kapcsolat és S3-aláírás kizárólag backendben.
3. Migrációval megfelelő tulajdonosi integritás biztosítása, eltérő felhasználók közti tiltás tesztelése.
4. Valós fel- és letöltés, újranyitás, hibakezelés.
5. Szinkronizáció tesztelése két eszközön, majd egyetlen jóváhagyott Vercel-preview.

A deploy-kímélő fejlesztési ágat nem szabad automatikusan az éles domainre kötni.
