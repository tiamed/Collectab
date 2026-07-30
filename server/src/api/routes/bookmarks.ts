import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, asc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../database/client.js';
import { bookmarks, collections } from '../../database/schema.js';
import { authMiddleware, type AuthEnv } from '../middleware/auth.js';

const createSchema = z.object({
  collectionId: z.string().uuid(),
  title: z.string().min(1).max(500),
  url: z.string().url(),
  description: z.string().max(2000).optional(),
  favicon: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const updateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  url: z.string().url().optional(),
  description: z.string().max(2000).optional(),
  favicon: z.string().optional(),
  tags: z.array(z.string()).optional(),
  orderIndex: z.number().int().min(0).optional(),
  collectionId: z.string().uuid().optional(),
});

const reorderSchema = z.object({
  collectionId: z.string().uuid(),
  bookmarkIds: z.array(z.string().uuid()),
});

const batchCreateSchema = z.object({
  collectionId: z.string().uuid(),
  bookmarks: z.array(
    z.object({
      title: z.string().min(1).max(500),
      url: z.string().url(),
      description: z.string().optional(),
      favicon: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }),
  ),
});

export const bookmarkRoutes = new Hono<AuthEnv>();
bookmarkRoutes.use('*', authMiddleware);

bookmarkRoutes.get('/', async (c) => {
  const db = getDb();
  const userId = c.get('userId');
  const collectionId = c.req.query('collectionId');

  if (!collectionId) {
    return c.json({ error: 'collectionId query param required' }, 400);
  }

  const [col] = await db.select().from(collections).where(eq(collections.id, collectionId));
  if (!col || col.ownerId !== userId) {
    return c.json({ error: 'Collection not found' }, 404);
  }

  const result = await db
    .select()
    .from(bookmarks)
    .where(eq(bookmarks.collectionId, collectionId))
    .orderBy(asc(bookmarks.orderIndex));

  return c.json({ bookmarks: result });
});

bookmarkRoutes.put('/reorder', zValidator('json', reorderSchema), async (c) => {
  const db = getDb();
  const userId = c.get('userId');
  const { collectionId, bookmarkIds } = c.req.valid('json');

  const [col] = await db.select().from(collections).where(eq(collections.id, collectionId));
  if (!col || col.ownerId !== userId) {
    return c.json({ error: 'Collection not found' }, 404);
  }

  const existing = await db
    .select({ id: bookmarks.id })
    .from(bookmarks)
    .where(eq(bookmarks.collectionId, collectionId));

  const existingIds = new Set(existing.map((b) => b.id));
  for (const id of bookmarkIds) {
    if (!existingIds.has(id)) {
      return c.json({ error: `Bookmark ${id} not found or does not belong to this collection` }, 404);
    }
  }

  await db.transaction(async (tx) => {
    for (let i = 0; i < bookmarkIds.length; i++) {
      await tx
        .update(bookmarks)
        .set({ orderIndex: i, updatedAt: new Date() })
        .where(eq(bookmarks.id, bookmarkIds[i]));
    }
  });

  return c.json({ success: true });
});

bookmarkRoutes.post('/', zValidator('json', createSchema), async (c) => {
  const db = getDb();
  const userId = c.get('userId');
  const body = c.req.valid('json');

  const [col] = await db.select().from(collections).where(eq(collections.id, body.collectionId));
  if (!col || col.ownerId !== userId) {
    return c.json({ error: 'Collection not found' }, 404);
  }

  const [maxOrder] = await db
    .select({ max: sql<number>`COALESCE(MAX(${bookmarks.orderIndex}), -1)` })
    .from(bookmarks)
    .where(eq(bookmarks.collectionId, body.collectionId));

  const [bookmark] = await db
    .insert(bookmarks)
    .values({
      collectionId: body.collectionId,
      title: body.title,
      url: body.url,
      description: body.description || null,
      favicon: body.favicon || `https://icons.duckduckgo.com/ip3/${new URL(body.url).hostname}.ico`,
      tags: body.tags || [],
      orderIndex: (maxOrder?.max ?? -1) + 1,
    })
    .returning();

  return c.json({ bookmark }, 201);
});

