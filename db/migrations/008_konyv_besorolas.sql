-- Könyvek besorolása és saját tartalomjegyzéke, alapdokumentumok (tanmenet, követelmény).
-- Csak új, üres oszlopokat ad hozzá. A meglévő adatot nem módosítja és nem törli.
-- Többször is lefuttatható.

-- Melyik tantárgyhoz tartozik a könyv (egy könyv egy tantárgy).
ALTER TABLE os_documents ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES os_subjects(id) ON DELETE SET NULL;

-- Évfolyam (pl. 9) és szint: közép vagy emelt. Üresen hagyható.
ALTER TABLE os_documents ADD COLUMN IF NOT EXISTS grade smallint;
ALTER TABLE os_documents DROP CONSTRAINT IF EXISTS os_documents_grade_check;
ALTER TABLE os_documents ADD CONSTRAINT os_documents_grade_check CHECK (grade IS NULL OR grade BETWEEN 1 AND 13);

ALTER TABLE os_documents ADD COLUMN IF NOT EXISTS level text;
ALTER TABLE os_documents DROP CONSTRAINT IF EXISTS os_documents_level_check;
ALTER TABLE os_documents ADD CONSTRAINT os_documents_level_check CHECK (level IS NULL OR level IN ('kozep','emelt'));

-- A könyv típusa: tankönyv, feladatgyűjtemény, megoldókulcs stb.
ALTER TABLE os_documents ADD COLUMN IF NOT EXISTS kind text;
ALTER TABLE os_documents DROP CONSTRAINT IF EXISTS os_documents_kind_check;
ALTER TABLE os_documents ADD CONSTRAINT os_documents_kind_check CHECK (kind IS NULL OR kind IN ('reference','exercise','worksheet','solution','notes','table'));

-- Szerepe: könyv (alap), tanmenet, követelmény vagy egyéb alapdokumentum (Beállítások → Dokumentumok).
ALTER TABLE os_documents ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'book';
ALTER TABLE os_documents DROP CONSTRAINT IF EXISTS os_documents_role_check;
ALTER TABLE os_documents ADD CONSTRAINT os_documents_role_check CHECK (role IN ('book','plan','requirement','other'));

-- A könyv teljes tartalomjegyzéke: [{"title":"…","page":12,"group":"…"}], PDF-oldalszámmal.
ALTER TABLE os_documents ADD COLUMN IF NOT EXISTS contents jsonb;
ALTER TABLE os_documents DROP CONSTRAINT IF EXISTS os_documents_contents_check;
ALTER TABLE os_documents ADD CONSTRAINT os_documents_contents_check CHECK (contents IS NULL OR jsonb_typeof(contents)='array');

CREATE INDEX IF NOT EXISTS os_documents_subject_idx ON os_documents(owner_id,subject_id);
