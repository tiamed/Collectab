import type { Bookmark, Collection } from './api';
import type { CrdtOrderManager } from './crdt-order-mgr';

export function collectCrdtIds(
  mgr: CrdtOrderManager,
  collections: Pick<Collection, 'id'>[],
): Set<string> {
  const ids = new Set<string>();
  for (const col of collections) {
    for (const id of mgr.getOrderedIds(col.id)) ids.add(id);
  }
  return ids;
}

export function diffRemovedIds(before: Set<string>, after: Set<string>): Set<string> {
  const removed = new Set<string>();
  for (const id of before) {
    if (!after.has(id)) removed.add(id);
  }
  return removed;
}

/**
 * Reconcile the local REST view against the CRDT ordering, which is the
 * authority for membership AND ordering within a space.
 *
 * Bookmark data is looked up space-wide because a remotely moved bookmark only
 * still exists in REST under its OLD collection; it must render in the new one.
 *
 * Returns the reconciled per-collection bookmark lists. Bookmark IDs the CRDT
 * never saw anywhere (newly REST-created, e.g. popup saves) are adopted via
 * `mgr.addToEnd`; ones a remote tab moved elsewhere (`knownIds`) or deleted
 * (`removedIds`) are never re-added — re-adding those created phantom CRDT
 * entries that duplicated and outlived deletes.
 */
export function reconcileCrdtOrder(
  mgr: CrdtOrderManager,
  collections: Pick<Collection, 'id'>[],
  restData: Record<string, Bookmark[]>,
  removedIds: Set<string>,
): Record<string, Bookmark[]> {
  const spaceData = new Map<string, Bookmark>();
  for (const col of collections) {
    for (const b of restData[col.id] || []) spaceData.set(b.id, b);
  }

  const knownIds = collectCrdtIds(mgr, collections);
  const result: Record<string, Bookmark[]> = {};

  for (const col of collections) {
    const ids = mgr.getOrderedIds(col.id);
    const current = restData[col.id] || [];
    if (ids.length === 0 && current.length === 0) continue;

    const seen = new Set<string>();
    const ordered: Bookmark[] = [];
    for (const id of ids) {
      if (seen.has(id)) continue; // ignore legacy duplicate CRDT entries
      const b = spaceData.get(id);
      if (b) {
        ordered.push(b);
        seen.add(id);
      }
    }

    const extras = current.filter(
      (b) => !seen.has(b.id) && !knownIds.has(b.id) && !removedIds.has(b.id),
    );
    for (const b of extras) {
      if (mgr.isReady) mgr.addToEnd(col.id, b.id);
    }

    const merged = [...ordered, ...extras];
    // Also emit empty lists so stale REST bookmarks (moved/deleted remotely) leave the UI.
    if (merged.length > 0 || current.length > 0) result[col.id] = merged;
  }

  return result;
}
