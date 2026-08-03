import { describe, it, expect } from 'vitest';
import { LoroDoc } from 'loro-crdt/base64';
import { CrdtOrderManager } from '@/lib/crdt-order-mgr';
import { reconcileCrdtOrder } from '@/lib/crdt-reconcile';
import type { Bookmark } from '@/lib/api';

const cols = [{ id: 'col1' }, { id: 'col2' }, { id: 'col3' }];

function bm(id: string, collectionId: string): Bookmark {
  return {
    id,
    collectionId,
    title: id,
    url: `https://${id}.example.com`,
    description: null,
    favicon: null,
    tags: [],
    orderIndex: 0,
    createdAt: '',
    updatedAt: '',
  };
}

function makeSnapshot(lists: Record<string, string[]>): Uint8Array {
  const doc = new LoroDoc();
  for (const [colId, bmIds] of Object.entries(lists)) {
    const list = doc.getList(colId);
    for (const id of bmIds) list.push(id);
  }
  doc.commit();
  return doc.export({ mode: 'snapshot' });
}

/**
 * Reproduce: user drags X col1 -> col2 (works), then col2 -> col3 (bookmark
 * disappears / reverts to col2 on refresh).
 *
 * Mirrors App.tsx handleTransferBookmark + the WS echo reconcile flow.
 */
describe('double cross-collection move', () => {
  it('keeps X in col3 after two consecutive moveAcross calls', () => {
    const mgr = new CrdtOrderManager();
    const relayed: Uint8Array[] = [];
    mgr.init('space', (u) => relayed.push(u));
    mgr.bootstrapWithSnapshot(
      makeSnapshot({ col1: ['bm1', 'X'], col2: ['a', 'b'], col3: ['c', 'd'] }),
    );
    expect(mgr.isReady).toBe(true);

    // Drag 1: col1 -> col2, drop before 'a' (index 0)
    const srcIds1 = mgr.getOrderedIds('col1');
    mgr.moveAcross('X', 'col1', srcIds1.indexOf('X'), 'col2', 0);
    expect(mgr.getOrderedIds('col1')).toEqual(['bm1']);
    expect(mgr.getOrderedIds('col2')).toEqual(['X', 'a', 'b']);

    // Drag 2: col2 -> col3, drop before 'd' (index 1)
    const srcIds2 = mgr.getOrderedIds('col2');
    mgr.moveAcross('X', 'col2', srcIds2.indexOf('X'), 'col3', 1);
    expect(mgr.getOrderedIds('col2')).toEqual(['a', 'b']);
    expect(mgr.getOrderedIds('col3')).toEqual(['c', 'X', 'd']);
  });

  it('reconcile renders X in col3 when REST is updated but CRDT already moved it', () => {
    const mgr = new CrdtOrderManager();
    mgr.init('space', () => {});
    mgr.bootstrapWithSnapshot(
      makeSnapshot({ col1: ['bm1', 'X'], col2: ['a', 'b'], col3: ['c', 'd'] }),
    );
    mgr.moveAcross('X', 'col1', 1, 'col2', 0);
    mgr.moveAcross('X', 'col2', 0, 'col3', 1);

    // REST says X.collectionId = col3 now (REST update succeeded), but the
    // bookmark object may still carry collectionId=col1 in stale cached data.
    const rest: Record<string, Bookmark[]> = {
      col1: [bm('bm1', 'col1')],
      col2: [bm('a', 'col2'), bm('b', 'col2')],
      col3: [bm('c', 'col3'), bm('X', 'col3'), bm('d', 'col3')],
    };
    const reconciled = reconcileCrdtOrder(mgr, cols, rest, new Set());

    const c3 = (reconciled.col3 ?? []).map((b) => b.id);
    expect(c3).toEqual(['c', 'X', 'd']);
    const c2 = (reconciled.col2 ?? []).map((b) => b.id);
    expect(c2).toEqual(['a', 'b']);
  });

  it('reconcile keeps X in col3 when REST still lists it under col2 (stale)', () => {
    const mgr = new CrdtOrderManager();
    mgr.init('space', () => {});
    mgr.bootstrapWithSnapshot(
      makeSnapshot({ col1: ['bm1', 'X'], col2: ['a', 'b'], col3: ['c', 'd'] }),
    );
    mgr.moveAcross('X', 'col1', 1, 'col2', 0);
    mgr.moveAcross('X', 'col2', 0, 'col3', 1);

    // REST is stale: X still listed under col2 (REST update hasn't landed yet)
    const rest: Record<string, Bookmark[]> = {
      col1: [bm('bm1', 'col1')],
      col2: [bm('a', 'col2'), bm('b', 'col2'), bm('X', 'col2')],
      col3: [bm('c', 'col3'), bm('d', 'col3')],
    };
    const reconciled = reconcileCrdtOrder(mgr, cols, rest, new Set());

    const c3 = (reconciled.col3 ?? []).map((b) => b.id);
    expect(c3).toEqual(['c', 'X', 'd']);
    const c2 = (reconciled.col2 ?? []).map((b) => b.id);
    expect(c2).toEqual(['a', 'b']);
  });

  it('reconcile does not pull X back to col2 when a WS echo is re-applied', () => {
    const snap = makeSnapshot({ col1: ['bm1', 'X'], col2: ['a', 'b'], col3: ['c', 'd'] });
    const mgr = new CrdtOrderManager();
    const updates: Uint8Array[] = [];
    mgr.init('space', (u) => updates.push(u));
    mgr.bootstrapWithSnapshot(snap);

    mgr.moveAcross('X', 'col1', 1, 'col2', 0);
    mgr.moveAcross('X', 'col2', 0, 'col3', 1);

    // WS echo of the SECOND move comes back (server shadow doc relay)
    const echo = updates[updates.length - 1];
    mgr.applyRemoteUpdate(echo);

    expect(mgr.getOrderedIds('col2')).toEqual(['a', 'b']);
    expect(mgr.getOrderedIds('col3')).toEqual(['c', 'X', 'd']);
  });
});
