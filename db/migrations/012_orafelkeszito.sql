-- Órafelkészítő (0.5.0): a megtartott órák és a hozzájuk tartozó felkészülési lap.
-- Új táblát hoz létre, és az AI-számláló megengedett funkcióit bővíti. Meglévő adatot nem módosít.
-- Többször is lefuttatható.

CREATE TABLE IF NOT EXISTS os_lessons (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id text NOT NULL,
 taught_on date NOT NULL,
 class_name text NOT NULL CHECK (char_length(class_name) BETWEEN 1 AND 40),
 grade smallint CHECK (grade IS NULL OR grade BETWEEN 1 AND 13),
 subject_id uuid REFERENCES os_subjects(id) ON DELETE SET NULL,
 topic_id uuid REFERENCES os_topics(id) ON DELETE SET NULL,
 -- A téma neve a mentés pillanatában: akkor is megmarad, ha a témát később törlöd vagy átnevezed.
 topic_name text NOT NULL DEFAULT '' CHECK (char_length(topic_name)<=300),
 -- Felhasznált források: [{documentId, title, pages:[...]}]
 sources jsonb NOT NULL DEFAULT '[]'::jsonb,
 -- A jóváhagyott lap: részek, elemek (típus, szöveg, megoldás, forrás, AI-jelölés).
 content jsonb NOT NULL DEFAULT '{}'::jsonb,
 note text NOT NULL DEFAULT '' CHECK (char_length(note)<=2000),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS os_lessons_owner_date_idx ON os_lessons(owner_id,taught_on DESC,created_at DESC);
CREATE INDEX IF NOT EXISTS os_lessons_owner_topic_idx ON os_lessons(owner_id,topic_id,taught_on DESC);
CREATE INDEX IF NOT EXISTS os_lessons_owner_class_idx ON os_lessons(owner_id,class_name);

-- Az AI-számláló ismerje az órafelkészítést is ('prep').
ALTER TABLE os_ai_usage DROP CONSTRAINT IF EXISTS os_ai_usage_feature_check;
ALTER TABLE os_ai_usage ADD CONSTRAINT os_ai_usage_feature_check CHECK (feature IN ('contents','match','plan','help','prep','other'));
