import { LoroDoc } from 'loro-crdt';
import type { WebSocket } from 'ws';

interface Room {
  doc: LoroDoc;
  clients: Set<WebSocket>;
  lastUpdated: number;
}

export class LoroRoomManager {
  private rooms = new Map<string, Room>();

  getOrCreateRoom(roomId: string): Room {
    let room = this.rooms.get(roomId);
    if (!room) {
      const doc = new LoroDoc();
      room = { doc, clients: new Set(), lastUpdated: Date.now() };
      this.rooms.set(roomId, room);
    }
    return room;
  }

  applyUpdate(roomId: string, update: Uint8Array, sender: WebSocket): void {
    const room = this.getOrCreateRoom(roomId);
    room.doc.import(update);
    room.lastUpdated = Date.now();

    for (const client of room.clients) {
      if (client !== sender && client.readyState === client.OPEN) {
        client.send(update);
      }
    }
  }

  getSnapshot(roomId: string): Uint8Array {
    const room = this.getOrCreateRoom(roomId);
    return room.doc.export({ mode: 'snapshot' });
  }

  addClient(roomId: string, client: WebSocket): void {
    const room = this.getOrCreateRoom(roomId);
    room.clients.add(client);
  }

  removeClient(roomId: string, client: WebSocket): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.clients.delete(client);
      // TODO: persist snapshot to database when room is empty
    }
  }

  getRoomStats() {
    const stats: Record<string, { clients: number; lastUpdated: number }> = {};
    for (const [id, room] of this.rooms) {
      stats[id] = { clients: room.clients.size, lastUpdated: room.lastUpdated };
    }
    return stats;
  }
}
