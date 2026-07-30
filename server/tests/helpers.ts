import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authRoutes } from '../src/api/routes/auth.js';
import { spaceRoutes } from '../src/api/routes/spaces.js';
import { collectionRoutes } from '../src/api/routes/collections.js';
import { bookmarkRoutes } from '../src/api/routes/bookmarks.js';
import { searchRoutes } from '../src/api/routes/search.js';
import jwt from 'jsonwebtoken';

export function createTestApp() {
  const app = new Hono();
  app.use('*', cors());
  app.get('/health', (c) => c.json({ status: 'ok' }));
  app.route('/api/auth', authRoutes);
  app.route('/api/spaces', spaceRoutes);
  app.route('/api/collections', collectionRoutes);
  app.route('/api/bookmarks', bookmarkRoutes);
  app.route('/api/search', searchRoutes);
  return app;
}

export function generateTestToken(userId: string, email: string = 'test@example.com') {
  return jwt.sign(
    { sub: userId, email },
    process.env.JWT_SECRET!,
    { expiresIn: 900 },
  );
}
