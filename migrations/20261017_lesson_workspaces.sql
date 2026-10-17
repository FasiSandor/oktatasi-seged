-- Oktatasi Seged: lesson notes and teacher questions per saved topic.
-- Apply to the existing Neon database only after verifying the target database and taking a rollback snapshot.
-- This migration is additive and does not modify existing curriculum, documents or users.
CREATE TABLE IF NOT EXISTS os_lesson_workspaces (
 owner_id text NOT NULL,
 topic_id uuid NOT NULL REFERENCES os_topics(id) ON DELETE CASCADE,
 notes text NOT NULL DEFAULT '',
 questions jsonb NOT NULL DEFAULT '[]'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(owner_id,topic_id),
 CONSTRAINT os_lesson_workspaces_questions_array CHECK(jsonb_typeof(questions)='array')
);
CREATE INDEX IF NOT EXISTS os_lesson_workspaces_topic_idx ON os_lesson_workspaces(topic_id);
-- Ownership is checked in every API query against os_topics.owner_id.
