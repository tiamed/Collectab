import { describe, it, expect } from 'vitest';
import { LoroDoc } from 'loro-crdt/base64';
import { CrdtOrderManager } from '@/lib/crdt-order-mgr';
import { collectCrdtIds, diffRemovedIds, reconcileCrdtOrder } from '@/lib/crdt-reconcile';
import type { Bookmark } from '@/lib/api';

const cols = [{ id: 'src' }, { id: 'dst' }];

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

function ids(list: Bookmark[] | undefined): string[] {
  return (list ?? []).map((b) => b.id);
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

/**
 * Mirrors the newtab WS handler: import a remote update, diff which IDs left
 * the CRDT entirely (deleted by a remote tab), reconcile against the local
 * (possibly stale) REST view, then persist the reconciled lists.
 */
function receiveRemote(
  mgr: CrdtOrderManager,
  rest: Record<string, Bookmark[]>,
  removedIds: Set<string>,
  update: Uint8Array,
): void {
  const before = collectCrdtIds(mgr, cols);
  mgr.applyRemoteUpdate(update);
  const after = collectCrdtIds(mgr, cols);
  for (const id of diffRemovedIds(before, after)) removedIds.add(id);
  const reconciled = reconcileCrdtOrder(mgr, cols, rest, removedIds);
  for (const [colId, list] of Object.entries(reconciled)) rest[colId] = list;
}

/** Two tabs bootstrapped from the same server snapshot; A relays ops to B. */
function makeTabPair(restB: Record<string, Bookmark[]>) {
  const snap = makeSnapshot({ src: ['bm1', 'bm2'], dst: [] });
  const a = new CrdtOrderManager();
  const b = new CrdtOrderManager();
  const removedB = new Set<string>();
  a.init('space', (u) => receiveRemote(b, restB, removedB, u));
  b.init('space', () => {});
  a.bootstrapWithSnapshot(snap);
  b.bootstrapWithSnapshot(snap);
  return { a, b, removedB };
}

describe('reconcileCrdtOrder — two-tab sync', () => {
  it('renders a remote cross-collection move in the destination, not the source', () => {
    // Tab B's REST view is stale: it still lists bm1 in src after A moves it to dst.
    const restB: Record<string, Bookmark[]> = {
      src: [bm('bm1', 'src'), bm('bm2', 'src')],
      dst: [],
    };
    const { a, b } = makeTabPair(restB);

    a.moveAcross('bm1', 'src', 0, 'dst', 0);

    expect(ids(restB.src)).toEqual(['bm2']);
    expect(ids(restB.dst)).toEqual(['bm1']);
    // No phantom entry was re-added to the source CRDT list.
    expect(b.getOrderedIds('src')).toEqual(['bm2']);
    expect(b.getOrderedIds('dst')).toEqual(['bm1']);
  });

  it('does not duplicate a bookmark moved back to its original collection', () => {
    const restB: Record<string, Bookmark[]> = {
      src: [bm('bm1', 'src'), bm('bm2', 'src')],
      dst: [],
    };
    const { a, b } = makeTabPair(restB);

    a.moveAcross('bm1', 'src', 0, 'dst', 0);
    a.moveAcross('bm1', 'dst', 0, 'src', 1);

    expect(ids(restB.src)).toEqual(['bm2', 'bm1']);
    expect(ids(restB.dst)).toEqual([]);
    expect(b.getOrderedIds('src')).toEqual(['bm2', 'bm1']);
  });

  it('propagates a remote delete immediately without re-adding it', () => {
    const restB: Record<string, Bookmark[]> = {
      src: [bm('bm1', 'src'), bm('bm2', 'src')],
      dst: [],
    };
    const { a, b, removedB } = makeTabPair(restB);

    a.moveAcross('bm1', 'src', 0, 'dst', 0);
    a.moveAcross('bm1', 'dst', 0, 'src', 1);
    a.remove('src', 'bm1');

    expect(removedB.has('bm1')).toBe(true);
    expect(ids(restB.src)).toEqual(['bm2']);
    expect(ids(restB.dst)).toEqual([]);
    expect(b.getOrderedIds('src')).toEqual(['bm2']);
  });
});

describe('reconcileCrdtOrder — REST-created bookmarks', () => {
  it('adopts a REST-created bookmark (popup save) into the CRDT and renders it', () => {
    const mgr = new CrdtOrderManager();
    mgr.init('space', () => {});
    mgr.bootstrapWithSnapshot(makeSnapshot({ src: ['bm1'], dst: [] }));

    const rest: Record<string, Bookmark[]> = {
      src: [bm('bm1', 'src'), bm('pop1', 'src')],
      dst: [],
    };
    const reconciled = reconcileCrdtOrder(mgr, cols, rest, new Set());

    expect(ids(reconciled.src)).toEqual(['bm1', 'pop1']);
    // Adopted so it becomes orderable in the CRDT.
    expect(mgr.getOrderedIds('src')).toContain('pop1');
  });

  it('does not re-add a bookmark deleted elsewhere while REST is stale', () => {
    // CRDT no longer has bm1 (a remote tab deleted it); REST still lists it.
    const mgr = new CrdtOrderManager();
    mgr.init('space', () => {});
    mgr.bootstrapWithSnapshot(makeSnapshot({ src: ['bm2'], dst: [] }));

    const rest: Record<string, Bookmark[]> = {
      src: [bm('bm1', 'src'), bm('bm2', 'src')],
      dst: [],
    };
    const reconciled = reconcileCrdtOrder(mgr, cols, rest, new Set(['bm1']));

    expect(ids(reconciled.src)).toEqual(['bm2']);
    expect(mgr.getOrderedIds('src')).toEqual(['bm2']);
  });
});

describe('reconcileCrdtOrder — defensive', () => {
  it('deduplicates legacy duplicate CRDT entries in the rendered list', () => {
    const mgr = new CrdtOrderManager();
    mgr.init('space', () => {});
    mgr.bootstrapWithSnapshot(makeSnapshot({ src: ['bm1', 'bm1'], dst: [] }));

    const rest: Record<string, Bookmark[]> = {
      src: [bm('bm1', 'src')],
      dst: [],
    };
    const reconciled = reconcileCrdtOrder(mgr, cols, rest, new Set());

    expect(ids(reconciled.src)).toEqual(['bm1']);
  });

  it('keeps a collection empty when its bookmarks all moved elsewhere and still renders them in the destination', () => {
    // CRDT moved bm1 to dst; REST is stale and still lists it in src.
    const mgr = new CrdtOrderManager();
    mgr.init('space', () => {});
    mgr.bootstrapWithSnapshot(makeSnapshot({ src: [], dst: ['bm1'] }));

    const rest: Record<string, Bookmark[]> = {
      src: [bm('bm1', 'src')],
      dst: [],
    };
    const reconciled = reconcileCrdtOrder(mgr, cols, rest, new Set());

    expect(ids(reconciled.src)).toEqual([]);
    // Data found space-wide renders in the destination, not the stale source.
    expect(ids(reconciled.dst)).toEqual(['bm1']);
    expect(mgr.getOrderedIds('src')).toEqual([]);
  });
});
