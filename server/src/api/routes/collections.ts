import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, asc } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../database/client.js';
import { collections } from '../../database/schema.js';
import { authMiddleware, type AuthEnv } from '../middleware/auth.js';

const createSchema = z.object({
  spaceId: z.string().uuid(),
  name: z.string().min(1).max(255),
  icon: z.string().max(50).optional(),
  color: z.string().max(7).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  icon: z.string().max(50).optional(),
  color: z.string().max(7).optional(),
  orderIndex: z.number().int().min(0).optional(),
  spaceId: z.string().uuid().optional(),
});

export const collectionRoutes = new Hono<AuthEnv>();
collectionRoutes.use('*', authMiddleware);

collectionRoutes.get('/', async (c) => {
  const db = getDb();
  const userId = c.get('userId');
  const spaceId = c.req.query('spaceId');

  const condition = spaceId
    ? and(eq(collections.ownerId, userId), eq(collections.spaceId, spaceId))
    : eq(collections.ownerId, userId);

  const result = await db
    .select()
    .from(collections)
    .where(condition)
    .orderBy(asc(collections.orderIndex));

  return c.json({ collections: result });
});

collectionRoutes.post('/', zValidator('json', createSchema), async (c) => {
  const db = getDb();
  const userId = c.get('userId');
  const { spaceId, name, icon, color } = c.req.valid('json');

  const [collection] = await db
    .insert(collections)
    .values({
      spaceId,
      ownerId: userId,
      name,
      icon: icon || '📁',
      color: color || '#3b82f6',
    })
    .returning();

  return c.json({ collection }, 201);
});

collectionRoutes.put('/:id', zValidator('json', updateSchema), async (c) => {
  const db = getDb();
  const userId = c.get('userId');
  const id = c.req.param('id');
  const body = c.req.valid('json');

  const [existing] = await db.select().from(collections).where(eq(collections.id, id));
  if (!existing || existing.ownerId !== userId) {
    return c.json({ error: 'Collection not found' }, 404);
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) updates.name = body.name;
  if (body.icon !== undefined) updates.icon = body.icon;
  if (body.color !== undefined) updates.color = body.color;
  if (body.orderIndex !== undefined) updates.orderIndex = body.orderIndex;
  if (body.spaceId !== undefined) updates.spaceId = body.spaceId;

  const [updated] = await db.update(collections).set(updates).where(eq(collections.id, id)).returning();
  return c.json({ collection: updated });
});

collectionRoutes.delete('/:id', async (c) => {
  const db = getDb();
  const userId = c.get('userId');
  const id = c.req.param('id');

  const [existing] = await db.select().from(collections).where(eq(collections.id, id));
  if (!existing || existing.ownerId !== userId) {
    return c.json({ error: 'Collection not found' }, 404);
  }

  await db.delete(collections).where(eq(collections.id, id));
  return c.body(null, 204);
});
