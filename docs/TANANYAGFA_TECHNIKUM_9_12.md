# Oktatási Segéd – Technikum 9–12. matematika: tananyagfa alap

## Jóváhagyott felhasználói döntések
- Tantárgyválasztással induló, saját digitális tanári könyvtár.
- Első profil: technikum, matematika, 9–12. évfolyam.
- A NAT az alap; a 2020-as NAT-hoz illeszkedő releváns kerettanterv, az intézményi helyi tanterv és a mindenkori érettségi vizsgakövetelmény külön ellenőrzendő forrás.
- A témákhoz tartozó évfolyamok és sorrend szerkeszthető; egy kanonikus lecke több évfolyamon is előfordulhat.
- Mozaik Sokszínű matematika: majdani elsődleges *tanítási forrás*, nem a követelményrendszer.
- Az AI által javasolt könyvoldal-hozzárendelést a tanár jóváhagyja.
- Privát PDF-kiemelések és saját jegyzetek, később több felhasználó lehetősége.
- Gyors helyettesítési kereső, több forrás, könyvjelzők, három nehézségi szint, offline kedvencek, óravázlat, összehasonlítás és nyomtatás fokozatosan.

## Forrás-hierarchia és pontosság
1. **NAT 2020**, a 5/2020. (I. 31.) Korm. rendelet szerinti 9–12. évfolyamos matematika-témakörök.
   https://njt.jog.gov.hu/jogszabaly/2020-5-20-22.0
2. **A technikumi közismereti matematika kerettanterv** (a szakképzésért felelős hivatal kiadásában), az iskola helyi tantervében alkalmazott változat ellenőrzésével.
   A korábban itt szereplő link a *gimnáziumi* kerettantervre mutatott, ezért eltávolítottam. A pontos technikumi forrás linkje ellenőrzésre vár.
3. **Helyi tanterv / tanmenet** az adott iskolához – felhasználói feltöltés után ellenőrzendő, nem feltételezzük.
4. **Az aktuális középszintű matematika érettségi részletes követelményei** – az adott vizsgaidőszakra külön ellenőrzendők.
5. **Tankönyvek, feladatgyűjtemények** – könyvönkénti oldalszám és feladattípus; a curriculumtól független forrásréteg.

A NAT spirális felépítésű: önmagából **nem következik egyetlen kötelező, leckénkénti 9/10/11/12. évfolyamos ütemezés**. Ezért az évfolyambontás javaslat, amíg kerettantervvel és helyi tantervvel nincs ellenőrizve.

## Első kanonikus téma-index (vázlat; nem kész, hivatalos leckejegyzék)
- Halmazok és matematikai logika
- Kombinatorika, gráfok
  - Leszámlálási alapelvek
  - Permutáció (ismétlés nélkül és ismétléssel)
  - Variáció (ismétlés nélkül és ismétléssel)
  - Kombináció (ismétlés nélkül és ismétléssel)
  - Gráfok, modellezési feladatok
- Számelmélet, számhalmazok
- Hatványozás, gyökvonás
- Algebrai kifejezések, nevezetes azonosságok
- Egyenletek, egyenlőtlenségek, egyenletrendszerek
- Függvények és grafikonok
- Sorozatok
- Geometria: síkgeometria, transzformációk, trigonometria, térgeometria
- Koordinátageometria
- Statisztika
- Valószínűségszámítás

A listát a forrásokból ellenőrizve bővítjük. Az egyes felsorolt matematikai témák szereplése nem jelent kész, pontos évfolyamos vagy érettségi besorolást.

## Adatmodell
- `os_topics`: kanonikus tananyagfa, évfolyamhoz nem kötve.
- `os_curriculum_profiles`: képzéstípus és évfolyamtartomány.
- `os_curriculum_sources`: dokumentálható NAT/kerettanterv/helyi tanterv/érettségi forrás.
- `os_curriculum_placements`: téma × évfolyam × mélység/sorrend, egy téma több évfolyamon.
- `os_topic_requirements`: visszakereshető követelmény és dokumentum.
- `os_document_links`: meglévő könyvoldal-link; megőrizzük.
- Tanári jóváhagyás előtt a gépi besorolás tervezet.

## Minimális első használati út
Tantárgy: Matematika → Technikum 9–12 → keresés: „kombináció” → témalap → meglévő PDF-könyvoldalak, feladatgyűjtemények és linkek. Feltöltés és könyv nélkül is látható a tananyagfa.

## Következő lépések
1. Tananyagprofil és tananyagfa szerver oldali CRUD, felhasználónként elkülönítve.
2. Hivatalos kerettanterv és helyi tanterv összevetése; tanári jóváhagyható évfolyam-/lecke-bontás.
3. Könyvtári források intelligens, ellenőrizhető hozzárendelése.
4. PDF-olvasó, kiemelés és gyors keresés.
5. Végleges prémium UI, amikor a használati folyamat stabil.
