-- Oktatási Segéd v1 schema. Apply only to its OWN Neon project.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS os_subjects(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id text NOT NULL,
 name text NOT NULL, position integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(owner_id,name)
);
CREATE TABLE IF NOT EXISTS os_topics(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id text NOT NULL,
 subject_id uuid NOT NULL REFERENCES os_subjects(id) ON DELETE CASCADE,
 parent_id uuid REFERENCES os_topics(id) ON DELETE SET NULL,
 name text NOT NULL, position integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS os_topics_subject_order_idx ON os_topics(owner_id,subject_id,position);
CREATE TABLE IF NOT EXISTS os_documents(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id text NOT NULL,
 title text NOT NULL, filename text, mime_type text, byte_size bigint,
 content_sha256 text, storage_key text, source_url text,
 state text NOT NULL DEFAULT 'pending'
 CHECK (state IN ('pending','ready','failed','archived')),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (storage_key IS NOT NULL OR source_url IS NOT NULL OR state = 'pending')
);
CREATE INDEX IF NOT EXISTS os_docs_owner_idx ON os_documents(owner_id,created_at DESC);
CREATE TABLE IF NOT EXISTS os_document_links(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id text NOT NULL,
 topic_id uuid NOT NULL REFERENCES os_topics(id) ON DELETE CASCADE,
 document_id uuid NOT NULL REFERENCES os_documents(id) ON DELETE CASCADE,
 category text NOT NULL DEFAULT 'reference', position integer NOT NULL DEFAULT 0,
 pdf_page integer CHECK(pdf_page>0), slide_number integer CHECK(slide_number>0),
 sheet_name text, description text,
 UNIQUE(topic_id,document_id,category)
);
CREATE INDEX IF NOT EXISTS os_document_links_topic_idx ON os_document_links(owner_id,topic_id,position);
CREATE TABLE IF NOT EXISTS os_tool_links(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id text NOT NULL,
 topic_id uuid NOT NULL REFERENCES os_topics(id) ON DELETE CASCADE,
 provider text NOT NULL, label text NOT NULL, url text NOT NULL,
 position integer NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS os_reading_positions(
 owner_id text NOT NULL,document_id uuid NOT NULL REFERENCES os_documents(id) ON DELETE CASCADE,
 pdf_page integer CHECK(pdf_page>0), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(owner_id,document_id)
);
-- Do not expose SQL client credentials to browser. Server routes must scope every
-- query by authenticated owner_id, validate topic/document ownership on inserts.
