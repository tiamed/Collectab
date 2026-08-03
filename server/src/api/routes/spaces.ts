import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, asc, and, or, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../database/client.js';
import { spaces, spaceMembers, orgMembers } from '../../database/schema.js';
import { authMiddleware, type AuthEnv } from '../middleware/auth.js';

const createSchema = z.object({
  name: z.string().min(1).max(255),
  icon: z.string().max(2048).optional(),
  orgId: z.string().uuid().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  icon: z.string().max(2048).optional(),
  orderIndex: z.number().int().min(0).optional(),
});

export const spaceRoutes = new Hono<AuthEnv>();
spaceRoutes.use('*', authMiddleware);

spaceRoutes.get('/', async (c) => {
  const db = getDb();
  const userId = c.get('userId');
  const orgId = c.req.query('orgId');

  if (orgId) {
    // Verify user has access to this org (owner or member)
    const [membership] = await db.select().from(orgMembers)
      .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)));

    // Also check if user is the org owner
    const { organizations } = await import('../../database/schema.js');
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    if (!org || (org.ownerId !== userId && !membership)) {
      return c.json({ error: 'No access to this organization' }, 403);
    }

    // Return all spaces in this org
    const orgSpaces = await db
      .select()
      .from(spaces)
      .where(eq(spaces.orgId, orgId))
      .orderBy(asc(spaces.orderIndex));

    return c.json({ spaces: orgSpaces });
  }

  // No orgId: return user's personal spaces (no org) + shared spaces
  const owned = await db
    .select()
    .from(spaces)
    .where(and(eq(spaces.ownerId, userId), isNull(spaces.orgId)))
    .orderBy(asc(spaces.orderIndex));

  const shared = await db
    .select({ space: spaces })
    .from(spaceMembers)
    .innerJoin(spaces, eq(spaceMembers.spaceId, spaces.id))
    .where(and(eq(spaceMembers.userId, userId), isNull(spaces.orgId)))
    .orderBy(asc(spaces.orderIndex));

  const allSpaces = [...owned, ...shared.map((s) => s.space)];

  return c.json({ spaces: allSpaces });
});

spaceRoutes.post('/', zValidator('json', createSchema), async (c) => {
  const db = getDb();
  const userId = c.get('userId');
  const { name, icon, orgId } = c.req.valid('json');

  if (orgId) {
    // Verify user has access to org (owner or admin)
    const { organizations } = await import('../../database/schema.js');
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    if (!org) return c.json({ error: 'Organization not found' }, 404);

    const [membership] = await db.select().from(orgMembers)
      .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)));

    if (org.ownerId !== userId && (!membership || membership.role !== 'admin')) {
      return c.json({ error: 'Only org owner/admin can create spaces' }, 403);
    }
  }

  const [space] = await db
    .insert(spaces)
    .values({ ownerId: userId, name, icon: icon || '💼', orgId: orgId || null })
    .returning();

  return c.json({ space }, 201);
});

spaceRoutes.put('/:id', zValidator('json', updateSchema), async (c) => {
  const db = getDb();
  const userId = c.get('userId');
  const id = c.req.param('id');
  const body = c.req.valid('json');

  const [existing] = await db.select().from(spaces).where(eq(spaces.id, id));
  if (!existing || existing.ownerId !== userId) {
    return c.json({ error: 'Space not found' }, 404);
  }

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.icon !== undefined) updates.icon = body.icon;
  if (body.orderIndex !== undefined) updates.orderIndex = body.orderIndex;

  const [updated] = await db.update(spaces).set(updates).where(eq(spaces.id, id)).returning();
  return c.json({ space: updated });
});

spaceRoutes.delete('/:id', async (c) => {
  const db = getDb();
  const userId = c.get('userId');
  const id = c.req.param('id');

  const [existing] = await db.select().from(spaces).where(eq(spaces.id, id));
  if (!existing || existing.ownerId !== userId) {
    return c.json({ error: 'Space not found' }, 404);
  }

  await db.delete(spaces).where(eq(spaces.id, id));
  return c.body(null, 204);
});

// Delete all spaces in an org (or personal if no orgId)
spaceRoutes.delete('/', async (c) => {
  const db = getDb();
  const userId = c.get('userId');
  const orgId = c.req.query('orgId');

  if (orgId) {
    await db.delete(spaces).where(and(eq(spaces.ownerId, userId), eq(spaces.orgId, orgId)));
  } else {
    await db.delete(spaces).where(and(eq(spaces.ownerId, userId), isNull(spaces.orgId)));
  }

  return c.body(null, 204);
});
