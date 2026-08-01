import { describe, it, expect } from 'vitest';
import { LoroDoc } from 'loro-crdt/base64';
import { CrdtOrderManager } from '@/lib/crdt-order-mgr';

function makeManager(): CrdtOrderManager {
  const mgr = new CrdtOrderManager();
  mgr.init('space', () => {});
  mgr.bootstrapFromREST({ colA: ['bm1', 'bm2', 'bm3'], colB: [] });
  return mgr;
}

/** Full server-side CRDT state (what a fresh tab receives on WS connect). */
function makeSnapshot(lists: Record<string, string[]>): Uint8Array {
  const doc = new LoroDoc();
  for (const [colId, bmIds] of Object.entries(lists)) {
    const list = doc.getList(colId);
    for (const id of bmIds) list.push(id);
  }
  doc.commit();
  return doc.export({ mode: 'snapshot' });
}

describe('CrdtOrderManager', () => {
  it('bootstraps from REST-ordered IDs and reports ready', () => {
    const mgr = makeManager();
    expect(mgr.isReady).toBe(true);
    expect(mgr.getOrderedIds('colA')).toEqual(['bm1', 'bm2', 'bm3']);
    expect(mgr.getOrderedIds('colB')).toEqual([]);
  });

  it('moves a bookmark within a collection', () => {
    const mgr = makeManager();
    mgr.move('colA', 'bm3', 2, 0);
    expect(mgr.getOrderedIds('colA')).toEqual(['bm3', 'bm1', 'bm2']);
  });

  it('move falls back to searching by id when fromIndex is stale', () => {
    const mgr = makeManager();
    mgr.move('colA', 'bm2', 99, 1);
    expect(mgr.getOrderedIds('colA')).toEqual(['bm1', 'bm2', 'bm3']);
  });

  it('move is a no-op when the bookmark is not in the collection', () => {
    const mgr = makeManager();
    mgr.move('colA', 'missing', 0, 1);
    expect(mgr.getOrderedIds('colA')).toEqual(['bm1', 'bm2', 'bm3']);
  });

  it('moveAcross transfers a bookmark between collections', () => {
    const mgr = makeManager();
    mgr.moveAcross('bm2', 'colA', 1, 'colB', 0);
    expect(mgr.getOrderedIds('colA')).toEqual(['bm1', 'bm3']);
    expect(mgr.getOrderedIds('colB')).toEqual(['bm2']);
  });

  it('addToEnd appends and never duplicates', () => {
    const mgr = makeManager();
    mgr.addToEnd('colA', 'bm4');
    mgr.addToEnd('colA', 'bm1');
    expect(mgr.getOrderedIds('colA')).toEqual(['bm1', 'bm2', 'bm3', 'bm4']);
  });

  it('remove deletes the first occurrence and is a no-op when absent', () => {
    const mgr = makeManager();
    mgr.remove('colA', 'bm2');
    expect(mgr.getOrderedIds('colA')).toEqual(['bm1', 'bm3']);
    mgr.remove('colA', 'missing');
    expect(mgr.getOrderedIds('colA')).toEqual(['bm1', 'bm3']);
  });

  it('relays local updates via the onUpdate callback', () => {
    const updates: Uint8Array[] = [];
    const mgr = new CrdtOrderManager();
    mgr.init('space', (u) => updates.push(u));
    mgr.bootstrapFromREST({ colA: ['bm1'], colB: [] });
    expect(updates).toHaveLength(0); // bootstrap commit must not relay

    mgr.moveAcross('bm1', 'colA', 0, 'colB', 0);
    expect(updates).toHaveLength(1);
  });

  it('applyRemoteUpdate applies a remote doc update', () => {
    // Both tabs must share the same CRDT baseline (server snapshot) for the
    // delta to apply — same as the real WS flow.
    const snap = makeSnapshot({ colA: ['bm1'], colB: [] });
    const updates: Uint8Array[] = [];
    const a = new CrdtOrderManager();
    const b = new CrdtOrderManager();
    a.init('space', (u) => updates.push(u));
    b.init('space', () => {});
    a.bootstrapWithSnapshot(snap);
    b.bootstrapWithSnapshot(snap);

    a.moveAcross('bm1', 'colA', 0, 'colB', 0);
    expect(updates).toHaveLength(1);

    b.applyRemoteUpdate(updates[0]);
    expect(b.getOrderedIds('colB')).toEqual(['bm1']);
    expect(b.getOrderedIds('colA')).toEqual([]);
  });
});
