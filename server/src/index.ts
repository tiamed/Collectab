import 'dotenv/config';
import { createServer } from 'node:http';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { WebSocketServer, WebSocket } from 'ws';
import { authRoutes } from './api/routes/auth.js';
import { spaceRoutes } from './api/routes/spaces.js';
import { collectionRoutes } from './api/routes/collections.js';
import { bookmarkRoutes } from './api/routes/bookmarks.js';
import { searchRoutes } from './api/routes/search.js';
import { importRoutes } from './api/routes/import.js';
import { memberRoutes } from './api/routes/members.js';
import { orgRoutes } from './api/routes/organizations.js';
import { LoroRoomManager } from './server/loro-manager.js';
import { getEnv } from './config/env.js';

const env = getEnv();
const app = new Hono();
const roomManager = new LoroRoomManager();

app.use('*', logger());
app.use('*', cors({ origin: env.CORS_ORIGIN }));

app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.route('/api/auth', authRoutes);
app.route('/api/spaces', spaceRoutes);
app.route('/api/collections', collectionRoutes);
app.route('/api/bookmarks', bookmarkRoutes);
app.route('/api/search', searchRoutes);
app.route('/api/import', importRoutes);
app.route('/api/members', memberRoutes);
app.route('/api/orgs', orgRoutes);

// Create Node.js HTTP server with Hono and WebSocket
const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`Server running on http://localhost:${info.port}`);
});

// WebSocket server for Loro CRDT sync
const wss = new WebSocketServer({ noServer: true });

(server as any).on('upgrade', (request: any, socket: any, head: any) => {
  const url = new URL(request.url || '', `http://${request.headers.host}`);
  const match = url.pathname.match(/^\/ws\/workspace\/(.+)$/);

  if (!match) {
    socket.destroy();
    return;
  }

  const roomId = match[1];
  // TODO: validate JWT from url.searchParams.get('token')

  wss.handleUpgrade(request, socket, head, (ws) => {
    roomManager.addClient(roomId, ws);

    const snapshot = roomManager.getSnapshot(roomId);
    ws.send(snapshot);

    ws.on('message', (data: Buffer) => {
      roomManager.applyUpdate(roomId, new Uint8Array(data), ws);
    });

    ws.on('close', () => {
      roomManager.removeClient(roomId, ws);
    });

    ws.on('error', (err) => {
      console.error(`WebSocket error in room ${roomId}:`, err.message);
      roomManager.removeClient(roomId, ws);
    });
  });
});

console.log(`WebSocket ready on ws://localhost:${env.PORT}/ws/workspace/:id`);
