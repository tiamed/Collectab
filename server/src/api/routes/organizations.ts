import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, asc } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../database/client.js';
import { organizations, orgMembers, users } from '../../database/schema.js';
import { authMiddleware, type AuthEnv } from '../middleware/auth.js';

const createSchema = z.object({
  name: z.string().min(1).max(255),
  icon: z.string().max(50).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  icon: z.string().max(50).optional(),
});

const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member']).default('member'),
});

export const orgRoutes = new Hono<AuthEnv>();
orgRoutes.use('*', authMiddleware);

// List orgs the user belongs to (owned + member)
orgRoutes.get('/', async (c) => {
  const db = getDb();
  const userId = c.get('userId');

  const owned = await db
    .select()
    .from(organizations)
    .where(eq(organizations.ownerId, userId))
    .orderBy(asc(organizations.createdAt));

  const memberOf = await db
    .select({ org: organizations, role: orgMembers.role })
    .from(orgMembers)
    .innerJoin(organizations, eq(orgMembers.orgId, organizations.id))
    .where(eq(orgMembers.userId, userId))
    .orderBy(asc(organizations.createdAt));

  const all = [
    ...owned.map((o) => ({ ...o, role: 'owner' as const })),
    ...memberOf.map((m) => ({ ...m.org, role: m.role })),
  ];

  return c.json({ organizations: all });
});

// Create org
orgRoutes.post('/', zValidator('json', createSchema), async (c) => {
  const db = getDb();
  const userId = c.get('userId');
  const { name, icon } = c.req.valid('json');

  const [org] = await db
    .insert(organizations)
    .values({ name, icon: icon || '🏢', ownerId: userId })
    .returning();

  return c.json({ organization: org }, 201);
});

// Update org
orgRoutes.put('/:id', zValidator('json', updateSchema), async (c) => {
  const db = getDb();
  const userId = c.get('userId');
  const id = c.req.param('id');

  const [existing] = await db.select().from(organizations).where(eq(organizations.id, id));
  if (!existing || existing.ownerId !== userId) {
    return c.json({ error: 'Organization not found or not owner' }, 404);
  }

  const updates: Record<string, unknown> = {};
  const body = c.req.valid('json');
  if (body.name !== undefined) updates.name = body.name;
  if (body.icon !== undefined) updates.icon = body.icon;

  const [updated] = await db.update(organizations).set(updates).where(eq(organizations.id, id)).returning();
  return c.json({ organization: updated });
});

// Delete org
orgRoutes.delete('/:id', async (c) => {
  const db = getDb();
  const userId = c.get('userId');
  const id = c.req.param('id');

  const [existing] = await db.select().from(organizations).where(eq(organizations.id, id));
  if (!existing || existing.ownerId !== userId) {
    return c.json({ error: 'Organization not found or not owner' }, 404);
  }

  await db.delete(organizations).where(eq(organizations.id, id));
  return c.body(null, 204);
});

// List members of an org
orgRoutes.get('/:id/members', async (c) => {
  const db = getDb();
  const userId = c.get('userId');
  const id = c.req.param('id');

  const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
  if (!org) return c.json({ error: 'Organization not found' }, 404);

  // Check access: must be owner or member
  const [membership] = await db.select().from(orgMembers)
    .where(and(eq(orgMembers.orgId, id), eq(orgMembers.userId, userId)));

  if (org.ownerId !== userId && !membership) {
    return c.json({ error: 'Not a member' }, 403);
  }

  const [owner] = await db.select({ id: users.id, email: users.email, name: users.name })
    .from(users).where(eq(users.id, org.ownerId));

  const members = await db
    .select({ userId: orgMembers.userId, role: orgMembers.role, email: users.email, name: users.name, createdAt: orgMembers.createdAt })
    .from(orgMembers)
    .innerJoin(users, eq(orgMembers.userId, users.id))
    .where(eq(orgMembers.orgId, id));

  return c.json({ owner, members });
});

// Add member to org
orgRoutes.post('/:id/members', zValidator('json', addMemberSchema), async (c) => {
  const db = getDb();
  const userId = c.get('userId');
  const id = c.req.param('id');
  const { email, role } = c.req.valid('json');

  const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
  if (!org || org.ownerId !== userId) {
    return c.json({ error: 'Only the org owner can add members' }, 403);
  }

  const [targetUser] = await db.select().from(users).where(eq(users.email, email));
  if (!targetUser) {
    return c.json({ error: 'User not found' }, 404);
  }

  if (targetUser.id === userId) {
    return c.json({ error: 'Cannot add yourself' }, 400);
  }

  await db.insert(orgMembers)
    .values({ orgId: id, userId: targetUser.id, role })
    .onConflictDoUpdate({ target: [orgMembers.orgId, orgMembers.userId], set: { role } });

  return c.json({ member: { userId: targetUser.id, email: targetUser.email, name: targetUser.name, role } }, 201);
});

// Remove member from org
orgRoutes.delete('/:id/members/:memberId', async (c) => {
  const db = getDb();
  const userId = c.get('userId');
  const id = c.req.param('id');
  const memberId = c.req.param('memberId');

  const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
  if (!org || org.ownerId !== userId) {
    return c.json({ error: 'Only the org owner can remove members' }, 403);
  }

  await db.delete(orgMembers)
    .where(and(eq(orgMembers.orgId, id), eq(orgMembers.userId, memberId)));

  return c.body(null, 204);
});
