import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getDb } from '../../database/client.js';
import { users, spaces } from '../../database/schema.js';
import { getEnv } from '../../config/env.js';
import { authMiddleware, type AuthEnv } from '../middleware/auth.js';

const SALT_ROUNDS = 12;

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1).max(255),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

function generateTokens(userId: string, email: string) {
  const env = getEnv();
  const accessToken = jwt.sign(
    { sub: userId, email },
    env.JWT_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRY_SECONDS },
  );
  const refreshToken = jwt.sign(
    { sub: userId, email, type: 'refresh' },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRY_SECONDS },
  );
  return { accessToken, refreshToken };
}

export const authRoutes = new Hono();

authRoutes.post('/register', zValidator('json', registerSchema), async (c) => {
  const { email, password, name } = c.req.valid('json');
  const db = getDb();

  const [existing] = await db.select().from(users).where(eq(users.email, email));
  if (existing) {
    return c.json({ error: 'Email already registered' }, 409);
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const [user] = await db
    .insert(users)
    .values({ email, name, passwordHash })
    .returning({ id: users.id, email: users.email, name: users.name });

  await db.insert(spaces).values({
    ownerId: user.id,
    name: 'My Space',
    icon: '💼',
    orderIndex: 0,
  });

  const tokens = generateTokens(user.id, user.email);
  return c.json({ user, ...tokens }, 201);
});

authRoutes.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json');
  const db = getDb();

  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) {
    return c.json({ error: 'Invalid email or password' }, 401);
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return c.json({ error: 'Invalid email or password' }, 401);
  }

  const tokens = generateTokens(user.id, user.email);
  return c.json({
    user: { id: user.id, email: user.email, name: user.name },
    ...tokens,
  });
});

authRoutes.post('/refresh', zValidator('json', refreshSchema), async (c) => {
  const { refreshToken } = c.req.valid('json');

  try {
    const env = getEnv();
    const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as {
      sub: string;
      email: string;
      type: string;
    };

    if (decoded.type !== 'refresh') {
      return c.json({ error: 'Invalid token type' }, 401);
    }

    const tokens = generateTokens(decoded.sub, decoded.email);
    return c.json(tokens);
  } catch {
    return c.json({ error: 'Invalid or expired refresh token' }, 401);
  }
});

authRoutes.get('/me', authMiddleware, async (c: any) => {
  const db = getDb();
  const userId = c.get('userId');

  const [user] = await db
    .select({ id: users.id, email: users.email, name: users.name, avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, userId));

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json({ user });
});