bookmarkRoutes.post('/batch', zValidator('json', batchCreateSchema), async (c) => {
  const db = getDb();
  const userId = c.get('userId');
  const body = c.req.valid('json');

  const [col] = await db.select().from(collections).where(eq(collections.id, body.collectionId));
  if (!col || col.ownerId !== userId) {
    return c.json({ error: 'Collection not found' }, 404);
  }

  const values = body.bookmarks.map((b, i) => ({
    collectionId: body.collectionId,
    title: b.title,
    url: b.url,
    description: b.description || null,
    favicon: b.favicon || `https://icons.duckduckgo.com/ip3/${new URL(b.url).hostname}.ico`,
    tags: b.tags || [],
    orderIndex: i,
  }));

  const result = await db.insert(bookmarks).values(values).returning();
  return c.json({ bookmarks: result }, 201);
});

bookmarkRoutes.put('/:id', zValidator('json', updateSchema), async (c) => {
  const db = getDb();
  const userId = c.get('userId');
  const id = c.req.param('id');
  const body = c.req.valid('json');

  const [existing] = await db.select().from(bookmarks).where(eq(bookmarks.id, id));
  if (!existing) {
    return c.json({ error: 'Bookmark not found' }, 404);
  }

  const [col] = await db.select().from(collections).where(eq(collections.id, existing.collectionId));
  if (!col || col.ownerId !== userId) {
    return c.json({ error: 'Bookmark not found' }, 404);
  }

  if (body.collectionId && body.collectionId !== existing.collectionId) {
    const [targetCol] = await db.select().from(collections).where(eq(collections.id, body.collectionId));
    if (!targetCol || targetCol.ownerId !== userId) {
      return c.json({ error: 'Target collection not found' }, 404);
    }
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.title !== undefined) updates.title = body.title;
  if (body.url !== undefined) updates.url = body.url;
  if (body.description !== undefined) updates.description = body.description;
  if (body.favicon !== undefined) updates.favicon = body.favicon;
  if (body.tags !== undefined) updates.tags = body.tags;
  if (body.orderIndex !== undefined) updates.orderIndex = body.orderIndex;
  if (body.collectionId !== undefined) updates.collectionId = body.collectionId;

  const [updated] = await db.update(bookmarks).set(updates).where(eq(bookmarks.id, id)).returning();
  return c.json({ bookmark: updated });
});

bookmarkRoutes.delete('/:id', async (c) => {
  const db = getDb();
  const userId = c.get('userId');
  const id = c.req.param('id');

  const [existing] = await db.select().from(bookmarks).where(eq(bookmarks.id, id));
  if (!existing) {
    return c.json({ error: 'Bookmark not found' }, 404);
  }

  const [col] = await db.select().from(collections).where(eq(collections.id, existing.collectionId));
  if (!col || col.ownerId !== userId) {
    return c.json({ error: 'Bookmark not found' }, 404);
  }

  await db.delete(bookmarks).where(eq(bookmarks.id, id));
  return c.body(null, 204);
});

// Metadata import (public, no auth required for fetching page info)
const importMetaRoutes = new Hono();
importMetaRoutes.post('/import-meta', async (c) => {
  const { url } = await c.req.json();
  if (!url) {
    return c.json({ error: 'URL is required' }, 400);
  }

  try {
    const parsedUrl = new URL(url);
    const favicon = `https://icons.duckduckgo.com/ip3/${parsedUrl.hostname}.ico`;
    let title = parsedUrl.hostname;
    let description = '';

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'TobyBookmark/1.0' },
      });
      clearTimeout(timeout);

      const html = await response.text();
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) title = titleMatch[1].trim();

      const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
      if (descMatch) description = descMatch[1].trim();
    } catch {
      // Fall back to URL-based info
    }

    return c.json({ title, description, favicon, url });
  } catch {
    return c.json({ error: 'Invalid URL' }, 400);
  }
});

bookmarkRoutes.route('/', importMetaRoutes);
