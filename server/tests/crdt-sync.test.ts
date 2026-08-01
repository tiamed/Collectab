import { describe, it, expect, vi } from 'vitest';
import { LoroDoc } from 'loro-crdt';
import { SyncBatcher } from '../src/server/sync-batcher.js';

describe('SyncBatcher', () => {
  it('should issue single batch UPDATE with VALUES', async () => {
    const doc = new LoroDoc();
    const list = doc.getList('col-1');
    list.push('11111111-1111-1111-1111-111111111111');
    list.push('22222222-2222-2222-2222-222222222222');

    const mockMgr = {
      getDocIfLoaded: vi.fn().mockReturnValue(doc),
    };

    const queries: string[] = [];
    const mockClient = {
      query: vi.fn().mockImplementation(async (sql: string) => {
        queries.push(sql);
        return { rows: [] };
      }),
      release: vi.fn(),
    };

    const mockPool = {
      query: vi.fn().mockResolvedValue({ rows: [{ id: 'col-1' }] }),
      connect: vi.fn().mockResolvedValue(mockClient),
    };

    const batcher = new SyncBatcher(mockMgr as any, 0, () => mockPool as any);
    await batcher.flushNow('space-1');

    expect(queries[0]).toBe('BEGIN');
    expect(queries[1]).toContain('SET order_index = -1');
    expect(queries[2]).toContain('SET collection_id = v.collection_id, order_index = v.order_index');
    expect(queries[2]).toContain('FROM (VALUES ');
    expect(queries[2]).toContain('::uuid');
    expect(queries[3]).toBe('COMMIT');
    expect(mockClient.release).toHaveBeenCalled();
  });
});
