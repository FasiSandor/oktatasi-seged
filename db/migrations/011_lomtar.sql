-- Lomtár: a törölt könyv 30 napig visszahozható.
-- A lomtárban lévő könyv állapota 'archived' (ezt az állapotot az 001-es séma már ismeri),
-- és az archived_at oszlop mutatja, mikor került oda. 30 nap után az app véglegesen törli.
-- Új oszlopot hoz létre, meglévő adatot nem módosít. Többször is lefuttatható.

ALTER TABLE os_documents ADD COLUMN IF NOT EXISTS archived_at timestamptz;
CREATE INDEX IF NOT EXISTS os_documents_lomtar_idx ON os_documents(owner_id,archived_at) WHERE state='archived';
