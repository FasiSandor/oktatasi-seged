-- Curated teacher video bookmarks; store external links only, not third-party video bytes.
CREATE TABLE IF NOT EXISTS os_videos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id text NOT NULL,
 category text NOT NULL CHECK(category IN ('matematika','vendeglatas','egyeb')),
 title text NOT NULL CHECK(char_length(title) BETWEEN 1 AND 200),
 url text NOT NULL CHECK(char_length(url) BETWEEN 1 AND 2048),
 provider text NOT NULL,
 note text NOT NULL DEFAULT '' CHECK(char_length(note)<=2000),
 topic_id uuid REFERENCES os_topics(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS os_videos_owner_created_idx ON os_videos(owner_id,created_at DESC);
CREATE INDEX IF NOT EXISTS os_videos_topic_idx ON os_videos(owner_id,topic_id);
