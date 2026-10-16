# Oktatási Segéd — fejlesztés alatt

A projekt tartalma jelenleg két felület:
- `index.html`: korai kísérleti prototípus a főágon, kizárólag bemutatásra.
- `library.html`: új, világos, reszponzív könyvtári munkafelület a `develop/library-foundation` fejlesztési ágon.

## Az új munkafelület
A felhasználó tantárgyat, majd témakört választ, feltölt egy PDF-et, képet vagy Office-dokumentumot, illetve HTTPS-linket kapcsol hozzá. A PDF és a kép a beépített olvasóban nyitható, a többi fájl eredetiben letölthető. PDF-hez kezdő oldalszám menthető. Témakör sorrendje módosítható. A témák és kapcsolatok böngészőben tárolódnak.

## Fontos korlát
Ez **helyi/offline fejlesztési prototípus**, nem felhőalkalmazás. A dokumentumokat a böngésző IndexedDB tárába menti: ugyanabban a böngészőprofilban oldalfrissítés után is elérhetők, de másik eszközön nem. A böngésző törlése, privát mód, tárhelykorlát vagy rendszerkarbantartás adatvesztéssel járhat. A jegyzék exportálása **csak metaadatot** ment, nem a feltöltött PDF-eket és fotókat. Tananyagot kizárólagos példányként itt tartani tilos.

## További nagy funkciócsomag
Neon adatmodell és biztonságos hitelesítés, objektumtároló nagy fájlokhoz, témánként többszörös dokumentumkapcsolat, kereshető kinyert szöveg, könyvbeli fejezet-anchorok, függvénytáblázat-hivatkozások, megoldókulcs jogosultság és többeszközös szinkron. A feltöltött tankönyvek szerzői jogi feltételeit tiszteletben kell tartani.

## Telepítési stratégia
Github -> ellenőrzés deploy nélkül -> legfeljebb egy ellenőrzött Preview -> összevont production. A főág és a működő más webappok nem módosulnak a fejlesztési ág munkája során.
