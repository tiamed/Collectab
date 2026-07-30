CREATE TABLE IF NOT EXISTS crdt_snapshots (
  space_id   UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  snapshot   BYTEA NOT NULL,
  version    INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (space_id, version)
);

CREATE INDEX IF NOT EXISTS idx_crdt_snapshots_sv ON crdt_snapshots(space_id, version DESC);
