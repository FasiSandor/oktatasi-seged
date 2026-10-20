-- Mentett feladatok (AI-segítség az olvasóból) és az AI-számláló új funkciója.
-- Új táblát hoz létre, és a számláló megengedett funkcióit bővíti. Meglévő adatot nem módosít.
-- Többször is lefuttatható.

CREATE TABLE IF NOT EXISTS os_tasks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id text NOT NULL,
 topic_id uuid REFERENCES os_topics(id) ON DELETE SET NULL,
 document_id uuid REFERENCES os_documents(id) ON DELETE SET NULL,
 pdf_page integer CHECK (pdf_page IS NULL OR pdf_page BETWEEN 1 AND 100000),
 image_key text,
 mode text NOT NULL CHECK (mode IN ('hint','steps','similar')),
 answer text NOT NULL CHECK (char_length(answer) BETWEEN 1 AND 20000),
 note text NOT NULL DEFAULT '' CHECK (char_length(note)<=2000),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS os_tasks_owner_topic_idx ON os_tasks(owner_id,topic_id,created_at DESC);

-- Az AI-számláló ismerje a feladatsegítséget is.
ALTER TABLE os_ai_usage DROP CONSTRAINT IF EXISTS os_ai_usage_feature_check;
ALTER TABLE os_ai_usage ADD CONSTRAINT os_ai_usage_feature_check CHECK (feature IN ('contents','match','plan','help','other'));
