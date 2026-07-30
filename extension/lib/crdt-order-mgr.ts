import { LoroDoc } from 'loro-crdt';

/**
 * Client-side CRDT order manager: one LoroList per collection of bookmark IDs.
 */
export class CrdtOrderManager {
  private doc: LoroDoc | null = null;
  private currentSpaceId: string | null = null;
  private onUpdate: ((update: Uint8Array) => void) | null = null;
  private initialized = false;

  /** Phase 1: empty doc + local update subscription. */
  init(spaceId: string, onUpdate: (update: Uint8Array) => void): void {
    if (this.currentSpaceId === spaceId && this.doc) return;
    this.currentSpaceId = spaceId;
    this.onUpdate = onUpdate;
    this.initialized = false;

    this.doc = new LoroDoc();
    // Subscribe after bootstrap so REST/snapshot init does not flood the relay
  }

  /** Phase 2a: first WS packet is server snapshot. */
  bootstrapWithSnapshot(snapshot: Uint8Array): void {
    if (!this.doc || this.initialized) return;
    this.doc.import(snapshot);
    this.finishInit();
  }

  /** Phase 2b: timeout fallback from REST-ordered IDs. */
  bootstrapFromREST(initialData: Record<string, string[]>): void {
    if (!this.doc || this.initialized) return;
    for (const [colId, bmIds] of Object.entries(initialData)) {
      const list = this.doc.getList(colId);
      for (const id of bmIds) list.push(id);
    }
    this.finishInit();
  }

  private finishInit(): void {
    this.initialized = true;
    this.doc?.subscribeLocalUpdates((update) => {
      this.onUpdate?.(update);
    });
  }

  get isReady(): boolean {
    return this.initialized;
  }

  applyRemoteUpdate(update: Uint8Array): void {
    this.doc?.import(update);
  }

  getOrderedIds(collectionId: string): string[] {
    if (!this.doc) return [];
    const list = this.doc.getList(collectionId);
    const result: string[] = [];
    for (let i = 0; i < list.length; i++) result.push(list.get(i) as string);
    return result;
  }

  move(collectionId: string, bookmarkId: string, fromIndex: number, toIndex: number): void {
    if (!this.doc) return;
    const list = this.doc.getList(collectionId);
    const id = list.get(fromIndex) as string;
    if (id !== bookmarkId) return;
    list.delete(fromIndex, 1);
    list.insert(toIndex, bookmarkId);
  }

  moveAcross(
    bookmarkId: string,
    srcCol: string,
    fromIndex: number,
    dstCol: string,
    toIndex: number,
  ): void {
    if (!this.doc) return;
    const srcList = this.doc.getList(srcCol);
    const dstList = this.doc.getList(dstCol);
    const id = srcList.get(fromIndex) as string;
    if (id !== bookmarkId) return;
    srcList.delete(fromIndex, 1);
    dstList.insert(toIndex, bookmarkId);
  }

  addToEnd(collectionId: string, bookmarkId: string): void {
    if (!this.doc) return;
    this.doc.getList(collectionId).push(bookmarkId);
  }

  remove(collectionId: string, bookmarkId: string): void {
    if (!this.doc) return;
    const list = this.doc.getList(collectionId);
    for (let i = 0; i < list.length; i++) {
      if ((list.get(i) as string) === bookmarkId) {
        list.delete(i, 1);
        return;
      }
    }
  }

  destroy(): void {
    this.doc = null;
    this.currentSpaceId = null;
    this.onUpdate = null;
    this.initialized = false;
  }
}
