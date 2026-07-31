import { LoroDoc } from 'loro-crdt';
import { eq, asc } from 'drizzle-orm';
import { getDb } from '../database/client.js';
import { collections, bookmarks } from '../database/schema.js';
import type { SnapshotStore } from './snapshot-store.js';

interface ShadowRoom {
  doc: LoroDoc;
  lastAccessed: number;
}

/**
 * Per-space LoroDoc holding per-collection bookmark ID lists.
 * Cold start: bootstrap from DB order_index (only allowed mutate).
 * Runtime: importUpdate only.
 */
export class ShadowDocManager {
  private rooms = new Map<string, ShadowRoom>();
  private snapshotTimer: ReturnType<typeof setInterval> | null = null;
  private updateCounters = new Map<string, number>();
  private snapshotStore: SnapshotStore | null = null;

  /**
   * Cold start from DB. Unique place that may mutate the doc.
   */
  async getOrCreate(spaceId: string): Promise<LoroDoc> {
    const existing = this.rooms.get(spaceId);
    if (existing) {
      existing.lastAccessed = Date.now();
      return existing.doc;
    }

    const doc = new LoroDoc();
    const db = getDb();

    const cols = await db
      .select({ id: collections.id })
      .from(collections)
      .where(eq(collections.spaceId, spaceId))
      .orderBy(asc(collections.orderIndex));

    for (const col of cols) {
      const bks = await db
        .select({ id: bookmarks.id })
        .from(bookmarks)
        .where(eq(bookmarks.collectionId, col.id))
        .orderBy(asc(bookmarks.orderIndex));

      const list = doc.getList(col.id);
      for (const bk of bks) {
        list.push(bk.id);
      }
    }

    doc.commit();
    this.rooms.set(spaceId, { doc, lastAccessed: Date.now() });
    return doc;
  }

  async importUpdate(spaceId: string, update: Uint8Array): Promise<void> {
    const doc = await this.getOrCreate(spaceId);
    doc.import(update);
  }

  getDocIfLoaded(spaceId: string): LoroDoc | null {
    return this.rooms.get(spaceId)?.doc ?? null;
  }

  getBookmarkIds(spaceId: string, collectionId: string): string[] | null {
    const doc = this.getDocIfLoaded(spaceId);
    if (!doc) return null;
    const list = doc.getList(collectionId);
    const result: string[] = [];
    for (let i = 0; i < list.length; i++) {
      result.push(list.get(i) as string);
    }
    return result;
  }

  getSnapshot(spaceId: string): Uint8Array | null {
    const doc = this.getDocIfLoaded(spaceId);
    if (!doc) return null;
    return doc.export({ mode: 'snapshot' });
  }

  cleanStaleRooms(maxAgeMs = 30 * 60 * 1000): void {
    const now = Date.now();
    for (const [id, room] of this.rooms) {
      if (now - room.lastAccessed > maxAgeMs) this.rooms.delete(id);
    }
  }

  startAutoSnapshot(store: SnapshotStore, intervalMs = 30000, maxUpdates = 100): void {
    this.snapshotStore = store;
    this.snapshotTimer = setInterval(() => {
      void this.flushSnapshots();
    }, intervalMs);

    const orig = this.importUpdate.bind(this);
    this.importUpdate = async (spaceId, update) => {
      await orig(spaceId, update);
      const c = (this.updateCounters.get(spaceId) || 0) + 1;
      this.updateCounters.set(spaceId, c);
      if (c >= maxUpdates) {
        this.updateCounters.set(spaceId, 0);
        await this.saveSingleSnapshot(spaceId);
      }
    };
  }

  stopAutoSnapshot(): void {
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
      this.snapshotTimer = null;
    }
  }

  private async flushSnapshots() {
    if (!this.snapshotStore) return;
    for (const [spaceId] of this.rooms) {
      try {
        await this.saveSingleSnapshot(spaceId);
      } catch (err) {
        console.error(`Failed to save CRDT snapshot for space ${spaceId}:`, err);
      }
    }
  }

  private async saveSingleSnapshot(spaceId: string) {
    if (!this.snapshotStore) return;
    const snap = this.getSnapshot(spaceId);
    if (snap) await this.snapshotStore.saveSnapshot(spaceId, snap);
  }
}
