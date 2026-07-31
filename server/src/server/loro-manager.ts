import type { WebSocket } from 'ws';
import type { ShadowDocManager } from './shadow-doc-manager.js';
import type { SyncBatcher } from './sync-batcher.js';

interface Room {
  clients: Set<WebSocket>;
}

/** Pure WebSocket relay — no LoroDoc ownership. */
export class WsRelayManager {
  private rooms = new Map<string, Room>();

  constructor(
    private shadowDocManager: ShadowDocManager,
    private syncBatcher: SyncBatcher,
  ) {}

  addClient(roomId: string, client: WebSocket) {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = { clients: new Set() };
      this.rooms.set(roomId, room);
    }
    room.clients.add(client);
  }

  removeClient(roomId: string, client: WebSocket) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.clients.delete(client);
    if (room.clients.size === 0) this.rooms.delete(roomId);
  }

  async handleUpdate(roomId: string, update: Uint8Array, sender: WebSocket) {
    await this.shadowDocManager.importUpdate(roomId, update);
    this.syncBatcher.notifyChange(roomId);
    const room = this.rooms.get(roomId);
    if (!room) return;
    for (const c of room.clients) {
      if (c !== sender && c.readyState === c.OPEN) {
        c.send(update);
      }
    }
  }

  async ensureRoomReady(roomId: string): Promise<Uint8Array | null> {
    await this.shadowDocManager.getOrCreate(roomId);
    return this.shadowDocManager.getSnapshot(roomId);
  }
}
