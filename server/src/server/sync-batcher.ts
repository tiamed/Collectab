import type pg from 'pg';
import { getPool } from '../database/client.js';
import type { ShadowDocManager } from './shadow-doc-manager.js';

/**
 * Debounced batch writer: CRDT list order → bookmarks.order_index.
 * Uses a single VALUES update, not row-by-row loops.
 */
export class SyncBatcher {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private mgr: ShadowDocManager,
    private debounceMs = 500,
    private poolGetter: () => pg.Pool = getPool,
  ) {}

  notifyChange(spaceId: string): void {
    const existing = this.timers.get(spaceId);
    if (existing) clearTimeout(existing);
    this.timers.set(spaceId, setTimeout(() => void this.flush(spaceId), this.debounceMs));
  }

  private async flush(spaceId: string): Promise<void> {
    this.timers.delete(spaceId);

    const doc = this.mgr.getDocIfLoaded(spaceId);
    if (!doc) return;

    const pool = this.poolGetter();
    const colResult = await pool.query(
      'SELECT id FROM collections WHERE space_id = $1 ORDER BY order_index',
      [spaceId],
    );
    const colIds: string[] = colResult.rows.map((r: { id: string }) => r.id);
    if (colIds.length === 0) return;

    const values: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    for (const colId of colIds) {
      const list = doc.getList(colId);
      for (let i = 0; i < list.length; i++) {
        const id = list.get(i) as string;
        values.push(`($${paramIdx}::uuid, $${paramIdx + 1}::uuid, $${paramIdx + 2}::int)`);
        params.push(id, colId, i);
        paramIdx += 3;
      }
    }

    if (values.length === 0) return;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE bookmarks SET order_index = -1
         WHERE collection_id IN (SELECT id FROM collections WHERE space_id = $1)`,
        [spaceId],
      );
      await client.query(
        `UPDATE bookmarks AS b SET order_index = v.order_index
         FROM (VALUES ${values.join(', ')}) AS v(id, collection_id, order_index)
         WHERE b.id = v.id AND b.collection_id = v.collection_id`,
        params,
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`SyncBatcher flush failed for space ${spaceId}:`, err);
    } finally {
      client.release();
    }
  }

  async flushNow(spaceId: string): Promise<void> {
    const t = this.timers.get(spaceId);
    if (t) {
      clearTimeout(t);
      this.timers.delete(spaceId);
    }
    await this.flush(spaceId);
  }
}
