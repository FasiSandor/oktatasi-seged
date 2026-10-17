-- Private, page-scoped teacher notes. PDF bytes remain untouched.
CREATE TABLE IF NOT EXISTS os_pdf_notes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id text NOT NULL,
 document_id uuid NOT NULL REFERENCES os_documents(id) ON DELETE CASCADE,
 pdf_page integer NOT NULL CHECK(pdf_page BETWEEN 1 AND 100000),
 body text NOT NULL CHECK(char_length(body) BETWEEN 1 AND 4000),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS os_pdf_notes_owner_doc_page_idx ON os_pdf_notes(owner_id,document_id,pdf_page);
