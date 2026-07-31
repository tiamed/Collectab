import { getPool } from '../database/client.js';

export class SnapshotStore {
  async loadSnapshot(spaceId: string): Promise<Uint8Array | null> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT snapshot FROM crdt_snapshots
       WHERE space_id = $1 ORDER BY version DESC LIMIT 1`,
      [spaceId],
    );
    if (result.rows.length === 0) return null;
    const buf = result.rows[0].snapshot as Buffer;
    return new Uint8Array(buf);
  }

  async saveSnapshot(spaceId: string, snapshot: Uint8Array): Promise<void> {
    const pool = getPool();
    await pool.query(
      `INSERT INTO crdt_snapshots (space_id, snapshot, version, updated_at)
       VALUES ($1, $2, (
         SELECT COALESCE(MAX(version), 0) + 1 FROM crdt_snapshots WHERE space_id = $1
       ), NOW())
       ON CONFLICT (space_id, version) DO NOTHING`,
      [spaceId, Buffer.from(snapshot)],
    );
  }
}
