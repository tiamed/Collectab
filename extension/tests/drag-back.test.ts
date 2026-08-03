import { describe, it, expect } from 'vitest';
import { LoroDoc } from 'loro-crdt/base64';
import { CrdtOrderManager } from '@/lib/crdt-order-mgr';

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
 * Reproduce the exact reported repro: drag X col1 -> col2 (works), then drag
 * X back col2 -> col1 (reverts). Two tabs share the server shadow doc via WS.
 */
describe('drag back to source collection', () => {
  it('moveAcross col2->col1 works when CRDT has X in col2', () => {
    const server = new CrdtOrderManager();
    const local = new CrdtOrderManager();
    server.init('space', () => {});
    local.init('space', (u) => server.applyRemoteUpdate(u));
    const snap = makeSnapshot({ col1: ['bm1', 'X'], col2: ['a', 'b'] });
    server.bootstrapWithSnapshot(snap);
    local.bootstrapWithSnapshot(snap);

    // Drag 1: col1 -> col2
    local.moveAcross('X', 'col1', 1, 'col2', 0);
    expect(local.getOrderedIds('col2')).toEqual(['X', 'a', 'b']);
    expect(local.getOrderedIds('col1')).toEqual(['bm1']);
    expect(server.getOrderedIds('col2')).toEqual(['X', 'a', 'b']);

    // Drag 2: col2 -> col1 (back)
    local.moveAcross('X', 'col2', 0, 'col1', 0);
    expect(local.getOrderedIds('col1')).toEqual(['X', 'bm1']);
    expect(local.getOrderedIds('col2')).toEqual(['a', 'b']);
    expect(server.getOrderedIds('col1')).toEqual(['X', 'bm1']);
    expect(server.getOrderedIds('col2')).toEqual(['a', 'b']);
  });

  it('moveAcross back is a no-op when CRDT never learned X moved to col2', () => {
    // Simulates: first drag happened while CRDT was NOT ready (moveAcross
    // skipped), so the local+server CRDT still has X in col1. The UI (REST)
    // shows X in col2. Second drag col2->col1 calls moveAcross with from=col2
    // but CRDT col2 has no X -> moveAcross silently returns, CRDT unchanged.
    const server = new CrdtOrderManager();
    const local = new CrdtOrderManager();
    server.init('space', () => {});
    local.init('space', (u) => server.applyRemoteUpdate(u));
    const snap = makeSnapshot({ col1: ['bm1', 'X'], col2: ['a', 'b'] });
    server.bootstrapWithSnapshot(snap);
    local.bootstrapWithSnapshot(snap);

    // Drag 1 (CRDT not ready): only REST would move X; CRDT untouched.
    // X still in col1 in CRDT.
    expect(local.getOrderedIds('col1')).toEqual(['bm1', 'X']);

    // Drag 2 (CRDT ready now): moveAcross X col2 -> col1
    const srcIds = local.getOrderedIds('col2');
    const from = srcIds.indexOf('X'); // -1: X is not in CRDT col2
    if (from !== -1) {
      local.moveAcross('X', 'col2', from, 'col1', 0);
    }
    // X stays in col1 — which coincidentally is the "correct" visual target,
    // but the REST move of collectionId never persisted for drag 1, so the DB
    // still has X under col1. This is the divergence: UI shows col2, CRDT col1.
    expect(local.getOrderedIds('col1')).toEqual(['bm1', 'X']);
    expect(local.getOrderedIds('col2')).toEqual(['a', 'b']);
  });
});
