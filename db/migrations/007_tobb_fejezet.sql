-- Egy altémához ugyanabból a könyvből több fejezet is tartozhat,
-- mindegyik a saját kezdőoldalával és címével.
-- Többször is lefuttatható, a meglévő adatot nem törli.

ALTER TABLE os_document_links ADD COLUMN IF NOT EXISTS chapter_title text;

-- A régi szabály: altémánként és könyvenként csak egy oldal.
ALTER TABLE os_document_links DROP CONSTRAINT IF EXISTS os_document_links_topic_id_document_id_category_key;

-- Az új szabály: ugyanaz az oldal ne szerepeljen kétszer ugyanannál az altémánál.
CREATE UNIQUE INDEX IF NOT EXISTS os_document_links_page_uq
 ON os_document_links(topic_id,document_id,category,(COALESCE(pdf_page,0)));
