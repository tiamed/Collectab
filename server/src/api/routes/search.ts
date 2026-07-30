import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { getDb } from '../../database/client.js';
import { authMiddleware, type AuthEnv } from '../middleware/auth.js';

export const searchRoutes = new Hono<AuthEnv>();
searchRoutes.use('*', authMiddleware);

searchRoutes.get('/', async (c) => {
  const db = getDb();
  const userId = c.get('userId');
  const query = (c.req.query('q') || '').trim();

  if (!query) {
    return c.json({ results: [], query: '' });
  }

  const results = await db.execute(sql`
    SELECT b.*, c.name as collection_name, c.icon as collection_icon, c.space_id
    FROM bookmarks b
    JOIN collections c ON b.collection_id = c.id
    WHERE c.owner_id = ${userId}
      AND to_tsvector('english', b.title || ' ' || COALESCE(b.url, '') || ' ' || COALESCE(b.description, ''))
          @@ websearch_to_tsquery('english', ${query})
    ORDER BY ts_rank(
      to_tsvector('english', b.title || ' ' || COALESCE(b.url, '') || ' ' || COALESCE(b.description, '')),
      websearch_to_tsquery('english', ${query})
    ) DESC
    LIMIT 50
  `);

  return c.json({ results: results.rows, query });
});
