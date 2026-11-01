-- Érettségi feladatbank: külön Neon-projekt (Erettsegi-Feladatbank).
-- Az Oktatási Segéd írja (feltöltés, besorolás, javítás), a TéFEL_APP később csak olvas.

CREATE TABLE IF NOT EXISTS fb_vizsgak (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 szint text NOT NULL CHECK (szint IN ('kozep','emelt')),
 datum date NOT NULL,
 ev int NOT NULL,
 honap int NOT NULL CHECK (honap BETWEEN 1 AND 12),
 vizsgakod text,
 kovetelmeny text CHECK (kovetelmeny IN ('2005','2017','2024')),
 -- hianyos: valamelyik PDF hiányzik; bontva: feladatokra bontva; besorolva: minden feladatnak van témaköre
 allapot text NOT NULL DEFAULT 'hianyos' CHECK (allapot IN ('hianyos','bontva','besorolva')),
 bontas_hibak jsonb NOT NULL DEFAULT '[]',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (szint, datum)
);

CREATE TABLE IF NOT EXISTS fb_fajlok (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 vizsga_id uuid REFERENCES fb_vizsgak(id) ON DELETE SET NULL,
 tipus text NOT NULL CHECK (tipus IN ('fl','ut')),
 fajlnev text NOT NULL,
 byte_size bigint NOT NULL,
 sha256 text NOT NULL,
 storage_key text NOT NULL,
 oldalszam int,
 szoveg jsonb NOT NULL DEFAULT '[]',   -- oldalanként a sorok (a szerkezet kiolvasásához)
 felismert jsonb NOT NULL DEFAULT '{}',
 allapot text NOT NULL DEFAULT 'feltoltes' CHECK (allapot IN ('feltoltes','kesz','csere')),
 feltoltotte text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS fb_fajlok_sha ON fb_fajlok(sha256) WHERE allapot='kesz';
CREATE UNIQUE INDEX IF NOT EXISTS fb_fajlok_vizsga_tipus ON fb_fajlok(vizsga_id,tipus) WHERE allapot='kesz';

CREATE TABLE IF NOT EXISTS fb_feladatok (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 vizsga_id uuid NOT NULL REFERENCES fb_vizsgak(id) ON DELETE CASCADE,
 sorszam int NOT NULL,
 reszfeladat text NOT NULL DEFAULT '',          -- '' ha nincs részfeladat
 resz text NOT NULL CHECK (resz IN ('I','II','II.A','II.B')),
 sorrend int NOT NULL DEFAULT 0,
 fl_oldal int,                                  -- PDF-oldal a feladatlapon
 ut_oldal int,                                  -- PDF-oldal az útmutatóban
 pont int,
 bontas_megjegyzes text[] NOT NULL DEFAULT '{}',
 -- besorolás (a kódok a témakörlistából: fb_temak)
 fo_kod text,
 mellek_kod text,
 szoveges boolean NOT NULL DEFAULT false,
 megjegyzes text,
 biztos boolean,
 ai_fo_kod text,                                -- az AI eredeti javaslata (méréshez)
 ai_futott boolean NOT NULL DEFAULT false,
 jovahagyva boolean NOT NULL DEFAULT false,
 kezzel boolean NOT NULL DEFAULT false,
 ellenorizendo boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (vizsga_id, sorszam, reszfeladat)
);
CREATE INDEX IF NOT EXISTS fb_feladatok_kod ON fb_feladatok(fo_kod);
CREATE INDEX IF NOT EXISTS fb_feladatok_ellenorizendo ON fb_feladatok(ellenorizendo) WHERE ellenorizendo;

-- AI-hívások naplója: idő, tokenek, beállítás (a gondolkodás be/ki méréséhez).
CREATE TABLE IF NOT EXISTS fb_besorolasok (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 vizsga_id uuid REFERENCES fb_vizsgak(id) ON DELETE CASCADE,
 resz text NOT NULL,
 modell text NOT NULL,
 gondolkodas boolean NOT NULL,
 mp numeric(6,1),
 bemenet int, kimenet int, gondolat int,
 ok boolean NOT NULL,
 hiba text,
 created_at timestamptz NOT NULL DEFAULT now()
);

-- A témakörlista (a követelmény számozása); a TéFEL_APP innen olvassa.
CREATE TABLE IF NOT EXISTS fb_temak (
 kod text PRIMARY KEY,
 nev text NOT NULL,
 temakor int NOT NULL,
 emelt boolean NOT NULL DEFAULT false,
 sorrend int NOT NULL
);
