-- Oktatási Segéd: szabadkézi Apple Pencil-vonások (kiemelő és toll) a PDF-oldalakon.
-- Csak hozzáad, semmit nem módosít vagy töröl. Előbb külön Neon-tesztágon futtasd,
-- csak utána a fő ágon. Az eredeti PDF-fájlokat nem érinti.
CREATE TABLE IF NOT EXISTS os_pdf_ink (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id text NOT NULL,
 document_id uuid NOT NULL REFERENCES os_documents(id) ON DELETE CASCADE,
 pdf_page integer NOT NULL CHECK(pdf_page BETWEEN 1 AND 100000),
 tool text NOT NULL CHECK(tool IN ('marker','pen')),
 color text NOT NULL CHECK(color ~ '^#[0-9A-F]{6}$'),
 width real NOT NULL CHECK(width > 0 AND width <= 0.05),
 -- Az oldal szélességéhez és magasságához viszonyított [x,y] pontok (0–1 között).
 points jsonb NOT NULL CHECK(jsonb_typeof(points)='array'),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS os_pdf_ink_owner_doc_idx ON os_pdf_ink(owner_id,document_id,pdf_page);
-- A tulajdonjogot minden API-lekérdezés az owner_id és az os_documents.owner_id alapján ellenőrzi.
