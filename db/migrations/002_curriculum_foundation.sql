-- Oktatási Segéd: NAT-alapú, de szabadon alakítható tananyagfa.
-- Additive-only migration. Existing os_topics / os_document_links records remain unchanged.
CREATE TABLE IF NOT EXISTS os_curriculum_profiles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id text NOT NULL,
 subject_id uuid NOT NULL REFERENCES os_subjects(id) ON DELETE CASCADE,
 name text NOT NULL,
 education_type text NOT NULL DEFAULT 'technikum',
 grade_from integer NOT NULL DEFAULT 9 CHECK (grade_from BETWEEN 1 AND 13),
 grade_to integer NOT NULL DEFAULT 12 CHECK (grade_to BETWEEN 1 AND 13),
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','reviewed','active','archived')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(owner_id,subject_id,name),
 CHECK(grade_to>=grade_from)
);
CREATE INDEX IF NOT EXISTS os_profiles_owner_subject_idx ON os_curriculum_profiles(owner_id,subject_id);

CREATE TABLE IF NOT EXISTS os_curriculum_sources (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id text NOT NULL,
 profile_id uuid NOT NULL REFERENCES os_curriculum_profiles(id) ON DELETE CASCADE,
 source_type text NOT NULL CHECK(source_type IN ('nat','framework','local_plan','exam_requirements','teacher_plan','other')),
 title text NOT NULL, issuing_body text, reference_url text, document_id uuid REFERENCES os_documents(id) ON DELETE SET NULL,
 effective_date date, notes text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS os_curriculum_sources_profile_idx ON os_curriculum_sources(owner_id,profile_id);

-- One canonical topic may appear in several grades and curriculum profiles.
CREATE TABLE IF NOT EXISTS os_curriculum_placements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id text NOT NULL,
 profile_id uuid NOT NULL REFERENCES os_curriculum_profiles(id) ON DELETE CASCADE,
 topic_id uuid NOT NULL REFERENCES os_topics(id) ON DELETE CASCADE,
 grade integer NOT NULL CHECK(grade BETWEEN 1 AND 13),
 depth text NOT NULL DEFAULT 'core' CHECK(depth IN ('foundation','core','advanced','review')),
 position integer NOT NULL DEFAULT 0,
 suggested_minutes integer CHECK(suggested_minutes>0),
 required_for_exam boolean NOT NULL DEFAULT false,
 notes text, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(owner_id,profile_id,topic_id,grade,depth)
);
CREATE INDEX IF NOT EXISTS os_placements_profile_grade_idx ON os_curriculum_placements(owner_id,profile_id,grade,position);

-- Map the curriculum requirements to their canonical topic without copying the book text.
CREATE TABLE IF NOT EXISTS os_topic_requirements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id text NOT NULL,
 topic_id uuid NOT NULL REFERENCES os_topics(id) ON DELETE CASCADE,
 source_id uuid NOT NULL REFERENCES os_curriculum_sources(id) ON DELETE CASCADE,
 requirement_text text NOT NULL,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','verified')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS os_topic_requirements_owner_topic_idx ON os_topic_requirements(owner_id,topic_id);
