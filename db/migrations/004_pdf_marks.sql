-- Personal PDF region annotations, kept separately from original private PDFs.
CREATE TABLE IF NOT EXISTS os_pdf_marks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id text NOT NULL,
 document_id uuid NOT NULL REFERENCES os_documents(id) ON DELETE CASCADE,
 pdf_page integer NOT NULL CHECK(pdf_page BETWEEN 1 AND 100000),
 kind text NOT NULL CHECK(kind IN ('highlight','underline')),
 x double precision NOT NULL CHECK(x BETWEEN 0 AND 1),
 y double precision NOT NULL CHECK(y BETWEEN 0 AND 1),
 w double precision NOT NULL CHECK(w > 0 AND w <= 1),
 h double precision NOT NULL CHECK(h > 0 AND h <= 1),
 color text NOT NULL DEFAULT 'yellow' CHECK(color IN ('yellow','cyan','green')),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(x+w<=1.000001 AND y+h<=1.000001)
);
CREATE INDEX IF NOT EXISTS os_pdf_marks_owner_doc_idx ON os_pdf_marks(owner_id,document_id,pdf_page);
