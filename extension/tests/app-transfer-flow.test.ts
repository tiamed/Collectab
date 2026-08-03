import { describe, it, expect } from 'vitest';
import { LoroDoc } from 'loro-crdt/base64';
import { CrdtOrderManager } from '@/lib/crdt-order-mgr';
import { reconcileCrdtOrder, collectCrdtIds, diffRemovedIds } from '@/lib/crdt-reconcile';
import type { Bookmark } from '@/lib/api';

const cols = [{ id: 'col1' }, { id: 'col2' }, { id: 'col3' }];

function bm(id: string, collectionId: string, orderIndex = 0): Bookmark {
  return {
    id,
    collectionId,
    title: id,
    url: `https://${id}.example.com`,
    description: null,
    favicon: null,
    tags: [],
    orderIndex,
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
 * Mirrors App.tsx handleTransferBookmark + the newtab WS handler, for the
 * exact reported repro: drag col1 -> col2 (ok), then col2 -> col3 (vanishes,
 * and after refresh col3 flashes X then it reverts to col2).
 *
 * CRDT is the server shadow doc (what a fresh tab sees). REST is the DB.
 */
describe('App flow: two consecutive cross-collection transfers', () => {
  function makeEnv() {
    // Server shadow doc + local CRDT, both bootstrapped identically.
    const server = new CrdtOrderManager();
    const local = new CrdtOrderManager();
    const snap = makeSnapshot({
      col1: ['bm1', 'X'],
      col2: ['a', 'b'],
      col3: ['c', 'd', 'e'],
    });
    server.init('space', () => {});
    local.init('space', (u) => {
      // local moves are relayed to the server shadow doc
      server.applyRemoteUpdate(u);
    });
    server.bootstrapWithSnapshot(snap);
    local.bootstrapWithSnapshot(snap);

    // REST DB state (bookmarksByCollection), kept in sync manually like useApi.
    const rest: Record<string, Bookmark[]> = {
      col1: [bm('bm1', 'col1', 0), bm('X', 'col1', 1)],
      col2: [bm('a', 'col2', 0), bm('b', 'col2', 1)],
      col3: [bm('c', 'col3', 0), bm('d', 'col3', 1), bm('e', 'col3', 2)],
    };
    return { server, local, rest };
  }

  function transfer(
    local: CrdtOrderManager,
    rest: Record<string, Bookmark[]>,
    bookmarkId: string,
    fromCol: string,
    toCol: string,
    newIndex: number,
  ) {
    // --- CRDT leg (App.tsx) ---
    const srcIds = local.getOrderedIds(fromCol);
    const from = srcIds.indexOf(bookmarkId);
    if (from !== -1) {
      local.moveAcross(bookmarkId, fromCol, from, toCol, newIndex);
    }
    // --- REST leg: update collectionId + renumber target from CRDT order ---
    const byId = new Map(Object.values(rest).flat().map((b) => [b.id, b]));
    const moved = byId.get(bookmarkId);
    if (moved) {
      moved.collectionId = toCol;
      const ids = local.getOrderedIds(toCol);
      const ordered = ids.map((id) => byId.get(id)).filter((b): b is Bookmark => Boolean(b));
      rest[toCol] = ordered;
    }
    rest[fromCol] = local
      .getOrderedIds(fromCol)
      .map((id) => byId.get(id))
      .filter((b): b is Bookmark => Boolean(b));
  }

  /** Newtab WS handler: import remote update + reconcile CRDT into REST/UI. */
  function receiveRemote(
    local: CrdtOrderManager,
    rest: Record<string, Bookmark[]>,
    removedIds: Set<string>,
    update: Uint8Array,
  ) {
    const before = collectCrdtIds(local, cols);
    local.applyRemoteUpdate(update);
    const after = collectCrdtIds(local, cols);
    for (const id of diffRemovedIds(before, after)) removedIds.add(id);
    const reconciled = reconcileCrdtOrder(local, cols, rest, removedIds);
    for (const [colId, list] of Object.entries(reconciled)) rest[colId] = list;
  }

  it('keeps X in col3 after drag1 (col1->col2) then drag2 (col2->col3)', () => {
    const { server, local, rest } = makeEnv();

    // Drag 1: col1 -> col2, drop at index 0
    transfer(local, rest, 'X', 'col1', 'col2', 0);
    expect(rest.col2.map((b) => b.id)).toContain('X');
    expect(rest.col1.map((b) => b.id)).not.toContain('X');
    expect(local.getOrderedIds('col2')).toContain('X');
    expect(server.getOrderedIds('col2')).toContain('X');

    // Drag 2: col2 -> col3, drop at index 1
    transfer(local, rest, 'X', 'col2', 'col3', 1);

    // Local CRDT: X moved to col3
    expect(local.getOrderedIds('col2')).toEqual(['a', 'b']);
    expect(local.getOrderedIds('col3')).toEqual(['c', 'X', 'd', 'e']);
    // Server shadow doc received the relayed update
    expect(server.getOrderedIds('col2')).toEqual(['a', 'b']);
    expect(server.getOrderedIds('col3')).toEqual(['c', 'X', 'd', 'e']);
    // REST: X in col3
    expect(rest.col3.map((b) => b.id)).toEqual(['c', 'X', 'd', 'e']);
    expect(rest.col2.map((b) => b.id)).toEqual(['a', 'b']);
  });

  it('on refresh, reconcile does not pull X back to col2', () => {
    const { server, local, rest } = makeEnv();

    transfer(local, rest, 'X', 'col1', 'col2', 0);
    transfer(local, rest, 'X', 'col2', 'col3', 1);

    // A fresh tab booting from the server shadow doc + stale REST reconciles
    // with the CRDT (server doc) as authority for membership/order.
    const removed = new Set<string>();
    const reconciled = reconcileCrdtOrder(server, cols, rest, removed);

    expect(reconciled.col2.map((b) => b.id)).toEqual(['a', 'b']);
    expect(reconciled.col3.map((b) => b.id)).toEqual(['c', 'X', 'd', 'e']);
  });

  it('moveAcross clamps out-of-range toIndex instead of throwing (reported repro)', () => {
    // The CRDT dstList is SHORTER than the REST/UI target list — e.g. a
    // bookmark freshly added via popup REST that reconcile has not yet
    // adopted via addToEnd. ContentArea computes newIndex against the longer
    // REST list, so moveAcross must not throw (Loro insert throws on
    // index > length) and must not lose X (delete src before insert).
    const mgr = new CrdtOrderManager();
    mgr.init('space', () => {});
    mgr.bootstrapWithSnapshot(
      makeSnapshot({ col1: ['bm1', 'X'], col2: ['a', 'b'], col3: ['c', 'd'] }),
    );
    expect(mgr.getOrderedIds('col3')).toEqual(['c', 'd']);

    // CRDT col3 has 2 items, but the UI/REST list has 3 (c, d, e): newIndex=3
    // is out of bounds for the CRDT list.
    expect(() => mgr.moveAcross('X', 'col1', 1, 'col3', 3)).not.toThrow();

    // X must be inserted at the clamped end of col3, and removed from col1.
    expect(mgr.getOrderedIds('col1')).toEqual(['bm1']);
    expect(mgr.getOrderedIds('col3')).toEqual(['c', 'd', 'X']);
  });

  it('moveAcross still removes X from src when toIndex is clamped', () => {
    const mgr = new CrdtOrderManager();
    mgr.init('space', () => {});
    mgr.bootstrapWithSnapshot(makeSnapshot({ col1: ['X'], col2: [], col3: [] }));

    expect(() => mgr.moveAcross('X', 'col1', 0, 'col3', 99)).not.toThrow();
    expect(mgr.getOrderedIds('col1')).toEqual([]);
    expect(mgr.getOrderedIds('col3')).toEqual(['X']);
  });
});
