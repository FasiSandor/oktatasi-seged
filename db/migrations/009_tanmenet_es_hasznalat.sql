-- AI-használat számlálása és tanmenetek (órák listája, témához kötve).
-- Csak új táblákat hoz létre. Meglévő adatot nem módosít és nem töröl.
-- Többször is lefuttatható.

-- Minden AI-hívás egy sor: mire ment, melyik modell, hány token (a Google ebben számláz).
CREATE TABLE IF NOT EXISTS os_ai_usage (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id text NOT NULL,
 feature text NOT NULL CHECK (feature IN ('contents','match','plan','other')),
 model text NOT NULL,
 input_tokens integer NOT NULL DEFAULT 0 CHECK (input_tokens>=0),
 output_tokens integer NOT NULL DEFAULT 0 CHECK (output_tokens>=0),
 ok boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS os_ai_usage_owner_time_idx ON os_ai_usage(owner_id,created_at DESC);

-- Egy tanmenet: tantárgy, évfolyam, tanév; az eredeti Excel a Dokumentumok között marad.
CREATE TABLE IF NOT EXISTS os_plans (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id text NOT NULL,
 subject_id uuid NOT NULL REFERENCES os_subjects(id) ON DELETE CASCADE,
 name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 160),
 grade smallint CHECK (grade IS NULL OR grade BETWEEN 1 AND 13),
 school_year text,
 document_id uuid REFERENCES os_documents(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS os_plans_owner_subject_idx ON os_plans(owner_id,subject_id);

-- A tanmenet órái, sorrendben. A témához kötés üres is lehet (később párosítható).
CREATE TABLE IF NOT EXISTS os_plan_lessons (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id text NOT NULL,
 plan_id uuid NOT NULL REFERENCES os_plans(id) ON DELETE CASCADE,
 position integer NOT NULL,
 month text,
 week integer,
 lesson_no integer,
 content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
 topic_id uuid REFERENCES os_topics(id) ON DELETE SET NULL,
 UNIQUE(plan_id,position)
);
CREATE INDEX IF NOT EXISTS os_plan_lessons_plan_idx ON os_plan_lessons(owner_id,plan_id,position);
